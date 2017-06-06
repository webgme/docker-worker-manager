/*jshint node: true, mocha: true*/

/**
 * Make sure to build 
 *   $ docker build -t docker-worker-test:<PACKAGE_VERSION> .
 * 
 * @author pmeijer / https://github.com/pmeijer
 */
'use strict';

describe('Full stack DWM', function () {

    var testFixture = require('./globals'),
        gmeConfig = testFixture.getGmeConfig(),
        Q = testFixture.Q,
        logger = testFixture.infoLogger.fork('fullstack.spec'),
        expect = testFixture.expect,
        Docker = require('dockerode'),
        docker = new Docker(gmeConfig.server.workerManager.options.dockerode),
        superagent = testFixture.superagent,
        safeStorage,
        gmeAuth,
        server,
        ir;

    gmeConfig.server.workerManager.options.image = 'docker-worker-test:' + require('../package.json').version;
    gmeConfig.authentication.enable = true;

    before(function (done) {
        this.timeout(200000);
        docker.listImages()
            .then(function (images) {
                var exists = false;

                logger.info('Checking if image exists', gmeConfig.server.workerManager.options.image);
                images.forEach(function (info) {
                    if (info.RepoTags.indexOf(gmeConfig.server.workerManager.options.image) > -1) {
                        exists = true;
                    }
                });

                if (!exists) {
                    throw new Error('Image "' + gmeConfig.server.workerManager.options.image + '" must be prebuilt ' +
                        'from Dockerfile in root.');
                }

                logger.info('Image existed will proceed...');
                return testFixture.clearDBAndGetGMEAuth(gmeConfig);
            })
            .then(function (gmeAuth_) {
                gmeAuth = gmeAuth_;

                safeStorage = testFixture.getMongoStorage(logger, gmeConfig, gmeAuth);
                return safeStorage.openDatabase();
            })
            .then(function () {
                return testFixture.importProject(safeStorage, {
                    projectSeed: testFixture.SEED_DIR + '/EmptyProject.webgmex',
                    projectName: 'DockerWorkerManagerTest',
                    gmeConfig: gmeConfig,
                    logger: logger
                });
            })
            .then(function (ir_) {
                ir = ir_;

                return Q.allDone([
                    ir.project.createBranch('b1', ir.commitHash),
                    ir.project.createBranch('b2', ir.commitHash),
                    ir.project.createBranch('b3', ir.commitHash)
                ]);
            })
            .then(function () {
                server = testFixture.WebGME.standaloneServer(gmeConfig);
                server.start(done);
            })
            .catch(done);
    });

    after(function (done) {
        server.stop(function (err) {
            gmeAuth.unload()
                .finally(function (err2) {
                    safeStorage.closeDatabase()
                        .finally(function (err3) {
                            done(err || err2 || err3);
                        });
                });
        });
    });

    it('should export branch through regular SWM', function (done) {
        var url = server.getUrl() + '/api/projects/guest/DockerWorkerManagerTest/branches/master/export';

        superagent.get(url)
            .end(function (err, res) {
                try {
                    expect(res.status).equal(200, err);
                    expect(res.res.headers['content-disposition']).to.contains('filename');
                    expect(res.res.headers['content-disposition']).to.contains('.webgmex');
                    expect(res.res.headers['content-type']).to.eql('application/octet-stream');
                    done();
                } catch (e) {
                    return done(e);
                }
            });
    });

    it('should run plugin that updates the model', function (done) {
        var requestBody = {
            pluginId: 'MinimalWorkingExample',
            projectId: ir.project.projectId,
            branchName: 'b1'
        };

        this.timeout(10000);
        superagent.post(server.getUrl() + '/api/v1/plugin/MinimalWorkingExample/execute')
            .send(requestBody)
            .end(function (err, res) {
                var resultId = res.body.resultId,
                    intervalId;

                try {
                    expect(res.status).equal(200, err);
                    expect(typeof resultId).to.equal('string');
                } catch (e) {
                    return done(e);
                }

                intervalId = setInterval(function () {
                    superagent.get(server.getUrl() + '/api/v1/plugin/MinimalWorkingExample/results/' + resultId)
                        .end(function (err, res) {
                            if (err) {
                                clearInterval(intervalId);
                                return done(err);
                            }

                            if (res.body.status === 'FINISHED') {
                                clearInterval(intervalId);
                                logger.info('Plugin finished');
                                superagent.get(server.getUrl() + '/api/projects/guest/DockerWorkerManagerTest/branches')
                                    .end(function (err2, res2) {
                                        try {
                                            expect(err2).to.equal(null);
                                            expect(typeof res2.body.b1).to.equal('string');
                                            expect(typeof res2.body.b1).to.not.equal(ir.commitHash);
                                            done();
                                        } catch (e) {
                                            done(e);
                                        }
                                    });
                            } else {
                                logger.info(res.body.status);
                            }
                        });
                }, 200);
            });
    });

    it('should run plugin that generates blob artifact', function (done) {
        var requestBody = {
            pluginId: 'PluginGenerator',
            projectId: ir.project.projectId,
            branchName: 'b2'
        };

        this.timeout(10000);
        superagent.post(server.getUrl() + '/api/v1/plugin/PluginGenerator/execute')
            .send(requestBody)
            .end(function (err, res) {
                var resultId = res.body.resultId,
                    intervalId;

                try {
                    expect(res.status).equal(200, err);
                    expect(typeof resultId).to.equal('string');
                } catch (e) {
                    return done(e);
                }

                intervalId = setInterval(function () {
                    superagent.get(server.getUrl() + '/api/v1/plugin/PluginGenerator/results/' + resultId)
                        .end(function (err, res) {
                            var blobHash;

                            if (err) {
                                clearInterval(intervalId);
                                return done(err);
                            }

                            if (res.body.status === 'FINISHED') {
                                clearInterval(intervalId);
                                blobHash = res.body.result.artifacts[0];
                                logger.info('Plugin finished', blobHash);
                                superagent.get(server.getUrl() + '/rest/blob/metadata/' + blobHash)
                                    .end(function (err2, res2) {
                                        try {
                                            expect(err2).to.equal(null);
                                            expect(res2.status).equal(200, err);
                                            expect(res2.body.name).to.equal('pluginFiles.zip');
                                            done();
                                        } catch (e) {
                                            return done(e);
                                        }
                                    });
                            } else {
                                logger.info(res.body.status);
                            }
                        });
                }, 200);
            });
    });
});