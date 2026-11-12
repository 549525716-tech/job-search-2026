# BOSS首批人工采样执行单

更新时间：2026-07-01 01:34:48 Asia/Shanghai

## 一、本质判断

这份执行单不是新的搜索计划，而是把已有批次压缩成“最先动手的 12 个入口”。它解决的是：AI 软件落地公司、芯片/半导体/算力公司已经进入公司池和查询计划，但 BOSS 可用样本太少，薪资和能力要求不能写成大样本结论。

当前最大的矛盾是：既要尽快拿到能支撑报告的 BOSS 岗位详情，又不能通过自动打开、自动刷新或高频操作触发风控。

## 二、执行边界

- 本文件只提供 BOSS 首页、站内搜索关键词和导入命令，不自动打开 BOSS。
- 先运行 `npm run auth:boss` 生成本地安全入口页，再在正常 Chrome 里手动打开入口页并访问 BOSS。
- 运行 `npm run sampling:lowfreq` 生成单入口作业卡；实际操作时优先看作业卡，不要在一张大表里连续处理多个入口。
- 每次只做一个入口，按人工阅读节奏复制岗位详情，不连续快速跳转。
- 不投递、不打招呼、不绕过验证，只复制公开岗位信息后导入。
- 不要点击或粘贴完整 BOSS 搜索 URL；完整 URL 只保留在 CSV 的 `referenceUrl` 字段用于审计。

## 三、首批目标

| 指标 | 数值 |
| --- | ---: |
| 首批入口 | 12 |
| 目标导入岗位 | 36 |
| AI软件落地入口 | 4 |
| 硬件/算力/半导体入口 | 5 |
| 云/MaaS/行业方案入口 | 3 |

| 方向 | 入口数 | 目标导入 | 公司 |
| --- | ---: | ---: | --- |
| AI软件落地首批 | 4 | 12 | MiniMax、月之暗面、智谱AI、DeepSeek |
| 硬件/算力/半导体首批 | 5 | 15 | 海光信息、寒武纪、华为昇腾、壁仞科技、摩尔线程 |
| 云/MaaS/行业方案验证 | 3 | 9 | 华为云、火山引擎、百度智能云 |

## 四、执行顺序

| 排名 | 轮次 | 方向 | 公司 | 岗位词 | 薪资参考 | 目标导入 | 当前门禁 | 为什么先做 | BOSS首页 | 站内搜索关键词 |
| ---: | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| 1 | 第1轮：大模型软件 | AI软件落地首批 | MiniMax | AI销售 | 8K-70K | 3 | 未开始 | 用户点名/强关注AI软件公司；缺可用BOSS样本；缺可读薪资；已进入重点补样批次 | `https://www.zhipin.com/` | `MiniMax AI销售` |
| 2 | 第1轮：大模型软件 | AI软件落地首批 | 月之暗面 | 解决方案顾问 | 8K-12K | 3 | 未开始 | 用户点名/强关注AI软件公司；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `月之暗面 解决方案顾问` |
| 3 | 第1轮：大模型软件 | AI软件落地首批 | 智谱AI | 解决方案顾问 | 8K-12K | 3 | 未开始 | 用户点名/强关注AI软件公司；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `智谱AI 解决方案顾问` |
| 4 | 第1轮：大模型软件 | AI软件落地首批 | DeepSeek | AI销售 | 20-30K | 3 | 未开始 | 用户点名/强关注AI软件公司；缺可用BOSS样本；缺可读薪资；已进入重点补样批次 | `https://www.zhipin.com/` | `DeepSeek AI销售` |
| 5 | 第2轮：硬件算力 | 硬件/算力/半导体首批 | 海光信息 | 大客户销售 | 40K-70K | 3 | 未开始 | 芯片/半导体/算力硬件重点公司；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `海光信息 大客户销售` |
| 6 | 第2轮：硬件算力 | 硬件/算力/半导体首批 | 寒武纪 | 大客户销售 | 40K-70K | 3 | 未开始 | 芯片/半导体/算力硬件重点公司；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `寒武纪 大客户销售` |
| 7 | 第2轮：硬件算力 | 硬件/算力/半导体首批 | 华为昇腾 | 大客户销售 | 40K-70K | 3 | 未开始 | 芯片/半导体/算力硬件重点公司；缺可用BOSS样本；缺可读薪资；已进入重点补样批次 | `https://www.zhipin.com/` | `华为昇腾 大客户销售` |
| 8 | 第2轮：硬件算力 | 硬件/算力/半导体首批 | 壁仞科技 | 大客户销售 | 40K-70K | 3 | 未开始 | 芯片/半导体/算力硬件重点公司；缺可用BOSS样本；缺可读薪资；已进入重点补样批次 | `https://www.zhipin.com/` | `壁仞科技 大客户销售` |
| 9 | 第2轮：硬件算力 | 硬件/算力/半导体首批 | 摩尔线程 | 大客户销售 | 40K-70K | 3 | 未开始 | 芯片/半导体/算力硬件重点公司；缺可用BOSS样本；缺可读薪资；已进入重点补样批次 | `https://www.zhipin.com/` | `摩尔线程 大客户销售` |
| 10 | 第3轮：云与行业方案 | 云/MaaS/行业方案验证 | 华为云 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 3 | 未开始 | 云/MaaS/行业落地验证入口；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `华为云 AI销售` |
| 11 | 第3轮：云与行业方案 | 云/MaaS/行业方案验证 | 火山引擎 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 3 | 未开始 | 云/MaaS/行业落地验证入口；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `火山引擎 AI销售` |
| 12 | 第3轮：云与行业方案 | 云/MaaS/行业方案验证 | 百度智能云 | AI销售 | 大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K | 3 | 未开始 | 云/MaaS/行业落地验证入口；缺可用BOSS样本；缺可读薪资 | `https://www.zhipin.com/` | `百度智能云 AI销售` |

## 五、导入命令

### 1. MiniMax / AI销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "MiniMax AI销售" --company "MiniMax" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "8K-70K"
```

### 2. 月之暗面 / 解决方案顾问

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "月之暗面 解决方案顾问" --company "月之暗面" --role "解决方案顾问" --city "广州" --batch-id "BOSS-MANUAL-03" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "售前/解决方案顾问" --salary-band "8K-12K"
```

### 3. 智谱AI / 解决方案顾问

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "智谱AI 解决方案顾问" --company "智谱AI" --role "解决方案顾问" --city "广州" --batch-id "BOSS-MANUAL-05" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "售前/解决方案顾问" --salary-band "8K-12K"
```

### 4. DeepSeek / AI销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "DeepSeek AI销售" --company "DeepSeek" --role "AI销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "基座大模型/Agent平台" --role-family "AI软件/大模型销售" --salary-band "20-30K"
```

### 5. 海光信息 / 大客户销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "海光信息 大客户销售" --company "海光信息" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-01" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"
```

### 6. 寒武纪 / 大客户销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "寒武纪 大客户销售" --company "寒武纪" --role "大客户销售" --city "广州" --batch-id "BOSS-MANUAL-06" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"
```

### 7. 华为昇腾 / 大客户销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "华为昇腾 大客户销售" --company "华为昇腾" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "5" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"
```

### 8. 壁仞科技 / 大客户销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "壁仞科技 大客户销售" --company "壁仞科技" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-01" --batch-task "4" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"
```

### 9. 摩尔线程 / 大客户销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "摩尔线程 大客户销售" --company "摩尔线程" --role "大客户销售" --city "广州" --batch-id "BOSS-FOCUS-02" --batch-task "3" --batch-target-copies "3" --priority "P0" --route "硬件/算力/半导体路线" --segment "AI芯片/GPU/加速卡" --role-family "大客户/行业销售经理" --salary-band "40K-70K"
```

### 10. 华为云 / AI销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "华为云 AI销售" --company "华为云" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-05" --batch-task "2" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"
```

### 11. 火山引擎 / AI销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "火山引擎 AI销售" --company "火山引擎" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-08" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"
```

### 12. 百度智能云 / AI销售

复制岗位详情后运行：

```bash
npm run import:manual -- --source "BOSS直聘" --query "百度智能云 AI销售" --company "百度智能云" --role "AI销售" --city "广州" --batch-id "BOSS-TOP10-03" --batch-task "1" --batch-target-copies "3" --priority "P0" --route "AI软件落地路线" --segment "云计算/大模型平台" --role-family "AI软件/大模型销售" --salary-band "大客户/行业销售经理:10K-65K;售前/解决方案顾问:10K-65K;AI软件/大模型销售:30K-60K"
```


## 六、单入口验收规则

每个入口优先复制 2 到 3 条岗位详情。合格样本必须满足：

1. 岗位属于销售、售前、解决方案、渠道、商务或销售管理。
2. 正文能看出 AI、大模型、算力、硬件、半导体、云、工业或行业解决方案相关性。
3. 优先保留薪资、城市、经验、学历、职责、要求、客户类型、管理属性。
4. 排除纯研发、纯运营、客服、行政和与 AI/算力/硬件/行业场景无关的岗位。

每完成 1 到 2 个入口后运行：

```bash
npm run refresh:market

# 如需重新生成单入口低频作业卡
npm run sampling:lowfreq
```

## 七、CSV输出

```text
/Users/MR/Documents/职场/01_行情收集/BOSS首批人工采样执行单.csv
```
