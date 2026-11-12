# Market-Wide Catalog Plan 2026-09-22

> 离线整理计划。本文档只定义公司目录与待执行查询，不代表联网扫描、岗位采集、来源完整或市场覆盖完成。

## 执行边界

- planned_company_count: **312**；每个显示名/品牌名对应一个查询对象，共 **312** 条。
- 本轮网络请求、浏览器操作、页面访问、代码/config/progress 修改均为 0。主控正在进行 8 个产业方向的独立检索，本目录不重复执行该工作。
- 法律实体不去重、不声称同名公司属于同一主体；同名或身份不确定项保留并标记待核。
- BOSS、猎聘既有 halt 与 MiniMax 适配器隔离保留；它们仅标记为禁用/待补，本轮不联网。

## 输入与 Shape

| 输入 | 实际 shape | 关键空字段/解释 |
| --- | --- | --- |
| coverage-campaign.json | companies=156 array; ledger=936 array | coverage 公司级 URL 字段为空；ledger.raw_urls 为空 771/936 条 |
| decision-review.json | groups=158 array; top-level jobs=null | 岗位实际在 groups[].jobs；0 个 group 无嵌套岗位；153 个 group 无行业标签 |
| discovery/state.json | companies=267 array | legal_name 为空 267/267；homepage 为空 257/267；careers_url 为空 170/267 |
| discovery-policy.json | industry_research_groups=8 | 8 组均为 research_hypothesis；market_total_known=false；global_market_exhaustion_claim_allowed=false |

## Deterministic Rules

- 合并键是显示名的 trim + case-insensitive 规范化键，仅用于避免同一显示名重复列出；这不是法律实体去重。原始变体、别名、来源路径和 URL 均保留。
- `query_name` 默认使用显示名；过长别名使用较短原品牌，并在 JSON 中保留 `display_name`、`display_name_variants`、`aliases` 和 `query_name` 映射。
- A 路线每个查询对象的 `request.search_query[0].q` 都是单公司/品牌精确名称查询：`公司名 招聘`；不叠加职能词，以保全陌生岗位召回；`response_length` 固定为 `long`。
- B 路线的职能词扩散由当前主控执行，本计划不重复取证；a01-a04 已真实检索，当前正在 a05-a08/B。
- 所有 query 状态为 `pending_offline_plan_only`，未执行。搜索结果、岗位数、来源完整性和市场总量均未产生新的事实。

## Preserved Restrictions

| 标志 | 状态 |
| --- | --- |
| BOSS直聘 (boss) | disabled_preserved；既有安全暂停；本轮不联网、不恢复、不重试 |
| 猎聘 (liepin) | disabled_preserved；既有验证码/访问暂停；本轮不联网、不恢复、不重试 |
| MiniMax ATS/适配器 (minimax_adapter) | isolated_preserved；既有隔离保留；不通过新账号、同租户地址或其他工具绕过 |

## Catalog Summary

- 有既有 URL: 299；无既有 URL: 13。
- 新公司待核: 139；同名/实体身份待核: 156。
- 这些数量是目录与待办分母，不是市场规模，不用于证明扫描充分覆盖。

## Company List

| ID | display_name | query_name | 原行业标签 | 既有 URL 数 | 来源类型 | 待核标志 |
| --- | --- | --- | --- | ---: | --- | --- |
| company-0001 | 360 | 360 | 空 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0002 | 4paradigm | 第四范式 | 空 | 2 | discovery_state.companies |  |
| company-0003 | 阿里巴巴 | 阿里巴巴 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0004 | 阿里巴巴集团控股有限公司 | 阿里巴巴集团控股有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0005 | 阿里云 | 阿里云 | 云、算力与AI基础设施 | 19 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0006 | 阿里云计算有限公司 | 阿里云计算有限公司 | 制造与工业智能化；制造与工业智能化、基础大模型与开放平台；基础大模型与开放平台 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0007 | 阿里云智能 | 阿里云 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0008 | 艾利丹尼森(中国) | 艾利丹尼森(中国) | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0009 | 安克创新科技股份有限公司 | 安克创新科技股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0010 | 百度 | 百度 | 空 | 7 | decision_review.group、decision_review.group.jobs |  |
| company-0011 | 百度在线网络技术(北京)有限公司 | 百度在线网络技术(北京)有限公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0012 | 百度在线网络技术（北京）有限公司 | 百度在线网络技术（北京）有限公司 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0013 | 百度智能云 | 百度智能云 | 云、算力与AI基础设施 | 8 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0014 | 百炼 | 百炼 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0015 | 百炼智能 | 百炼 | 空 | 2 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0016 | 北京百度网讯科技有限公司 | 北京百度网讯科技有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0017 | 北京百炼智能科技有限公司 | 百炼 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0018 | 北京必来屋网络科技有限公司 | 北京必来屋网络科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0019 | 北京不等式科技有限公司 | 北京不等式科技有限公司 | 制造与工业智能化 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0020 | 北京东方国信科技股份有限公司 | 北京东方国信科技股份有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0021 | 北京华征科技有限公司 | 北京华征科技有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0022 | 北京经纬恒润科技股份有限公司 | 北京经纬恒润科技股份有限公司 | 空 | 3 | decision_review.group、decision_review.group.jobs |  |
| company-0023 | 北京兰光创新科技有限公司 | 北京兰光创新科技有限公司 | 制造与工业智能化 | 6 | decision_review.group、decision_review.group.jobs |  |
| company-0024 | 北京清微智能科技股份有限公司 | 北京清微智能科技股份有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0025 | 北京天弛网络有限公司 | 北京天弛网络有限公司 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0026 | 北京迅利创成科技有限公司 | 北京迅利创成科技有限公司 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0027 | 北京掌上先机网络科技有限公司 | 北京掌上先机网络科技有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0028 | 北京智谱华章科技股份有限公司 | 智谱 | 空 | 2 | discovery_state.companies |  |
| company-0029 | 北京中科慧灵机器人技术有限公司 | 北京中科慧灵机器人技术有限公司 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0030 | 北京紫光云技术有限公司 | 北京紫光云技术有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0031 | 参数技术 | 参数技术 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0032 | 成都华邻科技有限公司 | 成都华邻科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0033 | 成都乾视智能科技有限公司 | 成都乾视智能科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0034 | 成都知否瑞达科技有限公司 | 成都知否瑞达科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0035 | 重庆忽米网络科技有限公司 | 重庆忽米网络科技有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0036 | 重庆中科云从科技有限公司 | 重庆中科云从科技有限公司 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0037 | 滴滴出行 | 滴滴出行 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0038 | 滴普科技股份有限公司 | 滴普科技股份有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0039 | 第四范式 | 第四范式 | 空 | 2 | discovery_state.companies |  |
| company-0040 | 第四范式(北京)技术有限公司 | 第四范式 | 空 | 2 | discovery_state.companies |  |
| company-0041 | 鼎捷数智 | 鼎捷数智 | 空 | 18 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0042 | 东风汽车 | 东风汽车 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0043 | 东华软件 | 东华软件 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0044 | 东华软件股份公司 | 东华软件股份公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0045 | 东软集团股份有限公司 | 东软集团股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0046 | 动鑫科技 | 动鑫科技 | 企业软件 / SaaS | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0047 | 法本信息 | 法本信息 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0048 | 帆软 | 帆软 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0049 | 飞轮科技 | 飞轮科技 | 实时数据仓库技术 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0050 | 飞轮科技（SelectDB） | 飞轮科技（SelectDB） | 数据与AI开发平台 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0051 | 非与智能 | 非与智能 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0052 | 纷享销客 | 纷享销客 | 企业软件与营销数字化 | 16 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0053 | 扶瑶智能科技(天津)有限公司 | 扶瑶智能科技(天津)有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0054 | 傅利叶智能 | 傅利叶智能 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0055 | 富士康工业互联网股份有限公司 | 富士康工业互联网股份有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0056 | 高科数聚 | 高科数聚 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0057 | 高擎 | 高擎 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0058 | 勾正科技 | 勾正科技 | 数据与AI开发平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0059 | 谷斗科技 | 谷斗科技 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0060 | 观远数据 | 观远数据 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0061 | 光环云数据有限公司 | 光环云数据有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0062 | 广东创云科技有限公司 | 广东创云科技有限公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0063 | 广东鲸翌智能设备有限公司 | 广东鲸翌智能设备有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0064 | 广域铭岛 | 广域铭岛 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0065 | 广州今宏信息科技有限公司 | 广州今宏信息科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0066 | 硅云 | 硅云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0067 | 贵州万联易达科技有限公司 | 贵州万联易达科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0068 | 海尔集团 | 海尔集团 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0069 | 海尔卡奥斯物联生态科技有限公司 | 海尔卡奥斯物联生态科技有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0070 | 海康机器人 | 海康机器人 | 空 | 16 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0071 | 海康威视 | 海康威视 | 机器人与智能硬件 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0072 | 海信集团控股股份有限公司 | 海信集团控股股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0073 | 杭州海康威视数字技术股份有限公司 | 杭州海康威视数字技术股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0074 | 杭州深度求索人工智能基础技术研究有限公司 | 深度求索 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0075 | 杭州正马软件科技有限公司 | 杭州正马软件科技有限公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0076 | 杭州智思达科技有限责任公司 | 杭州智思达科技有限责任公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0077 | 航天信息股份有限公司 | 航天信息股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0078 | 航天云网科技发展有限责任公司 | 航天云网科技发展有限责任公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0079 | 和利时集团 | 和利时集团 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0080 | 河北申联汽车服务集团有限公司 | 河北申联汽车服务集团有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0081 | 河南卿云信息技术有限公司 | 河南卿云信息技术有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0082 | 河南天之悦实业有限公司 | 河南天之悦实业有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0083 | 恒创科技 | 恒创科技 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0084 | 宏工科技股份有限公司 | 宏工科技股份有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0085 | 湖南中项网科技有限公司 | 湖南中项网科技有限公司 | 互联网与企业服务 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0086 | 华测检测 | 华测检测 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0087 | 华纳云 | 华纳云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0088 | 华天软件 | 华天软件 | 智能制造软件 | 4 | decision_review.group、decision_review.group.jobs |  |
| company-0089 | 华为技术有限公司 | 华为技术有限公司 | 企业软件与营销数字化；企业软件与营销数字化、制造与工业智能化；制造与工业智能化 | 3 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0090 | 华为云 | 华为云 | 云、算力与AI基础设施 | 19 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0091 | 华为终端有限公司 | 华为终端有限公司 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0092 | 欢聚集团 | 欢聚集团 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0093 | 辉瑞中国 | 辉瑞中国 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0094 | 汇川技术 | 汇川技术 | 空 | 19 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0095 | 慧策/掌上先机 | 慧策/掌上先机 | 空 | 17 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0096 | 慧策\|旺店通(掌上先机) | 慧策\|旺店通(掌上先机) | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0097 | 火山引擎 | 火山引擎 | 空 | 14 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0098 | 货拉拉 | 货拉拉 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0099 | 极限科技 | 极限科技 | 数据与AI开发平台 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0100 | 寄云科技 | 寄云科技 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0101 | 加速进化 | 加速进化 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0102 | 简道云 | 简道云 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0103 | 江苏百信数字认证有限公司 | 江苏百信数字认证有限公司 | AI企业应用 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0104 | 江苏动铁教育科技集团有限公司 | 江苏动铁教育科技集团有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0105 | 江苏亨通数字智能科技有限公司 | 江苏亨通数字智能科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0106 | 金蝶 | 金蝶 | 空 | 18 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0107 | 金千枝(深圳)软件技术有限公司 | 金千枝(深圳)软件技术有限公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0108 | 金山云 | 金山云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0109 | 京东 | 京东 | AI企业应用；云、算力与AI基础设施 | 2 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0110 | 京东集团股份有限公司 | 京东集团股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0111 | 京东科技信息技术有限公司 | 京东科技信息技术有限公司 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0112 | 京东商城 | 京东商城 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0113 | 京东物流 | 京东物流 | 空 | 4 | decision_review.group、decision_review.group.jobs |  |
| company-0114 | 京东云 | 京东云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0115 | 科大讯飞 | 讯飞 | 空 | 15 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0116 | 科大讯飞股份有限公司 | 讯飞 | 企业软件与营销数字化 | 4 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0117 | 来也科技 | 来也科技 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0118 | 岚图汽车 | 岚图汽车 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0119 | 蓝星智云(山东)智能科技有限公司 | 蓝星智云(山东)智能科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0120 | 朗矽科技 | 朗矽科技 | 半导体 / AI算力器件 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0121 | 浪潮工业互联网股份有限公司 | 浪潮工业互联网股份有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0122 | 浪潮集团 | 浪潮集团 | 空 | 5 | decision_review.group、decision_review.group.jobs |  |
| company-0123 | 浪潮集团有限公司 | 浪潮集团有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0124 | 浪潮云 | 浪潮云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0125 | 浪潮云信息技术股份公司 | 浪潮云信息技术股份公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0126 | 利真汽车 | 利真汽车 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0127 | 联通数字科技有限公司 | 联通数字科技有限公司 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0128 | 联想懂的通信 | 联想懂的通信 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0129 | 联友 | 联友 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0130 | 联友科技 | 联友科技 | 汽车与智能出行数字化 | 16 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0131 | 猎豹移动 | 猎豹移动 | 互联网与企业服务 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0132 | 领充新能源 | 领充新能源 | 智能硬件与汽车数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0133 | 蚂蚁集团 | 蚂蚁集团 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0134 | 美林数据技术股份有限公司 | 美林数据技术股份有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0135 | 美团 | 美团 | 空 | 3 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs |  同名/实体待核 |
| company-0136 | 妙蛙 GEO | 妙蛙 GEO | AI 搜索/GEO | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0137 | 明珞装备 | 明珞装备 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0138 | 明源云 | 明源云 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0139 | 魔法原子 | 魔法原子 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0140 | 某广州大型人工智能公司 | 某广州大型人工智能公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0141 | 某广州大型整车制造公司 | 某广州大型整车制造公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0142 | 某杭州互联网上市公司 | 某杭州互联网上市公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0143 | 某上海人力资源服务公司 | 某上海人力资源服务公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0144 | 某上海仪器仪表公司 | 某上海仪器仪表公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0145 | 某深圳互联网上市公司 | 某深圳互联网上市公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0146 | 某IT服务公司 | 某IT服务公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0147 | 南京大数据集团有限公司 | 南京大数据集团有限公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0148 | 南京国睿信维软件有限公司 | 南京国睿信维软件有限公司 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0149 | 南京深度智控科技有限公司 | 南京深度智控科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0150 | 南瑞集团有限公司 | 南瑞集团有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0151 | 宁波均胜电子股份有限公司 | 宁波均胜电子股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0152 | 牛客科技 | 牛客科技 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0153 | 七牛云 | 七牛云 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0154 | 启境汽车 | 启境汽车 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0155 | 启明信息 | 启明信息 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0156 | 强生(中国)投资有限公司 | 强生(中国)投资有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0157 | 秦淮数据中心 | 秦淮数据中心 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0158 | 青云 | 青云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0159 | 青云QingCloud | 青云QingCloud | 云、算力与AI基础设施 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0160 | 清研讯科 | 清研讯科 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0161 | 擎翌(上海)智能科技有限公司 | 擎翌(上海)智能科技有限公司 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0162 | 容联云 | 容联云 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0163 | 软通动力信息技术(集团)股份有限公司 | 软通动力信息技术(集团)股份有限公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0164 | 软通动力信息技术（集团）股份有限公司 | 软通动力信息技术（集团）股份有限公司 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0165 | 瑞蓝创 | 瑞蓝创 | 数据与AI开发平台 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0166 | 赛意信息 | 赛意信息 | 空 | 18 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs |  同名/实体待核 |
| company-0167 | 厦门赛西科技发展有限责任公司 | 厦门赛西科技发展有限责任公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0168 | 山东极视角科技股份有限公司 | 山东极视角科技股份有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0169 | 商车云(北京)科技有限公司 | 商车云(北京)科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0170 | 商汤 | 商汤 | 空 | 14 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0171 | 上海宝信软件股份有限公司 | 上海宝信软件股份有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0172 | 上海颉纶科技软件有限公司 | 上海颉纶科技软件有限公司 | 空 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0173 | 上海猫小鼬信息科技有限公司 | 上海猫小鼬信息科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0174 | 上海蜜度科技股份有限公司 | 上海蜜度科技股份有限公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0175 | 上海佩琪集团 | 上海佩琪集团 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0176 | 上海沁灿信息技术有限公司 | 上海沁灿信息技术有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0177 | 上海天天软件股份有限公司 | 上海天天软件股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0178 | 上海曦智科技股份有限公司 | 上海曦智科技股份有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0179 | 上海原圈网络科技有限公司 | 上海原圈网络科技有限公司 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0180 | 尚品宅配集团 | 尚品宅配集团 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0181 | 深度求索 | 深度求索 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0182 | 深圳胖柴点书科技有限公司广州分公司 | 深圳胖柴点书科技有限公司广州分公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0183 | 深圳市腾讯计算机系统有限公司 | 深圳市腾讯计算机系统有限公司 | 企业软件与营销数字化；企业软件与营销数字化、制造与工业智能化；制造与工业智能化 | 3 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0184 | 神策数据 | 神策数据 | 企业软件与营销数字化 | 18 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0185 | 神州数码 | 神州数码 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0186 | 神州数码集团股份有限公司 | 神州数码集团股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0187 | 神州万利科技集团有限公司 | 神州万利科技集团有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0188 | 声网 | 声网 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0189 | 时代亿信 | 时代亿信 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0190 | 实在智能 | 实在智能 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0191 | 世纪互联数据中心 | 世纪互联数据中心 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0192 | 首汽租车 | 首汽租车 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0193 | 曙光信息 | 曙光信息 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0194 | 树根互联股份有限公司 | 树根互联股份有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0195 | 思特奇 | 思特奇 | 数据与AI开发平台 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0196 | 四川具身人形机器人科技有限公司 | 四川具身人形机器人科技有限公司 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0197 | 四川长征车业集团有限公司 | 四川长征车业集团有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0198 | 四川中城智建系统集成科技有限公司 | 四川中城智建系统集成科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0199 | 松延动力 | 松延动力 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0200 | 太极计算机股份有限公司 | 太极计算机股份有限公司 | 数据与AI开发平台 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0201 | 钛动科技 | 钛动科技 | AI应用 / 营销科技 | 3 | decision_review.group、decision_review.group.jobs |  |
| company-0202 | 探迹科技 | 探迹科技 | AI企业应用 | 4 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0203 | 特斯拉中国 | 特斯拉中国 | 空 | 5 | decision_review.group、decision_review.group.jobs |  |
| company-0204 | 腾讯云 | 腾讯云 | 云、算力与AI基础设施 | 24 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0205 | 腾讯云计算 | 腾讯云 | 空 | 3 | discovery_state.companies | 新公司待核 |
| company-0206 | 天津艾迪智绘网络科技有限公司 | 天津艾迪智绘网络科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0207 | 天津思必得科技有限公司 / 妙蛙GEO | 天津思必得科技有限公司 / 妙蛙GEO | AI应用 / GEO与企业增长；AI应用 / GEO营销 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0208 | 天津万联易达科技有限公司 | 天津万联易达科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0209 | 天翼云科技有限公司 | 天翼云科技有限公司 | 云、算力与AI基础设施；云、算力与AI基础设施、基础大模型与开放平台；基础大模型与开放平台 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0210 | 万国数据中心 | 万国数据中心 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0211 | 网易(杭州)网络有限公司 | 网易(杭州)网络有限公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0212 | 网易（杭州）网络有限公司 | 网易（杭州）网络有限公司 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0213 | 网易数帆 | 网易数帆 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0214 | 网易智企 | 网易智企 | AI企业应用 | 3 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0215 | 未来不远 | 未来不远 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0216 | 沃丰科技 | 沃丰科技 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0217 | 武汉亿量科技有限公司 | 武汉亿量科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0218 | 物自体(上海)科技有限公司 | 物自体(上海)科技有限公司 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0219 | 物自体（上海）科技有限公司 | 物自体（上海）科技有限公司 | 企业软件与营销数字化 | 1 | decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 |
| company-0220 | 稀宇科技 | 稀宇科技 | 空 | 3 | discovery_state.companies |  |
| company-0221 | 先进数通 | 先进数通 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0222 | 销售易 | 销售易 | 空 | 15 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0223 | 小米集团 | 小米集团 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0224 | 小鹏集团 | 小鹏集团 | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0225 | 小鹏汽车 | 小鹏汽车 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0226 | 欣旺达动力科技股份有限公司 | 欣旺达动力科技股份有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0227 | 新华三技术有限公司 | 新华三技术有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0228 | 徐工汉云技术股份有限公司 | 徐工汉云技术股份有限公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0229 | 讯飞 | 讯飞 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0230 | 亚马逊 | 亚马逊 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0231 | 亚马逊云科技 | 亚马逊云科技 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0232 | 仪电双杨智能科技(上海)有限公司 | 仪电双杨智能科技(上海)有限公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0233 | 仪电双杨智能科技（上海）有限公司 | 仪电双杨智能科技（上海）有限公司 | 空 | 1 | discovery_state.companies | 新公司待核 |
| company-0234 | 亿速云 | 亿速云 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0235 | 影刀 | 影刀 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0236 | 用友 | 用友 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0237 | 用友网络科技股份有限公司 | 用友网络科技股份有限公司 | 企业软件与营销数字化；企业软件与营销数字化、制造与工业智能化；制造与工业智能化 | 3 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0238 | 优必选 | 优必选 | 空 | 20 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs |  同名/实体待核 |
| company-0239 | 优刻得 | 优刻得 | 云、算力与AI基础设施 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0240 | 宇树科技 | 宇树科技 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0241 | 驭势科技(北京)股份有限公司 | 驭势科技(北京)股份有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0242 | 驭势科技（北京）股份有限公司 | 驭势科技（北京）股份有限公司 | 空 | 1 | discovery_state.companies | 新公司待核 |
| company-0243 | 原圈科技 | 原圈科技 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0244 | 远海国际旅游集团 | 远海国际旅游集团 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0245 | 月之暗面 | kimi | AI基础模型 / 商业化与生态；AI基础模型 / 商业化生态 | 16 | decision_review.group、decision_review.group.jobs、discovery_state.companies |  |
| company-0246 | 月之暗面（同名异主体，待核） | 月之暗面（同名异主体，待核） | 空 | 2 | decision_review.group、decision_review.group.jobs |  |
| company-0247 | 月之暗面科技 | kimi | 空 | 3 | discovery_state.companies |  |
| company-0248 | 长城智选信息科技(保定)有限公司 | 长城智选信息科技(保定)有限公司 | 空 | 3 | decision_review.group、decision_review.group.jobs |  |
| company-0249 | 浙江大华技术股份有限公司 | 浙江大华技术股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0250 | 浙江蓝卓工业互联网信息技术有限 公司 | 浙江蓝卓工业互联网信息技术有限 公司 | 制造与工业智能化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0251 | 浙江强脑科技有限公司 | 浙江强脑科技有限公司 | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0252 | 浙江涛涛车业股份有限公司 | 浙江涛涛车业股份有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0253 | 正航软件 | 正航软件 | 企业管理/工业软件 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0254 | 智慧芽 | 智慧芽 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0255 | 智马达汽车有限公司 | 智马达汽车有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0256 | 智谱 | 智谱 | 空 | 2 | discovery_state.companies |  |
| company-0257 | 智谱ai | 智谱 | 空 | 2 | discovery_state.companies |  |
| company-0258 | 智芯半导体 | 智芯半导体 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0259 | 智元创新 | 智元创新 | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0260 | 中电科数字技术股份有限公司 | 中电科数字技术股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0261 | 中电信数政科技有限公司 | 中电信数政科技有限公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0262 | 中电信数智科技有限公司新疆分公司 | 中电信数智科技有限公司新疆分公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0263 | 中国联合网络通信有限公司北京市分公司 | 中国联合网络通信有限公司北京市分公司 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0264 | 中国移动通信集团有限公司 | 中国移动通信集团有限公司 | 数据与AI开发平台 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0265 | 中国移动信息技术有限公司 | 中国移动信息技术有限公司 | 基础大模型与开放平台 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0266 | 中化数智科技有限公司 | 中化数智科技有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0267 | 中科创达 | 中科创达 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0268 | 中科软 | 中科软 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0269 | 中科斯欧(合肥)科技股份有限公司 | 中科斯欧(合肥)科技股份有限公司 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0270 | 中企动力 | 中企动力 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0271 | 中汽工程 | 中汽工程 | 汽车与智能出行数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0272 | 中软国际 | 中软国际 | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0273 | 中软国际有限公司 | 中软国际有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0274 | 中通服和信科技有限公司 | 中通服和信科技有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0275 | 中兴通讯股份有限公司 | 中兴通讯股份有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0276 | 中移(苏州)软件技术有限公司 | 中移(苏州)软件技术有限公司 | 云、算力与AI基础设施 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0277 | 中移（苏州）软件技术有限公司 | 中移（苏州）软件技术有限公司 | 空 | 1 | discovery_state.companies | 新公司待核 |
| company-0278 | 中移物联网有限公司 | 中移物联网有限公司 | 企业软件与营销数字化 | 2 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0279 | 字节跳动 | 字节跳动 | 互联网 / 汽车本地生活；互联网商业化 / 汽车本地生活 | 9 | decision_review.group、decision_review.group.jobs |  |
| company-0280 | 字节跳动/飞书商业化 | 字节跳动/飞书商业化 | 空 | 0 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0281 | 字节跳动火山引擎 | 火山引擎 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0282 | Adjust (an AppLovin company) | Adjust (an AppLovin company) | 营销科技（AdTech） | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0283 | ADXJ 蓝鲸出海 | ADXJ 蓝鲸出海 | 互联网商业服务 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0284 | ADXJ蓝鲸出海 | ADXJ蓝鲸出海 | 空 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0285 | AI Squared | AI Squared | AI企业应用与数据分析 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0286 | Airwallex | Airwallex | 全球支付与金融平台 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0287 | alibaba cloud | 阿里云 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0288 | Aliyun | Aliyun | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0289 | Amazon Information Service (Beijing) Co., Ltd. (Shanghai Branch) | Amazon Information Service (Beijing) Co., Ltd. (Shanghai Branch) | 云、算力与AI基础设施 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0290 | Amazon Web Services | Amazon Web Services | 空 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0291 | APUS | APUS | 企业软件与营销数字化 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0292 | Cloudflare | Cloudflare | 云、算力与AI基础设施 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0293 | DeepSeek | 深度求索 | 空 | 70 | decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 |
| company-0294 | Digit Robotics | Digit Robotics | 机器人与智能硬件 | 1 | coverage_campaign.companies、coverage_campaign.ledger、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0295 | Figma | Figma | 企业软件与协作工具 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0296 | GrowingIO | GrowingIO | 空 | 15 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0297 | iflytek | 讯飞 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0298 | kimi | kimi | 空 | 3 | discovery_state.companies |  |
| company-0299 | Microsoft | Microsoft | 云、算力与AI基础设施 | 2 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs |  同名/实体待核 |
| company-0300 | MiniMax | 稀宇科技 | AI基础模型 / MaaS技术销售 | 18 | decision_review.group、decision_review.group.jobs、discovery_state.companies |  |
| company-0301 | moonshot ai | kimi | 空 | 3 | discovery_state.companies |  |
| company-0302 | Noumena | Noumena | AI企业应用 | 1 | coverage_campaign.companies、coverage_campaign.ledger |  同名/实体待核 |
| company-0303 | Noumena（物自体） | Noumena（物自体） | AI 科技公司 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0304 | Salesforce | Salesforce | 空 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0305 | Shoplazza | Shoplazza | 空 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0306 | SparkX 邑炎科技 | SparkX 邑炎科技 | 企业软件与营销数字化 | 1 | coverage_campaign.companies、coverage_campaign.ledger、decision_review.group、decision_review.group.jobs、discovery_state.companies | 新公司待核 同名/实体待核 |
| company-0307 | tencent cloud | 腾讯云 | 空 | 3 | discovery_state.companies | 新公司待核 |
| company-0308 | volcengine | 火山引擎 | 空 | 2 | discovery_state.companies | 新公司待核 |
| company-0309 | YMatrix | YMatrix | 数据库/实时分析数仓 | 1 | decision_review.group、decision_review.group.jobs |  |
| company-0310 | Z.ai | 智谱 | 空 | 3 | decision_review.group、decision_review.group.jobs、discovery_state.companies |  |
| company-0311 | zhipu ai | 智谱 | 空 | 2 | discovery_state.companies |  |
| company-0312 | Zilliz | Zilliz | 空 | 1 | decision_review.group、decision_review.group.jobs |  |

## Query Contract

- 完整逐条 A 路线查询定义见同目录 `catalog-plan.json` 的 `queries` 数组；每条只对应一个公司/品牌，不把多个不同公司混入一条查询。
- `c001...` 编号连续且每个 `company_id` 只出现一次；执行时仍须服从既有来源准入、串行队列、halt 和首次访问拒绝即停规则。
- 本文件没有调用搜索工具，也没有把 BOSS/猎聘/MiniMax 待补项伪装成结果。
