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

// console.log('FSRSYNC FSRPC ?', FSRPC ? 'OK ' + (typeof FSRPC) : 'MISSING!');
    
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

  };  // FSRSYNC.remoteList


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

  };  // FSRSYNC.remoteStat


  FSRSYNC.remoteReadFile = function (connection, options, callback) {

    var fsRPC = FSRPC.Client(),
      filename = options.filename;

    connection.send(
      fsRPC.add('readFileChunked', [filename])
        .stringify(), 
      'rpc',
      function (err, result) {

        var parsed,
          readResult;

        if (err) { return callback(err); }

        try {
          parsed = fsRPC.parse(result);

          if (parsed) {
            readResult = parsed[0];
            if (readResult && readResult[0] instanceof Error) {
              return callback(parsed[0]);              
            }
            else if (readResult && readResult[1] && 'string' === typeof readResult[1].content) {
              return callback.apply(null, [null, atob(readResult[1].content)]); 
            }
            callback(null);
          }
        }
        catch (e) {
          callback(e);
        }
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


  FSRSYNC.eachAsync = function (list, fn, callback) {

    var listIndex = 0,
      listPromise;

    if (!list || 0 === list.length) {
      callback();
      return;
    }

    function allDone (err) {
      setTimeout(function () {
        callback(err || null);          
      }, 0);
    }

    listPromise = new Promise(function (resolveList, rejectList) {

      var fnPromise;

      function executor (resolve, reject) {     
        try {
          fn.call(null, list[listIndex], function (err) {
            if (err instanceof Error) {
              reject(err);
            }
            else {
              resolve();
            }
          });
        } 
        catch(e) {
          reject(e);
        }  
      }

      function fnPromiseResolved () {
        ++listIndex;
        if (listIndex < list.length) {
          fnPromise = new Promise(executor);

          fnPromise.then(
            fnPromiseResolved,
            fnPromiseRejected
          );      
        }
        else {
          resolveList();
        }
      }

      function fnPromiseRejected (err) {
        rejectList(err);
      }

      fnPromise = new Promise(executor);

      fnPromise.then(
        fnPromiseResolved,
        fnPromiseRejected
      );      
    });

    listPromise.then(allDone, allDone);
  };

  
  FSRSYNC.syncDir = function (connection, options, callback) {

    // return callback(new Error('not implemented'));
      
    var localFS = options.fs,
      path = options.path;

    if ('/' !== path[path.length - 1]) {
      path = path + '/';
    }

    function handleRemoteList (err, remoteList) {
      
      var localList = FSRSYNC.localList(localFS, path);
      if (err) { return callback(err); }
// console.log('localList', localList, 'remoteList', remoteList);

      // loop remote files
      FSRSYNC.eachAsync(
        Object.keys(remoteList),
        function (remoteFilename, done) {
          var remoteFileStats = remoteList[remoteFilename];
          if (!localList[remoteFilename]) {
            // new file created on remote fs 
            if (remoteFileStats.isDirectory) {
              localFS.mkdir(path + remoteFilename, done);
            }
            else {
              FSRSYNC.remoteReadFile(
                connection,
                {filename: path + remoteFilename}, 
                function (err, data) {
                  if (err) {
                    return done(err);
                  }
                  localFS.writeFile(path + remoteFilename, data, done);
                }
              );
            }
          }
          else {
            done();            
          }
        },
        function (err) {
          callback (err, path);
        }
      );

    } // handleRemoteList

    FSRSYNC.remoteList(connection, {path: path}, handleRemoteList);

  };  // FSRSYNC.syncDir


  return FSRSYNC;

}));
