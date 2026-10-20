# POTENTIAL THREAT — 音频资源目录 (SFX / BGM)

把文件按下面的名字丢进对应文件夹即可自动生效；**缺失的文件会自动回退到内置合成音**
(`src/core/sfx.js`)，所以你随时可以只替换一部分。

浏览器直接读本地文件，改完 **刷新即可**，无需打包。

```
audio/
├── sfx/            # 音效：短、无版权尾巴、建议 .ogg 或 .wav（<300KB）
└── bgm/            # 背景音乐：可循环的长音轨，建议 .ogg（2~6 分钟，无缝循环）
```

> 许可提醒：请只放你有权利使用的素材（CC0 / 自制 / 已购授权）。
> 可下载的免费源：pixabay.com/music、freesound.org、archive.org、freemusicarchive.org。

---

## 1. 音效 SFX — `audio/sfx/`

| 文件名 | 触发时机 | 期望气质 |
|---|---|---|
| `hover.wav` | 鼠标掠过可交互目标 | 极短的高频点击，音量很低 |
| `click.wav` | 确认/按下按钮 | 干脆的中频短音 |
| `deploy.wav` | 成功攻陷一个主机/节点 | 上行两音，像登录成功 |
| `reveal.wav` | 追踪完成，未知主机显形 | 明亮的双音上行 |
| `expire.wav` | 进程自然过期 | 下行滑音，无所谓 |
| `purge.wav` | 被反制扫荡清除 | 低频爆音 + 噪声 |
| `alarm.wav` | 进入人类防御区 / 警报 | 三连方波警报 |
| `relocate.wav` | 移动宿主 / 下令移动 | 短促的扫频 |
| `capture.wav` | 接管卫星、注入点数 | 上行大三度，明亮 |
| `riser.wav` | 关卡升级，镜头拉远 | 1.5s 上升扫频 riser |
| `land.wav` | 新关卡镜头落位 | 三连低-中-高确认音 |
| `logo_glitch.wav` | LogoType 标识闪现 | 数字故障噪声 |
| `select.wav` | 框选/选中单位 | 短促的电子选通音 |
| `move_order.wav` | 给单位下达移动指令 | 双击确认音 |
| `attack_order.wav` | 下达攻击指令 | 略显攻击性的双音 |
| `unit_hit.wav` | 单位受击 | 短促噪声撞击 |
| `unit_die.wav` | 单位被摧毁 | 下行爆裂 |
| `nuke_launch.wav` | 发射核弹 | 沉重的发射轰鸣 |
| `nuke_impact.wav` | 核弹命中 | 巨大低频冲击 + 长尾噪声 |
| `sat_burn.wav` | 卫星变轨点火 | 推进器低频持续音 |
| `gameover.wav` | 进程被终止 | 五音下行挽歌 |
| `victory.wav` | 达成奇点 | 五音上行 + 长尾 |

## 2. 背景音乐 BGM — `audio/bgm/`

游戏按关卡自动切换风格，每个风格里可以放**多首**，会随机/轮换播放：

### `techno`（Tier 1–4，进入城市/都会/洲际之前）
柏林 techno 直线：4/4 底鼓、128–135 BPM、offbeat bass、少量 hat、几乎没有旋律。
```
audio/bgm/techno_01.ogg
audio/bgm/techno_02.ogg
audio/bgm/techno_03.ogg
```

### `outsider`（Tier 5–6，星球级 / 星际级，线框地球与太阳系）
Outsider house：110–120 BPM、摇摆 hat、糊状 dub 和弦、磁带底噪、懒散人声切片感（纯器乐）。
```
audio/bgm/outsider_01.ogg
audio/bgm/outsider_02.ogg
audio/bgm/outsider_03.ogg
```

> 想指定外部直链（不想放本地）时，改 `audio/manifest.json` 里的 `url` 字段即可，
> 加载器会优先用 `url`，失败再读同目录的本地文件，再失败才用合成音。

---

## 3. manifest.json 说明

```json
{
  "sfx": { "deploy": { "file": "sfx/deploy.wav", "url": null, "gain": 1.0 } },
  "bgm": { "techno": [ { "file": "bgm/techno_01.ogg", "url": null, "gain": 0.6 } ] }
}
```
* `file` — 相对 `audio/` 的路径
* `url`  — 可选直链（跨域需允许 CORS）
* `gain` — 单条音量补偿

现在没有真实音频文件时，游戏会用内置合成器播放：
techno / outsider 两套程序化 BGM 是实时生成的，不会重复得一模一样。
