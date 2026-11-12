# 登录与采集独立 QA：2026-09-21

## 最终结论

最终复验时间：**2026-09-21T15:17:28.146Z**。状态：**F1-F8 的技术修复/隔离在限定范围内通过；最后残留的 F3-R P2 操作指引冲突已修复并定向复验通过，本轮范围内无未关闭的 P1/P2。整个登录与自动采集链路仍未通过。**

**猎聘 about:blank 的精确导航发起者仍未定位，根因未修；自动读取/采集保持隔离。** 普通 IAB 页面短窗口稳定及标签存在，不等于账号、完整 JD、自动接管、跨轮或长期复用通过。F2/F8 通过的是旧 live 入口风险封堵，不是公共采集适配完成。

本报告由未参与实现的独立 QA 会话产出；本会话未修改业务实现。模型名称与推理档位以主控真实调度回执为准，本报告不补造调度证明。初始发现、旧行号及失败复现保留在下文，不能据其旧状态误判最终文件。

### F3-R 已关闭

**历史发现 [P2]：报告末尾建议旧 Chrome 验证及恢复采集。** 旧版 643-657 行曾要求持久化 Chrome 验证并执行旧整晚/单次采集命令，与顶部隔离状态及只用 IAB 的规则冲突；当时 live 门禁仍有效，问题是操作指引矛盾。

**最终处理：已修复。** [audit_research_status.mjs:609](/Users/MR/Documents/职场/06_自动化采集/scripts/audit_research_status.mjs:609) 现明确保留 Codex 普通浏览页、不重新登录、不接管、不以自动采集命令验证；611 行明确分别验收控制通道、账号、列表及详情。`safeOvernightCommand`、`safeCollectCommand` 及旧恢复命令已移除。仅核对这段、相关函数移除及新增断言，并运行对应 audit:research 定向测试 **1/1 通过**；测试报告不再包含持久化 Chrome、旧 live 采集命令或 resume-after-risk 指引。未重新全量审查或进行网页验收。

### 最终验收表

| 发现 | 最终处理及当前代码位置 | 独立验收结论 |
| --- | --- | --- |
| F1 | [reconcile-web-sweep.mjs:29](/Users/MR/Documents/职场/careers/reconcile-web-sweep.mjs:29) 消费负面 outcome、重新分类正文；101-103 行分开尝试、成功及失败计数 | 已修。12 种结果的原测试通过；额外 7 类结果串联真实 audit 模块后，7 次尝试仅 1 次成功、6 次失败/待核 |
| F2 | [overnight_research.mjs:410](/Users/MR/Documents/职场/06_自动化采集/scripts/overnight_research.mjs:410) 在 spawn 和运行记录前阻断 live；383-386 行识别子进程失败/交接 | 已隔离。默认及 resume-after-risk 参数均退出 2，无子采集、无运行记录；dry-run 仅 planned。原 live 循环未解禁 |
| F3 | [audit_research_status.mjs:295](/Users/MR/Documents/职场/06_自动化采集/scripts/audit_research_status.mjs:295) 取消协议访问，明确 BROWSER_CHECK_ISOLATED；609-611 行修正末尾指南 | 技术隔离及 F3-R 操作指引均已通过定向复验；状态是未检查，不是 CDP 不可用或要求重登 |
| F4 | [browser-admission.mjs:10](/Users/MR/Documents/职场/careers/browser-admission.mjs:10) 当前/历史统一解析 url 与 expected_url | 已修。abort 后重复、字段混用及加载历史 begin 均拒绝 |
| F5 | [browser-admission.mjs:38](/Users/MR/Documents/职场/careers/browser-admission.mjs:38) 先判错误/中断，再校验实际 HTTPS URL 与账号证据 | 已修。旧账号文本不能覆盖 error/interrupted；空或无效 URL 不再通过 |
| F6 | [web-session.mjs:37](/Users/MR/Documents/职场/careers/web-session.mjs:37) 幂等 finalize、串行记账、可取消等待；[lock.mjs:96](/Users/MR/Documents/职场/careers/lock.mjs:96) 进行中 release 保留结束冷却 | 已修可处理的中断路径。SIGINT/SIGTERM 分别仅记一次 interrupted、冷却后释放；等待准入时退出不伪造 begin；30 秒请求 release 后仍保留 10-20 秒冷却 |
| F7 | [web-session.mjs:75](/Users/MR/Documents/职场/careers/web-session.mjs:75) 仅接受字符串 ID，24 行以 String 兼容历史 ID | 已修。数字/数组/对象拒绝；历史数字 7 阻断新字符串 "7" |
| F8 | [collect_pulse_aisepulse.mjs:426](/Users/MR/Documents/职场/06_自动化采集/scripts/collect_pulse_aisepulse.mjs:426) 在配置扫描、fetch 及 jobs 写入前隔离 live | 已隔离。默认、指定公司、include-existing、低延迟参数均不能执行 live；dry-run 只输出本地候选计划 |

### 最终验证证据

- **31/31**：本 QA 独立运行 7 个 careers 定向测试文件，包含新增 reconcile-web-outcomes 与四类生命周期/锁回归；未重复全项目研究。
- **39/39**：本 QA 独立运行 collection_transport_isolation 与 auth_transport_isolation 两个测试文件。附加的子脚本级保护拒绝真实 HTTP/fetch、Playwright 导入、任何浏览器/子采集启动及生产文件写入；只允许测试自身的系统临时目录输出。
- **9/9**：额外实际 CLI 用例检查 overnight/Pulse 默认及绕过式参数、四种 dry-run 和 audit。所有写入在内存截获，真实网络/浏览器/生产写入均为 0；overnight dry-run 的记录状态为 planned。
- **7 类真实模块联调**：纯内存证据进入实际 audit-web-session 与 reconcile-web-sweep，不替换审计器。blank/diagnostic/error/interrupted/access-stop/empty 均不算 page_read，唯一有效页面计 1；审计仍正确区分回执完整性与业务成功。
- **前次小修 12/12**：独立重跑当时的 collection_transport_isolation.test.mjs；默认启用 spawn 记录后 throw、HTTP/HTTPS get/request 与 fetch 陷阱，未触发副作用。该轮发现 F3-R，现已修复。
- **F3-R 最终定向复验 1/1**：只运行 `--test-name-pattern='audit:research reads local evidence without HTTP or fetch'` 对应测试。新增断言验证普通页保留、不重登/接管、控制通道未验收则暂停，且整份输出不含旧 Chrome 与 live 恢复命令；其他实现沿用前次复验，不重复全量测试。
- 主控最新回传全套 careers:test **288/288**、旧入口测试 **52/52** 通过，careers exec session 84576 已结束。这两项是主控执行回执，本 QA 没有重跑两套全量，也不冒充本 QA 的独立执行记录；与上述独立测试有重叠，不能相加成独立用例总数。

### 保留限制

- SIGKILL、操作系统崩溃或不可写磁盘不能保证 interrupted 证据完整落盘；本轮未声称强制终止下的完整审计或所有恢复路径均通过。外部工具是否实际结束仍需其自身回执，队列释放不能证明外部请求已取消。
- F2/F8 的旧内部采集实现仍不能重新启用；公开来源共享队列、首次访问受限即停、公司画像与岗位语义隔离，仍需未来独立适配及验收。未清洗、覆写或重新认证历史岗位数据。
- 根据主控最新回传，普通标签 BOSS id5 仍在 `/web/geek/jobs`、猎聘 id6 仍在 `c.liepin.com/`；本 QA 未接管标签或自行现场验证。元数据不是账号或正文可读证据。
- 不授权恢复自动读取、公开采集、再次登录/刷新或切换桌面 Chrome；不把有限离线通过包装为根治。

## 范围与执行边界

- 首轮：`careers/browser-admission.mjs`、`web-session.mjs`、`audit-web-session.mjs`、`lock.mjs`、`capture-contract.mjs` 及指定测试。
- 经主控补充授权后：`06_自动化采集/scripts/auth_transport_policy.mjs`、`collect_jobs.mjs`、`open_searches.mjs`、关联入口测试，以及 package 入口可达的 `auth_browser.mjs`、`audit_research_status.mjs`、`overnight_research.mjs`、`collect_pulse_aisepulse.mjs`。
- 为核验失败证据是否流入业务汇总，延伸只读检查 `careers/reconcile-web-sweep.mjs`；没有运行生产报表生成。
- 无 UI、网页导航、真实浏览器、网络采集、全局配置修改或生产数据写入。仓库新增/修改范围仅本文。原有测试自身使用系统临时目录并在测试后清理；额外反例使用纯内存 FS、内存 SQLite 或依赖隔离子进程。
- 项目目录不是 Git 工作树，不能用 Git diff 确认改动归属；结论基于当前文件、行号及 SHA256 快照，不将历史问题全部声称为本轮新引入。

## 初始发现与处理状态

本节保留首轮缺陷和失败复现；各“位置”是首轮快照行号，最终实现位置及结论见顶部验收表。

### F1 [P1] 下游把空白、诊断结果重新算成页面读取

位置：[reconcile-web-sweep.mjs:31](/Users/MR/Documents/职场/careers/reconcile-web-sweep.mjs:31)、[reconcile-web-sweep.mjs:37](/Users/MR/Documents/职场/careers/reconcile-web-sweep.mjs:37)、[reconcile-web-sweep.mjs:82](/Users/MR/Documents/职场/careers/reconcile-web-sweep.mjs:82)。最终状态：已修复，独立定向复验通过。

`web-session` 和审计器新增了 `blank_page`、`diagnostic_only` 等分类，但汇总器仍只凭三个错误字符串判断失败。其他非 search 结果直接归为 `page_read`，`page_reads` 又只按 open/click 操作数统计。

独立纯内存复现：一份 `finish.outcome=blank_page`、`result.url=about:blank` 的 open 回执被输出为 `capture-inventory.status=page_read`、`run.page_reads=1`。这是证据消费链的问题，不是要求审计器把“失败回执完整性通过”改成“采集成功”。

修复要求：汇总明确消费可靠 outcome；空白、诊断、访问受限、工具错误和无可见正文不得计为成功页面读取。保留调用次数与失败证据，不删除历史。补 blank/diagnostic/error/access-stop 到汇总的集成回归。

### F2 [P1] 整晚调度忽略子采集交接退出码并宣称完成

位置：[overnight_research.mjs:365](/Users/MR/Documents/职场/06_自动化采集/scripts/overnight_research.mjs:365)、[overnight_research.mjs:448](/Users/MR/Documents/职场/06_自动化采集/scripts/overnight_research.mjs:448)、[overnight_research.mjs:462](/Users/MR/Documents/职场/06_自动化采集/scripts/overnight_research.mjs:462)。最终状态：live 入口已隔离并独立复验；内部非零退出处理已静态复核，不宣称 live 调度恢复。

新 `collect:jobs` 隔离门禁输出 `NEEDS_IN_APP_BROWSER_CHECK` 并退出 2。调度器只识别旧中文登录提示及采集 manifest，不处理非零退出码，也不识别交接 JSON；因此继续后续批次，并在末尾写入 `completed`。

独立纯内存复现：单批子进程桩返回交接 JSON 与 code=2，最终 `status=completed`、`blocked=false`、`savedCount=0`，并打印“整晚采集完成”。未创建真实子采集、未等待真实批次、未写生产记录。

修复要求：旧 live 调度入口先隔离，或立即传播明确的 blocked/error 终态；不得继续循环、读取无关新 manifest 或宣称采集完成。保留本地 dry-run，不将隔离标为公共采集适配完成。

### F3 [P1] package 审计入口仍无门禁访问 9333

位置：[audit_research_status.mjs:347](/Users/MR/Documents/职场/06_自动化采集/scripts/audit_research_status.mjs:347)。最终状态：已移除真实浏览器协议检查，独立定向复验通过；后续发现的 F3-R 文案冲突也已修复并定向复验，见顶部。

`npm run audit:research` 顶层直接请求 `http://127.0.0.1:9333/json/version` 和 `/json/list`，不读取 IAB transport、不走隔离策略或共享队列。阻止 collect/open 两个入口并不能覆盖它。该请求是本地浏览器协议状态读取，不等于已经执行网页导航，也不能据此归因猎聘 blank，但仍违背当前“不重接 9333”的执行边界。

修复要求：审计默认只读本地证据或输出明确交接/隔离状态，不访问真实浏览器；用 HTTP/get/fetch 陷阱验证，不仅检查 shell `open`。

### F4 [P2] expected_url 别名绕过同平台普通交接去重

位置：[browser-admission.mjs:17](/Users/MR/Documents/职场/careers/browser-admission.mjs:17)、[browser-admission.mjs:28](/Users/MR/Documents/职场/careers/browser-admission.mjs:28)。最终状态：已修复，独立定向复验通过。

准入允许 `request.url ?? request.expected_url`，历史查重却只读取 `event.request.url`。两次合法的 `ordinary-page-open` 均只带 `expected_url=https://c.liepin.com/`，第一次 abort 后第二次仍获准。

独立实际 CLI 隔离复现：同一进程同一平台 `o1`、`o2` 均产生 admitted；没有真实浏览器操作。同样的历史字段缺口也会影响重启后读取历史 begin。

修复要求：当前及历史目标使用相同规范化函数；补 expected_url-only、url/expected_url 混用及历史重启用例，仍保持每平台只交接一次。

### F5 [P2] 失败、被中断或空 URL 可被标为已认证页面

位置：[browser-admission.mjs:38](/Users/MR/Documents/职场/careers/browser-admission.mjs:38)。最终状态：已修复，独立定向复验通过。

分类器只验证 URL 是字符串，以及账号证据出现在文本中，没有排除明确工具失败/中断，也不验证实际 URL 非空或有效。

独立复现：结果带 `status=error,error=Debugger unattached`，或 `status=user_interaction_interrupted`，同时夹带旧页面 `text=Hello Test User`、`account_evidence=Test User`、`authenticated=true`，均输出 `authenticated_page_capture`；`url=""` 也同样通过。旧文本并不能证明本次工具成功读取。

修复要求：工具失败/中断先分类，URL 校验后再判账号证据；不要通过重排字段或补造当前文本掩盖失败。补错误+旧文本的反例。

### F6 [P2] 信号中断未记账，长请求释放锁丢失冷却

位置：[web-session.mjs:33](/Users/MR/Documents/职场/careers/web-session.mjs:33)、[lock.mjs:94](/Users/MR/Documents/职场/careers/lock.mjs:94)。最终状态：已修复可处理信号及进行中 release，独立定向复验通过；SIGKILL/崩溃限制保留。

SIGTERM/SIGINT 直接 `release()` 后 `process.exit(1)`，不会走异步 finally 中的 `afterRequest()` 和 interrupted 记账。锁的 release 同样不处理 inFlight 状态；若请求持续时间已超过起始预留的 10-20 秒，下一持有者可立即准入。

独立实际 CLI 信号测试：向已 admitted 的隔离子进程发送 SIGTERM，退出 1，锁调用序列为 `before,release`，账本只有 begin。另用真实 SQLite 的 `:memory:` 数据库与虚拟时钟执行原锁逻辑：请求开始 30 秒后 release，下一准入与 release 相隔 **0ms**，而非至少 10000ms。

修复要求：可处理信号走单一幂等终止流程，尽力记录 interrupted，保留冷却并释放资源；锁本身也防御进行中 release。对 SIGKILL/进程崩溃明确只能恢复未完成状态，不能声称可完整捕获。测试需要覆盖 SIGINT/SIGTERM、超过预留时间的请求、等待准入时中断和再次接续。

### F7 [P2] 非字符串 ID 绕过重复检查

位置：[web-session.mjs:45](/Users/MR/Documents/职场/careers/web-session.mjs:45)。最终状态：已修复，独立定向复验通过。

正则会将数字转换成字符串，而 Set 区分数字与字符串。`begin id=7 -> abort id=7 -> begin id="7"` 均准入，两者却对应同一个 `raw/7.json` 文件名。已存在原始文件的检查可以防止覆盖已落盘文件，但不能保证“已使用 ID 永不复用”；数组 ID 也会被正则隐式接受并导致后续严格比较失配。

独立实际 CLI 隔离复现：admitted IDs 精确为 `[7,"7"]`。

修复要求：准入前要求非空字符串类型，再进行格式与重复校验；加载历史时采用明确的兼容/冲突策略。补数字、数组、对象及历史混合类型反例。

### F8 [P1] Pulse live 入口尚未获得安全采集及数据语义准入

位置：[collect_pulse_aisepulse.mjs:239](/Users/MR/Documents/职场/06_自动化采集/scripts/collect_pulse_aisepulse.mjs:239)、[collect_pulse_aisepulse.mjs:491](/Users/MR/Documents/职场/06_自动化采集/scripts/collect_pulse_aisepulse.mjs:491)、[collect_pulse_aisepulse.mjs:495](/Users/MR/Documents/职场/06_自动化采集/scripts/collect_pulse_aisepulse.mjs:495)。最终状态：live 入口已隔离并独立复验；共享队列/拒绝即停/画像数据语义尚未作为新适配器实现或验收。

只读代码确认主控指出的问题：原生 fetch 未走共享队列；HTTP 403/429 作为普通异常捕获后继续同源下一家公司；公司职能画像构造成岗位写入 jobs.jsonl。没有运行此入口或真实网络反例。

当前适当处置是隔离旧 live 入口、保留离线计划；不是建设新适配器。复验需证明默认 live、指定公司及 include-existing 等参数均不能触发 fetch、写 jobs、启动浏览器或修改旧 halt。隔离后历史画像仍不得冒充新采集岗位或完整 JD。

## 已验证的有限改进

- 直接 BOSS/猎聘自动控制请求拒绝；hostname 尾点、url/expected_url 冲突已在当前版本拒绝。
- 新 validateWebAdmission 已拒绝遗漏 kind 的 browser/read 误投、多个查询，以及混入 finance 等额外 action；早期发现的该误投路径已关闭，不再列为待修复。
- audit-web-session 已复用 validateWebAdmission，避免入口与审计各维护一套 web action 规则。
- 同字符串历史 ID 与已存在原始文件拒绝；普通 abort+close 保留 interrupted 而不伪造 finish。
- collect:jobs、open:jobs 的非 dry-run 路径，以及 auth 的 start/run/open/status/check/restart/stop，在独立隔离 CLI 用例下返回交接状态；没有调用浏览器、网络或写入函数。
- 失败结果的证据完整性可以返回 passed_for_recorded_calls，但其 scope 和 outcome 必须保留；这本身不是错误，也不是采集成功。

## 首轮测试记录

运行环境：项目已有 Node.js v24.19.0，未修改全局 Node。

1. 指定六个测试文件独立运行 **23/23 通过**：browser-admission、safety、web-session-audit、audit-web-session、capture-contract、web-session-lifecycle。实际命令为该 Node 的 `--test` 加六个明确文件路径，未运行生产 CLI 或全项目采集。
2. 独立实际 CLI 依赖隔离 **17/17 通过**：collect/open 各覆盖 IAB、native、缺字段、损坏 JSON、未知 transport；auth 七个子命令覆盖 IAB。另 **4/4 陷阱自检通过**，证明绝对 Chrome 路径 spawn、HTTP get、文件写入、Playwright 导入均会被拦截。配置仅在子进程内存注入。
3. 额外实际 web-session CLI 隔离反例复现 F4、F6 的 SIGTERM 分支和 F7；纯内存 FS/SQLite 复现 F1、F2、F6 冷却问题；直接纯函数复现 F5。
4. collection_transport_isolation.test.mjs 已静态检查。其原陷阱仅替换 PATH 中的 open/Chrome 名称，未拦绝对可执行文件、CDP 连接或 fetch；processed 目录 mtime 也不能证明现有子文件内容未变化。独立 17 例使用更强的依赖陷阱补充验证，不以原测试本身证明无所有副作用。
5. 首轮时主控全套 careers:test 尚在运行，没有计作本 QA 已亲自执行或已见最终通过。最终主控回执及本 QA 修复后重跑结果已单独记录于顶部。

## 现场证据与根因边界

读取了 [r01.json](/Users/MR/Documents/职场/01_行情收集/official-careers/research/login-audit-2026-09-21/raw/r01.json)，并只读核对其指向的应用日志窗口，没有访问页面。

- 普通标签 `34974c6f-9e2f-4b63-af9c-91e89aa25c8d` 在日志 3104 行创建，isBrowserUseTab=false。
- 日志 3125 行在 14:48:57.835Z 对 `https://c.liepin.com/` 首次 dom-ready；截至 r01 的 14:50:41.274Z，间隔 **103.439 秒**。该窗口未见新的同任务顶层 blank、重复 dom-ready 或调试监听注册事件。
- 同窗口 3170-3179 行仍有 getInfo 元数据请求的 `No ChatGPT browser route is available` 失败。这不是网页调试接入成功，不支持自动读取恢复。
- r01 的 evidence_source=app_lifecycle_log、authenticated=null；未重新验证账号、列表正文、详情 JD、跨轮稳定或无人值守。
- 既有 getTab 接管后 7.693 秒变顶层 blank、markHandoff 无效及一次原标签恢复无效，是既有故障证据，不由当前离线测试推翻。

**可接受表述：普通页在上述短窗口有限稳定，当前隔离能减少误触危险入口。不可接受表述：根因已经修复、自动采集恢复、两个平台登录全部通过、公共采集适配完成。**

## 首轮快照

快照时间：2026-09-21T14:58:16.264Z。以下是复验前的 SHA256，后续实现变化不由本节自动覆盖。

| 文件 | SHA256 |
| --- | --- |
| careers/browser-admission.mjs | ab0eee6723242d596fc050bb68d0d1adb424e9498d8f3cce137af57175f367f2 |
| careers/capture-contract.mjs | 7cc72f8cc2e097619ccd69c869f689afe3cd688c7ef038b659f9e5a4c91e5dbd |
| careers/web-session.mjs | d11a9ed6c03627e894028c110f9a7b62382904927cced9274db183ee561718df |
| careers/audit-web-session.mjs | 4b54c741959110f3f2964cbecc748f9a512d6ff8f5e2aa5ac36badd7ea2641eb |
| careers/lock.mjs | be55d486ddca14efc7a62f939f4a62a5567733ff641881f75591589ef81c3ff3 |
| careers/reconcile-web-sweep.mjs | 9699993f5d731cb7ba54a063a75e0f085f56a17a10e4e0ba93e065a1b53e3442 |
| 06_自动化采集/scripts/overnight_research.mjs | 84f601e4350e8f25223e4b6e500125e7171656ff83a2173c42a4b4b5f935ba88 |

## 最终复验快照

时间：主要修复为 2026-09-21T15:09:39.822Z；audit 与入口测试的 F3-R 关闭版本更新至 2026-09-21T15:17:28.146Z。其他实现沿用前次复验版本，本次未重新全量读取。上述最终独立结论对应以下版本；如后续代码再变更，不自动继承本次验收。

| 文件 | SHA256 |
| --- | --- |
| careers/browser-admission.mjs | 9ef4f6db098c88be77e99093a2a05ae8be58231fb9423540473ef83d9de50e43 |
| careers/web-session.mjs | e4e584e5e7e2f94e3934f87fb0812a965aa37a98ebad117388341525f8a0046b |
| careers/audit-web-session.mjs | 4b54c741959110f3f2964cbecc748f9a512d6ff8f5e2aa5ac36badd7ea2641eb |
| careers/lock.mjs | c04ceea32d94c52ae7d3a514ca50da8db2999256a958c5afbceef31fa0a8c7f3 |
| careers/reconcile-web-sweep.mjs | 6dbe4282d7af45183aff8ec659a80e49c6c1df9f1f21989e7c00b07273e14d9f |
| 06_自动化采集/scripts/auth_transport_policy.mjs | 26fdb26e385aa39c0d4f8abb1738404ca1f57f11bc4630b09ba2f29049452c7e |
| 06_自动化采集/scripts/overnight_research.mjs | fa9d2787ed9f56a17ce47783cef653e460c58b68973e24074e79c2af4a09ff68 |
| 06_自动化采集/scripts/collect_pulse_aisepulse.mjs | 91203f712d9e4a76904485147f2b9f724bf108bbab3fe0587e391257b546e3d9 |
| 06_自动化采集/scripts/audit_research_status.mjs | 5eef18cfead36a42266d4c05a0b4aabb05928eb9bcb6c8ff72a3b6923eda85ba |
| 06_自动化采集/tests/collection_transport_isolation.test.mjs | 6c991952809df9631a8c96e0df55c9988101602e6772e6b6bd6c29a9289caf99 |

本轮 F1-F8 定向复验结束，不继续扩展全项目研究或真人网页验证。保留的阻塞是精确根因、自动读取和安全公开采集适配，不能用此报告解除隔离。
