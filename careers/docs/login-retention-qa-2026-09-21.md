# 登录保留独立 QA | 2026-09-21

> 最新复验：**P2-1、P2-2 有限范围通过；P2-3、P2-4 仍需返工。** 两个 retention 测试独立运行 13/13 通过，但仍有可复现反例及覆盖缺口。详见文末“Terra 修复后限定复验”。下面初审结论、行号与快照保留为历史记录，不代表修复后的四项均未解决。

## 结论

**需返工。发现 4 项 P2：3 项真实调用链复用缺陷、1 项回归测试漏检。** 未发现当前默认调用链仍会自动执行 SIGTERM、关闭标签、重启或清理 Cookie；这部分仅有限范围通过。不能据此验收“默认始终复用已登录会话”，更不能宣称 IAB `about:blank` 根因已修。

本审核者未参与被审实现，仅做代码审查、离线测试和全 mock 行为复现；没有修改实现或测试。实际角色为本会话独立 QA，未启动额外代理；模型名称及推理档位没有可核验的运行元数据，不声称已完成模型切换。

## 按严重程度列出的缺陷

### P2-1：读取失败、置前失败和 blank 被一律当作可新开平台页

- 位置：[auth_browser.mjs:872](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:872)、[auth_browser.mjs:887](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:887)、[auth_browser.mjs:1232](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:1232)。列表错误被吞为 `[]` 的位置为 [auth_browser.mjs:379](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:379)。
- 调用链：`main -> openPlatform -> openUrl -> focusExistingBrowserTab -> catch -> openUrlWithProfile -> spawn(Chrome)`。`allowBrowserOpen` 在正式入口固定为 `true`，因此现有的 `manual_required` 分支不会保护这些默认调用。
- 离线复现：内存设定项目 PID 存活，分别令 `/json/version` 超时、`/json/list` 返回 503、已命中标签的 `/json/activate/...` 超时、列表仅含 `about:blank`，执行真实 `open --source 猎聘` 处理链。四种输入均记录到 **1 次 Chrome spawn**，目标均为配置中的猎聘登录页。置前失败场景中，原标签已经被代码找到，仍进入新开回退。
- 另一个同根因反例：项目 PID 缺失、BOSS profile PID 存活且 CDP 不可用时，`startDaemon` 在 931-936 行明确返回不启动，但 `openPlatform` 不检查返回状态或随后等待结果，最终仍由 `openUrlWithProfile` 派生项目 Chrome。
- 影响：连接状态未知、现有标签暂时 blank 或激活故障，都不等于“原会话不存在”。当前实现会额外请求打开平台入口，可能重复开页或进入配置 profile，而不是保留原现场后停下。该行为违反本项目“未知状态不得当作不存在、恢复复用原会话”的约束。**已证明的是派生命令，不是旧标签必定关闭、Cookie 必定丢失或网站必定变 blank。**
- 最小修复要求：保留列表读取错误的结构化状态；已有标签激活失败、读取未知或 blank 时，返回明确的保留/人工接管结果，不自动派生。`openPlatform` 应尊重启动被拒绝或连接未就绪的结果。只有确认不存在目标且符合本轮打开授权的分支才允许新开；不需要为此重构整个生命周期架构。
- 复验标准：上述 5 个 mock 场景均不产生 spawn/open/close/kill/clear/reload 副作用，保留不同失败原因，不报“平台不存在”或“复用成功”。

### P2-2：猎聘默认登录域与已登录主页域不一致，原标签无法被复用

- 位置：[auth_browser.mjs:406](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:406)、[auth_browser.mjs:464](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:464)。只读调用输入：[auth.json:13](/Users/MR/Documents/职场/06_自动化采集/config/auth.json:13)。
- 离线复现：CDP 正常、PID 存活，现有 page URL 为 `https://www.liepin.com/`；执行真实 `open --source 猎聘` 处理链。配置目标为 `https://passport.liepin.com/login/`。`hostnameFor` 仅去掉 `www.`，随后严格比较，得到 `liepin.com !== passport.liepin.com`。
- 实际结果：未复用该页，派生 **1 次 Chrome** 打开登录地址；mock 保留原主页时，有限轮询结束仍输出“未检测到平台标签页”。
- 影响：即便平台主页已在当前连接中，默认命令也不能识别并复用，可能重复打开登录入口。这不是登录失效证据。
- 最小修复要求：按已核验的平台域集合识别同平台标签，优先复用已有平台页；不能将所有网站无条件按字符串后缀合并。仅改登录 URL 不能完整解决主页、登录页等跨子域复用。
- 复验标准：保留 `www.liepin.com` 主页时默认猎聘 open 不派生、不导航；已核验的登录域也可识别，伪造相似域名不得匹配。

### P2-3：PID 文件缺失被当作浏览器缺失，先派生中性页再尝试复用

- 位置：[auth_browser.mjs:928](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:928)、[auth_browser.mjs:939](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:939)、[auth_browser.mjs:967](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:967)、[auth_browser.mjs:1219](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:1219)。
- 离线复现：PID 文件缺失，但 mock 进程表含相同 profile 的 Chrome、CDP 正常，标签列表可包含完全匹配目标的现有页。分别执行真实 `start` 和 `open --source 猎聘` 处理链。
- 实际结果：两者均先 **spawn 1 次**，传入 `config.startUrl`，并将派生子进程 PID 写回内存 PID 文件。open 场景随后还会成功识别并报告复用原标签，说明这次派生并非复用所必需。
- 影响：本地跟踪文件缺失/失效不等于会话不存在。现代码未在派生前核实实际进程/profile/连接归属，可能额外打开中性页；Chrome 单实例转交后的真实 PID 归属也未验证。本轮配置的启动页是 `data:` 页面，**不是 `about:blank`**；仅在未配置 `startUrl` 时回落 `chrome://newtab/`。不能把这次 mock 派生解释成已复现 IAB blank。
- 最小修复要求：PID 记录失效时，先核实目标 profile 与可用连接的归属；已发现原会话则复用或保留并报告，只有确认不存在才派生，不因诊断清理 profile 或重启。
- 复验标准：缺失/过期 PID、同 profile 浏览器仍存在的 start/open 场景不派生；存在但不可识别/不可连接时保守停下；真正不存在时才走经授权的启动分支。

### P2-4：4/4 通过只覆盖声明和直接调用文本，无法保护实际副作用

- 位置：[auth_browser_retention.test.mjs:6](/Users/MR/Documents/职场/06_自动化采集/tests/auth_browser_retention.test.mjs:6)、[auth_browser_retention.test.mjs:22](/Users/MR/Documents/职场/06_自动化采集/tests/auth_browser_retention.test.mjs:22)、[auth_browser_policy.mjs:8](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser_policy.mjs:8)。
- 前 3 项只断言纯函数返回的动作数组不含破坏动作；`destructiveActions` 各分支均直接返回空数组。实际 CLI 只有 BOSS 分支调用此 policy，且用于日志；`startDaemon`、普通 `openPlatform` 不由这个计划约束，测试也没有执行它们。
- 第 4 项按 `async function` 文本切片，仅查 3 个入口函数内的固定 helper 名和 `process.kill`。它不递归追踪 `openUrl`、`openUrlWithProfile` 等 helper，不验证关闭标签 API、Cookie/profile 写入，也不验证新开、重复派生、刷新或错误分支。
- 可复现的内存变异证据：在 `openUrlWithProfile` 函数开头插入 `process.kill(12345, "SIGTERM");`，原 4 个测试回调仍 **4/4 通过**；在 `openPlatform` 开头插入 `await fetch("http://127.0.0.1:9333/json/close/mock-target");`，仍 **4/4 通过**。两个变异仅作为字符串送入测试的 `readFileSync` mock，**变异实现从未执行，也未写入文件**。
- 影响：测试运行及其通过结果是真实的，但将其描述为“真实处理链无破坏/会话保留已验收”会产生虚假覆盖结论。当前 P2-1 至 P2-3 均不会被这些测试阻止。
- 最小修复要求：保留纯函数测试作为补充，增加真实入口和 helper 链的依赖 mock 测试，断言 spawn、系统 open、非零进程信号、标签关闭/刷新/导航、profile/Cookie 写入等实际副作用。至少覆盖本报告的异常、跨子域和 PID 失效场景；不需引入新调度架构。
- 复验标准：安全路径通过，已列反例修复后不再派生；上述两个危险变异应使对应测试失败，而不是继续全绿。

## 有限范围通过及调用链边界

| 入口/链路 | 本轮核对结果 |
| --- | --- |
| `start/run -> startDaemon`，跟踪 PID 存活 | 输出启动诊断后返回，不因 blank 或旧参数自动 stop/restart。 |
| BOSS 默认 `open -> openBossHumanMode` | 保留 CDP/旧 BOSS profile；默认只生成本地 handoff 和审计记录，不派生浏览器、不访问平台。 |
| 普通 open，PID 存活且同主机标签可读可激活 | 只激活原标签，不刷新、不导航、不派生。 |
| `cleanupStalePid` | 仅移除已失效 PID 文件；`isAlive` 的 `process.kill(pid, 0)` 是存活探测，不是终止。 |
| `stop/restart -> stopAllBrowsers -> stopBrowser/stopBossHumanBrowser -> terminatePids` | SIGTERM 仍在显式生命周期路径，本轮未执行；未审定显式停止的所有进程选择边界。 |
| `waitForCdp`、`waitForSiteTab` 等 | 有限次数/时限的连接或列表轮询，不是平台页面刷新循环。未发现定时保活或自动 reload。 |
| `--launch-handoff`、`--isolated-boss-profile` | 仍是显式打开分支，静态核对未见新增默认终止；没有实机验证其窗口行为。 |

完整文件静态核对未见默认 Cookie 清理、profile 删除、账号退出或标签关闭调用。这个结论限于当前三文件及所追踪的本地 helper，不覆盖其他采集器、调用方或宿主浏览器生命周期。

## 离线执行证据

环境：`/Users/MR/Documents/职场`，Node `v24.19.0`。未调用 `auth:status`、任何真实 CLI start/open/stop/restart，也未使用浏览器工具；没有连接 9333 或访问网络。CLI 行为只在 `vm.SourceTextModule` 的全 mock 上下文中执行。

已运行的原测试和语法检查：

```sh
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test 06_自动化采集/tests/auth_browser_retention.test.mjs
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check 06_自动化采集/scripts/auth_browser.mjs
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check 06_自动化采集/scripts/auth_browser_policy.mjs
```

结果：原测试 **4 passed / 0 failed**，两项语法检查 exit 0。没有运行其他测试套件或实网集成测试。

### 行为复现方法与固定输入

实际运行命令形态为指定 Node 加 `--experimental-vm-modules --input-type=module -`，从 stdin 执行内存 harness，不生成辅助文件。读取实际源码后，仅将末尾 `main().catch(...)` 改为 `globalThis.qaDone = main().catch(...)` 以等待完成；未改业务分支。policy 使用实际源码。

依赖边界：`node:fs` 的读写、`child_process`、`process.kill/exit`、`fetch`、时钟及计时器全部替换为内存 fixture/spy；`node:path`、`node:url` 使用纯函数。模块 linker 只接受这些明确依赖。任何未知命令、非 mock 请求或未声明导入立即失败；不存在真实 spawn、网络转发或 profile 文件访问。Chrome 路径“存在”、PID 存活、进程表、CDP 响应均为 fixture，不是本机状态证据。

公共 fixture：auth PID=101，BOSS PID=202（仅指定场景存在），spawn 返回模拟 PID=701；进程表含同 profile Chrome；诊断命令带 `about:blank`；列表页含固定 tab ID 与模拟 debugger URL。CDP 正常时 `/json/version` 返回 ok，激活正常时返回 ok；轮询由虚拟时钟推进，不等待真实时间。

| 编号 | 命令输入与差异 fixture | 实际 mock spawn 数 | 其他实际观察 |
| --- | --- | ---: | --- |
| C1 | `start`，跟踪 PID 存活 | 0 | 仅诊断，不连接 CDP。 |
| C2 | `open --source BOSS直聘`，CDP 与 BOSS PID 存活 | 0 | 仅本地 handoff/审计内存写入，无 CDP 请求。 |
| C3 | `open --source 猎聘`，标签为配置登录域 | 0 | 报告复用原标签。 |
| R1 | 猎聘 open，标签为 `https://www.liepin.com/` | 1 | 打开配置登录 URL；未报告复用。 |
| R2a | 猎聘 open，version 抛出超时，列表保留匹配页 | 1 | 回退原因为 CDP 超时。 |
| R2b | 猎聘 open，list HTTP 503 | 1 | 错误被折叠为“未检测到现有平台标签页”。 |
| R2c | 猎聘 open，匹配页激活抛出超时 | 1 | 回退原因为激活超时。 |
| R2d | 猎聘 open，列表仅有 `about:blank` | 1 | blank 后派生平台登录 URL。 |
| R3a | `start`，PID 文件缺失，同 profile 进程/CDP 仍存在 | 1 | 派生 `config.startUrl`，写模拟 PID。 |
| R3b | 猎聘 open，同 R3a 且标签精确匹配 | 1 | 先派生中性页，随后报告复用。 |
| R2e | 猎聘 open，auth PID 缺失、BOSS PID 存活、CDP 超时 | 1 | 启动保护返回后仍派生平台登录 URL。 |

11/11 场景的“当前行为断言”与观察一致，其中 **3 个安全对照、8 个缺陷反例**。这不是 11 项产品验收通过。各场景均记录 0 个非零 kill 信号、0 个 profile 内文件写入；所有副作用记录只存在内存。上述输入、预期分支和 spy 计数可用于执行者增补回归测试。

### 可直接离线复跑的漏检证明

下面命令只运行原测试回调；变异实现始终是字符串，不会被 evaluate，也不写文件、不连接任何服务。它不会触发真实杀进程或关闭标签。

```sh
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules --input-type=module - <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const script = readFileSync('06_自动化采集/scripts/auth_browser.mjs', 'utf8');
const tests = readFileSync('06_自动化采集/tests/auth_browser_retention.test.mjs', 'utf8');
const policy = readFileSync('06_自动化采集/scripts/auth_browser_policy.mjs', 'utf8');
const variants = [
  ['baseline', script],
  ['helper SIGTERM mutation (never executed)', script.replace('function openUrlWithProfile(profileDir, url, dryRun = false) {', 'function openUrlWithProfile(profileDir, url, dryRun = false) {\n  process.kill(12345, "SIGTERM");')],
  ['handler CDP tab-close mutation (never executed)', script.replace('async function openPlatform(args) {', 'async function openPlatform(args) {\n  await fetch("http://127.0.0.1:9333/json/close/mock-target");')]
];
for (const [name, variant] of variants) {
  if (name !== 'baseline') assert.notEqual(variant, script);
  const context = createContext({ URL });
  const results = [];
  const mocks = {
    'node:assert/strict': { default: assert },
    'node:test': { default: (title, fn) => { try { fn(); results.push({title,pass:true}); } catch (error) { results.push({title,pass:false,error:error.message}); } } },
    'node:fs': { readFileSync: (file) => { assert.ok(String(file).endsWith('/scripts/auth_browser.mjs')); return variant; } }
  };
  const modules = new Map();
  for (const [specifier, exports] of Object.entries(mocks)) modules.set(specifier, new SyntheticModule(Object.keys(exports), function() { for (const [key,value] of Object.entries(exports)) this.setExport(key,value); }, {context}));
  modules.set('../scripts/auth_browser_policy.mjs',new SourceTextModule(policy,{context}));
  const module = new SourceTextModule(tests, {context, initializeImportMeta(meta) { meta.url = pathToFileURL(resolve('06_自动化采集/tests/auth_browser_retention.test.mjs')).href; }});
  await module.link(specifier=>{ assert.ok(modules.has(specifier)); return modules.get(specifier); });
  await module.evaluate();
  assert.equal(results.length,4);
  assert.equal(results.filter(r=>r.pass).length,4);
  console.log(JSON.stringify({name,passed:4,total:4,sourceMutatedOnlyInMemory:true,mutantNeverExecuted:true}));
}
NODE
```

本轮运行结果：baseline 4/4，helper SIGTERM 变异 4/4，直接 CDP close 变异 4/4。这里只证明当前回归漏检；未来测试正确识别变异后，上述“仍全绿”的证明应失败。

## 范围、快照及浏览器 blank 证据边界

即时审核对象仅以下三文件。额外只读 `AGENTS.md`、登录交接规则、`package.json` 的命令映射和 `auth.json` 的调用输入；未扩展实施范围。工作目录没有 Git 仓库，不能给出可信的提交差异或将问题全部归因于前轮 Terra 新增；以下哈希冻结本轮看到的实际状态。

| 文件 | SHA-256 |
| --- | --- |
| `06_自动化采集/scripts/auth_browser.mjs` | `7789d93d15fdd7e24934917f9b2ca3d854b8dbd05b2773abcd29016d2ce091e7` |
| `06_自动化采集/scripts/auth_browser_policy.mjs` | `32f90259fc69dd7d914b72814de2b2923f40ab0f427568c523cf46022c26289b` |
| `06_自动化采集/tests/auth_browser_retention.test.mjs` | `22bbfb359e4cc1069fa31d9711347d871dce4bea9c5fc1076ec9f16fa648ed54` |

测试前后重算三文件哈希一致。`shasum` 曾因本机 Perl locale 报错，未将该失败当成校验成功；哈希改用 Node `crypto` 只读计算。VM 的 experimental warning 不代表浏览器访问或测试失败。

较早的 IAB 现象来自用户交接：BOSS 主页曾显示已登录，随后变 blank；ExampleDomain 稳定；该轮标签列表为空。**本 QA 没有现场复核这些现象。** 标签为空、页面 blank、登录过期、读取失败是不同状态；代码里的历史风险注释与提示文案不能替代根因证据。

### 追加交接：日常 Chrome 也出现 blank

用户在 auth QA 完成后补充以下验证结果，引用证据为 batch `raw/c01`、`raw/c02`、`raw/c03`。本 QA 尚未独立读取这些原始产物，以下按用户交接记录，不标为 QA 实机复现或原始证据验收通过：

- 用户批准切换日常 Chrome 后，create 官方 BOSS 入口仍为 blank；同一 tab 仅进行一次 goto，仍为 blank。
- 猎聘 create 官方 home 也为 blank。
- 没有可用 errorlog；缺少错误日志不能用来证明没有错误或确认故障层级。
- 已停止自动恢复，请用户手动打开；没有绕过挑战、复制 Cookie 或关闭窗口。本 QA 不追加恢复尝试。

**据此，blank 现象不能再限定为 IAB 特有；根因仍未定位。** 目前仍无证据将其归因为旧 CLI、CDP 参数、平台风控、Cookie 丢失或某个具体浏览器组件。获批切换日常 Chrome 的本次动作不视为后续任意切换、重启或清理的授权。该追加信息不改变本报告 4 项 P2 的离线结论，也不扩大旧 CLI 修复的验收范围。

本报告只写入 `careers/docs/login-retention-qa-2026-09-21.md`，不修代码、不改测试、不改 progress、不触碰浏览器/profile/登录态。最终状态：默认自动停止/重启的移除有限范围通过；完整保留复用要求需返工；跨 IAB/日常 Chrome 的 blank 根因仍未定位。后续报告集成产物尚未提交，本轮未等待，也未预先验收。

## Terra 修复后限定复验

**本次结论：仍需返工，剩余 2 项 P2。** 只复验原 4 项及受影响的状态读取/平台复用/helper 路径，并纳入新增的真实入口 mock 测试；没有全模块重审、实现修复或实机浏览器验证。

| 原发现 | 修复后判断 | 本次依据 |
| --- | --- | --- |
| P2-1 读取/激活/blank 回退派生 | 有限范围通过 | `cdpTabs` 保留读取错误；`focusExistingBrowserTab` 区分未知、激活失败、已复用与确认不存在；`openUrl` 未确认不存在即返回人工接管；`openPlatform` 尊重启动拒绝。 |
| P2-2 猎聘跨域不复用 | 有限范围通过 | `platformDomains` 使用限定的猎聘域集合，主页与登录域可匹配；相似伪域不匹配。代码路径已核对，正向复用的测试断言仍不足，列入 P2-4。 |
| P2-3 PID 缺失直接启动 | 部分修复，未关闭 | 进程表可读时能保留同 profile；进程表读取失败仍被当成空列表，start/open 均派生。 |
| P2-4 测试虚假覆盖 | 部分修复，未关闭 | 已执行真实入口，直接关闭标签变异能失败；helper 变异与跳过全部标签复用变异仍 13/13 全绿。 |

### P2-3 余项：进程枚举失败仍被当成“没有会话”

- 当前位置：[auth_browser.mjs:146](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:146) 的 `psEntries` 在 163-164 行捕获所有异常并返回 `[]`；结果经 `projectChromeEntriesByMarker -> mainProjectChromePidsByProfile` 传到 [startDaemon:948](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:948) 与 [openPlatform:1247](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:1247)。
- 可复现条件：PID 文件缺失，同 profile 的 Chrome 实际存活，但 `ps -axo pid=,command=` 超时或被拒绝。业务代码没有保留枚举失败状态，`profilePids.length` 为 0 后落入 [spawn:993](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:993)。`openPlatform` 则先走启动分支，再尝试复用。
- 离线复现方法：读取新增 handlers 测试的 `runOpen` harness，只在其 `execFileSync` mock 前加 `if (command === "ps" && fixture.psError) throw new Error("mock process scan denied")`，导出内存 `runOpen`；被审业务源码不变。分别传 `{ command: "start", profileAlive: true, psError: true, tabs: [liepinTab] }` 和 `command: "open"`，不设置 `pidFile`，CDP mock 正常。
- 两种输入均记录 **spawn=1**，参数包含项目 profile、9333 和 fixture 中性页 `data:text/html,ready`；同时记录内存 `mkdir`、PID `write`，非零 kill=0。已登录页 fixture 存在也未阻止先启动。这里只证明不必要的启动请求，不证明真实 Cookie 丢失或页面必定 blank。
- 最小修复：让进程枚举保留成功/失败状态，并在默认 start/open 的启动判定处处理未知；枚举失败时保留现场、报告原因，不把 `[]` 当作已确认不存在。现有同 profile 检测可继续使用，无需新架构。
- 复验标准：PID 缺失或过期、进程枚举超时/拒绝时，两入口均不得派生；可读且找到原进程的现有测试继续通过。确认不存在的授权启动与未知状态分别测试。

### P2-4 余项：负向无副作用不等于正向复用已验证

- 当前位置：[auth_browser_retention_handlers.test.mjs:108](/Users/MR/Documents/职场/06_自动化采集/tests/auth_browser_retention_handlers.test.mjs:108) 的八场景统一断言仅检查零 spawn/open/write/非零 kill/close/reload；标题为“Liepin homepage is reused”的场景没有断言激活请求、正确 tab ID 或复用成功结果。[runOpen:102](/Users/MR/Documents/职场/06_自动化采集/tests/auth_browser_retention_handlers.test.mjs:102) 也只返回副作用记录。
- handler mock 的进程表始终成功返回，没有枚举失败 fixture，因而漏掉上面的 P2-3 反例。全部现有保留场景都避开 [openUrl:906](/Users/MR/Documents/职场/06_自动化采集/scripts/auth_browser.mjs:906) 的 `openUrlWithProfile` 调用，未覆盖确认不存在后的授权 dispatch helper。
- 独立内存变异运行了两个实际测试文件的全部回调，等待异步完成；外层只将源码读取替换为变异字符串，内层继续使用测试自带的 fs/child_process/process/fetch mocks。结果如下，**没有修改源码文件、发送真实信号或真实 CDP 请求**：

| 内存源码版本 | 通过 / 失败 | 证明范围 |
| --- | --- | --- |
| 原样 baseline | 13 / 0 | 当前套件运行成功。 |
| `openUrlWithProfile` 开头插入 `process.kill(12345, "SIGTERM")` | 13 / 0 | helper 未被测试执行，危险变异漏检；不表示当前源码真的有该终止调用。 |
| `openPlatform` 开头插入 `fetch("http://127.0.0.1:9333/json/close/mock-target")` | 5 / 8 | mock 拒绝未声明请求，直接关闭标签变异现已被捕获，较初审有实际改进。 |
| `openUrl` 在读取标签前直接返回 `{ openedBy: "manual_required", platformVisible: false }` | 13 / 0 | 即使完全不尝试复用原标签，正向复用测试也仍通过。 |

- 最小修复：保留当前负向断言；正向场景增加准确原 tab ID 的一次激活及复用结果断言，未知/激活失败分别断言原因与失败语义；补枚举失败及确认不存在后的授权 helper 场景，禁止该分支出现终止、关闭、清 Cookie 或刷新等额外副作用。无需为测试引入新的生命周期框架。
- 复验标准：安全 fixture 通过；正向复用 no-op 变异和上述 helper SIGTERM 变异应使对应测试失败；直接 close 变异继续失败。13/13 本身不能替代这些行为检查。

### 本次离线测试及影响边界

独立实际执行：

```sh
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules --test 06_自动化采集/tests/auth_browser_retention.test.mjs 06_自动化采集/tests/auth_browser_retention_handlers.test.mjs
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check 06_自动化采集/scripts/auth_browser.mjs
```

结果为 **13 passed / 0 failed**，语法检查 exit 0；VM experimental warning 不影响结果。新增 9 项是真实源码入口的全 mock 测试，不再只是文本匹配；但其覆盖限度如上。附加内存 harness 复现不计入仓库的13项测试数。

静态追踪 `cdpTabs` 返回结构变化后的 `waitForSiteTab`、`focusExistingBrowserTab`、`printStatus` 消费路径，没有发现遗留把结构体直接当数组使用的调用。未实际运行 status/check，也未连接本地端口。默认 BOSS 手动交接与显式 stop/restart 边界未扩大；当前修复不构成显式生命周期操作的全量验收。

本次未见新增默认终止/重启、Cookie 清理或页面刷新循环。仍存在的 P2-3 是不当派生风险，P2-4 是覆盖缺口；不能把测试变异当成真实代码已经执行破坏操作的证据。

### 复验源码快照

| 文件 | SHA-256 |
| --- | --- |
| `06_自动化采集/scripts/auth_browser.mjs` | `a07a22fa8fae557c5c190d7ad70ac934f0ed181596c07164075c55513f2c5fc3` |
| `06_自动化采集/scripts/auth_browser_policy.mjs` | `a56d1f1c82da9be1fbdb6e61e78d471f9338d59e5d78a20ab51b0f941f09a74c` |
| `06_自动化采集/tests/auth_browser_retention.test.mjs` | `22bbfb359e4cc1069fa31d9711347d871dce4bea9c5fc1076ec9f16fa648ed54` |
| `06_自动化采集/tests/auth_browser_retention_handlers.test.mjs` | `6e0e74e380858516dbb34b2a38d2f2dba9ad0517d3379499b2b76f45a907f311` |

### 最新交接与结论限制

总控转交实际调度工具回执：`model=gpt-6-astra`、`reasoning_effort=xhigh`、`agent_id=01a0c3de-cc30-7e82-a88b-b3a01f6a8703`。据此可补充为**调度参数已接受**，不是只有角色命名；不代表本 QA 取得独立计费、token用量或底层路由元数据。审核者未参与实现，未另派代理。

市场有限审查时只读了已保存的 `market-2026-09-21/raw/c04.json`：同一 Chrome 的 example.com 经 create API 有可读页面与可访问性正文，SHA 已与回执核对。该证据说明不是所有页面导航都失败，但不能定位 BOSS/猎聘 blank 的具体原因，也不能推断为网站风控。未为此追加浏览器验证。

**最终：P2-1/2 在旧 CLI 的限定场景通过；P2-3/4 未关闭，auth 仍需返工。market 的有限通过不代替 auth 通过；旧 CLI 修复不等于 IAB 或日常 Chrome 的 about:blank 根因已修。** 本次仅追加 QA 文档，不修改实现、测试、岗位、评分、生成器或 progress；全程无网络、浏览器及登录态操作。
