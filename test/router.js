var express = require('express');
var router = express.Router();
var path = require('path');

// fs-extra 
var fsExtra = require('fs-extra');

function createTestDir (fsMountPath) {

  var src = path.join(__dirname, 'fixtures', 'testFS');

  fsExtra.emptyDirSync(fsMountPath);
  fsExtra.copySync(src, fsMountPath);
}

// file system remote procedure calls module
var FSRPC = require('fs-rpc');
var RPC = FSRPC.Server;

// rpc file system module
var RPCFS = require('rpc-fs');

// // fs remote connection module
var FSRCON = require('fs-rcon');

var validatorConfig = require('./validator-config.json');

console.log('validatorConfig', validatorConfig);

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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control');
  next();
});


// reset mount path content
router.get('/resetRemoteFs', function (req, res) {
  createTestDir(req.app.fsMountPath);
  res.status(204).end();
});


// initialize connections
router.post('/init', function (req, res, next){

  var clientRandomKey = req.body && req.body.CRK ? req.body.CRK : undefined,
    rcon = FSRCON.Server();

  rcon.connect({
    clientRandomKey: clientRandomKey
  }, function (err) {

    if (err) {
      res.status(500).end(err.message);
      next(err);
      return;        
    }

    connections[rcon.SID] = rcon;

    res.end(JSON.stringify({
      SRK: rcon.serverRandomKey
    }));

    next();
    
  });

});

// set mount path
router.post('/rpc', function (req, res, next) {

  var reqSID = req.body && req.body.SID ? req.body.SID : undefined,
    rcon = connections[reqSID];

  if (!rcon) {
    res.status(403).end('ECON');
    next(new Error('ECON'));
    return;
  }

  // may use an account specific mount path here
  req.mountPath = req.app.fsMountPath;

  next();

});

// apply rpc
router.use(RPC(
  validatorConfig, 
  function (validationError, rpc, req, res, next) {
    
    if (validationError) {
      next(validationError);
      return;
    }

    try {
      RPC.execute(RPCFS, rpc, function (err, result) {
        res.end(RPC.stringify([err, result]));              
      });      
    }
    catch (e) {
      res.end(RPC.stringify([e]));
    }

  }
));

router.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).end(err.message);
  next(err);
});

module.exports = router;
