var express = require('express');
var router = express.Router();

// file system remote procedure calls module
var FSRPC = require('fs-rpc');

// rpc file system module
var RPCFS = require('rpc-fs');

// // fs remote connection module
var FSRCON = require('fs-rcon');

var validatorConfig = require('./validator-config.json');
// var mountPath = path.join(os.tmpDir(), 'fs-rsync-test');

var connections = {};

// remove x-powered-by
router.use(function(req, res, next) {
  req.app.disable('x-powered-by');
  // res.header('x-powered-by', 'someone');
  next();
});

// log some stuff to console
router.use(function(req, res, next) {
  console.log(req.method, req.path);
  next();
});


// http://enable-cors.org/server_expressjs.html
router.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// initialize connections
router.post('/init', function (req, res){

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
router.post('/rpc', function (req, res, next) {

  var reqSID = req.body && req.body.SID ? req.body.SID : undefined,
    rcon = connections[reqSID];

  if (!rcon) {
    res.status(500).end('ECON');
    return;
  }

  // may use an account specific mount path here
  req.mountPath = req.app.fsMountPath;

  next();

});

// apply rpc
router.use(FSRPC.Server(
  validatorConfig, 
  function (validationError, rpcList, req, res/*, next*/) {
    if (validationError) {
      res.status(500).end(validationError.message);
      return;
    }
    FSRPC.Server.execute(RPCFS, rpcList, function (err, resultList) {

      // console.log('FSRPC.Server.execute resultList', resultList);

      if (err) {
        res.status(500).end(err.message);
      }
      else {
        // console.log(
        //   'FSRPC.Server.stringify(rpcList, resultList)', 
        //   FSRPC.Server.stringify(rpcList, resultList)
        // );
        res.end(FSRPC.Server.stringify(rpcList, resultList));        
      }
    });

  }
));

module.exports = router;
