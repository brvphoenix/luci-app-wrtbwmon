local m = Map("wrtbwmon", translate("Usage - Configuration"))

local s = m:section(NamedSection, "general", "wrtbwmon", translate("General settings"))

local o = s:option(Value, "path", translate("Database Path"),
    translate("This box is used to select the Database path, "
    .. "which is /tmp/usage.db by default."))
o:value("/tmp/usage.db")
o:value("/etc/usage.db")
o.rmempty= false

function m.on_parse(self)
    local cursor = luci.model.uci.cursor()
    local old_path = cursor:get("wrtbwmon", "general", "path")
    luci.sys.call("uci set wrtbwmon.general.old_path=" .. old_path .. "&& uci commit wrtbwmon" )
end

function o.write(self,section,value)
    local cursor = luci.model.uci.cursor()
    local old_path = cursor:get("wrtbwmon", "general", "old_path")

    if value:match("^\/") == nil then
        value = "/tmp/" .. value
    end

    local cfpath = nixio.fs.dirname(value)
    local cfname = nixio.fs.basename(value)
    local new_path = cfpath .. "/" .. cfname

    if not nixio.fs.access(cfpath) then
        if nixio.fs.mkdirr(cfpath) then
            if nixio.fs.copyr(old_path,new_path) then
                io.popen("/etc/init.d/wrtbwmon stop")
                luci.sys.call("mv -f " .. old_path .. " ".. new_path)
                io.popen("/etc/init.d/wrtbwmon start")
                return Value.write(self,section,new_path)
            end
        end
    else
        if nixio.fs.copyr(old_path,new_path) then
            io.popen("/etc/init.d/wrtbwmon stop")
            luci.sys.call("mv -f " .. old_path .. " ".. new_path)
            io.popen("/etc/init.d/wrtbwmon start")
            return Value.write(self,section,new_path)
        end
    end

    return Value.write(self,section,old_path)
end

return m
