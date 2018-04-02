module("luci.controller.wrtbwmon", package.seeall)

function index()
    entry({"admin", "network", "usage"}, alias("admin", "network", "usage", "details"), _("Traffic Status"), 60)
    entry({"admin", "network", "usage", "details"}, template("wrtbwmon"), _("Details"), 10).leaf=true
    entry({"admin", "network", "usage", "config"}, cbi("wrtbwmon/config"), _("Configuration"), 20).leaf=true
    entry({"admin", "network", "usage", "custom"}, cbi("wrtbwmon/custom"), _("User file"), 30).leaf=true
    entry({"admin", "network", "usage", "check_dependency"}, call("check_dependency")).dependent=true
    entry({"admin", "network", "usage", "usage_data"}, call("usage_data")).dependent=true
    entry({"admin", "network", "usage", "usage_reset"}, call("usage_reset")).dependent=true
    entry({"admin", "network", "usage", "bandwidth_set"}, call("bandwidth_set")).dependent=true
end

function usage_database_path()
    local cursor = luci.model.uci.cursor()
    local new_path = cursor:get("wrtbwmon", "general", "path")
    return new_path
end

function check_dependency()
    local ret = "0"
    if require("luci.model.ipkg").installed('wrtbwmon') then
        ret = "1"
    end
    luci.http.prepare_content("text/plain")
    luci.http.write(ret)
end

function usage_data()

    local db = usage_database_path()

    local cmd_S = "wrtbwmon setup " .. db .. " /tmp/usage.htm /etc/wrtbwmon.user >> /dev/null 2>&1 &"
    local cmd_P = "wrtbwmon publish " .. db .. " /tmp/usage.htm /etc/wrtbwmon.user"

    if not nixio.fs.access("/var/run/wrtbwmon.pid") then
        luci.sys.call(cmd_S)
    else
        luci.sys.call(cmd_P)
    end
    luci.http.prepare_content("text/html")
    luci.http.write(luci.sys.exec("cat /tmp/usage.htm"))
end

function usage_reset()
    local db = usage_database_path()
    local ret = luci.sys.call("wrtbwmon update " .. db .. " && rm " .. db)
    luci.http.status(204)
end

function bandwidth_set()
    local cursor = luci.model.uci.cursor()
    luci.http.prepare_content("text/html")
    return luci.http.write(cursor:get("wrtbwmon", "general", "bandwidth"))
end
