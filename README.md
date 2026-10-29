# 术式过载 · RuneRampage

**在线试玩：[术式过载](https://kuroneko117.github.io/RuneRampage/)**

当前版本为 **V0.8.1 + 2026-10-29 品质修复**，基于 Cocos Creator **3.8.8**。本次重新构建网页版，包含四卡商店、Boss出生保护、可靠的可购装备、连锁/燃烧修复、精英识别、HUD与过载图标修正，以及此前确定的角色挤压伸展移动表现。

- 手机：战斗空白处拖动移动，自动施法；能量满后操作过载。
- 电脑：WASD / 方向键移动，Space 释放过载。
- 击败敌人收集金币，波末购买装备，挑战阶段Boss、20波与无限模式。

## 源工程与验证

根目录为网页发布构建；[source/](source/) 提供同版本 Cocos 工程与可编辑资源，打开 source/ 并使用 Creator 3.8.8 导入。新源码包括本地最新品质修复，原本机工程与微信发行包没有被覆盖。

本次新跑32项模型回归全部通过；隔离构建release Web成功；实际浏览器启动、进入战斗且无pageerror，截图与结果见 [验证证据](docs/github-sync-20261030/)。详细改动见 [品质修复报告](source/docs/quality-overhaul-20261028/REPORT.md)。

微信预览、物理手机触控、性能及平台正式发行尚未通过本次同步验收，浏览器验证不替代上述门禁。仓库不含账号私有配置、存档、SDK、引擎、缓存或签名材料。

许可与资源来源见 licenses/、source/RESOURCE-LICENSES*.md 及 THIRD_PARTY_NOTICES.md。游戏素材遵循各自许可，本仓库未额外授予游戏素材再分发权。
