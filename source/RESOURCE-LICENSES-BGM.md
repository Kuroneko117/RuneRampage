# 本轮背景音乐来源与使用记录

核查日期：2026-10-17。适用资源：`assets/resources/audio/music/bgm_*.mp3`。

## 音乐内容来源

五段旋律、低音、琶音与合成鼓声均在本项目的 [tools/create-bgm.py](tools/create-bgm.py) 中按本次任务独立编写，由正弦波及有限次谐波合成。没有下载或读取第三方曲谱、MIDI、音乐、录音、采样或其他游戏音频。沿用既有 `create-ambient.py` 的程序合成方式及110Hz音色家族，旧环境音文件连同原UUID保存在 `assets/art/audio-source`，不再进入运行资源。

这些新增音频作为本项目交付资源供《术式过载》使用，包括商业游戏构建；本交付未添加非商业或额外署名限制。不存在需要向第三方音乐作者署名的引入曲目。此记录描述实际制作过程，不是版权登记、独占性或音乐检索证明；既有角色、地图等素材的权利记录仍见原来的资源文档。

| 文件 | 内容 | 乐段时长 | 实际解码时长 | 压缩文件 |
|---|---|---:|---:|---:|
| bgm_menu.mp3 | 符文回廊，稀疏暗色琶音 | 6秒 | 6.084秒 | 12,168字节 |
| bgm_battle.mp3 | 术式脉冲，行进低音与节奏 | 8秒 | 8.100秒 | 16,200字节 |
| bgm_boss.mp3 | 巨像反应，低音压迫与密集短句 | 6秒 | 6.084秒 | 12,168字节 |
| bgm_shop.mp3 | 魔典休整，明亮稀疏分解和弦 | 6秒 | 6.084秒 | 12,168字节 |
| bgm_victory.mp3 | 终式解封，上行胜利短句 | 4秒 | 4.104秒 | 8,208字节 |

统一为16kHz、单声道、16kbit/s MP3，总计 **60,912字节**。实际时长含MP3编码延迟/填充，循环尾部保留短休止，首尾做短淡化。编码文件SHA256、原始PCM峰值和RMS见 [manifest.json](docs/boss-aura-bgm/audio/manifest.json)。开发用WAV试听副本位于 `docs/boss-aura-bgm/audio`，不在Cocos资源目录，不进入微信包。

## 编码工具核查

- 离线使用 **lameenc 1.9.0**；本机安装于 `D:/CODEX缓存/rune-audio-dev`，未加入项目运行依赖或微信包。
- 已读取该安装包的 `METADATA` 与 `licenses/LICENSE`，许可证标记为 **LGPL-3.0-or-later**；上游源码与许可见 [lameenc 官方仓库](https://github.com/chrisstaite/lameenc) 和 [LICENSE](https://github.com/chrisstaite/lameenc/blob/main/LICENSE)。许可针对编码工具，未将其二进制或源码嵌入小游戏。工具输出与工具本体的区别参见 [GNU 官方 FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#GPLOutput)。
- 未引入音乐生成服务、付费素材订阅、外部CDN或在线音乐依赖。

重新生成：在开发Python环境安装 `numpy` 与 `lameenc==1.9.0` 后执行 `python tools/create-bgm.py`。这些属于离线制作依赖，手机端只播放生成后的MP3。

## 引擎接入依据

使用 [Cocos Creator 3.8 音频系统](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/overview.html) 的 `AudioClip` / `AudioSource`，同时核对本机3.8.8源码的 `play`、`pause`、`stop`、`currentTime` 和小游戏音频适配。小游戏走Cocos适配后的微信音频实现，没有另建一套 `wx` 音频播放器叠播。
