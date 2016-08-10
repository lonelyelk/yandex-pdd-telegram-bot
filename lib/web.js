// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const config = options.config;
		const app = require('express')();
		const bodyParser = require('body-parser');
		app.use(bodyParser.json());

		app.use(function (req, res, next) {
			console.log(req.url);
			res.status(200);
			res.type('txt').end(req.url);
		});

		const server = app.listen(config.port, function () {
			let host = server.address().address;
			let port = server.address().port;

			console.log('pddbot is listening at http://%s:%s', host, port);
		});
	};
})();
