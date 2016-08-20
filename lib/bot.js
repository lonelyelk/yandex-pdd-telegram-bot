// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const request = require('request');
		const util = require('util');
		const TelegramBot = require('node-telegram-bot-api');
		const config = options.config;
		const nodes = {};
		const dialogues = options.dialogues;

		var bot;
		if (process.env.NODE_ENV === 'production') {
			bot = new TelegramBot(config.botToken, {polling: false});
			bot.setWebHook(config.host + config.url);
		} else {
			bot = new TelegramBot(config.botToken, {polling: true});
		}

		bot.on('message', function (msg) {
			if (msg.chat.type != 'private') {
				return;
			}
			if (!config.permitUsers.includes(msg.from.id)) {
				bot.sendMessage(msg.chat.id, 'Если вы знаете владельца бота, скажите ему эти цифры: ' + msg.from.id + '. 📡');
				return;
			}
			if (typeof msg.text === 'undefined') {
				bot.sendMessage(msg.chat.id, 'Пока понимаю только текст. Сорян! 🐷');
				return;
			}
			if (typeof nodes[msg.from.id] === 'undefined') {
				nodes[msg.from.id] = new dialogues.create();
				nodes[msg.from.id].showQuery().then(function (res) {
					return bot.sendMessage(msg.chat.id, res, nodes[msg.from.id].node.replyOptions);
				}).catch(function (err) {
					console.log(err);
					console.log(err.stack);
				});
			} else {
				nodes[msg.from.id].processText(msg.text).then(function (node) {
					return node.showQuery();
				}).then(function (res) {
					return bot.sendMessage(msg.chat.id, res, nodes[msg.from.id].node.replyOptions);
				}).catch(function (err) {
					console.log(err);
					console.log(err.stack);
				});
			}
		});

		return bot;
	};
})();
