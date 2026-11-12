# BOSS重点公司补样批次包

更新时间：2026-07-01 01:34:48 Asia/Shanghai

## 一、本质判断

这份批次包不是替代全量人工采样包，而是专门补“用户点名/强关注方向”的证据缺口。它解决的是：月之暗面、智谱AI、MiniMax、芯片/半导体/智算基础设施等公司已经进入公司池和查询计划，但还没有进入当前批次或只有旧样本，导致薪资和能力要求不能写成 BOSS 结论。

当前最大的矛盾是：既要把重点公司尽快纳入 BOSS 样本闭环，又不能用自动打开、自动刷新、自动读取的方式触发风控。

## 二、执行边界

- 本文件只提供人工搜索入口和导入命令，不自动打开 BOSS。
- 先运行 `npm run auth:boss` 生成本地安全入口页，再在正常 Chrome 里手动打开入口页并访问 BOSS。
- 每条任务先进入 BOSS 首页，再在站内搜索框输入关键词；完整 URL 只保留在 CSV 的 referenceUrl 字段作审计，不作为操作入口。
- 每次只做一个批次，入口之间按人工阅读节奏停留。
- 每条样本必须是销售、售前、解决方案、渠道或销售管理相关岗位。

## 三、批次总览

| 指标 | 数值 |
| --- | ---: |
| 批次数 | 6 |
| 搜索入口 | 30 |
| 目标导入岗位数 | 66 |
| 用户点名/强关注入口 | 19 |
| 硬件/半导体/智算入口 | 16 |
| AI软件/云/MaaS入口 | 10 |

| 批次 | 模式 | 优先级 | 重点方向 | 入口数 | 目标导入 | 目标 |
| --- | --- | --- | --- | ---: | ---: | --- |
| BOSS-FOCUS-01 | 重点软硬件对照补样 | P0(5) | AI软件落地/大模型(3)、硬件/芯片/半导体/算力(2) | 5 | 15 | 补齐 AI软件落地/大模型(3)、硬件/芯片/半导体/算力(2) 的公司级BOSS证据闭环 |
| BOSS-FOCUS-02 | 重点软硬件对照补样 | P0(5) | 硬件/芯片/半导体/算力(3)、AI软件落地/大模型(2) | 5 | 15 | 补齐 硬件/芯片/半导体/算力(3)、AI软件落地/大模型(2) 的公司级BOSS证据闭环 |
| BOSS-FOCUS-03 | 重点软硬件对照补样 | P0(5) | 硬件/服务器/智算基础设施(4)、云/MaaS/大模型平台(1) | 5 | 15 | 补齐 硬件/服务器/智算基础设施(4)、云/MaaS/大模型平台(1) 的公司级BOSS证据闭环 |
| BOSS-FOCUS-04 | 重点软硬件对照补样 | P0(3)、P1(1)、P2(1) | 云/MaaS/大模型平台(2)、工业AI/智能制造(1)、硬件/芯片/半导体/算力(1)、智能汽车/机器人/具身智能(1) | 5 | 11 | 补齐 云/MaaS/大模型平台(2)、工业AI/智能制造(1)、硬件/芯片/半导体/算力(1)、智能汽车/机器人/具身智能(1) 的公司级BOSS证据闭环 |
| BOSS-FOCUS-05 | 重点软硬件对照补样 | P2(5) | 硬件/芯片/半导体/算力(3)、AI软件落地/大模型(2) | 5 | 5 | 补齐 硬件/芯片/半导体/算力(3)、AI软件落地/大模型(2) 的公司级BOSS证据闭环 |
| BOSS-FOCUS-06 | 重点芯片/半导体补样 | P2(5) | 硬件/服务器/智算基础设施(3)、工业AI/视觉/安防(2) | 5 | 5 | 补齐 硬件/服务器/智算基础设施(3)、工业AI/视觉/安防(2) 的公司级BOSS证据闭环 |

## 四、批次明细

## BOSS-FOCUS-01：重点软硬件对照补样

目标：补齐 AI软件落地/大模型(3)、硬件/芯片/半导体/算力(2) 的公司级BOSS证据闭环

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | AI软件落地/大模型 | MiniMax | AI销售 | 8K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `MiniMax AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "MiniMax AI销售" --company "MiniMax" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"` |
| 2 | P0 | AI软件落地/大模型 | DeepSeek | AI销售 | 20-30K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `DeepSeek AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "DeepSeek AI销售" --company "DeepSeek" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "20-30K"` |
| 3 | P0 | AI软件落地/大模型 | 百川智能 | AI销售 | 8K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `百川智能 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百川智能 AI销售" --company "百川智能" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"` |
| 4 | P0 | 硬件/芯片/半导体/算力 | 壁仞科技 | 大客户销售 | 40K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `壁仞科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "壁仞科技 大客户销售" --company "壁仞科技" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 5 | P0 | 硬件/芯片/半导体/算力 | 华为昇腾 | 大客户销售 | 40K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `华为昇腾 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为昇腾 大客户销售" --company "华为昇腾" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research
```

## BOSS-FOCUS-02：重点软硬件对照补样

目标：补齐 硬件/芯片/半导体/算力(3)、AI软件落地/大模型(2) 的公司级BOSS证据闭环

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | AI软件落地/大模型 | 阶跃星辰 | AI销售 | 8K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `阶跃星辰 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "阶跃星辰 AI销售" --company "阶跃星辰" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-02" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"` |
| 2 | P0 | AI软件落地/大模型 | 零一万物 | AI销售 | 8K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `零一万物 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "零一万物 AI销售" --company "零一万物" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-02" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"` |
| 3 | P0 | 硬件/芯片/半导体/算力 | 摩尔线程 | 大客户销售 | 40K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `摩尔线程 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "摩尔线程 大客户销售" --company "摩尔线程" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-02" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 4 | P0 | 硬件/芯片/半导体/算力 | 沐曦集成电路 | 大客户销售 | 40K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `沐曦集成电路 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "沐曦集成电路 大客户销售" --company "沐曦集成电路" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-02" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 5 | P0 | 硬件/芯片/半导体/算力 | 燧原科技 | 大客户销售 | 40K-70K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `燧原科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "燧原科技 大客户销售" --company "燧原科技" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-02" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research
```

## BOSS-FOCUS-03：重点软硬件对照补样

目标：补齐 硬件/服务器/智算基础设施(4)、云/MaaS/大模型平台(1) 的公司级BOSS证据闭环

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | 云/MaaS/大模型平台 | 腾讯云 | AI销售 | 10K-65K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `腾讯云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "腾讯云 AI销售" --company "腾讯云" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-03" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "10K-65K"` |
| 2 | P0 | 硬件/服务器/智算基础设施 | 华鲲振宇 | 大客户销售 | 20K-35K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `华鲲振宇 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "华鲲振宇 大客户销售" --company "华鲲振宇" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-03" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 3 | P0 | 硬件/服务器/智算基础设施 | 浪潮信息 | 大客户销售 | 20K-35K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `浪潮信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "浪潮信息 大客户销售" --company "浪潮信息" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-03" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 4 | P0 | 硬件/服务器/智算基础设施 | 新华三 | 大客户销售 | 20K-35K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `新华三 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "新华三 大客户销售" --company "新华三" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-03" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 5 | P0 | 硬件/服务器/智算基础设施 | 中科曙光 | 大客户销售 | 20K-35K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `中科曙光 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "中科曙光 大客户销售" --company "中科曙光" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-03" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research
```

## BOSS-FOCUS-04：重点软硬件对照补样

目标：补齐 云/MaaS/大模型平台(2)、工业AI/智能制造(1)、硬件/芯片/半导体/算力(1)、智能汽车/机器人/具身智能(1) 的公司级BOSS证据闭环

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P0 | 工业AI/智能制造 | 格创东智 | 大客户销售 | 15K-60K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `格创东智 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "格创东智 大客户销售" --company "格创东智" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-04" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "行业解决方案路线" --segment "工业AI/智能制造" --role-family "大客户/行业销售经理" --salary-band "15K-60K"` |
| 2 | P1 | 智能汽车/机器人/具身智能 | 黑芝麻智能 | 渠道销售 | 15K-60K | 缺人工批次 | 3 | `https://www.zhipin.com/` | `黑芝麻智能 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "黑芝麻智能 渠道销售" --company "黑芝麻智能" --role "渠道销售" --city "广州" --batch-id "BOSS-FOCUS-04" --batch-task "2" --batch-target-copies "3" --priority "P1" --route "行业解决方案路线" --segment "智能汽车/机器人/具身智能" --role-family "渠道/生态/伙伴销售" --salary-band "15K-60K"` |
| 3 | P0 | 云/MaaS/大模型平台 | 阿里云 | 解决方案顾问 | 35-65K·16薪 | 已有旧样本/缺当前人工批次 | 2 | `https://www.zhipin.com/` | `阿里云 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "阿里云 解决方案顾问" --company "阿里云" --role "解决方案顾问" --city "广州" --batch-id "BOSS-FOCUS-04" --batch-task "3" --batch-target-copies "2" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "售前/解决方案顾问" --salary-band "35-65K·16薪"` |
| 4 | P0 | 云/MaaS/大模型平台 | 科大讯飞 | 解决方案顾问 | 10K-65K | 已有旧样本/缺当前人工批次 | 2 | `https://www.zhipin.com/` | `科大讯飞 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "科大讯飞 解决方案顾问" --company "科大讯飞" --role "解决方案顾问" --city "广州" --batch-id "BOSS-FOCUS-04" --batch-task "4" --batch-target-copies "2" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "售前/解决方案顾问" --salary-band "10K-65K"` |
| 5 | P2 | 硬件/芯片/半导体/算力 | 海思 | 大客户销售 | 40K-70K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `海思 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海思 大客户销售" --company "海思" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-04" --batch-task "5" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research
```

## BOSS-FOCUS-05：重点软硬件对照补样

目标：补齐 硬件/芯片/半导体/算力(3)、AI软件落地/大模型(2) 的公司级BOSS证据闭环

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P2 | AI软件落地/大模型 | 昆仑万维 | AI销售 | 8K-70K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `昆仑万维 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "昆仑万维 AI销售" --company "昆仑万维" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-05" --batch-task "1" --batch-target-copies "1" --priority "P2" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"` |
| 2 | P2 | 硬件/芯片/半导体/算力 | 昆仑芯 | 大客户销售 | 40K-70K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `昆仑芯 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "昆仑芯 大客户销售" --company "昆仑芯" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-05" --batch-task "2" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 3 | P2 | AI软件落地/大模型 | 面壁智能 | AI销售 | 8K-70K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `面壁智能 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "面壁智能 AI销售" --company "面壁智能" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-05" --batch-task "3" --batch-target-copies "1" --priority "P2" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"` |
| 4 | P2 | 硬件/芯片/半导体/算力 | 平头哥 | 大客户销售 | 40K-70K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `平头哥 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "平头哥 大客户销售" --company "平头哥" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-05" --batch-task "4" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |
| 5 | P2 | 硬件/芯片/半导体/算力 | 天数智芯 | 大客户销售 | 40K-70K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `天数智芯 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "天数智芯 大客户销售" --company "天数智芯" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-05" --batch-task "5" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research
```

## BOSS-FOCUS-06：重点芯片/半导体补样

目标：补齐 硬件/服务器/智算基础设施(3)、工业AI/视觉/安防(2) 的公司级BOSS证据闭环

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| 1 | P2 | 硬件/服务器/智算基础设施 | 宝德计算 | 大客户销售 | 20K-35K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `宝德计算 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "宝德计算 大客户销售" --company "宝德计算" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-06" --batch-task "1" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 2 | P2 | 硬件/服务器/智算基础设施 | 联想 | 大客户销售 | 20K-35K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `联想 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "联想 大客户销售" --company "联想" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-06" --batch-task "2" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 3 | P2 | 硬件/服务器/智算基础设施 | 宁畅 | 大客户销售 | 20K-35K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `宁畅 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "宁畅 大客户销售" --company "宁畅" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-06" --batch-task "3" --batch-target-copies "1" --priority "P2" --route "硬件/算力/半导体路线" --segment "AI服务器/智算基础设施" --role-family "大客户/行业销售经理" --salary-band "20K-35K"` |
| 4 | P2 | 工业AI/视觉/安防 | 海康威视 | 大客户销售 | 15K-60K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `海康威视 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海康威视 大客户销售" --company "海康威视" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-06" --batch-task "4" --batch-target-copies "1" --priority "P2" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "15K-60K"` |
| 5 | P2 | 工业AI/视觉/安防 | 旷视科技 | 大客户销售 | 15K-60K | 缺人工批次 | 1 | `https://www.zhipin.com/` | `旷视科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "旷视科技 大客户销售" --company "旷视科技" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-06" --batch-task "5" --batch-target-copies "1" --priority "P2" --route "行业解决方案路线" --segment "AI视觉/安防/质检" --role-family "大客户/行业销售经理" --salary-band "15K-60K"` |

本批完成后运行：

```bash
npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research
```


## 五、CSV输出

```text
/Users/MR/Documents/职场/01_行情收集/BOSS重点公司补样批次包.csv
```
