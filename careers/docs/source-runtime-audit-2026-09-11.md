# 来源执行链路盘点（2026-09-11）

## 盘点边界

该子代理盘点只做有界离线执行审计：不联网、不扫描、不运行浏览器、不改数据。主线程负责行业内大/中/小厂分层标准和来源新规则，本文件不重复设计这些规则，只核对现有规则、配置与代码是否形成可执行链路。主线程后续离线doctor及测试见文末，不是新实网验收。

结论中的“当前可用”只表示本地代码或离线接口存在，不表示今天可访问、可采集或已经通过新的实网验收。历史报告、历史原始响应和离线测试均保留为历史证据，不升级为当前运行证明。

## 一、实际采集入口与渠道

### 1. `careers` 主入口

实际 CLI 入口是 `careers/run.mjs` 转入 `careers/cli.mjs`。CLI 暴露的采集相关命令只有：

- `collect --company COMPANY_ID`、`collect --companies ID,ID`、`collect --all`：只遍历 `registry.mjs` 中的已实现公司；未注册适配器的发现公司会被跳过，不会因为存在于发现配置而自动采集（`careers/cli.mjs:57-74`）。
- `research:collect --documents ID,ID`：只捕获 `research-documents.json` 中显式登记的 URL，最多 8 个，不是 URL 发现器、全站爬虫或政策周覆盖器（`careers/cli.mjs:25-30`；`careers/research.mjs:55-67`）。
- `sweep:report --input RESEARCH_DIR`：只重建已有研究目录的离线报告，不产生新来源访问（`careers/cli.mjs:23-24`）。

`doctor` 是离线能力检查，不是采集验收；其输出明确声明 `live_requests: 0`、无持久化登录态，并把公司列表投影为“已实现公司”（`careers/cli.mjs:31-55`）。

### 2. 官网 HTTP / 官方 ATS HTTP

统一 HTTP 通道是 `EvidenceHTTP`：

- 只允许 HTTPS，禁止显式非 443 端口、账号密码和 IP；主机还必须在公司适配器 `allowed_hosts` 中，DNS 必须解析到公网地址（`careers/http.mjs:19-41`、`52-64`）。
- 单请求串行、共享租约、最长 30 秒、响应最大 4 MiB；保存请求/响应元数据、正文和哈希；不发 Cookie，不保留 `set-cookie`，无代理、无重试（`careers/http.mjs:108-131`、`193-246`）。
- 默认只允许 GET；POST 仅限注册的 `public_post_urls` 且必须有当前官方页面证据（`careers/http.mjs:193-199`）。401/403/429、网络错误、挑战页立即停源，不重试（`careers/http.mjs:238-245`；`careers/config/access-policy.json:43-47`）。
- 官方归属必须先用当前或经校验的同日成功回执建立，再允许访问招聘板或脚本（`careers/http.mjs:133-138`、`161-179`；`careers/collector.mjs:43-48`）。

当前代码真实接通的 HTTP 适配器：

- 百炼智能：官网归属页 + 官方招聘页，`bailian-static-v1`；使用页面 DOM 与 Nuxt 字面量交叉校验原生职位记录、卡片、职责、要求和计数（`careers/registry.mjs:4-10`；`careers/collector.mjs:44-60`；`careers/providers/bailian.mjs:27-100`）。
- MiniMax 静态 HTTP：官方官网归属页 + 飞书招聘板 + 注册的公开职位列表 POST，`feishu-public-v1`；最多 3 页，每页 100 条，返回数与原生 ID 必须对账，超过 3 页会保留不完整状态（`careers/registry.mjs:12-24`；`careers/providers/feishu.mjs:17-82`）。但该变体已有明确 `PUBLIC_API_REQUIRES_BROWSER_STATE` 访问阻断，当前不应重试（`careers/registry.mjs:19-23`）。
- DeepSeek：官网归属页 + `talent.deepseek.com`，`official-embedded-json-v1`；只读取官方页面引用的静态脚本，解析公开 JSON 字面量和 UI 可见类别，脚本不执行（`careers/registry.mjs:38-43`；`careers/providers/deepseek.mjs:51-102`）。
- 显式研究文档：同一 HTTP 通道按文档清单逐个读取，正文需满足长度和关键词契约，并保存正文哈希；失败来源会写入 halted 状态，后续不自动恢复（`careers/config/research-documents.json:1-11`；`careers/research.mjs:68-97`）。

### 3. 浏览器公开页面通道

浏览器通道不是通用登录浏览器，而是 MiniMax 的公开页面 fallback：配置限定 `minimax`、`moonshot`、匿名临时上下文、单 context、无个人 Cookie/持久化 profile、禁止签名和 CSRF 模拟、禁止投递与消息，遇到验证/登录/401/403/429 停止且不刷新重试（`careers/config/browser-policy.json:2-16`）。

实现上只允许一次入口导航、1-2 个查询、最多 20 个职位，记录渲染 DOM、截图和站点自动资源；页面管理的子资源不计作主动采集请求（`careers/providers/feishu-browser.mjs:10-20`；`careers/providers/public-browser.mjs:108-146`、`248-276`）。

但 MiniMax `public-browser-v1` 当前注册为隔离变体，带 `BROWSER_ADAPTER_QUARANTINED`，且 `collector.mjs` 只在无 `access_block` 时才会进入浏览器采集（`careers/registry.mjs:26-36`；`careers/collector.mjs:40-55`）。所以“浏览器代码存在”不等于“当前浏览器渠道可用”。

### 4. 搜索引擎 / 搜索索引

当前 `careers` 主 CLI 没有搜索引擎采集命令，也没有把搜索结果自动转为岗位正文。搜索索引只在离线 sweep 输入与报告模型中作为 `search_index` 线索类型存在，报告明确禁止将其升级为完整 JD（`careers/sweep-extract.mjs:47-68`；`careers/sweep-report.mjs:106-121`）。

历史网页工具结果可以被 `sweep-extract.mjs` 从已保存 raw 文件提取，例如 Salesforce 搜索结果只保留不完整正文，并记录“详情未取得”；这属于历史证据重建，不是当前搜索入口（`careers/sweep-extract.mjs:47-68`）。

### 5. 招聘平台

当前 `careers` 代码没有 BOSS、猎聘、拉勾等平台的自动适配器，也没有登录态平台采集入口。现有仓库另有 `06_自动化采集` 的手动采样/导入脚本和历史作业卡，但它们不由 `careers/cli.mjs` 的 `collect` 调度，也不能被 `careers` 的官方来源回执当作同一渠道验收。仓库 package scripts 仍保留 `auth:*`、`open:jobs` 和手动 inbox 导入命令（`package.json:20-35`），这证明旧工具存在，不证明当前 `careers` 平台运行链已接通。

## 二、规则与执行的缺失

### 1. 发现公司没有转成可执行适配器

`company-discovery.json` 是公司发现清单，包含官网、招聘 URL、provider hint 和历史状态；`registry.mjs` 只实现百炼、MiniMax、DeepSeek，其余公司被统一映射成 `provider: not_implemented`、`collection_approval: discovery_only_requires_implementation_and_live_chain`（`careers/registry.mjs:46-52`）。因此配置中的公司数量、verified/candidate 状态、官网链接都不能推出已具备采集能力。

执行影响：`collect --all` 实际含义是“所有已注册适配器”，不是发现清单全量扫描；新公司不会自动进入 A/B 路线波次、也没有自动生成待实现队列（`careers/cli.mjs:57-72`）。

### 2. 来源规则清单没有统一运行编排

政策来源配置声明了五个官方来源、周频和文档字段，但 `scheduler_active: false`；研究文档又明确是显式 URL 捕获，不是自动发现（`careers/config/policy-sources.json:3-14`、`19-21`；`careers/config/research-documents.json:1-4`）。代码能抓取指定文档，却没有“发现本周期新增文件、分页对账、来源完整性声明、未扫描清单”的执行入口。

执行影响：来源规则可以指导人工选 URL，但不能被解释成政策周报已运行或政策范围已覆盖。

### 3. 行业地位分层与运行数据没有连接

本轮主线程负责设立行业内大/中/小厂的行业地位规则；现有运行记录的 `company-discovery.json` 主要保存赛道、相关性、总部口径和入口归属，并没有在 `registry.mjs` 的运行对象、`store` 的 source/run 结构或 provider 返回值中形成可审计的行业地位字段（`careers/registry.mjs:46-55`；`careers/collector.mjs:22-33`）。组织规模是另一维度，当前也未见同等运行字段，不能用行业地位代替组织规模。

执行影响：即使主线程新增分层规则，当前采集结果仍不会自动携带“按哪个版本、哪些证据、哪一层”的可复核字段；行业地位、组织规模与来源执行状态会脱节。此处是接线缺失，不是本文件重新定义分层标准。

### 4. 搜索召回、平台补充和官网采集没有合并为双路线执行器

双路线文档把官网/ATS、招聘平台、招聘公告和搜索索引区分为不同证据来源；但当前 CLI 的公司采集只按固定 registry 适配器运行。`role-policy.mjs` 的实际职责是对已经进入分类函数的单条岗位做规则分类，不是行业扩展或正文召回（`careers/role-policy.mjs:3-19`）。

精确字段边界如下：

- 关闭/连续未观察到的待复核状态读取 `hiring_active`；实习校招排除读取 `title` 与 `employment_type`。产品经理、FDE/交付/项目、销售运营、市场、售前、客户成功、商务/渠道、销售/大客户等主分类首先都匹配 `title`（`careers/role-policy.mjs:4-17`）。
- “增长/运营经理/运营专家/行业运营”这一条先匹配 `title`，再要求同一岗位的 `description_text` 同时出现客户、商户、销售、商业、市场、营销、revenue 或 commercial 等信号，才归入销售及商业化运营（`careers/role-policy.mjs:18`）。
- 未命中上述标题规则时，函数直接返回排除；它不会从未分类岗位中进行关键词召回，也不会搜索公司或扩展来源（`careers/role-policy.mjs:19`）。

执行影响：不能把“角色规则已存在”“搜索结果有线索”或“公司在发现清单中”解释为已完成行业→公司→岗位和关键词→岗位→新公司的波次扫描。

### 5. 公开浏览器的隔离状态尚未回到可用态

配置允许公开浏览器，但 registry 明确将 MiniMax 浏览器适配器 quarantine；当前 collector 会在 source halt/access block 前停止（`careers/registry.mjs:26-36`；`careers/collector.mjs:40-42`）。这保留了安全边界，却意味着 MiniMax 不能被报告为当前可用浏览器来源。

执行影响：历史浏览器样本只能作为历史已验证证据；要恢复必须先完成逐跳重定向边界和一次独立实网验收，不能只改配置或移除 `access_block`。

### 6. “当前在招/全量覆盖/薪资达标”仍不是采集器自动证明

适配器自身把招聘状态保留为 `unknown`，并区分页面快照时间、发布/更新时间和首次观察时间（`careers/providers/feishu.mjs:60-64`；`careers/providers/deepseek.mjs:83-101`）。Bailian 和 Feishu 的完整性只证明各自官方板的观测范围，且 scope 明确 `company_wide: false` 或有页数上限（`careers/collector.mjs:26-30`；`careers/providers/feishu.mjs:77-82`）。

执行影响：完整 JD 不等于当前开放；公司官网入口不等于岗位直链；未披露固定月薪不能因公司或岗位层级推算为 20K 达标。

## 三、历史验证与当前状态分界

### 历史已验证，可复现但不代表本轮当前可用

- 百炼、DeepSeek、MiniMax 曾产生真实原始响应、报告和完整 JD 样本；历史状态在 `careers/progress.json:114-118` 记录，MiniMax 浏览器适配器已标 quarantine，不能直接复用。
- HTTP 安全边界、离线 DOM/AST 解析、robots 处理、挑战停止和报告完整性有测试或历史审计证据；代码位置见 `careers/http.mjs:34-45`、`108-138`、`193-245`。
- 搜索索引、网页工具和 sweep 提取有历史 raw 文件及确定性行范围提取器；这证明历史材料可重建，不证明今天重新访问成功（`careers/sweep-extract.mjs:19-44`、`47-68`）。

### 当前本地可用，但本轮未验证

- `careers/cli.mjs` 的离线 `doctor`、报告重建、显式研究文档命令和已有 provider 代码可以静态调用，但本轮没有执行它们，以避免写入或触发外部访问。
- 注册表中的三类官方适配器和浏览器 fallback 仍在代码中；其中 MiniMax HTTP/browser 变体有访问阻断或隔离，DeepSeek/Bailian 未因代码存在而获得本轮可访问声明。
- `policy-sources.json`、`company-discovery.json`、`browser-policy.json`、`access-policy.json` 和 `research-documents.json` 都是规则/输入，不是运行回执；尤其 `verified`、`enabled`、`source` 或 provider hint 不可替代当次请求证据。

## 四、已证实实现缺口

以下是代码/配置已直接证明的当前缺口，不把潜在误用当成已经发生的事故：

1. **P1：已实现来源没有统一任务、覆盖和证据状态接线。** 当前只有已注册适配器进入 `collect`，发现清单、未实现公司、未扫描范围和来源覆盖分母没有形成统一运行产物；研究文档也只支持显式 URL。整改：先让运行产物区分 discovered、implemented、attempted、captured、not_scanned、blocked 和 incomplete，并保留来源贡献与待续清单。
2. **P1：已实现来源没有接入行业地位/组织规模证据字段。** 主线程冻结规则后，当前 source/run/job 结构仍不会自动记录规则版本、证据引用、行业地位层和独立组织规模层。整改：先补字段和报告链，不由名称、总部或 provider hint 推断。
3. **P1：搜索索引、平台线索和官网/ATS 结果没有统一证据契约。** 当前 `careers` CLI 没有平台适配器，搜索索引仅能作为 `search_index` 线索。整改：统一 `source_kind`、正文完整性、原生岗位 ID/直链、时间语义、薪资证据和停源状态。
4. **P1：政策来源配置没有对应的发现、分页对账和周期运行器。** `scheduler_active: false`，研究捕获是显式 URL；现状不能证明周期覆盖或“无新政策”。整改：先实现版本化分母、受限/真空/未扫描状态和离线可回查运行记录。
5. **P2：角色分类范围有限且字段边界容易被误读。** 已分类岗位必须先进入函数；绝大多数规则只看 `title`，只有增长/运营分支额外看 `description_text`。它不是正文召回器，需在双路线执行器中另接召回和分类。
6. **P2：历史与当前状态的隔离依赖运行产物持续标注。** 适配器保留 `unknown` 招聘状态和时间语义，但没有新运行就不能得出当前开放结论；整改是强制保留 `observed_at`、证据年龄和当前验证状态。

## 五、假设误用风险（不是当前已发生事故）

1. **假设误用：把 `collect --all` 当成全行业/全公司采集。** 代码实际只遍历已注册适配器；这是可能产生错误解读的边界，不是当前已发生的 P0 事故。文档应把命令语义写成“所有已注册适配器”。
2. **假设误用：把隔离浏览器代码或 `enabled: true` 当成当前可用来源。** 当前隔离本身是保留条件和安全门禁，不等于已发生越界。恢复前仍需独立完成逐跳 redirect/host/address 发送前校验及一次受控实网验收；这项工作独立排队，不阻塞其他可用来源接线。
3. **假设误用：把搜索索引、公司入口或完整 JD 当成当前在招、职位直链或固定底薪达标。** 这是证据升级风险，需由报告状态和字段阻止，不应描述成已经发生的数据事故。
4. **假设误用：把行业地位层当成组织规模。** 两者必须独立记录；本审计不替主线程制定任一维度的具体标准。

## 六、整改顺序

1. 先接通已可用来源的任务与覆盖状态：补齐 discovered、implemented、attempted、captured、blocked、incomplete、not_scanned 等状态及版本化分母。
2. 再把双路线的 pending queue、有限波次、A/B 来源贡献、共同命中和待续清单接入 CLI/report；不以 `collect --all` 代替。
3. 统一官网 HTTP、官方 ATS、搜索索引、招聘平台和研究文档的证据契约；平台登录/验证码继续按现有停源边界处理。
4. 主线程冻结行业地位规则后，接入行业地位、独立组织规模、规则版本和证据引用字段，并补报告与测试。
5. 单独处理浏览器适配器：在不阻塞前述可用来源接线的前提下，完成逐跳边界证明，再决定是否进行受控实网验收；期间维持隔离、不重试、不改旧证据。
6. 最后才做新的受控实网验收；本轮不执行，不把静态检查或历史通过记录写成新验收。

## 结论声明

本轮没有新的实网验收声明。未联网、未扫描、未运行浏览器、未修改数据；唯一新增文件是本审计文档。当前最关键的执行事实是：本地已经有受限的官方 HTTP、显式研究 URL 和隔离浏览器代码，但尚没有把行业发现、公司分层、搜索/平台补充和覆盖分母编排成一条可证明的当前运行链路。

## 主线程补充验证

以上“不运行浏览器/唯一新增文件”描述子代理的盘点范围。主线程随后执行 `npm run careers:doctor`，返回 `ok:true`、Node v24.19.0、SQLite 3.53.3、`live_requests:0`。三家注册源中百炼智能与DeepSeek配置启用，MiniMax返回 `BROWSER_ADAPTER_QUARANTINED`；全部当前实网状态仍为 `unverified_until_live_capture`。

doctor和测试可能使用沙箱Chrome做本地DOM能力检查，不导航招聘网站、不登录、不采集新岗位。全套162项离线测试与Skill校验通过；这是本地能力和规则检查，不证明上述两个配置启用来源今天访问成功。新分层与来源目录尚未变成自动运行器。

独立初审后的F2分层规则澄清已增加1项配置回归；主线程再次全套运行结果为163通过、0失败，Skill再次通过。F2修订不改变上述运行接线及来源访问结论。
