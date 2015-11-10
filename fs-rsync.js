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
    
  var FSRSYNC = function () {

  };

// console.log(FSRPC ? 'FSRPC' : 'no FSRPC');
  
  FSRSYNC.sync = function (options, callback) {

    var connection = options.connection,
      filename = options.filename;

    FSRSYNC.remoteStat({
        connection: connection, 
        filename: filename
      },
      function (err/*, remoteStats*/) {
// console.log(remoteStats);
        callback(err, filename);
      }
    );

    return this;
  };


  FSRSYNC.remoteStat = function (options, callback) {

    var connection = options.connection,
      filename = options.filename,
      rpc;

    rpc = FSRPC.stringify('stat', [filename]);

    connection.send({rpc: rpc}, 'rpc', function (err, result) {
      var remoteStats = result ? result.rpc : undefined;
      callback(err, remoteStats);
    });

  };

  return FSRSYNC;

}));
