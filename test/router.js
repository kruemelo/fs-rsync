//Optional router that can be specified if your tests require back-end interaction.
var fs = require('fs-extra');
var FSRPC = require('fs-rpc');
var validatorConfig = require('./validator-config.json');
var path = require('path');
var mountPath = path.join(require('os').tmpDir(), 'fs-rsync-test');

module.exports = function (server) {

  var bodyParser = require('body-parser'),
    FSRCON = require('fs-rcon'),
    connections = {};

  fs.emptyDirSync(mountPath);

  server.use(bodyParser.json({limit: '6mb'})); // for parsing application/json

  server.post('/rpc', function (req, res, next) {
// console.log('router POST /rpc:', req.body);
    var reqSID = req.body && req.body.SID ? req.body.SID : undefined,
      reqData = req.body && req.body.data ? req.body.data : undefined,
      strReqRPC = 'object' === typeof reqData ? reqData.rpc : undefined,
      fsRPC = new FSRPC(validatorConfig),
      rpc,
      validationError,
      rcon = connections[reqSID];

    if (!rcon) {
      res.status(500).end('ECON');
      return;
    }
// delete validatorConfig['stat'];
    rpc = fsRPC.parse(strReqRPC, mountPath);
    validationError = fsRPC.validate(rpc, mountPath);

    if (validationError) {
      res.status(500).end(validationError.message);
      return;
    }

    // res.json({rpc: {}});        

    fsRPC.execute(fs, rpc, function () {
// console.log('fsRPC.execute result: ', arguments);
      var args = Array.prototype.slice.call(arguments),
        err = args[0],
        result;

      if (err) {
        res.status(500).end(err.message);
      }
      else {
        result = Array.prototype.slice.call(args, 1);
        res.json({rpc: result});        
      }

      next();
    });

  });

  server.post('/init', function (req, res){

    var clientRandomKey = req.body && req.body.CRK ? req.body.CRK : undefined,
      rcon = new FSRCON();

    rcon.connect({
      clientRandomKey: clientRandomKey
    }, function (err) {

      if (err) {
        res.status(500).end(err.message);
        return;        
      }

      connections[rcon.SID] = rcon;

      res.end(JSON.stringify({
        SRK: rcon.serverRandomKey
      }));
      
    });

  });
};