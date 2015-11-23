var express = require('express');
var app = express();
var router = require('./router.js');

var bodyParser = require('body-parser');

var path = require('path');
var os = require('os');

app.fsMountPath = path.join(os.tmpDir(), 'fs-rsync-test');

// fs-extra 
var fsExtra = require('fs-extra');

function createTestDir () {

  var src = path.join(__dirname, 'fixtures', 'testFS');

  fsExtra.emptyDirSync(app.fsMountPath);
  fsExtra.copySync(src, app.fsMountPath);
}

createTestDir();

// place it before app.use(app.router); for it to work
// app.disable('x-powered-by');
// app.set('x-powered-by', false);

// parse body
app.use(bodyParser.json({limit: '6mb'})); 

app.use('/', router);

var server = app.listen(3000, 'localhost', function () {
  
  var host = server.address().address;
  var port = server.address().port;

  console.log('test server listening at http://%s:%s', host, port);
  console.log('open file://' + __dirname + '/client.html in browser');
});