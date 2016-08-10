// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const request = require('request');
		const util = require('util');
		const TelegramBot = require('node-telegram-bot-api');
		const config = options.config;
		const branches = {};
		const pdd = require('./pdd')({
			config: config
		});
		const kb = require('./keyboard')({
			pdd: pdd,
			config: config
		});

		var bot;
		if (process.env.NODE_ENV === 'production') {
			bot = new TelegramBot(config.botToken);
			bot.setWebHook(config.host + config.url);
		} else {
			bot = new TelegramBot(config.botToken, {polling: true});
		}

		function processMessage(msg) {
			let stateObj = kb.parseTree(branches[msg.from.id], msg.text);

			if (stateObj.action == kb.keys.backKey && branches[msg.from.id].length > 0) {
				branches[msg.from.id].pop();
				stateObj = kb.parseTree(branches[msg.from.id]);
			}
			if (typeof stateObj.action === 'undefined') {
				stateObj.layout.query(stateObj.layout).then(function (query) {
					return bot.sendMessage(msg.chat.id, query, {
							reply_markup: stateObj.layout.reply_markup,
							disable_web_page_preview: true
						}).then(function () {
							branches[msg.from.id] = stateObj.branch;
						});
				}).catch(function (err) {
					console.log(err);
				});
			} else {
				if (stateObj.branch[0] == kb.keys.mailKey) {							// Mail
					if (stateObj.branch[1] == kb.keys.mailBoxesKey) {					// Mailboxes
						if (stateObj.branch[2] == kb.keys.addKey) {					// Add mailbox
							pdd.addMailbox(stateObj.action)
								.then(function (response) {
									bot.sendMessage(msg.chat.id, response, {
										reply_markup: stateObj.layout.reply_markup,
										parse_mode: 'Markdown',
										disable_web_page_preview: true
									}).catch(function (err) {
										console.log('ERROR: ', err);
									});
								})
								.catch(function (err) {
									console.log(err);
								});
							return;
						} else if (stateObj.branch.length == 3) {
							if (stateObj.action == kb.keys.changePasswordKey) {		// Change password
								pdd.changePassword(stateObj.branch[2])
									.then(function (response) {
										bot.sendMessage(msg.chat.id, response, {
											reply_markup: kb.justBackMarckup,
											parse_mode: 'Markdown',
											disable_web_page_preview: true
										}).catch(function (err) {
											console.log('ERROR: ', err);
										});
									})
									.catch(function (err) {
										console.log(err);
									});
								return;
							} else if (stateObj.action == kb.keys.removeKey) {		// Remove mailbox
								pdd.removeMailbox(stateObj.branch[2])
									.then(function (response) {
										bot.sendMessage(msg.chat.id, response, {
											reply_markup: kb.justBackMarckup,
											parse_mode: 'Markdown',
											disable_web_page_preview: true
										}).catch(function (err) {
											console.log('ERROR: ', err);
										});
									})
									.catch(function (err) {
										console.log(err);
									});
								return;
							} else {												// Click on id possibly
								branches[msg.from.id].pop();
								processMessage(msg);
								return;
							}
						}
					}
				}
				stateObj.layout.query(stateObj.layout).then(function (query) {
					return bot.sendMessage(msg.chat.id, 'Не понимаю, что значит «' + stateObj.action +  '»\n\n' + query, {
							reply_markup: stateObj.layout.reply_markup,
							disable_web_page_preview: true
						}).then(function () {
							branches[msg.from.id] = stateObj.branch;
						});
				}).catch(function (err) {
					console.log(err);
				});
			}
		}

		bot.on('message', function (msg) {
			// console.log(util.inspect(msg));
			if (msg.chat.type != 'private') {
				return;
			}
			if (!config.permitUsers.includes(msg.from.id)) {
				bot.sendMessage(msg.chat.id, 'Если вы знаете владельца бота, скажите ему эти цифры: ' + msg.from.id);
				return;
			}
			if (typeof msg.text === 'undefined') {
				bot.sendMessage(msg.chat.id, 'Пока понимаю только текст. Сорян!');
				return;
			}
			if (typeof branches[msg.from.id] === 'undefined') {
				branches[msg.from.id] = [];
			}
			processMessage(msg);
		});

		return bot;
	};
})();
