// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {

		// keys

		const keys = {
			mailKey: '📯 Почта',
			domainsKey: '🗂 Домены',
			settingsKey: '⚙ Настройки',
			mailBoxesKey: '📫 Ящики',
			mailConfKey: '🗞 Рассылки',
			backKey: '⬅️ Вернуться',
			changePasswordKey: '🎁 Поменять пароль',
			addKey: '➕ Добавить',
			listKey: '📃 Список',
			removeKey: '🗑 Удалить',
			checkKey: '🔬 Проверить',
			domainPrefix: '🌍 '
		};
		const pdd = options.pdd;

		function promiseStringFn(str) {
			return function () {
				return new Promise(function (resolve, reject) {
					resolve(str);
				});
			};
		}

		// keyboards

		let layouts = {
			root: {
				reply_markup: {
					keyboard: [
						[keys.mailKey, keys.domainsKey, keys.settingsKey]
					],
					resize_keyboard: true
				},
				query: promiseStringFn('Привет! Что нужно сделать?'),
				tree: {}
			}
		};
		let justBackMarckup = {
			keyboard: [
				[keys.backKey]
			],
			resize_keyboard: true
		};
		layouts.root.tree[keys.mailKey] = {
			reply_markup: {
				keyboard: [
					[keys.mailBoxesKey, keys.mailConfKey, keys.backKey]
				],
				resize_keyboard: true
			},
			query: promiseStringFn('Что нужно сделать с почтой?'),
			tree: {}
		};
		layouts.root.tree[keys.mailKey].tree[keys.mailBoxesKey] = {
			reply_markup: {
				keyboard: [
					[keys.addKey, keys.backKey]
				],
				resize_keyboard: true
			},
			query: pdd.listMailboxesAsCommands,
			tree: {},
			mailboxLayout: function (msg, ro) {
				let markup = ro ? justBackMarckup : {
						keyboard: [
							[keys.changePasswordKey],
							[keys.removeKey, keys.backKey]
						],
						resize_keyboard: true
					};
				return {
					reply_markup: markup,
					query: promiseStringFn(msg),
					tree: {}
				};
			},
			baseTree: function () {
				let obj = {};
				obj[keys.addKey] = {
					reply_markup: justBackMarckup,
					query: promiseStringFn('Как назвать новый ящик?')
				};
				return obj;
			}
		};
		layouts.root.tree[keys.mailKey].tree[keys.mailConfKey] = {
			reply_markup: {
				keyboard: [
					[keys.addKey, keys.listKey],
					[keys.removeKey, keys.backKey]
				],
				resize_keyboard: true
			},
			query: promiseStringFn('Что нужно сделать с рассылками?'),
			tree: {}
		};
		layouts.root.tree[keys.mailKey].tree[keys.mailConfKey].tree[keys.addKey] = {
			reply_markup: justBackMarckup,
			query: promiseStringFn('Как назвать новую рассылку?')
		};

		layouts.root.tree[keys.domainsKey] = {
			reply_markup: {
				keyboard: [
					[keys.addKey, keys.backKey]
				],
				resize_keyboard: true
			},
			query: pdd.listDomainsAsCommands,
			tree: {},
			domainLayout: function (msg) {
				let markup = {
						keyboard: [
							[keys.checkKey, keys.backKey]
						],
						resize_keyboard: true
					};
				return {
					reply_markup: markup,
					query: promiseStringFn(msg),
					tree: {}
				};
			},
			baseTree: function () {
				let obj = {};
				obj[keys.addKey] = {
					reply_markup: justBackMarckup,
					query: promiseStringFn('Какой домен добавить?')
				};
				return obj;
			},
			baseKeyboard: [
							[keys.addKey, keys.backKey]
						],
			domainPrefix: keys.domainPrefix
		};

		return {
			keys: keys,
			layouts: layouts,
			justBackMarckup: justBackMarckup,
			parseTree: function (treeArr, msgTxt) {
				let resArr = [];
				let lo = treeArr.reduce(function (prev, curr) {
					if (typeof prev === 'undefined') {
						resArr = [];
						return undefined;
					} else {
						resArr.push(curr);
						return prev.tree[curr];
					}
				}, layouts.root);
				if (typeof lo === 'undefined') {
					lo = layouts.root;
				}
				if (typeof lo.tree === 'undefined' || typeof lo.tree[msgTxt] === 'undefined') {
					return {
						branch: resArr,
						layout: lo,
						action: msgTxt
					};
				} else {
					return {
						branch: resArr.concat(msgTxt),
						layout: lo.tree[msgTxt]
					};
				}
			}
		};
	};
})();