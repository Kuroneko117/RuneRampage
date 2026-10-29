# 《术式过载》V0.7 资源来源与授权记录

核对日期：2026-10-16。没有下载或复制《土豆兄弟》及其他游戏的角色、地图、商标、图标、音效。玩法参考不代表使用参考游戏的资源。

| 资源 | 原始/修改来源 | 体积与使用 | 授权记录 |
|---|---|---|---|
| `assets/resources/art/polish.png` | 本轮程序逐像素绘制；生成代码 `work/v07/make-pixel-art.cjs` | 256×512，30 图格，16,965 字节；术士/法杖/敌人/Boss/装备/特效共用 | 本项目原创生成，无网络图样或采样输入 |
| `assets/resources/art/arena.png` | V0.4 原程序图形流水线 `work/v04/generate-assets.cjs` | 256×256，19,876 字节；原文件保留，运行图集已替换 | 原工程程序绘制，未修改 |
| `assets/resources/art/golem.png` | V0.5 原巨像程序生成脚本 | 128×64，4,557 字节；原文件保留，运行图集已替换 | 原工程程序绘制，未修改 |
| 原有 7 个 WAV 音效 | V0.4 振荡器/包络合成，未采样商业音乐 | 合计 45,734 字节，沿用攻击/命中/暴击/金币/购买/过载/爆炸 | 原工程合成音，未增加外部音频 |
| `assets/resources/fonts/RuneSans.ttf` | Google Fonts 官方 Noto Sans SC；fontTools 固定 500 字重并裁切本局 UI 字集，改名 Rune Sans UI | 434 字符，106,892 字节；实际字体渲染，不靠系统中文字体 | SIL Open Font License 1.1，保留版权与许可证、改名规避保留字体名 |
| `assets/resources/fonts/OFL.txt` | 上述字体官方完整许可证 | 随资源包分发 | 字体内 name 元数据也保留原版权与许可信息 |
| `游戏图标-144.png` / `游戏图标-512.png` | 本轮术士像素生成函数导出 | 平台图标候选，未上传后台 | 本项目原创，与实际角色一致 |
| 面板、地图线条、符文、危险箭头 | 本项目 TypeScript / Cocos Graphics 绘制 | 没有新增大图或视频 | 本项目原创程序图形 |

Noto Sans SC 上游：[官方源码目录](https://github.com/google/fonts/tree/main/ofl/notosanssc)、[完整 SIL OFL 许可证](https://github.com/google/fonts/blob/main/ofl/notosanssc/OFL.txt)。上游版权记录为 © 2014–2021 Adobe，保留字体名 Source；本轮修改版使用 Rune Sans UI 家族名，不宣称上游背书。不单独出售字体，不更改 OFL 适用范围。完整字体 17.77 MB 只保存在开发缓存，不进入工程或微信包；不将开发用 Python 依赖打入成品。

图集脚本、字体裁切脚本 `subset-font.py`、434 字符核验记录 `font-subset.json` 保存在本次源文件和验证归档。后续增加中文文案时需要重新裁切字集并验证，否则新字可能缺字；不得直接恢复到体积巨大的全字体。

这里只记录已经检查的项目资源来源，不等于名称/商标检索、软件著作权登记、出版或平台审核证明。游戏名称及发行主体仍需用户在发布前核验；未制作或伪造登记/资质证明。

## V0.8素材来源更新

V0.7程序图已保留为源文件。本版改用用户认可的裁切素材，来源和授权边界见 [RESOURCE-LICENSES-V08.md](RESOURCE-LICENSES-V08.md)。用户认可不替代上游版权证明；正式发布前需核对。字体已扩充为441字符/108,852字节，继续遵守OFL。
