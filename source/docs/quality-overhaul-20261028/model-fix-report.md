# 四项模型逻辑修复与回归报告

日期：2026-10-28 至 2026-10-29。基线：`6a5dd6c676ec15ed358272e021598e0ad51febe8`。工程锁定 Cocos Creator **3.8.8**，使用其随附 TypeScript **5.8.2** 和 bundled Node **v24.22.1**。本切片只修改 `assets/scripts/ArenaModel.ts`、新增模型测试，并写入本报告及 `model-test-build/` 下自身证据；没有提交、推送、发布或操作共享预览。

模型文件 SHA-256：`C77FD01FE46F6C940860D850901791EE6DD9A3673B79ADF1291AAF4A8639DE7C`。生产代码差异为 31 行增加、11 行删除。测试从源码编译执行真实模型；没有替换游戏模型、加入测试入口或调用微信 SDK。采用 router、systematic-debugging、test-driven-development、verification-before-completion；技能目录没有覆盖 Cocos 的引擎专项技能，本次没有引擎 API 改动。

## 已修行为

1. **Boss 安全进场**：四条合法边缘投影点中选择距离玩家最近的安全候选，中心距至少为 Boss 半径52 + 玩家半径18 + 现有普通进场裕量70，即140。保留合法边缘、10秒进场、原有血量/速度/技能与25秒截止。贴边时可能改从另一条边进入；仍需实际预览检查镜头提示。移除了原来的临时距离数组，没有增加战斗帧分配。
2. **首次商店可负担选择**：存在可负担普通装备时，首格优先未持有的普通装备，其次普通升级；价格、品质升级计算、去重及等级上限不变。此保证只在 `enterShop` 生效，付费刷新保留随机。Boss店在至少有两项未满装备时把稀有保证留给后续卡位；仅剩一项时优先保留原稀有奖励。无可负担项时不降价、不发币。新增筛选数组只在进店生成卡牌时产生，没有新增固定步长分配。
3. **爆链圆心**：以原爆心搜索2倍半径范围内的最近目标，消除向右偏移。延迟0.16秒、半径0.7倍、伤害0.5倍、单次子链和禁递归保持；超出真实2r范围不再误触发。
4. **燃烧末跳一致性**：先结算本跳伤害，再扣除剩余燃烧时间，使最后一跳致死仍能传火/火爆。没有增加跳数、延长持续时间或改变伤害；到期后被普通攻击击杀仍不触发高级燃烧效果。

没有修改素材、UI、其他工程配置、正式AppID、广告位、签名、正式构建产物或锁定引擎。

## 测试结果与证据

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 新回归测试跑原基线 | **17通过、15失败，exit 1**；四项缺陷均被抓住 | `model-test-build/before/results.json`，同目录保留实际转译模块 |
| 新回归测试跑修复源码 | **32通过、0失败，exit 0** | `model-test-build/after/results.json`，同目录保留实际转译模块 |
| Creator TypeScript严格模型检查 | `--noEmit --strict --skipLibCheck --target es2020 --module commonjs assets/scripts/ArenaModel.ts`，**exit 0** | 实际命令输出为空，无类型错误 |
| `boss-music-regression.cjs`原测试 | **6/6通过，exit 0** | `model-test-build/existing/logic-results.json` |
| `platform-and-revive.cjs`原测试 | **13/13通过，exit 0** | `model-test-build/existing/platform-results.json` |
| 历史逐秒全等 `gameplay-parity.cjs` | **失败，未声称通过**；首次差异发生于商店后购买结果 | `model-test-build/historical-parity.log`、`long-run-results.json` |
| 独立长期流程/对象池断言 | **通过，exit 0** | `model-test-build/long-run-results.json` |
| `git diff --check -- assets/scripts/ArenaModel.ts` | **exit 0** | 无空白错误 |

32项覆盖四边/四角/中心的出生无伤及合法边缘、接近玩家、接触/符文/冲刺仍伤血、四个Boss波仅一次进场；商店20币夹具、无未持有装备时的可买升级、无钱不赠送、Boss稀有保证、仅一项/全满、购买扣款与售出幂等、付费刷新；爆链四向镜像、真实2r边界外不触发、衰减延迟与禁递归、16个爆炸池上限；Lv4/Lv5末跳及非末跳击杀、Lv0–3不触发高级效果、已过期普通击杀不传播、4秒60Hz保持8跳。另覆盖Boss早死奖励只一次、25秒结束、20波生存胜利及无限21波继续。下一波会关闭购买；没有擅自增加清空旧报价数据的行为。

现有历史全等测试固定对比 `562e000a08186aa9135ab7f297913180e4572c5d`；本次首次进店选择修复会改变购买和后续构筑，因此不再能把整段历史轨迹相等作为通过标准。诊断没有改该测试源文件，也没有重新录制/放宽其断言。seed3在tick3001首次不同，当时同为第3波、位置/血量/击杀一致，金币从旧4变为新20；seed17/71在tick4501首次不同，同为第4波，其余采样字段一致，金币分别从25变13、45变5。此前逐秒样本相同；两种模式一致。完整差异字段和序列见JSON。后续若保留此测试，需要在接受本次玩法变更后另行维护它的基线或职责。

长期夹具结果：

- campaign：**30,000帧、500秒、wave20 victory**，Boss进入4次；峰值63怪/80弹/61币/6威胁。分配计数64怪/80弹/62币/16爆炸/48事件/6威胁。
- endless满装：**54,000帧、900秒、wave50**，Boss进入8次；峰值96怪/80弹/64币/9威胁。分配计数96怪/80弹/64币/16爆炸/64事件/9威胁。

**上述长期流程使用外部强制无敌、脚本自动购买和移动；endless额外使用满装备并从第15波开始。它们验证计时、循环与池上限，不能当作自然通关、胜率、平衡、实际玩家体验或手机帧率。** Node整体耗时也不代表Cocos渲染或微信真机性能。没有为了报告重复执行已完成长测。

## 可复现命令

在工程根目录 PowerShell 执行；变量仅指向本机已存在的工具，不安装依赖。

```powershell
$runeNode = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $runeNode tools/tests/quality-model-regression.cjs before 6a5dd6c
# 预期原基线 exit 1：17 passed; 15 failed。只用 git show 读取，不切换/还原工作区。
& $runeNode tools/tests/quality-model-regression.cjs after
# 预期修复源码 exit 0：32 passed; 0 failed。
& $runeNode 'D:\WeChatGameDev\Tools\CocosCreator\3.8.8\resources\app.asar.unpacked\node_modules\typescript\lib\tsc.js' --noEmit --strict --skipLibCheck --target es2020 --module commonjs assets/scripts/ArenaModel.ts
& $runeNode docs/quality-overhaul-20261028/model-test-build/run-existing.cjs tools/tests/boss-music-regression.cjs
& $runeNode docs/quality-overhaul-20261028/model-test-build/run-existing.cjs tools/tests/platform-and-revive.cjs
# 需要重跑长测时才执行：
& $runeNode docs/quality-overhaul-20261028/model-test-build/long-run.cjs
```

`run-existing.cjs`执行原测试源码，仅把其写出的报告重定向至本切片独占的 `existing/`，避免覆盖其他工程/QA证据。仓库 `package.json` 没有统一 `test` script，因此按影响范围运行现有模型流程、复活和平台逻辑测试；没有运行需共享浏览器的UI测试。

## 待主流程验收

这是纯模型工程证据，没有新增Cocos运行截图，未宣布UI/视觉通过。还需实际Cocos构建复验Boss安全进场的可读性、商店四卡展示及交互。该切片没有运行包体构建，3MiB包体预算由主流程对最终整合包实际计量；测试与临时转译文件位于 `tools/`、`docs/`，未导入 `assets/`。微信真机触控、安全区、生命周期、帧时、内存、平台接口和正式发布资料仍按各自门禁验收。
