var rsync = require('../fs-rsync.js');
rsync.sync({end: function () {
	console.log('done!');
}});