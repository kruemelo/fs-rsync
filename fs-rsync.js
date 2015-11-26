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

  var RPC = FSRPC.Client;

// console.log('FSRSYNC FSRPC ?', FSRPC ? 'OK ' + (typeof FSRPC) : 'MISSING!');
    
  var FSRSYNC = function () {};

  FSRSYNC.getFSRPC = function () {
    return FSRPC;
  };

  // list remote dir content and stats
  FSRSYNC.remoteList = function (connection, options, callback) {

    var path = options.path;

    connection.send(
      RPC.stringify('readdirStat', path), 
      'rpc',
      function (err, result) {     

        if (err) { return callback(err); }

        callback.apply(null, RPC.parse(result));
      }
    );

  };  // FSRSYNC.remoteList


  FSRSYNC.remoteStat = function (connection, options, callback) {

    var filename = options.filename;

    connection.send(
      RPC.stringify('stat', filename), 
      'rpc',
      function (err, result) {
        callback.apply(err, RPC.parse(result));
      }
    );    

  };  // FSRSYNC.remoteStat


  FSRSYNC.remoteReadFile = function (connection, filename, options, callback) {

// console.log('remoteReadFile', filename);

    var fileContent = '';

    if ('undefined' === typeof callback) {
      callback = options;
      options = {};
    }

    options = options || {};

    options.chunkSize = options.chunkSize || 1024 * 128;

    function readFileChunk (chunk) {

      // console.log('readFileChunk', chunk);

      // rpcfs.readFileChunked (filename, options, callback)
      // options: {chunkSize: 128k, chunk: 2}
      // callback: (err, result)
      // result: {chunk: 1, EOF: true, content: 'base64', chunkSize: 128k, stats: {}}

      options.chunk = chunk;

      connection.send(
        RPC.stringify('readFileChunked', [filename, options]), 
        'rpc',
        function (err, result) {

          var parsed,
            readResult;

          if (err) { callback(err); return; }

          try {
            parsed = RPC.parse(result);
            // console.log('read parsed:', parsed);
            if (parsed) {

              readResult = parsed[1];
              
              if (parsed[0] instanceof Error) {
                err = readResult[0];
              }
              else if (readResult && 'string' === typeof readResult.content) {
                fileContent += RPC.atob(readResult.content);
              }
            }
          }
          catch (e) {
            err = e;
          }

          if (readResult && readResult.EOF || err) {
            callback.apply(null, [err || null, err ? undefined : fileContent]);            
          }
          else {
            // next chunk
            readFileChunk(chunk + 1);
          }
        }
      );    
    } // readFileChunk

    readFileChunk(1);



  };  // FSRSYNC.remoteReadFile


  FSRSYNC.localList = function (fs, path) {
    
    var result = {};
    
    fs.readdirSync(path).forEach(function (filename) {
      result[filename] = fs.statSync(path + '/' + filename);
    });

    return result;
  };  // FSRSYNC.localList


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
  };  // FSRSYNC.eachAsync

  
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

          var remoteStats = remoteList[remoteFilename];
          
          if (!localList[remoteFilename]) {
            // new file created on remote fs 
            FSRSYNC.createLocal(
              {
                filename: path + remoteFilename,
                remoteStats: remoteStats,
                localFS: localFS,
                connection: connection
              }, 
              done
            );
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


  FSRSYNC.createLocal = function (options, callback) {

    var filename = options.filename,
      remoteStats = options.remoteStats,
      localFS = options.localFS,
      connection = options.connection;

    if (remoteStats.isDirectory) {
      // create the directory locally
      FSRSYNC.createLocalDir({
        localFS: localFS,
        path: filename,
        remoteStats: remoteStats
      }, callback);
    }
    else {
      // create file locally
      FSRSYNC.remoteReadFile(
        connection,
        filename, 
        function (err, data) {
          
          if (err) {
            return callback(err);
          }
          
          FSRSYNC.createLocalFile({
            localFS: localFS,
            filename: filename,
            remoteContent: data,
            remoteStats: remoteStats
          }, callback);
          
        }
      );
    }
  };


  FSRSYNC.createLocalDir = function (options, callback ) {
    
    var localFS = options.localFS,
      path = options.path,
      remoteStats = options.remoteStats;

    localFS.mkdir(path, function (err) {
      
      var time = Date.now(),
        parentDirNode,
        localDirNode;

      if (err) { return callback(err); }

      localDirNode = localFS.getNode(path);
      localDirNode.remoteStats = remoteStats;

      // update local stats
      localDirNode.ctime = remoteStats.birthtime;
      localDirNode.mtime = remoteStats.mtime;
      localDirNode.atime = remoteStats.atime;

      parentDirNode = localFS.getNode(localFS.dirname(path));

      parentDirNode.atime = time;
      parentDirNode.mtime = time;

      callback();
    });

  };

  FSRSYNC.createLocalFile = function (options, callback) {

    var localFS = options.localFS,
      filename = options.filename,
      remoteContent = options.remoteContent,
      remoteStats = options.remoteStats;

    // console.log(filename, remoteStats);

    localFS.writeFile(filename, remoteContent, function (err) {

      var time = Date.now(),
        parentDirNode,
        localFileNode;

      if (err) { return callback(err); }
      
      localFileNode = localFS.getNode(filename);

      localFileNode.remoteStats = remoteStats;

      // update local stats
      localFileNode.ctime = remoteStats.birthtime;
      localFileNode.mtime = remoteStats.mtime;
      localFileNode.atime = remoteStats.atime;

      parentDirNode = localFS.getNode(localFS.dirname(filename));

      parentDirNode.atime = time;
      parentDirNode.mtime = time;

      callback(null);
    });
  };  // createLocalFile


  return FSRSYNC;

}));
