//Optional router that can be specified if your tests require back-end interaction.

module.exports = function(server){

	server
		.get('/test-route', function(req, res){
			res.end('test');
		});
};