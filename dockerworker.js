/*globals requireJS*/
/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var WEBGME = require('webgme-engine'),
    fs = require('fs'),
    CONSTANTS = requireJS('common/Constants'),
    WorkerRequests = WEBGME.WorkerRequests,
    gmeConfig = WEBGME.getGmeConfig(),
    logger = WEBGME.Logger.create('gme:docker-worker:pid_' + process.pid, gmeConfig.server.log, true);

function safeSend(data) {

    fs.writeFile('webgme-docker-worker-result.json', JSON.stringify(data), function (err) {
        if (data.error || err) {
            console.error(JSON.stringify(data));
            if (err) {
                console.error(err);
            }
            process.exit(1);
        } else {
            console.log(JSON.stringify(data));
            process.exit(0);
        }
    });
}

process.on('uncaughtException', function (err) {
    safeSend({
        error: err.stack
    });
});

function runCommand(parameters) {
    var wr = new WorkerRequests(logger, gmeConfig, parameters.webgmeUrl);
    parameters = parameters || {};
    parameters.command = parameters.command;

    logger.info('Incoming message:', {metadata: parameters});

    if (parameters.command === CONSTANTS.SERVER_WORKER_REQUESTS.EXECUTE_PLUGIN) {
        wr.executePlugin(parameters.webgmeToken, parameters.socketId, parameters.name, parameters.context,
            function (err, result) {
                safeSend({
                    error: err ? err.stack : null,
                    result: result
                });
            }
        );
    } else {
        safeSend({
            error: 'unknown command [' + parameters.command + ']'
        });
    }
}

runCommand(JSON.parse(process.argv[2]));