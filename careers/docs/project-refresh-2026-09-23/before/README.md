# 职场行情收集与简历优化系统

更新时间：2026-06-30

## 一、本质判断

这件事表面上是在收集招聘行情、整理简历。

本质上不是“找一些岗位然后改一版简历”，而是建立一套“市场需求识别 -> 个人优势定位 -> 简历表达匹配 -> 投递反馈迭代”的求职决策系统。

如果只从执行层做，容易出现三个问题：

- 岗位看了很多，但不知道自己该投什么。
- 简历改了很多版，但不知道为什么有效或无效。
- 投递动作不少，但没有形成反馈闭环。

## 二、核心目标

最终目标是形成一套可以持续复用的求职系统：

- 判断当前市场真实需要什么能力。
- 找到个人经历与目标岗位之间的匹配点。
- 生成针对不同岗位方向的简历版本。
- 用投递和面试反馈反向修正岗位选择、简历表达和能力补强。

## 三、核心矛盾

当前最大的矛盾是：既要快速获得岗位机会，又要避免盲目投递，同时不能把简历改成空泛、堆关键词、失去真实可信度的版本。

## 四、顶层架构

### 战略层

先明确目标方向，而不是直接海投。

需要回答：

- 目标行业是什么？
- 目标岗位是什么？
- 目标城市或远程范围是什么？
- 目标薪资区间是什么？
- 当前最现实的切入点是什么？

### 结构层

项目拆成五个模块：

- 行情收集：收集岗位、薪资、要求、公司类型、频次。
- 岗位画像：提炼目标岗位的共性能力模型。
- 简历资产：整理个人经历、项目、成果、数据、证据。
- 简历匹配：根据岗位画像生成不同版本简历。
- 投递迭代：记录投递、反馈、面试问题和下一轮优化。
- 自动化采集：打开招聘平台，导入岗位样本，生成市场能力看板和简历更新建议。

### 执行层

先做样本，不做大而全。建议第一轮只选 20 到 30 个高相关岗位，做结构化采集和分析，然后再改简历。

## 五、多线程拆解

| 线程 | 目标 | 输入 | 输出 | 判断标准 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| 战略定位线程 | 明确主攻方向 | 个人背景、目标城市、薪资预期 | 求职定位说明 | 是否能排除不适合方向 | 无 |
| 行情采集线程 | 看清市场需求 | 招聘平台岗位样本 | 岗位行情采集表 | 样本是否高相关、字段是否完整 | 战略定位 |
| 岗位画像线程 | 提炼共性能力 | 20 到 30 条岗位 JD | 岗位能力模型 | 是否能总结出高频要求 | 行情采集 |
| 简历资产线程 | 建立个人素材库 | 过往经历、项目、成果 | 简历素材库 | 是否有结果、数据、证据 | 无 |
| 简历匹配线程 | 生成岗位适配简历 | 岗位画像、素材库 | 简历版本 | 是否对应岗位要求 | 岗位画像、素材库 |
| 投递迭代线程 | 用反馈优化策略 | 投递结果、面试问题 | 优化记录 | 是否能解释反馈变化 | 简历匹配 |

## 六、执行路径

1. 定位目标岗位方向。
2. 收集 20 到 30 个高相关岗位。
3. 提炼岗位共性要求和隐性偏好。
4. 整理个人经历素材库。
5. 生成第一版目标岗位简历。
6. 小批量投递 10 到 20 个岗位。
7. 根据反馈修正简历和岗位策略。

## 七、风险控制

- 风险 1：岗位样本太杂，导致判断失真。
  - 控制：第一轮只收集同一方向、同一层级、同一城市或城市群的岗位。

- 风险 2：简历只堆关键词，没有可信成果。
  - 控制：每个核心能力都要匹配一个具体项目、动作、结果或数据。

- 风险 3：过早追求完美简历，拖慢投递。
  - 控制：先做可投递版本，再根据反馈迭代。

- 风险 4：只看薪资，不看岗位成长性。
  - 控制：同时记录岗位职责、团队位置、业务阶段和能力迁移价值。

## 八、评估标准

第一阶段看过程质量：

- 是否完成 20 到 30 条高相关岗位采集。
- 是否提炼出 5 到 8 个高频能力要求。
- 是否形成一版可投递简历。

第二阶段看市场反馈：

- 简历投递后的查看率。
- 初筛通过率。
- 面试邀约率。
- 面试中重复被追问的问题。
- 岗位匹配度是否越来越清晰。

## 九、下一步行动

请优先补齐以下信息：

1. 目标岗位方向。
2. 目标城市或可接受地域。
3. 当前年限、行业、核心经历。
4. 期望薪资区间。
5. 现有简历文件或过往项目材料。

如果暂时没有明确方向，就先用“探索模式”：选择 2 到 3 个可能岗位方向，各收集 10 条岗位，比较市场需求和个人匹配度。

## 十、自动化入口

项目已加入自动化采集模块，入口在：

- `06_自动化采集/README.md`
- `06_自动化采集/config/searches.json`
- `06_自动化采集/config/auth.json`
- `06_自动化采集/config/ai_full_company_targets.txt`
- `06_自动化采集/config/ai_company_segments.csv`
- `06_自动化采集/config/external_salary_signals.csv`
- `06_自动化采集/config/rate_limits.json`
- `06_自动化采集/scripts/auth_browser.mjs`
- `06_自动化采集/scripts/collect_jobs.mjs`
- `06_自动化采集/scripts/overnight_research.mjs`
- `06_自动化采集/scripts/summarize_jobs.mjs`
- `06_自动化采集/scripts/generate_full_market_report.mjs`
- `06_自动化采集/scripts/generate_boss_query_plan.mjs`
- `06_自动化采集/scripts/generate_next_sampling_queue.mjs`
- `06_自动化采集/scripts/generate_compensation_gate_analysis.mjs`
- `06_自动化采集/scripts/generate_capability_requirement_matrix.mjs`
- `06_自动化采集/scripts/generate_company_segment_profiles.mjs`
- `06_自动化采集/scripts/generate_target_company_sales_playbook.mjs`
- `06_自动化采集/scripts/generate_segment_top_company_evidence.mjs`
- `06_自动化采集/scripts/generate_decision_overview.mjs`
- `06_自动化采集/scripts/generate_boss_local_cache_evidence.mjs`
- `06_自动化采集/scripts/generate_manual_sampling_batch_quality_gate.mjs`
- `06_自动化采集/scripts/generate_market_evidence_audit.mjs`
- `06_自动化采集/scripts/open_searches.mjs`
- `06_自动化采集/scripts/import_clipboard_job.mjs`
- `06_自动化采集/scripts/analyze_market.mjs`

常用命令：

```bash
npm run auth:browser
npm run auth:boss
npm run auth:status
npm run auth:restart
npm run import:manual -- --source BOSS直聘 --query AI销售
npm run sampling:next -- --city 广州 --limit 30
npm run sampling:workbench
npm run sampling:batches
npm run sampling:companies
npm run coverage:focus
npm run sampling:focus-batches
npm run sampling:top10-batches
npm run sampling:quality
npm run sampling:batch-status
npm run sampling:batch-quality
npm run sampling:upgrade-console
npm run sampling:inbox-status
npm run gate:conclusion
npm run audit:evidence
npm run collect:jobs -- --groups AI销售 --city 广州 --max-searches 1 --max-jobs 3 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --min-request-interval-ms 600000 --jitter-ms 180000 --resume-after-risk
npm run collect:jobs -- --companies 百度,阿里云,火山引擎 --roles AI销售,AI售前
npm run collect:jobs -- --industries 智能客服,企业知识库,AI Agent --roles 销售,售前
npm run plan:boss -- --city 广州 --batch-size 1
npm run sampling:gap
npm run sampling:acceptance
npm run overnight:research -- --dry-run --city 广州 --max-batches 8 --batch-size 1
npm run overnight:research -- --city 广州 --max-batches 8 --batch-size 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --cooldown-ms 1800000 --jitter-ms 180000 --resume-after-risk
npm run summary:jobs
npm run evidence:boss-cache
npm run compensation:analysis
npm run evidence:public
npm run capability:matrix
npm run gap:resume
npm run evidence:resume
npm run resume:closure
npm run industry:landscape
npm run company:profile
npm run company:type
npm run company:playbook
npm run company:top10
npm run opportunity:matrix
npm run hardware:market
npm run decision:overview
npm run radar:salary-capability
npm run handbook:market
npm run brief:market
npm run report:delivery
npm run radar:salary-capability
npm run matrix:cross
npm run sampling:companies
npm run coverage:focus
npm run sampling:focus-batches
npm run sampling:quality
npm run sampling:batch-quality
npm run sampling:first-execution
npm run sampling:acceptance
npm run sampling:inbox-status
npm run import:inbox -- --dry-run
npm run import:inbox
npm run profile:inbox
npm run profile:import -- --dry-run
npm run profile:import
npm run profile:status
npm run gate:conclusion
npm run audit:evidence
npm run report:full
npm run open:jobs -- --groups AI销售,AI售前 --city 全国 --limit 5 --dry-run
npm run open:jobs -- --groups AI销售,AI售前 --city 全国 --limit 5 --resume-after-risk --allow-boss-stagger-open
npm run import:clipboard -- --source BOSS直聘 --query AI销售
npm run analyze:market
```

非 BOSS 平台可以继续走协议端口：

```text
http://127.0.0.1:9333
```

已登录时优先复用当前浏览器与标签，见 `careers/docs/browser-login-handoff.md`。不要先启动、停止或重启另一套浏览器。旧 CLI 的 `npm run auth:browser` 只在没有项目浏览器时启动持久化浏览器；`npm run auth:boss` 默认仅生成本地交接说明，保留现有 9333 浏览器、旧 BOSS profile 和 Cookie，不自动唤起 Chrome。生成交接页不是采集完成，重复运行也不会取得岗位。只有用户明确要求打开交接页时才使用 `--launch-handoff`；独立 profile 也是显式选项，不作为空白页的自动恢复手段。`about:blank`、标签消失、登录失效与访问限制分别核验，不推断它们是同一个原因。默认命令不清理会话、不用定时刷新保活；`auth:stop` / `auth:restart` 仍是需明确授权的生命周期操作。

当前 Boss 处于风控恢复期。系统不会绕过验证；BOSS live collect 已降级为人工导入：`collect:jobs` 即使追加 `--resume-after-risk`，也只写运行记录和手动搜索词，不连接 9333、不读取、不刷新 BOSS 页面。`open:jobs` 默认也不自动打开 BOSS；如果你已经确认页面稳定，并且要恢复“低频多开”，必须同时追加 `--resume-after-risk --allow-boss-stagger-open`，脚本会使用系统 Chrome 按队列顺序打开，第一个立即打开，后续每个间隔 10 到 20 秒。报告中的 BOSS URL 只作备查，不要在 Markdown、Codex 内置浏览器或带 `--no-sandbox` 提示的窗口里点击打开。更稳的流程仍然是：`npm run auth:boss` 生成本地安全入口页，在正常 Chrome 中手动打开入口页，先进入 BOSS 首页，页面稳定后在站内搜索框输入关键词，人工浏览岗位，复制岗位详情或岗位卡片文本，再用 `npm run import:manual` 导入。

个人能力画像走本地收件箱，不访问任何招聘平台：

```bash
npm run profile:inbox
npm run profile:import -- --dry-run
npm run profile:import
npm run profile:status
```

先把真实项目经历粘贴到 `02_岗位画像/我的能力画像收件箱.md`，用 dry-run 确认识别结果，再导入到 `02_岗位画像/data/我的能力画像.json` 和 `03_简历/简历素材库.md`。如果能力画像为空，所有简历匹配只能算市场侧待补证据，不能判断真实个人匹配度。

更新后的核心输出：

- `00_行业资料集/AI产业链公司资料集.md`
- `00_行业资料集/AI产业链公司资料集.csv`
- `00_行业资料集/AI产业链销售岗位图谱.csv`
- `00_行业资料集/AI销售目标公司分层画像.md`
- `00_行业资料集/AI销售公司类型岗位打法对照表.md`
- `00_行业资料集/AI目标公司销售岗位打法清单.md`
- `00_行业资料集/AI细分赛道头部公司Top10证据表.md`
- `01_行情收集/BOSS全行业AI销售岗位查询计划.csv`
- `01_行情收集/BOSS全行业AI销售岗位查询计划.md`
- `01_行情收集/BOSS人工补样工作台.md`
- `01_行情收集/BOSS大样本完成门槛与验收路线.md`
- `01_行情收集/BOSS结论升级采样控制台.md`
- `01_行情收集/BOSS人工采样批次包.md`
- `01_行情收集/BOSS细分赛道Top10公司采样批次包.md`
- `01_行情收集/BOSS人工采样批次进度看板.md`
- `01_行情收集/BOSS人工采样批次质量门禁.md`
- `01_行情收集/BOSS首批人工采样执行单.md`
- `01_行情收集/BOSS首批人工采样收件箱模板.md`
- `01_行情收集/BOSS首批人工采样收件箱.md`
- `01_行情收集/BOSS首批人工采样收件箱质量预检.md`
- `01_行情收集/BOSS下一轮优先采样清单.md`
- `01_行情收集/BOSS全行业样本缺口路线图.md`
- `01_行情收集/BOSS历史缓存候选线索库.md`
- `01_行情收集/AI销售岗位全景总览.md`
- `01_行情收集/AI岗位机会汇总.md`
- `01_行情收集/AI全行业销售岗位市场调研.md`
- `01_行情收集/AI销售岗位薪资待遇与能力门槛分析.md`
- `01_行情收集/AI销售岗位市场决策总览.md`
- `01_行情收集/AI细分赛道销售机会矩阵.md`
- `01_行情收集/AI行业公开趋势信号看板.md`
- `01_行情收集/AI公开招聘薪资证据库.md`
- `01_行情收集/AI销售岗位全行业决策手册.md`
- `01_行情收集/AI销售岗位市场调研交付版.md`
- `01_行情收集/AI销售岗位公司类型岗位族交叉看板.md`
- `01_行情收集/AI市场资料集证据审计.md`
- `01_行情收集/AI硬件算力半导体销售岗位专项分析.md`
- `01_行情收集/BOSS硬件算力半导体优先采样清单.md`
- `02_岗位画像/data/我的能力画像.json`
- `02_岗位画像/我的能力画像收件箱.md`
- `02_岗位画像/我的能力画像收件箱模板.md`
- `02_岗位画像/我的能力画像补全问卷.md`
- `02_岗位画像/AI销售岗位能力要求矩阵.md`
- `01_行情收集/市场能力需求看板.md`
- `02_岗位画像/AI岗位定位与要求汇总.md`
- `02_岗位画像/AI互联网销售售前岗位画像.md`
- `03_简历/简历更新建议.md`
- `03_简历/AI销售岗位匹配与能力Gap.md`
- `03_简历/AI销售能力证据与简历改写矩阵.md`
- `03_简历/AI销售市场到简历证据闭环.md`
