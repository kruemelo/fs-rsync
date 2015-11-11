define([
  'chai',
  'fs-rsync',
  'browserfs',
  'fs-rcon'
], function (chai, rsync, BROWSERFS, FSRCON) {

  var assert = chai.assert;

  describe('fs-rsync', function () {

    var fsrcon;

    before(function (done) {
      fsrcon = new FSRCON();
      fsrcon.init({port: 3000}, done);
    });


    it('should have loaded', function () {
      assert.isFunction(rsync);
      assert.isFunction(BROWSERFS);
      assert.isFunction(FSRCON);
    });


    it('should get remote stats', function (done) {
      
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


    xit('should sync with remote fs', function (done) {

      var browserfs = new BROWSERFS(),
        filename = '/',
        options;

      assert.isFunction(rsync.sync);
        
      options = {
        connection: fsrcon,
        fs: browserfs,
        filename: filename
      };

      rsync.sync(options, function (err, result) {
        assert.isNull(err);
        assert.strictEqual(result, filename);
        done();
      });

    });

  }); // describe fs-rsync

}); // define