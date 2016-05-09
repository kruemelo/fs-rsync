var assert = chai.assert;
var FSRCON = window.FSRCON;
var BROWSERFS = window.browserfs;
var FSRSYNC = window.FSRSYNC;
var browserFs;
var connection;
var rsync;
var protocol = 'http';
var hostname = 'localhost';
var port = 3000;

function resetRemoteFs (callback) {
    var xhr = new XMLHttpRequest(),
      url = protocol + '://' + hostname + ':' + port + '/resetRemoteFs';

    // The last parameter must be set to true to make an asynchronous request
    xhr.open('get', url, true);

    // xhr.setRequestHeader('Content-type', 'application/json');
    // xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    
    xhr.onload = function () {
      callback(null);
    };

    xhr.onerror = function () {
      callback(new Error('ECON'));
    };  

    xhr.send();
}

function initialize (callback) {

  var accountId = FSRCON.hash('email@domain.tld'),
    password = FSRCON.hash('my secret', accountId),
    connOptions = {
      protocol: protocol,
      hostname: hostname,
      port: port,
      accountId: accountId
    };
  
  browserFs = new BROWSERFS();  
  connection = new FSRCON.Client(connOptions);
  rsync = new window.FSRSYNC(browserFs, connection);

  connection.init('init')
    .then(
      function () {
        connection.connect('connect', password)
          .then(
            function () {
              console.log('client connected to server');
              resetRemoteFs(callback);      
            },
            callback
          );
      },
      callback
    );      
}

describe('fs-rsync', function () {

  before(function (done) {
    initialize(done);
  });


  it('should have loaded module', function () {
    assert.isFunction(BROWSERFS, 'browserfs');
    assert.isObject(FSRCON, 'fs-rcon');
    assert.isFunction(FSRSYNC, 'fs-rsync');
  });


  it('should list remote directory contents and stats', function (done) {

    assert.isFunction(rsync.remoteList, 'should have a list function');

    rsync.remoteList('/', function (err, list) {

      assert.isNull(err, 'should not have an error');

      assert.isObject(list, 'list');
      assert.isObject(list.dirA, 'list.dirA');
      assert.isTrue(list.dirA.isDirectory);
      assert.isObject(list.file0, 'list.file0');
      assert.isFalse(list.file0.isDirectory);

      done();
      
    });

  });


  it('should get stats for a remote file', function (done) {
    
    assert.isFunction(rsync.remoteStat);

    rsync.remoteStat('/', function (err, stats) {
      assert.isNull(err, 'should not have an error');
      assert.isObject(stats, 'stats should be object');
      assert.includeMembers(Object.keys(stats), ['size', 'atime', 'mtime', 'ctime', 'birthtime']);
      done();
    });

  });


  it('convert base64 string to ArrayBuffer', function () {

    var buffer = FSRSYNC.base64ToArrayBuffer('ZmlsZTAgY29udGVudA==');

    assert.instanceOf(buffer, ArrayBuffer);
    assert.strictEqual(buffer.byteLength, 13);

  });


  it('should load a remote file with small chunks', function (done) {

    rsync.remoteReadFile(
      '/file1',
      {chunkSize: 1024},
      function (err, data) {

        assert.isNull(err, 'should not have an error');
        assert.strictEqual(data.byteLength, 3465, 'file content length');

        done();
      }
    );

  });

  describe('synchronizing file systems', function () {

    it('should sync all files to a local directory from remote fs directory', function (done) {

      var path = '/';

      assert.isFunction(rsync.syncDir);

      rsync.syncDir(path, function (err, result) {

        assert.isNull(err, 'should not have an error');
        assert.strictEqual(result, path);
        assert.isTrue(browserFs.existsSync('/file0'), 'file should exist');

        assert.isTrue(browserFs.existsSync('/file1'), 'file should exist');
        assert.isTrue(browserFs.existsSync('/file2'), 'file should exist');
        assert.isTrue(browserFs.statSync('/file2').isFile(), 'file should be a file');

        assert.isTrue(browserFs.existsSync('/dirA'), 'directory should exist');
        assert.isTrue(browserFs.statSync('/dirA').isDirectory(), 'file should be directory');

        done();
      });

    }); // sync all files to a local directory from remote


    it('should sync file contents', function (done) {

      var path = '/';

      rsync.syncDir(path, function () {

        assert.strictEqual(
          browserFs.readFileSync('/file2', 'utf8'),
          '½ + ¼ = ¾',
          'equal file contents'
        );

        done();
      });

    });


    it('should sync stats', function (done) {


      var path = '/';

      rsync.syncDir(path, function () {

        var fileNode;

        fileNode = browserFs.getNode('/file0');

        assert.isObject(fileNode.remoteStats, 'file node remote stats');

        assert.strictEqual(
          fileNode.remoteStats.birthtime,
          fileNode.ctime,
          'ctime'
        );
        assert.strictEqual(
          fileNode.remoteStats.atime,
          fileNode.atime,
          'atime'
        );
        assert.strictEqual(
          fileNode.remoteStats.mtime,
          fileNode.mtime,
          'mtime'
        );

        fileNode = browserFs.getNode('/dirA');
        assert.isObject(fileNode.remoteStats, 'dir node remote stats');
        assert.strictEqual(
          fileNode.remoteStats.birthtime,
          fileNode.ctime,
          'ctime'
        );
        assert.strictEqual(
          fileNode.remoteStats.atime,
          fileNode.atime,
          'atime'
        );
        assert.strictEqual(
          fileNode.remoteStats.mtime,
          fileNode.mtime,
          'mtime'
        );        

        done();
      });

    });

  
    it('should sync all new files from local directory to remote fs directory', function (done) {

      var path = '/',
        filename,
        fileNode;

      assert.isFunction(rsync.syncDir);

      // create local directory
      filename = '/local dir ' + (new Date()).getTime();
      browserFs.mkdirpSync(filename);
      fileNode = browserFs.getNode(filename);
      
      assert.isUndefined(fileNode.remoteStats);

      rsync.syncDir(path, function (err) {
        
        assert.isNull(err, 'should not have an error');

        // check remote dir
        assert.isObject(fileNode.remoteStats, 'dir remote stats');

        // create local file
        filename += '/local file ' + (new Date()).getTime();
        browserFs.writeFileSync(filename, 'local file content');
        fileNode = browserFs.getNode(filename);
        
        assert.isUndefined(fileNode.remoteStats);

        path = browserFs.dirname(filename);

        rsync.syncDir(path, function (err) {
          
          assert.isNull(err, 'should not have an error');

          // check remote file
          assert.isObject(fileNode.remoteStats, 'file remote stats');
          assert.strictEqual(fileNode.remoteStats.size, 18, 'remote file size');
          done();
        });

      });

    }); // sync all new files from local directory to remote

    it('should delete locally deleted files on remote fs', function (done) {

      var filename = '/file2',
        fileNode;
      
      assert.isTrue(browserFs.existsSync(filename));

      fileNode = browserFs.getNode(filename);

      assert(fileNode.remoteStats);

      browserFs.unlinkSync(filename);

      assert.isFalse(browserFs.existsSync(filename));

      rsync.syncDir('/', function (err) {
        assert.isNull(err, 'should not have an error');

        assert.isFalse(browserFs.existsSync(filename));
        
        done();
      });

    });

    it('should delete locally deleted directory on remote fs', function (done) {

      var filename = '/dirA',
        fileNode;
      
      assert.isTrue(browserFs.existsSync(filename));

      fileNode = browserFs.getNode(filename);

      assert(fileNode.remoteStats);

      assert.notInclude(rsync.deletedLocalFiles, filename);

      browserFs.rmrfSync(filename);

      assert.include(rsync.deletedLocalFiles, filename);

      assert.isFalse(browserFs.existsSync(filename));

      rsync.syncDir('/', function (err) {

        assert.isNull(err, 'should not have an error');

        assert.isFalse(browserFs.existsSync(filename));
      
        assert.notInclude(rsync.deletedLocalFiles, filename);

        done();
      });

    });


    it('should synchronize recursivly', function (done) {
      initialize(function () {
        rsync.syncDir('/', {recursive: true}, function (err) {
          assert.isNull(err, 'should not have an error');
          assert.isTrue(browserFs.existsSync('/dirA/fileA'), 'sync sub dir contents');
          done();
        });
      });
    });


    it('should sync renamed files', function (done) {
      
      assert.isTrue(browserFs.existsSync('/file0'), 'file0 should exist at local fs');
      assert.isFalse(browserFs.existsSync('/renamed'), 'renamed should not exist yet at local fs');
      
      browserFs.renameSync('/file0', '/dirA/renamed');

      assert.isFalse(browserFs.existsSync('/file0'), 'file0 should not exist now at local fs');
      assert.isTrue(browserFs.existsSync('/dirA/renamed'), 'renamed should now exist at local fs');
      
      rsync.syncDir('/', function (err) {
  
        assert.isNull(err, 'should not have an error');
        assert.isFalse(browserFs.existsSync('/file0'), 'file0 should still not exist at local fs');
  
        rsync.syncDir('/dirA', function (err) {
          assert.isNull(err, 'should not have an error');
          assert.isTrue(browserFs.existsSync('/dirA/renamed'), 'renamed should still exist at local fs');
          done();
        });
      });
    });


    it('should synchronize a single file', function (done) {
      
      var filename = '/file ' + (new Date()).getTime(),
        fileNode;
      
      browserFs.writeFileSync(filename, 'file ' + filename + ' content');
      fileNode = browserFs.getNode(filename);

      assert.isUndefined(fileNode.remoteStats);

      rsync.syncFile(filename, function (err) {
        
        assert.isNull(err, 'should not have an error');

        fileNode = browserFs.getNode(filename);
        
        assert.isObject(fileNode.remoteStats);
        done();
      });
    });


    it('should synchronize remote file with unsynced local path', function (done) {
      initialize(function () {
        rsync.syncFile('/dirA/fileA', function (err) {
          assert.isNull(err, 'should not have an error');
          assert.isTrue(browserFs.existsSync('/dirA/fileA'), 'sync file without local path');
          done();
        });
      });
    });


    it('should handle unsynced files that exists on local and remote', function (done) {
      
      var filename = '/dirA/fileA';

      initialize(function () {
        // create on local before sync
        browserFs.mkdirpSync('/dirA');
        browserFs.writeFileSync(filename, 'file ' + filename + ' content');
        rsync.syncFile(filename, function (err) {
          assert.instanceOf(err, Error, 'should have an error');
          assert.strictEqual(err.message, 'ECONFLICT', 'conflict error message');
          done();
        });
      });
    });

  }); // describe synchronizing file systems

}); // describe fs-rsync
