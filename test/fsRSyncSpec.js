define([
  'chai',
  'fs-rsync',
  'browserfs',
  'fs-rcon'
], function (chai, rsync, BROWSERFS, FSRCON) {

  var assert = chai.assert;

  describe('fs-rsync', function () {

    it('should initialize', function () {
      assert.isFunction(rsync);
      assert.isFunction(rsync.sync);
      assert.isFunction(BROWSERFS);
      assert.isFunction(FSRCON);
      assert.isFunction(require('fs-rsync'));
    });

    it('should sync with remote fs', function (done) {

      var browserfs = new BROWSERFS(),
        filename = '/',
        fsrcon = new FSRCON(),
        fnEnd;
        
      fnEnd = function (err) {
        assert.isNull(err);
        done();
      };

      rsync.sync({
        connection: fsrcon,
        fs: browserfs,
        path: filename,
        end: fnEnd
      });

    });

  }); // describe fs-rsync

}); // define