// jshint esnext: true
(function () {
	'use strict';

	exports = module.exports = function (options) {
		const request = require('request');
		const pddToken = options.config.pddToken;
		const util = require('util');

		function callAPI(options) {
			return new Promise(function (resolve, reject) {
				request({
					method: options.method || 'GET',
					url: options.url,
					headers: {
						'PddToken': pddToken
					},
					qs: options.qs,
					json: true
				}, function (err, res, body) {
					if (err) {
						reject(err.toString());
						return;
					}
					if (res.statusCode == 200) {
						if (body.success == 'ok') {
							resolve(body);
						} else {
							reject(body.error);
						}
					} else {
						reject('Статус: ' + res.statusCode);
					}
				});
			});
		}

		return {
			listDomains: function (qs) {
				return callAPI({
					url: 'https://pddimp.yandex.ru/api2/admin/domain/domains',
					qs: qs
				});
			},
			addDomain: function (qs) {
				return callAPI({
					method: 'POST',
					url: 'https://pddimp.yandex.ru/api2/admin/domain/register',
					qs: qs
				});
			},
			domainStatus: function (qs) {
				return callAPI({
					url: 'https://pddimp.yandex.ru/api2/admin/domain/registration_status',
					qs: qs
				});
			},
			listDomainDNSRecords: function (qs) {
				return callAPI({
					url: 'https://pddimp.yandex.ru/api2/admin/dns/list',
					qs: qs
				});
			},
			addDomainDNSRecord: function (qs) {
				return callAPI({
					method: 'POST',
					url: 'https://pddimp.yandex.ru/api2/admin/dns/add',
					qs: qs
				});
			},
			removeDomainDNSRecord: function (qs) {
				return callAPI({
					method: 'POST',
					url: 'https://pddimp.yandex.ru/api2/admin/dns/del',
					qs: qs
				});
			},
			listDomainMailBoxes: function (qs) {
				return callAPI({
					url: 'https://pddimp.yandex.ru/api2/admin/email/list',
					qs: qs
				});
			}
		};
	};
})();
