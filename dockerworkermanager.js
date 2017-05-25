/*globals requireJS*/
/*jshint node: true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var Docker = require('dockerode'),
    Q = require('q'),
    tar = require('tar-stream'),
    CONSTANTS = requireJS('common/Constants'),
    WorkerManagerBase = require('webgme/src/server/worker/WorkerManagerBase'),
// ServerWorkerManager will receive all non-plugin requests.
    ServerWorkerManager = require('webgme/src/server/worker/serverworkermanager'),
    container;


function DockerWorkerManager(params) {
    var logger = params.logger.fork('DockerWorkerManager'),
        gmeConfig = params.gmeConfig,
        docker = new Docker(gmeConfig.server.workerManager.options.dockerode),
        swm = new ServerWorkerManager(params),
        webgmeUrl;

    this.queue = [];

    this.request = function (parameters, callback) {
        var dockerParams;

        if (parameters.command === CONSTANTS.SERVER_WORKER_REQUESTS.EXECUTE_PLUGIN) {
            logger.info('"executePlugin" received - launching docker container');
            parameters.webgmeUrl = webgmeUrl;

            dockerParams = {
                Image: gmeConfig.server.workerManager.options.image || 'webgme-docker-worker',
                name: parameters.name + '_' + Date.now(),
                Tty: false, // False in order to separate stdout/err.
                Env: ['NODE_ENV=' + (process.NODE_ENV || 'default')],
                Cmd: ['node', 'dockerworker.js', JSON.stringify(parameters)]
            };

            console.log(dockerParams);

            docker.createContainer(dockerParams)
                .then(function (container_) {
                    container = container_;

                    logger.info('Container created');

                    container.attach({stream: true, stdout: true, stderr: true}, function (err, stream) {
                        container.modem.demuxStream(stream, process.stdout, process.stderr);
                    });

                    return container.start();
                })
                .then(function () {
                    logger.info('Container started');
                    return container.wait();
                })
                .then(function () {
                    logger.info('Container finished');
                    return container.getArchive({path: '/usr/app/webgme-docker-worker-result.json'});
                })
                .then(function (res) {
                    var deferred = Q.defer(),
                        extract = tar.extract(),
                        jsonContent = '';

                    extract.on('entry', function (header, stream, next) {

                        stream.on('data', function (data) {
                            // There should really on be one file..
                            if (header.name === 'webgme-docker-worker-result.json') {
                                jsonContent += data.toString();
                            }
                        });

                        stream.on('end', function () {
                            next();
                        });

                        stream.resume();
                    });

                    extract.on('finish', function () {
                        // all entries read
                        deferred.resolve(jsonContent);
                    });

                    logger.info('Received artifcat');

                    res.pipe(extract);

                    return deferred.promise;
                })
                .then(function (resultStr) {
                    logger.info('Got result str', resultStr);

                    var res = JSON.parse(resultStr);

                    callback(res.error, res.result);

                    return container.remove();
                })
                .catch(function (err) {
                    console.log(err);
                    callback(err.message);
                });

        } else {
            logger.info('"', parameters.command, '" received - letting regular SWM handle it.');
            swm.request(parameters, callback);
        }
    };

    this.start = function (callback) {
        var deferred = Q.defer(); // dockerode promises do not have nodeify..

        swm.start()
            .then(function () {
                var network = docker.getNetwork('bridge');

                return network.inspect();
            })
            .then(function (networkInfo) {
                if (!(networkInfo && networkInfo.IPAM &&
                    networkInfo.IPAM.Config instanceof Array &&
                    typeof networkInfo.IPAM.Config[0] === 'object' &&
                    typeof networkInfo.IPAM.Config[0].Gateway === 'string')) {

                    logger.error(new Error('Could not inspect docker "bridge" network correctly ' +
                        JSON.stringify(networkInfo)));

                    // throw new Error('Could not inspect docker "bridge" network correctly ' +
                    // JSON.stringify(networkInfo));
                }

                webgmeUrl = 'http://' + networkInfo.IPAM.Config[0].Gateway + ':' + gmeConfig.server.port;
                logger.info('webgme accessible at', webgmeUrl, 'from docker containers.');
            })
            .then(deferred.resolve)
            .catch(deferred.reject);

        return deferred.promise.nodeify(callback);
    };

    this.stop = function (callback) {
        return swm.stop()
            .then(function () {

            })
            .nodeify(callback);
    };
}

DockerWorkerManager.prototype = Object.create(WorkerManagerBase.prototype);
DockerWorkerManager.prototype.constructor = DockerWorkerManager;

module.exports = DockerWorkerManager;