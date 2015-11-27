var assert = chai.assert;
var FSRCON = window.FSRCON;
var BROWSERFS = window.browserfs;
var rsync = window.FSRSYNC;

describe('fs-rsync', function () {

  var fsrcon = FSRCON.Client();

  before(function (done) {
    fsrcon.init({port: 3000}, done);
  });


  it('should have loaded module', function () {
    assert.isFunction(BROWSERFS, 'browserfs');
    assert.isObject(FSRCON, 'fs-rcon');
    assert.isFunction(rsync, 'fs-rsync');
  });


  it('should list remote directory contents and stats', function (done) {

    var options = {
      path: '/'
    };

    assert.isFunction(rsync.remoteList, 'should have a list function');

    rsync.remoteList(fsrcon, options, function (err, list) {

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
    
    var filename = '/';

    assert.isFunction(rsync.remoteStat);

    rsync.remoteStat(fsrcon, {filename: filename}, function (err, stats) {
      assert.isNull(err, 'should not have an error');
      assert.isObject(stats, 'stats should be object');
      assert.includeMembers(Object.keys(stats), ['size', 'atime', 'mtime', 'ctime', 'birthtime']);
      done();
    });

  });


  it('convert base64 string to ArrayBuffer', function () {

    var buffer = rsync.base64ToArrayBuffer('ZmlsZTAgY29udGVudA==');

    assert.instanceOf(buffer, ArrayBuffer);
    assert.strictEqual(buffer.byteLength, 13);

  });


  it('should load a remote file with small chunks', function (done) {

    rsync.remoteReadFile(
      fsrcon,
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

      var browserfs = new BROWSERFS(),
        path = '/',
        options;

      assert.isFunction(rsync.syncDir);

      options = {
        fs: browserfs,
        path: path
      };

      rsync.syncDir(fsrcon, options, function (err, result) {

        assert.isNull(err, 'should not have an error');
        assert.strictEqual(result, path);
        assert.isTrue(browserfs.existsSync('/file0'), 'file should exist');

        assert.isTrue(browserfs.existsSync('/file1'), 'file should exist');
        assert.isTrue(browserfs.existsSync('/file2'), 'file should exist');
        assert.isTrue(browserfs.statSync('/file2').isFile(), 'file should be a file');

        assert.isTrue(browserfs.existsSync('/dirA'), 'directory should exist');
        assert.isTrue(browserfs.statSync('/dirA').isDirectory(), 'file should be directory');

        done();
      });

    });


    it('should sync file contents', function (done) {

      var browserfs = new BROWSERFS(),
        path = '/',
        options = {
          fs: browserfs,
          path: path
        };

      rsync.syncDir(fsrcon, options, function () {

        assert.strictEqual(
          rsync.arrayBufferToString(
            browserfs.readFileSync('/file2')
          ),
          '½ + ¼ = ¾',
          'equal file contents'
        );

        done();
      });

    });


    it('should sync stats', function (done) {


      var browserfs = new BROWSERFS(),
        path = '/',
        options = {
          fs: browserfs,
          path: path
        };

      rsync.syncDir(fsrcon, options, function () {

        var fileNode;

        fileNode = browserfs.getNode('/file0');

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

        fileNode = browserfs.getNode('/dirA');
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

  }); // describe synchronizing file systems

}); // describe fs-rsync
