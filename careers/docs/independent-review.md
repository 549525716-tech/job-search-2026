# 官网求职系统独立检核

## 本阶段结论

**本轮按雏形交付范围收口，不作完整系统验收。** F1-F8、连续 OTE、草稿标记以及 F9/F10/F11/F13 的原反例已定向关闭；F12 重定向 P1 未修复，浏览器适配器已在 registry 隔离。MiniMax 失败 run 和 halt 保留，本轮没有修复后实网重跑。4 条 tailor 已完成独立语义审查并落盘回执：3 approved、1 rejected；其余 11 条未审、保持 pending。批准仅指证据和建议忠实，不是可面试、录用概率或简历 reuse 结论。

首次快照是 **74/74 unit 通过但发现 4 项 P1、4 项 P2**；修复后本检核明确选择冻结相关的 8 个测试文件，最新一次 **81/81 通过**。没有把未冻结 `provider-stage2.test.mjs` 包含在本轮 unit 数字或 HTTP 源码验收内。

指定三份已保存来源报告共 **48 条规范岗位**，与原始数据和证据对齐。这里只验收所给 checkpoint 的来源内容，不宣称所有岗位仍在招聘、全站采完、浏览器适配器可稳定重跑，或 15 条个人匹配已获语义批准。

- 检核角色未参与实现；本阶段未修改实现、配置、个人档案或生产数据库。
- 实际 dispatch：`gpt-6-astra`，`max`；检核 agent ID：`01a086a5-5b5b-7522-a6d1-7674145d21ad`。Token 用量未知，不估算。
- 范围：`careers/store.mjs`、`salary.mjs`、`matching.mjs`、`overview.mjs`、`cli.mjs`、`run.mjs` 及对应测试；项目 Skill 和匹配输入契约。为理解接口，只读了 `normalize.mjs`、`paths.mjs`、`report.mjs`、相关配置。
- 初轮未审核当时仍在开发的 HTTP 适配器；后续授权冻结源码定向审查见增量章节。**所有阶段均未发起 HTTP、DNS 查询或网站导航**。
- 复现采用内存 SQLite、纯函数和临时测试目录；未运行生产 `collect`、`match:prepare`、`match:import`、`report`。
- “首次 Findings”中的行号和哈希对应首次发现时的代码，作为历史复现保留；当前结论见下方复验矩阵和新增 checkpoint 章节。

## 修复复验矩阵

| 编号 | 本轮结果 | 独立验证 |
| --- | --- | --- |
| F1 | 原反例关闭 | 真实学历原文不能支撑博士 `met`；虚构个人引用及原 AI 合同/POC 断言被拒绝；初导入为 pending/reuse=false；不同作者、已注册 reviewer、绑定 digest 的内存夹具 receipt 才可放行 reuse |
| F2 | 原反例关闭 | 原英文 PhD/work authorization 遗漏被拒绝；学历、CS 专业、工作许可仍以现有事实约束，不以合法证据 ID 自动证明 |
| F3 | 关闭，含追加边界 | 年包/p.a. 与 month hint 冲突拒绝；连续 `OTE30-60K/月`、带空格和冒号 OTE 均不进底薪池；15-20K/15-30K 仍合格，18-19K 不合格 |
| F4 | 新数据写入与正常读取路径关闭 | 内存 DB 两次分页不全均保存 failed/complete=false/INCOMPLETE_SNAPSHOT，不推进 missing_count；报告非完整；halted source 在后续成功记录后仍展示 blocked/warning |
| F5 | 关闭 | 新覆盖字段逐项改变 cache_key；临时目录实跑 prepare/import/cache，employment_type 改变后重新入批，旧导入被拒绝；实习类型不召回 |
| F6 | 关闭 | 原 `)[INJECTED](` URL 在 Markdown 输出中被百分号编码，不能结束原链接 |
| F7 | 关闭 | `10:00+08:00` 与更晚 `03:00Z` 的较晚成功 run 被正确选中 |
| F8 | 关闭 | 明确 closed 显示“来源明确已关闭”，missing_pending_review 与 active/open 保留状态区分 |

本轮 related-flow 16 组独立断言全部通过：包含 quote 来源、初始 pending、拒绝自身/未注册 reviewer、拒绝 digest 变动、缓存 digest 稳定、receipt 重载升级、JD/就业类型失效、旧批次导入拒绝。所有 receipt 均仅是内存测试夹具，**没有为真实候选签发审批**。

复验发现 `OTE30-60K/月` 漏判和 Markdown/CSV 草稿状态遗漏后已立即通知主控。最新版本已按 7 个薪资断言及 HTML 主行/Markdown/CSV 三个状态断言重新通过，不把“主控说修好”替代复验。

F4 有一个保留的低风险输入契约边界：如果绕过新 store，直接向 buildOverview 传入旧式自相矛盾对象 `status=empty,complete=true,pagination.pages=3,pages_fetched=1`，其 effectiveStatus 仍信任 true。指定三源 checkpoint 没有该矛盾，新 store 写入会拒绝/降级。此项不用于宣称所有任意旧 JSON 已被重新审计，后续历史导入必须经完整性校验。

## 首次 Findings

### F1 [P1] 合法证据 ID 可以支撑与个人原文矛盾的学历和 AI 成果

**位置：** `careers/matching.mjs:119-143,148-160`。

`evidence_ids` 只检查 ID 存在；`direct`/`met` 是导入文件自行声明。现有个人 `hard_boundaries` 和规则 `never_infer` 不参与导入校验，公共声明 guard 只检查已删除的小成交量数字。

最小复现：读取 `loadMatchContext()`，在含有“必须具有计算机专业博士学历”的夹具 JD 上添加一项要求：

```json
{
  "id": "R3",
  "requirement": "计算机博士",
  "jd_quote": "必须具有计算机专业博士学历",
  "weight": 5,
  "coverage": "direct",
  "evidence_ids": ["EV-EDUCATION"],
  "explanation": "候选人已具有计算机博士学历。",
  "hard_gate": true
}
```

在原有三条客户经营要求外，令此项 gate 为 `met`，并设置 reuse 的三个布尔值为 true。`validateAssessment()` 接受，返回 `score=100`、`resume_reuse_eligible=true`。实际 EV-EDUCATION 明确是行政管理本科，且“不是计算机专业，也没有硕博证据”。另把 `value_proposition` 改成“已经完成AI产品签约回款并交付企业级AI POC，合同额1000万元”也被接受。

**影响：** 自动导入会把明显矛盾的个人事实输出为直接证据和可沿用简历结论。ID 完整性不等于事实支持关系正确。

**修复状态：** 本轮定向复验已关闭原反例。精确引用是出处校验，不是语义等价证明；真实候选仍需独立语义审批。

### F2 [P1] 英文学历与工作许可硬门槛可完全遗漏并允许 reuse

**位置：** `careers/matching.mjs:96-98,135-145`。

最小复现：在测试中的三条客户经营描述后追加：

```text
Required: PhD in Computer Science. Must have valid US work authorization.
```

`hardGateSignals()` 返回 `[]`。分析只覆盖三条普通客户经营要求、`hard_gates=[]`、各复核布尔值为 true 时，验证返回 `score=100`、`resume_reuse_eligible=true`。

**影响：** 明确博士、专业和海外工作许可要求可以不进入 unknown/unmet，违背先核查全部硬门槛再建议沿用简历的约束。

**修复状态：** 本轮定向复验已关闭原英文反例，且未获独立 receipt 的 reuse 仍被拒绝。

### F3 [P1] 原文年包/p.a. 未识别，月薪提示将其变为 20K+ 月薪

**位置：** 首次发现版本 `careers/salary.mjs:36-45,72-82,107-108`。

```js
parseSalary('综合年包30-60万', { currency: 'CNY', period: 'month' });
parseSalary('CNY 30-60K p.a.', { currency: 'CNY', period: 'month' });
```

原版本分别返回 `salary_period='month'`、金额 `300000..600000` / `30000..60000`，并且 `salary_20k_eligible=true`。原文年度语义没有被识别为与 hint 冲突，不能用平台默认提示改写明确原文。

**影响：** 年包混入人民币月薪上界 20K 池；不是合法的月薪归一化，也不是允许的年薪折算。

**修复状态：** 年包/p.a. 原反例及追加连续 OTE 反例均已独立复验关闭。

### F4 [P1] 分页完整性仅用于缺失计数，持久化和报告仍显示完整无岗位

**位置：** `careers/store.mjs:195,267-270,300-301`；`careers/overview.mjs:39-48,53-64`。

最小复现：内存 DB 先保存一个正常全量基线，再两次保存下面的终态，均使用相同 collection scope：

```json
{
  "status": "empty",
  "complete": true,
  "jobs": [],
  "errors": [],
  "scope": {
    "kind": "official_board",
    "board_url": "https://example.invalid/jobs",
    "pagination": { "pages": 3, "pages_fetched": 1 }
  }
}
```

实际：缺失计数正确保持 `0`，旧职位未关闭；但保存的 run 仍是 `complete=true,status=empty`。`buildOverview()` 返回 `complete_sources=1,incomplete_sources=0,source_stale_warning=false`，页面显示“完整扫描无岗位”。原有 `data-stage2.test.mjs` 已接受过类似完整性冲突输入，但只断言缺失计数，没有检查最终报告。

**影响：** 数据层已经发现分页不完整，报告却抹掉这一事实，误导来源验收及市场空结果判断。`completeSnapshot()` 应成为统一的有效完整性判断，不能只保护缺失状态。

关联已复现：`failed/HTTP_ACCESS_STOP` 后保存成功 run，`listSources().source_health` 保留 `halted_pending_review`，但 overview 行仍输出 `success` 且无 warning。overview 收到 `sources` 却不使用其健康状态。

**修复状态：** 新写入的分页降级、持久化、overview 和关联 halt/warning 路径已复验；未经 store 的旧矛盾 JSON 边界见本轮矩阵说明。

### F5 [P2] 匹配缓存忽略岗位类型等已进入输入的字段变化

**位置：** `careers/matching.mjs:41-47`。

```js
matchCacheKey({ ...job, employment_type: 'full_time' }, context)
  === matchCacheKey({ ...job, employment_type: 'intern' }, context); // true
```

`department`、`requirements`、`responsibilities`、`locations`、`salary_kind`、`salary_status`、`detail_completeness` 的单字段变化也不改变缓存键。这些字段包含在发送给评估者的岗位对象里，至少岗位类型、薪资类型、完整性状态的改变会影响匹配及风险判断。

**影响：** 字段变化仍可命中旧分析；“JD变化使缓存失效”只覆盖选定字段，不覆盖实际评估输入。建议明确统一用于分析和缓存的规范化输入集合，不散落维护两个契约。

**修复状态：** 字段变动、临时批次重入、旧导入拒绝均已独立复验通过，检核角色未修改实现。

### F6 [P2] Markdown 岗位 URL 可以结束链接语法并注入另一条链接

**位置：** `careers/overview.mjs:119,128`。

```js
job.job_url = 'https://example.invalid/)[INJECTED](javascript:alert%281%29)';
```

`safeURL()` 只检查 HTTPS/凭据，`renderOverviewMarkdown()` 输出：

```markdown
[原文](https://example.invalid/)[INJECTED](javascript:alert%281%29))
```

**影响：** 不可信源字符串逃出原有 Markdown 链接，能新增伪造链接。此复现证明语法注入，**不宣称已经执行 JavaScript**；执行仍取决于 Markdown 查看器的安全策略。即使查看器拦截 javascript，额外 HTTPS 链接也可污染来源展示。

窄修复参考：同仓 `careers/report.mjs:21` 已对链接 URL 中 `()<>` 做百分号编码；overview 应使用相同规则。

**修复状态：** 原 Markdown 注入反例已独立复验通过。

### F7 [P2] 报告按字符串排序时间，带时区 run 会覆盖实际更新结果

**位置：** `careers/overview.mjs:39,53`。

最小复现：同源两条 run，较早失败记录开始于 `2026-09-09T10:00:00+08:00`，较晚成功记录开始于 `2026-09-09T03:00:00Z`。实际后者晚一小时，`buildOverview()` 却选前者为 last_run，返回 `source_health='failed'`。

**影响：** 来源健康、完成计数、失败信息和 warning 会被错误的历史记录覆盖。store 已接受且按实际时间正确处理 UTC offset，overview 不应退回字符串比较。

**修复状态：** 原带 UTC offset 的排序反例已独立复验通过。

### F8 [P2] 已明确关闭的岗位在 HTML 全部样本中仍显示招聘状态待确认

**位置：** `careers/overview.mjs:84-86`。

最小复现：内存 DB 保存带显式关闭证据的 `hiring_active='closed'` 职位，之后调用 `buildOverview()` 和 `renderOverviewHTML()`。结构化数据保留 closed，但 HTML 行显示“招聘状态待确认”，没有关闭/下架标记。

**影响：** 全部样本保留历史职位是正确的，但源已确认关闭的事实在主要查看界面被降为未知。active 和 missing_pending_review 也没有独立显示状态。应保留来源状态与来源健康两个维度，不互相覆盖。

**修复状态：** 原 closed HTML 状态反例已独立复验通过。

## 已验证保护

- 首轮基线与后续新增观察分离，首次观察不是发布日。
- native ID 去重、同标题不同 ID 保留、冲突去重事务回滚通过现有测试。
- 失败、partial、query、filter、分页截断不推进岗位缺失计数；两次完整缺失只进入待复核，不直接下架。
- 保留第一次观察时间，拒绝乱序终态；旧 schema 迁移使用临时 DB 且保留原记录测试通过。
- 原有薪资测试中的月薪 15-30K、18-19K、年薪、外币、OTE、提成和未披露分离通过。F3 是缺少的原文表达边界，不否认这些已通过样本。
- 评分由加权覆盖计算，不接受输入直接覆盖分数；结果和报告声明不是面试概率。
- JD/画像/偏好/规则/简历哈希的现有覆盖项变动会失效；F5 是遗漏的岗位输入字段。
- HTML 文本转义、javascript job URL 拦截、CSV 公式前缀防护的已有测试通过。F6 单独针对 Markdown URL 语法边界。
- CLI 没有自动投递、消息发送或新增 LLM API 调用分支；run 启动器 test 分支执行离线 `*.test.mjs`，不执行 live-http-audit/visual。

## 测试与版本证据

执行：`npm run careers:test`。Node 启动器选用本机 `v24.19.0`；结果 `tests=74,pass=74,fail=0,skipped=0`，退出码 0。追加反例采用 `node --input-type=module` stdin 脚本直接导入待审函数；没有写入实现或测试文件。

CLI/启动器追加检查：`node careers/run.mjs --help` 正常返回手动命令列表；`node careers/run.mjs invalid-command`、`node careers/run.mjs report --all` 均返回 `COMMAND_FAILED`、退出码 1。后两种输入在实例化 CareersStore 之前拒绝，未打开生产数据库。未为验证分支调用实际采集、报告写入或浏览器 doctor。

首次发现时模块 SHA-256：

```text
store.mjs    9622f8982edc4e5fafa811808e49b470550a5cf6cd48a8916532193b7cda0212
salary.mjs   e6052e9c4e54fb59a589865ba5509e88972854c585f8b2b5857f87962c98fb37
matching.mjs 9f27c07cd03bb02c97ae62de4f68c12dacd2c02587543085b0134e690bfa3e7b
overview.mjs 25c750144c0792709281c178f82719801368baf5eab6dd60d550265ca3446797
cli.mjs      c753243990a499f0ecb7c251bac935ff8ee9e9489f9a8a96e2c2b61f3535e70f
run.mjs      c805a415ba57c311f40e85578e746d683dbe239b0f17439ee8330f9aee34c179
```

## 指定三源原文 Checkpoint

只读范围为 `01_行情收集/official-careers/reports/` 下的以下三个报告及其直接引用的原文/回执/DOM/截图。没有借此执行未冻结 provider 或导航网站。

| 报告 | 原文复核结果 | 正确范围 |
| --- | --- | --- |
| `bailian-f9e68c64-1dc9-4b20-9d58-568eeeddb010.json` | 4 条；原 Nuxt literal、页面 4 个原生卡片与规范记录一致 | 此单页招聘板完整；不是全公司市场搜索 |
| `deepseek-a0149d8d-fc16-49b2-b1b0-1cb599fd4e46.json` | 官方静态脚本 literal 内 34 条，33 条完整描述与规范记录一致 | partial；1 条占位记录不能算 full JD |
| `minimax-browser-c3b01ddc-0b77-481f-99b1-d21d3a95bce8.json` | Business 4/4，销售 9/9，原生 ID 去重 11 条；逐条核对原 JSON、完整描述及 native DOM anchor | partial 查询样本；默认 10/202 仅保存 raw，未进入规范记录 |

三条官网归属边均在保存的 HTML 中找到对应原生链接：百炼 about -> joinus 2 个，DeepSeek 官网 -> talent 4 个，MiniMax careers -> Feishu board 2 个。15 组唯一 body/metadata 的 SHA-256 与回执/报告一致；33 个原文、回执及报告文件在检核前后复哈希一致。

HTML 只通过临时、断网、禁用页面 JavaScript 的 detached DOMParser 读取；DeepSeek 用 Babel AST 取出 JSON.parse 的字符串字面值，再 JSON.parse 数据，没有执行原网页脚本。Bailian 用已审查的 Nuxt literal 解码读取原始对象，同时对照原生页面卡片。首次夹具把 null-prototype AST 对象按 prototype 比较、以及把 null 要求拼接为字符串，出现 5 个夹具误报；改为规范 JSON 比较与 null-aware 文本比较后全部通过，没有将其登记为产品缺陷。

### MiniMax 三岗重点抽查

| 原生 ID | 原文标题 | 完整地点 | 薪酬证据 |
| --- | --- | --- | --- |
| `7208019802982598968` | 大模型技术销售工程师 | 深圳 / 北京 / 上海 / 广州 / 中国香港 | salary_raw=null；原 job_post_info 的 min_salary/max_salary/currency 均 null |
| `7612560574200023323` | 大模型销售运营 | 北京 / 上海 | 同上，未估薪 |
| `7647795653489527081` | 大模型销售负责人-华南 | 广州 / 深圳 | 同上，未估薪 |

三岗 `description_text` 分别 411、689、677 字符，完整职责及要求均与 `browser-public-079.body` 一致；该 body SHA-256 为 `3d637689d9b663e1c82134505541312b2fa8720bc793de8ec3d12b8a16222aa3`。对应 URL 都能在 `browser-004.dom.html` 的原生 a[href] 中查到，并与报告 source_locator 的 native_link_evidence 对齐，不是按 ID 猜链接。

已目视 `browser-004.png`：MiniMax 搜索关键词“销售”、结果 9 条，三个重点岗位都在截图首屏可见。截图只辅助核验展示，完整要求仍以原 JSON/DOM 留证为准。

### DeepSeek 原始链接与占位项

33 条 `currentJobLinks()` 输出逐条等于原脚本记录的 `detailUrl`，且 URL hash 中的原生 ID 相符；调用前后的输入 JSON 不变。历史 run 的 board job_url 没有被写回修改。`link_verification=source_embedded_not_navigated` 表述正确，**没有验证第三方职位页当前仍可访问或可投递**。

唯一未规范化项为 `d6cff61d-f03f-4440-8a69-900cb407af5b`，标题“AI 产品运营（体验与服务方向）”；原文只有 `<p><strong>（新部门，虚位以待）</strong></p>`。报告 JOB_PARSE_FAILED/SOURCE_PLACEHOLDER_NOT_FULL_JD 与原文一致。发布者数据集时间 `2026-09-07T06:09:32.312Z` 不等于本次观察时间，也不能当作新发布日期。

## 主动访问日志只读复核

检核时日志已扩到 **73 个 HTTP start/finish 对 + 3 个浏览器主动动作**，不是较早口头 checkpoint 的 70 HTTP。最新记录结束于 `2026-09-09T15:24:18.832Z`。

- 独立读取 requests.jsonl/browser-actions.jsonl，逐个核对 76 个完成记录指向的 body 与 metadata SHA-256、记录起止时间；未发现哈希不符。
- 按日志记录的开始时间合并主动动作排序，前一完成到后一开始的最小间隔 **10,717 ms**，未见重叠或小于 10 秒。
- 浏览器主动动作去重后 3 个：前 2 个只有 finish 记录携带 started_at；第 3 个有独立 start，另有 2 份 finish。两份 finish 去掉 event 标签后内容一致，等价重复数为 1。
- **没有补写旧 start 记录。** 前 2 个动作的间隔证明依赖 finish 记录所载 started_at，不能说这两个动作已有独立持久化 start 日志。
- 网页自动子资源与采集器主动动作区分。以上数字不是“所有浏览器 HTTP 资源都逐个限速”的证明；没有为检查这些记录发网络请求。

## 本轮 Unit 与版本证据

明确执行 Node 24.19.0 的 `--test`，参数为 config、data-stage2、matching、overview、parser、safety、store、review-regressions 八个 `.test.mjs`。首轮复验 77/77，主控继续补回归后末次 **81/81**，退出码 0。未执行未冻结 `provider-stage2.test.mjs`，也未运行 live audit 命令或重跑真实采集。

本轮记录到的源码 SHA-256：

```text
store.mjs    587082e10e9f422ba0587e520745e644d11fc345347f370fa8133b81630d286f
salary.mjs   9aae4c233933817c894c576220f0a833bd9f50ba12af2cd6b73597b8aa87bc91
matching.mjs a7567ebdeb6ef3a1052e34b768334afc19df7dadf70ba22d75466a19ed01d457
overview.mjs 0126fc26cf15a0b870daaac1889fa0ecf3312627f0b2bffa7ef316b8be8c1584
reviewers.json 06c84cbc2a282a658a450bcaabe135efcd816d972be6a5e459d3305ef415d5ae
```

## 尚未验收与交接

- 核心 HTTP/browser adapter 已获授权定向审查；首次最终 CLI 实跑 failed，新增问题及限定误报清理判断见下文。可重复端到端成功尚未验收。
- 真实 15 条个人匹配由 Raman `01a086c3-f330-7422-82e3-1364f5f9a66b` 制作。唯一 answers/batch 为 `9efac8a7-3403-40e0-bb0d-17c125ed4b31`；按最新收口要求只完成 4 条 tailor，结果见末尾，其余 11 条不签。
- 软件 F1 修复通过不等于这 15 条事实映射已经正确；检核角色不改作者答案，主控负责 import。
- 未创建定时任务、未投递、未发招聘消息、未上传简历。模型 token 用量仍未知，不杜撰；本地 receipt 的 ID/哈希校验也不被描述成独立模型计费证明。

## 冻结 Browser / HTTP 增量检核

只读范围：`providers/public-browser.mjs`、`providers/feishu-browser.mjs`、`collector.mjs`、`registry.mjs`、`normalize.mjs`、`http.mjs`、`robots.mjs`，并核对共享 `lock.mjs`、权限配置与相关 tests。不重做此前 48 条原文 QA，不运行生产采集或修复 SQL。

本地独立执行 `npm run careers:test` 得到 **87/87，exit 0**，含新增 4 组 `feishu-browser.test.mjs`；随后 `browser-access.test.mjs` 单独 **14/14，exit 0**。这是不同时间的测试快照，不将两次数字拼成一次完整验收。另对实际保存整页文本及 6 种混入真实 gate 的文本独立断言通过。主控所述 8 条回放和 5 项 mock 不算作本检核自行执行的测试数字。

### F9 [P1] CLI 首次导航将正常 JD 的模型验证误判为访问挑战

**发现位置：** `careers/providers/public-browser.mjs:150-153`，首次冻结 SHA-256 `418a760e6cb13e85d4c948b11bc5d431695c24f7fb295c1f4b97eae616f414f1`。

失败 run：`minimax-85d3f00e-3d1a-478b-94e0-6466ad029e5e`。原 `inspectAccess` 对整个 body.innerText 匹配 `完成.*验证`。保存 DOM 中，原生岗位 `7675996052562921778`「大模型预训练数据算法工程师」的普通 JD 写有“最终通过预训练实验完成模型效果验证”。最小反例：

```js
/完成.*验证/.test('最终通过预训练实验完成模型效果验证'); // true
```

命中片段精确为“完成模型效果验证”。截图为正常公开招聘列表，显示 202 条；离线 DOM 未见 captcha 节点或 role=dialog。保存证据未显示真实 gate，且实际命中来源已明确定位为 JD 业务内容，不能把这次 CHALLENGE_STOP 描述成网站真正要求验证码。

证据目录：`01_行情收集/official-careers/raw/minimax-85d3f00e-3d1a-478b-94e0-6466ad029e5e/`。

- 3 个 HTTP start/finish 配对，状态为 200、200、404，404 是已审批的 robots 缺失响应，并非拒绝访问。
- 60 条 browser resource 响应为 59 个 200、1 个 204，**没有 401/403/429**。
- 只有 entry_navigation 的独立 start/finish；没有 Business 或销售动作。前序完成到下一主动开始间隔为 19218、25218、15093 ms。
- 5 组 body/metadata 的字节数和 SHA-256 一致。DOM SHA-256 `1ada7efdea8d6d47a69ef18547ba643d66a37b1a430a375b415c1669b1807931`；截图 SHA-256 `e6bdda6bfff9f125ed7a2953fa200c64554afc78c01f9623269dbc740df02210`，已独立复哈希并目视。
- 默认公开 JSON 10/202 仍留 raw；本次没有新规范岗位是查询尚未执行，不是公司 0 岗位。仅使用 `DatabaseSync({readOnly:true})` 的 SELECT 确认 DB 仍保留 4+33+11=48 条；失败 run 仍为 failed/complete=0。

**检测函数修复已复验：** 新 `browserAccessGate` 不再使用泛化 `完成.*验证`。原 6582 字符整页文本返回 false；追加请先登录、人机/安全验证、英文 CAPTCHA/sign-in 提示均为 true。新增 14 项测试均通过。该轮函数修复 SHA-256 `9082042c2bc8dce527051b84d9ffa53eb0b2948453e3a2cdf92018383dc40344`；不因此关闭下面独立的调用顺序问题。

### F10 [P1] 真正 gate 先出现时被列表 ready 超时遮蔽，未持久化停源

**位置：** 首次冻结 `public-browser.mjs:203,223,238`；仅完成 F9 修复后的对应位置为 `:209,229,244`。调用方 `feishu-browser.mjs:165-167`；持久化 `store.mjs:320`。

最小离线夹具：入口 goto 返回 200，body 为“安全验证：请完成下方验证后继续访问招聘职位”，包含真实验证 dialog，但网站不返回职位列表 API。实际模块先执行 ready -> waitForPublicList，再运行 inspectAccess。内存 VM 仅替换浏览器、DNS和文件系统依赖，30s timer 缩短；DNS stub 一调用即抛错，文件写入全部进入内存 Map。调用真实 collectFeishuBrowser 与内存 store 得到：

```json
{"navigationCalls":1,"accessTextReads":0,"closeCalls":1,"leaseAfterCalls":1,
 "errorCodes":["BROWSER_QUERY_MISSING","BROWSER_PUBLIC_LIST_TIMEOUT"],"persistedHalt":null}
```

**影响：** 原版本本 run 会停止并关闭浏览器，但真正 gate 被记成普通 timeout，未保存 CHALLENGE_STOP；下一次 CLI 因 haltedReason=null 可再次访问限制页。此为纯离线反例，**不是本次真实 MiniMax 页面存在 gate 的断言**。

**修复复验：原反例关闭。** 最新 withAccessChecks 在 ready 前及等待期间检查 gate。独立重跑上述实际模块 VM + collectFeishuBrowser + 内存 store 夹具，得到 accessTextReads=1、CHALLENGE_STOP、持久化 haltedReason 非空，navigation/close/lease.afterRequest 各一次。没有把本次失败现场改写成真实 gate，也没有联网验证所有等待/中断分支。

### F11 [P2] 后续坏 view 会丢弃先前成功 query 的规范观察

**位置：** `careers/providers/feishu-browser.mjs:64-65,190-194`，SHA-256 `c82d820f7f594a9e3f0b36d1423b60814aef60d7f4982080bffc74905e19a30b`。

最小离线夹具：Business 返回 1 条完整 JD、原生 anchor 和 count=1；下一销售响应仍有完整记录，但 count='1' 发生 schema 漂移。Business 单独解析得到 1 条；实际 collectFeishuBrowser 处理两次响应后得到 jobs=[]、BROWSER_PARSE_FAILED/BROWSER_PUBLIC_LIST_PAGINATION、source_metadata={}。因为后一个 view 的 throw 抵达整体 catch，前一个成功观察也被清空。

**影响：** 原版本不删除生产旧 jobs，raw body 也仍可在目录找到；但当前 run 的有效新观察及 public_response_evidence 索引没有作为 partial 保留。原 48 条 checkpoint 不受该夹具影响。

**修复复验：原反例关闭。** 对完全相同的 count='1' 后续坏 view 重新运行实际 collectFeishuBrowser 离线夹具，先前 1 条完整岗位保留、complete=false，BROWSER_VIEW_PARSE_FAILED 精确指向销售响应 metadata，3 个 public_response_evidence 全部保留。只验证了所述 schema 漂移反例，没有扩展到所有可能损坏类型。

### 限定误报清理判断

历史停源确属 F9 假阳性。只读核对时，`minimax-public-browser.latest_run_id` 精确等于上述 85d3f00e run；当前 halted_reason 精确为：

```json
{"code":"CHALLENGE_STOP","browser_code":"BROWSER_CHALLENGE_OR_LOGIN","message":"Visible public UI requires verification or login","evidence":null}
```

**最新收口决定覆盖此前有条件清理建议：本轮不清 halt，不实网重跑。** 假阳性成因的事实判断仍成立，但不再作为本轮执行清理的许可。生产 DB、失败 run、raw/截图/metadata 及原 jobs 均保持不动；本检核从未执行清理 SQL。

没有授权通用 force/resume 开关、忽略未来 gate、清理其他来源或重写历史失败状态。`minimax-feishu` 的 HTTP 405 限制不变。F12 尚未修复，当前 MiniMax registry 已设置 BROWSER_ADAPTER_QUARANTINED；保留现有证据用于雏形展示，不宣称浏览器适配器可重跑。

### F12 [P1] Browser redirect 后续跳转不经过现有 URL/DNS 校验

**位置：** `careers/providers/public-browser.mjs:76-100` (F9 函数修复版)；本地已安装 `node_modules/playwright-core/types/types.d.ts:4009`、`node_modules/playwright-core/lib/coreBundle.js:35824-35831`。

当前 URL、public DNS、同 origin 导航及重定向次数限制均位于 context.route 回调。当前安装的 Playwright 明确规定 redirect 只在首 URL 调用 route；实际 Chromium network manager 的 redirectedFrom 分支直接发送 Fetch.continueRequest，不再提供 route。

最小反例：已审批的 board 或其 CDN 首请求返回 `302 Location: https://unapproved.example/`，或指向私网 IP URL；后跳为 200 普通 HTML。首 URL 通过检查，后跳不执行 URL/DNS/origin 检查；本模块 request handler 仅计时，response handler 仅按 401/403/429 停止。即使最终 parser 报来源不符，越界网络访问已经发生，navigationCount 也不能正确限制此链。

**证据等级及当前状态：** 本地实现和当前 SDK 契约直接证明的反例，不是实际联网攻击复现，也不声称保存的三源访问已经越界。发送前的后跳校验缺失不能用末端页面 URL 校验替代。本轮不新增复杂修复；已只读确认 getCompany('minimax').access_block.code 为 BROWSER_ADAPTER_QUARANTINED。缺陷列入 known-issues，隔离不等于修复验收。

### F13 [P2] Robots 规则优先级按编码前文本长度比较，误放行更具体禁区

**位置：** `careers/robots.mjs:108`，SHA-256 `68630639ced2fbcf3eca3976781e11954427bad307ffd2c441658452b1a8194c`。

最小纯函数复现：

```js
const policy = parseRobots('User-agent: *\nDisallow: /private/reports\nAllow: /%70%72%69%76%61%74%65');
robotsDecision(policy, 'https://example.invalid/private/reports').allowed; // true
```

`matchRule` 会把 unreserved 编码解成 `/private`；优先级却按更长的原编码字符串排序，使较短 Allow 胜过更具体的 `/private/reports` Disallow。应遵守更具体禁止规则。已在当前纯函数复现并通知主控；没有发起 HTTP，也未在指定来源实际 robots 中看到此组合。

**修复复验：原反例关闭。** 排序改用 canonicalPath 后，同一 `/private/reports` 返回 allowed=false、命中具体 Disallow；`/private/open` 仍按较短 Allow 返回 true。此为定向纯函数复验，不代表所有 robots 兼容性已验收。

## 本轮交回

最新独立定向测试为 browser-access、feishu-browser、safety 三个测试文件 **25/25，exit 0**；另有 F10 实际模块全内存流程夹具、F11 坏 view 保留夹具及 F13 编码优先级断言通过。未把该数字与较早 87/87 或主控回放/mock 数字拼接成完整测试验收。本轮没有任何仍运行的检核测试进程。

本次复验版本 SHA-256：

```text
public-browser.mjs 1725f47e32015ab7dd6105faad934092cdf15f23761206522eb943963783fe9d
feishu-browser.mjs 571fcb92e40c644b160a6cc578e90b9da352ac7bb729491fc50b83aadac7eee2
robots.mjs b5c96a7f7f797ac3275ed748aaefd9e6c9e1e7f85f461b5bc477f7a427c32678
registry.mjs be4bf73b54da3fee5c79baa42a31f06275743b7142795869f8ef28943b0d9c29
```

### 已完成语义回执

输入：`01_行情收集/official-careers/matching/answers-9efac8a7-3403-40e0-bb0d-17c125ed4b31.json`，SHA-256 `1c007c1b54aebd7ced6e156b93cf4740d59b8cb50586ea5c24f84e488a6bada7`，审查前后未变。仅检查 4 条 tailor，合计 26 项 requirement；独立核对原始 JD 与 batch 文本完全一致、原 body hash、个人 exact quotes、当前 profile/rules/preferences hashes、绑定原简历的学历/年限、门槛和建议。未参与作者制作，不修改答案、不执行 import。

| 岗位 | 原生 ID | Receipt 结果 | 关键判断 |
| --- | --- | --- | --- |
| MiniMax 大模型技术销售工程师 | 7208019802982598968 | approved | 汽车 KA/ROI 可迁移；三年云/MaaS、Demo/POC 仍缺证；不是资格通过 |
| MiniMax Global Account Executive | 7513910355632146698 | approved | 一般销售年限有据；英语、跨境合同及目标资源仍未知/缺口 |
| MiniMax 大模型销售运营 | 7612560574200023323 | approved | 本科与一般管理年限有据；财务、公司级规则、数据治理未夸大 |
| DeepSeek AI 产品经理 | e8f2004c-6599-42cd-b587-176ffc3ff1a3 | rejected | R6 仅把深度使用列为 Harness 要求；通用 AI 方向核心要求 2 未形成对应审核项，hard_gate_review_complete=true 缺依据 |

AI 产品经理的精确拒绝点：原文通用方向要求“是 AI 产品深度用户，对模型能力边界、不同产品的体验差异和用户场景有真实体感，不只是看过，而是自己用过、拆过。”R1-R3 未映射该要求，R6-R8 明确限定 Harness；建议中“另补模型体验对照”不能替代完整门槛审查记录。须由原作者补相应 requirement/gate 或撤回完整审查声明后再审。本检核未代改答案，也不因缺正式产品经理职称否定 JD 允许的内部工具交付路径。

4 份文件已新增于 `01_行情收集/official-careers/matching/reviews/<cache_key>.json`，均使用实际 reviewer ID `01a086a5-5b5b-7522-a6d1-7674145d21ad`，通过 exported assessmentDigest 精确绑定原答案。落盘后已重读校验 digest、作者独立性及报告读取效果：3 条 approved；rejected 记录不会被 semanticApproval 放行，当前软件回读状态仍是 pending，应结合本拒绝回执展示。四条 resume_reuse_eligible 全部 false。

### Known Issues / 未验收

- F12 浏览器 redirect 安全边界未修复，适配器隔离；MiniMax halt 不清，不实网重跑，不宣称可重复采集成功。
- DeepSeek AI 产品经理上述语义拒绝项保留；其余 **11 条 defer 未完成语义审查、没有回执、保持 pending**，不是已检查后通过。
- 既有 48 条仅为所给来源 checkpoint 内容通过；不代表全公司采完、当前仍在招聘或能投递。
- 修复后的真实 CLI、跨进程恢复和所有异常网络分支未全量验收；本轮以定向离线反例关闭为边界，不扩大检查范围。
- 主控负责 import、雏形 README/问题清单及展示；本检核只写本报告与上述 4 份 review，生产 DB/raw/halt/个人档案均未修改。Token 用量未知，不杜撰。
