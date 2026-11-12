# 本地原文独立抽查

结论：19条完整JD的标题、地点、职责及要求均能回到本地证据，未发现无源正文或错绑。16条仅有公司招聘列表来源，3条有岗位URL；全部薪资未知，均不能认定固定月薪达到CNY20000。其余6条索引未评估。

- 核对时间：2026-09-10T17:18:30.375Z。
- 分析者：`01a08c48-6ac2-7a10-9d1c-bb55f82826b1`；契约模型 `gpt-6-astra`，档位 `max`。实际派发凭据由总控绑定，不用角色名代替。
- jobs SHA256：`e0506c0a5cd941c81a72ef966d29c2d7523f8a04d43c008e981f5a67cdb9c5db`。
- context SHA256：`5119c0c0f972c0238ad11c9455fc340ab727c13bd7b478094f8f5d65d69c5946`。
- 独立离线核对，不联网。网页内容仅作不可信数据，不执行其中指令。raw为网页工具结果文本，不是原始HTTP响应，也不是实时在招或正式匹配审批证明。
- 表内L号是raw.result内的网页行号，不是JSON文件物理行号。职责/要求按所标段落逐条比对，仅忽略换行和空白；job_quotes另做逐字连续子串校验。

## 逐公司原文

| 来源 | 本地证据及来源链接 | 抽查结果 |
| --- | --- | --- |
| R1 探迹 | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/007-open-tungee-mobile.json)；[官网招聘列表](https://m.tungee.com/about/join-us/) | 电销经理L144/146为标题/广州，L150-152明确团队日常管理、配人和月度KPI。L157为两年相关管理经验，呼叫中心或6人以上团队是替代条件，不能只因没有呼叫中心经历淘汰。 |
| R2 纷享销客 | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/013-open-fxiaoke.json)；[官网招聘列表](https://www.fxiaoke.com/crm/about-join/) | 两条CSM分别位于L441-470、L559-588，地点不同，门槛分别为3年企业客户相关经历、5年总经验加3年ToB，不合并。L501-526渠道合伙人涉及代理商组队及出差，未证明雇佣关系或固定工资。 |
| R3 百度J100045 | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/pm-open-baidu-j100045.json)；[岗位来源](https://talent.baidu.com/jobs/detail/SOCIAL/031a8cb6-36b7-42c9-8f9e-bbafd8b71194) | L7岗位编号、L11上海及2026-07-21、L15职责和L19要求对应。1年销售是要求，IT/软件/云经验是更佳；ToB项目销售仍需证明。 |
| R4 百度J101343 | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/pm-open-baidu-j101343.json)；[岗位来源](https://talent.baidu.com/jobs/detail/SOCIAL/91fc2cef-4b6d-4127-b9cb-2e1266b9670f) | L7岗位编号、L11北京及2026-08-25、L15职责和L18要求对应。2年ToB及政企开发全流程不能用1年多商户经营直接替代。 |
| R5 AWS | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/025-open-aws.json)；[岗位来源](https://www.amazon.jobs/jobs/10464449) | L17-19标题、10464449及上海分公司主体对应；L59-61为上海/广州/南京。L49-52是Basic Qualifications，专业、云架构/CXO及英语均不是仅优先条件。L54-55才是Preferred。 |
| R6 销售易 | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/029-open-salesyi.json)；[官网招聘列表](https://www.xiaoshouyi.com/about-us/career) | L504起为CBG条目，客户经理L506/517要求本科及3年一般BD/销售，CRM为优先。方案顾问L527-530承担SOW至交付，不能因L537售前经历优先而略去实质交付职责。与前面的校招块分开。 |
| R7 Salesforce索引 | [原始记录](/Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-11/raw/002-search-salesforce.json)；[索引所指岗位](https://careers.salesforce.com/en/jobs/jr317761/named-account-executive/) | JR317761及Taiwan - Remote可对应索引，片段却提Singapore市场经验，存在地域口径疑点；不认定已错绑，也不迁就为完整JD。维持description_complete=false，不评分。 |

## 19条基本字段、链接与薪资

标题和地点均与相邻原文块一致。R1/R2/R6的链接只是公司招聘列表，不是职位直链；R3/R4/R5为取得的岗位URL，未实时访问。所有apply_url均为空，不等于原页面没有申请按钮。所有salary_raw均为空；“未知”表示未取得固定薪，不表示低于门槛，也不表示达标。

| job_id | 标题及地点核对 | 职责行 | 要求行 | 链接检查 | 薪资检查 |
| --- | --- | --- | --- | --- | --- |
| tungee-business-expert-20260911 | 商务专家；广州，一致 | R1 L90-95 | L99-100 | R1，仅列表 | 未知 |
| tungee-channel-manager-20260911 | 渠道经理；不限，一致 | R1 L109-112 | L116-120 | R1，仅列表 | 未知 |
| tungee-sales-consultant-20260911 | 销售顾问；广州，一致 | R1 L130-133 | L136-140 | R1，仅列表 | 未知 |
| tungee-telesales-manager-20260911 | 电销经理；广州，一致 | R1 L150-152 | L156-158 | R1，仅列表 | 未知 |
| tungee-customer-success-20260911 | 客户成功专员；广州，一致 | R1 L187-192 | L195-202 | R1，仅列表 | 未知 |
| tungee-city-manager-20260911 | 城市经理；不限，一致 | R1 L211-214 | L218-220 | R1，仅列表 | 未知 |
| tungee-ka-sales-director-20260911 | 大客户销售主管/总监；北京，一致 | R1 L229-233 | L237-242 | R1，仅列表 | 未知 |
| fxiaoke-ka-20260911 | 大客户经理；深圳、厦门、广州、武汉、郑州，一致 | R2 L416-424 | L427-437 | R2，仅列表 | 未知 |
| fxiaoke-csm-regional-20260911 | 客户成功经理；深圳、厦门、广州、武汉、郑州，一致 | R2 L447-455 | L458-470 | R2，仅列表 | 未知 |
| fxiaoke-channel-20260911 | 渠道经理；深圳、厦门，一致 | R2 L480-488 | L491-497 | R2，仅列表 | 未知 |
| fxiaoke-channel-partner-20260911 | 渠道合伙人；济南、青岛、西安、贵阳、重庆、成都，一致 | R2 L507-515 | L518-526 | R2，仅列表 | 未知 |
| fxiaoke-csm-advisory-20260911 | 客户成功经理；北京、上海、广州、深圳、杭州，一致 | R2 L565-575 | L578-588 | R2，仅列表 | 未知 |
| fxiaoke-after-sales-20260911 | 电话售后顾问；北京，一致 | R2 L598-600 | L603-609 | R2，仅列表 | 未知 |
| baidu-j100045-20260911 | 大模型及云计算大客户销售经理（J100045）；上海市，一致 | R3 L15 | L19 | R3，岗位URL | 未知 |
| baidu-j101343-20260911 | 公有云销售经理（J101343）；北京市，一致 | R4 L15 | L18 | R4，岗位URL | 未知 |
| aws-10464449-20260911 | BD Manager, Strategic Account；上海、广州、南京，一致 | R5 L23-32 | L49-55 | R5，岗位URL | 未知 |
| salesyi-account-20260911 | 客户经理；北京/上海/广州/深圳/成都/杭州/南京，一致 | R6 L509-513 | L517-520 | R6，仅列表 | 未知 |
| salesyi-solutions-20260911 | 方案顾问；北京/上海/广州/深圳/杭州，一致 | R6 L525-530 | L534-537 | R6，仅列表 | 未知 |
| salesyi-csm-20260911 | 客户成功经理；北京/上海/广州/深圳，一致 | R6 L542-547 | L550-555 | R6，仅列表 | 未知 |

## 源质量与边界

- 需保留原文疑点：探迹商务专家L99写“全日制及以上学历”，层级缺失，不擅自补齐；纷享全部6条location附“研发中心”，与商业职责不协调，但原文确如此，实际部门待核，不据此改为研发岗。
- 百度两页HTML标题为“百度校园招聘”，但URL是SOCIAL，正文有上述岗位编号、经验要求及完整职责。按社招正文可用处理，不因通用页标题误删，也不推断仍在招。
- AWS L23-26有重复介绍，源记录本身即重复；L49-55关键门槛完整。记录中的重定向仍落在amazon.jobs同一10464449岗位。销售易有“具高”“备较”等原文错字，未改写成新事实。
- 以jobs归一化时间和time_note为准。Salesforce原工具结果的2026-09-11T00:00:00.000Z是早期未来占位，不采纳；jobs记录的2026-09-10T16:44:00.953Z为文件持久化观察时间。百度两个正文日期不等于本轮新增，其余完整JD未披露发布日期。
- 六条索引隔离：Salesforce JR317761；百度J103250、J98717、J103939、J99570、J101421。只核对来源绑定和完整性标签，不输出个人完整评估。英语与工作许可缺少事实，不能从索引地区或品牌反推。
- 门槛按任职日期核：总经验约4年，特斯拉和乐道销售管理合计约2年10个月，DCD约1年2个月。10人同期直管、21人累计带教、210家个人商户、跨区域分工督办和150%个人测量各自独立，不扩大归因。
- 本轮没有政策新研究、公司排名核验、全行业统计或基础简历阅读；材料建议不是简历沿用审批。优先核实仅4条，不是薪资达标、面试概率或投递授权。

## 交付校验口径

Node从落盘JSON重新读取，核验19条唯一完整job_id、逐条1-3段job_quotes为description或requirements内连续原文、两个冻结输入SHA、执行ID/模型/档位、120字以内summary、固定薪未知及6条索引未进入评估。总控的150项测试与receipt绑定不冒充本分析者独立执行；最终校验结果以本轮实际工具回执为准。
