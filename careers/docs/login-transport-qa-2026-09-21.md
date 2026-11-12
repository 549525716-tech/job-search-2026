# 登录 blank 故障独立 QA

## 限定结论

CLI 隔离限定通过，未发现本范围内的阻塞缺陷；一次独立运行三个指定测试文件，32/32 通过。原生 Chrome 的页面操作链路恢复有记录支持；猎聘账号、列表及一条完整详情通过；BOSS 仅正常首页和登录页通过，账号及登录后详情未验证。调试连接兼容性只是疑点，精确顶层跳转发起者未锁定，不得称“根因已修复”或“两平台登录整体完成”。

本报告由未参与实现的 QA 会话撰写，没有现场重新操作浏览器或联网验证。证据初审快照：2026-09-21 21:03:13；最终测试后校验：21:07:05，均为北京时间。收到最终就绪通知后仅执行一次指定测试，测试启动的是 Node handler 子进程，并创建、清理测试自身临时目录；没有运行真实 Chrome、旧 daemon、危险 mutation 或读取凭证。唯一项目持久写入文件为本报告，未改实现、配置、测试或进度。执行模型与推理档位无法由本会话独立核验，不冒称已核验 Astra xhigh。

## 发现与边界

1. **初审口径问题已由本次验收补足，进度待负责人同步。** 初审时 `careers/docs/login-diagnosis-2026-09-21.md:31` 及交接文档将 CLI 隔离写成现状，而实现仍在修改，不能提前当作已验收证据。最终源码检查和 32/32 测试现支持“CLI 入口隔离通过”，但不支持平台根因修复。末次读取 `login_diagnosis_2026_09_21.cli_isolation` 为 `implemented_exit_2_native_UI_handoff_independent_verification_pending`；这是验收回填待办，不是本次代码阻塞。QA 不修改该字段。
2. **BOSS 的正常登录页不等于可立即扫码或账号已登录。** d14 在地址栏正常、主页面完整的同时出现“请重新刷新二维码”。这不构成顶层 blank 复发，也不能据此证明账号失效原因；仅说明末次二维码状态不能报告为可用。QA 没有刷新二维码或页面。
3. **未发现指定文档或新进度字段宣称“精确根因已修复”。** 它们明确保留未知边界。d03 的调试提示、d06/d09 的 `Debugger unattached` 与原生页面正常只能支持相关性；不能证明某个扩展、站点脚本、Codex 调用或旧 CLI 是跳转发起者。

## 逐项证据

证据根目录：`01_行情收集/official-careers/research/login-root-cause-2026-09-21/`。表内时间为北京时间，JSON 内为 UTC。解析并核对全部 8 个指定 JSON；JSON 字符串内的 AX 节点编号用于定位，不是文件行号。

| 项目 | 状态 | 原始依据与可支持的结论 |
| --- | --- | --- |
| 真正顶层 blank | 通过 | `raw/d03-blank-readback.json`，20:43:16，`result` 地址栏节点 9 为 `about:blank`，窗口标题一致，节点 4453 显示 ChatGPT 调试提示。不是只看到 iframe 字符串。 |
| BOSS 原生首页恢复 | 通过 | `raw/d06-readonly-attach-comparison.json`，20:47:06-29，`before` 地址栏节点 9 为 `zhipin.com`，节点 40 为正常首页、59 为登录入口；`browser_error` 为 `Debugger unattached`，`after` 仍为首页。 |
| 猎聘账号与列表 | 通过 | `raw/d08-liepin-native-readback.json`，20:48:31，地址栏为 `c.liepin.com`，节点 546 为“你好，贺先生”，节点 608 含目标岗位及详情链接。仅支持当次会话可见登录状态。 |
| 猎聘调试读取对照 | 通过 | `raw/d09-liepin-read-comparison.json`，20:49:19-20，Tab 读取返回 `Debugger unattached`，前后原生 AX 都是“我的首页_猎聘”且无变化。没有成功重连，也没有受控重连复现实验。 |
| 猎聘一次完整详情 | 通过 | 根目录 `d11-liepin-detail.json`，20:56:22，岗位 ID `79867821`；节点 492 显示账号，503/505 显示标题、20-40k、广州等信息；524 完整列出 4 条职责及 5 条要求，随后进入“其他信息”。不是只有岗位卡片，不代表市场扫描恢复。 |
| BOSS 登录入口 | 通过 | `raw/d12.json`，20:57:38-39，地址栏为 `zhipin.com/web/user/?ka=header-login`；`raw/d13-boss-login-readback.json`，20:57:57，主页面节点 926 与扫码登录文本可读。951 是其内部 `about:blank` 内容，不是主地址栏。 |
| 标记后的 BOSS 页面 | 通过 | `raw/d14-boss-after-retention.json`，21:00:56，`retention_marks` 记录两个入口 marked；正常主地址栏与主页面仍在，猎聘首页和详情标签仍列出。仅证明该时刻记录，不能证明跨轮永久保留。 |
| BOSS 账号及登录后详情 | 未验证 | d12-d14 没有账号认证成功或登录后详情证据；d14 另提示刷新二维码。不能借用旧内置浏览器或历史 Chrome 账号记录补足。 |
| 精确根因、跨轮/睡眠后复用 | 未验证 | 无导航发起调用栈、受控重连复现、跨轮或睡眠恢复观测；CLI 测试不能替代。 |
| CLI 隔离、配置 fail-closed、强制参数 | 通过（限定） | 就绪后一次执行三文件共 32 项测试；实际入口测试覆盖 7 个命令、缺配置/缺字段/坏 JSON、URL 仅记录及 8 个禁止参数，结合下述默认路由源码检查。不是穷尽副作用或平台会话证明。 |

`AGENTS.md` 顶部最新规则、新诊断文档、交接文档当前处置及 `progress.json` 的新字段对主要边界一致：原生 UI、调试路径隔离、市场暂停、猎聘当次通过、BOSS 账号未验证、精确根因未知。实际字段名为 `login_diagnosis_2026_09_21`，不是无日期的 `login_diagnosis`。

本次未扩展读取 d01/d02/d04/d05/d07/d10 或 c04，也没有运行进程调查。因此输入错误的完整过程、隐藏 iframe 的具体用途、中性网页对照及“复现时没有 auth/collect 守护进程”等附属陈述未获本 QA 独立验证；不据此扩大根因排除范围。Cookie 未清理/复制、无重启等属于原诊断记录，本 QA 没有通过凭证或系统取证验证其全程历史。

## CLI 独立验收

### 默认真实路由

- `package.json` 的全部 7 个 `auth:*` 命令都直接执行 `auth_browser.mjs`，没有对应 `preauth:*` / `postauth:*` 脚本。`auth:browser` 映射 `start`，`auth:boss` 映射 `open --source BOSS直聘`；未给命令时第 50 行默认 `start`。
- `auth_browser.mjs:1341` 的真实 `main()` 先解析参数和只读配置，第 1350 行输出交接 JSON，1356 行设退出码 2，1357 行无条件 `return`。1359 行后的 `start/run/open/status/check/restart/stop` 旧 dispatch 不可达；正常配置和 unknown 都走同一返回点，不依赖配置 true 才隔离。已检查直接导入的两份本地 policy：没有导入时启动进程、网络或文件变更。
- 默认配置第 2 行为 `authTransport: chrome-native-ui`。`auth_transport_policy.mjs:6` 把缺文件、读取/解析失败、缺字段及非预期值收敛为 unknown；环境变量只影响读取哪个配置，不影响无条件返回。非预期类型/模式的结论来自源码，未假称对应运行用例齐备。
- 参数解析第 64-68 行拒绝 8 个强制/隔离/直接参数；接受的 port/profile/open-login/dry-run 等也只能到同一返回点。help 只打印帮助；未知参数或缺值走错误退出，不进入旧 dispatch。没有发现参数绕过路径。
- 输出明确为 `NEEDS_NATIVE_UI_CHECK`、`loginState/recoveryState: unknown`、`cliAction: none`、`urlHandling: record-only`。CLI 不是原生 UI 执行器，不能以退出码或该 JSON 宣称已登录。

### 一次实际运行

Node `v22.22.0`，cwd 为项目根；未做 mutation、未重复运行：

```sh
node --experimental-vm-modules --test 06_自动化采集/tests/auth_browser_retention.test.mjs 06_自动化采集/tests/auth_browser_retention_handlers.test.mjs 06_自动化采集/tests/auth_transport_isolation.test.mjs
```

结果：退出码 0；32 tests / 32 pass / 0 fail / 0 skipped / 0 cancelled；TAP 总耗时 1428.823958 ms。唯一提示为 Node VM Modules 实验特性警告，不是失败。实现、配置、测试及命令映射文件的测试前后 SHA-256 一致。

| 文件 | 通过数 | 实际证明范围 |
| --- | --- | --- |
| `auth_browser_retention.test.mjs` | 4 | 策略函数及源码结构断言，不能单独证明实际 CLI 行为。 |
| `auth_browser_retention_handlers.test.mjs` | 9 | VM 中调用实际 main，但 transport policy 被 stub，入口返回使旧场景分支不再执行；旧用例名称不能证明 CDP 失败恢复、跨子域复用或真实会话保留。 |
| `auth_transport_isolation.test.mjs` | 19 | Node 子进程执行真实入口、真实 transport policy；7 命令 + 3 配置反例 + 1 URL/source 记录 + 8 禁止参数。 |

### 覆盖边界

- 新测试使用 `AUTH_TRANSPORT_CONFIG_PATH` 指向临时 fixture；无覆盖变量的默认生产配置路径没有额外实跑，默认路由结论来自实际 `package.json`、配置和同一 main 控制流的独立源码核对。
- `ps/lsof/open` 的 PATH trap 和 fetch trap 不是通用沙箱，不能拦截所有绝对路径 spawn、`process.kill`、其他网络 API 或任意文件写入。未删除 guard 做危险 mutation；本次安全判断依赖已核对的无条件早返回，而不是宣称 trap 穷尽。
- artifact 检查只比较列出的 7 个路径是否存在、大小和 mtime，不是全文件系统审计或内容哈希证明；未覆盖低频作业卡/profile 等全部路径。3 个配置反例主要断言交接和退出，不逐一断言 trap/artifact 结果；URL 用例也未检查全部 artifact。不存在“32 项都独立证明全副作用为零”的结论。
- 未穷举全部参数组合和未来新增入口；本次通过仅对应冻结源码的 auth CLI 隔离。CLI 通过与现场恢复是两类证据，均不能替代 BOSS 登录后、跨轮、睡眠恢复或精确根因验收。没有因此解除市场暂停。

## 快照校验

以下为证据初审时 SHA-256，不代表随后进度仍未变更；路径相对上述证据根目录，其他路径注明项目根。进度只冻结指定字段，以 `JSON.stringify` 的紧凑序列化计算，不冻结无关项目进度。

```text
63b26415c3e3936ad651c06c565f100aac0c6acf9bd30f9b1137764ccb8c10d8  raw/d03-blank-readback.json
e8e925c8ef1269b1d8e9492807fc990fa30e62c58ba3116651e9f0b34ec417ec  raw/d06-readonly-attach-comparison.json
24ef63969d33908e99565dd083372c762afd98cb3531ef4e90ab662179c43f21  raw/d08-liepin-native-readback.json
e2ba35d6ff0f8c6679c7be0832a68f357a245e52fae3d4824bf481668d373405  raw/d09-liepin-read-comparison.json
ca1efa2007b0d329941933aa2e04ba5dd7426a826117bdbc652235dcfaf18534  d11-liepin-detail.json
28abe2d8cfb8d6bca2ad5f1c72ef48c1130e2d3aaf812909f14ce49db84bfb35  raw/d12.json
54fdeeba07ed4493e0e1af0db8465c6e9d426d681506bed016cc915348a20053  raw/d13-boss-login-readback.json
05137219ef62a06e6ab95a41703f6850d4c93dafa99cf663edcae1b27330ed78  raw/d14-boss-after-retention.json
67d404aeffe83a918c1cea4cd548d683e69958d65ab107520b647dd650f42786  [项目根] careers/docs/login-diagnosis-2026-09-21.md
3e0024a21242a0e681d4118966ddf9b5b294d73699c6c603ab6328d77f8eb8d8  [项目根] careers/docs/browser-login-handoff.md
307c07f35c6f86f044d401c21bea25992177c6616082fb17e30f1b687e21658d  [项目根] AGENTS.md
f29f8fb054d981c8830e7ec90dec5a0d386358200db2ba2288c726ace1a7cb03  [项目根] careers/progress.json#login_diagnosis_2026_09_21
```

最终代码验收 SHA-256，路径相对项目根；测试前后相同：

```text
52ef545193aa763a951d9877d5baeebef2c5e20198de71199402d0cbff8d8cbd  package.json
bfb3a79973e2296a2cb115883ab82139cb7edb37e6e03c7867c64536c14a6e0d  06_自动化采集/scripts/auth_browser.mjs
7aef3b5be983476ca04b34c7fbe66d4d9b248a606a3e3ff7953e306b278179e1  06_自动化采集/scripts/auth_transport_policy.mjs
a56d1f1c82da9be1fbdb6e61e78d471f9338d59e5d78a20ab51b0f941f09a74c  06_自动化采集/scripts/auth_browser_policy.mjs
37b5654bc1da8ec47e5190d3a43ff68e00694957250ec41f47e36fc2e037f32a  06_自动化采集/config/auth.json
22bbfb359e4cc1069fa31d9711347d871dce4bea9c5fc1076ec9f16fa648ed54  06_自动化采集/tests/auth_browser_retention.test.mjs
e440076ad2b0ac2b25768c661147ccfa9d04bf3e324eab2941a291412be44e6d  06_自动化采集/tests/auth_browser_retention_handlers.test.mjs
83ebbeadfd5e23ca56908211c1e7f472612741cc04b8e54d5aa07a2cbd178fc5  06_自动化采集/tests/auth_transport_isolation.test.mjs
```
