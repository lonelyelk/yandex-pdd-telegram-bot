// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const request = require('request');
		const pddToken = options.config.pddToken;
		const exclude = options.config.excludeMail;
		const readonly = options.config.readonlyMail;
		const domain = options.config.domainMail;
		const util = require('util');

		function randomPassword () {
			let arr = [];
			for (let i = 0; i < 20; i++) {
				arr.push(Math.floor(Math.random() * 10));
			}
			return arr.join('').substr(0, 20);
		}

		return {
			listMailboxes: function (layout) {
				return new Promise(function (resolve, reject) {
					request({
						url: 'https://pddimp.yandex.ru/api2/admin/email/list',
						headers: {
							'PddToken': pddToken
						},
						qs: {
							domain: domain,
							page: 1,
							on_page: 500
						},
						json: true
					}, function (err, res, body) {
						if (err) {
							resolve('Ошибка: ' + err.toString());
							return;
						}
						if (res.statusCode == 200) {
							if (body.success == 'ok') {
								let accounts = body.accounts.filter(function (obj) {
													return exclude.indexOf(obj.login) < 0;
												});
								layout.tree = layout.baseTree();
								accounts.forEach(function (obj) {
									let msg = 'Ящик ' + obj.login + ' ' + obj.fio + '\n';
									if (obj.aliases && obj.aliases.length > 0) {
										msg += 'Алиасы: ' + obj.aliases.join(', ') + '\n';
									}
									if (obj.ready == 'yes') {
										msg += 'Готов к работе.\n';
										msg += (obj.enabled == 'yes') ? 'Активен.' : 'Заблокирован.';
									} else {
										msg += 'Не готов к работе. Не принято пользовательское соглашение.';
									}
									layout.tree['/' + obj.uid] = layout.mailboxLayout(msg, readonly.includes(obj.login));
								});
								resolve(accounts.map(function (obj) {
												let str = '/' + obj.uid + '    ' + obj.login + '    ' + obj.fio;
												if (obj.aliases.length > 0) {
													str += '\n        [' + obj.aliases.join(', ') + ']';
												}
												return str;
											})
											.join('\n'));
							} else {
								resolve('Ошибка: ' + body.error);
							}
						} else {
							resolve('Статус: ' + res.statusCode);
						}
					});
				});
			},
			addMailbox: function (name) {
				return new Promise(function (resolve, reject) {
					let password = randomPassword();
					request({
						method: 'POST',
						url: 'https://pddimp.yandex.ru/api2/admin/email/add',
						headers: {
							'PddToken': pddToken
						},
						qs: {
							domain: domain,
							login: name,
							password: password
						},
						json: true
					}, function (err, res, body) {
						if (err) {
							resolve('Ошибка: ' + err.toString());
							return;
						}
						if (res.statusCode == 200) {
							if (body.success == 'ok') {
								resolve('Ящик ' + body.login + ' создан. Пароль: `' + password + '`');
							} else {
								resolve('Ошибка: ' + body.error);
							}
						} else {
							resolve('Статус: ' + res.statusCode);
						}
					});
				});
			},
			changePassword: function (uid) {
				uid = uid.replace(/^\//, '');
				return new Promise(function (resolve, reject) {
					let password = randomPassword();
					request({
						method: 'POST',
						url: 'https://pddimp.yandex.ru/api2/admin/email/edit',
						headers: {
							'PddToken': pddToken
						},
						qs: {
							domain: domain,
							uid: uid,
							password: password
						},
						json: true
					}, function (err, res, body) {
						if (err) {
							resolve('Ошибка: ' + err.toString());
							return;
						}
						if (res.statusCode == 200) {
							if (body.success == 'ok') {
								resolve('Пароль для ящика ' + body.login + ' теперь: `' + password + '`');
							} else {
								resolve('Ошибка: ' + body.error);
							}
						} else {
							resolve('Статус: ' + res.statusCode);
						}
					});
				});
			},
			removeMailbox: function (uid) {
				uid = uid.replace(/^\//, '');
				return new Promise(function (resolve, reject) {
					let password = randomPassword();
					request({
						method: 'POST',
						url: 'https://pddimp.yandex.ru/api2/admin/email/del',
						headers: {
							'PddToken': pddToken
						},
						qs: {
							domain: domain,
							uid: uid
						},
						json: true
					}, function (err, res, body) {
						if (err) {
							resolve('Ошибка: ' + err.toString());
							return;
						}
						if (res.statusCode == 200) {
							if (body.success == 'ok') {
								resolve('Ящик ' + body.login + ' удалён.');
							} else {
								resolve('Ошибка: ' + body.error);
							}
						} else {
							resolve('Статус: ' + res.statusCode);
						}
					});
				});
			},
			listDomains: function (layout) {
				return new Promise(function (resolve, reject) {
					request({
						url: 'https://pddimp.yandex.ru/api2/admin/domain/domains',
						headers: {
							'PddToken': pddToken
						},
						qs: {
							page: 1,
							on_page: 500
						},
						json: true
					}, function (err, res, body) {
						if (err) {
							resolve('Ошибка: ' + err.toString());
							return;
						}
						if (res.statusCode == 200) {
							if (body.success == 'ok') {
								layout.tree = layout.baseTree();
								layout.reply_markup.keyboard = layout.baseKeyboard();
								let row = [];
								let domains = body.domains.map(function (obj) {
									let name = layout.domainPrefix + obj.name;
									let msg = obj.name + ' ';
									switch (obj.status) {
										case 'domain-activate' :
											msg += 'не подтверждён\n';
											break;
										case 'mx-activate' :
											msg += 'подтверждён, но не настроена почта (MX)\n';
											break;
										case 'added' :
											msg += 'в порядке ✅\n';
											name += ' ✅';
											break;
										default :
											msg += 'не существует\n';
									}
									if (obj.nsdelegated == 'yes' || obj.nsdelegated === true) {
										msg += '👾 делегирован на Яндекс';
										name += ' 👾';
									}
									row.push(name);
									if (row.length > 2) {
										layout.reply_markup.keyboard.push(row);
										row = [];
									}
									layout.tree[name] = layout.domainLayout(msg);
									return name;
								});
								if (row.length > 0) {
									layout.reply_markup.keyboard.push(row);
								}
								resolve(domains.join('\n'));
							} else {
								resolve('Ошибка: ' + body.error);
							}
						} else {
							resolve('Статус: ' + res.statusCode);
						}
					});
				});
			},
			listMaillists: function (layout) {
				return new Promise(function (resolve, reject) {
					request({
						url: 'https://pddimp.yandex.ru/api2/admin/email/ml/list',
						headers: {
							'PddToken': pddToken
						},
						qs: {
							domain: domain
						},
						json: true
					}, function (err, res, body) {
						if (err) {
							resolve('Ошибка: ' + err.toString());
							return;
						}
						if (res.statusCode == 200) {
							if (body.success == 'ok') {
								layout.tree = layout.baseTree();
								layout.reply_markup.keyboard = layout.baseKeyboard();
								let row = [];
								let maillists = body.maillists.map(function (obj) {
									let name = layout.maillistPrefix + obj.maillist;
									row.push(name);
									if (row.length > 2) {
										layout.reply_markup.keyboard.push(row);
										row = [];
									}
									layout.tree[name] = layout.maillistLayout(name, obj.uid);
									return name + ' — ' + obj.cnt;
								});
								if (row.length > 0) {
									layout.reply_markup.keyboard.push(row);
								}
								resolve(maillists.join('\n'));
							} else {
								resolve('Ошибка: ' + body.error);
							}
						} else {
							resolve('Статус: ' + res.statusCode);
						}
					});
				});
			},
			getMaillistInfo: function (name, uid) {
				return function (layout) {
					return new Promise(function (resolve, reject) {
						request({
							url: 'https://pddimp.yandex.ru/api2/admin/email/ml/subscribers',
							headers: {
								'PddToken': pddToken
							},
							qs: {
								domain: domain,
								maillist_uid: uid
							},
							json: true
						}, function (err, res, body) {
							if (err) {
								resolve('Ошибка: ' + err.toString());
								return;
							}
							if (res.statusCode == 200) {
								if (body.success == 'ok') {
									let subscribers = body.subscribers.map(function (obj) {
										return layout.subscriberPrefix + obj;
									});
									resolve('Список подписчиков ' + name + ':\n' + subscribers.join('\n'));
								} else {
									resolve('Ошибка: ' + body.error);
								}
							} else {
								resolve('Статус: ' + res.statusCode);
							}
						});
					});
				};
			}
		};
	};
})();
