# fs-rsync

[node-browserfs](https://github.com/kruemelo/node-browserfs) extension for web clients to sync with remote files

## constructor(fs, connection)

```
var fs = new browserfs(), 
  connection = FSRCON.Client();
..  
var rsync = new FSRSYNC(fs, connection);
```

## syncDir(path, [options,] callback)

synchronizes a local fs with a remote fs directory

```
rsync.syncDir('/dirA', {recursive: true}, function (err) {
  if (err) {
    console.error(err);
  }
  ..
});
```

options.recursive: if truthy, synchronizes the directory recursively. default false.

## syncFile(filename, callback)

synchronize a single file

```
rsync.syncFile('/file0', function (err) {
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

      connection.init('fsrcon/init')
        .then(
          function () {
            console.info('connected');

            rsync.syncDir('/', function (err) {
              if (err) {
                console.error(err);
              }
              fs.stat('/', function (err, files) {
                console.log(files);
              });
            });

          },
          function (err) {
            window.alert('failed to connect to server: ' + err.message);
            console.error(err);
          }
        );
      };
    
    });

    </script>
  </head>
  <body></body>
</html>        
```

# test

start test server

```
$ npm test
->  test server listening at http://127.0.0.1:3000
    open specs at url file:///home/customer/projekte/fs-rsync/test/index.html in browser
    or example at file:///home/customer/projekte/fs-rsync/example/index.html in browser

```

License
-------
[WTFPL](http://www.wtfpl.net/)
