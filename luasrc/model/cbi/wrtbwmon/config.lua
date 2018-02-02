local m = Map("wrtbwmon", translate("Usage - Configuration"))

local s = m:section(NamedSection, "general", "wrtbwmon", translate("General settings"))

local o = s:option(Value, "path", translate("Database Path"),
    translate("This box is used to select the Database path, "
    .. "which is /tmp/usage.db by default."))
o:value("/tmp/usage.db")
o:value("/etc/usage.db")


function m.on_parse(self)
    local cursor = luci.model.uci.cursor()
    local old_path = cursor:get("wrtbwmon", "general", "path")

    io.popen("/etc/init.d/wrtbwmon stop")
    luci.sys.call("mv " .. old_path .. " /tmp/usage.db")
end

function m.on_commit(self)
    local cursor = luci.model.uci.cursor()
    local new_path = cursor:get("wrtbwmon", "general", "path")

    luci.sys.call("mv /tmp/usage.db " .. new_path )
    io.popen("/etc/init.d/wrtbwmon start")
end

return m
