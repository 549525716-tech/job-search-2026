# BOSS人工补样工作台

更新时间：2026-07-01 01:34:47 Asia/Shanghai

## 一、本质判断

这个工作台不是新增一批自动采集任务，而是把“样本缺口、下一轮优先队列、人工采样包、公司类型打法”合并成一个人工执行界面。当前 BOSS 处于风控恢复期，正确动作是：先打开 BOSS 首页、站内搜索关键词、人工判断岗位相关性、复制岗位卡片或详情页、用 `import:manual` 导入。

当前最大的矛盾是：既要尽快补齐 BOSS 大样本，又不能再让脚本替你打开、刷新或跳转 BOSS 页面。

## 二、执行总览

| 指标 | 数值 |
| --- | ---: |
| 本轮工作台任务 | 30 |
| 覆盖路线 | 3 |
| 覆盖赛道 | 12 |
| P0任务 | 15 |
| P1任务 | 11 |
| P2任务 | 4 |
| 全行业目标样本 | 126 |
| 当前样本缺口 | 122 |

## 三、路线级补样压力

| 路线 | 赛道数 | 样本进度 | 样本缺口 | 本轮任务 | 本轮先做 |
| --- | ---: | ---: | ---: | ---: | --- |
| AI软件落地路线 | 5 | 4/56 | 52 | 14 | 商汤科技/解决方案顾问；百应科技/SaaS销售；百度智能云/AI销售；合合信息/大客户销售；第四范式/大客户销售 |
| 硬件/算力/半导体路线 | 3 | 0/32 | 32 | 8 | 超聚变/大客户销售；海光信息/大客户销售；世纪互联/大客户销售；超聚变/行业销售；海光信息/渠道销售 |
| 行业解决方案路线 | 4 | 0/38 | 38 | 8 | 奇安信/大客户销售；创新奇智/大客户销售；地平线/渠道销售；大华股份/行业销售；深信服/大客户销售 |

## 四、赛道级验收

| 优先级 | 路线 | 赛道 | 样本进度 | 缺口 | 本轮任务 | 先做任务 | 结论权限 |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| P0 | AI软件落地路线 | 基座大模型/Agent平台 | 0/12 | 12 | 3 | 商汤科技/解决方案顾问；月之暗面/解决方案顾问；智谱AI/解决方案顾问 | 不能下BOSS结论 |
| P0 | AI软件落地路线 | 智能客服/营销/销售AI | 0/12 | 12 | 3 | 百应科技/SaaS销售；七陌/SaaS销售；容联云/SaaS销售 | 不能下BOSS结论 |
| P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 0/12 | 12 | 3 | 超聚变/大客户销售；超聚变/行业销售；超聚变/售前 | 不能下BOSS结论 |
| P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 0/12 | 12 | 3 | 海光信息/大客户销售；海光信息/渠道销售；寒武纪/大客户销售 | 不能下BOSS结论 |
| P0 | AI软件落地路线 | 云计算/大模型平台 | 4/12 | 8 | 3 | 百度智能云/AI销售；华为云/AI销售；火山引擎/AI销售 | 可写方向性观察，不能写薪资结论 |
| P1 | 行业解决方案路线 | 工业AI/智能制造 | 0/10 | 10 | 2 | 创新奇智/大客户销售；创新奇智/销售经理 | 不能下BOSS结论 |
| P1 | AI软件落地路线 | 数据/MLOps/AI基础软件 | 0/10 | 10 | 2 | 第四范式/大客户销售；第四范式/解决方案顾问 | 不能下BOSS结论 |
| P1 | 行业解决方案路线 | 智能汽车/机器人/具身智能 | 0/10 | 10 | 2 | 地平线/渠道销售；地平线/销售经理 | 不能下BOSS结论 |
| P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 0/10 | 10 | 3 | 合合信息/大客户销售；合合信息/售前；来也科技/大客户销售 | 不能下BOSS结论 |
| P1 | 行业解决方案路线 | AI安全/私有化/信创 | 0/10 | 10 | 2 | 奇安信/大客户销售；深信服/大客户销售 | 不能下BOSS结论 |
| P2 | 硬件/算力/半导体路线 | 智算中心/数据中心服务 | 0/8 | 8 | 2 | 世纪互联/大客户销售；世纪互联/渠道销售 | 不能下BOSS结论 |
| P2 | 行业解决方案路线 | AI视觉/安防/质检 | 0/8 | 8 | 2 | 大华股份/行业销售；大华股份/渠道销售 | 不能下BOSS结论 |

## 五、本轮30个手工动作

每个动作的执行方式相同：在普通 Chrome 打开 BOSS 首页，站内搜索对应关键词，筛选高相关销售/售前/渠道/销售管理岗位，复制岗位文本，再运行对应导入命令。

| 顺序 | 批次 | 优先级 | 路线 | 赛道 | 公司 | 岗位词 | 薪资观察 | 样本进度 | 本轮目标 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| 1 | A-P0首轮补样 | P0 | AI软件落地路线 | 基座大模型/Agent平台 | 商汤科技 | 解决方案顾问 | 8K-12K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `商汤科技 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 解决方案顾问" --company "商汤科技" --role "解决方案顾问" --city "广州"` |
| 2 | A-P0首轮补样 | P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 超聚变 | 大客户销售 | 20K-35K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `超聚变 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 大客户销售" --company "超聚变" --role "大客户销售" --city "广州"` |
| 3 | A-P0首轮补样 | P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 海光信息 | 大客户销售 | 40K-70K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `海光信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 大客户销售" --company "海光信息" --role "大客户销售" --city "广州"` |
| 4 | A-P0首轮补样 | P0 | AI软件落地路线 | 智能客服/营销/销售AI | 百应科技 | SaaS销售 | 8K-13K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `百应科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 SaaS销售" --company "百应科技" --role "SaaS销售" --city "广州"` |
| 5 | A-P0首轮补样 | P0 | AI软件落地路线 | 云计算/大模型平台 | 百度智能云 | AI销售 | 30K-60K | 4/12 | 先补2条高相关岗位 | https://www.zhipin.com/ | `百度智能云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 AI销售" --company "百度智能云" --role "AI销售" --city "广州"` |
| 6 | C-P1扩展补样 | P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 合合信息 | 大客户销售 | 25K-45K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `合合信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 大客户销售" --company "合合信息" --role "大客户销售" --city "广州"` |
| 7 | C-P1扩展补样 | P1 | AI软件落地路线 | 数据/MLOps/AI基础软件 | 第四范式 | 大客户销售 | 30K-60K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `第四范式 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 大客户销售" --company "第四范式" --role "大客户销售" --city "广州"` |
| 8 | C-P1扩展补样 | P1 | 行业解决方案路线 | AI安全/私有化/信创 | 奇安信 | 大客户销售 | 20K-50K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `奇安信 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "奇安信 大客户销售" --company "奇安信" --role "大客户销售" --city "广州"` |
| 9 | C-P1扩展补样 | P1 | 行业解决方案路线 | 工业AI/智能制造 | 创新奇智 | 大客户销售 | 15K-60K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `创新奇智 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 大客户销售" --company "创新奇智" --role "大客户销售" --city "广州"` |
| 10 | D-P2补充观察 | P2 | 硬件/算力/半导体路线 | 智算中心/数据中心服务 | 世纪互联 | 大客户销售 | 20K-50K | 0/8 | 先补2条高相关岗位 | https://www.zhipin.com/ | `世纪互联 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 大客户销售" --company "世纪互联" --role "大客户销售" --city "广州"` |
| 11 | C-P1扩展补样 | P1 | 行业解决方案路线 | 智能汽车/机器人/具身智能 | 地平线 | 渠道销售 | 40K-70K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `地平线 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 渠道销售" --company "地平线" --role "渠道销售" --city "广州"` |
| 12 | D-P2补充观察 | P2 | 行业解决方案路线 | AI视觉/安防/质检 | 大华股份 | 行业销售 | 15K-30K | 0/8 | 先补2条高相关岗位 | https://www.zhipin.com/ | `大华股份 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 行业销售" --company "大华股份" --role "行业销售" --city "广州"` |
| 13 | A-P0首轮补样 | P0 | AI软件落地路线 | 基座大模型/Agent平台 | 月之暗面 | 解决方案顾问 | 8K-12K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `月之暗面 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 解决方案顾问" --company "月之暗面" --role "解决方案顾问" --city "广州"` |
| 14 | A-P0首轮补样 | P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 超聚变 | 行业销售 | 20K-35K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `超聚变 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 行业销售" --company "超聚变" --role "行业销售" --city "广州"` |
| 15 | A-P0首轮补样 | P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 海光信息 | 渠道销售 | 40K-70K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `海光信息 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 渠道销售" --company "海光信息" --role "渠道销售" --city "广州"` |
| 16 | B-P0第二轮补样 | P0 | AI软件落地路线 | 智能客服/营销/销售AI | 七陌 | SaaS销售 | 8K-13K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `七陌 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 SaaS销售" --company "七陌" --role "SaaS销售" --city "广州"` |
| 17 | B-P0第二轮补样 | P0 | AI软件落地路线 | 云计算/大模型平台 | 华为云 | AI销售 | 30K-60K | 4/12 | 先补2条高相关岗位 | https://www.zhipin.com/ | `华为云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 AI销售" --company "华为云" --role "AI销售" --city "广州"` |
| 18 | C-P1扩展补样 | P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 合合信息 | 售前 | 15K-20K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `合合信息 售前` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 售前" --company "合合信息" --role "售前" --city "广州"` |
| 19 | C-P1扩展补样 | P1 | AI软件落地路线 | 数据/MLOps/AI基础软件 | 第四范式 | 解决方案顾问 | 30K-60K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `第四范式 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 解决方案顾问" --company "第四范式" --role "解决方案顾问" --city "广州"` |
| 20 | C-P1扩展补样 | P1 | 行业解决方案路线 | AI安全/私有化/信创 | 深信服 | 大客户销售 | 20K-50K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `深信服 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "深信服 大客户销售" --company "深信服" --role "大客户销售" --city "广州"` |
| 21 | C-P1扩展补样 | P1 | 行业解决方案路线 | 工业AI/智能制造 | 创新奇智 | 销售经理 | 15K-60K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `创新奇智 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 销售经理" --company "创新奇智" --role "销售经理" --city "广州"` |
| 22 | D-P2补充观察 | P2 | 硬件/算力/半导体路线 | 智算中心/数据中心服务 | 世纪互联 | 渠道销售 | 20K-50K | 0/8 | 先补2条高相关岗位 | https://www.zhipin.com/ | `世纪互联 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 渠道销售" --company "世纪互联" --role "渠道销售" --city "广州"` |
| 23 | C-P1扩展补样 | P1 | 行业解决方案路线 | 智能汽车/机器人/具身智能 | 地平线 | 销售经理 | 40K-70K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `地平线 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 销售经理" --company "地平线" --role "销售经理" --city "广州"` |
| 24 | D-P2补充观察 | P2 | 行业解决方案路线 | AI视觉/安防/质检 | 大华股份 | 渠道销售 | 15K-30K | 0/8 | 先补2条高相关岗位 | https://www.zhipin.com/ | `大华股份 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 渠道销售" --company "大华股份" --role "渠道销售" --city "广州"` |
| 25 | B-P0第二轮补样 | P0 | AI软件落地路线 | 基座大模型/Agent平台 | 智谱AI | 解决方案顾问 | 8K-12K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `智谱AI 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI 解决方案顾问" --company "智谱AI" --role "解决方案顾问" --city "广州"` |
| 26 | B-P0第二轮补样 | P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 超聚变 | 售前 | 20K-35K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `超聚变 售前` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 售前" --company "超聚变" --role "售前" --city "广州"` |
| 27 | B-P0第二轮补样 | P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 寒武纪 | 大客户销售 | 40K-70K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `寒武纪 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "寒武纪 大客户销售" --company "寒武纪" --role "大客户销售" --city "广州"` |
| 28 | B-P0第二轮补样 | P0 | AI软件落地路线 | 智能客服/营销/销售AI | 容联云 | SaaS销售 | 8K-13K | 0/12 | 先补3条高相关岗位 | https://www.zhipin.com/ | `容联云 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 SaaS销售" --company "容联云" --role "SaaS销售" --city "广州"` |
| 29 | B-P0第二轮补样 | P0 | AI软件落地路线 | 云计算/大模型平台 | 火山引擎 | AI销售 | 30K-60K | 4/12 | 先补2条高相关岗位 | https://www.zhipin.com/ | `火山引擎 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 AI销售" --company "火山引擎" --role "AI销售" --city "广州"` |
| 30 | C-P1扩展补样 | P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 来也科技 | 大客户销售 | 25K-45K | 0/10 | 先补3条高相关岗位 | https://www.zhipin.com/ | `来也科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "来也科技 大客户销售" --company "来也科技" --role "大客户销售" --city "广州"` |

## 六、采样验收规则

1. 只导入销售、售前、解决方案、渠道、销售管理相关岗位。
2. 岗位正文必须能看出 AI、大模型、算力、硬件、半导体、智能制造、数据、云、私有化、行业场景中的至少一个相关信号。
3. 每条导入样本尽量包含公司、岗位、薪资、城市、经验、学历、职责、要求、客户类型、是否管理岗、是否售前/解决方案。
4. 如果同一搜索页没有高相关岗位，不要强行导入，直接换下一条任务。
5. 每补 10 到 20 条样本后，运行：

```bash
npm run summary:jobs
npm run sampling:status
npm run sampling:gap
npm run brief:market
npm run report:full
npm run audit:research
```

## 七、停止规则

1. 出现安全验证、登录异常、页面跳回 blank，立即停止，不连续重试。
2. 每个站内搜索关键词优先复制 1 到 2 条强相关岗位，不追求一次性翻页。
3. 如果同一赛道已经达到 3 条样本，可以先转向仍为 0 的 P0 赛道。
4. 只有当全行业达到 80 到 200 条高相关 BOSS 样本后，才把市场报告升级为 BOSS 大样本结论。

## 八、CSV输出

```text
/Users/MR/Documents/职场/01_行情收集/BOSS人工补样工作台.csv
```
