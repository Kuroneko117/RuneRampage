# 单手过载图标来源

核查日期：2026-10-17。

- 作者：**Henrique Lazarini（7Soul1）**。
- 发布页：[496 pixel art icons for medieval/fantasy RPG](https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg)。已读取该页面的作者、CC0标记及说明，使用其重新打包的496图标版本，未从其他游戏提取图片。
- 具体选用：`I_Crystal01.png`，通用蓝色晶体，34×34。原图保存在 `assets/art/third-party/7soul`；原图SHA256见 [资源清单](docs/one-hand-overload/asset-manifest.json)。未将整包素材放进Cocos运行资源。
- 许可：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，允许复制、修改、分发及商业使用，不要求署名。不暗示作者为本项目背书；仍保留作者和来源记录。
- 接入处理：去除ICC等文件元数据、调色板PNG压缩；**可见像素和Alpha逐像素一致**，透明像素RGB归一化；没有重绘或改变该晶体图形。运行文件 `assets/resources/art/ui/overload.png` 为 **328字节**。Nearest过滤、Clamp、关闭Mipmaps。
- 按钮镶座、分段能量槽、按下/就绪状态为本项目Cocos原生组件/Graphics绘制，复用现有暗色像素UI色板。没有引入外部UI框架、着色器或大型贴图。

另核查过Game-icons.net等候选；本轮没有使用这些候选资源，避免将候选授权误记成实际素材来源。

新文案的五个汉字补入原Noto Sans SC子集，保留原OFL许可证和“Rune Sans UI”修改家族名，未更换成完整大字体。旧537字符保留，当前542字符、136,028字节，原字体UUID不变。

本记录说明新增文件的实际来源与许可。项目既有角色、地图和音频的来源仍分别以原资源记录为准。
