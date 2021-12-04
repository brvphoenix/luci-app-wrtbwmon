'use strict';
'require form';
'require view';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('wrtbwmon', _('Usage - Configuration'));

		s = m.section(form.NamedSection, 'general', 'wrtbwmon', _('General settings'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Keep running in the background'));
		o.rmempty = true;

		o = s.option(form.Value, 'path', _('Database path'), _('This box is used to select the Database path, which is /tmp/usage.db by default.'));
		o.value('/tmp/usage.db');
		o.value('/etc/usage.db');
		o.default = '/tmp/usage.db';
		o.rmempty = false;

		return m.render();
	}
});
