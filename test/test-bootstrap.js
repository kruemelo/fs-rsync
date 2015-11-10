require.config({
	paths: {
		chai: '/node_modules/chai/chai',
		'browserfs': '/node_modules/node-browserfs/browserfs',
		'fs-rpc': '/node_modules/fs-rpc/fs-rpc',
		'cryptojs': '/node_modules/fs-rcon/libs/CryptoJS',
		'fs-rcon': '/node_modules/fs-rcon/fs-rcon'
	},
	baseUrl: '/'
});

mocha.setup({
    ui: 'bdd'
});

require([
	testPathname
], function () {

	if (window.mochaPhantomJS) {
		mochaPhantomJS.run();
	}
	else {
		mocha.run();
	}
	
});