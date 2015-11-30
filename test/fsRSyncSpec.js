var assert = chai.assert;
var FSRCON = window.FSRCON;
var BROWSERFS = window.browserfs;
var FSRSYNC = window.FSRSYNC;
var browserFs;
var connection;
var rsync;

function initialize () {
  
  browserFs = new BROWSERFS();  
  connection = FSRCON.Client();
  
  return new window.FSRSYNC(browserFs, connection);
}

describe('fs-rsync', function () {

  before(function (done) {
    rsync = initialize();
    connection.init({port: 3000}, done);
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

    it('should delete locally deleted files on remote fs');

  }); // describe synchronizing file systems

}); // describe fs-rsync
