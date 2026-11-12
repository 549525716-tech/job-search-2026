# 2026-09-22 岗位市场扫描检查点

本轮是全底册检索与公开招聘页扩展，不是全市场岗位全集。搜索命中不等于完整JD、在招确认或雇主身份核验。

## 实际结果

- 公司检索：275/275个不同查询词；覆盖305个目录显示名，另7个匿名名称待核。别名显示数不是独立雇主数。
- 333次搜索、42次页面读取；9次页面读取失败。
- 4687条原始搜索结果，4381个不同URL，均是待核线索，不是岗位数。
- 173条结构化岗位观察，其中109条有完整职责与要求，涉及52个雇主显示名。列表和详情的关联证据见提取审计。
- 原文与时间逐条留存；限速核验：passed_for_recorded_calls。没有投递、发消息或上传简历。

## 新公司回补与岗位线索

- 行业查询8/8组，跨市场职能与正文关键词查询10/10组；逐项查询、日期和原文见industry-keyword-coverage.json。
- 新发现雇主名称：已检索40/40组；属于实际执行，不只是入队。
- 独立于173条页面记录，另保留694条可绑定岗位名称和雇主的搜索职位线索，尚无完整正文，不能评分。
- 本批送入主报告867条记录；不是独立岗位数量，也不是全部已确认在招。
- 继续发现120个未在本批计划出现的雇主显示名，带原文证据保存于next-company-queue.json，尚未续扫；可能包含同一雇主别名。
- 华天软件仅取得招聘第2页；环信仅取得首段且尾段超时；第四范式仅取得招聘入口。上述范围未扫全，不据此标记零岗位。
- 检索全览：search-explorer.html；全部搜索原文：search-results.csv；页面记录与索引线索组合：report-jobs.json。

## 未完成

BOSS/猎聘自动接管仍隔离；动态ATS、详情分页、匿名雇主、部分超时页面及新发现URL仍待续。未披露薪资不等于低于20K，招聘区间不等于固定底薪。尚不满足全市场宽度验收。

## 文件

- 岗位：jobs.json；完整字段与SHA：extraction-audit.json。
- 查询和全部原始命中：search-index.json；新增来源：source-candidates.json。
- 公司覆盖：company-coverage.json / company-coverage.csv；完整待续：backlog.json。
- 请求回执：web-session.jsonl；限速与哈希审计：timing-audit.json。

## 公司覆盖明细

| 公司显示名 | 行业原标签 | 初扫状态 | 检索ID | 发现URL数 |
| --- | --- | --- | --- | ---: |
| 360 | 待核 | initial_search_done_details_pending | c001 | 8 |
| 4paradigm | 待核 | initial_search_done_details_pending | c002 | 14 |
| 阿里巴巴 | 待核 | initial_search_done_details_pending | c003 | 17 |
| 阿里巴巴集团控股有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c004 | 18 |
| 阿里云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c005 | 16 |
| 阿里云计算有限公司 | 制造与工业智能化 / 制造与工业智能化、基础大模型与开放平台 / 基础大模型与开放平台 | initial_search_done_details_pending | c006 | 18 |
| 阿里云智能 | 待核 | initial_search_done_details_pending | c005 | 16 |
| 艾利丹尼森(中国) | 待核 | initial_search_done_details_pending | c008 | 16 |
| 安克创新科技股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c009 | 20 |
| 百度 | 待核 | initial_search_done_details_pending | c010 | 10 |
| 百度在线网络技术(北京)有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c011 | 17 |
| 百度在线网络技术（北京）有限公司 | 待核 | initial_search_done_details_pending | c011 | 17 |
| 百度智能云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c013 | 17 |
| 百炼 | 待核 | initial_search_done_details_pending | c014 | 13 |
| 百炼智能 | 待核 | initial_search_done_details_pending | c014 | 13 |
| 北京百度网讯科技有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c016 | 13 |
| 北京百炼智能科技有限公司 | 待核 | initial_search_done_details_pending | c014 | 13 |
| 北京必来屋网络科技有限公司 | 待核 | initial_search_done_details_pending | c018 | 13 |
| 北京不等式科技有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c019 | 12 |
| 北京东方国信科技股份有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c020 | 17 |
| 北京华征科技有限公司 | AI企业应用 | initial_search_done_details_pending | c021 | 10 |
| 北京经纬恒润科技股份有限公司 | 待核 | initial_search_done_details_pending | c022 | 17 |
| 北京兰光创新科技有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c023 | 16 |
| 北京清微智能科技股份有限公司 | AI企业应用 | initial_search_done_details_pending | c024 | 18 |
| 北京天弛网络有限公司 | 待核 | initial_search_done_details_pending | c025 | 18 |
| 北京迅利创成科技有限公司 | 待核 | initial_search_done_details_pending | c026 | 18 |
| 北京掌上先机网络科技有限公司 | AI企业应用 | initial_search_done_details_pending | c027 | 12 |
| 北京智谱华章科技股份有限公司 | 待核 | initial_search_done_details_pending | c028 | 16 |
| 北京中科慧灵机器人技术有限公司 | 机器人与智能硬件 | initial_search_done_details_pending | c029 | 16 |
| 北京紫光云技术有限公司 | 待核 | initial_search_done_details_pending | c030 | 14 |
| 参数技术 | 汽车与智能出行数字化 | initial_search_done_details_pending | c031 | 15 |
| 成都华邻科技有限公司 | 待核 | initial_search_done_details_pending | c032 | 14 |
| 成都乾视智能科技有限公司 | 待核 | initial_search_done_details_pending | c033 | 13 |
| 成都知否瑞达科技有限公司 | 待核 | initial_search_done_details_pending | c034 | 12 |
| 重庆忽米网络科技有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c035 | 17 |
| 重庆中科云从科技有限公司 | 云、算力与AI基础设施 | initial_search_done_details_pending | c036 | 15 |
| 滴滴出行 | 待核 | initial_search_done_details_pending | c037 | 15 |
| 滴普科技股份有限公司 | AI企业应用 | initial_search_done_details_pending | c038 | 13 |
| 第四范式 | 待核 | initial_search_done_details_pending | c002 | 14 |
| 第四范式(北京)技术有限公司 | 待核 | initial_search_done_details_pending | c002 | 14 |
| 鼎捷数智 | 待核 | initial_search_done_details_pending | c041 | 19 |
| 东风汽车 | 待核 | initial_search_done_details_pending | c042 | 13 |
| 东华软件 | 待核 | initial_search_done_details_pending | c043 | 13 |
| 东华软件股份公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c044 | 15 |
| 东软集团股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c045 | 14 |
| 动鑫科技 | 企业软件 / SaaS | initial_search_done_details_pending | c046 | 11 |
| 法本信息 | 待核 | initial_search_done_details_pending | c047 | 16 |
| 帆软 | 待核 | initial_search_done_details_pending | c048 | 12 |
| 飞轮科技 | 实时数据仓库技术 | initial_search_done_details_pending | c049 | 15 |
| 飞轮科技（SelectDB） | 数据与AI开发平台 | initial_search_done_details_pending | c050 | 17 |
| 非与智能 | AI企业应用 | initial_search_done_details_pending | c051 | 6 |
| 纷享销客 | 企业软件与营销数字化 | initial_search_done_details_pending | c052 | 11 |
| 扶瑶智能科技(天津)有限公司 | 待核 | initial_search_done_details_pending | c053 | 12 |
| 傅利叶智能 | 机器人与智能硬件 | initial_search_done_details_pending | c054 | 13 |
| 富士康工业互联网股份有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c055 | 12 |
| 高科数聚 | 汽车与智能出行数字化 | initial_search_done_details_pending | c056 | 14 |
| 高擎 | 机器人与智能硬件 | initial_search_done_details_pending | c057 | 14 |
| 勾正科技 | 数据与AI开发平台 | initial_search_done_details_pending | c058 | 12 |
| 谷斗科技 | 汽车与智能出行数字化 | initial_search_done_details_pending | c059 | 14 |
| 观远数据 | 待核 | initial_search_done_details_pending | c060 | 12 |
| 光环云数据有限公司 | 待核 | initial_search_done_details_pending | c061 | 13 |
| 广东创云科技有限公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c062 | 13 |
| 广东鲸翌智能设备有限公司 | 待核 | initial_search_done_details_pending | c063 | 12 |
| 广域铭岛 | 汽车与智能出行数字化 | initial_search_done_details_pending | c064 | 12 |
| 广州今宏信息科技有限公司 | 待核 | initial_search_done_details_pending | c065 | 16 |
| 硅云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c066 | 14 |
| 贵州万联易达科技有限公司 | 待核 | initial_search_done_details_pending | c067 | 10 |
| 海尔集团 | 企业软件与营销数字化 | initial_search_done_details_pending | c068 | 16 |
| 海尔卡奥斯物联生态科技有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c069 | 9 |
| 海康机器人 | 待核 | initial_search_done_details_pending | c070 | 16 |
| 海康威视 | 机器人与智能硬件 | initial_search_done_details_pending | c071 | 13 |
| 海信集团控股股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c072 | 11 |
| 杭州海康威视数字技术股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c073 | 15 |
| 杭州深度求索人工智能基础技术研究有限公司 | 待核 | initial_search_done_details_pending | c074 | 15 |
| 杭州正马软件科技有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c075 | 8 |
| 杭州智思达科技有限责任公司 | AI企业应用 | initial_search_done_details_pending | c076 | 12 |
| 航天信息股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c077 | 13 |
| 航天云网科技发展有限责任公司 | 制造与工业智能化 | initial_search_done_details_pending | c078 | 12 |
| 和利时集团 | 待核 | initial_search_done_details_pending | c079 | 8 |
| 河北申联汽车服务集团有限公司 | 待核 | initial_search_done_details_pending | c080 | 12 |
| 河南卿云信息技术有限公司 | 待核 | initial_search_done_details_pending | c081 | 9 |
| 河南天之悦实业有限公司 | 待核 | initial_search_done_details_pending | c082 | 13 |
| 恒创科技 | 云、算力与AI基础设施 | initial_search_done_details_pending | c083 | 13 |
| 宏工科技股份有限公司 | 待核 | initial_search_done_details_pending | c084 | 17 |
| 湖南中项网科技有限公司 | 互联网与企业服务 | initial_search_done_details_pending | c085 | 14 |
| 华测检测 | 待核 | initial_search_done_details_pending | c086 | 11 |
| 华纳云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c087 | 10 |
| 华天软件 | 智能制造软件 | initial_search_done_details_pending | c088 | 13 |
| 华为技术有限公司 | 企业软件与营销数字化 / 企业软件与营销数字化、制造与工业智能化 / 制造与工业智能化 | initial_search_done_details_pending | c089 | 14 |
| 华为云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c090 | 17 |
| 华为终端有限公司 | 待核 | initial_search_done_details_pending | c091 | 9 |
| 欢聚集团 | 待核 | initial_search_done_details_pending | c092 | 14 |
| 辉瑞中国 | 待核 | initial_search_done_details_pending | c093 | 13 |
| 汇川技术 | 待核 | initial_search_done_details_pending | c094 | 12 |
| 慧策/掌上先机 | 待核 | initial_search_done_details_pending | c095 | 9 |
| 慧策/旺店通(掌上先机) | 企业软件与营销数字化 | initial_search_done_details_pending | c096 | 12 |
| 火山引擎 | 待核 | initial_search_done_details_pending | c097 | 13 |
| 货拉拉 | 待核 | initial_search_done_details_pending | c098 | 15 |
| 极限科技 | 数据与AI开发平台 | initial_search_done_details_pending | c099 | 13 |
| 寄云科技 | 待核 | initial_search_done_details_pending | c100 | 15 |
| 加速进化 | 机器人与智能硬件 | initial_search_done_details_pending | c101 | 13 |
| 简道云 | 待核 | initial_search_done_details_pending | c102 | 12 |
| 江苏百信数字认证有限公司 | AI企业应用 | initial_search_done_details_pending | c103 | 12 |
| 江苏动铁教育科技集团有限公司 | 待核 | initial_search_done_details_pending | c104 | 8 |
| 江苏亨通数字智能科技有限公司 | 待核 | initial_search_done_details_pending | c105 | 17 |
| 金蝶 | 待核 | initial_search_done_details_pending | c106 | 15 |
| 金千枝(深圳)软件技术有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c107 | 13 |
| 金山云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c108 | 12 |
| 京东 | AI企业应用 / 云、算力与AI基础设施 | initial_search_done_details_pending | c109 | 12 |
| 京东集团股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c110 | 14 |
| 京东科技信息技术有限公司 | 云、算力与AI基础设施 | initial_search_done_details_pending | c111 | 10 |
| 京东商城 | 待核 | initial_search_done_details_pending | c112 | 12 |
| 京东物流 | 待核 | initial_search_done_details_pending | c113 | 12 |
| 京东云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c114 | 11 |
| 科大讯飞 | 待核 | initial_search_done_details_pending | c115 | 13 |
| 科大讯飞股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c115 | 13 |
| 来也科技 | 待核 | initial_search_done_details_pending | c117 | 14 |
| 岚图汽车 | 待核 | initial_search_done_details_pending | c118 | 12 |
| 蓝星智云(山东)智能科技有限公司 | 待核 | initial_search_done_details_pending | c119 | 16 |
| 朗矽科技 | 半导体 / AI算力器件 | initial_search_done_details_pending | c120 | 14 |
| 浪潮工业互联网股份有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c121 | 14 |
| 浪潮集团 | 待核 | initial_search_done_details_pending | c122 | 12 |
| 浪潮集团有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c123 | 13 |
| 浪潮云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c124 | 8 |
| 浪潮云信息技术股份公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c125 | 12 |
| 利真汽车 | 待核 | initial_search_done_details_pending | c126 | 14 |
| 联通数字科技有限公司 | 云、算力与AI基础设施 | initial_search_done_details_pending | c127 | 15 |
| 联想懂的通信 | 待核 | initial_search_done_details_pending | c128 | 15 |
| 联友 | 待核 | initial_search_done_details_pending | c129 | 13 |
| 联友科技 | 汽车与智能出行数字化 | initial_search_done_details_pending | c130 | 12 |
| 猎豹移动 | 互联网与企业服务 | initial_search_done_details_pending | c131 | 16 |
| 领充新能源 | 智能硬件与汽车数字化 | initial_search_done_details_pending | c132 | 9 |
| 蚂蚁集团 | 待核 | initial_search_done_details_pending | c133 | 12 |
| 美林数据技术股份有限公司 | 待核 | initial_search_done_details_pending | c134 | 12 |
| 美团 | 待核 | initial_search_done_details_pending | c135 | 17 |
| 妙蛙 GEO | AI 搜索/GEO | initial_search_done_details_pending | c136 | 12 |
| 明珞装备 | 汽车与智能出行数字化 | initial_search_done_details_pending | c137 | 15 |
| 明源云 | 待核 | initial_search_done_details_pending | c138 | 13 |
| 魔法原子 | 机器人与智能硬件 | initial_search_done_details_pending | c139 | 13 |
| 某广州大型人工智能公司 | 待核 | identity_pending | 身份待核 | 0 |
| 某广州大型整车制造公司 | 待核 | identity_pending | 身份待核 | 0 |
| 某杭州互联网上市公司 | 待核 | identity_pending | 身份待核 | 0 |
| 某上海人力资源服务公司 | 待核 | identity_pending | 身份待核 | 0 |
| 某上海仪器仪表公司 | 待核 | identity_pending | 身份待核 | 0 |
| 某深圳互联网上市公司 | 待核 | identity_pending | 身份待核 | 0 |
| 某IT服务公司 | 待核 | identity_pending | 身份待核 | 0 |
| 南京大数据集团有限公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c147 | 13 |
| 南京国睿信维软件有限公司 | 待核 | initial_search_done_details_pending | c148 | 16 |
| 南京深度智控科技有限公司 | 待核 | initial_search_done_details_pending | c149 | 15 |
| 南瑞集团有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c150 | 12 |
| 宁波均胜电子股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c151 | 15 |
| 牛客科技 | 企业软件与营销数字化 | initial_search_done_details_pending | c152 | 14 |
| 七牛云 | 待核 | initial_search_done_details_pending | c153 | 16 |
| 启境汽车 | 待核 | initial_search_done_details_pending | c154 | 15 |
| 启明信息 | 汽车与智能出行数字化 | initial_search_done_details_pending | c155 | 13 |
| 强生(中国)投资有限公司 | 待核 | initial_search_done_details_pending | c156 | 13 |
| 秦淮数据中心 | 云、算力与AI基础设施 | initial_search_done_details_pending | c157 | 16 |
| 青云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c158 | 16 |
| 青云QingCloud | 云、算力与AI基础设施 | initial_search_done_details_pending | c159 | 15 |
| 清研讯科 | 汽车与智能出行数字化 | initial_search_done_details_pending | c160 | 10 |
| 擎翌(上海)智能科技有限公司 | 待核 | initial_search_done_details_pending | c161 | 14 |
| 容联云 | 待核 | initial_search_done_details_pending | c162 | 14 |
| 软通动力信息技术(集团)股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c163 | 10 |
| 软通动力信息技术（集团）股份有限公司 | 待核 | initial_search_done_details_pending | c163 | 10 |
| 瑞蓝创 | 数据与AI开发平台 | initial_search_done_details_pending | c165 | 18 |
| 赛意信息 | 待核 | initial_search_done_details_pending | c166 | 14 |
| 厦门赛西科技发展有限责任公司 | 待核 | initial_search_done_details_pending | c167 | 12 |
| 山东极视角科技股份有限公司 | AI企业应用 | initial_search_done_details_pending | c168 | 16 |
| 商车云(北京)科技有限公司 | 待核 | initial_search_done_details_pending | c169 | 13 |
| 商汤 | 待核 | initial_search_done_details_pending | c170 | 16 |
| 上海宝信软件股份有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c171 | 17 |
| 上海颉纶科技软件有限公司 | 待核 | initial_search_done_details_pending | c172 | 5 |
| 上海猫小鼬信息科技有限公司 | 待核 | initial_search_done_details_pending | c173 | 12 |
| 上海蜜度科技股份有限公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c174 | 9 |
| 上海佩琪集团 | 待核 | initial_search_done_details_pending | c175 | 13 |
| 上海沁灿信息技术有限公司 | 待核 | initial_search_done_details_pending | c176 | 10 |
| 上海天天软件股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c177 | 10 |
| 上海曦智科技股份有限公司 | AI企业应用 | initial_search_done_details_pending | c178 | 16 |
| 上海原圈网络科技有限公司 | 待核 | initial_search_done_details_pending | c179 | 16 |
| 尚品宅配集团 | 待核 | initial_search_done_details_pending | c180 | 8 |
| 深度求索 | 待核 | initial_search_done_details_pending | c074 | 15 |
| 深圳胖柴点书科技有限公司广州分公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c182 | 2 |
| 深圳市腾讯计算机系统有限公司 | 企业软件与营销数字化 / 企业软件与营销数字化、制造与工业智能化 / 制造与工业智能化 | initial_search_done_details_pending | c183 | 9 |
| 神策数据 | 企业软件与营销数字化 | initial_search_done_details_pending | c184 | 14 |
| 神州数码 | 待核 | initial_search_done_details_pending | c185 | 11 |
| 神州数码集团股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c186 | 12 |
| 神州万利科技集团有限公司 | 待核 | initial_search_done_details_pending | c187 | 15 |
| 声网 | 待核 | initial_search_done_details_pending | c188 | 12 |
| 时代亿信 | 待核 | initial_search_done_details_pending | c189 | 11 |
| 实在智能 | 待核 | initial_search_done_details_pending | c190 | 12 |
| 世纪互联数据中心 | 云、算力与AI基础设施 | initial_search_done_details_pending | c191 | 15 |
| 首汽租车 | 待核 | initial_search_done_details_pending | c192 | 13 |
| 曙光信息 | 待核 | initial_search_done_details_pending | c193 | 12 |
| 树根互联股份有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c194 | 15 |
| 思特奇 | 数据与AI开发平台 | initial_search_done_details_pending | c195 | 10 |
| 四川具身人形机器人科技有限公司 | 机器人与智能硬件 | initial_search_done_details_pending | c196 | 12 |
| 四川长征车业集团有限公司 | 待核 | initial_search_done_details_pending | c197 | 12 |
| 四川中城智建系统集成科技有限公司 | 待核 | initial_search_done_details_pending | c198 | 14 |
| 松延动力 | 机器人与智能硬件 | initial_search_done_details_pending | c199 | 9 |
| 太极计算机股份有限公司 | 数据与AI开发平台 | initial_search_done_details_pending | c200 | 12 |
| 钛动科技 | AI应用 / 营销科技 | initial_search_done_details_pending | c201 | 13 |
| 探迹科技 | AI企业应用 | initial_search_done_details_pending | c202 | 10 |
| 特斯拉中国 | 待核 | initial_search_done_details_pending | c203 | 18 |
| 腾讯云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c204 | 12 |
| 腾讯云计算 | 待核 | initial_search_done_details_pending | c204 | 12 |
| 天津艾迪智绘网络科技有限公司 | 待核 | initial_search_done_details_pending | c206 | 9 |
| 天津思必得科技有限公司 / 妙蛙GEO | AI应用 / GEO与企业增长 / AI应用 / GEO营销 | initial_search_done_details_pending | c207 | 9 |
| 天津万联易达科技有限公司 | 待核 | initial_search_done_details_pending | c208 | 16 |
| 天翼云科技有限公司 | 云、算力与AI基础设施 / 云、算力与AI基础设施、基础大模型与开放平台 / 基础大模型与开放平台 | initial_search_done_details_pending | c209 | 12 |
| 万国数据中心 | 云、算力与AI基础设施 | initial_search_done_details_pending | c210 | 11 |
| 网易(杭州)网络有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c211 | 7 |
| 网易（杭州）网络有限公司 | 待核 | initial_search_done_details_pending | c211 | 7 |
| 网易数帆 | 待核 | initial_search_done_details_pending | c213 | 13 |
| 网易智企 | AI企业应用 | initial_search_done_details_pending | c214 | 11 |
| 未来不远 | 机器人与智能硬件 | initial_search_done_details_pending | c215 | 15 |
| 沃丰科技 | AI企业应用 | initial_search_done_details_pending | c216 | 15 |
| 武汉亿量科技有限公司 | 待核 | initial_search_done_details_pending | c217 | 18 |
| 物自体(上海)科技有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c218 | 12 |
| 物自体（上海）科技有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c218 | 12 |
| 稀宇科技 | 待核 | initial_search_done_details_pending | c220 | 15 |
| 先进数通 | 待核 | initial_search_done_details_pending | c221 | 13 |
| 销售易 | 待核 | initial_search_done_details_pending | c222 | 12 |
| 小米集团 | 企业软件与营销数字化 | initial_search_done_details_pending | c223 | 14 |
| 小鹏集团 | 待核 | initial_search_done_details_pending | c224 | 14 |
| 小鹏汽车 | 待核 | initial_search_done_details_pending | c225 | 12 |
| 欣旺达动力科技股份有限公司 | 待核 | initial_search_done_details_pending | c226 | 16 |
| 新华三技术有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c227 | 13 |
| 徐工汉云技术股份有限公司 | 制造与工业智能化 | initial_search_done_details_pending | c228 | 16 |
| 讯飞 | 待核 | initial_search_done_details_pending | c115 | 13 |
| 亚马逊 | 待核 | initial_search_done_details_pending | c230 | 17 |
| 亚马逊云科技 | 云、算力与AI基础设施 | initial_search_done_details_pending | c231 | 13 |
| 仪电双杨智能科技(上海)有限公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c232 | 13 |
| 仪电双杨智能科技（上海）有限公司 | 待核 | initial_search_done_details_pending | c232 | 13 |
| 亿速云 | 云、算力与AI基础设施 | initial_search_done_details_pending | c234 | 14 |
| 影刀 | 待核 | initial_search_done_details_pending | c235 | 16 |
| 用友 | 待核 | initial_search_done_details_pending | c236 | 14 |
| 用友网络科技股份有限公司 | 企业软件与营销数字化 / 企业软件与营销数字化、制造与工业智能化 / 制造与工业智能化 | initial_search_done_details_pending | c237 | 13 |
| 优必选 | 待核 | initial_search_done_details_pending | c238 | 10 |
| 优刻得 | 云、算力与AI基础设施 | initial_search_done_details_pending | c239 | 12 |
| 宇树科技 | 机器人与智能硬件 | initial_search_done_details_pending | c240 | 14 |
| 驭势科技(北京)股份有限公司 | AI企业应用 | initial_search_done_details_pending | c241 | 16 |
| 驭势科技（北京）股份有限公司 | 待核 | initial_search_done_details_pending | c241 | 16 |
| 原圈科技 | 待核 | initial_search_done_details_pending | c243 | 13 |
| 远海国际旅游集团 | 待核 | initial_search_done_details_pending | c244 | 7 |
| 月之暗面 | AI基础模型 / 商业化与生态 / AI基础模型 / 商业化生态 | initial_search_done_details_pending | c245 | 17 |
| 月之暗面（同名异主体，待核） | 待核 | initial_search_done_details_pending | c246 | 9 |
| 月之暗面科技 | 待核 | initial_search_done_details_pending | c245 | 17 |
| 长城智选信息科技(保定)有限公司 | 待核 | initial_search_done_details_pending | c248 | 9 |
| 浙江大华技术股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c249 | 13 |
| 浙江蓝卓工业互联网信息技术有限 公司 | 制造与工业智能化 | initial_search_done_details_pending | c250 | 6 |
| 浙江强脑科技有限公司 | AI企业应用 | initial_search_done_details_pending | c251 | 15 |
| 浙江涛涛车业股份有限公司 | 待核 | initial_search_done_details_pending | c252 | 16 |
| 正航软件 | 企业管理/工业软件 | initial_search_done_details_pending | c253 | 13 |
| 智慧芽 | 待核 | initial_search_done_details_pending | c254 | 14 |
| 智马达汽车有限公司 | 待核 | initial_search_done_details_pending | c255 | 9 |
| 智谱 | 待核 | initial_search_done_details_pending | c028 | 16 |
| 智谱ai | 待核 | initial_search_done_details_pending | c028 | 16 |
| 智芯半导体 | 待核 | initial_search_done_details_pending | c258 | 16 |
| 智元创新 | 机器人与智能硬件 | initial_search_done_details_pending | c259 | 14 |
| 中电科数字技术股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c260 | 14 |
| 中电信数政科技有限公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c261 | 13 |
| 中电信数智科技有限公司新疆分公司 | 待核 | initial_search_done_details_pending | c262 | 17 |
| 中国联合网络通信有限公司北京市分公司 | 云、算力与AI基础设施 | initial_search_done_details_pending | c263 | 13 |
| 中国移动通信集团有限公司 | 数据与AI开发平台 | initial_search_done_details_pending | c264 | 13 |
| 中国移动信息技术有限公司 | 基础大模型与开放平台 | initial_search_done_details_pending | c265 | 17 |
| 中化数智科技有限公司 | 待核 | initial_search_done_details_pending | c266 | 14 |
| 中科创达 | 待核 | initial_search_done_details_pending | c267 | 13 |
| 中科软 | 汽车与智能出行数字化 | initial_search_done_details_pending | c268 | 10 |
| 中科斯欧(合肥)科技股份有限公司 | 待核 | initial_search_done_details_pending | c269 | 14 |
| 中企动力 | 企业软件与营销数字化 | initial_search_done_details_pending | c270 | 12 |
| 中汽工程 | 汽车与智能出行数字化 | initial_search_done_details_pending | c271 | 14 |
| 中软国际 | 待核 | initial_search_done_details_pending | c272 | 12 |
| 中软国际有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c273 | 16 |
| 中通服和信科技有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c274 | 16 |
| 中兴通讯股份有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c275 | 14 |
| 中移(苏州)软件技术有限公司 | 云、算力与AI基础设施 | initial_search_done_details_pending | c276 | 18 |
| 中移（苏州）软件技术有限公司 | 待核 | initial_search_done_details_pending | c276 | 18 |
| 中移物联网有限公司 | 企业软件与营销数字化 | initial_search_done_details_pending | c278 | 13 |
| 字节跳动 | 互联网 / 汽车本地生活 / 互联网商业化 / 汽车本地生活 | initial_search_done_details_pending | c279 | 16 |
| 字节跳动/飞书商业化 | 待核 | initial_search_done_details_pending | c280 | 10 |
| 字节跳动火山引擎 | 待核 | initial_search_done_details_pending | c097 | 13 |
| Adjust (an AppLovin company) | 营销科技（AdTech） | initial_search_done_details_pending | c282 | 16 |
| ADXJ 蓝鲸出海 | 互联网商业服务 | initial_search_done_details_pending | c283 | 4 |
| ADXJ蓝鲸出海 | 待核 | initial_search_done_details_pending | c284 | 4 |
| AI Squared | AI企业应用与数据分析 | initial_search_done_details_pending | c285 | 16 |
| Airwallex | 全球支付与金融平台 | initial_search_done_details_pending | c286 | 29 |
| alibaba cloud | 待核 | initial_search_done_details_pending | c005 | 16 |
| Aliyun | 待核 | initial_search_done_details_pending | c288 | 15 |
| Amazon Information Service (Beijing) Co., Ltd. (Shanghai Branch) | 云、算力与AI基础设施 | initial_search_done_details_pending | c289 | 14 |
| Amazon Web Services | 待核 | initial_search_done_details_pending | c290 | 16 |
| APUS | 企业软件与营销数字化 | initial_search_done_details_pending | c291 | 16 |
| Cloudflare | 云、算力与AI基础设施 | initial_search_done_details_pending | c292 | 30 |
| DeepSeek | 待核 | initial_search_done_details_pending | c074 | 15 |
| Digit Robotics | 机器人与智能硬件 | initial_search_done_details_pending | c294 | 14 |
| Figma | 企业软件与协作工具 | initial_search_done_details_pending | c295 | 16 |
| GrowingIO | 待核 | initial_search_done_details_pending | c296 | 16 |
| iflytek | 待核 | initial_search_done_details_pending | c115 | 13 |
| kimi | 待核 | initial_search_done_details_pending | c245 | 17 |
| Microsoft | 云、算力与AI基础设施 | initial_search_done_details_pending | c299 | 20 |
| MiniMax | AI基础模型 / MaaS技术销售 | initial_search_done_details_pending | c220 | 15 |
| moonshot ai | 待核 | initial_search_done_details_pending | c245 | 17 |
| Noumena | AI企业应用 | initial_search_done_details_pending | c302 | 12 |
| Noumena（物自体） | AI 科技公司 | initial_search_done_details_pending | c303 | 14 |
| Salesforce | 待核 | initial_search_done_details_pending | c304 | 15 |
| Shoplazza | 待核 | initial_search_done_details_pending | c305 | 17 |
| SparkX 邑炎科技 | 企业软件与营销数字化 | initial_search_done_details_pending | c306 | 13 |
| tencent cloud | 待核 | initial_search_done_details_pending | c204 | 12 |
| volcengine | 待核 | initial_search_done_details_pending | c097 | 13 |
| YMatrix | 数据库/实时分析数仓 | initial_search_done_details_pending | c309 | 13 |
| Z.ai | 待核 | initial_search_done_details_pending | c028 | 16 |
| zhipu ai | 待核 | initial_search_done_details_pending | c028 | 16 |
| Zilliz | 待核 | initial_search_done_details_pending | c312 | 16 |
