/*globals requireJS*/
/*jshint node: true*/
/**
 * https://docs.docker.com/engine/api/v1.29
 *
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var Docker = require('dockerode'),
    Q = require('q'),
    tar = require('tar-stream'),
    CONSTANTS = requireJS('common/Constants'),
    guid = requireJS('common/util/guid'),
    WorkerManagerBase = require('webgme/src/server/worker/WorkerManagerBase'),
// ServerWorkerManager will receive all non-plugin requests.
    ServerWorkerManager = require('webgme/src/server/worker/serverworkermanager'),
    Stream = require('stream'),
    container;


function DockerWorkerManager(params) {
    var self = this,
        logger = params.logger.fork('DockerWorkerManager'),
        gmeConfig = params.gmeConfig,
        docker = new Docker(gmeConfig.server.workerManager.options.dockerode),
        swm = new ServerWorkerManager(params),
        maxRunning = gmeConfig.server.workerManager.options.maxRunningContainers || 2,
        webgmeUrl;

    function getStreamLoggers(jobId) {
        var debugStream = new Stream.Writable(),
            errorStream = new Stream.Writable();

        debugStream._write = function (chunk, encoding, next) {
            // Warn, info and debug will go to debug.
            logger.debug(jobId, ':', chunk.toString());
            next();
        };

        errorStream._write = function (chunk, encoding, next) {
            logger.error(jobId, ':', chunk.toString());
            next();
        };

        return {
            debug: debugStream,
            error: errorStream
        };
    }


    this.queue = [];
    this.running = {};
    this.isRunning = false;

    function launchContainer(jobId) {
        var job = self.running[jobId],
            error,
            result;

        function final() {
            job.callback(error, result);
        }

        logger.debug('Creating container', job.dockerParams);
        docker.createContainer(job.dockerParams)
            .then(function (container_) {
                var streamLoggers = getStreamLoggers(jobId);
                container = container_;

                logger.debug('Container created', container.id, 'for job', jobId);
                if (self.isRunning === false) {
                    // This is needed at stop.
                    throw new Error('Worker Manager was shutdown!');
                }

                job.containerId = container.id;

                container.attach({stream: true, stdout: true, stderr: true}, function (err, stream) {
                    container.modem.demuxStream(stream, streamLoggers.debug, streamLoggers.error);
                });

                return container.start();
            })
            .then(function () {
                logger.debug('Container started for job', jobId);
                return container.wait();
            })
            .then(function () {
                logger.debug('Container finished for job', jobId);
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

                logger.debug('Received artifact from job', jobId);

                res.pipe(extract);

                return deferred.promise;
            })
            .then(function (resultStr) {
                logger.debug('Got result str', resultStr, 'for job', jobId);
                var parsedRes = JSON.parse(resultStr);

                result = parsedRes.result;
                error = parsedRes.error ? new Error(parsedRes.error) : null;

                return container.remove();
            })
            .then(final)
            .catch(function (err) {
                var promise;

                logger.error(err.stack);

                // Report the job error..
                error = error || err;

                if (container) {
                    if (gmeConfig.server.workerManager.options.keepContainersAtFailure) {
                        promise = container.kill(); // kill or stop?
                    } else {
                        promise = container.remove({force: true});
                    }

                    promise
                        .then(final)
                        .catch(function (err) {
                            logger.error(err.stack);
                            final();
                        });
                } else {
                    logger.debug('Container is not running for job', jobId);
                    final();
                }
            });
    }

    function checkQueue() {
        var runningIds = Object.keys(self.running),
            job;

        if (self.queue.length <= 0 || runningIds.length >= maxRunning || self.isRunning === false) {
            return;
        }

        job = self.queue.shift();
        self.running[job.id] = job;

        job.callback = function (err, res) {
            delete self.running[job.id];
            job.requesterCallback(err, res);

            if (self.isRunning) {
                // Break the recursion
                setImmediate(checkQueue);
            }
        };

        launchContainer(job.id);
    }

    function stopRunningContainers() {
        var deferred = Q.defer(),
            runningIds = Object.keys(self.running),
            cnt = runningIds.length;

        self.queue.forEach(function (queuedJob) {
            queuedJob.requesterCallback(new Error('Worker Manager was shutdown!'));
        });

        self.queue = [];

        if (cnt === 0) {
            deferred.resolve();
        }

        runningIds.forEach(function (jobId) {
            var job = self.running[jobId],
                promise,
                container;

            // High-jack the callback from the queue handling.
            job.callback = function (err) {
                logger.info('Worker shutdown', jobId, err);

                job.requesterCallback(new Error('Worker Manager was shutdown!'));
                cnt -= 1;

                if (cnt === 0) {
                    self.running = {};
                    deferred.resolve();
                }
            };

            if (self.running[jobId].containerId) {
                logger.info(jobId, 'have a containerId - removing it forcefully and awaiting response.');
                container = docker.getContainer(self.running[jobId].containerId);

                if (gmeConfig.server.workerManager.options.keepContainersAtFailure) {
                    promise = container.kill();
                } else {
                    promise = container.remove({force: true});
                }

                promise
                    .catch(function (err) {
                        job.callback(err);
                    });
            } else {
                logger.info(jobId, 'does not have a containerId - it is in launching phase and ' +
                    'should throw an error.');
            }
        });

        return deferred.promise;
    }

    this.request = function (parameters, callback) {
        var jobId;

        if (parameters.command === CONSTANTS.SERVER_WORKER_REQUESTS.EXECUTE_PLUGIN) {
            logger.debug('"executePlugin" received - launching docker container');

            // This is used as the name of the container as well.
            jobId = parameters.name + '_' + guid();

            parameters.webgmeUrl = webgmeUrl;

            self.queue.push({
                id: jobId,
                containerId: null,
                requesterCallback: callback,
                dockerParams: {
                    Image: gmeConfig.server.workerManager.options.image || 'webgme-docker-worker',
                    name: jobId,
                    Tty: false, // False in order to separate stdout/err.
                    Env: ['NODE_ENV=' + (process.env.NODE_ENV || 'default')],
                    Cmd: ['node', 'dockerworker.js', JSON.stringify(parameters)]
                }
            });

            checkQueue();
        } else {
            logger.debug('"', parameters.command, '" received - letting regular SWM handle it.');
            swm.request(parameters, callback);
        }
    };

    this.start = function (callback) {
        var deferred = Q.defer();

        if (self.isRunning) {
            deferred.resolve();
            return deferred.promise.nodeify(callback);
        }

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

                    throw new Error('Could not find correct info from docker "bridge" network correctly ' +
                    JSON.stringify(networkInfo));
                }

                webgmeUrl = 'http://' + networkInfo.IPAM.Config[0].Gateway + ':' + gmeConfig.server.port;
                logger.info('webgme accessible at', webgmeUrl, 'from docker containers.');
                self.isRunning = true;
            })
            .then(deferred.resolve)
            .catch(deferred.reject);

        return deferred.promise.nodeify(callback);
    };

    this.stop = function (callback) {
        self.isRunning = false;

        return Q.all([
            swm.stop(),
            stopRunningContainers()
        ])
            .nodeify(callback);
    };
}

DockerWorkerManager.prototype = Object.create(WorkerManagerBase.prototype);
DockerWorkerManager.prototype.constructor = DockerWorkerManager;

module.exports = DockerWorkerManager;