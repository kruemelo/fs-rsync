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
    
  var FSRSYNC = function (localFs, connection, urlPathname) {

    var self = this,
      fnDone = localFs.fnDone;

    this.localFs = localFs;
    this.connection = connection;
    this.urlPathname = urlPathname || 'rpc';
    this.deletedLocalFiles = [];
    this.renamedLocalFiles = [];

    if ('function' === typeof fnDone) {
      localFs.fnDone = function () {

        var fnName = arguments[0],
          info = arguments[1];
        
        if (-1 !== ['unlink', 'rmdir', 'rmrf'].indexOf(fnName)) {
          self.deletedLocalFiles.push(localFs.normalizePath(info));
        }
        else if ('rename' === fnName) {
          // info.newPath, info.oldPath
          self.renamedLocalFiles.push([
            localFs.normalizePath(info.oldPath),
            localFs.normalizePath(info.newPath)
          ]);
        }
        
        // console.log(fnName, info);
        fnDone.apply(localFs, arguments);
      };
    }
  };

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


  // get the url path name for connection.send()
  FSRSYNC.prototype.getUrlPathname = function () {
    return this.urlPathname;
  };

  // list remote dir content and stats
  FSRSYNC.prototype.remoteList = function (pathname, callback) {

    this.connection.send(
      RPC.stringify('readdirStat', pathname), 
      this.getUrlPathname(),
      function (err, result) {     
        if (err) { return callback(err); }
        callback.apply(null, RPC.parse(result));
      }
    );

  };  // FSRSYNC.remoteList


  FSRSYNC.prototype.remoteStat = function (filename, callback) {
    this.connection.send(
      RPC.stringify('stat', filename), 
      this.getUrlPathname(),
      function (err, result) {
        if (err) { return callback(err); }
        callback.apply(null, RPC.parse(result));
      }
    );    
  };  // FSRSYNC.remoteStat


  FSRSYNC.prototype.remoteMkdir = function (pathname, callback) {
    var self = this;
    this.connection.send(
      // filename, data, options, callback
      RPC.stringify('mkdir', [pathname]), 
      this.getUrlPathname(),
      function (err) {
        if (err) {
          return callback(err);  
        }
        // return remote stats with callback
        self.remoteStat(pathname, callback);
      }
    );    
  };  // FSRSYNC.remoteMkdir


  FSRSYNC.prototype.remoteMkdirp = function (pathname, callback) {
    var self = this;
    this.connection.send(
      // filename, data, options, callback
      RPC.stringify('mkdirp', [pathname]), 
      this.getUrlPathname(),
      function (err) {
        if (err) {
          return callback(err);  
        }
        // return remote stats with callback
        self.remoteStat(pathname, callback);
      }
    );    
  };  // FSRSYNC.remoteMkdir


  FSRSYNC.prototype.remoteWriteFile = function (filename, data, options, callback) {

    var self = this,
      chunkSize,
      chunksToSend,
      optionsWriteFile = {};

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

      optionsWriteFile.chunk = chunk;
      optionsWriteFile.chunks = chunksToSend;

      self.connection.send(
        // filename, data, options, callback
        RPC.stringify('writeFileChunked', [filename, base64Data, optionsWriteFile]), 
        self.getUrlPathname(),
        function (err) {
          if (err) {
            callback(err);            
          }
          else if (chunk >= chunksToSend) {
            // return remote stats with callback
            self.remoteStat(filename, callback);            
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
  };  // FSRSYNC.remoteWriteFile


  FSRSYNC.prototype.remoteReadFile = function (filename, options, callback) {

    var self = this,
      base64FileContent = '',
      optionsReadFile = {};

    if ('undefined' === typeof callback) {
      callback = options;
      options = {};
    }

    options = options || {};

    optionsReadFile.chunkSize = options.chunkSize = options.chunkSize || 1024 * 128;

    function readFileChunk (chunk) {

      // console.log('readFileChunk', chunk);

      // rpcfs.readFileChunked (filename, options, callback)
      // options: {chunkSize: 128k, chunk: 2}
      // callback: (err, result)
      // result: {chunk: 1, EOF: true, content: 'base64', chunkSize: 128k, stats: {}}

      optionsReadFile.chunk = chunk;

      self.connection.send(
        RPC.stringify('readFileChunked', [filename, optionsReadFile]), 
        self.getUrlPathname(),
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


  FSRSYNC.prototype.remoteUnlink =  function (filename, callback) {
    this.connection.send(
      RPC.stringify('unlink', filename), 
      this.getUrlPathname(),
      callback
    );    
  }; // remoteUnlink


  FSRSYNC.prototype.remoteRmrf =  function (pathname, callback) {
    this.connection.send(
      RPC.stringify('rmrf', pathname), 
      this.getUrlPathname(),
      callback
    );  
  }; // remoteRmrf


  FSRSYNC.prototype.localList = function (pathname) {
    
    var self = this,
      result = {};
    
    this.localFs.readdirSync(pathname).forEach(function (filename) {
      result[filename] = self.localFs.statSync(pathname + '/' + filename);
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


  FSRSYNC.prototype.handleRenamedLocalFiles = function () {

    var fs = this.localFs,
      list = this.renamedLocalFiles,
      i;
    for (i = 0; i < list.length; ++i) {
      var node, 
        oldPath = list[i][0],
        newPath = list[i][1];
      
      if (!fs.existsSync(oldPath)) {
        // add old filename to deleted local files list
        this.deletedLocalFiles.push(oldPath);
      }

      if (fs.existsSync(newPath)) {
        node = fs.getNode(newPath);
        // remove the remote stats property to make it a "new" file
        delete node.remoteStats;
      }
    }

    list.length = 0;
    return this;
  };


  FSRSYNC.prototype.syncFile = function (filename, callback) {

    var self = this,
      existsOnLocal = this.localFs.existsSync(filename);

    this.handleRenamedLocalFiles();

    this.remoteStat(filename, function (err, remoteStats) {

      var deletedLocalFilesIndex;

      if (!err && remoteStats) {
        // file exists on remote
        if (existsOnLocal) {
          // exists both on local and remote fs
          self.syncExistingFiles(
            filename,
            self.localFs.statSync(filename),
            remoteStats,
            callback
          );
        }
        else {
          // remote file does not exist in local fs
          deletedLocalFilesIndex = self.deletedLocalFiles.indexOf(filename);

          if (-1 !== deletedLocalFilesIndex) {
            // deleted on local fs, also delete on remote 
            self.remoteUnlink(
              filename, 
              function (err) {
                if (!err) {
                  delete self.deletedLocalFiles[deletedLocalFilesIndex];
                }
                callback(err);
              }
            );
          }
          else {
            // create on local fs
            self.createLocal(
              filename,
              remoteStats,
              callback
            );
          }          
        }
      }
      else {
        // file not on remote
        if (existsOnLocal) {
          // create on remote
          self.createRemote(
            filename,
            self.localFs.statSync(filename),
            callback
          );
        }
        else {
          // does not exist anywhere
          callback(null);
        }
      }
    });
  };  // syncFile

  
  FSRSYNC.prototype.syncDir = function (pathname, options, callback) {
      
    var self = this,
      recursive,
      existsOnLocal;

    if ('undefined' === typeof callback) {
      callback = options;
      options = {};
    }

    recursive = !!options.recursive;

    if ('/' !== pathname[pathname.length - 1]) {
      pathname = pathname + '/';
    }

    this.handleRenamedLocalFiles();

    existsOnLocal = this.localFs.existsSync(pathname);

    function loopRemoteFiles (localList, remoteList, loopRemoteFilesCallback) {

      FSRSYNC.eachAsync(
        Object.keys(remoteList),
        function (remoteFilename, done) {

          var remoteStats = remoteList[remoteFilename],
            deletedLocalFilesIndex,
            filename = self.localFs.normalizePath(pathname + remoteFilename);
          
          if (!localList[remoteFilename]) {
            // remote file does not exist in local fs
            deletedLocalFilesIndex = self.deletedLocalFiles.indexOf(filename);
            if (-1 !== deletedLocalFilesIndex) {
              // deleted on local fs, also delete on remote 
              self[remoteStats.isDirectory ? 'remoteRmrf' : 'remoteUnlink'](
                filename, 
                function (err) {
                  if (!err) {
                    delete self.deletedLocalFiles[deletedLocalFilesIndex];
                  }
                  done(err);
                }
              );
            }
            else {
              // new file created on remote fs 
              self.createLocal(filename, remoteStats, done);
            }
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
            localNode = self.localFs.getNode(pathname + localFilename);
          
          if (!remoteList[localFilename]) {
            // local file is not on remote

            if (localNode.remoteStats) {
              // file deleted on remote fs 
              if (localStats.isDirectory()) {
                self.localFs.rmdir(pathname + localFilename, done);
              }
              else {
                self.localFs.unlink(pathname + localFilename, done);
              }
            }
            else {
              // new file created on local fs 
              self.createRemote(
                pathname + localFilename,
                localStats, 
                done
              );
            }
          }
          else {
            // local also exists on remote..
            done();            
          }

        },
        loopLocalFilesCallback
      );
    } // loopLocalFiles


    function handleModifiedFiles (localList, remoteList, handleModifiedFilesCallback) {

      FSRSYNC.eachAsync(
        Object.keys(remoteList),
        function (remoteFilename, done) {

          var localStats = localList[remoteFilename],
            remoteStats = remoteList[remoteFilename],
            filename = pathname + remoteFilename;
          
          if (!localStats || !remoteStats) {
            return done();
          }

          if (localStats.isDirectory()) {
            return done();
          }

          self.syncExistingFiles(
            filename,
            localStats,
            remoteStats,
            done
          );

        },
        handleModifiedFilesCallback
      );
    } // handleModifiedFiles


    function handleRemoteList (remoteList, handleRemoteListDone) {
      
      var localList = self.localList(pathname);

      // loop remote files
      loopRemoteFiles(localList, remoteList, function (err) {
        if (err) { return handleRemoteListDone(err); }
        // loop local files
        loopLocalFiles(localList, remoteList, function (err) {
          if (err) { return handleRemoteListDone(err); }
          // handle modified files
          handleModifiedFiles(localList, remoteList, handleRemoteListDone);          
        });
      });
    } // handleRemoteList


    function getRemoteDirStatsList (getRemoteDirStatsListCallback) {
    
      self.remoteList(pathname, function (err, remoteList) {
        if (err) { return getRemoteDirStatsListCallback(err); }
        handleRemoteList(remoteList, function (err) {
          var dirFiles, localDirNode;
          if (err) {
            getRemoteDirStatsListCallback(err, pathname);
          }
          else {
            localDirNode = self.localFs.getNode(pathname);
            localDirNode.remoteStats.fetched = Date.now();
            if (recursive) {
              // sync recursively
              dirFiles = self.localList(pathname);
              FSRSYNC.eachAsync(
                Object.keys(dirFiles),
                function (filename, dirfileDone) {
                  var stats = dirFiles[filename];
                  if (stats && stats.isDirectory()) {
                    self.syncDir(pathname + filename, {recursive: true}, dirfileDone);
                  }
                  else {
                    dirfileDone();
                  }
                },
                function (err) {
                  // console.log('dir files done for ' + pathname);
                  getRemoteDirStatsListCallback(err, pathname);
                }
              );
            }
            else {
              getRemoteDirStatsListCallback(null, pathname);
            }
          }
        });
      });
    } // get remote dir stats list


    this.remoteStat(pathname, function (err, remoteStats) {

      var localDirNode;

      if (!err && remoteStats) {
        // dir exists on remote
        if (existsOnLocal) {
          // exists both on local and remote fs
          localDirNode = self.localFs.getNode(pathname);
          localDirNode.remoteStats = remoteStats;
          getRemoteDirStatsList(callback);
        }
        else {
          // create on local fs
          self.createLocal(
            pathname,
            remoteStats,
            function (err) {
              if (err) {
                return callback(err);
              }
              getRemoteDirStatsList(callback);
            }
          );
        }
      }
      else {
        // dir not on remote
        if (existsOnLocal) {
          // create on remote
          self.createRemote(
            pathname,
            self.localFs.statSync(pathname),
            function (err) {
              if (err) {
                return callback(err);
              }
              self.syncDir(pathname, options, callback);
            }
          );
        }
        else {
          // does not exist anywhere
          callback(null);
        }
      }
    });
  };  // FSRSYNC.syncDir


  FSRSYNC.prototype.syncExistingFiles = function (filename, localStats, remoteStats, callback) {

    var self = this,
      localFileNode,
      remoteFileHasChanged,
      localFileHasChanged;

    // file exists on local and remote fs
    localFileNode = self.localFs.getNode(filename);

    remoteFileHasChanged = localFileNode.remoteStats ? 
      localFileNode.remoteStats.mtime !== remoteStats.mtime : true;
    
    localFileHasChanged = localFileNode.remoteStats ?
      localFileNode.mtime !== localFileNode.remoteStats.mtime : true;

    if (remoteFileHasChanged && localFileHasChanged) {
      // file changed both on remote and local fs
      callback(new Error('ECONFLICT'), filename);
    }
    else if (remoteFileHasChanged) {
      // file only has changed on remote fs: update local file
      self.remoteReadFile(
        filename, 
        function (err, data) {
          
          if (err) {
            return callback(null, filename);
          }
          
          self.localFs.writeFile(filename, data, function (err) {

            if (err) { return callback(err); }      

            localFileNode.remoteStats = remoteStats;
            localFileNode.remoteStats.fetched = Date.now();

            // update local stats
            localFileNode.ctime = remoteStats.birthtime;
            localFileNode.mtime = remoteStats.mtime;
            localFileNode.atime = remoteStats.atime;

            callback(null, filename);
          });
        }
      );
    }
    else if (localFileHasChanged) {
      // file only has changed on local fs: update remote file
      self.localFs.readFile(filename, function (err, data) {
        if (err) { return callback(err,filename); }
        self.remoteWriteFile(
          filename, 
          data, 
          function (err, remoteStats) {
            if (err) { return callback(err, filename); }
            localFileNode.remoteStats = remoteStats;
            localFileNode.remoteStats.fetched = Date.now();
            localFileNode.mtime = remoteStats.mtime;
            callback(null, filename);
          }
        );
      });
    }
    else {
      callback(null, filename);
    }    
  };  // syncExisting


  FSRSYNC.prototype.createRemote = function (filename, localStats, callback) {

    var self = this;

    if (localStats.isDirectory()) {
      // create the directory on remote
      this.createRemoteDir(filename, callback);
    }
    else {
      // create file on remote 
      this.createRemoteFile(
        filename,
        self.localFs.readFileSync(filename), 
        callback
      );
    }
  };  // createRemote


  FSRSYNC.prototype.createRemoteDir = function (pathname, callback) {

    var self = this,
      fs = self.localFs;

    this.ensureRemotePath(fs.dirname(pathname), function (err) {

      if (err) {
        callback(err);
      }
      else {      
        self.remoteMkdir( 
          pathname,
          function (err, remoteStats) {

            var localFileNode;        
            
            if (err) { return callback(err); }

            localFileNode = fs.getNode(pathname);
            localFileNode.remoteStats = remoteStats;
            localFileNode.remoteStats.fetched = Date.now();
            localFileNode.mtime = remoteStats.mtime;

            callback(null);
          }
        );
      }
    });
  };  // createRemoteDir


  FSRSYNC.prototype.createRemoteFile = function (filename, localContent, callback) {

    var self = this,
      fs = self.localFs;

    this.ensureRemotePath(fs.dirname(filename), function (err) {
      
      if (err) {
        callback(err);
      }
      else {    
        self.remoteWriteFile(
          filename, 
          localContent,
          function (err, remoteStats) {

            var localFileNode;        
            
            if (err) { return callback(err); }

            localFileNode = self.localFs.getNode(filename);
            localFileNode.remoteStats = remoteStats;
            localFileNode.remoteStats.fetched = Date.now();
            localFileNode.mtime = remoteStats.mtime;

            callback(null);
          }
        );
        }
      });
  };  // createLocalFile


  FSRSYNC.prototype.ensureRemotePath = function (pathname, callback) {

    var self = this;

    if ('/' === pathname) {
      callback();
    }
    else {
      this.remoteStat(pathname, function (err) {
        if (err) {
          self.remoteMkdirp( 
            pathname,
            callback
          );
        }
        else {
          callback();
        }
      });
    }
  };  // ensureRemotePath


  FSRSYNC.prototype.createLocal = function (filename, remoteStats, callback) {

    var self = this;

    if (remoteStats.isDirectory) {
      // create the directory locally
      this.createLocalDir(
        filename,
        remoteStats, 
        callback
      );
    }
    else {
      // create file locally
      this.remoteReadFile(
        filename, 
        function (err, data) {
          
          if (err) {
            return callback(err);
          }
          
          self.createLocalFile(
            filename,
            data,
            remoteStats, 
            callback
          );
        }
      );
    }
  };  // createLocal


  FSRSYNC.prototype.ensureLocalPath = function (pathname) {
    var localFs = this.localFs;
    if (!localFs.existsSync(pathname)) {
      localFs.mkdirpSync(pathname);
    }
  };  // ensureLocalPath


  FSRSYNC.prototype.createLocalDir = function (pathname, remoteStats, callback ) {
    
    var self = this;

    this.ensureLocalPath(this.localFs.dirname(pathname));

    this.localFs.mkdir(pathname, function (err) {
      
      var time = Date.now(),
        parentDirNode,
        localDirNode;

      if (err) { return callback(err); }

      localDirNode = self.localFs.getNode(pathname);
      localDirNode.remoteStats = remoteStats;
      localDirNode.remoteStats.fetched = false;

      // update local stats
      localDirNode.ctime = remoteStats.birthtime;
      localDirNode.mtime = remoteStats.mtime;
      localDirNode.atime = remoteStats.atime;

      parentDirNode = self.localFs.getNode(self.localFs.dirname(pathname));

      parentDirNode.atime = time;
      parentDirNode.mtime = time;

      callback();
    });
  };  // createLocalDir


  FSRSYNC.prototype.createLocalFile = function (filename, remoteContent, remoteStats, callback) {

    var self = this;

    // console.log(filename, remoteStats);
    this.ensureLocalPath(this.localFs.dirname(filename));

    this.localFs.writeFile(filename, remoteContent, function (err) {

      var time = Date.now(),
        parentDirNode,
        localFileNode;

      if (err) { return callback(err); }
      
      localFileNode = self.localFs.getNode(filename);

      localFileNode.remoteStats = remoteStats;
      localFileNode.remoteStats.fetched = time;

      // update local stats
      localFileNode.ctime = remoteStats.birthtime;
      localFileNode.mtime = remoteStats.mtime;
      localFileNode.atime = remoteStats.atime;

      parentDirNode = self.localFs.getNode(self.localFs.dirname(filename));

      parentDirNode.atime = time;
      parentDirNode.mtime = time;

      callback(null);
    });
  };  // createLocalFile


  return FSRSYNC;

}));
