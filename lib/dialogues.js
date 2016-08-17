// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const keyboard = options.keyboard;
		const pdd = options.pdd;
		const util = require('util');

		class Node {
			constructor (options) {
				this.qs = this.qs || {};
				this._replyOptions = this._replyOptions || {};
				this._replyOptions.reply_markup = this._replyOptions.reply_markup || {};
				this._replyOptions.reply_markup.keyboard = this._replyOptions.reply_markup.keyboard || [];
				if (!this._replyOptions.reply_markup.hasOwnProperty('resize_keyboard')) {
					this._replyOptions.reply_markup.resize_keyboard = true;
				}
				this._replyOptions.parse_mode = this._replyOptions.parse_mode || 'Markdown';
				if (!this._replyOptions.hasOwnProperty('disable_web_page_preview')) {
					this._replyOptions.disable_web_page_preview = true;
				}
				if (typeof options !== 'undefined') {
					if (typeof options.qs !== 'undefined') {
						for (let name in options.qs) {
							this.qs[name] = options.qs[name];
						}
					}
					if (typeof options.keyboard !== 'undefined') {
						for (let num = 0; num < options.keyboard.length; num += 1) {
							this._replyOptions.reply_markup.keyboard.push(options.keyboard[num]);
						}
					}
				}
			}

			showQuery () {
				return Promise.resolve('Это не обработанная ветвь диалога.');
			}

			processText (msgText) {
				return Promise.resolve(new Node());
			}

			get replyOptions () {
				return {
					reply_markup: this._replyOptions.reply_markup,
					parse_mode: this._replyOptions.parse_mode,
					disable_web_page_preview: this._replyOptions.disable_web_page_preview
				};
			}
		}

		class ListDomains extends Node {
			constructor (options) {
				options = options || {};
				options.qs = {
					page: 1,
					on_page: 20
				};
				options.keyboard = [[keyboard.addKey]];
				super(options);
			}

			showQuery () {
				let t = this;
				return pdd.listDomains(this.qs).then(function (res) {
					let query = '';
					t.tree = {};
					res.domains.forEach(function (domain, index) {
						let cmd = '/' + index;
						t.tree[cmd] = new DomainStatus({
							domain: domain.name,
							delegated: domain.nsdelegated
						});
						query += cmd + '  ' + domain.name + (domain.nsdelegated ? keyboard.domainDelegatedSuffix : '') + '\n';
					});
					return query;
				}).catch(function (err) {
					return 'Ошибка: `' + err + '`';
				});
			}

			processText (msgText) {
				if (this.tree && this.tree.hasOwnProperty(msgText)) {
					return Promise.resolve(this.tree[msgText]);
				} else if (msgText == keyboard.addKey) {
					return Promise.resolve(new AddDomain());
				} else {
					return Promise.resolve(this);
				}
			}
		}

		class AddDomain extends Node {
			constructor (options) {
				options = options || {};
				options.keyboard = [[keyboard.backKey]];
				super(options);
			}

			showQuery () {
				let query = this.error ? 'Ошибка: `' + this.error + '`\n' : '';
				query += 'Какой домен добавить?';

				return Promise.resolve(query);
			}

			processText (msgText) {
				if (msgText == keyboard.backKey) {
					return Promise.resolve(new ListDomains());
				} else {
					let t = this;
					this.qs.domain = msgText;
					return pdd.addDomain(this.qs).then(function (res) {
						return new DomainStatus({
							domain: res.domain
						});
					}).catch(function (err) {
						t.error = err;
						return t;
					});
				}
			}
		}

		class DomainStatus extends Node {
			constructor (options) {
				options = options || {};
				options.qs = {
					domain: options.domain
				};
				super(options);
				this.name = options.domain;
				this.delegated = options.delegated;
			}

			showQuery () {
				let t = this;
				return pdd.domainStatus(this.qs).then(function (res) {
					let query = keyboard.domainPrefix + t.name + '\n';
					switch (res.status) {
						case 'domain-activate':
							query += 'Владение доменом не подтверждено: `' + res.check_results + '`. Чтобы подтведить:\n';
							query += '🕷 Загрузить в корневой каталог сайта файл с именем `' + res.secrets.name + '.html` и содержащий текст `' + res.secrets.content + '`\n';
							query += '🕷 Для поддомена `yamail-' + res.secrets.name + '` настроить CNAME-запись на `mail.yandex.ru`\n';
							query += '🕷 Указать адрес `' + res.secrets.name + '@yandex.ru` в качестве контактного адреса для домена (https://yandex.ru/support/pdd/setting/confirm.xml#way3)';
							t.replyOptions.reply_markup.keyboard = [[keyboard.checkKey, keyboard.backKey]];
							break;
						case 'mx-activate':
							query += 'Владение доменом подтверждено. Чтобы настроить почту:\n';
							query += '🕷 Для поддомена `@` настроить MX-запись с приоритетом 10 на `mx.yandex.net.` (с точкой в конце)\n';
							query += '🕷 Делегировать домен на Яндекс (https://yandex.ru/support/pdd/domain/dns.xml)';
							t.replyOptions.reply_markup.keyboard = [[keyboard.checkKey, keyboard.backKey]];
							break;
						case 'added':
							query += 'Домен настроен' + (t.delegated ? ' и делегирован на Яндекс' : '') + '.';
							t.replyOptions.reply_markup.keyboard = t.delegated ? [[keyboard.dnsKey, keyboard.backKey]] : [[keyboard.backKey]];
							break;
						default:
							query += 'Неизвестный статус `' + res.status + '`';
							t.replyOptions.reply_markup.keyboard = [[keyboard.backKey]];
					}
					return query;
				}).catch(function (err) {
					return 'Ошибка: `' + err + '`';
				});
			}

			processText (msgText) {
				switch(msgText) {
					case keyboard.backKey:
						return Promise.resolve(new ListDomains());
					case keyboard.dnsKey:
						return Promise.resolve(new ListDomainDNSRecords({
							domain: this.name
						}));
					default:
						return Promise.resolve(this);
				}
			}
		}

		class ListDomainDNSRecords extends Node {
			constructor (options) {
				options = options || {};
				options.qs = {
					domain: options.domain
				};
				options.keyboard = [[keyboard.fullKey, keyboard.backKey]];
				super(options);
				this.name = options.domain;
				this.full = options.full;
			}

			showQuery () {
				let t = this;
				return pdd.listDomainDNSRecords(this.qs).then(function (res) {
					let query = keyboard.domainPrefix + t.name + ' DNS-записи:\n';
					res.records.forEach(function (record, index) {
						if (['A', 'AAAA', 'CNAME'].includes(record.type) || t.full) {
							let cmd = '/' + index;
							query += cmd + ' `' + record.subdomain + '` ' + record.type + ' `' + record.content + '`\n';
						}
					});
					return query;
				}).catch(function (err) {
					return 'Ошибка: `' + err + '`';
				});
			}

			processText (msgText) {
				if (this.tree && this.tree.hasOwnProperty(msgText)) {
					return Promise.resolve(this.tree[msgText]);
				} else if (msgText == keyboard.backKey) {
					return Promise.resolve(new DomainStatus({
						domain: this.name,
						delegated: true
					}));
				} else if (msgText == keyboard.fullKey) {
					this.full = true;
					this._replyOptions.reply_markup.keyboard = [[keyboard.lessKey, keyboard.backKey]];
					return Promise.resolve(this);
				} else if (msgText == keyboard.lessKey) {
					this.full = false;
					this._replyOptions.reply_markup.keyboard = [[keyboard.fullKey, keyboard.backKey]];
					return Promise.resolve(this);
				} else {
					return Promise.resolve(this);
				}
			}
		}

		class Dialogue {
			constructor () {
				this._node = new ListDomains();
			}

			showQuery () {
				return this._node.showQuery();
			}

			processText (msgText) {
				let t = this;
				return this._node.processText(msgText).then(function (node) {
					t._node = node;
					return t.node;
				});
			}

			get node () {
				return this._node;
			}
		}

		return {
			create: function () {
				return new Dialogue();
			}
		};
	};
})();