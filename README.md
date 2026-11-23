# BW 2026 纪念页面

以 Bilibili World 2026「次元新航线」官网主 banner 为背景的非官方静态页面，无构建依赖。

## 本地预览

在项目目录运行 `python -m http.server 8080`，访问 `http://localhost:8080`。也可直接打开 `index.html`。

## 背景素材

2026-11-23 从 <https://bw.bilibili.com/#/> 的首页主 banner 获取，保存到本地避免跨站防盗链影响显示。素材版权归原权利方所有。

| 文件 | 官网原始地址 |
| --- | --- |
| `assets/bw-2026-banner.mp4` | <https://i0.hdslb.com/bfs/activity-plat/static/20260529/ab7d0705cc5350aa3cc844d35b41cabf/SC6MxG2VIq.mp4> |
| `assets/bw-2026-poster.jpg` | <https://i0.hdslb.com/bfs/activity-plat/static/20260601/ab7d0705cc5350aa3cc844d35b41cabf/U9ZY0WPYp5.jpg> |

背景视频为 1920 × 1080、5 秒循环，约 2.9 MB。视频失败时显示本地海报；系统开启「减少动态效果」时默认只加载海报，可手动播放。切换到后台会暂停视频。

活动日期为官网海报标示的 2026 年 7 月 10 日至 12 日。按日期计时使用北京时间零点作为边界，零点并非官方入场时间。

原页面制作鸣谢：lrastar / Gemini3 Pro。
