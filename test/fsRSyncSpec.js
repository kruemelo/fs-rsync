define([
  'chai',
  'fs-rsync',
  'browserfs',
  'fs-rcon'
], function (chai, rsync, BROWSERFS, FSRCON) {

  var assert = chai.assert;

  describe('fs-rsync', function () {

    var fsrcon = FSRCON.Client();

    before(function (done) {
      fsrcon.init({port: 3000}, done);
    });


    it('should have loaded module', function () {
      assert.isFunction(rsync);
      assert.isFunction(BROWSERFS);
      assert.isObject(FSRCON);
    });


    it('should list remote directory contents and stats', function (done) {

      var options = {
        path: '/'
      };

      assert.isFunction(rsync.list, 'should have a list function');

      rsync.list(fsrcon, options, function (err, list) {

        assert.isNull(err, 'should not have an error');

        assert.isArray(list, 'result should be an array');

        console.log(list);

        done();
        
      });

    });


    xit('should get remote stats', function (done) {
      
      var filename = '/';

      assert.isFunction(rsync.remoteStat);

      rsync.remoteStat({connection: fsrcon, filename: filename}, function (err, stats) {
        assert.isNull(err, 'should not have an error');
// console.log('fsRSyncSpec get remote stats, stats:', stats);        
        assert.isObject(stats, 'stats should be object');
        assert.includeMembers(Object.keys(stats), ['size', 'atime', 'mtime', 'ctime', 'birthtime']);
        done();
      });

    });


    xit('should sync dir with remote fs', function (done) {

      var browserfs = new BROWSERFS(),
        path = '/',
        options;

      assert.isFunction(rsync.sync);
        
      options = {
        fs: browserfs,
        path: path
      };

      rsync.syncDir(fsrcon, options, function (err, result) {
        assert.isNull(err);
        assert.strictEqual(result, path);
        assert.isTrue(browserfs.existsSync('/A'), 'file A should exist');
        assert.isTrue(browserfs.statSync('/A').isFile(), 'file A should be a file');
        assert.isTrue(browserfs.existsSync('/a'), 'file a should exist');
        assert.isTrue(browserfs.statSync('/a').isDirectory(), 'file a should be directory');
        done();
      });

    });

  }); // describe fs-rsync

}); // define