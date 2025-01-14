'use strict';

var fs = require('fs');
var path = require('path');
var through = require('through2');
var {pipeline} = require('stream');

function write(file) {
  var dir = path.dirname(file.path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }

  fs.writeFileSync(file.path, file.contents, {
    mode: file.stat ? file.stat.mode : null
  });
}

function remove(file) {
  fs.rmdirSync(file.path, {recursive: true});
}

module.exports = function (filters, stream, cb) {
  var store = this.store;

  if (typeof filters === 'function') {
    cb = filters;
    filters = [];
    stream = undefined;
  } else if (typeof stream === 'function') {
    cb = stream;
    stream = undefined;
  }

  stream = stream || this.store.stream();
  var modifiedFilter = through.obj(function (file, enc, cb) {
    // Don't process deleted file who haven't been commited yet.
    if (file.state === 'modified' || (file.state === 'deleted' && !file.isNew)) {
      this.push(file);
    }

    cb();
  });

  var commitFilter = through.obj(function (file, enc, cb) {
    store.add(file);
    if (file.state === 'modified') {
      write(file);
      file.committed = true;
    } else if (file.state === 'deleted') {
      remove(file);
      file.committed = true;
    }

    delete file.state;
    delete file.isNew;
    cb();
  });

  pipeline(
    stream,
    modifiedFilter,
    ...filters,
    commitFilter,
    (...args) => cb(...args)
  );
};
