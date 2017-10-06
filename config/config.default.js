/*jshint node: true*/
'use strict';

var config = require('webgme-engine/config/config.default'),
    validateConfig = require('webgme-engine/config/validator').validateConfig,
    path = require('path');

// The server worker manager only makes sense if plugin execution on the server is allowed.
config.plugin.allowServerExecution = true;

// Swap these two lines when webgme-docker-worker-manager is a node_module.
config.server.workerManager.path = path.join(__dirname, '../dockerworkermanager');
// config.server.workerManager.path = 'webgme-docker-worker-manager';

// These are the default options - this section can be left out..
config.server.workerManager.options = {
    //dockerode: null, // https://github.com/apocas/dockerode#getting-started
    network: 'bridge',
    image: 'webgme-docker-worker',
    maxRunningContainers: 4,
    keepContainersAtFailure: false
};

validateConfig(config);
module.exports = config;