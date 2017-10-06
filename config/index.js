/*jshint node: true*/
/**
 * @author lattmann / https://github.com/lattmann
 * @author pmeijer / https://github.com/pmeijer
 */

'use strict';

var env = process.env.NODE_ENV || 'default',
    configFilename = __dirname + '/config.' + env + '.js',
    config = require(configFilename),
    validateConfig = require('webgme-engine/config/validator').validateConfig;

validateConfig(configFilename);
module.exports = config;