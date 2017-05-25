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

    console.log('Incoming message:', {metadata: parameters});

    if (parameters.command === 'executePlugin') {

        if (true) {
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
        } else {
            safeSend({
                error: new Error('Plugin failed'),
                result: null
            });
        }

    } else {
        safeSend({
            error: 'unknown command ' + parameters.command
        });
    }
}

console.log('Inside dummy worker');
runCommand(JSON.parse(process.argv[2]));