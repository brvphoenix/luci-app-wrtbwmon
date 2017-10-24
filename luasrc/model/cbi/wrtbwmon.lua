m = Map("wrtbwmon", translate("Wrtbwmon"), translate("Wrtbwmon is a mointor of the traffic usage."))

s = m:section(NamedSection, "general", "wrtbwmon", translate("General settings"))

o = s:option(Flag, "persist", translate("Persist database"),
    translate("Check this to persist the database file under /etc/config. This ensures usage is persisted even across firmware updates."))
o.rmempty = false

function o.write(self, section, value)
    if value == '1' then
        luci.sys.call("mv /tmp/usage.db /etc/config/usage.db")
    elseif value == '0' then
        luci.sys.call("mv /etc/config/usage.db /tmp/usage.db")
    end
    return Flag.write(self, section ,value)
end

return m
