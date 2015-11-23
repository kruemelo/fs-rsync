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
    window.FSRSYNC = definition(window.FSRPC());
  }
}(function (FSRPC) {

  'use strict';

console.log('FSRSYNC FSRPC ?', FSRPC ? 'OK ' + (typeof FSRPC) : 'MISSING!');
    
  var FSRSYNC = function () {};

  FSRSYNC.getFSRPC = function () {
    return FSRPC;
  };

  // list remote dir content and stats
  FSRSYNC.remoteList = function (connection, options, callback) {

    var fsRPC = FSRPC.Client(),
      path = options.path;

    connection.send(
      fsRPC.add('readdirStat', path).stringify(), 
      'rpc',
      function (err, result) {
        
        var parsed;

        if (err) { return callback(err); }

        parsed = fsRPC.parse(result);
        callback.apply(null, parsed ? parsed[0] : undefined);
      }
    );

  };


  FSRSYNC.remoteStat = function (connection, options, callback) {

    var fsRPC = FSRPC.Client(),
      filename = options.filename;

    connection.send(
      fsRPC.add('stat', filename).stringify(), 
      'rpc',
      function (err, result) {

        var parsed;

        if (err) { return callback(err); }

        parsed = fsRPC.parse(result);
        callback.apply(null, parsed ? parsed[0] : undefined);
      }
    );    

  };


  FSRSYNC.localList = function (fs, path) {
    
    var result = {};
    
    fs.readdirSync(path).forEach(function (filename) {
      result[filename] = fs.statSync(path + '/' + filename);
    });

    return result;
  };


  FSRSYNC.sync = function (connection, options, callback) {
      
    var localFS = options.fs,
      filename = options.filename,
      localFileStats;

    if (!localFS.existsSync(filename)) {
      // new file created on remote fs 
      
    }

    localFileStats = localFS.statSync(filename);      

    callback(new Error('not implemented'));
  };

  
  FSRSYNC.syncDir = function (connection, options, callback) {

    return callback(new Error('not implemented'));
      
//     var localFS = options.fs,
//       path = options.path;


//     if ('/' !== path[path.length - 1]) {
//       path = path + '/';
//     }

//     FSRSYNC.remoteList(connection, {path: path}, function (err, remoteList) {
      
//       var localList = FSRSYNC.localList(localFS, path);
//       if (err) { return callback(err); }
// // console.log('localList', localList, 'remoteList', remoteList);

//       // loop remote files
//       Object.keys(remoteList).forEach(function (remoteFilename) {

//         var remoteFileStats = remoteList[remoteFilename];
//         if (!localList[remoteFilename]) {
//           // new file created on remote fs 
//           if (remoteFileStats.isDirectory) {
//             localFS.mkdirSync(path + remoteFilename);
//           }
//           else {
//             localFS.writeFileSync(path + remoteFilename, 'file0 content');
// console.log(path + remoteFilename, remoteFileStats);
//           }
//         }

//       });

//       callback(null, path);

//     });
  };


  return FSRSYNC;

}));
