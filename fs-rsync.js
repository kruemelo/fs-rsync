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

console.log(FSRPC ? 'FSRPC' : 'no FSRPC');
  
  FSRSYNC.sync = function (options) {

    var fnEnd = options.end;

// console.log(FSRPC.stringify('fnName',  ['arg0', 'arg1']));

    fnEnd(null);

    return this;
  };


  return FSRSYNC;

}));
