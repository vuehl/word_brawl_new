# 多人联机部署与扫码测试

游戏已增加首页「多人联机」入口，支持 **2–4 人合作**：创建六位房间号、加入、选伙伴、准备、房主开局、队友移动、怪物与攻击、拆字状态、救援及换区沿用原合作玩法。单人入口继续可用。

需要在服务器上运行一个独立的联机服务，**不用重新部署整个游戏，也不用安装数据库**。游戏和资源仍由微信预览包提供。默认地址已设置为截图中的 `ws://192.168.8.55:8787/ws`。

这次摇杆、清晰度和邀请入口的更新只改客户端，联机协议保持兼容；已部署的 `8787` 后端无需替换。所有测试手机需要扫重新生成的预览码，才能加载修复。

## 1. 上传后端

准备好的文件在 `backend/dist/`：

- `ziling-server-linux-amd64`：Linux x86_64 独立程序，使用 `CGO_ENABLED=0` 编译，无需 Node.js、Go 或 npm。
- `ziling-coop-linux-amd64.zip`：便于上传的发布包，包含上述程序、服务配置、本文和校验值。
- `ziling-server-windows-amd64.exe`：仅用于 Windows 本地测试。

截图显示 CentOS 7.9。静态 Go 程序避免新版 Node.js 对 glibc 的依赖；仍需在目标机器执行下面的检查并实际启动验证。构建和双客户端验证在本地完成，没有登录或修改你的服务器。

在 MobaXterm 中执行：

```bash
uname -m
uname -r
```

本文的二进制要求 `x86_64`、Linux 内核 3.2 或更新。若是 `aarch64`，需要重新编译为 arm64。最低内核要求参考 [Go 官方说明](https://go.dev/wiki/MinimumRequirements)。

用 MobaXterm 左边的 SFTP 面板进入 `/root/`，从本地拖入这两个文件：

1. `backend/dist/ziling-server-linux-amd64`
2. `backend/ziling-coop.service`

也可以上传 zip 后解压，再将里面的这两个文件放到 `/root/`。

## 2. 先手动运行验证

在服务器终端依次执行：

```bash
mkdir -p /opt/ziling-coop
install -m 0755 /root/ziling-server-linux-amd64 /opt/ziling-coop/ziling-server
/opt/ziling-coop/ziling-server -listen 0.0.0.0:8787
```

看到「字灵联机服务 … 监听 0.0.0.0:8787」后，在另一个 SSH 终端执行：

```bash
curl http://127.0.0.1:8787/healthz
```

应返回包含 `"ok":true` 和 `"service":"ziling-coop"` 的 JSON。手动运行的终端此时不能关闭；验证成功后按 `Ctrl+C`，再设置下面的常驻服务。

## 3. 配置开机启动

以下命令只创建本游戏的服务账号和服务：

```bash
id ziling >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin ziling
install -m 0644 /root/ziling-coop.service /etc/systemd/system/ziling-coop.service
systemctl daemon-reload
systemctl enable ziling-coop
systemctl start ziling-coop
systemctl status ziling-coop --no-pager
curl http://127.0.0.1:8787/healthz
```

查看日志与更新服务：

```bash
journalctl -u ziling-coop -n 60 --no-pager
```

更新二进制时先停止服务，替换后启动；更新会中断当前房间：

```bash
systemctl stop ziling-coop
install -m 0755 /root/ziling-server-linux-amd64 /opt/ziling-coop/ziling-server
systemctl start ziling-coop
```

## 4. 放行端口并检查手机网络

截图显示 firewalld 已开启。确认实际网卡所在 zone：

```bash
firewall-cmd --get-active-zones
```

若实际 zone 为 `public`，执行下列命令；如输出为其他 zone，把 `public` 改为它：

```bash
firewall-cmd --permanent --zone=public --add-port=8787/tcp
firewall-cmd --reload
```

如果服务器还受云安全组、宿主机防火墙、路由器 ACL 管理，也要允许测试手机所在内网访问 TCP 8787。无需关闭防火墙。

让所有测试手机连到**可以路由访问 `192.168.8.55` 的 Wi-Fi/内网**。用手机浏览器打开：

```text
http://192.168.8.55:8787/healthz
```

必须先看到 `ok: true`。相同 Wi-Fi 名称不一定保证互通：访客网络、AP 隔离、不同 VLAN 可能阻断访问。截图中的登录来源是 `192.168.63.69`，与服务器不在同一地址段；是否已有跨网段路由，要以上述手机访问结果为准。

`192.168.8.55` 是私网地址。朋友使用外地 Wi-Fi 或移动流量不能直接连它。预览二维码只用于加载游戏，不会把内网服务器变成公网服务器。

## 5. 微信重新预览扫码

本次已更新 `minigame/` 运行包。用微信开发者工具打开包含 `project.config.json` 的项目根目录 `D:\微信小游戏改`，重新编译，然后点击「预览」生成新的二维码。

1. 开发者工具「详情 → 本地设置」中保留「不校验合法域名、TLS 版本以及 HTTPS 证书」。项目中 `urlCheck` 已设为 `false`。
2. 测试人员需有当前小游戏的开发/预览权限；体验成员使用上传后设置的体验版二维码，不能假定任意微信号都能扫开发预览码。
3. 每台手机扫同一版新二维码。同网段局域网通信可直接尝试创建/加入房间，无须先点调试。如果遇到 `url not in domain list`，先核对手机的 Wi-Fi IP、子网掩码及服务器地址；跨网段预览测试可在「多人联机」顶部点击「开启手机调试」，按微信提示确认，然后**完全退出小游戏，再扫描这份二维码进入**。需要调试的手机分别设置；已开启时不用反复点击。入口仅在支持接口的开发/体验版显示；旧微信可从手机右上角「···」菜单开启调试。电脑点击「预览」或勾选不校验选项，都不能代替手机端的调试设置。页面状态来自微信接口，开启调试不代表已经连上后端，仍需成功创建/加入房间来确认。
4. 游客登录并选择初始伙伴，进入首页，点击「多人联机」。每人可填写昵称、选择伙伴。
5. 第一人「创建房间」，点「邀请好友」打开微信分享面板。朋友从带房间信息的邀请进入后，会打开联机页并填入六位房间号，再点「加入房间」。邀请支持冷启动和小游戏已打开时再次进入，不会自动离开正在进行的对局。
6. **预览版最直接的组队方式**：把同一份新预览二维码给朋友；房主点「复制房间号」，发给朋友。朋友扫码进入首页 → 多人联机 → 粘贴房间号（或手动输入）→ 加入房间。分享卡片受小游戏版本和成员权限限制，不能代替首次进入预览版的权限。
7. 房主可切换难度；每个人点击「准备」。界面会列出还没准备的人；至少 2 人且全员准备后，房主点「开始冒险」，全队进入同一局森林。

第一次开房/加入会先加载战斗资源，请等待「正在处理」完成。换伙伴或难度后需重新准备。已开局房间不允许中途加入。「怎么玩」按钮中有完整组队说明。

战斗时，**左侧按住拖动摇杆移动，右侧空白区域拖动转镜头**；默认自动攻击，右侧按钮分别用于跳跃、冲刺、终极技等。支持一边移动一边转镜头或按技能；松手、触摸取消和切后台都会释放摇杆。单人和多人共用修复后的输入。

手机场景与界面独立设置分辨率。安卓高清屏界面最多 3 倍像素密度、清晰档场景最多 2.5 倍；iOS 普通模式的界面最多 2 倍、场景最多 1.5 倍且不超过 80 万像素，并关闭泛光和描边以降低开销。动态降分辨率保留至少一个逻辑像素对应一个场景像素的下限，界面文字不跟随场景一起降档。手机不再仅因屏幕尺寸而默认开启省电模式；之前手动选择的偏好会保留。首页「设置 → 画面」可选「清晰 / 均衡 / 流畅」。

相关微信官方文档：[网络能力](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/network.html)、[局域网通信](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/mDNS.html)、[wx.connectSocket](https://developers.weixin.qq.com/minigame/dev/api/network/websocket/wx.connectSocket.html)、[成员与版本](https://developers.weixin.qq.com/miniprogram/dev/framework/quickstart/release.html)。2026-11-04 已直接读取前两份官方文档，确认同网段、非本机 IP 的局域网连接支持 HTTP/WS，免安全域名校验；手机菜单及连接结果仍需真机验证。

## 6. 换 IP、外网访问或正式体验版

修改 `source/src/multiplayer-config.js` 中的 `url`，然后在本地项目根目录构建：

```powershell
node tools/build.mjs
```

构建工具尚未安装时先运行 `npm ci --prefix tools`。修改地址后必须重新生成预览码，旧码内的游戏仍使用旧地址。

如果要让其他网络的朋友加入，或需要跨网段免调试连接：

1. 准备手机可访问的公网入口和域名（公网服务器，或转发到该内网服务器的入口）。
2. 为该域名配置有效证书并提供 `wss://域名/ws`。项目提供 `nginx-wss.conf.example` 供反向代理参考，需要替换域名和证书路径；现有 Nginx 配置应先备份，运行 `nginx -t` 通过后才重载。
3. 在微信公众平台为该小游戏配置对应的 socket 合法域名，按平台要求完成域名/备案配置；客户端切换到对应的 `wss://` 地址后重新构建、上传或预览。
4. 公网部署时把服务监听改为 `127.0.0.1:8787`，由同机 Nginx 代理，只对外开放所需的 HTTPS 端口。

**这个版本是好友/内网合作版本**。后端管理房间和转发消息，战斗判定由客户端协作完成；昵称不等同于微信身份，没有账号鉴权、反作弊或公共匹配系统。需要运营公开游戏时，应另做微信登录校验和服务端战斗权威逻辑。服务有房间/连接/消息大小上限及心跳清理，不应据此视作生产运营后端。

## 7. 常见问题与当前边界

当前服务器 `192.168.8.55:8787` 已由你部署并启动，截图显示 systemd 为 `active (running)`；手机能看到 `/healthz` 返回 `ok:true`，开发电脑也已验证 WebSocket `ping/pong`。最新手机错误为 `fail: url not in domain list`，表示微信的合法域名校验阻止了连接。你提供的手机 Wi-Fi IP 是 `192.168.106.119`、子网掩码 `255.255.255.0`，服务器 `192.168.8.55` 位于手机的本地网段之外，因此不满足微信同网段局域网免校验条件。当前跨网段预览可按第 5 节开启调试；免调试方案是让手机通过实际网络接入与服务器相同的网段，或配置合法域名与 WSS。不要只手动把手机 IP 改成 `192.168.8.x`，接入网络及路由也必须对应。

游戏内入口通过微信官方 `wx.setEnableDebug` 请求开启调试，并通过 `wx.getAppBaseInfo().enableDebug` 读取状态；较旧基础库回退到 `wx.getSystemInfoSync`。调用失败会显示原始原因，不自动开启或把 API 成功当作网络连接成功。调试按钮是可选的测试入口，不是开房前置条件。跨网段正式免调试访问可配置 WSS 与 socket 合法域名，不能只把 `ws://IP` 文本替换成 `wss://IP`。后端也可以继续部署在当前内网主机，通过内网 DNS、有效证书和合法域名提供 WSS；同网段直连方案无须因此购买云服务器。

以后遇到服务未启动或手机无法访问 `/healthz` 时，再在服务器 SSH 终端执行以下只读检查：

```bash
systemctl status ziling-coop --no-pager
ss -lntp | grep ':8787'
curl --connect-timeout 5 http://127.0.0.1:8787/healthz
curl --connect-timeout 5 http://192.168.8.55:8787/healthz
journalctl -u ziling-coop -n 40 --no-pager
firewall-cmd --get-active-zones
```

没有监听时，按第 3 节启动服务；只监听 `127.0.0.1:8787` 时，内网直连需要改为 `0.0.0.0:8787` 后重启服务（会中断已有房间）。本机两个 healthz 都能打开但手机打不开时，再按第 4 节检查对应 zone 的防火墙和内网路由。

| 现象 | 检查方法 |
| --- | --- |
| 服务器本机访问 healthz 失败 | 看 `systemctl status ziling-coop` 和 `journalctl`，检查端口占用与执行权限 |
| 服务器能访问，手机不能访问 | 检查手机 Wi-Fi 路由、服务器防火墙、安全组、VLAN、AP 隔离 |
| 手机浏览器能访问，游戏仍连不上 | 核对手机 IP/掩码与服务器是否同网段、游戏包中的地址及错误详情；能通过路由访问不等于同网段免校验 |
| `url not in domain list` | 微信域名校验阻止连接。让手机与服务器同网段，或在开发/体验版开启调试；跨网段正式使用需配置 WSS 和 socket 合法域名 |
| `decodeAudioData(...).catch` 报 undefined | 微信音频解码采用回调返回结果；客户端已增加 Promise 适配及超时处理。重新编译并扫新预览码，Go 后端无需更新 |
| 队员开局报 `Can't find variable: setTimeout` | 客户端已在主包捕获原生定时器，并显式传入玩法分包和音频适配层，避免依赖分包的全局定时器。两台手机完全退出旧预览后扫同一份新码，重新建房；Go 后端无需更新。若新包仍报 `LifeCycle.load` / `WAGame.js`，需记录这台手机的微信版本与完整错误，继续确认微信自身的加载问题 |
| iPhone 微信 8.0.68 仍报 `LifeCycle.load`，看不到加载画面 | `1104.2` 客户端已将 `game.json` 的 `iOSHighPerformance` 关闭，切换普通模式作为兼容处理；这会改变 iOS 渲染环境，性能需真机复测。原生加载提示覆盖启动、资源下载、生成森林和绘制战斗画面。截图中的白色 `vConsole` 是调试面板，可点绿色按钮收起后查看游戏。建议先更新微信，再扫新预览码；仅修改业务定时器不能保证修复微信内部加载错误 |
| 开局初始化失败后无法操作 | 已增加退出失败房间、清理未完成的战斗并恢复联机大厅的处理，页面显示实际原因，可返回首页或重新组队 |
| 房间不存在或版本不一致 | 确认所有人扫同一版新预览码、输入六位房间号；服务重启后旧房间失效 |
| 房主开始按钮不可点 | 至少两人且所有人准备；修改伙伴/难度会取消准备 |
| 好友无法打开分享卡片 | 先用同一份新预览二维码进入，再复制／粘贴六位房间号；检查成员权限 |
| 摇杆仍不动或显示旧联机页 | 退出旧预览版，重新编译并扫新预览码；确认手机没有仍在运行旧包 |
| 端口已被占用 | 使用其他空闲端口，同时修改服务启动参数、防火墙和客户端配置 |

进度和结算仍保存于各自手机。服务重启会清空房间，不会删除手机存档。断线、退出或切后台导致连接关闭后没有中途重连功能，需要重新组队；断线玩家会结束本局，其余仍在线成员可继续。等待大厅的房主离开时，房主转交给剩余成员。所有人退出后自动清理房间；房间最长存活六小时。

## 开发与测试

后端源码在 `backend/`，WebSocket 依赖已 vendor，锁定版本与许可证随源码提供。无需在部署机器上下载依赖。重编译需要本地 Go 1.24 或更新：

```powershell
./backend/build.ps1
node --test tools/test-multiplayer.mjs
node --test tools/test-invites.mjs
node --test tools/test-coop-debug.mjs tools/test-socket-errors.mjs
node --test tools/test-audio.mjs tools/test-surfaces.mjs
node --test tools/test-timers.mjs tools/test-coop-start.mjs
node --test tools/test-runtime-info.mjs
node --test tools/test-coop-sync.mjs tools/test-hero-performance.mjs
node --test tools/test-graphics-profile.mjs tools/test-touch-layout.mjs
node --test source/tools/lite.test.mjs
node tools/build.mjs
node tools/multiplayer-smoke.mjs
node tools/performance-smoke.mjs
node tools/smoke.mjs --phone-layout --controls-only --ios
node tools/verify-assets.mjs
```

双客户端测试运行微信构建入口和 SocketTask 适配，使用隔离存档、真实 WebSocket 后端及 Chrome WebGL。截图和结果写入 `验收/多人联机/`。它不代替目标 CentOS 主机启动、微信真机网络、真实设备帧率和完整自然通关验收。

队员测试额外屏蔽玩法分包的全局定时器，只允许通过主包捕获的 `GameGlobal` 定时器启动，验证开局、移动和消息同步。单元测试覆盖开局初始化、进入画面渲染及退出房间失败时的界面恢复。这些是本地模拟兼容验证，不能代替报错 iPhone 上的实际验证。

苹果兼容版核对：重新编译、预览后，双方完全退出旧包，扫同一份新码；联机页应显示「联机修复版 1104.4」。点击「诊断信息」可查看并手动复制机型、微信版本、实际基础库版本、实际运行模式、加载阶段和最近错误；信息只保留在本次游戏内，不自动上传或发送。新增首页与战斗最近的实测帧率、帧间隔、计算／场景／界面调用耗时和画面像素尺寸，退回首页后仍保留上次战斗样本。若仍卡顿，先正常玩一会儿，再回联机页复制信息。场景耗时是 JavaScript 调用时间，不能当作 GPU 计时。加载提示会先等待画面提交，再开始同步场景初始化；进入成功或异常退出都会关闭加载遮罩。

运行模式依据：[微信高性能模式说明](https://developers.weixin.qq.com/minigame/dev/guide/performance/perf-high-performance.html)。该模式与普通模式运行环境不同；在目标 iPhone 完成兼容性和性能验证之前，不直接恢复高性能开关，也不把桌面 Chrome 的通过结果当作 iOS 真机通过。

2026-11-04 本轮真机反馈：用户使用新预览包后，已确认报错的苹果手机能看到战斗画面。当前保留普通模式。开局会等待实际战斗首帧；首帧抛错或 20 秒仍没有战斗画面时，会走失败恢复流程，并在诊断信息中保留原因。

随后用户反馈首页和战斗都严重卡顿，`1104.3` 因此调整普通 iOS 的渲染预算：首页目标 20 FPS，战斗默认目标 30 FPS；手动指定的帧率仍尊重设置。静止首页每 500 ms 最多补绘一次，文字变化和触摸会提前刷新；战斗 HUD 每 120 ms 刷新，摇杆独立更新。界面结构没变时复用排版。修复原先忽略超过 250 ms 的慢帧、导致越卡越不降分辨率的问题，并按实际帧率目标判断降档，避免稳定 30 FPS 被当作异常。`performance-smoke.mjs` 在生成包上检查像素预算、界面重绘和布局复用，结果在 `验收/苹果性能/`；Chrome 测试只验证工作量和功能，不能证明某台 iPhone 能达到 30 FPS，仍需这次新包的真机反馈。

`1104.3` 的本地性能回归：22 项针对性测试、双客户端联机和 iOS 普通模式触控流程通过。844×390 逻辑尺寸的清晰档场景从 2110×975 调整到最多 1266×585，界面保持 1688×780；静止首页在模拟一秒的 60 次界面调用中，从 12 次完整排版降到 1 次刷新、0 次布局重建。触控验证覆盖三个摇杆缩放档位、双指、松手、后台恢复、暂停和升级选择。四人短横屏房间中「诊断信息」及房主开始按钮保持可见。

`1104.4` 针对苹果作为队员时的卡顿与开局时间不同步继续优化。所有成员的场景、区域资源和首帧准备好后，通过已有 Go 服务的控制消息校准设备时钟；房主发出共同开始时刻，各端确认后倒计时进入战斗。加载期间战斗时间保持为零，不提前刷怪、移动或攻击。任一成员加载失败、断线、切后台或等待超过 90 秒，整队取消开局并提示重新组队。需要双方都扫同一份新版预览码；服务器无需更新，也无需重启服务。

iOS 普通模式主角笔画画布从 512×512 调整为 384×384，常态动画纹理最多每秒更新 15 次，攻击即时刷新；关闭该动态纹理的 mipmap 重建。位置和触摸输入仍逐帧更新。战斗标签更新间隔为 100 ms，小地图为 200 ms。`test-coop-sync.mjs` 覆盖慢设备、四人不同时钟、确认缺失、掉线与超时；`test-multiplayer.mjs` 用现有 Go 程序验证同步消息与加载失败传播；`test-hero-performance.mjs` 检查重绘次数和位置连续更新。真机流畅度仍以新版预览后的诊断信息为准。

`1104.4` 本地验收：29 项针对性测试、完整双客户端联机、iOS 普通模式触控流程、性能工作量检查及 1,078 项资源核验通过。刻意延迟队员加载时，房主战斗计时、位置和击杀数保持为零；双方使用同一个开始时刻。构建包模拟一秒内调用 HUD 60 次，标签更新 10 次、小地图 5 次、触控仍为 60 次。双客户端结果在 `验收/多人联机/result.json`，性能结果在 `验收/苹果性能/optimized.json`，触控截图在 `验收/苹果触控1104.4/`。这些结果验证逻辑与工作量，不代表真实 iPhone 的帧率。

摇杆回归连续跨帧按住验证输入与角色位移，并覆盖双指操作、松手、取消和切后台，避免把碰撞造成的一小段位移误判为移动成功。邀请测试覆盖复制／粘贴、分享参数和再次进入；高 DPI 测试直接核对场景与 UI 的实际像素尺寸。分享面板在自动化测试中使用模拟回调，不会发送真实微信消息。

本次本地验证通过：四人房间协议联调、两个隔离微信运行环境的触屏开房/加入/准备/开局、相同地图种子、队友移动、共享怪物、队友攻击造成真实伤害并同步「正 → 止」、断线结束、本机合作记录保存。原单人测试、横屏布局流程、1,078 项资源映射及资源包哈希核验也通过。
