/* globals process, require, module */
const config = require('./config.default');
//const validateConfig = require('webgme-engine/config/validator');

// This is only for testing - it will persist everything inside the containers.
config.mongo.uri = 'mongodb://' + process.env.MONGO_IP + ':27017/multi';
config.server.workerManager.options.webgmeUrl = 'http://' + process.env.WEBGME_IP + ':' + config.server.port;
config.server.workerManager.options.image = 'docker-worker-manager_webgme-docker-worker';


//validateConfig(config);
module.exports = config;
