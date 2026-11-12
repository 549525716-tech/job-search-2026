# 自动化采集说明

## 一、本质判断

这个模块表面上是“自动打开招聘网站收集岗位”。

本质上不是简单爬岗位，而是建立一个持续更新的市场情报管道：打开目标岗位搜索页，沉淀岗位原文，抽取能力需求，和你的能力画像做匹配，再反向更新简历策略。

## 二、边界原则

- 不绕过登录、验证码、付费墙或平台访问限制。
- 不高频抓取，不做批量骚扰式采集。
- Boss 平台风控敏感，当前默认采用风控恢复期策略：人工复制导入优先；自动采集必须显式追加 `--resume-after-risk` 才会访问 BOSS 页面。
- 自动采集恢复后仍强制极低频：单次搜索至少间隔 10 分钟，批次间隔至少 30 分钟，并额外加入随机抖动。
- 低频策略由 `06_自动化采集/config/rate_limits.json` 强制控制；即使命令行传入更高频参数，脚本也会按安全上限/下限执行。
- 默认不打开岗位详情页，先采集列表卡片；只有确认安全稳定后再对极少量岗位补详情。
- 优先使用浏览器可见信息和你主动复制的岗位详情。
- 只采集岗位公开信息，不自动投递、不自动发送消息。
- 需要登录的平台，先由你在 Chrome 里完成登录。

## 三、核心命令

在项目根目录 `/Users/MR/Documents/职场` 执行：

### 1. 登录态端口

```bash
npm run auth:browser
```

这会启动一个持久化 Chrome 新标签页，并开放本地协议端口：

```text
http://127.0.0.1:9333
```

登录态保存在：

```text
.career-browser-profile
```

Boss 直聘人工窗口单独保存登录态：

```text
系统默认 Google Chrome profile
```

`auth:browser` 不再自动打开 BOSS，只启动持久化 Chrome 安全启动页。BOSS 单独走人工安全模式，需要打开 BOSS 时执行：

```bash
npm run auth:boss
```

本命令默认只生成 `01_行情收集/BOSS登录安全入口.html` 交接说明，不自动打开浏览器，也不关闭任何已运行的项目 CDP 或 BOSS profile。已有登录页应按 `careers/docs/browser-login-handoff.md` 复用，无需执行本命令。`--launch-handoff` 仅显式打开本地交接页，`--isolated-boss-profile` 仅显式启动独立 profile，二者都不是岗位采集完成证据。旧 `collect:jobs` 的 BOSS 隔离保持不变。登录、验证码由本人操作，不复制或导出 Cookie，不切换会话绕过访问限制。

检查、重启或停止登录态浏览器：

```bash
npm run auth:status
npm run auth:restart
npm run auth:stop
npm run audit:research
```

`about:blank` 不等于已退出登录，也不能直接断言风控。保留现场，记录标签、可见账号、列表和详情的独立状态；不反复新开、刷新或重启。2026-09-21 已移除默认 `start/open` 的自动停止或重启分支；显式 `stop/restart` 仍会改变会话生命周期，只能在用户要求时执行。这是旧 CLI 的保留策略修复，不代表 Codex 内置浏览器的空白复现已解决。限制来源暂停后，继续整理已取得的原文并采集其他准入官网。

风控恢复期的 `collect:jobs --resume-after-risk` 不会再对 BOSS 执行 `page.goto()`、`reload()`，也不会读取当前 BOSS 标签页。它只写运行记录和手动 URL。请手动浏览岗位后使用 `npm run import:manual` 导入复制的岗位文本。

### 2. 信息采集

风控恢复期优先使用人工导入，不自动打开 BOSS：

```bash
npm run sampling:next -- --city 广州 --limit 30
npm run sampling:batches
npm run coverage:focus
npm run sampling:focus-batches
npm run sampling:top10-batches
npm run sampling:batch-status
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
npm run import:manual -- --source BOSS直聘 --query AI销售
```

`sampling:next` 只生成下一轮优先采样清单，不打开 BOSS、不读取网页。它把全行业采样任务按赛道趋势、头部公司机会、薪资证据缺口和岗位优先级压缩成 30 个最该人工查看的搜索入口。`sampling:batches` 会把补样工作台拆成每批 5 个入口的人工小批次，用于降低操作频率。`coverage:focus` 会检查月之暗面、智谱AI、MiniMax、芯片/半导体/智算等重点方向是否进入公司池、查询计划、人工批次和BOSS样本闭环，`sampling:focus-batches` 会把缺人工批次的重点公司转成 `BOSS-FOCUS-*` 批次。`sampling:top10-batches` 会把每个细分赛道Top10公司转成 `BOSS-TOP10-*` 低频人工批次，默认 48 个入口、每批 4 个，适合按首页 + 站内搜索关键词逐批执行。`sampling:batch-status` 会根据已导入岗位样本验收每个批次是否达标，`sampling:batch-quality` 会继续判断这些批次样本能不能支撑方向、薪资和能力要求结论。`sampling:inbox-status` 会在导入前检查首批收件箱每段是否包含薪资、岗位、职责、要求、AI/行业关键词和销售/售前关键词。`sampling:acceptance` 会把全行业、赛道、薪资、详情文本、岗位族和公司覆盖拆成完成门槛，`sampling:upgrade-console` 会把“还差几条样本才能升级到什么结论”压成控制台，防止把公开信号或少量样本误写成 BOSS 大样本结论。

批次包里的 `import:manual` 命令会自动携带 `--batch-id`、`--batch-task`、`--route`、`--segment` 等元数据。按批次导入时不要删这些参数，它们用于把岗位样本精确归属到人工采样批次。

你可以手动打开 BOSS，复制一个岗位详情页，或一次复制多个岗位卡片文本。脚本会把剪贴板内容解析并写入：

```text
01_行情收集/data/jobs.jsonl
01_行情收集/data/raw/
```

也可以从文件导入：

```bash
npm run import:manual -- --file ./pasted_jobs.txt --source BOSS直聘 --query "智谱AI AI销售" --company 智谱AI --role AI销售 --city 广州
```

首批采样也可以用本地收件箱批量导入。先生成执行单和收件箱，然后把 BOSS 岗位详情粘贴到对应公司段落的 `BOSS_INBOX_TEXT_START/END` 标记之间。导入前先跑 `sampling:inbox-status`，确认每段文本是否足够支撑薪资和能力要求分析。导入命令只读取本地文件，不打开、不读取、不刷新 BOSS：

```bash
npm run sampling:first-execution
npm run sampling:inbox-status
npm run import:inbox -- --dry-run
npm run import:inbox
```

个人能力画像也走本地收件箱，不访问 BOSS。先生成模板，把真实项目经历粘贴到 `PROFILE_INBOX_TEXT_START/END` 标记之间，再 dry-run 预览识别出的能力、路线和岗位族，确认后导入：

```bash
npm run profile:inbox
npm run profile:import -- --dry-run
npm run profile:import
npm run profile:status
```

导入会备份并更新 `02_岗位画像/data/我的能力画像.json`，同时把项目证据追加到 `03_简历/简历素材库.md`。如果能力画像为空，`gap:resume`、`evidence:resume` 和 `resume:closure` 只能输出市场侧待补证据，不能判断真实个人匹配度。

自动采集只在你完成验证并确认恢复后使用。按岗位组采集：

```bash
npm run collect:jobs -- --groups AI销售 --city 广州 --max-searches 1 --max-jobs 3 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --min-request-interval-ms 600000 --jitter-ms 180000 --resume-after-risk
```

按公司采集：

```bash
npm run collect:jobs -- --companies 百度,阿里云,火山引擎,商汤科技 --roles AI销售,AI售前,解决方案顾问 --city 全国
```

公司采集会做目标公司过滤：例如搜索“阿里云 AI销售”时，只保存公司名能匹配“阿里云/阿里/阿里巴巴”等别名的岗位，避免混入泛 AI 销售岗位。

也可以使用公司清单：

```bash
npm run collect:jobs -- --companies-file 06_自动化采集/config/company_targets.txt --roles AI销售 --max-searches 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --resume-after-risk
```

Boss 容易触发安全验证，建议小批量低频执行：

```bash
npm run collect:jobs -- --companies-file 06_自动化采集/config/ai_landscape_company_targets.txt --roles AI销售 --city 广州 --max-searches 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --min-request-interval-ms 600000 --jitter-ms 180000 --resume-after-risk
```

恢复期不建议自动打开岗位详情页。需要详情时，手动复制岗位详情，用 `import:manual` 导入。

按行业/细分赛道采集：

```bash
npm run collect:jobs -- --industries 智能客服,企业知识库,AI Agent,数据智能 --roles 销售,售前,解决方案顾问
```

也可以使用赛道清单：

```bash
npm run collect:jobs -- --industries-file 06_自动化采集/config/industry_targets.txt --roles 销售 --max-searches 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --resume-after-risk
```

按自定义关键词采集：

```bash
npm run collect:jobs -- --keywords "大模型销售" --max-searches 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --min-request-interval-ms 600000 --jitter-ms 180000 --resume-after-risk
```

采集输出：

```text
01_行情收集/data/jobs.jsonl
01_行情收集/data/raw/
01_行情收集/data/processed/collect_run_*.json
```

### 3. 信息汇总

```bash
npm run summary:jobs
npm run evidence:boss-cache
npm run salary:signals
npm run matrix:roles
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
npm run opportunity:matrix
npm run gap:resume
npm run sampling:gap
npm run sampling:acceptance
npm run sampling:workbench
npm run sampling:batches
npm run coverage:focus
npm run sampling:focus-batches
npm run sampling:top10-batches
npm run sampling:companies
npm run sampling:quality
npm run sampling:batch-status
npm run sampling:batch-quality
npm run sampling:upgrade-console
npm run sampling:first-execution
npm run sampling:inbox-status
npm run import:inbox -- --dry-run
npm run import:inbox
npm run profile:inbox
npm run profile:import -- --dry-run
npm run profile:import
npm run profile:status
npm run gate:conclusion
npm run audit:evidence
npm run hardware:market
npm run industry:landscape
npm run company:top10
npm run decision:overview
npm run radar:salary-capability
npm run handbook:market
npm run brief:market
npm run report:delivery
npm run matrix:cross
npm run report:full
```

汇总输出：

```text
01_行情收集/AI岗位机会汇总.md
01_行情收集/BOSS历史缓存候选线索库.md
01_行情收集/BOSS全行业样本缺口路线图.md
01_行情收集/BOSS大样本完成门槛与验收路线.md
01_行情收集/BOSS结论升级采样控制台.md
01_行情收集/BOSS人工补样工作台.md
01_行情收集/BOSS人工采样批次包.md
01_行情收集/BOSS细分赛道Top10公司采样批次包.md
01_行情收集/BOSS人工采样批次进度看板.md
01_行情收集/BOSS人工采样批次质量门禁.md
01_行情收集/BOSS首批人工采样执行单.md
01_行情收集/BOSS首批人工采样收件箱模板.md
01_行情收集/BOSS首批人工采样收件箱.md
01_行情收集/BOSS首批人工采样收件箱质量预检.md
01_行情收集/AI销售岗位全景总览.md
01_行情收集/AI销售岗位市场调研交付版.md
01_行情收集/AI销售岗位公司类型岗位族交叉看板.md
01_行情收集/AI全行业销售岗位市场调研.md
01_行情收集/AI销售岗位薪资待遇与能力门槛分析.md
01_行情收集/AI销售岗位市场决策总览.md
01_行情收集/AI细分赛道销售机会矩阵.md
01_行情收集/AI公开招聘薪资证据库.md
01_行情收集/AI销售岗位全行业决策手册.md
01_行情收集/AI市场资料集证据审计.md
01_行情收集/AI硬件算力半导体销售岗位专项分析.md
01_行情收集/BOSS硬件算力半导体优先采样清单.md
01_行情收集/市场能力需求看板.md
00_行业资料集/AI产业链公司资料集.md
00_行业资料集/AI产业链公司资料集.csv
00_行业资料集/AI产业链销售岗位图谱.csv
00_行业资料集/AI销售目标公司分层画像.md
00_行业资料集/AI销售公司类型岗位打法对照表.md
00_行业资料集/AI目标公司销售岗位打法清单.md
00_行业资料集/AI细分赛道头部公司Top10证据表.md
02_岗位画像/AI岗位定位与要求汇总.md
02_岗位画像/AI销售岗位能力要求矩阵.md
02_岗位画像/AI互联网销售售前岗位画像.md
02_岗位画像/data/我的能力画像.json
02_岗位画像/我的能力画像收件箱.md
02_岗位画像/我的能力画像收件箱模板.md
02_岗位画像/我的能力画像补全问卷.md
03_简历/AI销售岗位匹配与能力Gap.md
03_简历/AI销售能力证据与简历改写矩阵.md
03_简历/AI销售市场到简历证据闭环.md
03_简历/简历更新建议.md
```

### 4. 整晚低频采集

生成 BOSS 全行业查询计划：

```bash
npm run plan:boss -- --city 广州 --batch-size 1
```

输出：

```text
01_行情收集/BOSS全行业AI销售岗位查询计划.csv
01_行情收集/BOSS全行业AI销售岗位查询计划.md
```

先生成计划，不访问 Boss：

```bash
npm run overnight:research -- --dry-run --city 广州 --max-batches 8 --batch-size 1
```

确认计划后再执行：

```bash
npm run overnight:research -- --city 广州 --max-batches 8 --batch-size 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --cooldown-ms 1800000 --jitter-ms 180000 --resume-after-risk
```

整晚采集默认先跑：

1. 智谱AI、月之暗面、MiniMax、DeepSeek 等基座大模型/AI软件落地公司。
2. 阿里云、百度智能云、火山引擎、腾讯云、华为云等云和大模型平台。
3. 智能客服、营销AI、RPA、工业AI等销售岗位密度较高的下游应用公司。
4. 寒武纪、海光、摩尔线程、浪潮信息、新华三等芯片/半导体/智算硬件公司。

如果 Boss 出现安全验证，脚本会停止并写入：

```text
01_行情收集/data/processed/overnight_research_*.json
```

完成验证后，可以根据运行记录里的批次序号使用 `--start-offset` 续跑，但仍需追加 `--resume-after-risk`。

### 备用打开方式

```bash
npm run open:jobs -- --groups AI销售,AI售前 --city 全国 --limit 5 --dry-run
npm run open:jobs -- --groups AI销售,AI售前 --city 全国 --limit 5 --resume-after-risk --allow-boss-stagger-open
```

快速生成 Boss 直聘等招聘平台的岗位搜索页。风控恢复期默认不自动打开链接；只追加 `--resume-after-risk` 时仍只输出人工搜索词。确认页面稳定后，如需恢复“低频多开”，同时追加 `--allow-boss-stagger-open`，脚本会使用系统 Chrome 顺序打开搜索页：第一个立即打开，后续每个间隔 10 到 20 秒。脚本会按 URL 识别 `zhipin.com`；未显式确认时不会直开 BOSS 链接。更稳的方式仍是先用 `npm run auth:boss` 生成本地安全入口页，在正常 Chrome 中手动打开入口页，只进入 BOSS 首页；页面稳定后把命令输出里的关键词复制到 BOSS 站内搜索框。

```bash
npm run import:clipboard -- --source BOSS直聘 --query AI销售
```

把当前剪贴板里的岗位详情文本导入为结构化样本。等价命令是 `npm run import:manual`。

```bash
npm run analyze:market
```

生成或更新：

- `01_行情收集/市场能力需求看板.md`
- `02_岗位画像/AI互联网销售售前岗位画像.md`
- `03_简历/简历更新建议.md`

## 四、推荐工作流

1. 非 BOSS 平台运行 `auth:browser` 启动 9333 持久化浏览器；BOSS 运行 `auth:boss` 生成本地安全入口页，并在正常系统 Chrome 中手动打开/登录平台。
2. 风控恢复期先手动浏览岗位，并使用 `import:manual` 导入。
3. 如果平台出现安全验证，在持久化浏览器中手动完成验证后重跑采集。
4. 每采集 10 到 20 条运行 `summary:jobs`、`evidence:boss-cache`、`matrix:roles`、`compensation:analysis`、`evidence:public`、`capability:matrix`、`gap:resume`、`evidence:resume`、`resume:closure`、`company:profile`、`company:type`、`company:playbook`、`company:top10`、`opportunity:matrix`、`sampling:gap`、`sampling:acceptance`、`sampling:workbench`、`sampling:batches`、`coverage:focus`、`sampling:focus-batches`、`sampling:companies`、`sampling:quality`、`sampling:batch-status`、`sampling:batch-quality`、`gate:conclusion`、`audit:evidence`、`hardware:market`、`decision:overview`、`radar:salary-capability`、`handbook:market`、`brief:market`、`report:delivery` 和 `matrix:cross`。
5. 样本达到 20 到 30 条后，再集中更新岗位画像和简历。

备用命令行流程：

1. 运行 `open:jobs` 生成目标搜索词；风控恢复后追加 `--resume-after-risk` 也只输出人工搜索词，不直接打开 BOSS，也不要手动粘贴完整搜索 URL。
2. 在 Chrome 中筛选近期、相关度高的岗位。
3. 打开岗位详情，复制岗位名称、公司、薪资、职责、要求。
4. 运行 `import:clipboard` 导入岗位样本。
5. 每收集 10 条运行一次 `analyze:market`。
6. 样本达到 20 到 30 条后，再集中更新简历。

### 风控恢复策略

如果 Boss 出现安全验证或频繁跳转：

1. 立即停止所有采集命令，不要连续重试。
2. 等待 120 到 180 分钟，再在持久化 Chrome 中手动完成验证。
3. 先运行 `npm run audit:research` 查看状态。
4. 恢复后先跑极小批量，不超过 1 个搜索页，并显式追加 `--resume-after-risk`。
5. 稳定后再使用整晚采集，但保持 `--delay-ms 600000 --cooldown-ms 1800000 --jitter-ms 180000`。

极小批量恢复命令：

```bash
npm run collect:jobs -- --companies 智谱AI --roles AI销售 --city 广州 --max-searches 1 --cards-per-search 2 --detail-limit 0 --delay-ms 600000 --min-request-interval-ms 600000 --jitter-ms 180000 --resume-after-risk
```

限速配置：

```text
06_自动化采集/config/rate_limits.json
01_行情收集/data/processed/boss_rate_limit_state.json
```

## 五、采集标准

优先采集：

- AI、大模型、智能体、SaaS、企业服务相关岗位。
- 销售、KA、大客户销售、行业销售、商务拓展岗位。
- 售前、解决方案顾问、解决方案架构师、客户成功、交付顾问岗位。
- 有明确职责、能力要求、行业客户或产品方向的岗位。

暂不采集：

- JD 极短、信息不完整的岗位。
- 明显低质、薪资异常、职责混乱的岗位。
- 与 AI/互联网/企业服务无关的泛销售岗位。

## 六、判断标准

第一阶段不是追求岗位数量，而是判断市场正在反复要什么能力。

关键看：

- 高频能力是否稳定出现。
- 岗位本质是否集中在同一类业务问题。
- 你的经历是否有证据能对上这些要求。
- 简历是否能在前 10 秒打中岗位主线。
