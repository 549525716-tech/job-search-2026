# BOSS人工采样批次包

更新时间：2026-07-01 01:34:47 Asia/Shanghai

## 一、本质判断

这份批次包不是自动采集脚本，而是把 BOSS 大样本补齐工作拆成可控的人工小批次。当前系统已经有全行业公司池、岗位族矩阵和样本缺口看板，但 BOSS 干净样本不足，所以真正要推进的是“少量入口、低频打开、人工复制、结构化导入、批后复盘”的补样闭环。

当前最大的矛盾是：既要尽快补齐 AI 全行业销售岗位样本，又不能再让脚本替你打开、刷新或跳转 BOSS 页面。

## 二、执行边界

- 先运行 `npm run auth:boss`，只使用独立 BOSS 人工窗口。
- 不在 `Career Auth Browser` / 9333 窗口里输入 BOSS 地址。
- 每次只做一个批次；批次内每个搜索入口之间至少停留几分钟，按人工阅读节奏操作。
- 只复制销售、售前、解决方案、渠道、销售管理相关岗位。
- 不自动投递、不自动沟通、不绕过验证码或验证。

## 三、批次总览

| 指标 | 数值 |
| --- | ---: |
| 批次数 | 6 |
| 搜索入口 | 30 |
| 目标导入岗位数 | 83 |
| 覆盖路线 | 3 |
| 覆盖赛道 | 12 |
| P0任务 | 15 |
| 每批入口数 | 5 |

| 批次 | 模式 | 优先级 | 路线 | 入口数 | 目标导入 | 目标 |
| --- | --- | --- | --- | ---: | ---: | --- |
| BOSS-MANUAL-01 | 软硬件对照补样 | P0(5) | AI软件落地路线(3)、硬件/算力/半导体路线(2) | 5 | 14 | 验证 AI软件落地路线(3)、硬件/算力/半导体路线(2) 下 大客户/行业销售经理(2)、售前/解决方案顾问(1)、AI软件/大模型销售(1)、SaaS/应用销售(1) 的薪资、职责和能力门槛 |
| BOSS-MANUAL-02 | 软硬件对照补样 | P1(4)、P2(1) | 行业解决方案路线(2)、AI软件落地路线(2)、硬件/算力/半导体路线(1) | 5 | 14 | 验证 行业解决方案路线(2)、AI软件落地路线(2)、硬件/算力/半导体路线(1) 下 大客户/行业销售经理(5) 的薪资、职责和能力门槛 |
| BOSS-MANUAL-03 | 软硬件对照补样 | P0(3)、P1(1)、P2(1) | 行业解决方案路线(2)、硬件/算力/半导体路线(2)、AI软件落地路线(1) | 5 | 14 | 验证 行业解决方案路线(2)、硬件/算力/半导体路线(2)、AI软件落地路线(1) 下 大客户/行业销售经理(2)、渠道/生态/伙伴销售(2)、售前/解决方案顾问(1) 的薪资、职责和能力门槛 |
| BOSS-MANUAL-04 | AI软件/应用集中补样 | P1(3)、P0(2) | AI软件落地路线(4)、行业解决方案路线(1) | 5 | 14 | 验证 AI软件落地路线(4)、行业解决方案路线(1) 下 售前/解决方案顾问(2)、大客户/行业销售经理(1)、AI软件/大模型销售(1)、SaaS/应用销售(1) 的薪资、职责和能力门槛 |
| BOSS-MANUAL-05 | 软硬件对照补样 | P1(2)、P2(2)、P0(1) | 行业解决方案路线(3)、硬件/算力/半导体路线(1)、AI软件落地路线(1) | 5 | 13 | 验证 行业解决方案路线(3)、硬件/算力/半导体路线(1)、AI软件落地路线(1) 下 渠道/生态/伙伴销售(2)、销售管理/区域负责人(2)、售前/解决方案顾问(1) 的薪资、职责和能力门槛 |
| BOSS-MANUAL-06 | 软硬件对照补样 | P0(4)、P1(1) | AI软件落地路线(3)、硬件/算力/半导体路线(2) | 5 | 14 | 验证 AI软件落地路线(3)、硬件/算力/半导体路线(2) 下 大客户/行业销售经理(2)、售前/解决方案顾问(1)、AI软件/大模型销售(1)、SaaS/应用销售(1) 的薪资、职责和能力门槛 |

## 四、操作顺序

1. 执行 `npm run auth:boss` 生成本地安全入口页，在正常 Chrome 中手动打开入口页并登录。
2. 从下方批次中选一个公司和岗位词；先进入 BOSS 首页，页面稳定后在站内搜索框输入关键词，人工查看结果。
3. 对每个入口复制 1 到 3 条高相关岗位卡片或详情文本。
4. 回到终端执行对应 `import:manual` 命令导入剪贴板内容。
5. 完成一个批次后运行批后命令，更新样本、薪资、能力、结论权限和全量报告。

## 五、批次明细

## BOSS-MANUAL-01：软硬件对照补样

目标：验证 AI软件落地路线(3)、硬件/算力/半导体路线(2) 下 大客户/行业销售经理(2)、售前/解决方案顾问(1)、AI软件/大模型销售(1)、SaaS/应用销售(1) 的薪资、职责和能力门槛

验收：本批至少导入 14 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | AI软件落地路线 | 基座大模型/Agent平台 | 商汤科技 | 解决方案顾问 | 8K-12K | 0/12 | 3 | `https://www.zhipin.com/` | `商汤科技 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 解决方案顾问" --company "商汤科技" --role "解决方案顾问" --city "广州" --batch-id "BOSS-MANUAL-01" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "售前/解决方案顾问" --salary-band "8K-12K"` |
| 2 | P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 超聚变 | 大客户销售 | 20K-35K | 0/12 | 3 | `https://www.zhipin.com/` | `超聚变 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 大客户销售" --company "超聚变" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-01" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 3 | P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 海光信息 | 大客户销售 | 40K-70K | 0/12 | 3 | `https://www.zhipin.com/` | `海光信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 大客户销售" --company "海光信息" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-01" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 4 | P0 | AI软件落地路线 | 智能客服/营销/销售AI | 百应科技 | SaaS销售 | 8K-13K | 0/12 | 3 | `https://www.zhipin.com/` | `百应科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 SaaS销售" --company "百应科技" --role "SaaS销售" --city "广州" --batch-id "BOSS-MANUAL-01" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "SaaS/应用销售" --salary-band "8K-13K"` |
| 5 | P0 | AI软件落地路线 | 云计算/大模型平台 | 百度智能云 | AI销售 | 30K-60K | 4/12 | 2 | `https://www.zhipin.com/` | `百度智能云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 AI销售" --company "百度智能云" --role "AI销售" --city "广州" --batch-id "BOSS-MANUAL-01" --batch-task "5" --batch-target-copies "2" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "30K-60K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research
```

## BOSS-MANUAL-02：软硬件对照补样

目标：验证 行业解决方案路线(2)、AI软件落地路线(2)、硬件/算力/半导体路线(1) 下 大客户/行业销售经理(5) 的薪资、职责和能力门槛

验收：本批至少导入 14 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 合合信息 | 大客户销售 | 25K-45K | 0/10 | 3 | `https://www.zhipin.com/` | `合合信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 大客户销售" --company "合合信息" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-02" --batch-task "1" --batch-target-copies "3" --priority "P1" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "大客户/行业销售经理" --salary-band "25K-45K"` |
| 2 | P1 | AI软件落地路线 | 数据/MLOps/AI基础软件 | 第四范式 | 大客户销售 | 30K-60K | 0/10 | 3 | `https://www.zhipin.com/` | `第四范式 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 大客户销售" --company "第四范式" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-02" --batch-task "2" --batch-target-copies "3" --priority "P1" --route "AI软件落地路线" --segment "数据/MLOps/AI基础软件" --role-family "大客户/行业销售经理" --salary-band "30K-60K"` |
| 3 | P1 | 行业解决方案路线 | AI安全/私有化/信创 | 奇安信 | 大客户销售 | 20K-50K | 0/10 | 3 | `https://www.zhipin.com/` | `奇安信 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "奇安信 大客户销售" --company "奇安信" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-02" --batch-task "3" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "AI安全/私有化/信创" --role-family "大客户/行业销售经理" --salary-band "20K-50K"` |
| 4 | P1 | 行业解决方案路线 | 工业AI/智能制造 | 创新奇智 | 大客户销售 | 15K-60K | 0/10 | 3 | `https://www.zhipin.com/` | `创新奇智 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 大客户销售" --company "创新奇智" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-02" --batch-task "4" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "大客户/行业销售经理" --salary-band "15K-60K"` |
| 5 | P2 | 硬件/算力/半导体路线 | 智算中心/数据中心服务 | 世纪互联 | 大客户销售 | 20K-50K | 0/8 | 2 | `https://www.zhipin.com/` | `世纪互联 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 大客户销售" --company "世纪互联" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-02" --batch-task "5" --batch-target-copies "2" --priority "P2" --route "硬件/算力/半导体路线" --segment "智算中心/数据中心服务" --role-family "大客户/行业销售经理" --salary-band "20K-50K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research
```

## BOSS-MANUAL-03：软硬件对照补样

目标：验证 行业解决方案路线(2)、硬件/算力/半导体路线(2)、AI软件落地路线(1) 下 大客户/行业销售经理(2)、渠道/生态/伙伴销售(2)、售前/解决方案顾问(1) 的薪资、职责和能力门槛

验收：本批至少导入 14 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P1 | 行业解决方案路线 | 智能汽车/机器人/具身智能 | 地平线 | 渠道销售 | 40K-70K | 0/10 | 3 | `https://www.zhipin.com/` | `地平线 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 渠道销售" --company "地平线" --role "渠道销售" --city "广州" --batch-id "BOSS-MANUAL-03" --batch-task "1" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "渠道/生态/伙伴销售" --salary-band "40K-70K"` |
| 2 | P2 | 行业解决方案路线 | AI视觉/安防/质检 | 大华股份 | 行业销售 | 15K-30K | 0/8 | 2 | `https://www.zhipin.com/` | `大华股份 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 行业销售" --company "大华股份" --role "行业销售" --city "广州" --batch-id "BOSS-MANUAL-03" --batch-task "2" --batch-target-copies "2" --priority "P2" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "15K-30K"` |
| 3 | P0 | AI软件落地路线 | 基座大模型/Agent平台 | 月之暗面 | 解决方案顾问 | 8K-12K | 0/12 | 3 | `https://www.zhipin.com/` | `月之暗面 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 解决方案顾问" --company "月之暗面" --role "解决方案顾问" --city "广州" --batch-id "BOSS-MANUAL-03" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "售前/解决方案顾问" --salary-band "8K-12K"` |
| 4 | P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 超聚变 | 行业销售 | 20K-35K | 0/12 | 3 | `https://www.zhipin.com/` | `超聚变 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 行业销售" --company "超聚变" --role "行业销售" --city "广州" --batch-id "BOSS-MANUAL-03" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 5 | P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 海光信息 | 渠道销售 | 40K-70K | 0/12 | 3 | `https://www.zhipin.com/` | `海光信息 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 渠道销售" --company "海光信息" --role "渠道销售" --city "广州" --batch-id "BOSS-MANUAL-03" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "渠道/生态/伙伴销售" --salary-band "40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research
```

## BOSS-MANUAL-04：AI软件/应用集中补样

目标：验证 AI软件落地路线(4)、行业解决方案路线(1) 下 售前/解决方案顾问(2)、大客户/行业销售经理(1)、AI软件/大模型销售(1)、SaaS/应用销售(1) 的薪资、职责和能力门槛

验收：本批至少导入 14 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | AI软件落地路线 | 智能客服/营销/销售AI | 七陌 | SaaS销售 | 8K-13K | 0/12 | 3 | `https://www.zhipin.com/` | `七陌 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 SaaS销售" --company "七陌" --role "SaaS销售" --city "广州" --batch-id "BOSS-MANUAL-04" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "SaaS/应用销售" --salary-band "8K-13K"` |
| 2 | P0 | AI软件落地路线 | 云计算/大模型平台 | 华为云 | AI销售 | 30K-60K | 4/12 | 2 | `https://www.zhipin.com/` | `华为云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 AI销售" --company "华为云" --role "AI销售" --city "广州" --batch-id "BOSS-MANUAL-04" --batch-task "2" --batch-target-copies "2" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "30K-60K"` |
| 3 | P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 合合信息 | 售前 | 15K-20K | 0/10 | 3 | `https://www.zhipin.com/` | `合合信息 售前` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 售前" --company "合合信息" --role "售前" --city "广州" --batch-id "BOSS-MANUAL-04" --batch-task "3" --batch-target-copies "3" --priority "P1" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "售前/解决方案顾问" --salary-band "15K-20K"` |
| 4 | P1 | AI软件落地路线 | 数据/MLOps/AI基础软件 | 第四范式 | 解决方案顾问 | 30K-60K | 0/10 | 3 | `https://www.zhipin.com/` | `第四范式 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 解决方案顾问" --company "第四范式" --role "解决方案顾问" --city "广州" --batch-id "BOSS-MANUAL-04" --batch-task "4" --batch-target-copies "3" --priority "P1" --route "AI软件落地路线" --segment "数据/MLOps/AI基础软件" --role-family "售前/解决方案顾问" --salary-band "30K-60K"` |
| 5 | P1 | 行业解决方案路线 | AI安全/私有化/信创 | 深信服 | 大客户销售 | 20K-50K | 0/10 | 3 | `https://www.zhipin.com/` | `深信服 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "深信服 大客户销售" --company "深信服" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-04" --batch-task "5" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "AI安全/私有化/信创" --role-family "大客户/行业销售经理" --salary-band "20K-50K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research
```

## BOSS-MANUAL-05：软硬件对照补样

目标：验证 行业解决方案路线(3)、硬件/算力/半导体路线(1)、AI软件落地路线(1) 下 渠道/生态/伙伴销售(2)、销售管理/区域负责人(2)、售前/解决方案顾问(1) 的薪资、职责和能力门槛

验收：本批至少导入 13 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P1 | 行业解决方案路线 | 工业AI/智能制造 | 创新奇智 | 销售经理 | 15K-60K | 0/10 | 3 | `https://www.zhipin.com/` | `创新奇智 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 销售经理" --company "创新奇智" --role "销售经理" --city "广州" --batch-id "BOSS-MANUAL-05" --batch-task "1" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "销售管理/区域负责人" --salary-band "15K-60K"` |
| 2 | P2 | 硬件/算力/半导体路线 | 智算中心/数据中心服务 | 世纪互联 | 渠道销售 | 20K-50K | 0/8 | 2 | `https://www.zhipin.com/` | `世纪互联 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 渠道销售" --company "世纪互联" --role "渠道销售" --city "广州" --batch-id "BOSS-MANUAL-05" --batch-task "2" --batch-target-copies "2" --priority "P2" --route "硬件/算力/半导体路线" --segment "智算中心/数据中心服务" --role-family "渠道/生态/伙伴销售" --salary-band "20K-50K"` |
| 3 | P1 | 行业解决方案路线 | 智能汽车/机器人/具身智能 | 地平线 | 销售经理 | 40K-70K | 0/10 | 3 | `https://www.zhipin.com/` | `地平线 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 销售经理" --company "地平线" --role "销售经理" --city "广州" --batch-id "BOSS-MANUAL-05" --batch-task "3" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "销售管理/区域负责人" --salary-band "40K-70K"` |
| 4 | P2 | 行业解决方案路线 | AI视觉/安防/质检 | 大华股份 | 渠道销售 | 15K-30K | 0/8 | 2 | `https://www.zhipin.com/` | `大华股份 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 渠道销售" --company "大华股份" --role "渠道销售" --city "广州" --batch-id "BOSS-MANUAL-05" --batch-task "4" --batch-target-copies "2" --priority "P2" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "渠道/生态/伙伴销售" --salary-band "15K-30K"` |
| 5 | P0 | AI软件落地路线 | 基座大模型/Agent平台 | 智谱AI | 解决方案顾问 | 8K-12K | 0/12 | 3 | `https://www.zhipin.com/` | `智谱AI 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI 解决方案顾问" --company "智谱AI" --role "解决方案顾问" --city "广州" --batch-id "BOSS-MANUAL-05" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "售前/解决方案顾问" --salary-band "8K-12K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research
```

## BOSS-MANUAL-06：软硬件对照补样

目标：验证 AI软件落地路线(3)、硬件/算力/半导体路线(2) 下 大客户/行业销售经理(2)、售前/解决方案顾问(1)、AI软件/大模型销售(1)、SaaS/应用销售(1) 的薪资、职责和能力门槛

验收：本批至少导入 14 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | 硬件/算力/半导体路线 | AI服务器/智算基础设施 | 超聚变 | 售前 | 20K-35K | 0/12 | 3 | `https://www.zhipin.com/` | `超聚变 售前` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 售前" --company "超聚变" --role "售前" --city "广州" --batch-id "BOSS-MANUAL-06" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "售前/解决方案顾问" --salary-band "20K-35K"` |
| 2 | P0 | 硬件/算力/半导体路线 | AI芯片/GPU/加速卡 | 寒武纪 | 大客户销售 | 40K-70K | 0/12 | 3 | `https://www.zhipin.com/` | `寒武纪 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "寒武纪 大客户销售" --company "寒武纪" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-06" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 3 | P0 | AI软件落地路线 | 智能客服/营销/销售AI | 容联云 | SaaS销售 | 8K-13K | 0/12 | 3 | `https://www.zhipin.com/` | `容联云 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 SaaS销售" --company "容联云" --role "SaaS销售" --city "广州" --batch-id "BOSS-MANUAL-06" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "SaaS/应用销售" --salary-band "8K-13K"` |
| 4 | P0 | AI软件落地路线 | 云计算/大模型平台 | 火山引擎 | AI销售 | 30K-60K | 4/12 | 2 | `https://www.zhipin.com/` | `火山引擎 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 AI销售" --company "火山引擎" --role "AI销售" --city "广州" --batch-id "BOSS-MANUAL-06" --batch-task "4" --batch-target-copies "2" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "30K-60K"` |
| 5 | P1 | AI软件落地路线 | AI Agent/RPA/流程自动化 | 来也科技 | 大客户销售 | 25K-45K | 0/10 | 3 | `https://www.zhipin.com/` | `来也科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "来也科技 大客户销售" --company "来也科技" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-06" --batch-task "5" --batch-target-copies "3" --priority "P1" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "大客户/行业销售经理" --salary-band "25K-45K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research
```


## 六、验收标准

一个批次算完成，必须同时满足：

- 每个入口都人工判断过是否有高相关岗位。
- 导入岗位正文能看出 AI/算力/硬件/行业场景相关性。
- 岗位属于销售、售前、解决方案、渠道或销售管理。
- 薪资、城市、公司、岗位、职责和要求尽量完整。
- 批后已运行 `npm run audit:research`，确认样本数和结论权限已更新。
