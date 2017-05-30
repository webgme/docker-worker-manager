/*globals requireJS*/
/*jshint node: true, mocha: true*/
/**
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
        done();
        if (wm) {
            wm.stop()
                .finally(function (err) {
                    wm = null;
                    done(err);
                });
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
                setTimeout(function () {
                    wm.request(getRequestParams(200), reqCb);
                }, 50);

            })
            .catch(done);
    });
});