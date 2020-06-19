'use strict';
'require fs';
'require rpc';
'require validation';
'require uci';
'require ui';

var cachedData = [], sortedId = 'thTotal', sortedBy = 'desc';
var settings = {};
var luciConfig = '/etc/luci-wrtbwmon.conf';

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
	])
}

function displayTable(elmID) {
	var tb = $('traffic');
	var col = setSortedColumn(elmID), flag = sortedBy =='desc' ? 1 : -1;
	var IPVer = col == 9 ? $('selectProtocol').value : null;

	cachedData[0].sort(sortTable.bind(this, col, IPVer, flag));

	//console.time('show');
	updateTable(tb, cachedData, '<em><%:Loading...%></em>');
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
		return L.resolveDefault(uci.get_first('wrtbwmon', 'wrtbwmon', 'path'), null);
	}).then(function(res) {
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
				E('option', { 'value': '2', 'selected': 'selected' }, _('2 seconds')),
				E('option', { 'value': '5' }, _('5 seconds')),
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

		row.copyWithin(9, 1, 2).copyWithin(1, 0, 1).copyWithin(2, 3, 8);
		if (row[1] in hosts && hosts[row[1]] != '-') {
			row[0] = hosts[row[1]];
		}
		valArr.push(row);
	}

	cachedData = [valArr, totals]
	return cachedData;
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

function registerTableEventHandlers() {
	var indicators = $('xhr_poll_status') || $('indicators').getElementsByTagName('span')[0];
	indicators.addEventListener('click', function() {
		$('selectInterval').value = L.Request.poll.active() ? L.Poll.queue[0].i : -1;
	});

	$('traffic').querySelectorAll('.th').forEach( function(e) {
		if (e) {
			e.addEventListener('click', function () {
				displayTable(this.id);
			});
		}
	});

	$('selectInterval').addEventListener('change', function () {
		if (this.value > 0) {
			L.Poll.queue[0].i = parseInt(this.value);
			if (!L.Request.poll.active()) L.Request.poll.start();
		}
		else {
			L.Request.poll.stop();
			setUpdateMessage(null);
		}
	});

	$('resetDatabase').addEventListener('click', function () {
		if (confirm(_('This will delete the database file. Are you sure?'))) {
			getPath().then(function(res) {
				var db = $('selectProtocol').value == 'ipv4' ? res : renameFile(res, '6');
				fs.exec('/bin/rm', [db]).then(function() {
					document.location.reload();
				})
			})
		}
	});

	$('showMore').addEventListener('click', function () {
		var t = document.querySelector('.tr.table-totals').firstElementChild;
		var showMore = this.checked;
		t.firstChild.nodeValue = _('TOTAL') + ':' + (showMore ? '' : ' ' + $('traffic').childElementCount - 2);
		t.nextElementSibling.firstChild.nodeValue = showMore ? $('traffic').childElementCount - 2 + ' ' + _('Clients') : '';
		document.querySelectorAll('.showMore')
			.forEach(function(e) {
				showMore ? e.classList.remove('hide') :e.classList.add('hide');
		});

		if (!showMore && ['thMAC', 'thFirstSeen', 'thLastSeen'].indexOf(sortedId)!= -1) displayTable('thTotal');
	});
}

function renameFile(str, tag) {
	var n = str.lastIndexOf('/'), fn = n > -1 ? str.slice(n + 1) : str, dir = n > -1 ? str.slice(0, n + 1) : '';
	var n = fn.lastIndexOf('.'), bn = n > -1 ? fn.slice(0, n) : fn;
	var n = fn.lastIndexOf('.'), en = n > -1 ? fn.slice(n + 1) : '';
	return dir + bn + '.' + tag + (en ? '.' + en : '');
}

function renderTable(content, obj) {
	var i, j, node, tr;

	obj['class'] = obj['class'] ? obj['class'] + ' ' + 'table' : 'table';
	node = E('div', obj);

	for (i = 0; i < content.length; i++) {
		tr = E('div', {'class': 'tr'}, '');
		for (j = 0; j < content[i].length; j++) {
			tr.appendChild(E('div', {'class': 'td'}, content[i][j]));
		}
		node.appendChild(tr);
	}

	return node;
}

function resolveCustomizedHostName() {
	var hostNameFile = '/etc/wrtbwmon.user'
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

function setSortedColumn(elmID) {
	var label = ['', 'thMAC', 'thDownload', 'thUpload', 'thTotalDown', 'thTotalUp', 'thTotal', 'thFirstSeen', 'thLastSeen', 'thClient'];

	// Remove the old sorted sign.
	var e = $(sortedId);
	if (e) {
		e.innerHTML = e.innerHTML.replace(/\u25b2|\u25bc/, '');
	}

	// Toggle the sort direction.
	if (elmID) {
		if ( elmID == sortedId ) {
			sortedBy = (sortedBy == 'desc') ? 'asc' : 'desc';
		} else {
			sortedBy = 'desc';
			sortedId = elmID;
		}
	}

	e = $(sortedId);
	if (e) {
		e.innerHTML += (sortedBy == 'asc' ? '\u25b2' : '\u25bc');
	}

	return label.indexOf(sortedId)
}

function setUpdateMessage(sec) {
	$('updating').innerHTML = (sec == null) ? '' : ' ' + _('Updating again in %s second(s).').format('<b>' + sec + '</b>');
}

function sortTable(col, IPVer, flag, x, y) {
	var byCol = x[col] == y[col] ? 1 : col;
	var a = x[byCol], b = y[byCol];

	if (!IPVer || byCol != 9) {
		if (!(a.match(/\D/g) || b.match(/\D/g)))
			a = parseInt(a), b = parseInt(b);
	}
	else {
		IPVer == 'ipv4' ?
		(a = validation.parseIPv4(a) || '0.0.0.0', b = validation.parseIPv4(b) || '0.0.0.0') :
		(a = validation.parseIPv6(a) || validation.parseIPv6('::'), b = validation.parseIPv6(b) || validation.parseIPv6('::'));
	}

	return (a < b ? 1 : -1) * flag;
}

function toggleHide() {
	var e = document.getElementById('control_panel');
	var b = document.getElementById('control_button');
	if(e.classList.contains('hide')) {
		e.classList.remove('hide');
		b.innerHTML = _('Hide the control panel') + ' ' + '\u2bc5';
		b.title = _('Hide the control panel');
	}
	else {
		e.classList.add('hide');
		b.innerHTML = _('Show the control panel') + ' ' + '\u2bc6';
		b.title = _('Show the control panel');
	}
}

function updateData() {
	//console.time('start');
	getPath().then(function(res) {
		var params, data;
		if ($('selectProtocol').value == 'ipv4'){
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
			fs.exec('/bin/cat', [data]),
			L.resolveDefault(resolveHostNameByMACAddr(), {})
		]).then(function(res) {
				parseDatabase(res[0].stdout || '', res[1]);
				displayTable(null);
				$('updated').innerHTML = _('Last updated at %s.').format(formatDate(Math.round(Date.now() / 1000)));
		});
	});
	//console.timeEnd('start');
}

function updatePerSec() {
	var tick = L.Poll.tick, interval = L.Poll.queue[0].i;
	var sec = tick % interval ? interval - tick % interval : 0;

	setUpdateMessage(sec);
	if(sec == 0) {
		setTimeout(setUpdateMessage.bind(this, interval), 100);
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
					childTD.firstChild.nodeValue = formatSpeed(tbData[i][j]);
					break;
				case 4:
				case 5:
				case 6:
					childTD.firstChild.nodeValue = formatSize(tbData[i][j]);
					break;
				case 7:
				case 8:
					childTD.firstChild.nodeValue = formatDate(tbData[i][j]);
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
		newNode.firstElementChild.firstChild.nodeValue = !showMore ? _('TOTAL') + ': ' + tbData.length : _('TOTAL') + ':';
		newNode.firstElementChild.nextSibling.firstChild.nodeValue = !showMore ? '' : tbData.length + ' ' + _('Clients');

		for (var j = 0; j < values[1].length; j++) {
			newNode.children[j + 2].firstChild.nodeValue = j < 2 ? formatSpeed(values[1][j]) : formatSize(values[1][j]);
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
		var node = E('div', { 'class': 'cbi-map' });

		node.appendChild(E('h2', {}, _('Usage - Details')));

		node.appendChild(
			E('div', {
				'id': 'control_button',
				'class': 'cbi-button',
				'click': toggleHide,
				'title': _('Show the control panel')
				},
			_('Show the control panel') + ' ' + '\u2bc6')
		);

		node.appendChild(
			E('div', { 'class': 'hide', 'id': 'control_panel' }, [
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
						'class': 'cbi-button cbi-button-reset',
						'id': 'resetDatabase'
					}, _('Reset Database')),
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'click': handleConfig
					}, _('Configure Options'))
				])
			])
		);

		node.appendChild(
			E('div', {}, [
				E('div', {}, [
					E('div', { 'id': 'updated' }, ''),
					E('div', { 'id': 'updating' }, '')
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
			])
		);

		node.appendChild(renderTable([
			[
				E('div', {}, _('Downstream:')),
				E('div', {
					'id': 'downstream',
					'class': 'cbi-progressbar',
					'title': '-'
					}, E('div')
				)
			],
			[
				E('div', {}, _('Upstream:')),
				E('div', {
					'id': 'upstream',
					'class': 'cbi-progressbar',
					'title': '-'
					}, E('div')
				)
			]
		], {'id': 'progressbar_panel'}));

		node.appendChild(
			E('div', { 'class': 'table', 'id': 'traffic' }, [
				E('div', { 'class': 'tr table-titles' }, [
					E('div', { 'class': 'th', 'id': 'thClient' }, _('Clients')),
					E('div', { 'class': 'th showMore hide', 'id': 'thMAC' }, _('MAC')),
					E('div', { 'class': 'th', 'id': 'thDownload' }, _('Download')),
					E('div', { 'class': 'th', 'id': 'thUpload' }, _('Upload')),
					E('div', { 'class': 'th', 'id': 'thTotalDown' }, _('Total Down')),
					E('div', { 'class': 'th', 'id': 'thTotalUp' }, _('Total Up')),
					E('div', { 'class': 'th', 'id': 'thTotal' }, _('Total')),
					E('div', { 'class': 'th showMore hide', 'id': 'thFirstSeen' }, _('First Seen')),
					E('div', { 'class': 'th showMore hide', 'id': 'thLastSeen' }, _('Last Seen'))
				]),
				E('div', {'class': 'tr placeholder'}, [
					E('div', { 'class': 'td' }, E('em', {}, _('Collecting data...')))
				])
			])
		);
		return node;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	addFooter: function() {
		Promise.all([
			settings.useDSL ? getDSLBandwidth() : true,
			$('selectInterval').value = settings.interval,
			$('selectProtocol').value = settings.protocol,
			$('showMore').checked = settings.showMore ? 1 : 0,
			document.querySelectorAll('.showMore')
				.forEach(function(e) {
					settings.showMore ? e.classList.remove('hide') :e.classList.add('hide');
			})
		]).then(function() {
			Promise.all([
				L.Poll.add(updateData, settings.interval),
				L.Poll.add(updatePerSec, 1),
			]).then(registerTableEventHandlers);
		})
	}
});

