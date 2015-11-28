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
    
  var FSRSYNC = function () {};

  var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  var base64CharCodeMap = (function () {
      var map = {},
        charCode,
        i = 0,
        to = base64Chars.length;

      while (i < to){
        charCode = base64Chars.charCodeAt(i);
        if (charCode) {
          map[charCode] = i;          
        }
        ++i;
      }
      return map;
    })();

  FSRSYNC.arrayBufferToBase64 = function (arrayBuffer) {

    var bytes = new Uint8Array(arrayBuffer),
      i = 0, 
      len = bytes.length, 
      base64 = '';

    for (; i < len; i+=3) {
      base64 += base64Chars[bytes[i] >> 2];
      base64 += base64Chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += base64Chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += base64Chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64 = base64.substring(0, base64.length - 1) + '=';
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + '==';
    }

    return base64;
  };  // arrayBufferToBase64


  FSRSYNC.base64ToArrayBuffer = function (base64Str) {

    var strLenght = base64Str.length, 
      bufferLength = base64Str.length * 0.75,
      arraybuffer,
      bytes,
      stringIndex = 0, 
      byteIndex = 0,
      byte0, 
      byte1, 
      byte2, 
      byte3;

    if (base64Str[strLenght - 1] === '=') {
      bufferLength--;
      if (base64Str[strLenght - 2] === '=') {
        bufferLength--;
      }
    }

    arraybuffer = new ArrayBuffer(bufferLength);
    bytes = new Uint8Array(arraybuffer);

    for (; stringIndex < strLenght; stringIndex += 4) {
      byte0 = base64CharCodeMap[base64Str.charCodeAt(stringIndex)] || 0;
      byte1 = base64CharCodeMap[base64Str.charCodeAt(stringIndex + 1) || 0];
      byte2 = base64CharCodeMap[base64Str.charCodeAt(stringIndex + 2) || 0];
      byte3 = base64CharCodeMap[base64Str.charCodeAt(stringIndex + 3) || 0];

      bytes[byteIndex++] = (byte0 << 2) | (byte1 >> 4);
      bytes[byteIndex++] = ((byte1 & 15) << 4) | (byte2 >> 2);
      bytes[byteIndex++] = ((byte2 & 3) << 6) | (byte3 & 63);
    }

    return arraybuffer;
  
  };  // base64ToArrayBuffer


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


  FSRSYNC.remoteMkdir = function (connection, path, callback) {

      connection.send(
        // filename, data, options, callback
        RPC.stringify('mkdir', [path]), 
        'rpc',
        function (err) {
          if (err) {
            return callback(err);  
          }
            // return remote stats with callback
            FSRSYNC.remoteStat(connection, {filename: path}, callback);            
        }
      );    
  };


  FSRSYNC.remoteWriteFile = function (connection, filename, data, options, callback) {

    var chunkSize,
      chunksToSend;

    if ('undefined' === typeof callback) {
      callback = options;
      options = {};
    }

    options = options || {};

    chunkSize = options.chunkSize || 1024 * 128;
    chunksToSend = Math.ceil(data.byteLength / chunkSize);

    function writeFileChunked (chunk) {

      var start = (chunk - 1) * chunkSize,
        end = start + chunkSize, 
        bufferChunk = data.slice(start, end),
        base64Data = FSRSYNC.arrayBufferToBase64(bufferChunk);

      // console.log('writeFileChunked ', chunk, ' of ' + chunksToSend);

      connection.send(
        // filename, data, options, callback
        RPC.stringify('writeFileChunked', [filename, base64Data, options]), 
        'rpc',
        function (err) {
          if (err) {
            callback(err);            
          }
          else if (chunk >= chunksToSend) {
            // return remote stats with callback
            FSRSYNC.remoteStat(connection, {filename: filename}, callback);            
          }
          else {
            // write next chunk
            writeFileChunked(chunk + 1);
          }
        }
      );    
    } // writeFileChunked

    // write first chunk
    writeFileChunked(1);

  };


  FSRSYNC.remoteReadFile = function (connection, filename, options, callback) {

// console.log('remoteReadFile', filename);

    var base64FileContent = '';

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
            readResult,
            arrayBuffer;

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
                base64FileContent += readResult.content;
              }
            }
          }
          catch (e) {
            err = e;
          }

          if (err) {
            callback(err);            
          }
          else if (readResult && readResult.EOF) {
            arrayBuffer = FSRSYNC.base64ToArrayBuffer(base64FileContent);
            callback(null, arrayBuffer);            
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
      
    var localFS = options.fs,
      path = options.path;

    if ('/' !== path[path.length - 1]) {
      path = path + '/';
    }

    function loopRemoteFiles (localList, remoteList, loopRemoteFilesCallback) {

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
        loopRemoteFilesCallback
      );
    } // loopRemoteFiles


    function loopLocalFiles (localList, remoteList, loopLocalFilesCallback) {

      FSRSYNC.eachAsync(
        Object.keys(localList),
        function (localFilename, done) {

          var localStats = localList[localFilename],
            localNode = localFS.getNode(path + localFilename);
          
          if (!remoteList[localFilename]) {
            // local file is not on remote

            if (localNode.remoteStats) {
              // file deleted on remote fs 
              if (localStats.isDirectory()) {
                localFS.rmdir(path + localFilename, done);
              }
              else {
                localFS.unlink(path + localFilename, done);
              }
            }
            else {
              // new file created on local fs 
              FSRSYNC.createRemote(
                {
                  filename: path + localFilename,
                  localStats: localStats,
                  localFS: localFS,
                  connection: connection
                }, 
                done
              );
            }
          }
          else {
            done();            
          }

        },
        loopLocalFilesCallback
      );
    } // loopLocalFiles


    function handleRemoteList (remoteList, handleRemoteListDone) {
      
      var localList = FSRSYNC.localList(localFS, path);

      // loop remote files
      loopRemoteFiles(localList, remoteList, function (err) {
        if (err) { return handleRemoteListDone(err); }
        loopLocalFiles(localList, remoteList, handleRemoteListDone);
      });

    } // handleRemoteList


    // get remote dir stats list
    FSRSYNC.remoteList(connection, {path: path}, function (err, remoteList) {
      if (err) { return callback(err); }
      handleRemoteList(remoteList, function (err) {
        callback(err || null, path);
      });
    });

  };  // FSRSYNC.syncDir


  FSRSYNC.createRemote = function (options, callback) {

    var filename = options.filename,
      localStats = options.localStats,
      localFS = options.localFS,
      connection = options.connection;

    if (localStats.isDirectory()) {
      // create the directory on remote
      FSRSYNC.createRemoteDir({
        connection: connection,
        localFS: localFS,
        path: filename
      }, callback);
    }
    else {
      // create file on remote 
      FSRSYNC.createRemoteFile({
        connection: connection,
        localFS: localFS,
        filename: filename,
        localContent: localFS.readFileSync(filename)
      }, callback);
    }
  };  // createRemote


  FSRSYNC.createRemoteDir = function (options, callback) {
    var connection = options.connection,
      localFS = options.localFS,
      path = options.path;

    FSRSYNC.remoteMkdir(
      connection, 
      path,
      function (err, remoteStats) {

        var localFileNode;        
        
        if (err) { return callback(err); }

        localFileNode = localFS.getNode(path);
        localFileNode.remoteStats = remoteStats;

        callback(null);
      }
    );
  };  // createRemoteDir


  FSRSYNC.createRemoteFile = function (options, callback) {

    var connection = options.connection,
      localFS = options.localFS,
      filename = options.filename,
      localContent = options.localContent;

    FSRSYNC.remoteWriteFile(
      connection, 
      filename, 
      localContent, 
      options, 
      function (err, remoteStats) {

        var localFileNode;        
        
        if (err) { return callback(err); }

        localFileNode = localFS.getNode(filename);
        localFileNode.remoteStats = remoteStats;

        callback(null);
      }
    );
  };  // createLocalFile


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
  };  // createLocal


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

  };  // createLocalDir

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
