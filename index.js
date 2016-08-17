// jshint esnext: true
(function () {
	'use strict';

	const config = require('./conf/config');
	const keyboard = require('./lib/keyboard');
	const pdd = require('./lib/pdd')({
		config: config
	});
	const dialogues = require('./lib/dialogues')({
		keyboard: keyboard,
		pdd: pdd
	});

	const bot = require('./lib/bot')({
		config: config,
		dialogues: dialogues
	});
	require('./lib/web')({
		config: config,
		bot: bot
	});
})();
