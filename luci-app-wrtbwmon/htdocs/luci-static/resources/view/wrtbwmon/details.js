'use strict';
'require fs';
'require rpc';
'require uci';
'require ui';
'require validation';

var cachedData = [];
var luciConfig = '/etc/luci-wrtbwmon.conf';
var hostNameFile = '/etc/wrtbwmon.user';

var callLuciDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});

var callLuciDSLStatus = rpc.declare({
	object: 'luci-rpc',
	method: 'getDSLStatus',
	expect: { '': {} }
});

function $(tid) {
	return document.getElementById(tid);
}

function clickToResetDatabase(settings) {
	if (confirm(_('This will delete the database file. Are you sure?'))) {
		getPath().then(function(res) {
			var db = settings.protocol == 'ipv4' ? res : renameFile(res, '6');
			fs.exec('/bin/rm', [db]).then(function() {
				updateData($('traffic'), $('updated'), $('updating'), settings, true);
			});
		})
	}
}

function clickToSelectInterval(settings, ev) {
	if (ev.target.value > 0) {
		settings.interval = parseInt(ev.target.value);
		if (!L.Request.poll.active()) L.Request.poll.start();
	}
	else {
		L.Request.poll.stop();
		setUpdateMessage($('updating'), -1);
	}
}

function clickToSelectProtocol(settings, ev) {
	settings.protocol = ev.target.value;
	updateData($('traffic'), $('updated'), $('updating'), settings, true);
}

function clickToShowMore(settings, ev) {
	var table = $('traffic');
	var t = table.querySelector('.tr.table-totals').firstElementChild;

	settings.showMore = ev.target.checked
	t.textContent = _('TOTAL') + (settings.showMore ? '' : ': ' + (table.childElementCount - 2));

	table.querySelectorAll('.showMore').forEach(function(e) {
		e.classList.toggle('hide');
	});

	if (!settings.showMore && table.querySelector('.th.sorted').classList.contains('hide')) {
		table.querySelector('[id="thTotal"]').click();
	}
}

function createOption(title, value, desc) {
	return E('div', {'class': 'cbi-value'}, [
		E('label', {'class': 'cbi-value-title'}, title),
		E('div', {'class': 'cbi-value-field'}, [
			E('div', {}, value),
			desc ? E('div', { 'class': 'cbi-value-description' }, desc) : ''
		])
	]);
}

function displayTable(tb, settings) {
	var elm, elmID, col, sortedBy, flag, IPVer;
	var thID = ['thClient', 'thMAC', 'thDownload', 'thUpload', 'thTotalDown', 'thTotalUp', 'thTotal', 'thFirstSeen', 'thLastSeen', ''];

	elm = tb.querySelector('.th.sorted');
	elmID = elm ? elm.id : 'thTotal';
	sortedBy = elm && elm.classList.contains('ascent') ? 'asc' : 'desc';

	col = thID.indexOf(elmID);
	IPVer = col == 0 ? settings.protocol : null;
	flag = sortedBy == 'desc' ? 1 : -1;

	cachedData[0].sort(sortTable.bind(this, col, IPVer, flag));

	//console.time('show');
	updateTable(tb, cachedData, '<em>%s</em>'.format(_('Collecting data...')), settings);
	//console.timeEnd('show');
	progressbar('downstream', cachedData[1][0], settings.downstream, settings.useBits, settings.useMultiple);
	progressbar('upstream', cachedData[1][1], settings.upstream, settings.useBits, settings.useMultiple);
}

function formatBandWidth(bdw, useBits) {
	return bdw * 1000 ** 2 / (useBits ? 1 : 8);
}

function formatSize(size, useBits, useMultiple) {
	var res = String.format('%%%s.2m%s'.format(useMultiple, (useBits ? 'bit' : 'B')), useBits ? size * 8 : size);
	return useMultiple == '1024' ? res.replace(/([KMGTPEZ])/, '$&i') : res;
}

function formatSpeed(speed, useBits, useMultiple) {
	return formatSize(speed, useBits, useMultiple) + '/s';
}

function formatDate(date) {
	var d = new Date((/\W/g).test(date) ? date : date * 1000);
	var Y = d.getFullYear(), M = d.getMonth() + 1, D = d.getDate();
	var hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();

	return '%04d/%02d/%02d %02d:%02d:%02d'.format(Y, M, D, hh, mm, ss);
}

function getDSLBandwidth(useDSL = false) {
	return callLuciDSLStatus().then(function(res) {
		if (Object.keys(res).length && useDSL) {
			return {
				upstream: res.max_data_rate_up,
				downstream: res.max_data_rate_down
			};
		}
		else {
			return {};
		}
	})
}

function getPath() {
	return uci.load('wrtbwmon').then(function() {
		var res = uci.get_first('wrtbwmon', 'wrtbwmon', 'path') || '/tmp/usage.db';
		uci.unload('wrtbwmon');
		return res;
	});
}

function handleConfig(ev) {
	ui.showModal(_('Configuration'), [
			E('p', { 'class': 'spinning' }, _('Loading configuration data...'))
	]);

	var body = [
		E('p', {}, _('Configure the default values for luci-app-wrtbwmon.')),
		E('div', {}, [
			createOption(_('Default Protocol'), E('select', {'class': 'cbi-input-select', 'name': 'protocol'}, [
				E('option', { 'value': 'ipv4', 'selected': 'selected' }, _('ipv4')),
				E('option', { 'value': 'ipv6' }, _('ipv6'))
			])),
			createOption(_('Default Refresh Interval'), E('select', {'class': 'cbi-input-select', 'name': 'interval'}, [
				E('option', { 'value': '-1' }, _('Disabled')),
				E('option', { 'value': '2' }, _('2 seconds')),
				E('option', { 'value': '5', 'selected': 'selected' }, _('5 seconds')),
				E('option', { 'value': '10' }, _('10 seconds')),
				E('option', { 'value': '30' }, _('30 seconds'))
			])),
			createOption(_('Default More Columns'), E('input', { 'type': 'checkbox', 'name': 'showMore' })),
			createOption(_('Show Zeros'), E('input', { 'type': 'checkbox', 'name': 'showZero' })),
			createOption(_('Transfer Speed in Bits'), E('input', { 'type': 'checkbox', 'name': 'useBits' })),
			createOption(_('Multiple of Unit'), E('select', { 'class': 'cbi-input-select', 'name': 'useMultiple' }, [
				E('option', { 'value': '1000', 'selected': 'selected' }, _('SI - 1000')),
				E('option', { 'value': '1024' }, _('IEC - 1024'))
			])),
			createOption(_('Use DSL Bandwidth'), E('input', { 'type': 'checkbox', 'name': 'useDSL' })),
			createOption(_('Upstream Bandwidth'), E('input', { 'type': 'text', 'name': 'upstream', 'class': 'cbi-input-text', 'value': '100' }), 'Mbps'),
			createOption(_('Downstream Bandwidth'), E('input', { 'type': 'text', 'name': 'downstream', 'class': 'cbi-input-text', 'value': '100' }), 'Mbps')
		])
	];

	parseDefaultSettings(luciConfig)
	.then(function(settings) {
		Promise.all([
			body[1].querySelectorAll('select').forEach(function(select) {
				select.value = settings[select.name] ? settings[select.name] : select.value;
			}),
			body[1].querySelectorAll('input[type=checkbox]').forEach(function(input) {
				input.checked = settings[input.name] ? 1 : 0;
			}),
			body[1].querySelectorAll('input[type=text]').forEach(function(input) {
				input.value = settings[input.name] ? settings[input.name] : input.value;
			})
		]);
	})
	.then(function() {
		body.push(E('div', { 'class': 'right' }, [
			E('div', {
				'class': 'btn cbi-button-neutral',
				'click': ui.hideModal
			}, _('Cancel')),
			' ',
			E('div', {
				'class': 'btn cbi-button-positive',
				'click': function(ev) {
					var data = {};

					findParent(ev.target, '.modal').querySelectorAll('select')
						.forEach(function(select) {
							data[select.name] = select.value;
					});

					findParent(ev.target, '.modal').querySelectorAll('input[type=checkbox]')
						.forEach(function(input) {
							data[input.name] = input.checked;
					});

					findParent(ev.target, '.modal').querySelectorAll('input[type=text]')
						.forEach(function(input) {
							data[input.name] = input.value;
					});

					ui.showModal(_('Configuration'), [
						E('p', { 'class': 'spinning' }, _('Saving configuration data...'))
					]);

					return fs.write(luciConfig, JSON.stringify(data, undefined, '\t') + '\n')
					.catch(function(err) {
						ui.addNotification(null, E('p', {}, [ _('Unable to save %s: %s').format(luciConfig, err) ]));
					})
					.then(ui.hideModal)
					.then(function() { document.location.reload(); });
				},
				'disabled': (L.hasViewPermission ? !L.hasViewPermission() : null) || null
			}, _('Save'))
		]));
		ui.showModal(_('Configuration'), body);
	})
}

function loadCss(path) {
	var head = document.head || document.getElementsByTagName('head')[0];
	var link = E('link', {
		'rel': 'stylesheet',
		'href': path,
		'type': 'text/css'
	});

	head.appendChild(link);
}

function parseDatabase(values, hosts, showZero = false) {
	var valArr = [], totals = [0, 0, 0, 0, 0], valToRows, row;

	valToRows = values.replace(/(^\s*)|(\s*$)/g, '').split(/\r?\n|\r/g);
	valToRows.shift();

	for (var i = 0; i < valToRows.length; i++) {
		row = valToRows[i].split(',');
		if (!showZero && row[7] == 0) continue;

		for (var j = 0; j < totals.length; j++) {
			totals[j] += parseInt(row[3 + j]);
		}

		row = Array.prototype.concat(row.slice(0, 2).reverse(), row.slice(3), row.slice(0, 1));
		if (row[1] in hosts && hosts[row[1]] != '-') {
			row[9] = hosts[row[1]];
		}
		valArr.push(row);
	}

	return [valArr, totals];
}

function parseDefaultSettings(file) {
	return fs.read(file).then(function(json) {
		var settings;
		try {
			settings = JSON.parse(json);
		}
		catch {
			settings = {};
		}
		return getDSLBandwidth(settings.useDSL).then(function(dsl) {
			return Object.assign(settings, dsl);
		});
	});
}

function progressbar(query, v, m, useBits, useMultiple) {
	var pg = $(query),
	    vn = v || 0,
	    mn = formatBandWidth(m, useBits) || 100,
	    fv = formatSpeed(v, useBits, useMultiple),
	    pc = '%.2f'.format((100 / mn) * vn),
	    wt = Math.floor(pc > 100 ? 100 : pc),
	    bgc = (pc >= 95 ? 'red' : (pc >= 80 ? 'darkorange' : (pc >= 60 ? 'yellow' : 'lime'))),
	    tc = (pc >= 80 ? 'white' : '#404040');
	if (pg) {
		pg.firstElementChild.style.width = wt + '%';
		pg.firstElementChild.style.background = bgc;
		pg.style.color = tc;
		pg.setAttribute('title', '%s (%f%%)'.format(fv, pc));
	}
}

function registerTableEventHandlers(settings, table) {
	var indicators = $('xhr_poll_status') || $('indicators').getElementsByTagName('span')[0];
	indicators.addEventListener('click', function() {
		$('selectInterval').value = L.Request.poll.active() ? settings.interval : -1;
	});

	table.querySelectorAll('.th').forEach(function(e) {
		if (e) {
			e.addEventListener('click', function (ev) {
				setSortedColumn(ev.target);
				displayTable(table, settings);
			});
		}
	});
}

function renameFile(str, tag) {
	var n = str.lastIndexOf('/'), fn = n > -1 ? str.slice(n + 1) : str, dir = n > -1 ? str.slice(0, n + 1) : '';
	var n = fn.lastIndexOf('.'), bn = n > -1 ? fn.slice(0, n) : fn;
	var n = fn.lastIndexOf('.'), en = n > -1 ? fn.slice(n + 1) : '';
	return dir + bn + '.' + tag + (en ? '.' + en : '');
}

function resolveCustomizedHostName() {
	return fs.stat(hostNameFile).then(function() {
		return fs.read(hostNameFile).then(function(hostNames) {
			return hostNames.split(/\r?\n|\r/g).map(function(res) {
				var data = res.split(',');
				return {
					macaddr: data[0],
					hostname: data[1]
				};
			})
		})
	}).catch(function() { return {}; });
}

function resolveHostNameByMACAddr() {
	return Promise.all([
		L.resolveDefault(resolveCustomizedHostName(), []),
		L.resolveDefault(callLuciDHCPLeases(), {})
	]).then(function(res) {
		var hostNames = {},
		    macaddr,
		    leaseNames = [
			res[0],
			Array.isArray(res[1].dhcp_leases) ? res[1].dhcp_leases : [],
			Array.isArray(res[1].dhcp6_leases) ? res[1].dhcp6_leases : []
		    ];
		for (var i = 0; i < leaseNames.length; i++) {
			for (var j = 0; j < leaseNames[i].length; j++) {
				macaddr = leaseNames[i][j].macaddr.toLowerCase();
				if (!(macaddr in hostNames) || hostNames[macaddr] == '-') {
					hostNames[macaddr] = leaseNames[i][j].hostname || '-';
				}
			}
		}
		return hostNames;
	});
}

function setSortedColumn(sorting) {
	var sorted = document.querySelector('.th.sorted') || $('thTotal');

	if (sorting.isSameNode(sorted)) {
		sorting.classList.toggle('ascent');
	}
	else {
		sorting.classList.add('sorted');
		sorted.classList.remove('sorted', 'ascent');
	}
}

function setUpdateMessage(e, sec) {
	e.innerHTML = sec < 0 ? '' : ' ' + _('Updating again in %s second(s).').format('<b>' + sec + '</b>');
}

function sortTable(col, IPVer, flag, x, y) {
	var byCol = x[col] == y[col] ? 1 : col;
	var a = x[byCol], b = y[byCol];

	if (!IPVer || byCol != 0) {
		if (!(a.match(/\D/g) || b.match(/\D/g)))
			a = parseInt(a), b = parseInt(b);
	}
	else {
		IPVer == 'ipv4'
		? (a = validation.parseIPv4(a) || [0, 0, 0, 0], b = validation.parseIPv4(b) || [0, 0, 0, 0])
		: (a = validation.parseIPv6(a) || [0, 0, 0, 0, 0, 0, 0, 0], b = validation.parseIPv6(b) || [0, 0, 0, 0, 0, 0, 0, 0]);
	}

	if(Array.isArray(a) && Array.isArray(b)) {
		for(var i = 0; i < a.length; i++) {
			if (a[i] != b[i]) {
				return (b[i] - a[i]) * flag;
			}
		}
		return 0;
	}

	return a ==b ? 0 : (a < b ? 1 : -1) * flag;
}

function updateData(table, updated, updating, settings, once = false) {
	if (!(L.Poll.tick % settings.interval) || once) {
		getPath().then(function(res) {
			var params = settings.protocol == 'ipv4' ? '-4' : '-6';
			fs.exec('/usr/sbin/wrtbwmon', [params, '-f', res]);
			return params == '-4' ? res : renameFile(res, '6');
		}).then(function(data) {
			Promise.all([
				fs.exec('/bin/cat', [ data ]),
				resolveHostNameByMACAddr()
			]).then(function(res) {
				//console.time('start');
				cachedData = parseDatabase(res[0].stdout || '', res[1], settings.showZero);
				displayTable(table, settings);
				updated.innerHTML = _('Last updated at %s.').format(formatDate(Math.round(Date.now() / 1000)));
				//console.timeEnd('start');
			});
		});
	}
	updatePerSec(updating, settings.interval);
}

function updatePerSec(e, interval) {
	var tick = L.Poll.tick;
	var sec = tick % interval ? interval - tick % interval : 0;

	setUpdateMessage(e, sec);
	if(sec == 0) {
		setTimeout(setUpdateMessage.bind(this, e, interval), 100);
	}
}

function updateTable(tb, values, placeholder, settings) {
	var doc = document, df = doc.createDocumentFragment(), nodeLen = tb.childElementCount - 2;
	var tbData = values[0], shadowNode, newNode, childTD, tabTitle = tb.firstElementChild;
	var showMore = settings.showMore;

	// Create the shadow node, which will be used in the following.
	if (tbData.length > nodeLen) {
		if (tb.childElementCount > 2) {
			shadowNode = tabTitle.nextElementSibling.cloneNode(true);
		}
		else {
			shadowNode = doc.createElement('div');
			childTD = doc.createElement('div');
			childTD.appendChild(doc.createTextNode(''));
			for (var j = 0; j < tabTitle.children.length; j++) {
				childTD.className = 'td' + ('178'.indexOf(j) != -1 ? ' showMore' + (showMore ? '' : ' hide') : '');
				childTD.setAttribute('data-title', tabTitle.children[j].textContent);
				shadowNode.appendChild(childTD.cloneNode(true));
			}
		}
	}

	// Update the table data.
	for (var i = 0; i < tbData.length; i++) {
		if (i < nodeLen) {
			newNode = tabTitle.nextElementSibling;
		}
		else {
			newNode = shadowNode.cloneNode(true);
			newNode.className = 'tr cbi-rowstyle-%d'.format(i % 2 ? 2 : 1);
		}

		childTD = newNode.firstElementChild;
		childTD.title = tbData[i].slice(-1);
		for (var j = 0; j < tabTitle.childElementCount; j++, childTD = childTD.nextElementSibling){
			switch (j) {
				case 2:
				case 3:
					childTD.textContent = formatSpeed(tbData[i][j], settings.useBits, settings.useMultiple);
					break;
				case 4:
				case 5:
				case 6:
					childTD.textContent = formatSize(tbData[i][j], settings.useBits, settings.useMultiple);
					break;
				case 7:
				case 8:
					childTD.textContent = formatDate(tbData[i][j]);
					break;
				default:
					childTD.textContent = tbData[i][j];
			}
		}
		df.appendChild(newNode);
	}

	// Remove the table data which has been deleted from the database.
	while (tb.childElementCount > 2) {
		tb.removeChild(tabTitle.nextElementSibling);
	}

	//Append the totals or placeholder row.
	df.appendChild(tb.lastElementChild);
	newNode = df.lastElementChild;
	if (newNode.classList.contains('table-totals')) {
		if (tbData.length == 0) {
			while (newNode.firstElementChild.firstChild.nextSibling) {
				newNode.removeChild(newNode.lastElementChild);
			};
			newNode.className = 'tr placeholder';
			newNode.firstChild.innerHTML = placeholder;
		}
	}
	else {
		if (tbData.length > 0) {
			df.replaceChild(shadowNode.cloneNode(true), newNode);
			newNode = df.lastElementChild;
			newNode.className = 'tr table-totals';

			while (newNode.firstElementChild.firstChild.nextSibling) {
				newNode.firstElementChild.removeChild(newNode.firstElementChild.lastChild);
			};
			newNode.firstElementChild.style.fontWeight = 'bold';
			newNode.firstElementChild.nextSibling.style.fontWeight = 'bold';
		}
	}

	if (newNode.classList.contains('table-totals')) {
		newNode.firstElementChild.textContent = _('TOTAL') + (showMore ? '' : ': ' + tbData.length);
		newNode.firstElementChild.nextSibling.textContent = tbData.length + ' ' + _('Clients');

		for (var j = 0; j < values[1].length; j++) {
			newNode.children[j + 2].textContent = j < 2
				? formatSpeed(values[1][j], settings.useBits, settings.useMultiple)
				: formatSize(values[1][j], settings.useBits, settings.useMultiple);
		}
	}

	tb.appendChild(df);
}

return L.view.extend({
	load: function() {
		return Promise.all([
			parseDefaultSettings(luciConfig),
			loadCss(L.resource('view/wrtbwmon/wrtbwmon.css'))
		]);
	},

	render: function(data) {
		var settings = data[0];
		var node = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Usage - Details')),
			E('div', { 'id': 'control_panel' }, [
				E('div', {}, [
					E('label', {}, _('Protocol:')),
					E('select', {
						'id': 'selectProtocol',
						'change': clickToSelectProtocol.bind(this, settings)
						}, [
						E('option', { 'value': 'ipv4' }, 'ipv4'),
						E('option', { 'value': 'ipv6' }, 'ipv6')
					])
				]),
				E('div', {}, [
					E('label', { 'for': 'showMore' }, _('Show More Columns:')),
					E('input', {
						'id': 'showMore',
						'type': 'checkbox',
						'click': clickToShowMore.bind(this, settings)
					}),
				]),
				E('div', {}, [
					E('button', {
						'class': 'btn cbi-button cbi-button-reset important',
						'id': 'resetDatabase',
						'click': clickToResetDatabase.bind(this, settings)
					}, _('Reset Database')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-neutral',
						'click': handleConfig
					}, _('Configure Options'))
				])
			]),
			E('div', {}, [
				E('div', {}, [
					E('div', { 'id': 'updated' }),
					E('div', { 'id': 'updating' })
				]),
				E('div', {}, [
					E('label', { 'for': 'selectInterval' }, _('Auto update every:')),
					E('select', {
						'id': 'selectInterval',
						'change': clickToSelectInterval.bind(this, settings)
						}, [
						E('option', { 'value': '-1' }, _('Disabled')),
						E('option', { 'value': '2' }, _('2 seconds')),
						E('option', { 'value': '5' }, _('5 seconds')),
						E('option', { 'value': '10' }, _('10 seconds')),
						E('option', { 'value': '30' }, _('30 seconds'))
					])
				])
			]),
			E('div', { 'id': 'progressbar_panel', 'class': 'table' }, [
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td' }, E('div', {}, _('Downstream:'))),
					E('div', { 'class': 'td' }, E('div', {
						'id': 'downstream',
						'class': 'cbi-progressbar',
						'title': '-'
						}, E('div')
					))
				]),
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td' }, E('div', {}, _('Upstream:'))),
					E('div', { 'class': 'td' }, E('div', {
						'id': 'upstream',
						'class': 'cbi-progressbar',
						'title': '-'
						}, E('div')
					))
				]),
			]),
			E('div', { 'class': 'table', 'id': 'traffic' }, [
				E('div', { 'class': 'tr table-titles' }, [
					E('div', { 'class': 'th', 'id': 'thClient' }, _('Clients')),
					E('div', { 'class': 'th showMore hide', 'id': 'thMAC' }, _('MAC')),
					E('div', { 'class': 'th', 'id': 'thDownload' }, _('Download')),
					E('div', { 'class': 'th', 'id': 'thUpload' }, _('Upload')),
					E('div', { 'class': 'th', 'id': 'thTotalDown' }, _('Total Down')),
					E('div', { 'class': 'th', 'id': 'thTotalUp' }, _('Total Up')),
					E('div', { 'class': 'th sorted', 'id': 'thTotal' }, _('Total')),
					E('div', { 'class': 'th showMore hide', 'id': 'thFirstSeen' }, _('First Seen')),
					E('div', { 'class': 'th showMore hide', 'id': 'thLastSeen' }, _('Last Seen'))
				]),
				E('div', {'class': 'tr placeholder'}, [
					E('div', { 'class': 'td' }, E('em', {}, _('Collecting data...')))
				])
			])
		]);

		return Promise.all([
			node.querySelector('[id="traffic"]'),
			node.querySelector('[id="updated"]'),
			node.querySelector('[id="updating"]'),
			node.querySelector('[id="selectInterval"]').value = settings.interval,
			node.querySelector('[id="selectProtocol"]').value = settings.protocol,
			node.querySelector('[id="showMore"]').checked = settings.showMore,
			node.querySelectorAll('.showMore').forEach(function(e) { e.classList.toggle('hide', !settings.showMore); })
		])
		.then(function(data) {
			L.Poll.add(updateData.bind(this, data[0], data[1], data[2], settings, false), 1);
			return data[0];
		})
		.then(registerTableEventHandlers.bind(this, settings))
		.then(function() { return node; });
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
