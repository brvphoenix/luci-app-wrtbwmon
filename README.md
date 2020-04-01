# luci-app-wrtbwmon

![CI](https://github.com/brvphoenix/luci-app-wrtbwmon/workflows/CI/badge.svg)
![GitHub All Releases](https://img.shields.io/github/downloads/brvphoenix/luci-app-wrtbwmon/total)

This repo is another LuCI module for wrtbwmon, which has similar features with [Kiougar's one](https://github.com/Kiougar/luci-wrtbwmon). Compared with the latter, this repo has supported more feature:
1. Support IPV6.
1. Recognise the hosts by the unique MAC rather than the IP.
1. Show the summation of the bandidth with progressbar.
1. For brevity, hide some column  defaultly.

**The LuCI for wrtbwmon in this repo is incompatible to the [pyrovski's one](https://github.com/pyrovski/wrtbwmon). You can download the compatible one from [here](https://github.com/brvphoenix/wrtbwmon).**

# Download
Openwrt 19.07 has been fully supported after commit: [ff4909d](https://github.com/brvphoenix/luci-app-wrtbwmon/tree/ff4909d8f5d06fee87f7ec5a365ac5dde6492130).

openwrt-19.07 [release-2.0.1](https://github.com/brvphoenix/luci-app-wrtbwmon/releases/download/release-2.0.1/luci-app-wrtbwmon_2.0.1-1_all.ipk)

openwrt-18.06 [release-1.6.3](https://github.com/brvphoenix/luci-app-wrtbwmon/releases/download/release-1.6.3/luci-app-wrtbwmon_1.6.3-1_all.ipk)

You can download the wrtbwmon form here: https://github.com/brvphoenix/wrtbwmon.

# Information
The current master branch is switched from the old new-dev branch since commit [ff4909d](https://github.com/brvphoenix/luci-app-wrtbwmon/tree/ff4909d8f5d06fee87f7ec5a365ac5dde6492130).

The old master branch has been renamed to old-master branch.
