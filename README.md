# fs-rsync

node-browserfs extension for web clients to sync with remote files

## ctor(fs, connection)

```
var fs = new browserfs(), 
  connection = FSRCON.Client(),
  rsync = new FSRSYNC(fs, connection);
```

## syncDir(path, callback)

synchronizes a local fs with a remote fs directory

```
rsync.syncDir('/dirA', function (err) {
  if (err) {
    console.error(err);
  }
  ..
});
```

## Example

```
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="require.js"></script>
    <script>

    requirejs.config({
      'baseUrl': './',
      'paths': {
        'browserfs': '../node-browserfs/browserfs'
        'fs-rsync': '../fs-rsync',
        'fs-rpc': '../fs-rpc/fs-rpc',
        'fs-rcon': '../fs-rcon/fs-rcon'
      }
    });

    require([
        'browserfs'
        'fs-rsync',
        'fs-rcon'
      ], 
      function (
        browserfs, 
        FSRSYNC,
        FSRCON
      ) {

      var fs = new browserfs(), 
        connection = FSRCON.Client(),
        rsync = new FSRSYNC(fs, connection);

      connection.init({port: 3000}, function (err) {
        if (err) {
          window.alert('failed to connect to server: ' + err.message);
          console.error(err);
        }
        else {
          console.info('connected');
          rsync.syncDir('/', function (err) {
            if (err) {
              console.error(err);
            }
            ..
          });
        }
      });
    });

    </script>
  </head>
  <body></body>
</html>        
```

# test

start test server

```
$ node ./test/server.js
->  test server listening at http://127.0.0.1:3000
    open specs at url file:///home/customer/projekte/fs-rsync/test/index.html in browser
    or example at file:///home/customer/projekte/fs-rsync/example/index.html in browser

```

License
-------
[WTFPL](http://www.wtfpl.net/)