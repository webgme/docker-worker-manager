/*jshint node:true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';
var fs = require('fs');

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

function runCommand(parameters) {
    parameters = parameters || {};
    parameters.command = parameters.command;

    // Additional parameters for testing
    // parameters.expect = 0 -> success
    // parameters.expect = 1 -> failure with result
    // parameters.expect = 2 -> failure without result

    console.log('Incoming message:', {metadata: parameters});

    if (parameters.command === 'executePlugin') {
        if (!parameters.expect) {
            safeSend({
                error: null,
                result: {
                    artifacts: [],
                    commits: [],
                    error: null,
                    finishTime: (new Date()).toISOString(),
                    messages: [],
                    pluginName: parameters.name,
                    pluginId: parameters.name,
                    projectId: parameters.context.managerConfig.project,
                    startTime: (new Date()).toISOString(),
                    success: true
                }
            });
        } else if (parameters.expect === 1) {
            safeSend({
                error: 'Plugin failed',
                result: {
                    artifacts: [],
                    commits: [],
                    error: 'Plugin failed',
                    finishTime: (new Date()).toISOString(),
                    messages: [],
                    pluginName: parameters.name,
                    pluginId: parameters.name,
                    projectId: parameters.context.managerConfig.project,
                    startTime: (new Date()).toISOString(),
                    success: false
                }
            });
        } else if (parameters.expect === 2) {
            safeSend({
                error: 'Plugin execution errored'
            });
        } else if (parameters.expect === 3) {
            throw new Error('Unhandled error');
        }

    } else {
        safeSend({
            error: 'unknown command ' + parameters.command
        });
    }
}

if (typeof describe !== 'undefined') {
    // Loaded by mocha...
} else {
    console.log('Inside dummy worker');

    process.on('uncaughtException', function (err) {
        console.error(err.stack);
        safeSend({
            error: err.message
        });
    });

    var input = JSON.parse(process.argv[2]);
    setTimeout(function () {
        runCommand(input);
    }, input.timeout || 0);
}