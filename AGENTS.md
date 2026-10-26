# 项目开发要求

- 每个新增特性都要考虑流畅的动画，动画表现与状态过渡应随特性一起设计、实现和验收。
- 动画应兼顾操作响应和运行性能，并与游戏的暂停、继续、重开保持同步。

## 默认部署目标

- 本项目的“部署”、`CPD`、`RCPD` 默认指部署到 **Crossfadio**，正式入口为 `https://crossfadio.com/games/xiaoqiang/`。
- 只有用户明确指定时才发布到 ChatGPT Sites 或其他平台；不能以其他平台发布成功代替 Crossfadio 的部署验收。
- 构建必须使用 `--base=/games/xiaoqiang/`。沿用 Crossfadio 现有 Caddy 路由及 `/var/www/little-strong-adventure/current` 发布指针，只更新游戏静态资源，不重启或重新部署 Crossfadio 主应用。
- 发布前校验构建包，保留旧发布用于回滚；发布后回读正式入口及资源，确认线上实际版本。操作细节见 `docs/deployment.md`。
