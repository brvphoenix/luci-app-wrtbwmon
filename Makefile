#
# Copyright (C) 2017 Georgios Tzourmpakis <kiougar@gmail.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wrtbwmon
PKG_VERSION:=1.6.3
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Georgios Tzourmpakis <kiougar@gmail.com>

LUCI_TITLE:=A Luci module that uses wrtbwmon to track bandwidth usage
LUCI_DEPENDS:=+wrtbwmon
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
