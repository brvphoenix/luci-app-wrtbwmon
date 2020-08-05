'use strict';
'require fs';
'require rpc';
'require uci';
'require ui';
'require validation';

var cachedData = [];
var settings = {};
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

function createOption(title, value, desc) {
	return E('div', {'class': 'cbi-value'}, [
		E('label', {'class': 'cbi-value-title'}, title),
		E('div', {'class': 'cbi-value-field'}, [
			E('div', {}, value),
			desc ? E('div', { 'class': 'cbi-value-description' }, desc) : ''
		])
	]);
}

function displayTable(tb, sp) {
	var e, elmID, col, sortedBy, flag, IPVer;
	var thID = ['', 'thMAC', 'thDownload', 'thUpload', 'thTotalDown', 'thTotalUp', 'thTotal', 'thFirstSeen', 'thLastSeen', 'thClient'];

	e = tb.querySelector('.th.sorted');
	elmID = e ? e.id : 'thTotal';
	sortedBy = e && e.classList.contains('ascent') ? 'asc' : 'desc';

	col = thID.indexOf(elmID);
	IPVer = col == 9 ? sp.value : null;
	flag = sortedBy == 'desc' ? 1 : -1;

	cachedData[0].sort(sortTable.bind(this, col, IPVer, flag));

	//console.time('show');
	updateTable(tb, cachedData, '<em>%s</em>'.format(_('Collecting data...')));
	//console.timeEnd('show');
	progressbar('downstream', cachedData[1][0], settings.downstream);
	progressbar('upstream', cachedData[1][1], settings.upstream);
}

function formatBandWidth(bdw) {
	return bdw * 1000 ** 2 / (settings.useBits ? 1 : 8);
}

function formatSize(size) {
	var res = String.format('%' + settings.useMultiple + '.2m' + (settings.useBits ? 'bit' : 'B'), settings.useBits ? size * 8 : size);
	return settings.useMultiple == '1024' ? res.replace(/([KMGTPEZ])/, '$&i') : res;
}

function formatSpeed(speed) {
	return formatSize(speed) + '/s';
}

function formatDate(date) {
	var d = new Date((/\W/g).test(date) ? date : date * 1000);
	var Y = d.getFullYear(), M = d.getMonth() + 1, D = d.getDate();
	var hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();
	return Y + '/' + padStr(M) + '/' + padStr(D) + ' ' + padStr(hh) + ':' + padStr(mm) + ':' + padStr(ss);
}

function getDSLBandwidth() {
	callLuciDSLStatus().then(function(res) {
		if (Object.keys(res).length) {
			settings.upstream = res.max_data_rate_up;
			settings.downstream = res.max_data_rate_down;
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

	Promise.all([
		body[1].querySelectorAll('select')
			.forEach(function(select) {
				select.value = settings[select.name] ? settings[select.name] : select.value;
		}),
		body[1].querySelectorAll('input[type=checkbox]')
			.forEach(function(input) {
				input.checked = settings[input.name] ? 1 : 0;
		}),
		body[1].querySelectorAll('input[type=text]')
			.forEach(function(input) {
				input.value = settings[input.name] ? settings[input.name] : input.value;
		})
	])
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

					return fs.write(luciConfig, JSON.stringify(data, undefined, '\t')).catch(function(err) {
						ui.addNotification(null, E('p', {}, [ _('Unable to save %s: %s').format(luciConfig, err) ]));
					})
					.then(ui.hideModal)
					.then(function() {document.location.reload();});
				},
				'disabled': !L.hasViewPermission() || null
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

function padStr(str) {
	return str < 10 ? '0' + str : str;
}

function parseDatabase(values, hosts) {
	var valArr = [], totals = [0, 0, 0, 0, 0], valToRows, row;

	valToRows = values.replace(/(^\s*)|(\s*$)/g, '').split(/\r?\n|\r/g);
	valToRows.shift();

	for (var i = 0; i < valToRows.length; i++) {
		row = valToRows[i].split(',');
		if (!(settings.showZero) && row[7] == 0) continue;

		for (var j = 0; j < totals.length; j++) {
			totals[j] += parseInt(row[3 + j]);
		}

		row.copyWithin(2, 3).copyWithin(9, 1, 2).copyWithin(1, 0, 1);
		if (row[1] in hosts && hosts[row[1]] != '-') {
			row[0] = hosts[row[1]];
		}
		valArr.push(row);
	}

	return [valArr, totals];
}

function parseDefaultSettings(file) {
	return fs.trimmed(file).then(function(json) {
		try {
			settings = JSON.parse(json);
		}
		catch {
			settings = {};
		};
		return settings;
	});
}

function progressbar(query, v, m) {
	var pg = $(query),
	    vn = v || 0,
	    mn = formatBandWidth(m) || 100,
	    fv = formatSpeed(v),
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

function registerTableEventHandlers(table, si, sp, sm) {
	var indicators = $('xhr_poll_status') || $('indicators').getElementsByTagName('span')[0];
	indicators.addEventListener('click', function() {
		si.value = L.Request.poll.active() ? L.Poll.queue[0].i : -1;
	});

	table.querySelectorAll('.th').forEach( function(e) {
		if (e) {
			e.addEventListener('click', function (ev) {
				setSortedColumn(ev.target);
				displayTable(table, sp);
			});
		}
	});

	si.addEventListener('change', function () {
		if (this.value > 0) {
			L.Poll.queue[0].i = parseInt(this.value);
			if (!L.Request.poll.active()) L.Request.poll.start();
		}
		else {
			L.Request.poll.stop();
			setUpdateMessage($('updating'), -1);
		}
	});

	$('resetDatabase').addEventListener('click', function () {
		if (confirm(_('This will delete the database file. Are you sure?'))) {
			getPath().then(function(res) {
				var db = sp.value == 'ipv4' ? res : renameFile(res, '6');
				fs.exec('/bin/rm', [db]).then(function() {
					document.location.reload();
				})
			})
		}
	});

	sm.addEventListener('click', function () {
		var t = table.querySelector('.tr.table-totals').firstElementChild;
		var showMore = this.checked;

		t.textContent = _('TOTAL') + (showMore ? '' : ': ' + (table.childElementCount - 2));
		t.nextElementSibling.textContent = showMore ? '%s %s'.format((table.childElementCount - 2), _('Clients')) : '';

		table.querySelectorAll('.showMore').forEach(function(e) {
			e.classList.toggle('hide');
		});

		if (!showMore && table.querySelector('.th.sorted').classList.contains('hide')) {
			$('thTotal').click();
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
	return L.resolveDefault(fs.trimmed(hostNameFile), []).then(function(hostNames) {
		return hostNames.split(/\r?\n|\r/g).map(function(res) {
			var data = res.split(',');
			return {
				macaddr: data[0],
				hostname: data[1]
			};
		})
	})
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

function setSortedColumn(sorted) {
	var e = document.querySelector('.th.sorted') || $('thTotal');

	if (sorted.isSameNode(e)) {
		e.classList.toggle('ascent');
	}
	else {
		sorted.classList.add('sorted');
		e.classList.remove('sorted', 'ascent');
	}
}

function setUpdateMessage(e, sec) {
	e.innerHTML = sec < 0 ? '' : ' ' + _('Updating again in %s second(s).').format('<b>' + sec + '</b>');
}

function sortTable(col, IPVer, flag, x, y) {
	var byCol = x[col] == y[col] ? 1 : col;
	var a = x[byCol], b = y[byCol];

	if (!IPVer || byCol != 9) {
		if (!(a.match(/\D/g) || b.match(/\D/g)))
			a = parseInt(a), b = parseInt(b);
	}
	else {
		IPVer == 'ipv4'
		? (a = validation.parseIPv4(a) || [0, 0, 0, 0], b = validation.parseIPv4(b) || [0, 0, 0, 0])
		: (a = validation.parseIPv6(a) || [0, 0, 0, 0, 0, 0, 0, 0], b = validation.parseIPv6(b) || [0, 0, 0, 0, 0, 0, 0, 0]);
	}

	return (a < b ? 1 : -1) * flag;
}

function updateData(table, sp, up) {
	//console.time('start');
	getPath().then(function(res) {
		var params, data;
		if (sp.value == 'ipv4'){
			params = '-4';
			data = res;
		}
		else {
			params = '-6';
			data = renameFile(res, '6');
		}
		fs.exec('/usr/sbin/wrtbwmon', [params, '-f', res]);
		return data;
	}).then(function(data) {
		Promise.all([
			fs.exec('/bin/cat', [ data ]),
			L.resolveDefault(resolveHostNameByMACAddr(), {})
		]).then(function(res) {
				cachedData = parseDatabase(res[0].stdout || '', res[1]);
				displayTable(table, sp);
				up.innerHTML = _('Last updated at %s.').format(formatDate(Math.round(Date.now() / 1000)));
		});
	});
	//console.timeEnd('start');
}

function updatePerSec(e) {
	var tick = L.Poll.tick, interval = L.Poll.queue[0].i;
	var sec = tick % interval ? interval - tick % interval : 0;

	setUpdateMessage(e, sec);
	if(sec == 0) {
		setTimeout(setUpdateMessage.bind(this, e, interval), 100);
	}
}

function updateTable(tb, values, placeholder) {
	var doc = document, dom = doc.createDocumentFragment(), nodeLen = tb.childElementCount - 2;
	var tbData = values[0], shadowNode, newNode, childTD, tabTitle = tb.firstElementChild;
	var showMore = $('showMore').checked;

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
				childTD.setAttribute('data-title', tabTitle.children[j].innerHTML);
				shadowNode.appendChild(childTD.cloneNode(true));
			}
			shadowNode.firstElementChild.appendChild(doc.createElement('br'));
			shadowNode.firstElementChild.appendChild(doc.createTextNode(''));
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
		childTD.title = tbData[i][1];
		childTD.lastChild.nodeValue = tbData[i].slice(-1);
		for (var j = 0; j < tabTitle.childElementCount; j++, childTD = childTD.nextElementSibling){
			switch (j) {
				case 2:
				case 3:
					childTD.textContent = formatSpeed(tbData[i][j]);
					break;
				case 4:
				case 5:
				case 6:
					childTD.textContent = formatSize(tbData[i][j]);
					break;
				case 7:
				case 8:
					childTD.textContent = formatDate(tbData[i][j]);
					break;
				default:
					childTD.firstChild.nodeValue = tbData[i][j];
			}
		}
		dom.appendChild(newNode);
	}

	// Remove the table data which has been deleted from the database.
	while (tb.childElementCount > 2) {
		tb.removeChild(tabTitle.nextElementSibling);
	}

	//Append the totals or placeholder row.
	dom.appendChild(tb.lastElementChild);
	newNode = dom.lastElementChild;
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
			dom.replaceChild(shadowNode.cloneNode(true), newNode);
			newNode = dom.lastElementChild;
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
		newNode.firstElementChild.nextSibling.textContent = (!showMore ? '' : tbData.length + ' ') + _('Clients');

		for (var j = 0; j < values[1].length; j++) {
			newNode.children[j + 2].textContent = j < 2 ? formatSpeed(values[1][j]) : formatSize(values[1][j]);
		}
	}

	tb.appendChild(dom);
}

return L.view.extend({
	load: function() {
		return Promise.all([
			parseDefaultSettings(luciConfig),
			loadCss(L.resource('view/wrtbwmon/wrtbwmon.css'))
		]);
	},

	render: function() {
		var node = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Usage - Details')),
			E('div', { 'id': 'control_panel' }, [
				E('div', {}, [
					E('label', {}, _('Protocol:')),
					E('select', { 'id': 'selectProtocol' }, [
						E('option', { 'value': 'ipv4' }, 'ipv4'),
						E('option', { 'value': 'ipv6' }, 'ipv6')
					])
				]),
				E('div', {}, [
					E('label', { 'for': 'showMore' }, _('Show More Columns:')),
					E('input', { 'id': 'showMore', 'type': 'checkbox' }),
				]),
				E('div', {}, [
					E('button', {
						'class': 'btn cbi-button cbi-button-reset important',
						'id': 'resetDatabase'
					}, _('Reset Database')),
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
					E('select', { 'id': 'selectInterval' }, [
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

		Promise.all([
			node.querySelector('[id="traffic"]'),
			node.querySelector('[id="selectInterval"]'),
			node.querySelector('[id="selectProtocol"]'),
			node.querySelector('[id="showMore"]'),
			node.querySelectorAll('.showMore'),
			node.querySelector('[id="updated"]'),
			node.querySelector('[id="updating"]'),
			settings.useDSL ? getDSLBandwidth() : true
		]).then(function(data) {
			data[1].value = settings.interval;
			data[2].value = settings.protocol;
			data[3].checked = settings.showMore ? 1 : 0;

			Promise.all([
				L.Poll.add(updateData.bind(this, data[0], data[2], data[5]), settings.interval),
				L.Poll.add(updatePerSec.bind(this, data[6]), 1),
				data[4].forEach(function(e) { e.classList.toggle('hide', !settings.showMore); })
			]).then(registerTableEventHandlers.bind(this, data[0], data[1], data[2], data[3]));
		})

		return node;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

