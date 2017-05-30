/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 */

'use strict';

var config = require('./config.default'),
    packageJson = require('../package.json');

config.server.port = 9001;
config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme_tests';


config.server.workerManager.options.image = 'webgme-dummy-docker-worker:' + packageJson.version;
config.server.workerManager.options.maxRunningContainers = 2;

module.exports = config;