/*globals requireJS*/
/*jshint node: true, mocha: true*/
/**
 * Remove all containers:
 *  windows:
 *      FOR /f "tokens=*" %i IN ('docker ps -a -q') DO docker rm %i
 *  linux:
 *      docker rm $(docker ps -a -q)
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

describe('Docker Worker Manager', function () {

    var testFixture = require('./globals'),
        gmeConfig = testFixture.getGmeConfig(),
        Q = testFixture.Q,
        CONSTANTS = requireJS('common/Constants'),
        logger = testFixture.infoLogger.fork('spec'),
        expect = testFixture.expect,
        DockerWorkerManager = require('../dockerworkermanager'),
        Docker = require('dockerode'),
        docker = new Docker(gmeConfig.server.workerManager.options.dockerode),
        wm;

    function getRequestParams(timeout, expectType) {

        return {
            timeout: timeout || 0,
            expect: expectType || 0,
            // parameters.expect = 0 -> success
            // parameters.expect = 1 -> failure with result
            // parameters.expect = 2 -> failure without result
            command: CONSTANTS.SERVER_WORKER_REQUESTS.EXECUTE_PLUGIN,
            name: 'DummyPlugin',
            context: {
                managerConfig: {
                    project: 'DummyProjectId'
                }
            }
        };
    }

    before(function (done) {
        this.timeout(200000);
        docker.listImages()
            .then(function (images) {
                var exists = false;

                console.log('Checking if image exists', gmeConfig.server.workerManager.options.image);

                images.forEach(function (info) {
                    if (info.RepoTags.indexOf(gmeConfig.server.workerManager.options.image) > -1) {
                        exists = true;
                    }
                });

                if (exists) {
                    console.log('Image existed');
                    return Q.resolve();
                } else {
                    console.log('Image did not exist, building...');
                    return docker.buildImage({
                        context: __dirname,
                        src: ['Dockerfile', 'dummyworker.js']
                    }, {
                        t: gmeConfig.server.workerManager.options.image
                    });
                }
            })
            .then(function (stream) {
                if (stream) {
                    stream.pipe(process.stdout, {end: true});

                    stream.on('end', function () {
                        console.log('Finished building image', gmeConfig.server.workerManager.options.image);
                        done();
                    });
                } else {
                    done();
                }
            })
            .catch(done);
    });

    afterEach(function (done) {
        if (wm) {
            wm.stop()
                .finally(function (err) {
                    wm = null;
                    done(err);
                });
        } else {
            done();
        }
    });

    it('should start and stop', function (done) {
        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        expect(wm.isRunning).to.equal(false);

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                return wm.stop();
            })
            .then(function () {
                expect(wm.isRunning).to.equal(false);
            })
            .nodeify(done);
    });

    it('non plugin command should be handled by regular SWM', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                wm.request({command: 'DummyCommand'}, function (err) {
                    try {
                        expect(err.message).to.contain('unknown command');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            })
            .catch(done);
    });

    it('should handle plugin request and return success result', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                wm.request(getRequestParams(), function (err, result) {
                    try {
                        expect(err).to.equal(null);
                        expect(result.pluginId).to.equal('DummyPlugin');
                        expect(result.success).to.equal(true);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            })
            .catch(done);
    });

    it('should handle plugin request and return failure result', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                wm.request(getRequestParams(0, 1), function (err, result) {
                    try {
                        expect(err instanceof Error).to.equal(true);
                        expect(err.message).to.equal('Plugin failed');
                        expect(result.pluginId).to.equal('DummyPlugin');
                        expect(result.success).to.equal(false);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            })
            .catch(done);
    });

    it('should handle plugin request and return error result', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                wm.request(getRequestParams(0, 2), function (err, result) {
                    try {
                        expect(err instanceof Error).to.equal(true);
                        expect(err.message).to.equal('Plugin execution errored');
                        expect(typeof result).to.equal('undefined');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            })
            .catch(done);
    });

    it('should handle plugin request and return uncaught exception result', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                wm.request(getRequestParams(0, 3), function (err, result) {
                    try {
                        expect(err instanceof Error).to.equal(true);
                        expect(err.message).to.equal('Unhandled error');
                        expect(typeof result).to.equal('undefined');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            })
            .catch(done);
    });

    it('should gracefully handle case where no report file generated', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                expect(wm.isRunning).to.equal(true);
                wm.request(getRequestParams(0, 4), function (err) {
                    try {
                        expect(err instanceof Error).to.equal(true);
                        expect(err.message).to.include('no such file or directory');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            })
            .catch(done);
    });

    // FIXME: This fails on windows (at least) with the error the the container is already being removed..
    it('should handle two requests in parallel', function (done) {
        this.timeout(10000);

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {
                var twoWereRunning = false,
                    intervalId = setInterval(function () {
                        if (Object.keys(wm.running).length === 2) {
                            twoWereRunning = true;
                            clearInterval(intervalId);
                        }
                    }, 50),
                    cnt = 2,
                    error;

                function reqCb(err, result) {
                    error = error || err;
                    cnt -= 1;

                    console.log(JSON.stringify(result));

                    if (cnt === 0) {
                        clearInterval(intervalId);
                        if (error) {
                            done(error);
                        } else if (twoWereRunning === false) {
                            done(new Error('Two containers were never running'));
                        } else {
                            done();
                        }
                    }
                }

                expect(wm.isRunning).to.equal(true);

                wm.request(getRequestParams(200), reqCb);
                wm.request(getRequestParams(200), reqCb);

            })
            .catch(done);
    });

    it('should handle two requests but not run them in parallel (maxRunningContainers = 1) ', function (done) {
        this.timeout(10000);
        var oneContainerConfig = testFixture.getGmeConfig();

        oneContainerConfig.server.workerManager.options.maxRunningContainers = 1;

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: oneContainerConfig
        });

        wm.start()
            .then(function () {
                var twoWereRunning = false,
                    oneRunningOneQueued = false,
                    intervalId = setInterval(function () {
                        var nRunning = Object.keys(wm.running).length;
                        if (nRunning === 2) {
                            twoWereRunning = true;
                        } else if (nRunning === 1 && wm.queue.length === 1) {
                            oneRunningOneQueued = true;
                        }

                        if (twoWereRunning && oneRunningOneQueued) {
                            // Here we can clear it (should not happen at success though..
                            clearInterval(intervalId);
                        }
                    }, 50),
                    cnt = 2,
                    error;

                function reqCb(err, result) {
                    error = error || err;
                    cnt -= 1;

                    console.log(JSON.stringify(result));

                    if (cnt === 0) {
                        clearInterval(intervalId);
                        if (error) {
                            done(error);
                        } else if (twoWereRunning === true) {
                            done(new Error('Two containers were running!'));
                        } else if (oneRunningOneQueued === false) {
                            done(new Error('One running and one queued never happened!'));
                        } else {
                            done();
                        }
                    }
                }

                expect(wm.isRunning).to.equal(true);

                wm.request(getRequestParams(200), reqCb);
                wm.request(getRequestParams(200), reqCb);
            })
            .catch(done);
    });

    it('should stop and remove running container at stop and call the callback with error 1', function (done) {
        // This is shutting down during creation of the container.
        this.timeout(10000);

        var cbCalled = false,
            error = null;

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {

                expect(wm.isRunning).to.equal(true);


                function reqCb(err) {
                    cbCalled = true;

                    try {
                        expect(err instanceof Error).to.equal(true);
                        expect(err.message).to.include('Worker Manager was shutdown');
                    } catch (e) {
                        error = e;
                    }
                }

                wm.request(getRequestParams(10000), reqCb);

                return wm.stop();
            })
            .then(function () {
                expect(cbCalled).to.equal(true);
                expect(Object.keys(wm.running).length).to.equal(0);
                expect(Object.keys(wm.queue).length).to.equal(0);
                expect(error).to.equal(null);
                done();
            })
            .catch(done);
    });

    it('should stop and remove running container at stop and call the callback with error 2', function (done) {
        // This is shutting down after the container has been created
        this.timeout(10000);

        var cbCalled = false,
            error = null;

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: gmeConfig
        });

        wm.start()
            .then(function () {

                expect(wm.isRunning).to.equal(true);

                function reqCb(err) {
                    cbCalled = true;

                    try {
                        expect(err instanceof Error).to.equal(true);
                        expect(err.message).to.include('Worker Manager was shutdown');
                    } catch (e) {
                        error = e;
                    }
                }

                wm.request(getRequestParams(10000), reqCb);

                setTimeout(function () {
                    wm.stop()
                        .then(function () {
                            expect(cbCalled).to.equal(true);
                            expect(Object.keys(wm.running).length).to.equal(0);
                            expect(Object.keys(wm.queue).length).to.equal(0);
                            expect(error).to.equal(null);
                            done();
                        })
                        .catch(done);
                }, 1000);
            })
            .catch(done);
    });

    it('should call the callback of queued requests at stop', function (done) {
        this.timeout(10000);
        var oneContainerConfig = testFixture.getGmeConfig(),
            cnt = 2,
            error = null;

        oneContainerConfig.server.workerManager.options.maxRunningContainers = 1;

        wm = new DockerWorkerManager({
            logger: logger,
            gmeConfig: oneContainerConfig
        });

        wm.start()
            .then(function () {

                function reqCb(err) {
                    cnt -= 1;
                    try {
                        expect(err.message).to.include('Worker Manager was shutdown');
                    } catch (e) {
                        error = e;
                    }
                }

                expect(wm.isRunning).to.equal(true);

                wm.request(getRequestParams(10000), reqCb);
                wm.request(getRequestParams(10000), reqCb);

                return wm.stop();
            })
            .then(function () {
                expect(cnt).to.equal(0);
                expect(Object.keys(wm.running).length).to.equal(0);
                expect(Object.keys(wm.queue).length).to.equal(0);
                expect(error).to.equal(null);
                done();
            })
            .catch(done);
    });
});