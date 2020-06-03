'use strict';
'require fs';
'require rpc';
'require validation';
'require uci';

var cachedData = [], sortedId = 'thTotal', sortedBy = 'desc';
var useBits = true;
var downstream_bandwidth = 8388608; // 8Mb
var upstream_bandwidth = 8388608; // 8Mb

var callLuciDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});

function $(tid) {
	return document.getElementById(tid);
}

function getPath() {
	return uci.load('wrtbwmon').then(function() {
		return L.resolveDefault(uci.get_first('wrtbwmon', 'wrtbwmon', 'path'), null);
	}).then(function(res) {
		uci.unload('wrtbwmon');
		return res;
	});
}

function bitsorBytes() {
	return uci.load('wrtbwmon').then(function() {
		return L.resolveDefault(uci.get_first('wrtbwmon', 'wrtbwmon', 'speed_in_bits'), 0);
	}).then(function(res) {
		uci.unload('wrtbwmon');
		return res;
	});
}

function downstreamBandwidth() {
	return uci.load('wrtbwmon').then(function() {
		return L.resolveDefault(uci.get_first('wrtbwmon', 'wrtbwmon', 'downstream_bandwidth'), 8192);
	}).then(function(res) {
		uci.unload('wrtbwmon');
		return res * 1024;
	});
}

function upstreamBandwidth() {
	return uci.load('wrtbwmon').then(function() {
		return L.resolveDefault(uci.get_first('wrtbwmon', 'wrtbwmon', 'upstream_bandwidth'), 8192);
	}).then(function(res) {
		uci.unload('wrtbwmon');
		return res * 1024;
	});
}


function formatDate(date) {
	var d = new Date((/\W/g).test(date) ? date : date * 1000);
	var Y = d.getFullYear(), M = d.getMonth() + 1, D = d.getDate();
	var hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();
	return Y + '/' + padStr(M) + '/' + padStr(D) + ' ' + padStr(hh) + ':' + padStr(mm) + ':' + padStr(ss);
}

function displayTable(elmID) {
	var tb = $('traffic');
	var col = setSortedColumn(elmID), flag = sortedBy =='desc' ? 1 : -1;
	var IPVer = col == 9 ? $('Select46').value : null;

	cachedData[0].sort(sortTable.bind(this, col, IPVer, flag));

	//console.time('show');
	updateTable(tb, cachedData, '<em><%:Loading...%></em>');
	//console.timeEnd('show');
	progressbar('downflow', cachedData[1][0] * (useBits ? 8 : 1), Math.round(downstream_bandwidth / (useBits ? 1 : 8)), true);
	progressbar('upflow', cachedData[1][1] * (useBits ? 8 : 1), Math.round(upstream_bandwidth / (useBits ? 1 : 8)), true);
}

function padStr(str) {
	return str < 10 ? '0' + str : str;
}

function parseDatabase(values, hosts) {
	var valArr = [], totals = [0, 0, 0, 0, 0], valToRows, rowToArr, row;

	valToRows = values.replace(/(^\s*)|(\s*$)/g, '').split(/\r?\n|\r/g);
	valToRows.shift();

	for (var i = 0; i < valToRows.length; i++) {
		var rowToArr = valToRows[i].split(',');
		if (!($('isShow').checked) && rowToArr[7] == 0) continue;

		for (var j = 0; j < totals.length; j++) {
			totals[j] += parseInt(rowToArr[3 + j]);
		}

		row = Array.prototype.concat([rowToArr[0], rowToArr[0]], rowToArr.slice(3), [rowToArr[1]]);
		if (row[1] in hosts) {
			if (hosts[row[1]] != '-') {
				row[0] = hosts[row[1]];
			}
		}
		valArr.push(row);
	}
	cachedData = [valArr, totals]
	return cachedData;
}

function progressbar(query, v, m, byte) {
	var pg = $(query),
	    vn = parseInt(v) || 0,
	    mn = parseInt(m) || 100,
	    fv = byte ? String.format('%1024.2m' + (useBits ? 'b' : 'B'), v ) : v,
	    pc = ((100 / mn) * vn).toFixed(2),
	    wt = Math.floor(pc > 100 ? 100 : pc),
	    bgc = (pc >= 95 ? 'red' : (pc >= 80 ? 'darkorange' : (pc >= 60 ? 'yellow' : 'lime'))),
	    tc = (pc >= 80 ? 'white' : '#404040');
	if (pg) {
		pg.firstElementChild.style.width = wt + '%';
		pg.firstElementChild.style.background = bgc;
		pg.style.color = tc;
		pg.setAttribute('title', '%s/s (%d%%)'.format(fv, pc));
	}
}

function registerTableEventHandlers() {
	var indicators = $('xhr_poll_status') || $('indicators').getElementsByTagName('span')[0];
	indicators.addEventListener('click', function() {
		$('intervalSelect').value = L.Request.poll.active() ? L.Poll.queue[0].i : -1;
	});

	$('traffic').querySelectorAll('.th').forEach( function(e) {
		if (e) {
			e.addEventListener('click', function () {
				displayTable(this.id);
			});
		}
	});

	$('intervalSelect').addEventListener('change', function () {
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
				var db = $('Select46').value == 'ipv4' ? res : renameFile(res, '6');
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
		document.querySelectorAll('.showMore').forEach(function(e) {
			if(e) {
				showMore ? e.classList.remove('hide') :e.classList.add('hide');
			}
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
		    leaseNames = [
			res[0],
			Array.isArray(res[1].dhcp_leases) ? res[1].dhcp_leases : [],
			Array.isArray(res[1].dhcp6_leases) ? res[1].dhcp6_leases : []
		    ];
		for(var i = 0; i < leaseNames.length; i++) {
			for (var j = 0; j < leaseNames[i].length; j++) {
				// The rpc call returns uppercase mac addresses however we use lowercase ones here
				// It also allows users to put uppercase mac addresses in the user file
				leaseNames[i][j].macaddr = leaseNames[i][j].macaddr.toLowerCase();
				if (!(leaseNames[i][j].macaddr in hostNames) || hostNames[leaseNames[i][j].macaddr] == leaseNames[i][j].macaddr) {
					hostNames[leaseNames[i][j].macaddr] = leaseNames[i][j].hostname || leaseNames[i][j].macaddr;
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

function updateData() {
	//console.time('start');
	getPath().then(function(res) {
		var params, data;
		if ($('Select46').value == 'ipv4'){
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
			Promise.resolve(parseDatabase(res[0].stdout || '', res[1])).then(function() {
				bitsorBytes().then(function(uBits) {
					useBits = uBits == 1;

					downstreamBandwidth().then(function(dband) {
						downstream_bandwidth = dband;
						updateMaxBandwidths();
					})
					upstreamBandwidth().then(function(uband) {
						upstream_bandwidth = uband;
						updateMaxBandwidths();
					})

					$('updated').innerHTML = _('Last updated at %s.').format(formatDate(Math.round(Date.now() / 1000)));
					displayTable(null);
				})
			});
		});
	});
	//console.timeEnd('start');
}

function updateMaxBandwidths() {
	$('downBandwidth').innerHTML = '%1024.2m'.format(Math.round(downstream_bandwidth)) + (useBits ? 'b/s' : 'B/s')
	$('upBandwidth').innerText = '%1024.2m'.format(Math.round(upstream_bandwidth)) + (useBits ? 'b/s' : 'B/s')
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
				childTD.className = 'td' + (!showMore && '178'.indexOf(j) != -1 ? ' hide showMore' : '');
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
		// Format table fields with speeds/sizes/dates
		for (var j = 0; j < tabTitle.childElementCount; j++, childTD = childTD.nextElementSibling){
			childTD.firstChild.nodeValue = ('23456'.indexOf(j) != -1 ?
			'%1024.2m' + ('23'.indexOf(j) != -1 ? (useBits ? 'b/s' : 'B/s') : 'B') : '%s')
			.format('78'.indexOf(j) != -1 ? formatDate(tbData[i][j]) : ('23'.indexOf(j) != -1 & useBits ? 8 * tbData[i][j] : tbData[i][j]));
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
			newNode.children[j + 2].firstChild.nodeValue = '%1024.2m'.format(values[1][j] * (j < 2 & useBits ? 8 : 1)) + (j < 2 ? (useBits ? 'b/s' : 'B/s') : 'B');
		}
	}

	tb.appendChild(dom);
}

return L.view.extend({
	renderTable: function(content, obj) {
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
	},

	loadCss: function(path){
		var head = document.head || document.getElementsByTagName('head')[0];
		var link = E('link', {
			'rel': 'stylesheet',
			'href': path,
			'type': 'text/css'
		});

		head.appendChild(link);
	},

	toggleHide: function() {
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
	},

	render: function() {
		this.loadCss(L.resource('view/wrtbwmon/wrtbwmon.css'));
		var node = E('div', { 'class': 'cbi-map' });

		node.appendChild(E('h2', {}, _('Usage - Details')));

		node.appendChild(
			E('div', {
				'id': 'control_button',
				'class': 'cbi-button',
				'click': L.ui.createHandlerFn(this, 'toggleHide'),
				'title': _('Show the control panel')
				},
			_('Show the control panel') + ' ' + '\u2bc6'));

		node.appendChild(this.renderTable([
			[
				E('label', {}, _('protocol:')),
				E('select', { 'id': 'Select46', 'style': 'width:auto' }, [
					E('option', { 'value': 'ipv4', 'selected': 'selected' }, 'ipv4'),
					E('option', { 'value': 'ipv6' }, 'ipv6')
				]),
				E('label', { 'for': 'isShow' }, _('Show Zeros:')),
				E('input', { 'id': 'isShow', 'type': 'checkbox' }),
				E('div', {
					'class': 'cbi-button',
					'id': 'resetDatabase',
					'style': 'float:right'
					},
				_('Reset Database'))
			],
			[
				E('label', {}, _('Downstream Bandwidth:')), 
				E('div', { 'id': 'downBandwidth', 'style': 'display:inline' }, '-----'),
				E('label', {}, _('Upstream Bandwidth:')),
				E('div', { 'id': 'upBandwidth', 'style': 'display:inline' }, '-----'),
				E('label', { 'for': 'showMore' }, _('Show More:')),
				E('input', { 'id': 'showMore', 'type': 'checkbox' }),
				E('div')
			]

		], {'class': 'hide', 'id': 'control_panel'}));

		node.appendChild(
			E('div', {'style': 'display:flex;margin-bottom:0.5rem'}, [
				E('div', { 'style': 'flex: 1 1 auto' }, [
					E('div', { 'id': 'updated', 'style': 'display:inline' }, ''),
					E('div', { 'id': 'updating', 'style': 'display:inline' }, '')
				]),
				E('div', {}, [
					E('label', { 'for': 'intervalSelect' }, _('Auto update every:')),
					E('select', { 'id': 'intervalSelect', 'style': 'width:auto' }, [
						E('option', { 'value': '-1' }, _('Disabled')),
						E('option', { 'value': '2', 'selected': 'selected' }, _('2 seconds')),
						E('option', { 'value': '5' }, _('5 seconds')),
						E('option', { 'value': '10' }, _('10 seconds')),
						E('option', { 'value': '30' }, _('30 seconds'))
					])
				])
			])
		);

		node.appendChild(this.renderTable([
			[
				E('div', {}, _('Downstream:')),
				E('div', {
					'id': 'downflow',
					'class': 'cbi-progressbar',
					'title': '-'
					}, E('div')
				)
			],
			[
				E('div', {}, _('Upstream:')),
				E('div', {
					'id': 'upflow',
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
		L.Poll.add(updateData, $('intervalSelect').value);
		L.Poll.add(updatePerSec, 1);
		registerTableEventHandlers();
	}
});
