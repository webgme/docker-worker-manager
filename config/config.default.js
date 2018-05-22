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
    image: 'webgme-docker-worker', // By default all plugins will from this images
    maxRunningContainers: 2,
    keepContainersAtFailure: false,
    // This should be a port to the webgme server on the host.
    // If the webgme server is running on the host - the default fallback of config.server.port will work.
    // This is needed if the webgme server itself is running inside a docker container and its port
    // isn't map to the same host port.
    // webgmeServerPort: <config.server.port>,

    // Specific image to use for plugin. Set to null if plugin shouldn't run within docker container.
    pluginToImage: {
        // PluginGenerator: null,
        // ConfigurationArtifact: 'another-image'
    },
};

validateConfig(config);
module.exports = config;