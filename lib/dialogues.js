// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const keyboard = options.keyboard;
		const pdd = options.pdd;
		const util = require('util');

		class Node {
			static get KEYBOARD_WITH_BACK_ONLY () {
				return [[keyboard.backKey]];
			}

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
				const t = this;
				return pdd.listDomains(this.qs).then(function (res) {
					let query = '';
					t.tree = {};
					res.domains.forEach(function (domain, index) {
						const cmd = '/' + index;
						const delegated = (domain.nsdelegated === true || domain.nsdelegated == 'yes');
						t.tree[cmd] = new DomainStatus({
							domain: domain.name,
							delegated: delegated
						});
						query += cmd + '  ' + domain.name + (delegated ? keyboard.domainDelegatedSuffix : '') + '\n';
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
				options.keyboard = AddDomain.KEYBOARD_WITH_BACK_ONLY;
				super(options);
			}

			showQuery () {
				let query = this.error ? 'Ошибка: `' + this.error + '`\n' : '';
				this.error = null;
				query += 'Какой домен добавить?';

				return Promise.resolve(query);
			}

			processText (msgText) {
				if (msgText == keyboard.backKey) {
					return Promise.resolve(new ListDomains());
				} else {
					const t = this;
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
			static get KEYBOARD_WITH_CHECK () {
				return [[keyboard.checkKey, keyboard.backKey]];
			}

			static get KEYBOARD_WITH_DNS () {
				return [[keyboard.mailBoxesKey, keyboard.dnsKey, keyboard.backKey]];
			}

			static get KEYBOARD_WITHOUT_DNS () {
				return [[keyboard.mailBoxesKey, keyboard.backKey]];
			}

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
				const t = this;
				return pdd.domainStatus(this.qs).then(function (res) {
					let query = keyboard.domainPrefix + t.name + '\n\n';
					switch (res.status) {
						case 'domain-activate':
							query += 'Владение доменом не подтверждено: `' + res.check_results + '`. Чтобы подтведить:\n';
							query += '🕷 Загрузить в корневой каталог сайта файл с именем `' + res.secrets.name + '.html` и содержащий текст `' + res.secrets.content + '`\n';
							query += '🕷 Для поддомена `yamail-' + res.secrets.name + '` настроить CNAME-запись на `mail.yandex.ru`\n';
							query += '🕷 Указать адрес `' + res.secrets.name + '@yandex.ru` в качестве контактного адреса для домена (https://yandex.ru/support/pdd/setting/confirm.xml#way3)';
							t.replyOptions.reply_markup.keyboard = DomainStatus.KEYBOARD_WITH_CHECK;
							break;
						case 'mx-activate':
							query += 'Владение доменом подтверждено. Чтобы настроить почту:\n';
							query += '🕷 Для поддомена `@` настроить MX-запись с приоритетом 10 на `mx.yandex.net.` (с точкой в конце)\n';
							query += '🕷 Делегировать домен на Яндекс (https://yandex.ru/support/pdd/domain/dns.xml)';
							t.replyOptions.reply_markup.keyboard = DomainStatus.KEYBOARD_WITH_CHECK;
							break;
						case 'added':
							query += 'Домен настроен' + (t.delegated ? ' и делегирован на Яндекс' : '') + '.';
							t.replyOptions.reply_markup.keyboard = t.delegated ? DomainStatus.KEYBOARD_WITH_DNS : DomainStatus.KEYBOARD_WITHOUT_DNS;
							break;
						default:
							query += 'Неизвестный статус `' + res.status + '`';
							t.replyOptions.reply_markup.keyboard = DomainStatus.KEYBOARD_WITH_BACK_ONLY;
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
						if (this.delegated) {
							return Promise.resolve(new ListDomainDNSRecords({
								domain: this.name
							}));
						}
						return Promise.resolve(this);
					case keyboard.mailBoxesKey:
						return Promise.resolve(new ListDomainMailBoxes({
							domain: this.name,
							delegated: this.delegated
						}));
					default:
						return Promise.resolve(this);
				}
			}
		}

		class ListDomainDNSRecords extends Node {
			static get KEYBOARD_WITH_LESS () {
				return [[keyboard.addKey, keyboard.fullKey, keyboard.backKey]];
			}

			static get KEYBOARD_WITH_FULL () {
				return [[keyboard.addKey, keyboard.lessKey, keyboard.backKey]];
			}

			constructor (options) {
				options = options || {};
				options.qs = {
					domain: options.domain
				};
				options.keyboard = ListDomainDNSRecords.KEYBOARD_WITH_LESS;
				super(options);
				this.name = options.domain;
				this.full = options.full;
			}

			showQuery () {
				const t = this;
				return pdd.listDomainDNSRecords(this.qs).then(function (res) {
					let query = keyboard.domainPrefix + t.name + ' DNS-записи:\n\n';
					t.tree = {};
					res.records.forEach(function (record, index) {
						if (AddDomainDNSRecord.LESS_VIEW_TYPES.includes(record.type) || t.full) {
							const cmd = '/' + index;
							const recordStr = '`' + record.subdomain + '`  ' + record.type + '  `' + record.content + '`';
							query += cmd + '  ' + recordStr + '\n';
							t.tree[cmd] = new ShowDomainDNSRecord({
								domain: t.name,
								recordId: record.record_id,
								recordStr: recordStr
							});
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
					this._replyOptions.reply_markup.keyboard = ListDomainDNSRecords.KEYBOARD_WITH_FULL;
					return Promise.resolve(this);
				} else if (msgText == keyboard.lessKey) {
					this.full = false;
					this._replyOptions.reply_markup.keyboard = ListDomainDNSRecords.KEYBOARD_WITH_LESS;
					return Promise.resolve(this);
				} else if (msgText == keyboard.addKey) {
					return Promise.resolve(new AddDomainDNSRecord({
						domain: this.name
					}));
				} else {
					return Promise.resolve(this);
				}
			}
		}

		class AddDomainDNSRecord extends Node {
			static get TYPE_A () {
				return 'A';
			}

			static get TYPE_CNAME () {
				return 'CNAME';
			}

			static get TYPE_TXT () {
				return 'TXT';
			}

			static get TYPE_AAAA () {
				return 'AAAA';
			}

			static get TYPE_NS () {
				return 'NS';
			}

			static get AVAILABLE_TYPES () {
				return [AddDomainDNSRecord.TYPE_A, AddDomainDNSRecord.TYPE_CNAME, AddDomainDNSRecord.TYPE_TXT, AddDomainDNSRecord.TYPE_AAAA, AddDomainDNSRecord.TYPE_NS];
			}

			static get LESS_VIEW_TYPES () {
				return [AddDomainDNSRecord.TYPE_A, AddDomainDNSRecord.TYPE_CNAME, AddDomainDNSRecord.TYPE_AAAA];
			}

			static get KEYBOARD_WITH_TYPES () {
				return [[AddDomainDNSRecord.TYPE_A, AddDomainDNSRecord.TYPE_CNAME, AddDomainDNSRecord.TYPE_TXT],
						[AddDomainDNSRecord.TYPE_AAAA, AddDomainDNSRecord.TYPE_NS, keyboard.backKey]];
			}

			static get STAGE_1_GET_TYPE () {
				return 'get_type';
			}

			static get STAGE_2_GET_NAME () {
				return 'get_name';
			}

			static get STAGE_3_GET_VALUE () {
				return 'get_value';
			}

			constructor (options) {
				options = options || {};
				options.qs = {
					domain: options.domain
				};
				super(options);
				this.name = options.domain;
				this.stage = AddDomainDNSRecord.STAGE_1_GET_TYPE;
			}

			showQuery () {
				let query = this.error ? 'Ошибка: `' + this.error + '`\n' : '';
				this.error = null;
				switch (this.stage) {
					case AddDomainDNSRecord.STAGE_1_GET_TYPE :
						this.replyOptions.reply_markup.keyboard = AddDomainDNSRecord.KEYBOARD_WITH_TYPES;
						query += 'Какого типа запись добавить?';
						break;
					case AddDomainDNSRecord.STAGE_2_GET_NAME :
						this.replyOptions.reply_markup.keyboard = AddDomainDNSRecord.KEYBOARD_WITH_BACK_ONLY;
						query += 'Запись типа `' + this.recordType + '`. Какое имя хоста?';
						break;
					case AddDomainDNSRecord.STAGE_3_GET_VALUE :
						this.replyOptions.reply_markup.keyboard = AddDomainDNSRecord.KEYBOARD_WITH_BACK_ONLY;
						query += 'Запись типа `' + this.recordType + '`. Хост `' + this.recordSubdomain + '` Какое значение записи?';
						break;
					default :
						this.replyOptions.reply_markup.keyboard = AddDomainDNSRecord.KEYBOARD_WITH_BACK_ONLY;
						query += 'Неизвестное состояние диалога!';
				}
				return Promise.resolve(query);
			}

			processText (msgText) {
				switch (this.stage) {
					case AddDomainDNSRecord.STAGE_1_GET_TYPE :
						if (AddDomainDNSRecord.AVAILABLE_TYPES.includes(msgText)) {
							this.recordType = msgText;
							this.stage = AddDomainDNSRecord.STAGE_2_GET_NAME;
							return Promise.resolve(this);
						} else if (msgText == keyboard.backKey) {
							return Promise.resolve(new ListDomainDNSRecords({
								domain: this.name
							}));
						}
						this.error = 'Тип записи не поддерживается';
						return Promise.resolve(this);
					case AddDomainDNSRecord.STAGE_2_GET_NAME :
						if (msgText == keyboard.backKey) {
							this.stage = AddDomainDNSRecord.STAGE_1_GET_TYPE;
							return Promise.resolve(this);
						}
						this.recordSubdomain = msgText;
						this.stage = AddDomainDNSRecord.STAGE_3_GET_VALUE;
						return Promise.resolve(this);
					case AddDomainDNSRecord.STAGE_3_GET_VALUE :
						if (msgText == keyboard.backKey) {
							this.stage = AddDomainDNSRecord.STAGE_2_GET_NAME;
							return Promise.resolve(this);
						}
						this.qs.type = this.recordType;
						this.qs.subdomain = this.recordSubdomain;
						this.qs.content = msgText;
						const t = this;
						return pdd.addDomainDNSRecord(this.qs).then(function () {
							return new ListDomainDNSRecords({
								domain: t.name
							});
						}).catch(function (err) {
							t.error = err;
							t.stage = AddDomainDNSRecord.STAGE_1_GET_TYPE;
							return t;
						});
					default :
						this.stage = AddDomainDNSRecord.STAGE_1_GET_TYPE;
						return Promise.resolve(this);
				}
			}
		}

		class ShowDomainDNSRecord extends Node {
			constructor (options) {
				options = options || {};
				options.qs = {
					domain: options.domain,
					record_id: options.recordId
				};
				options.keyboard = [[keyboard.removeKey, keyboard.backKey]];
				super(options);
				this.name = options.domain;
				this.id = options.recordId;
				this.query = 'Запись  ' + options.recordStr;
			}

			showQuery () {
				let query = this.error ? 'Ошибка: `' + this.error + '`\n' : '';
				this.error = null;
				return Promise.resolve(query + this.query);
			}

			processText (msgText) {
				if (msgText == keyboard.backKey) {
					return Promise.resolve(new ListDomainDNSRecords({
						domain: this.name
					}));
				} else if (msgText == keyboard.removeKey) {
					const t = this;
					return pdd.removeDomainDNSRecord(this.qs).then(function () {
						return new ListDomainDNSRecords({
							domain: t.name
						});
					}).catch(function (err) {
						t.error = err;
						return t;
					});
				}
				return Promise.resolve(this);
			}
		}

		class ListDomainMailBoxes extends Node {
			constructor (options) {
				options = options || {};
				options.qs = {
					domain: options.domain,
					page: 1,
					on_page: 200
				};
				options.keyboard = ListDomainMailBoxes.KEYBOARD_WITH_BACK_ONLY;
				super(options);
				this.name = options.domain;
				this.delegated = options.delegated;
			}

			showQuery () {
				const t = this;
				return pdd.listDomainMailBoxes(this.qs).then(function (res) {
					let boxes = 'Ящики:\n';
					let lists = 'Рассылки:\n';
					let hasLists = false;
					if (!res.accounts || res.accounts.length === 0) {
						return keyboard.domainPrefix + t.name + ' не содержит почтовых ящиков.';
					}
					res.accounts.forEach(function (account, index) {
						if (account.maillist === true || account.maillist == 'yes') {
							lists += account.login + '\n';
							hasLists = true;
						} else {
							boxes += account.login + '  ';
							if (account.ready === true || account.ready == 'yes') {
								boxes += account.fio + '\n';
							} else {
								boxes += keyboard.notReadyLabel + '\n';
							}
							if (account.aliases && account.aliases.length > 0) {
								boxes += '    {' + account.aliases.join(', ') + '}\n';
							}
						}
					});
					return keyboard.domainPrefix + t.name + '\n\n' + boxes + (hasLists ? '\n' + lists : '');
				}).catch(function (err) {
					return 'Ошибка: `' + err + '`';
				});
			}

			processText (msgText) {
				if (msgText == keyboard.backKey) {
					return Promise.resolve(new DomainStatus({
						domain: this.name,
						delegated: this.delegated
					}));
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
				const t = this;
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