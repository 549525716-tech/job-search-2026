# 私人猎头：职业方向与官网机会系统

本模块独立于原来的BOSS采集流程。公司发现、公开岗位采集和个人匹配分开记录；打开招聘入口不算采集成功。

## 白屏时继续采集（2026-09-22）

按 [来源级兜底](docs/source-fallback.md) 执行：故障平台隔离，独立公开来源继续；不再因BOSS/猎聘控制链路故障全局暂停。普通登录标签不接管、不刷新、不切换日常Chrome。

```bash
npm run careers:fallback -- --companies minimax,bailian-ai,deepseek
```

此命令串行复用现有官网适配器，落盘各源结果与待补状态，受限/部分结果退出2但保留已取得数据。MiniMax隔离会跳过，不自动重试；BOSS/猎聘不在此执行器内。未知新源需核验准入，Codex辅助网页研究另走共享队列。命令不搜索全网、不启动定时、不投递。

本次真实验证资料位于 `research/fallback-2026-09-22/`；历史章节中的岗位数量不代表本次结果。

顶层合同见 `docs/private-headhunter.md`：先理解个人事实与发展目标，再沿政策/行业、商业需求、公司、岗位漏斗寻找机会；用户选定并授权后，进入材料优化、投递及反馈闭环。政策利好不等于公司经营稳健，管理职位名称不等于实际管理权限。

最新扫描规则见 [开放发现及身份规则](docs/open-discovery-and-identity.md)、[续扫执行器](docs/discovery-runtime.md)和[双路线发现规则](docs/dual-route-discovery.md)。来源不设渠道白名单；A从行业找公司岗位，B用名称/内容关键词反向发现公司。每批20条是分析上限，不是采集上限。新发现可进入持久化队列，已核验通用静态来源可自动接续；动态ATS、全网关键词自主扩展与无人值守覆盖调度仍未验收。

2026-09-10已落地架构、固定底薪筛选和首个可追溯漏斗样本：历史国家政策原文 → 两个商业需求假设 → 百炼智能/MiniMax官网业务 → 三条完整JD。新增的是已审核URL的手动证据采集和离线报告，不是全量自动行业发现。每周政策增量发现、登录后投递驱动及反馈统计仍待实现。

## 当前雏形

### 登录不是终点

登录交接按 [招聘平台登录接管与续读](docs/browser-login-handoff.md) 执行。需要本人登录或安全验证时主动交接原页面；已登录则先核验真实JD，再继续个人匹配。端口不可用、连接故障、平台验证码和详情未取得分别记录，不统称“受限”。本地安全入口页不算登录或采集成果。当前状态以 `progress.json` 为准。

### 累计覆盖而非25家公司抽样（2026-09-14）

业务扫描不设公司或岗位数量上限。每家公司分别核对官网/ATS、BOSS、猎聘、其他平台、招聘公告及开放网页；来源类别可扩展。新增公司持续入账，预算用尽只保存技术检查点，不宣称行业或市场扫描完成。具体执行覆盖和未解决项以 `progress.json` 为准。

```bash
# 累计账本：只读历史数据，不伪装新扫描
npm run careers:coverage:build -- --input 01_行情收集/official-careers/research/sweep-2026-09-11 --input 01_行情收集/official-careers/research/sweep-2026-09-13 --input 01_行情收集/official-careers/research/sweep-2026-09-14-coverage --companies 01_行情收集/official-careers/research/sweep-2026-09-14-coverage/company-discoveries-reviewed.json
npm run careers:coverage:report -- 01_行情收集/official-careers/research/sweep-2026-09-11 01_行情收集/official-careers/research/sweep-2026-09-13 01_行情收集/official-careers/research/sweep-2026-09-14-coverage
```

这两条命令是离线整理和浏览报告，不是新建爬虫或无人值守执行器。`reports/coverage-campaign.html` 保留逐公司渠道状态和全部传入原始岗位观察；历史时间不刷新成今天。同名只是展示归组，法律实体、行业地位、薪资和在招有效性另核。BOSS/猎聘旧暂停保留，需要本人完成安全验证后再明确恢复。

最新调度使用Astra xhigh承担关键判断和独立QA、Terra medium处理明确工程、Luna medium整理资料；实际回执记录在progress。旧报告中的max是历史运行，未改写；旧匹配校验器迁移前不能以伪造max回执提交xhigh结果。

行业归档与来源规则见 [行业分层及来源准入](docs/industry-tiers-and-sources.md)。2026-09-13已接入行业/赛道/地位/公司业务线分组，新增待复核与全部原始记录视图。分层缺少原始证据、口径或90天内复查仍显示待核，不继承集团地位。9月11日[执行审计](docs/source-runtime-audit-2026-09-11.md)是修复前状态，当前进度以progress.json为准。

已保存百炼智能4条、DeepSeek33条、MiniMax11条完整JD，共48条。旧偏好下已导入15条个人匹配分析，其中3条通过独立语义复核、1条需修订、11条待复核。新方向和薪资标准使旧评估缓存失效；历史结果保留审计，不作为新规则下的推荐。AI优先和固定月薪20K+视图可用，本批官网均未披露薪资，因此固定薪酬池为空，不代表市场没有达标机会。

2026-09-10曾另行导入三条漏斗样本分析：MiniMax销售运营、技术销售工程师及百炼项目经理，保留为当时的草稿待独立复核，未将旧审批挪用为新审批。2026-09-13正文召回规则升级后，旧匹配缓存失效；当前报告7条商业候选、1条正文待复核，均须按新版事实/规则重新检查。历史分析不删除，也不冒充当前推荐。

当前可手动复跑百炼智能、DeepSeek公开来源。MiniMax已取得真实证据，但浏览器适配器在独立检查中发现待处理的重定向边界，现已隔离，不能把历史11条证据当作当前适配器已全部验收。其余七家公司保留入口及受限/未扫描情况，不报成零岗位。

先打开已有报告即可查看雏形。重新采集仅需：

```bash
npm run careers:collect -- --companies bailian-ai,deepseek
npm run careers:report
```

本轮不以解决全部缺陷为交付前提。问题、证据和后续修复顺序见 `docs/known-issues.md`；同一问题最多三轮修复验证，仍失败则隔离跳过。访问拒绝不自动重试三次。

## 本地运行

```bash
npm run careers:doctor
npm run careers:collect -- --company bailian-ai
npm run careers:report
npm run careers:match:prepare -- --limit 20
# 按项目Skill由当前Codex分析batch，并生成本地answers JSON后：
npm run careers:match:import -- --file <answers.json路径>
npm run careers:report
npm run careers:test
npm run careers:audit-http
npm run careers:visual
```

## 政策到岗位样本

直接打开 `01_行情收集/official-careers/reports/overview.html`，默认紧凑“AI优先”商业岗位列表；另有薪资线索、猎头研判及政策/行业/公司视图。政策、官网公司业务与完整JD有原始响应和采集回执；公开薪资索引只保留工具检索结果，不冒充HTTP回执。公司只是候选，不将知名度或官网自称领先当作头腰部独立排名。

独立团队配置见 `docs/headhunter-team.md`。`npm run careers:agents:prepare`准备带哈希的任务包，由当前Codex真实调用配置子代理；`npm run careers:agents:report`输出经原文与版本校验的综合文档；`npm run careers:leads:report`输出独立的薪资线索CSV/Markdown/JSON。角色未运行或输入变化会标未完成/过期，CLI不自动调用模型或新建API账单。

本轮市场广扫使用独立快照目录 `research/sweep-2026-09-11/`，公开工具检索结果不伪装成HTTP采集回执，不混入历史官网库的完整扫描/关闭检测。执行模型使用 `gpt-5.6-luna/medium`，采集后的研判使用实际派发的 `gpt-6-astra/max`；配置不等于已执行，以本轮run及分析回执为准。未取得完整职责和要求的记录只作线索，未披露底薪不判达标。

```bash
npm run careers:sweep:report -- --input 01_行情收集/official-careers/research/sweep-2026-09-11
npm run careers:report
```

以上两条命令仅离线重建 `reports/market-sweep.html` 及MD/CSV/JSON，并在原总览关联本轮入口；不会自动搜索、调用模型、投递或设置定时。原文与个人上下文哈希不符时分析过期。本轮扫描范围与未覆盖来源见报告，不宣称全市场已扫描。

2026-09-11首轮已完成：20家公司检索、38次工具结果、25条记录，其中19条完整JD及6条索引。实际Luna执行29次搜索/读取、总控补充9次；GPT-6 Astra/max分析19条，4条优先核实。固定底薪全待核。执行凭据、原文抽查及时间记录缺陷位于本轮研究目录；4份早期占位时间未伪造补齐。本轮150项离线测试及三视口报告检查通过，不代表全网或自动投递验收。

```bash
# 纯本地重建；不访问网站、不调用模型、不投递
npm run careers:funnel:build
# 明确选择已审核URL后，串行采集；不要把受限源放入重试循环
npm run careers:research:collect -- --documents policy-ai-plus-cac,bailian-home,minimax-home
```

`config/research-documents.json` 保存审核后的URL和正文标识，`config/funnel-sample.json` 保存人工核对的关联、原文摘录及明确标识的需求假设。新公司/政策先核验入口再加入配置，不由关键词自动认定为利好或行业龙头。`research/state.json` 分开保留最近尝试和最近成功证据；404未知robots、403访问限制首次出现即停止该源，重复执行只返回blocked，不自动恢复。

本轮政策是2025年的“人工智能+”意见，2026-09-10首次进入基线，不是本周发布。MiniMax岗位沿用此前完整记录，招聘适配器仍隔离；百炼智能重复采集成功但旧发布日期不改变。页面变化只标“内容变化待审”，不自动认定政策修订；未完整扫描不能说“本周无新政策”。

每次报告都按当前偏好、有效评估和磁盘证据重新构建，引用不匹配或证据校验失败的分支不算可追溯链路。`research/funnels/<input_digest>.json` 为不可覆盖快照；`reports/funnel.json/.md/.csv` 是当前导出。报告生成窗口不是政策发布日期窗口；JSON保留UTC时间。

`careers:doctor` 显示已注册适配器。`--companies ID,ID`串行选择固定适配器；`--all`还会续接一波已发现、已准入的通用静态来源，不表示全市场扫描。`careers:discovery:prepare`默认核验当前市场报告所指原始jobs文件的SHA并自动回补，也接受显式公司/岗位/新渠道输入，随后冻结范围；`careers:discovery:run -- --batch <ID>`按预算续扫。未知源保留待核/待适配，失败或未扫描不伪造空结果。

项目启动器会使用Node24及以上版本；系统Node较旧时尝试当前电脑内Codex附带的Node24。也可通过 `CAREERS_NODE` 指定可执行文件。不会更改系统Node。依赖沿用项目锁定的Playwright，离线HTML解析需要本机Google Chrome；解析使用临时、离线、启用沙箱的浏览器，不导航招聘网站，不读取日常Chrome或BOSS登录态。

`careers:report -- --run RUN_ID` 重建单次来源报告。默认报告汇总数据库中的真实记录，不发起网络请求。非零退出码：1为命令或环境错误，2为来源失败、部分结果或未支持公司，不能当作“没有岗位”。

## 结果位置

- 浏览报告：`01_行情收集/official-careers/reports/overview.html`，直接打开即可，不需要服务器。
- CSV、Markdown和JSON：同目录 `overview.*`。
- 原始证据：`01_行情收集/official-careers/raw/`；请求时间、HTTP状态、来源URL和原始响应SHA-256保存于对应 `.response.json`。
- 数据库：`01_行情收集/official-careers/careers.sqlite`，与原始 `jobs.jsonl` 隔离。
- 全局请求日志：`requests.jsonl`；全局串行协调文件：`control.sqlite`。
- 实施状态与代理调用参数：`careers/progress.json`。只有文件中的已验证证据能证明阶段完成。

报告默认展示AI优先商业清单，另有政策到岗位样本、固定月薪20K+、薪酬待确认、正文待复核、全部原始样本和公司雷达。原始样本不等于个人推荐；算法或实习岗位可被采集留证，但不会因此推荐给用户。

## 访问与证据规则

主动HTTP请求和浏览器导航/点击共用串行队列，每次完成后至少间隔10-20秒，来源要求更慢时从严。协议请求不发送Cookie或登录信息，不轮换账号或代理。401、403、429、验证页和网络异常停止该来源；访问限制不会被当作空岗位结果。

MiniMax/月之暗面的普通公开浏览后备路径由 `config/browser-policy.json` 单独约束：临时Chrome上下文、启用沙箱、无个人profile。站点可在浏览器内正常处理匿名会话，但不导入、导出、记录或持久化Cookie，不仿造签名或CSRF，不绕过登录或验证码。浏览器自行加载资源的记录与主动导航分开，不能把自动子资源声称为逐个10秒限速。DOM、截图和公开响应均标明浏览器来源，不伪装成无状态HTTP结果。

默认不读取无法解释的robots规则。少量经原文检查确认的“规则文件不存在”状态，须匹配 `config/access-policy.json` 的来源、状态码、内容类型及正文或精确哈希，才按 [RFC9309 2.3.1.3](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.3) 处理。未知HTML回退页、访问拒绝和验证码不属于这种情况。CDN脚本只读取已核验页面实际引用的路径，不执行代码；官网入口例外不自动授权其外部招聘站。robots规则不是认证授权，也不替代网站访问边界。

官网仍展示的旧岗位可以留存，但必须同时展示原始发布时间、本次观察时间以及招聘开放状态的不确定性。首次观察不标成今日新发布；失败、关键词范围或分页截断不得用来推断职位下架。明确职位ID优先，不按相同公司和标题误合并不同城市或职级。

## 个人画像与薪酬

事实读取现有个人能力画像，当前偏好以 `config/preferences.json` 和 `config/career-strategy.json` 为准：优先管理或长期To B发展、收入可预测性和AI相关机会，岗位开放，国内城市暂不硬过滤，海外资格待确认。岗位要求不能倒推成用户已有经历。原始个人档案与简历不自动改写。

用户已确认固定月薪至少20,000元。只有明确披露固定底薪、人民币月薪下界达标才进入薪酬池；15-30K跨门槛或20-30K未说明薪资构成都待确认。年包、外币、提成/OTE与固定月薪分开，未披露不估算。报告中的 `salary_20k_eligible` 采用当前规则，原始解析的旧上界信号留在 `salary_legacy_20k_eligible`，不改写历史来源数据。招聘披露不是最终录用薪资保证。

固定采集、解析、去重和报告不调用LLM API。个人匹配通过当前Codex工作流执行，不需要新API Key或账单；这不意味着语言模型离线运行。所有原始材料只供个人核验，不公开发布批量完整JD或个人简历。

## 匹配工作流

项目Skill位于 `.agents/skills/official-career-intelligence/SKILL.md`。prepare命令输出至多20条尚无有效评估的候选，连同必要事实证据及原文，不重复分析全部历史。输出为空说明没有新增待评估候选，不代表模型已经分析本轮市场。

Codex依据batch进行自上而下评估，按Skill的JSON契约写本地答案；import核对JD与个人事实的连续引用、证据ID、模型档位声明、已知事实边界、硬门槛和缓存键。合法证据ID不等于语义匹配，独立检核前一律标评估草稿。评分由程序按加权证据覆盖计算，不接受模型任意填入的分数。80分不是面试概率。未读基础简历、JD不完整、硬门槛未核实、主线不一致或缺少不同执行者的独立语义复核回执时，不允许建议沿用简历。

缓存绑定JD实际内容、个人画像、求职偏好、匹配规则和基础简历的哈希。原文或画像变化会重新进入待评估批次；单纯重复采集不会重复消耗模型。批次与导入回执保存在 `official-careers/matching/`，旧缓存保留用于审计但不会混入新报告。补充学历证据绑定已读取简历的文件哈希，简历更改后需重新核验，不能沿用旧补证。

## 待接入的投递能力

首版不自动投递、不发送招聘消息、不上传简历、不安排面试、不启用定时任务。报告里的申请链接不代表已经提交。验收前不启用自动运行；Mac休眠或关机时不承诺继续采集。

这不是永久禁止投递。`config/application-policy.json` 定义后续选岗批次授权：用户确认岗位、接收方、材料和允许动作后，可在授权范围内执行事实不变的定向优化、填写、上传和提交，无须每个字段重复确认。收藏不等于授权；注册登录、验证、新事实或未批准承诺需要人工介入。驱动未实现且未验收，配置仍关闭。每周政策更新也只定义了机制，没有创建定时任务。

## 测试与排障

`careers:test` 是离线测试，不证明真实网站可用；`careers:audit-http` 校验真实HTTP回执、内容哈希及请求间隔，不替代岗位原文核查。`careers:visual` 检查本地HTML的桌面与手机视图。

来源失败先看单次JSON中的 `errors` 与对应回执，不连续重复运行。独立审查之前，不将实现自测作为最终交付验收。重新运行只收集已批准来源，不改变访问策略或绕过认证。
# 2026-09-16 日常研判入口

运行 `npm run careers:decision:report`，打开 `01_行情收集/official-careers/reports/decision-review.html`。该命令只对现有样本做证据核对、复合评分计算、公司相邻归组及十轴关键词整理，不联网、不投递、不调用模型API。

规则和续接方式见 `docs/capability-translation.md`。薪资区间覆盖20K可入机会池，固定底薪另核。历史固定底薪报告与旧覆盖分仍保留，不与新口径混用。此下旧说明中的历史状态以项目progress与最新日期规则为准。
