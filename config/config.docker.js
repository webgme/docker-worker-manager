/* globals process, require, module */
const config = require('./config.webgme');
const validateConfig = require('webgme-engine/config/validator');

// This is only for testing - it will persist everything inside the containers.
config.mongo.uri = 'mongodb://' + process.env.MONGO_IP + ':27017/multi';
config.server.workerManager.options.webgmeUrl = 'http://' + process.env.WEBGME_IP + ':' + config.server.port;


validateConfig(config);
module.exports = config;