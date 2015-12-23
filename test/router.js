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

var accounts = {};

function addAccountsTo (accounts) {
  var accountId = FSRCON.hash('email@domain.tld');
  accounts[accountId] = {
    password: FSRCON.passwordS1('my secret', accountId),
    fsMountPath: '/'
  };
}

addAccountsTo(accounts);

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

  var rcon = new FSRCON.Server();
  rcon.init({
    clientNonce: req.body && req.body.CN,
      clientAccountKey: req.body && req.body.CAK
  }, function (err) {

    if (err) {
      res.status(500).end(err.message);
      next(err);
      return;        
    }

    connections[rcon.SID] = rcon;

    res.end(JSON.stringify({
      SN: rcon.serverNonce
    }));

    next();
    
  });

});

// find existing sessions
router.use(function (req, res, next) {

  var reqSID = req.body && req.body.SID,
    rcon = connections[reqSID];

  // if (!rcon) {
  //   res.status(500).end('ECON');
  //   return;
  // }

  req.fsrcon = rcon;

  next();

});


router.post('/connect', function (req, res) {

  var rcon = req.fsrcon;

  if (!rcon || !req.body) {
    res.status(500).end('ECON');
    return;      
  }

  rcon.connect(
    {
      accounts: accounts,
      clientHashedPassword: req.body.CHP,
      clientVerificationKey: req.body.CVK
    }, 
    function (err, accountId) {     
      if (err) {
        res.status(403).end();
        return;
      }
      req.accountId = accountId;
      res.json({STR: rcon.serverVerification});
    }
  );
});


// set mount path
router.post('/rpc', function (req, res, next) {

  var error = null,
    rcon = req.fsrcon,
    account = rcon && accounts[rcon.accountId];

  try {
    if (!rcon || !rcon.clientOK || !account) {
      res.status(403).end();
      return;
    }
    // use an account specific mount path here
    req.mountPath = path.join(req.app.fsMountPath, account.fsMountPath);
  }
  catch (e) {
    error = e;
  }

  next(error);

});

// decrypt request
router.post('/rpc', function (req, res, next) {

  var error = null,
    rcon = req.fsrcon;

  try {
    if (!rcon || !rcon.clientOK) {
      res.status(403).end();
      return;
    }

    req.body.data = FSRCON.decrypt(req.body.data, rcon.serverHashedPassword);

  }
  catch (e) {
    error = e;
  }

  next(error);

});

// apply rpc
router.use(RPC(
  validatorConfig, 
  function (validationError, rpc, req, res, next) {
    
    var rcon = req.fsrcon;
    
    if (validationError) {
      next(validationError);
      return;
    }

    try {

      RPC.execute(RPCFS, rpc, function (err, result) {
        res.end(FSRCON.encrypt(
          RPC.stringify([err, result]),
          rcon.serverHashedPassword
        ));              
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
