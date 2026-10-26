# 部署到 Crossfadio

本项目默认部署目标为 Crossfadio。用户说“部署”、`CPD` 或 `RCPD` 时，必须完成这个正式入口的发布与回读验证：

**https://crossfadio.com/games/xiaoqiang/**

ChatGPT Sites 仅在用户明确指定时发布。`.openai/hosting.json` 是此前 Sites 发布的配置，不决定本项目默认部署目标。

## 已核验的线上布局

- 阿里云 ECS：`cn-heyuan`，实例 `i-f8za4sz17v90uqryhia9`。
- 通过本机已有 `aliyun` CLI 凭据和 Cloud Assistant 执行远程命令，不复制认证信息到项目。
- Caddy 配置：`/etc/caddy/Caddyfile`，域名 `crossfadio.com` / `www.crossfadio.com`。
- `/games/xiaoqiang` 重定向到带尾斜杠的入口；`handle_path /games/xiaoqiang/*` 去除路径前缀，再从 `/var/www/little-strong-adventure/current` 提供文件，已启用 zstd/gzip。
- Crossfadio 主应用反向代理到 `127.0.0.1:4318`。这个端口上的同名路径会回退到主应用页面，不能用它代替正式游戏入口验收。

这些信息于 2026-10-26 从运行中的 ECS/Caddy 回读确认；执行发布前仍应检查 `current` 和现有发布目录布局。

## 发布流程

1. 检查工作区、目标提交和对应验证结果；代码变更按风险运行测试与构建。
2. 使用完整子路径构建，避免覆盖其他发布平台的构建产物：

   ```sh
   npm run build -- --base=/games/xiaoqiang/ --outDir=/private/tmp/little-strong-crossfadio-release
   ```

3. 将该目录内的静态文件打成 tar.gz，并计算 SHA-256。沿用 Crossfadio 现有 OSS 中转方式上传到私有 bucket `default-ycp424c1`（endpoint `oss-cn-shanghai.aliyuncs.com`），为 ECS 生成短时下载链接。签名链接只用于本次传输，不写入项目或日志。
4. 通过 Cloud Assistant 在既有游戏发布根目录中创建新的发布目录，下载、校验 SHA-256 后解压。保留旧哈希资源，兼容已打开页面的异步加载。
5. 保留原 `current` 指向的发布，使用临时软链接加原子重命名切换到新版本。仅替换游戏发布指针，不调用 Crossfadio 主应用的完整部署脚本，不修改其数据、配置或进程。
6. 回读正式域名的游戏 HTML、入口 JS、Phaser/场景脚本及代表性素材，校验内容或哈希与新发布一致。确认不带尾斜杠的入口重定向、压缩响应及 Crossfadio 主应用健康检查正常；失败时将 `current` 切回原发布。

云助手调用的 `RunCommand` 返回 `InvokeId`；用 `DescribeInvocations --InvokeId ... --IncludeOutput true` 查询执行结果，并同时确认实例执行状态和退出码。CLI 输出可能为 base64 或已解码文本，按实际输出处理。通用运维说明参考同机 Crossfadio 仓库的 `docs/ops-runbook.md`。

线上系统 Python 版本较旧，云助手的校验脚本应先确认 `python3 --version`，避免依赖 `str.removeprefix`、`subprocess.run(capture_output=...)` 等较新接口；校验失败必须回滚发布指针。
