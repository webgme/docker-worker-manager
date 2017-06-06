# webgme-docker-worker

Note! This is not yet published!

Since webgme version [2.14.0](https://github.com/webgme/webgme/releases/tag/v2.14.0) the server worker manager is a replaceable module. 
The server worker manager (SWM) handles computationally expensive requests such as project/model export, constraint checking, 
project seeding etc., in processes separate from the server process. 

If server execution of plugins is available (`gmeConfig.plugin.allowServerExecution = true;`) these are also handled by the SWM. 
This module will reuses the basic webgme SWM, but instead of running plugins in separate processes they are executed in docker containers.

It's worth mentioning here that plugins executed on the server do not directly connect to storage database, but rather connects
to the webgme server through websockets using the identity of the invoker of the plugin. This means they can't access projects outside of the users scope.

## Usage

The host machine must have docker installed. The current setup does not work on docker on windows.

Add this a node-module.
```
npm install webgme-docker-worker-manager --save
```

The manager launches containers from existing images. To build an image with the full "webgme stack" for executing plugins. 
Read through the short [Dockerfile](/Dockerfile). Build correctly it will include all plugins and code for the specific repo.

Move over and modify the configuration parameters illustrated in [gmeConfig](./config/config.default.js) to your configuration file.


## Developers

### Tests
To run the full stack tests the a docker images must be built first.

Make sure that the node_modules aren't installed before building the image! 

```
docker build -t docker-worker-test:<PACKAGE_JSON.version> .
```

### Publish
```
npm prune
npm install
npm version 0.1.0 -m "Release %s"
git push origin master
git checkout v0.1.0
git push origin v0.1.0
npm publish ./
```

After bumping the version make sure to bump image version in `.travis.yml`.
