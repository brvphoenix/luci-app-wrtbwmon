# luci-app-wrtbwmon

The origin codes come from Kiougar https://github.com/Kiougar/luci-wrtbwmon.

This repository is the radical overhaul of the original codes which must cooperate with fixed wrtbwmon at the same time. The usable wrtbwmon can be obtained form url https://github.com/brvphoenix/wrtbwmon.

Compared with the original one, this version has made some changes:
1. Recognise the hosts by the unique MAC rather than the IP.
2. Support IPV6 connect which is now imperfected.
3. Can be ran background periodically.
4. Many other details.

# Download
Openwrt 19.07 has been fully supported after commit: [ff4909d](https://github.com/brvphoenix/luci-app-wrtbwmon/tree/ff4909d8f5d06fee87f7ec5a365ac5dde6492130).

openwrt-19.07 [release-2.0.0](https://github.com/brvphoenix/luci-app-wrtbwmon/releases/download/release-2.0.0/luci-app-wrtbwmon_2.0.0-1_all.ipk)

openwrt-18.06 [release-1.6.3](https://github.com/brvphoenix/luci-app-wrtbwmon/releases/download/release-1.6.3/luci-app-wrtbwmon_1.6.3-1_all.ipk)

# Information
The current master branch is switched from the old new-dev branch since commit [ff4909d](https://github.com/brvphoenix/luci-app-wrtbwmon/tree/ff4909d8f5d06fee87f7ec5a365ac5dde6492130).

The old master branch has been renamed to old-master branch.
