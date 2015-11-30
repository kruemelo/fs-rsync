var express = require('express');
var app = express();
var router = require('./router.js');

var bodyParser = require('body-parser');

var path = require('path');
var os = require('os');

app.fsMountPath = path.join(os.tmpDir(), 'fs-rsync-test');

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
  console.log('open specs at url file://' + __dirname + '/index.html in browser');
  console.log('or example at file://' + path.join(__dirname, '..', 'example', 'index.html') + ' in browser');
});