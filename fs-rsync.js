(function(definition) {
  if (typeof module !== 'undefined') {
    // CommonJS
    module.exports = definition(require('fs-rpc'));
  }
  else if (typeof define === 'function' && typeof define.amd === 'object') {
    // AMD
    define(['fs-rpc'], definition);
  }
  else if (typeof window === 'object') {
    // DOM
    window.FSRSYNC = definition(window.FSRPC);
  }
}(function (FSRPC) {

  'use strict';
    
  var FSRSYNC = function () {};

// console.log(FSRPC ? 'FSRPC' : 'no FSRPC');

  // list remote dir content and stats
  FSRSYNC.list = function (connection, options, callback) {

    var fsRPC = FSRPC.Client(),
      path = options.path;

    connection.send(
      fsRPC.add('readdirStat', path).stringify(), 
      'rpc',
      callback
    );

  };

  
  FSRSYNC.syncDir = function (connection, options, callback) {
      
    callback('not implemented');

    // FSRSYNC.list(connection, {path: options.path}, function (err, list) {
    //   // tbd
    // });

    return this;
  };

  return FSRSYNC;

}));
