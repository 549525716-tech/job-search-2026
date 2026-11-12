# Coverage 独立 QA 与定向复验 (2026-09-14)

## 最后定向复验（F5/F6）
**结论：F5/F6及本次直接派生修复已验证闭合，限定范围内无剩余阻塞；不代表全部JD、全市场或自动续扫通过。** F1-F4沿用上轮结论，本次未重开。
- 范围：只读、不联网，仅运行coverage-extract定向测试与已知缺陷/队列断言；未运行全量测试、视觉、采集、纠正执行器，仅写本文。调度继续采用主控保存的Astra/xhigh回执。
- F5：独立按来源结果项边界重新核对104条URL+quote，104均匹配、0 rejected；第24-54条共31条正确重绑且保留original_source_url。2个承办方已明确“不是产业图谱成员”，不是原站新访问或法律身份核验。
- F6：206/L307、L321及209/L429均已进入对应description/requirements；205九岗均精确追加L13-33共享要求，source_role_text与标题至要求末行一致，L61岗位定位也保留。
- 直接派生：修复后的36条与累计JSON及campaign岗位原文逐字段对应，104目录与campaign发现原文对应；11条受影响岗位的正文/要求/岗位原文可在HTML及CSV回查。累计156展示名、111观察、95个完整标记不变；95仍是字段计数，非全量语义验收数。
- 队列：独立核对discovery-correction-receipt、state、retained inputs。31旧目录+11旧JD=42条不同旧观察，在companies/channels各42处、合计84注释；旧raw对象与原保留输入逐项相等，状态为superseded_pending_verification，更正路径/理由一致。
- 更正版已保留完整104/36条输入及SHA；原生去重下仅31/11条变化观察新增，73/25条未变观察沿用。两处队列均能找到全部当前版本原文，不能误算为新增140条。现267是未核雇主记录，36是渠道条目，不是已核公司或已访问渠道数。
- 原始保全：对照上轮审查SHA，22份raw及原company-discoveries.json共23件全部未变。两个旧输入的retained文件SHA匹配；受影响来源仍未准入，代码对已有approved source拒绝直接纠正，不清halt。
- 独立测试：Node v24.19.0运行 `--test careers/tests/coverage-extract.test.mjs`，2/2 pass、0 fail/skip，52.346208ms；包括跨结果、多行PDF标题、多个候选URL和缺失quote。另运行上述源文/直接派生/84注释只读断言通过，未执行真实写数据函数。
- 未完成边界：旧discovery-00c508ff-75d8-4898-9693-f1755d202951仍prepared、5项、冻结分母85、results/executions均空，manifest SHA与上轮相同；纠正及prepare回执live_requests均0，BOSS/猎聘保持blocked未访问；source_scope_complete=0、market_complete=false。
- 旧的非阻塞writer漏传输入保护、TA标题召回精度沿用待办，本次未扩展复验；非与其他主区上下文未追加全页审查，提取职责/要求不等于完整网页JD。新HTML视觉本轮未运行，旧视觉回执不用于证明新HTML已验收。
- 冻结jobs SHA：05325047827cc41777e7632dbf01b1d34a2913871f4144e07902c809351f4cd4；目录SHA：a25ca6c506dd47539f551b6b48a9b21f23d7bf3ee345f461d6b306ebf2b41f43。
- 冻结campaign SHA：5c46d85965cf194e2b1815f526864dc5080438d44dacda0ce19502da5c3432f5；累计jobs SHA：bb842977516b9a9936d67811ea3d3181eba7caa18f2c1ddbdcd4c6c7674e87bb。
- 新HTML SHA：dff181c933abc1a333a7a1a2fc1dd967262e70c918ad70e8f8f8e4638824c6cb；correction回执SHA：8296991b81bf0e9d73bdcf6c91ea6f67f2fad3908f6baf9bfc82390f68f95acd。
- 实现SHA：extract=c0dd4df43f7215d22c83821d6f507fde0ad76ef91938fa3dcf2f20d37c7ab4a1；discovery=0ac595d1d8492cb3b58eae0a1fbb25fbb8ff22b88c584a474302c1789c6ebb17；report=1285ac8b698bb5ff955d08a2576e2d25d3850661ab6baa336bf7e0101460e41c。
以下为更正前历史记录；F5/F6最终状态、当前数量和SHA以上述最后复验为准。

## 上轮结论（历史）
**F1-F4 原缺陷已定向闭合；新数据存在两项验收阻塞，不能宣称扩展数据与报告全部通过。**
可交付原文保全、覆盖账本及明确标注问题的部分成果；31条目录出处绑定、2条岗位的正文完整性必须保留待修状态。源范围 complete=0，全市场未完成。
本 QA 未参与实现，只读代码/冻结数据，未联网、未运行真实采集或改实现/历史 data，仅更新本文；按用户要求已停止追加审查与测试。
实际独立 QA 调度依据主控保存的工具回执：model=gpt-6-astra、reasoning_effort=xhigh、agent_id=01a0a022-77e4-79a3-8707-87498495f00f、nickname=Helmholtz。会话自检不是调度存在的前提；未宣称 max。Skill、agent-team、discovery-policy、company-tier-policy.reviewer 均已核见 xhigh。

## F1-F4 复验
| 项目 | 状态 | 实际证据与边界 |
| --- | --- | --- |
| F1 原始岗位误去重 | 已验证，原缺陷闭合 | loader 保留每个原始行，仅对规范化后的重复输入目录去重；4条缺ID/不同HR/跨渠道/跨快照测试保留4条。冻结三期25+50+36=111，重读结果与 coverage-jobs.json 深度相等；真实 writer 的 JSON/CSV 经内存截获，与冻结产物逐字节一致。 |
| F1 jobs SHA 绑定 | 已验证 | 输入必须在 campaign.input_snapshots.files 中，SHA变化和未登记路径均被测试拒绝；125个账本输入文件逐个重算SHA一致。输入集合缺省风险另见下文，不能解释为本冻结输出已丢行。 |
| F2 跨公司回执错归 | 已验证，闭合 | Beta回执被Alpha/Gamma引用仍只归Beta并记录冲突；显式别名可关联，具名原文不被父行覆盖，显式null仍为泛词。当前账本精确重建一致，3条具名冲突保留 pending_identity_review。 |
| F3 固定底薪写死0 | 已验证，闭合 | 累计视图明确“本累计视图未评估”；20K+标为目标、非达标统计。确认薪资输入也不会伪造已评估人数；当前HTML已无旧的固定0达标指标。薪资评估功能本身未验收。 |
| F4 扩展渠道错归 | 已验证，闭合 | 自定义association能进入自己的渠道单元；实际CLI读取companies JSON中的channels测试通过，目录用途仍不计招聘访问。未知标签原样保留待核，不代表渠道采集器已经实现。 |

## 上轮新增阻塞（已定向闭合）
### F5 [P1] 31条目录记录的URL与引文跨搜索结果错绑
- 代码：`careers/extract-coverage-captures.mjs:85-86`，分别检查整个 raw.result 含URL和quote，未验证二者在同一个来源结果项。
- 实际冻结文件：`01_行情收集/official-careers/research/sweep-2026-09-14-coverage/company-discoveries-reviewed.json`；第24-54条（1-based数组序号，共31条）错绑。SHA正确、名称存在不等于该URL支持该名称。
- 第24/25条“中国移动通信集团有限公司”“太极计算机股份有限公司”（文件279/291行）错误指向搜狐2026图谱；原文实际在 raw/102.json 的国家数据局《数据产业图谱（2025）》结果项，身份语境是活动承办方，不是该搜狐图谱成员。
- 对应实际来源为 https://www.nda.gov.cn/sjj/zhuanti/ztdsjblh/ztxwfb/0830/20250830212428486950454_pc.html ，本QA仅核对已保存文本，未访问链接。
- 第26-54条（文件303行起，29条）统一指向巨潮2026 PDF；华为、南瑞、安克等实际出现在 raw/103.json 的《中国软件产业高质量发展报告(2024)》名单。
- 对应名单来源为 https://pdf.dfcfw.com/pdf/H3_AP202410151640309153_1.pdf?1729027987000.pdf= ，不是保存字段中的 https://static.cninfo.com.cn/finalpage/2026-03-31/1225056893.PDF 。
- 范围复核：104条全部做同结果项URL+quote结构对账，73条匹配、31条不匹配；这是引用绑定检查，不是104家公司法律主体、行业分类或招聘真实性验收。
- 影响已扩散到累计账本与新导入discovery观察；不得将104条标作出处全通过。修复需依据同一结果项重绑，保留原raw及旧导入版本，更新派生证据/队列修订；不补造原站访问。

### F6 [P2] 2条岗位漏提取3行，却统一标正文完整
- 根因：`careers/extract-coverage-captures.mjs:52-61`仅验证选定范围非空，然后直接设置 description_complete=true；新extract测试只有行解析/缺行工具测试，没有语义完整性对账。
- `extraction-specs.json:28`：firmior-l284-20260914（推理系统优化实习生）只取职责L303-306、要求L310-320；漏 raw/206.json 的 **L307**“软硬件协同设计”职责及 **L321**“表达清晰、整理技术文档”加分要求。
- `extraction-specs.json:48`：huazheng-l419-20260914（AI智能体产品经理）职责只取L427-428；漏 raw/209.json 的 **L429**“推动研发落地与持续迭代，跟踪效果数据并优化产品体验”。
- 两条冻结jobs分别位于文件790/1066行起；程序已确认缺失内容未进入对应记录，description_complete仍true，累计JSON/CSV/HTML沿用该错误。
- 原raw未丢失；阻塞的是结构化正文保全与完整性声明。修复应补齐有据行并重新核验，或将受影响记录明确标不完整；不能用“排除产品经理”跳过原始记录保全。
- 当前报告95条“职责与要求完整”是字段计数，不是95条语义验收通过数；本轮没有对所有历史JD做全量语义重审。

## 已核验的原文抽查
- 203：职责L37-43、要求L45-48与源文一致；L25的1.5-2.5万保留，不证明固定底薪20K。杭州地点有L53依据。
- 204：L45底薪6000元/月与L66试用/转正5k同时保留并提示冲突，未平均或升级达标；职责L52-55、要求L57-61抽查一致。
- 205：9条主岗位及非主攻职能均保留；抽查职责/要求范围、上海通用地点和出海BD单独地点未见新增错绑；公司品牌/法律身份仍待核。
- 206/211：主区10条与同页8条疑似版本保留，8个variant引用全部能解析，未合并为已确认独立岗位；206北京专家与211上海工程师等差异仍在。正文缺口见F6。
- 207：京东具体职位URL、L16北京/2026-06-22、L20职责、L23要求均对应；仅证明保存页面信息，不证明今日在招或个人满足门槛。
- 209：5条city/location均null，未用总部地址补工作城市；其中产品经理正文缺行见F6，其他抽查条目未见同类漏条。
- 210：第三方职先机URL、广州、职责L72-75和要求L80-83一致；第三方发布日期/核验声明与官方当前在招核验分开，hiring_freshness_verified=false，未记网易官网已访问。
- 目录分组抽查：101世纪互联、104清微智能、105高科数聚、106忽米、107未来不远、002蜜度的URL与名字在同一结果项；分别只是目录/活动/历史名单/索引证据。002时间null及invalid_capture_timestamp保留。

## 独立执行与冻结证据
- Runtime实测为 `/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，v24.19.0。
- 独立执行 `--test careers/tests/coverage-campaign.test.mjs careers/tests/coverage-report.test.mjs careers/tests/coverage-extract.test.mjs careers/tests/opportunity-identity.test.mjs`：**30/30 pass、0 fail/skip，209.800292ms**（17+5+1+7）。
- 额外用Node模块mock仅截获writeFile：真实extract生成6件输出与冻结文件逐字节相同；真实writer的JSON/CSV同样一致，共9次写入全部只入内存。未覆盖任何磁盘产物。
- 账本读入125个文件的SHA全匹配；纯函数重建campaign与冻结JSON深度相等；三期原始岗位25+50+36=111。新36条中8条疑似版本，不是36个独立职位。
- 账本复算：156展示名、936单元、attempted40、pending582、blocked314、source_scope_complete0；法律实体数null、market_complete=false，BOSS/猎聘所有单元仍blocked且未计访问。
- 网络账本独立复算：23 begin、22 raw、21 finish；所有finish文件SHA正确。unique001无raw/finish，002时间无效且无finish，run保持partial_with_explicit_backlog，未修造缺失回执。
- 审查起止43个既有代码/冻结文件SHA全部未变；期间只新增主控交接的collection-notes.md、discovery-import-receipt.json。
- 主控提供的242/242全套测试未由本QA重跑。已读取其视觉回执，1440x1000/390x844标通过、无溢出/错误/外网请求；回执HTML SHA与当前文件一致。本QA未独立执行浏览器视觉，不以该回执替代F5/F6语义验收。

## 队列与未完成边界
- 已读discovery-import-receipt与真实state，校验两份retained input的SHA，并核对队列观察索引：新jobs36条、目录104条均完整入队。
- state为225条含历史/多来源未核雇主记录，不是225家公司；本次prepare回执live_requests=0，不代表已经续扫。
- 旧批次discovery-00c508ff-75d8-4898-9693-f1755d202951仍prepared，manifest5项均为旧ADXJ来源观察；冻结分母仍85，results为空、executions为空，新记录未被该批次执行。
- 账本/入队可用不等于自动采集全集已实现；源范围0、全市场未完成保留。BOSS/猎聘旧halt不清，未产生投递、消息或上传授权。
- 非阻塞工程风险：loader对指定文件做SHA绑定但未要求传入全部冻结输入；已复现单期输入返回25、空输入返回0，writer会使用固定累计输出路径。本冻结三期111行已精确对齐，并无该漏传造成的数据损坏；后续应加缺省/输入集合保护，不复开原F1去重缺陷。
- 非阻塞召回精度：主控反馈“招聘经理/TA（社媒营销&商业化）”标题误命中。本报告默认全原始、非推荐；本QA未追加匹配复验，本轮不扩展匹配。
- 主控随后补充：205页头L13-33共性要求未进入各岗requirements，L61岗位定位仅在raw；主控拟补共享要求，并将非与主区上下文收入role_context或明确提取范围。本QA未独立复验该补充及修复，不将职责段等同全页JD完整，相关项保持待修/待核。
- 待核：F5/F6修复及受影响派生数据/队列更正版尚未提供；修复后语义复验未运行。原站当前在招、全部渠道完整性、全市场自动续扫均未验证，不能以收尾改成通过。

## 历史与关键SHA
- 第一阶段独立测试23/23通过但发现F1-F4，4→1丢行、Beta→Alpha错归、薪资固定0、association→open_web四个反例均实际复现；当时结论为需返工。本节保留历史，当前状态以上述复验为准。
- 第一阶段campaign/report代码SHA分别为de4e0714e8c1dc12864ea0993f18bb5d471f2fa85bf0cfb94f85f32e456879e3、2c02562051d8ea26194de2919355ffec1863503aa8b02d7ad8bf520d3b3f1537。
```text
careers/coverage-campaign.mjs e6fde901e5040b99e087e31b889df94da79ff50f794bcd1bab8e9a41e0182cea
careers/coverage-report.mjs 8e6cc78dc648cd8c7fce08d2a77136014dfb19758def814036b92b39e6ba8ac2
careers/extract-coverage-captures.mjs a0d91714520af91b1bffad2fe10a380883486a965a6fe0f9dad935641bd3f831
new jobs.json 1f990f15d20ca86b618dab2ff99c173a02e997c37fba7cc922679c4a5d14b982
company-discoveries-reviewed.json ab4c2325da5c774661b9489295deedec880ed91d43e0e1a9833c4fadad20455b
extraction-specs.json 2e6c3874f835b78b4039e7e924d6d3f68332c91518a15e43680092bb9acba9c7
reports/coverage-campaign.json 6fb6d2c061e26ca8bd32c67255aeabcbd5ce371d995da661d0e352d3e41e0f2b
reports/coverage-jobs.json 4b5f57c41ce6cd08c85d71ff3024f9a168eede3833420a1fa4b08f657c714402
reports/coverage-campaign.html 77aa003eb9760659d2d40b2c23aeb5fcd7d8c3b233630395ffae93db0e70a6be
discovery-import-receipt.json 33fc356cdabdaf06b0ccf6a981ba5c87ade0536325dcbedcfc1333c28b48da61
```
