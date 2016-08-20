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
	const server = require('./lib/web')({
		config: config,
		bot: bot
	});

	function gracefulClose() {
		server.close(function () {
			process.exit(0);
		});
	}

	process.on('SIGINT', function () {
		Promise.all(config.permitUsers.map(function (userId) {
			return bot.sendMessage(userId, 'Бот временно выключается. Только спокойствие! 🐨', {
				reply_markup: {
					hide_keyboard: true
				}
			});
		})).then(gracefulClose).catch(function (err) {
			console.log(err);
			gracefulClose();
		});
	});

	config.permitUsers.map(function (userId) {
		return bot.sendMessage(userId, 'Бот снова в строю. Скажите что-нибудь! 🐯', {
			reply_markup: {
				hide_keyboard: true
			}
		});
	});
})();
