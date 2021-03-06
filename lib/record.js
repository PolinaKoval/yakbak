// Copyright 2016 Yahoo Inc.
// Licensed under the terms of the MIT license. Please see LICENSE file in the project root for terms.

var Promise = require('bluebird');
var buffer = require('./buffer');
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var debug = require('debug')('yakbak:record');
var zlib = require('zlib');
var jsonStringify = require('json-pretty');
var contentTypeParser = require('content-type');

/**
 * Read and pre-compile the tape template.
 * @type {Function}
 * @private
 */

var render = ejs.compile(fs.readFileSync(path.resolve(__dirname, '../src/tape.ejs'), 'utf8'));

/**
 * Record the http interaction between `req` and `res` to disk.
 * The format is a vanilla node module that can be used as
 * an http.Server handler.
 * @param {http.ClientRequest} req
 * @param {http.IncomingMessage} res
 * @param {String} filename
 * @returns {Promise.<String>}
 */

module.exports = function (req, res, filename) {
  return buffer(res).then(function (body) {
    defaultBody = body;
    return makeBodyHumanReadable(res, body);
  }).then(function (humanReadableBody) {
    return render({req: req, res: res, body: defaultBody, humanReadableBody: humanReadableBody});
  }).then(function (data) {
    return write(filename, data);
  }).then(function () {
    return filename;
  });
};

/**
 * Write `data` to `filename`. Seems overkill to "promisify" this.
 * @param {String} filename
 * @param {String} data
 * @returns {Promise}
 */

function write(filename, data) {
  return Promise.fromCallback(function (done) {
    debug('write', filename);
    fs.writeFile(filename, data, done);
  });
}

function makeBodyHumanReadable(res, body) {
  var contentEncoding = res.headers['content-encoding'];
  var contentType = res.headers['content-type'];
  var buffer = Buffer.concat(body)
  return new Promise(function(resolve,reject) {
    if (contentEncoding == 'gzip') {
      zlib.gunzip(buffer, function(err, decoded) {
        resolve(formatJSONData(contentType, decoded.toString()));
      });
    } else if (contentEncoding == 'deflate') {
      zlib.inflate(buffer, function(err, decoded) {
        resolve(formatJSONData(contentType, decoded.toString()));
      })
    } else {
      resolve(formatJSONData(contentType, buffer.toString()));
    }
  });
}

function formatJSONData(contentType, data) {
  contentType = contentTypeParser.parse(contentType).type;
  if (contentType === 'application/json') {
    return jsonStringify(JSON.parse(data));
  }
  return data;
}
