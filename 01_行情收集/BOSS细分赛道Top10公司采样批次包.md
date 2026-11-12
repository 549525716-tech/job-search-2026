# BOSS细分赛道Top10公司采样批次包

更新时间：2026-07-01 01:34:50 Asia/Shanghai

## 一、本质判断

这份批次包不是再扩公司名单，而是把“AI上中下游Top10公司证据表”转成可执行的低频人工采样队列。它解决的是：我们已经知道每个赛道该看哪些头部公司，但还缺 BOSS 岗位文本去验证这些公司是否在招销售、售前、渠道或销售管理岗位，以及薪资和能力要求。

当前最大的矛盾是：既要覆盖月之暗面、智谱AI、MiniMax、大模型平台、芯片、半导体、AI服务器、智算中心、工业AI等全行业方向，又不能用自动打开、自动刷新、自动读取的方式触发 BOSS 风控。

## 二、执行边界

- 本文件只提供人工搜索关键词和导入命令，不自动打开 BOSS。
- 正确入口是 `npm run auth:boss` 打开的普通 Chrome 本地安全页。
- 每条任务先进入 BOSS 首页，再在站内搜索框输入关键词；完整 URL 只保留在 CSV 的 referenceUrl 字段作审计，不作为操作入口。
- 每次只执行一个批次；如果页面跳回 `about:blank`、出现验证或登录异常，立即停止，不连续重试。

## 三、批次总览

| 指标 | 数值 |
| --- | ---: |
| 候选Top10公司入口 | 117 |
| 本次输出入口 | 48 |
| 覆盖赛道 | 12/12 |
| 批次数 | 12 |
| 每批入口数 | 4 |
| 目标导入岗位数 | 134 |
| 0样本公司入口 | 48 |
| 用户点名/强关注入口 | 19 |
| 硬件/半导体/智算入口 | 12 |
| AI软件/云/MaaS入口 | 20 |
| 未进入本批的Top10样本缺口 | 141 |

| 批次 | 模式 | 优先级 | 覆盖赛道 | 入口数 | 目标导入 | 目标 |
| --- | --- | --- | --- | ---: | ---: | --- |
| BOSS-TOP10-01 | Top10软硬件对照补样 | P0(4) | 工业AI/智能制造(1)、智能客服/营销/销售AI(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) | 4 | 12 | 验证 工业AI/智能制造(1)、智能客服/营销/销售AI(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-02 | Top10软硬件对照补样 | P0(4) | 数据/MLOps/AI基础软件(1)、智能汽车/机器人/具身智能(1)、智算中心/数据中心服务(1)、AI安全/私有化/信创(1) | 4 | 12 | 验证 数据/MLOps/AI基础软件(1)、智能汽车/机器人/具身智能(1)、智算中心/数据中心服务(1)、AI安全/私有化/信创(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-03 | Top10 AI软件落地补样 | P0(4) | 基座大模型/Agent平台(1)、云计算/大模型平台(1)、AI Agent/RPA/流程自动化(1)、AI视觉/安防/质检(1) | 4 | 12 | 验证 基座大模型/Agent平台(1)、云计算/大模型平台(1)、AI Agent/RPA/流程自动化(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-04 | Top10软硬件对照补样 | P0(4) | 智能客服/营销/销售AI(1)、AI安全/私有化/信创(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) | 4 | 12 | 验证 智能客服/营销/销售AI(1)、AI安全/私有化/信创(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-05 | Top10软硬件对照补样 | P0(4) | 工业AI/智能制造(1)、云计算/大模型平台(1)、智算中心/数据中心服务(1)、AI Agent/RPA/流程自动化(1) | 4 | 12 | 验证 工业AI/智能制造(1)、云计算/大模型平台(1)、智算中心/数据中心服务(1)、AI Agent/RPA/流程自动化(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-06 | Top10 AI软件落地补样 | P0(4) | 基座大模型/Agent平台(1)、数据/MLOps/AI基础软件(1)、智能汽车/机器人/具身智能(1)、AI视觉/安防/质检(1) | 4 | 12 | 验证 基座大模型/Agent平台(1)、数据/MLOps/AI基础软件(1)、智能汽车/机器人/具身智能(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-07 | Top10软硬件对照补样 | P0(4) | 工业AI/智能制造(1)、智能客服/营销/销售AI(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) | 4 | 12 | 验证 工业AI/智能制造(1)、智能客服/营销/销售AI(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-08 | Top10 AI软件落地补样 | P0(4) | 数据/MLOps/AI基础软件(1)、云计算/大模型平台(1)、智能汽车/机器人/具身智能(1)、AI Agent/RPA/流程自动化(1) | 4 | 12 | 验证 数据/MLOps/AI基础软件(1)、云计算/大模型平台(1)、智能汽车/机器人/具身智能(1)、AI Agent/RPA/流程自动化(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-09 | Top10软硬件对照补样 | P1(3)、P0(1) | 基座大模型/Agent平台(1)、智算中心/数据中心服务(1)、AI安全/私有化/信创(1)、AI视觉/安防/质检(1) | 4 | 8 | 验证 基座大模型/Agent平台(1)、智算中心/数据中心服务(1)、AI安全/私有化/信创(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-10 | Top10软硬件对照补样 | P0(3)、P1(1) | 工业AI/智能制造(1)、基座大模型/Agent平台(1)、智能客服/营销/销售AI(1)、AI芯片/GPU/加速卡(1) | 4 | 12 | 验证 工业AI/智能制造(1)、基座大模型/Agent平台(1)、智能客服/营销/销售AI(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-11 | Top10 AI软件落地补样 | P0(3)、P1(1) | 云计算/大模型平台(1)、智能汽车/机器人/具身智能(1)、AI Agent/RPA/流程自动化(1)、AI安全/私有化/信创(1) | 4 | 11 | 验证 云计算/大模型平台(1)、智能汽车/机器人/具身智能(1)、AI Agent/RPA/流程自动化(1)、AI安全/私有化/信创(1) 的头部公司销售岗位、薪资和能力要求 |
| BOSS-TOP10-12 | Top10软硬件对照补样 | P1(3)、P0(1) | 数据/MLOps/AI基础软件(1)、智算中心/数据中心服务(1)、AI服务器/智算基础设施(1)、AI视觉/安防/质检(1) | 4 | 7 | 验证 数据/MLOps/AI基础软件(1)、智算中心/数据中心服务(1)、AI服务器/智算基础设施(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求 |

## 四、批次明细

## BOSS-TOP10-01：Top10软硬件对照补样

目标：验证 工业AI/智能制造(1)、智能客服/营销/销售AI(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 智能客服/营销/销售AI | 百应科技 | SaaS销售 | 渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K | 0/3 | 3 | `https://www.zhipin.com/` | `百应科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 SaaS销售" --company "百应科技" --role "SaaS销售" --city "广州" --batch-id "BOSS-TOP10-01" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "AI软件/大模型销售" --salary-band "渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K"` |
| 2 | P0 | AI服务器/智算基础设施 | 超聚变 | 大客户销售 | 大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K | 0/3 | 3 | `https://www.zhipin.com/` | `超聚变 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 大客户销售" --company "超聚变" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-01" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K"` |
| 3 | P0 | 工业AI/智能制造 | 创新奇智 | 大客户销售 | 大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `创新奇智 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "创新奇智 大客户销售" --company "创新奇智" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-01" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K"` |
| 4 | P0 | AI芯片/GPU/加速卡 | 海光信息 | 大客户销售 | 大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `海光信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 大客户销售" --company "海光信息" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-01" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-02：Top10软硬件对照补样

目标：验证 数据/MLOps/AI基础软件(1)、智能汽车/机器人/具身智能(1)、智算中心/数据中心服务(1)、AI安全/私有化/信创(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | AI安全/私有化/信创 | 奇安信 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K | 0/3 | 3 | `https://www.zhipin.com/` | `奇安信 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "奇安信 大客户销售" --company "奇安信" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-02" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "AI安全/私有化/信创" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K"` |
| 2 | P0 | 智算中心/数据中心服务 | 世纪互联 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K | 0/3 | 3 | `https://www.zhipin.com/` | `世纪互联 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "世纪互联 大客户销售" --company "世纪互联" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-02" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "智算中心/数据中心服务" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K"` |
| 3 | P0 | 数据/MLOps/AI基础软件 | 第四范式 | AI销售 | 大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `第四范式 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "第四范式 AI销售" --company "第四范式" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-02" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "数据/MLOps/AI基础软件" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K"` |
| 4 | P0 | 智能汽车/机器人/具身智能 | 地平线 | 渠道销售 | 渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `地平线 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "地平线 渠道销售" --company "地平线" --role "渠道销售" --city "广州" --batch-id "BOSS-TOP10-02" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "渠道/生态/伙伴销售" --salary-band "渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-03：Top10 AI软件落地补样

目标：验证 基座大模型/Agent平台(1)、云计算/大模型平台(1)、AI Agent/RPA/流程自动化(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 云计算/大模型平台 | 百度智能云 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `百度智能云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 AI销售" --company "百度智能云" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-03" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"` |
| 2 | P0 | AI Agent/RPA/流程自动化 | 合合信息 | AI销售 | 大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K | 0/3 | 3 | `https://www.zhipin.com/` | `合合信息 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "合合信息 AI销售" --company "合合信息" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-03" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K"` |
| 3 | P0 | AI视觉/安防/质检 | 大华股份 | 大客户销售 | 大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K | 0/3 | 3 | `https://www.zhipin.com/` | `大华股份 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "大华股份 大客户销售" --company "大华股份" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-03" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K"` |
| 4 | P0 | 基座大模型/Agent平台 | 月之暗面 | AI销售 | 大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `月之暗面 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 AI销售" --company "月之暗面" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-03" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-04：Top10软硬件对照补样

目标：验证 智能客服/营销/销售AI(1)、AI安全/私有化/信创(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | AI服务器/智算基础设施 | 华为 | 大客户销售 | 大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K | 0/3 | 3 | `https://www.zhipin.com/` | `华为 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为 大客户销售" --company "华为" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-04" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K"` |
| 2 | P0 | AI芯片/GPU/加速卡 | 寒武纪 | 大客户销售 | 大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `寒武纪 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "寒武纪 大客户销售" --company "寒武纪" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-04" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |
| 3 | P0 | AI安全/私有化/信创 | 深信服 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K | 0/3 | 3 | `https://www.zhipin.com/` | `深信服 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "深信服 大客户销售" --company "深信服" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-04" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "AI安全/私有化/信创" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K"` |
| 4 | P0 | 智能客服/营销/销售AI | 七陌 | SaaS销售 | 渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K | 0/3 | 3 | `https://www.zhipin.com/` | `七陌 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 SaaS销售" --company "七陌" --role "SaaS销售" --city "广州" --batch-id "BOSS-TOP10-04" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "AI软件/大模型销售" --salary-band "渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-05：Top10软硬件对照补样

目标：验证 工业AI/智能制造(1)、云计算/大模型平台(1)、智算中心/数据中心服务(1)、AI Agent/RPA/流程自动化(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 工业AI/智能制造 | 格创东智 | 大客户销售 | 大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `格创东智 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "格创东智 大客户销售" --company "格创东智" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-05" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K"` |
| 2 | P0 | 云计算/大模型平台 | 华为云 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `华为云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 AI销售" --company "华为云" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-05" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"` |
| 3 | P0 | 智算中心/数据中心服务 | 万国数据 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K | 0/3 | 3 | `https://www.zhipin.com/` | `万国数据 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "万国数据 大客户销售" --company "万国数据" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-05" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "智算中心/数据中心服务" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K"` |
| 4 | P0 | AI Agent/RPA/流程自动化 | 来也科技 | AI销售 | 大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K | 0/3 | 3 | `https://www.zhipin.com/` | `来也科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "来也科技 AI销售" --company "来也科技" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-05" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-06：Top10 AI软件落地补样

目标：验证 基座大模型/Agent平台(1)、数据/MLOps/AI基础软件(1)、智能汽车/机器人/具身智能(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 数据/MLOps/AI基础软件 | 神策数据 | AI销售 | 大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `神策数据 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "神策数据 AI销售" --company "神策数据" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-06" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "数据/MLOps/AI基础软件" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K"` |
| 2 | P0 | 智能汽车/机器人/具身智能 | 禾赛科技 | 渠道销售 | 渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `禾赛科技 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "禾赛科技 渠道销售" --company "禾赛科技" --role "渠道销售" --city "广州" --batch-id "BOSS-TOP10-06" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "渠道/生态/伙伴销售" --salary-band "渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |
| 3 | P0 | AI视觉/安防/质检 | 海康威视 | 大客户销售 | 大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K | 0/3 | 3 | `https://www.zhipin.com/` | `海康威视 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海康威视 大客户销售" --company "海康威视" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-06" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K"` |
| 4 | P0 | 基座大模型/Agent平台 | 智谱AI | AI销售 | 大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `智谱AI AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI AI销售" --company "智谱AI" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-06" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-07：Top10软硬件对照补样

目标：验证 工业AI/智能制造(1)、智能客服/营销/销售AI(1)、AI服务器/智算基础设施(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | AI服务器/智算基础设施 | 浪潮信息 | 大客户销售 | 大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K | 0/3 | 3 | `https://www.zhipin.com/` | `浪潮信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "浪潮信息 大客户销售" --company "浪潮信息" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-07" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K"` |
| 2 | P0 | AI芯片/GPU/加速卡 | 华为昇腾 | 大客户销售 | 大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `华为昇腾 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为昇腾 大客户销售" --company "华为昇腾" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-07" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |
| 3 | P0 | 智能客服/营销/销售AI | 容联云 | SaaS销售 | 渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K | 0/3 | 3 | `https://www.zhipin.com/` | `容联云 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 SaaS销售" --company "容联云" --role "SaaS销售" --city "广州" --batch-id "BOSS-TOP10-07" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "AI软件/大模型销售" --salary-band "渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K"` |
| 4 | P0 | 工业AI/智能制造 | 黑湖科技 | 大客户销售 | 大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `黑湖科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "黑湖科技 大客户销售" --company "黑湖科技" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-07" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-08：Top10 AI软件落地补样

目标：验证 数据/MLOps/AI基础软件(1)、云计算/大模型平台(1)、智能汽车/机器人/具身智能(1)、AI Agent/RPA/流程自动化(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 云计算/大模型平台 | 火山引擎 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `火山引擎 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 AI销售" --company "火山引擎" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-08" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"` |
| 2 | P0 | AI Agent/RPA/流程自动化 | 实在智能 | 渠道销售 | 大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K | 0/3 | 3 | `https://www.zhipin.com/` | `实在智能 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "实在智能 渠道销售" --company "实在智能" --role "渠道销售" --city "广州" --batch-id "BOSS-TOP10-08" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "渠道/生态/伙伴销售" --salary-band "大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K"` |
| 3 | P0 | 数据/MLOps/AI基础软件 | 星环科技 | AI销售 | 大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `星环科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "星环科技 AI销售" --company "星环科技" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-08" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "数据/MLOps/AI基础软件" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K"` |
| 4 | P0 | 智能汽车/机器人/具身智能 | 速腾聚创 | 渠道销售 | 渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `速腾聚创 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "速腾聚创 渠道销售" --company "速腾聚创" --role "渠道销售" --city "广州" --batch-id "BOSS-TOP10-08" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "渠道/生态/伙伴销售" --salary-band "渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-09：Top10软硬件对照补样

目标：验证 基座大模型/Agent平台(1)、智算中心/数据中心服务(1)、AI安全/私有化/信创(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P1 | AI安全/私有化/信创 | 360数字安全 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K | 0/2 | 2 | `https://www.zhipin.com/` | `360数字安全 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "360数字安全 大客户销售" --company "360数字安全" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-09" --batch-task "1" --batch-target-copies "2" --priority "P1" --route "行业解决方案路线" --segment "AI安全/私有化/信创" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K"` |
| 2 | P1 | 智算中心/数据中心服务 | 光环新网 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K | 0/2 | 2 | `https://www.zhipin.com/` | `光环新网 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "光环新网 大客户销售" --company "光环新网" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-09" --batch-task "2" --batch-target-copies "2" --priority "P1" --route "硬件/算力/半导体路线" --segment "智算中心/数据中心服务" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K"` |
| 3 | P1 | AI视觉/安防/质检 | 旷视科技 | 大客户销售 | 大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K | 0/2 | 1 | `https://www.zhipin.com/` | `旷视科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "旷视科技 大客户销售" --company "旷视科技" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-09" --batch-task "3" --batch-target-copies "1" --priority "P1" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K"` |
| 4 | P0 | 基座大模型/Agent平台 | MiniMax | AI销售 | 大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `MiniMax AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "MiniMax AI销售" --company "MiniMax" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-09" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-10：Top10软硬件对照补样

目标：验证 工业AI/智能制造(1)、基座大模型/Agent平台(1)、智能客服/营销/销售AI(1)、AI芯片/GPU/加速卡(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 基座大模型/Agent平台 | 商汤科技 | AI销售 | 大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `商汤科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 AI销售" --company "商汤科技" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-10" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-70K;售前/解决方案顾问:8K-12K;AI软件/大模型销售:8K-70K"` |
| 2 | P1 | AI芯片/GPU/加速卡 | 壁仞科技 | 大客户销售 | 大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `壁仞科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "壁仞科技 大客户销售" --company "壁仞科技" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-10" --batch-task "2" --batch-target-copies "3" --priority "P1" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:40K-70K;渠道/生态/伙伴销售:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |
| 3 | P0 | 智能客服/营销/销售AI | 沃丰科技 | SaaS销售 | 渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K | 0/3 | 3 | `https://www.zhipin.com/` | `沃丰科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "沃丰科技 SaaS销售" --company "沃丰科技" --role "SaaS销售" --city "广州" --batch-id "BOSS-TOP10-10" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "智能客服/营销/销售AI" --role-family "AI软件/大模型销售" --salary-band "渠道/生态/伙伴销售:8K-50K;销售管理/区域负责人:12K-50K;SaaS/应用销售:8K-13K"` |
| 4 | P0 | 工业AI/智能制造 | 卡奥斯 | 大客户销售 | 大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `卡奥斯 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "卡奥斯 大客户销售" --company "卡奥斯" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-10" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-60K;售前/解决方案顾问:15K-60K;销售管理/区域负责人:15K-60K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-11：Top10 AI软件落地补样

目标：验证 云计算/大模型平台(1)、智能汽车/机器人/具身智能(1)、AI Agent/RPA/流程自动化(1)、AI安全/私有化/信创(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P0 | 云计算/大模型平台 | 腾讯云 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 0/3 | 3 | `https://www.zhipin.com/` | `腾讯云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "腾讯云 AI销售" --company "腾讯云" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-11" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"` |
| 2 | P0 | AI Agent/RPA/流程自动化 | 影刀RPA | AI销售 | 大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K | 0/3 | 3 | `https://www.zhipin.com/` | `影刀RPA AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "影刀RPA AI销售" --company "影刀RPA" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-11" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "AI Agent/RPA/流程自动化" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:25K-45K;售前/解决方案顾问:15K-20K;SaaS/应用销售:15K-45K"` |
| 3 | P0 | 智能汽车/机器人/具身智能 | 优必选 | 渠道销售 | 渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K | 0/3 | 3 | `https://www.zhipin.com/` | `优必选 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "优必选 渠道销售" --company "优必选" --role "渠道销售" --city "广州" --batch-id "BOSS-TOP10-11" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "渠道/生态/伙伴销售" --salary-band "渠道/生态/伙伴销售:40K-70K;销售管理/区域负责人:40K-70K;硬件/智算/半导体行业销售:40K-70K"` |
| 4 | P1 | AI安全/私有化/信创 | 安恒信息 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K | 0/2 | 2 | `https://www.zhipin.com/` | `安恒信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "安恒信息 大客户销售" --company "安恒信息" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-11" --batch-task "4" --batch-target-copies "2" --priority "P1" --route "行业解决方案路线" --segment "AI安全/私有化/信创" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:19K-50K;售前/解决方案顾问:19K-25K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```

## BOSS-TOP10-12：Top10软硬件对照补样

目标：验证 数据/MLOps/AI基础软件(1)、智算中心/数据中心服务(1)、AI服务器/智算基础设施(1)、AI视觉/安防/质检(1) 的头部公司销售岗位、薪资和能力要求

执行方式：先运行 `npm run auth:boss`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | P1 | 智算中心/数据中心服务 | 秦淮数据 | 大客户销售 | 大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K | 0/2 | 2 | `https://www.zhipin.com/` | `秦淮数据 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "秦淮数据 大客户销售" --company "秦淮数据" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-12" --batch-task "1" --batch-target-copies "2" --priority "P1" --route "硬件/算力/半导体路线" --segment "智算中心/数据中心服务" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-50K;渠道/生态/伙伴销售:20K-50K;硬件/智算/半导体行业销售:20K-50K"` |
| 2 | P1 | 数据/MLOps/AI基础软件 | 九章云极DataCanvas | AI销售 | 大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K | 0/2 | 1 | `https://www.zhipin.com/` | `九章云极DataCanvas AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "九章云极DataCanvas AI销售" --company "九章云极DataCanvas" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-12" --batch-task "2" --batch-target-copies "1" --priority "P1" --route "AI软件落地路线" --segment "数据/MLOps/AI基础软件" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:30K-60K;售前/解决方案顾问:30K-60K;SaaS/应用销售:30K-60K"` |
| 3 | P1 | AI视觉/安防/质检 | 云从科技 | 大客户销售 | 大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K | 0/2 | 1 | `https://www.zhipin.com/` | `云从科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "云从科技 大客户销售" --company "云从科技" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-12" --batch-task "3" --batch-target-copies "1" --priority "P1" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:15K-30K;渠道/生态/伙伴销售:15K-30K;售前/解决方案顾问:15K-30K"` |
| 4 | P0 | AI服务器/智算基础设施 | 新华三 | 大客户销售 | 大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K | 0/3 | 3 | `https://www.zhipin.com/` | `新华三 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "新华三 大客户销售" --company "新华三" --role "大客户销售" --city "广州" --batch-id "BOSS-TOP10-12" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "大客户/行业销售经理:20K-35K;售前/解决方案顾问:20K-35K;硬件/智算/半导体行业销售:20K-35K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research
```


## 五、验收标准

1. 每个入口优先导入 1 到 3 条高相关岗位文本，岗位必须属于销售、售前、解决方案、渠道或销售管理。
2. 复制内容必须包含岗位名称、公司、薪资、城市、职责、要求，以及能证明 AI/大模型/算力/硬件/行业场景相关性的关键词。
3. 同一公司同一岗位词如果没有销售相关结果，不要硬凑；记录为“无高相关岗位”，后续换岗位词或城市。
4. 本批导入后运行批后命令，让样本质量、Top10证据表、资料集审计和全量报告同步更新。

## 六、CSV输出

```text
/Users/MR/Documents/职场/01_行情收集/BOSS细分赛道Top10公司采样批次包.csv
```
