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


  it('convert string to ArrayBuffer to string', function () {

    var FSRPC,
      content = 'buffer \u00bd + \u00bc = \u00be test',
      buffer,
      toStr;

    assert.isFunction(rsync.getFSRPC);

    FSRPC = rsync.getFSRPC();

    assert.isObject(FSRPC);

    buffer = FSRPC.stringToArrayBuffer(content);

    assert.instanceOf(buffer, ArrayBuffer);

    toStr = FSRPC.arrayBufferToString(buffer);

    assert.strictEqual(toStr, content);

  });


  it('should sync all files in a directory with remote fs', function (done) {

    var browserfs = new BROWSERFS(),
      path = '/',
      options;

    assert.isFunction(rsync.syncDir);

    options = {
      fs: browserfs,
      path: path
    };

    rsync.syncDir(fsrcon, options, function (err, result) {
      assert.isNull(err);
      assert.strictEqual(result, path);
      assert.isTrue(browserfs.existsSync('/file0'), 'file should exist');
      assert.isTrue(browserfs.statSync('/file0').isFile(), 'file should be a file');
      assert.strictEqual(
        browserfs.readFileSync('/file0', {encoding: true}),
        'file0 content',
        'equal file contents'
      );
      assert.isTrue(browserfs.existsSync('/dirA'), 'directory should exist');
      assert.isTrue(browserfs.statSync('/dirA').isDirectory(), 'file should be directory');
      done();
    });

  });

}); // describe fs-rsync
