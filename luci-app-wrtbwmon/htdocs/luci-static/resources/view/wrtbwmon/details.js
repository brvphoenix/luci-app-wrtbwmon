'use strict';
'require fs';
'require rpc';
'require validation';
'require uci';

var cachedData = [], sortedId =	'thTotal', sortedBy = 'desc';

var callLuciDHCPLeases = rpc.declare({
	object:	'luci-rpc',
	method:	'getDHCPLeases',
	expect:	{ '': {} }
});

function $(tid)	{
	return document.getElementById(tid);
}

function getPath() {
	return Promise.resolve(uci.load('wrtbwmon')).then(function() {
		return L.resolveDefault(uci.get('wrtbwmon', 'general', 'path'),	null);
	})
}

function formatDate(date) {
	var d =	new Date((/\W/g).test(date) ? date : date * 1000);
	var Y =	d.getFullYear(), M = d.getMonth() + 1, D = d.getDate();
	var hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();
	return Y + '/' + padStr(M) + '/' + padStr(D) + ' ' + padStr(hh)	+ ':' +	padStr(mm) + ':' + padStr(ss);
}

function displayTable(elmID) {
	var tb = $('traffic'), bdw = parseSize($('setBD').value);
	var col = setSortedColumn(elmID), flag = sortedBy =='desc' ? 1 : -1;

	if(col == 9) {
		var IPV = $('Select46').value;
		cachedData[0].sort(sortIP.bind(this, col, IPV, flag));
	}
	else {
		cachedData[0].sort(function(x, y) {
			var byCol = x[col] == y[col] ? 1 : col;
			return (x[byCol] < y[byCol] ? 1 : -1) *	flag;
		});
	}

	//console.time('show');
	updateTable(tb,	cachedData, '<em><%:Loading...%></em>');
	//console.timeEnd('show');
	progressbar('downflow',	cachedData[1][0], bdw, true);
	progressbar('upflow', cachedData[1][1],	bdw, true);
}

function renameFile(str, tag) {
	var n =	str.lastIndexOf('/'), fn = n > -1 ? str.slice(n + 1) : str, dir = n > -1 ? str.slice(0,	n + 1) : '';
	var n =	fn.lastIndexOf('.'), bn = n > -1 ? fn.slice(0, n) : fn;
	var n =	fn.lastIndexOf('.'), en = n > -1 ? fn.slice(n +	1) : '';
	return dir + bn + '.' +	tag + (en ? '.'	+ en : '');
}

function resolveCustomizedHostName() {
	var hostNameFile = '/etc/wrtbwmon.user'
	return Promise.resolve(fs.stat(hostNameFile)).then(function() {
		return L.resolveDefault(fs.trimmed(hostNameFile), []).then(function(hostNames) {
			return hostNames.split(/\r?\n|\r/g).map(function(res) {
				var data = res.split(',');
				return {
					macaddr: data[0],
					hostname: data[1]
				};
			})
		})
	})
}

function resolveHostNameByMACAddr() {
	return Promise.all([
		L.resolveDefault(resolveCustomizedHostName(), []),
		L.resolveDefault(callLuciDHCPLeases(), {})
	]).then(function(res) {
		var hostNames =	{},
		    leaseNames = [
			res[0],
			Array.isArray(res[1].dhcp_leases) ? res[1].dhcp_leases : [],
			Array.isArray(res[1].dhcp6_leases) ? res[1].dhcp6_leases : []
		];
		for(var i = 0; i < leaseNames.length; i++) {
			for (var j = 0;	j < leaseNames[i].length; j++) {
				if (!(leaseNames[i][j].macaddr in hostNames) ||	hostNames[leaseNames[i][j].macaddr] == '-') {
					hostNames[leaseNames[i][j].macaddr] = leaseNames[i][j].hostname || '-';
				}
			}
		}
		return hostNames;
	});
}

function padStr(str) {
	return str < 10 ? '0' +	str : str;
}

function parseDatabase(values, hosts) {
	var valArr = [], totals = [0, 0, 0, 0, 0], valToRows, rowToArr,	row;

	valToRows = values.replace(/(^\s*)|(\s*$)/g, '').split(/\r?\n|\r/g);
	valToRows.shift();

	for (var i = 0;	i < valToRows.length; i++) {
		var rowToArr = valToRows[i].split(',');
		for (var j = 0;	j < totals.length; j++)	{
			totals[j] += parseInt(rowToArr[3 + j]);
		}

		if (!($('isShow').checked) && totals[4]	== 0) continue;

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

function parseSize(size){
	var num = parseFloat((size).match(/^[0-9]+\.?[0-9]*/g));
	var base = (size).match(/[KMGTPEZ]/i).toString().toUpperCase();
	var unit = ['' , 'K', 'M', 'G',	'T', 'P', 'E', 'Z'];
	var ex = unit.indexOf(base);

	return Math.round((num ? num : 1) * (ex != -1 ?	1024 **	ex : 1));
}

function progressbar(query, v, m, byte)	{
	var pg = $(query),
	    vn = parseInt(v) ||	0,
	    mn = parseInt(m) ||	100,
	    fv = byte ?	String.format('%1024.2mB', v) :	v,
	    pc = ((100 / mn) * vn).toFixed(2),
	    wt = Math.floor(pc > 100 ? 100 : pc),
	    bgc = (pc >= 95 ? 'red' : (pc >= 80 ? 'magenta' : (pc >= 60 ? 'yellow' : 'lime')));

	if (pg)	{
		pg.firstElementChild.style.width = wt +	'%';
		pg.firstElementChild.style.background =	bgc;
		pg.setAttribute('title', '%s/s (%d%%)'.format(fv, pc));
	}
}

function registerTableEventHandlers() {
	$('xhr_poll_status').onclick = function() {
		var e =	$('intervalSelect');
		XHR.running() ?	(XHR.halt(), e.value = -1) : (XHR.run(), e.value = L.Poll.queue[0].i);
	}

	$('traffic').querySelectorAll('.th').forEach( function(e) {
		if (e) {
			e.addEventListener('click', function ()	{
				displayTable(this.id);
			});
		}
	});

	$('intervalSelect').addEventListener('change', function () {
		if (this.value > 0) {
			L.Poll.queue[0].i = parseInt(this.value);
			if (!XHR.running()) XHR.run();
		}
		else {
			XHR.halt();
			setUpdateMessage(null);
		}
	});

	$('resetDatabase').addEventListener('click', function () {
		if (confirm(_('This will delete the database file. Are you sure?'))) {
			getPath().then(function(res) {
				var db = $('Select46').value ==	'ipv4' ? res : renameFile(res, '6');
				fs.exec('/bin/rm', [db]).then(function() {
					document.location.reload();
				})
			})
		}
	});

	$('setBD').addEventListener('input', function () {
		var strTest = (/^[0-9]+\.?[0-9]*[\s]*[KMGTP]?B?(\/s)?$/ig).test(this.value);
		$('checkBD').innerHTML = strTest ? '\u2714' : '\u2716';
	});

	$('setBD').addEventListener('focusout',	function () {
		if ($('checkBD').innerHTML == '\u2716')	{
			alert(_('Error!	Bandwidth reset!!!'));
			this.value = '1M';
		}
		$('checkBD').innerHTML = '';
	});

	$('showMore').addEventListener('click',	function () {
		var t =	document.querySelector('.tr.table-totals').firstElementChild;
		var showMore = this.checked;
		t.firstChild.nodeValue = _('TOTAL') + ':' + (showMore ?	'' : ' ' + $('traffic').childElementCount - 2);
		t.nextElementSibling.firstChild.nodeValue = showMore ? $('traffic').childElementCount -	2 + ' '	+ _('Clients') : '';
		document.querySelectorAll('.showMore').forEach(function(e) {
			if(e) {
				showMore ? e.classList.remove('hide') :e.classList.add('hide');
			}
		});

		if (!showMore && ['thMAC', 'thFirstSeen', 'thLastSeen'].indexOf(sortedId)!= -1)	displayTable('thTotal');
	});
}

function setSortedColumn(elmID)	{
	var label = ['', 'thMAC', 'thDownload',	'thUpload', 'thTotalDown', 'thTotalUp',	'thTotal', 'thFirstSeen', 'thLastSeen',	'thClient'];

	// Remove the old sorted sign.
	var e =	$(sortedId);
	if (e) {
		e.innerHTML = e.innerHTML.replace(/\u25B2|\u25BC/, '');
	}

	// Toggle the sort direction.
	if (elmID) {
		if ( elmID == sortedId ) {
			sortedBy = (sortedBy ==	'desc')	? 'asc'	: 'desc';
		} else {
			sortedBy = 'desc';
			sortedId = elmID;
		}
	}

	e = $(sortedId);
	if (e) {
		e.innerHTML += (sortedBy == 'asc' ? '\u25B2' : '\u25BC');
	}

	return label.indexOf(sortedId)
}

function setUpdateMessage(sec) {
	$('updating').innerHTML = (sec == null) ? '' : ' ' + _('Updating again in %s seconds.').format('<b>' + sec + '</b>');
}

function sortIP(col, IPV, flag, x, y) {
	var byCol = x[col] == y[col] ? 1 : col;
	var a = x[byCol], b = y[byCol];

	IPV == 'ipv4' ?
	(a = validation.parseIPv4(a), b = validation.parseIPv4(b)) :
	(a = validation.parseIPv6(a), b = validation.parseIPv6(b));

	var ipChk1 = a ? 1 : -1;
	var ipChk2 = b ? 1 : -1;

	if (ipChk1 * ipChk2 < 0)
		return (ipChk2 - ipChk1) * flag;

	return (a < b ?	1 : -1)	* flag;
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
				$('updated').innerHTML = _('Last updated at %s.').format(formatDate(Math.round(Date.now() / 1000)));
				displayTable(null);
			});
		});
	});
	//console.timeEnd('start');
}

function updatePerSec()	{
	var tick = L.Poll.tick,	interval = L.Poll.queue[0].i;
	var sec = tick % interval ? interval - tick % interval : 0;

	setUpdateMessage(sec);
	if(sec == 0) {
		setTimeout(setUpdateMessage.bind(this, interval), 100);
	}
}

function updateTable(tb, values, placeholder) {
	var dom = document.createDocumentFragment(), nodeLen = tb.childElementCount - 2;
	var tbData = values[0],	shadowNode, newNode, childTD, tabTitle = tb.firstElementChild;
	var showMore = $('showMore').checked;

	// Create the shadow node, which will be used in the following.
	if (tbData.length > nodeLen) {
		if (tb.childElementCount > 2) {
			shadowNode = tabTitle.nextElementSibling.cloneNode(true);
		}
		else {
			shadowNode = document.createElement('div');
			childTD = document.createElement('div');
			childTD.appendChild(document.createTextNode(''));
			for (var j = 0;	j < tabTitle.children.length; j++) {
				childTD.className = 'td' + (!showMore && '178'.indexOf(j) != -1 ? ' hide showMore' : '');
				childTD.setAttribute('data-title', tabTitle.children[j].innerHTML);
				shadowNode.appendChild(childTD.cloneNode(true));
			}
			shadowNode.firstElementChild.appendChild(document.createElement('br'));
			shadowNode.firstElementChild.appendChild(document.createTextNode(''));
		}
	}

	// Update the table data.
	for (var i = 0;	i < tbData.length; i++)	{
		if (i <	nodeLen) {
			newNode = tabTitle.nextElementSibling;
		}
		else {
			newNode = shadowNode.cloneNode(true);
			newNode.className = 'tr cbi-rowstyle-%d'.format(i % 2 ?	2 : 1);
		}

		childTD = newNode.firstElementChild;
		childTD.title =	tbData[i][1];
		childTD.lastChild.nodeValue = tbData[i].slice(-1);
		for (var j = 0;	j < tabTitle.childElementCount;	j++, childTD = childTD.nextElementSibling){
			childTD.firstChild.nodeValue = ('23456'.indexOf(j) != -1 ?
			'%1024.2mB' + ('23'.indexOf(j) != -1 ? '/s' : '') :
			'%s').format('78'.indexOf(j) !=	-1 ? formatDate(tbData[i][j]) :	tbData[i][j]);
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
	if (newNode.classList.contains('table-totals'))	{
		if (tbData.length == 0)	{
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

	if (newNode.classList.contains('table-totals'))	{
		newNode.firstElementChild.firstChild.nodeValue = !showMore ? _('TOTAL')	+ ': ' + tbData.length : _('TOTAL') + ':';
		newNode.firstElementChild.nextSibling.firstChild.nodeValue = !showMore ? '' : tbData.length + '	' + _('Clients');

		for (var j = 0;	j < values[1].length; j++) {
			newNode.children[j + 2].firstChild.nodeValue = '%1024.2mB'.format(values[1][j])	+ (j < 2 ? '/s'	: '');
		}
	}

	tb.appendChild(dom);
}

return L.view.extend({
	renderTable: function(content) {
		var i, j, node,	tr;

		node = E('div',	{'class': 'table'}, '');

		for (i = 0; i <	content.length;	i++) {
			tr = E('div', {'class':	'tr'}, '');
			for (j = 0; j <	content[i].length; j++)	{
				tr.appendChild(E('div',	{'class': 'td'}, content[i][j]));
			}
			node.appendChild(tr);
		}

		return node;
	},

	loadCss: function(path){
		var head = document.querySelectorAll('head')[0];
		var link = E('link', {
			'href': path,
			'rel': 'stylesheet',
			'type': 'text/css'
		})

		head.appendChild(link);
	},

	render:	function() {
		this.loadCss(L.resource('view/wrtbwmon/wrtbwmon.css'));
		var node = E('div', { 'class': 'cbi-map' });

		node.appendChild(E('h2', {}, _('Usage - Details')));

		node.appendChild(this.renderTable([
			[
				E('div', {}, E('label',	{}, _('protocol:'))),
				E('div', {},
					E('select', { 'id': 'Select46',	'style': 'width:auto' }, [
						E('option', { 'value': 'ipv4', 'selected': 'selected' }, 'ipv4'),
						E('option', { 'value': 'ipv6' }, 'ipv6')
					])
				),
				E('div', {}, E('label',	{ 'for': 'isShow' }, _('Show Zeros:'))),
				E('div', {}, E('input',	{ 'id':	'isShow', 'type': 'checkbox' })),
				E('div', {},
					E('div', {
						'class': 'cbi-button',
						'id': 'resetDatabase',
						'style': 'float:right'
						}, _('Reset Database'))
				)
			],
			[
				E('div', {}, E('label',	{}, _('bandwidth:'))),
				E('div', {}, [
					E('input', {
						'id': 'setBD',
						'style': 'width:auto',
						'type':	'text',
						'value': '1M'
						}, ''),
					E('label', { 'id': 'checkBD' })
				]),
				E('div', {}, E('label',	{ 'for': 'showMore' }, _('Show More:'))),
				E('div', {}, [
						E('input', { 'id': 'showMore', 'type': 'checkbox' })
					]),
				E('div')
			]

		]));

		node.appendChild(
			E('div', {'style': 'display:flex;margin-bottom:0.5rem'}, [
				E('div', { 'style': 'flex: 1 1 auto' },	[
					E('div', { 'id': 'updated', 'style': 'display:inline' }, ''),
					E('div', { 'id': 'updating', 'style': 'display:inline' }, '')
				]),
				E('div', {}, [
					E('label', { 'for': 'intervalSelect' },	_('Auto update every:')),
					E('select', { 'id': 'intervalSelect', 'style': 'width:auto' }, [
						E('option', { 'value': '-1' }, _('Disabled')),
						E('option', { 'value': '2', 'selected':	'selected' }, _('2 seconds')),
						E('option', { 'value': '5' }, _('5 seconds')),
						E('option', { 'value': '10' }, _('10 seconds')),
						E('option', { 'value': '30' }, _('30 seconds'))
					])
				])
			])
		);

		node.appendChild(this.renderTable([
			[
				E('div', {}, _('downflow:')),
				E('div', {},
					E('div', {
						'id': 'downflow',
						'class': 'cbi-progressbar',
						'title': '-'
						}, E('div')
					)
				)
			],
			[
				E('div', {}, _('upflow:')),
				E('div', {},
					E('div', {
						'id': 'upflow',
						'class': 'cbi-progressbar',
						'title': '-'
						}, E('div')
					)
				)
			]
		]));

		node.appendChild(
			E('div', { 'class': 'table', 'id': 'traffic' },	[
				E('div', { 'class': 'tr table-titles' }, [
					E('div', { 'class': 'th', 'id':	'thClient', 'style': 'width:17%' }, _('Clients')),
					E('div', { 'class': 'th showMore hide',	'id': 'thMAC', 'style':	'width:10%' }, _('MAC')),
					E('div', { 'class': 'th', 'id':	'thDownload', 'style': 'width:8%' }, _('Download')),
					E('div', { 'class': 'th', 'id':	'thUpload', 'style': 'width:8%'	}, _('Upload')),
					E('div', { 'class': 'th', 'id':	'thTotalDown', 'style':	'width:9%' }, _('Total Down')),
					E('div', { 'class': 'th', 'id':	'thTotalUp', 'style': 'width:9%' }, _('Total Up')),
					E('div', { 'class': 'th', 'id':	'thTotal', 'style': 'width:9%' }, _('Total')),
					E('div', { 'class': 'th showMore hide',	'id': 'thFirstSeen', 'style': 'width:15%' }, _('First Seen')),
					E('div', { 'class': 'th showMore hide',	'id': 'thLastSeen', 'style': 'width:15%' }, _('Last Seen'))
				]),
				E('div', {'class': 'tr placeholder'}, [
					E('div', { 'class': 'td' }, E('em', {},	_('Collecting data...')))
				])
			])
		);
		return node;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	addFooter: function() {
		registerTableEventHandlers();
		L.Poll.add(updateData, $('intervalSelect').value);
		L.Poll.add(updatePerSec, 1);
	}
});
