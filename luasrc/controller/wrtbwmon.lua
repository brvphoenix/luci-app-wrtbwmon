module("luci.controller.wrtbwmon", package.seeall)

function index()
    entry({"admin", "network", "usage"}, alias("admin", "network", "usage", "details"), _("Traffic Status"), 60)
    entry({"admin", "network", "usage", "details"}, template("wrtbwmon"), _("Details"), 10).leaf=true
    entry({"admin", "network", "usage", "config"}, cbi("wrtbwmon/config"), _("Configuration"), 20).leaf=true
    entry({"admin", "network", "usage", "custom"}, cbi("wrtbwmon/custom"), _("User file"), 30).leaf=true
    entry({"admin", "network", "usage", "check_dependency"}, call("check_dependency")).dependent=true
    entry({"admin", "network", "usage", "usage_data"}, call("usage_data")).dependent=true
    entry({"admin", "network", "usage", "usage_reset"}, call("usage_reset")).dependent=true
end

