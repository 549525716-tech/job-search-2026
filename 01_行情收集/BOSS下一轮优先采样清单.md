# BOSS下一轮优先采样清单

更新时间：2026-07-01 02:09:27 Asia/Shanghai

## 一、本质判断

这份清单不是自动采集任务，而是把 189 条人工采样任务压缩成下一轮优先动作。它解决的问题是：在 BOSS 风控恢复期，先把最能补足“大而全”调研缺口的公司和岗位看完。

## 二、生成规则

综合四类信号排序：

1. BOSS人工采样任务优先级。
2. 公司机会地图里的公司机会分。
3. 公开趋势信号看板里的 P0 证据。
4. 薪资能力矩阵里的薪资证据和样本缺口。

本脚本只生成 BOSS 首页、站内搜索关键词和导入命令，不打开 BOSS 页面，不读取网页。

## 三、本轮覆盖

| 赛道 | 任务数 | 优先公司 | 岗位词 |
| --- | ---: | --- | --- |
| 基座大模型/Agent平台 | 3 | 商汤科技、月之暗面、智谱AI | 解决方案顾问 |
| AI服务器/智算基础设施 | 3 | 超聚变 | 大客户销售、行业销售、售前 |
| AI芯片/GPU/加速卡 | 3 | 海光信息、寒武纪 | 大客户销售、渠道销售 |
| 智能客服/营销/销售AI | 3 | 百应科技、七陌、容联云 | SaaS销售 |
| 云计算/大模型平台 | 3 | 百度智能云、华为云、火山引擎 | AI销售 |
| AI Agent/RPA/流程自动化 | 3 | 合合信息、来也科技 | 大客户销售、售前 |
| 数据/MLOps/AI基础软件 | 2 | 第四范式 | 大客户销售、解决方案顾问 |
| AI安全/私有化/信创 | 2 | 奇安信、深信服 | 大客户销售 |
| 工业AI/智能制造 | 2 | 创新奇智 | 大客户销售、销售经理 |
| 智算中心/数据中心服务 | 2 | 世纪互联 | 大客户销售、渠道销售 |
| 智能汽车/机器人/具身智能 | 2 | 地平线 | 渠道销售、销售经理 |
| AI视觉/安防/质检 | 2 | 大华股份 | 行业销售、渠道销售 |

## 四、优先采样任务

| 排名 | 分数 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资观察 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 338 | P0 | 基座大模型/Agent平台 | 商汤科技 | 解决方案顾问 | 8K-12K | https://www.zhipin.com/ | `商汤科技 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 解决方案顾问" --company "商汤科技" --role "解决方案顾问" --city "广州"` |
| 2 | 293 | P0 | AI服务器/智算基础设施 | 超聚变 | 大客户销售 | 20K-35K | https://www.zhipin.com/ | `超聚变 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 大客户销售" --company "超聚变" --role "大客户销售" --city "广州"` |
| 3 | 291 | P0 | AI芯片/GPU/加速卡 | 海光信息 | 大客户销售 | 40K-70K | https://www.zhipin.com/ | `海光信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 大客户销售" --company "海光信息" --role "大客户销售" --city "广州"` |
| 4 | 269 | P0 | 智能客服/营销/销售AI | 百应科技 | SaaS销售 | 8K-13K | https://www.zhipin.com/ | `百应科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 SaaS销售" --company "百应科技" --role "SaaS销售" --city "广州"` |
| 5 | 268 | P0 | 云计算/大模型平台 | 百度智能云 | AI销售 | 30K-60K | https://www.zhipin.com/ | `百度智能云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 AI销售" --company "百度智能云" --role "AI销售" --city "广州"` |
| 6 | 222 | P1 | AI Agent/RPA/流程自动化 | 合合信息 | 大客户销售 | 25K-45K | https://www.zhipin.com/ | `合合信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 大客户销售" --company "合合信息" --role "大客户销售" --city "广州"` |
| 7 | 221 | P1 | 数据/MLOps/AI基础软件 | 第四范式 | 大客户销售 | 30K-60K | https://www.zhipin.com/ | `第四范式 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 大客户销售" --company "第四范式" --role "大客户销售" --city "广州"` |
| 8 | 220 | P1 | AI安全/私有化/信创 | 奇安信 | 大客户销售 | 20K-50K | https://www.zhipin.com/ | `奇安信 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "奇安信 大客户销售" --company "奇安信" --role "大客户销售" --city "广州"` |
| 9 | 194 | P1 | 工业AI/智能制造 | 创新奇智 | 大客户销售 | 15K-60K | https://www.zhipin.com/ | `创新奇智 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 大客户销售" --company "创新奇智" --role "大客户销售" --city "广州"` |
| 10 | 192 | P2 | 智算中心/数据中心服务 | 世纪互联 | 大客户销售 | 20K-50K | https://www.zhipin.com/ | `世纪互联 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 大客户销售" --company "世纪互联" --role "大客户销售" --city "广州"` |
| 11 | 188 | P1 | 智能汽车/机器人/具身智能 | 地平线 | 渠道销售 | 40K-70K | https://www.zhipin.com/ | `地平线 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 渠道销售" --company "地平线" --role "渠道销售" --city "广州"` |
| 12 | 138 | P2 | AI视觉/安防/质检 | 大华股份 | 行业销售 | 15K-30K | https://www.zhipin.com/ | `大华股份 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 行业销售" --company "大华股份" --role "行业销售" --city "广州"` |
| 13 | 338 | P0 | 基座大模型/Agent平台 | 月之暗面 | 解决方案顾问 | 8K-12K | https://www.zhipin.com/ | `月之暗面 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 解决方案顾问" --company "月之暗面" --role "解决方案顾问" --city "广州"` |
| 14 | 293 | P0 | AI服务器/智算基础设施 | 超聚变 | 行业销售 | 20K-35K | https://www.zhipin.com/ | `超聚变 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 行业销售" --company "超聚变" --role "行业销售" --city "广州"` |
| 15 | 291 | P0 | AI芯片/GPU/加速卡 | 海光信息 | 渠道销售 | 40K-70K | https://www.zhipin.com/ | `海光信息 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 渠道销售" --company "海光信息" --role "渠道销售" --city "广州"` |
| 16 | 269 | P0 | 智能客服/营销/销售AI | 七陌 | SaaS销售 | 8K-13K | https://www.zhipin.com/ | `七陌 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 SaaS销售" --company "七陌" --role "SaaS销售" --city "广州"` |
| 17 | 268 | P0 | 云计算/大模型平台 | 华为云 | AI销售 | 30K-60K | https://www.zhipin.com/ | `华为云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 AI销售" --company "华为云" --role "AI销售" --city "广州"` |
| 18 | 222 | P1 | AI Agent/RPA/流程自动化 | 合合信息 | 售前 | 15K-20K | https://www.zhipin.com/ | `合合信息 售前` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 售前" --company "合合信息" --role "售前" --city "广州"` |
| 19 | 221 | P1 | 数据/MLOps/AI基础软件 | 第四范式 | 解决方案顾问 | 30K-60K | https://www.zhipin.com/ | `第四范式 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 解决方案顾问" --company "第四范式" --role "解决方案顾问" --city "广州"` |
| 20 | 220 | P1 | AI安全/私有化/信创 | 深信服 | 大客户销售 | 20K-50K | https://www.zhipin.com/ | `深信服 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "深信服 大客户销售" --company "深信服" --role "大客户销售" --city "广州"` |
| 21 | 194 | P1 | 工业AI/智能制造 | 创新奇智 | 销售经理 | 15K-60K | https://www.zhipin.com/ | `创新奇智 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 销售经理" --company "创新奇智" --role "销售经理" --city "广州"` |
| 22 | 192 | P2 | 智算中心/数据中心服务 | 世纪互联 | 渠道销售 | 20K-50K | https://www.zhipin.com/ | `世纪互联 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 渠道销售" --company "世纪互联" --role "渠道销售" --city "广州"` |
| 23 | 188 | P1 | 智能汽车/机器人/具身智能 | 地平线 | 销售经理 | 40K-70K | https://www.zhipin.com/ | `地平线 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 销售经理" --company "地平线" --role "销售经理" --city "广州"` |
| 24 | 138 | P2 | AI视觉/安防/质检 | 大华股份 | 渠道销售 | 15K-30K | https://www.zhipin.com/ | `大华股份 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 渠道销售" --company "大华股份" --role "渠道销售" --city "广州"` |
| 25 | 338 | P0 | 基座大模型/Agent平台 | 智谱AI | 解决方案顾问 | 8K-12K | https://www.zhipin.com/ | `智谱AI 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI 解决方案顾问" --company "智谱AI" --role "解决方案顾问" --city "广州"` |
| 26 | 293 | P0 | AI服务器/智算基础设施 | 超聚变 | 售前 | 20K-35K | https://www.zhipin.com/ | `超聚变 售前` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 售前" --company "超聚变" --role "售前" --city "广州"` |
| 27 | 291 | P0 | AI芯片/GPU/加速卡 | 寒武纪 | 大客户销售 | 40K-70K | https://www.zhipin.com/ | `寒武纪 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "寒武纪 大客户销售" --company "寒武纪" --role "大客户销售" --city "广州"` |
| 28 | 269 | P0 | 智能客服/营销/销售AI | 容联云 | SaaS销售 | 8K-13K | https://www.zhipin.com/ | `容联云 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 SaaS销售" --company "容联云" --role "SaaS销售" --city "广州"` |
| 29 | 268 | P0 | 云计算/大模型平台 | 火山引擎 | AI销售 | 30K-60K | https://www.zhipin.com/ | `火山引擎 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 AI销售" --company "火山引擎" --role "AI销售" --city "广州"` |
| 30 | 222 | P1 | AI Agent/RPA/流程自动化 | 来也科技 | 大客户销售 | 25K-45K | https://www.zhipin.com/ | `来也科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "来也科技 大客户销售" --company "来也科技" --role "大客户销售" --city "广州"` |

## 五、执行方式

1. 每次只处理 1 个站内搜索关键词，人工判断是否有真实相关岗位。
2. 复制岗位详情页文本后，执行对应导入命令。
3. 每导入 5 到 10 条后运行：

```bash
npm run sampling:status
npm run salary:signals
npm run matrix:roles
npm run gap:resume
npm run report:full
npm run audit:research
```

## 六、文件

```text
/Users/MR/Documents/职场/01_行情收集/BOSS下一轮优先采样清单.csv
```
