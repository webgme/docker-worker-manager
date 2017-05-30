/*jshint node: true*/
'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator'),
    path = require('path');

config.plugin.allowServerExecution = true;
config.server.workerManager.path = path.join(__dirname, '../dockerworkermanager');
config.server.workerManager.options = {
    //dockerode: null, // https://github.com/apocas/dockerode#getting-started
    image: 'webgme-docker-worker',
    maxRunningContainers: 4,
    keepContainersAtFailure: false
};

validateConfig(config);
module.exports = config;