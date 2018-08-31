/* globals process, require, module */
const config = require('./config.default');

// This is only for testing - it will persist everything inside the containers.
config.mongo.uri = 'mongodb://' + process.env.MONGO_IP + ':27017/multi';
config.server.workerManager.options.webgmeUrl = 'http://' + process.env.WEBGME_IP + ':' + config.server.port;
config.server.workerManager.options.image = 'docker-worker-manager_webgme-docker-worker';
config.server.workerManager.options.createParams = {
    HostConfig: {
        Memory: 536870912
    }
};

config.seedProjects.createAtStartup = [{
    projectName: 'Example',
    seedId: 'EmptyProject',
    creatorId: 'guest',
    rights: {}
}];

//validateConfig(config);
module.exports = config;
