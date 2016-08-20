// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const config = options.config;
		const app = require('express')();
		const bodyParser = require('body-parser');
		const path = require('path');
		app.use(bodyParser.json());

		app.post(config.url, function (req, res) {
			options.bot.processUpdate(req.body);
			res.status(200).send({}).end();
		});
		app.use(function (req, res, next) {
			res.status(404).sendFile(path.join(__dirname, 'index.html'));
		});

		const server = app.listen(config.port, 'localhost', function () {
			let host = server.address().address;
			let port = server.address().port;

			console.log('pddbot is listening at http://%s:%s', host, port);
		});

		return server;
	};
})();
