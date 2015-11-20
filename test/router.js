//Optional router that can be specified if your tests require back-end interaction.

var path = require('path');
var os = require('os');

// fs-extra 
var fs = require('fs-extra');

// file system remote procedure calls module
var FSRPC = require('fs-rpc');

// rpc file system module
var RPCFS = require('rpc-fs');

// fs remote connection module
var FSRCON = require('fs-rcon');

var validatorConfig = require('./validator-config.json');
var mountPath = path.join(os.tmpDir(), 'fs-rsync-test');

function createTestDir () {

  var src = path.join(__dirname, 'fixtures', 'testFS');

  fs.emptyDirSync(mountPath);
  fs.copySync(src, mountPath);
}

module.exports = function (server) {

  var bodyParser = require('body-parser'),
    connections = {};

  createTestDir();

  // parse body
  server.use(bodyParser.json({limit: '6mb'})); 


  // initialize connections
  server.post('/init', function (req, res){

    var clientRandomKey = req.body && req.body.CRK ? req.body.CRK : undefined,
      rcon = FSRCON.Server();

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


  // set mount path
  server.post('/rpc', function (req, res, next) {

    var reqSID = req.body && req.body.SID ? req.body.SID : undefined,
      rcon = connections[reqSID];

    if (!rcon) {
      res.status(500).end('ECON');
      return;
    }

    // may use an account specific mount path here
    req.mountPath = mountPath;

    next();

  });

  // apply rpc
  server.use(FSRPC.Server(
    validatorConfig, 
    function (validationError, rpcList, req, res/*, next*/) {

      if (validationError) {
        res.status(500).end(validationError.message);
        return;
      }

      FSRPC.Server.execute(RPCFS, rpcList, function (err, resultList) {

        if (err) {
          res.status(500).end(err.message);
        }
        else {
          res.end(FSRPC.Server.stringify(resultList));        
        }
      });

    }
  ));

};