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

    image: 'webgme-docker-worker', // By default all plugins will from this images
    maxRunningContainers: 2,
    keepContainersAtFailure: false,
    // Specific image to use for plugin. Set to null if plugin shouldn't run within docker container.
    pluginToImage: {
        // PluginGenerator: null,
        // ConfigurationArtifact: 'another-image'
    },

    // The docker network used. By default containers are running within the bridge network and
    // can access the host at that network. Unless webgmeUrl is specified the dockerworkermanager can
    // figure out the host IP by querying the network. If using another network than bridge - this
    // process only works if the host is accessible from that network. (Consider using webgmeUrl for more
    // restricted networks.
    network: 'bridge',

    // If the webgme server is running on the host - the default fallback of config.server.port will work.
    // This can be needed if the webgme server itself is running inside a docker container and its port
    // isn't map to the same host port. It typically requires the default bridge network to be used.
    webgmeServerPort: null,

    // If specified will be used as the full webgme server url from the perspective of a
    // running docker worker.
    // This is needed when connecting to the webgme server container directly (without going through the host).
    // When defined  the network and webgmeServerPort options aren't used.
    webgmeUrl: null,
};

validateConfig(config);
module.exports = config;