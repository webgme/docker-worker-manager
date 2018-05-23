# webgme-docker-worker
Since webgme version [2.14.0](https://github.com/webgme/webgme/releases/tag/v2.14.0) the server worker manager is a replaceable module. 
The server worker manager (SWM) handles computationally expensive requests such as project/model export, constraint checking, 
project seeding etc., in processes separate from the server process. 

If server execution of plugins is available (`gmeConfig.plugin.allowServerExecution = true;`) these are also handled by the SWM. 
This module will reuses the basic webgme SWM, but instead of running plugins in separate processes they are executed in docker containers.
(This can be configured per plugin, see config/config.default.js)

It's worth mentioning here that plugins executed on the server do not directly connect to storage database, but rather connects
to the webgme server through websockets using the identity of the invoker of the plugin. This means they can't access projects outside of the user's scope.

## Usage

The host machine must have docker installed.

Add this a node-module.
```
npm install webgme-docker-worker-manager --save
```

The manager launches containers from existing images. To build an image with the full "webgme stack" for executing plugins. 
Read through the short [Dockerfile](/Dockerfile). Built correctly it will include all plugins and code for the specific repo.

Move over and modify the configuration parameters illustrated in [gmeConfig](./config/config.default.js) to your configuration file.

### Together with Dockerized WebGME Server
If the webgme server itself runs within a docker container it is preferable to run the workers as sibling containers.
With using the default settings the webgme container can be given access to the docker socket by mapping it as a volume to
the webgme-server (`-v`).

Currently the webgme server needs to be available from the host which can be acheived using the `-p` option. If the port on the host
is different, this port be specified in the `config.server.workerManager.options.webgmeServerPort`.
(As always, gmeConfig params can be overwritten through env. vars. using `process.ENV` in your config file.)

```
docker run -d -p 8888:8888 -v /var/run/docker.sock:/var/run/docker.sock -e NODE_ENV='myConfigWithDockerWM' webgme-server
```

### Notes on Limitations
The current setup does not work on docker on windows.

### Common Issues
If after installing docker you get the error at the server start
`Could not find correct info from docker "bridge" network correctly` a reload of docker daemon might fix the issue as mentioned in this issue.

https://github.com/moby/moby/issues/26799

## Developers

### Tests
To run the full stack tests the a docker images must be built first.

```
docker build -t docker-worker-test:<PACKAGE_JSON.version> .
```

### Publish
```
npm version 0.1.0 -m "Release %s"
git push origin master
git checkout v0.1.0
git push origin v0.1.0
npm publish ./
```

After bumping the version make sure to bump image version in `.travis.yml`.
