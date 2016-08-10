// jshint esnext: true
(function () {
	'use strict';

	const config = require('./conf/config');
	const bot = require('./lib/bot')({
		config: config
	});
	require('./lib/web')({
		config: config,
		bot: bot
	});
})();
