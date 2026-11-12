# BOSS采样进度看板

更新时间：2026-06-30 09:34:45 Asia/Shanghai

## 一、本质判断

这份看板不是新增采集动作，而是把 BOSS 人工采样任务和已沉淀岗位样本做对账。它回答三个问题：哪些赛道已经有样本，哪些赛道仍是空白，下一批应该优先采哪些公司和岗位词。

## 二、总体状态

| 指标 | 数值 |
| --- | ---: |
| 人工采样任务 | 189 |
| BOSS已沉淀岗位样本 | 4 |
| 已覆盖任务 | 3 |
| 待采样任务 | 186 |
| 已达标赛道 | 0 |
| 样本不足赛道 | 1 |
| 未开始赛道 | 11 |

## 三、优先级汇总

| 优先级 | 赛道数 | 目标样本 | 已有样本 | 缺口 | 未覆盖任务 |
| --- | ---: | ---: | ---: | ---: | ---: |
| P0 | 5 | 60 | 4 | 56 | 87 |
| P1 | 5 | 50 | 0 | 50 | 75 |
| P2 | 2 | 16 | 0 | 16 | 24 |

## 四、分赛道进度

| 优先级 | 赛道 | 状态 | 样本进度 | 样本缺口 | 任务覆盖 | 岗位词 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| P0 | 基座大模型/Agent平台 | 未开始 | 0/12 | 12 | 0/18 | AI销售;大模型销售;解决方案顾问 |
| P0 | 智能客服/营销/销售AI | 未开始 | 0/12 | 12 | 0/18 | AI销售;SaaS销售;销售经理 |
| P0 | AI服务器/智算基础设施 | 未开始 | 0/12 | 12 | 0/18 | 大客户销售;行业销售;售前 |
| P0 | AI芯片/GPU/加速卡 | 未开始 | 0/12 | 12 | 0/18 | 大客户销售;渠道销售;解决方案顾问 |
| P0 | 云计算/大模型平台 | 样本不足 | 4/12 | 8 | 3/18 | AI销售;大客户销售;解决方案顾问 |
| P1 | 工业AI/智能制造 | 未开始 | 0/10 | 10 | 0/15 | 大客户销售;销售经理;解决方案顾问 |
| P1 | 数据/MLOps/AI基础软件 | 未开始 | 0/10 | 10 | 0/15 | 大客户销售;解决方案顾问;售前 |
| P1 | 智能汽车/机器人/具身智能 | 未开始 | 0/10 | 10 | 0/15 | 渠道销售;海外销售;销售经理 |
| P1 | AI Agent/RPA/流程自动化 | 未开始 | 0/10 | 10 | 0/15 | AI销售;大客户销售;售前 |
| P1 | AI安全/私有化/信创 | 未开始 | 0/10 | 10 | 0/15 | 政企销售;大客户销售;销售经理 |
| P2 | 智算中心/数据中心服务 | 未开始 | 0/8 | 8 | 0/12 | 大客户销售;渠道销售;销售经理 |
| P2 | AI视觉/安防/质检 | 未开始 | 0/8 | 8 | 0/12 | 行业销售;渠道销售;售前 |

## 五、下一批优先任务

每次只处理 1 个站内搜索关键词，不连续刷新。复制岗位卡片或详情后，执行对应导入命令。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | P0 | 基座大模型/Agent平台 | 阶跃星辰 | AI销售 | https://www.zhipin.com/ | `阶跃星辰 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "阶跃星辰 AI销售" --company "阶跃星辰" --role "AI销售" --city "广州"` |
| 2 | P0 | 基座大模型/Agent平台 | 阶跃星辰 | 大模型销售 | https://www.zhipin.com/ | `阶跃星辰 大模型销售` | `npm run import:manual -- --source "BOSS直聘" --query "阶跃星辰 大模型销售" --company "阶跃星辰" --role "大模型销售" --city "广州"` |
| 3 | P0 | 基座大模型/Agent平台 | 阶跃星辰 | 解决方案顾问 | https://www.zhipin.com/ | `阶跃星辰 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "阶跃星辰 解决方案顾问" --company "阶跃星辰" --role "解决方案顾问" --city "广州"` |
| 4 | P0 | 基座大模型/Agent平台 | 商汤科技 | AI销售 | https://www.zhipin.com/ | `商汤科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 AI销售" --company "商汤科技" --role "AI销售" --city "广州"` |
| 5 | P0 | 基座大模型/Agent平台 | 商汤科技 | 大模型销售 | https://www.zhipin.com/ | `商汤科技 大模型销售` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 大模型销售" --company "商汤科技" --role "大模型销售" --city "广州"` |
| 6 | P0 | 基座大模型/Agent平台 | 商汤科技 | 解决方案顾问 | https://www.zhipin.com/ | `商汤科技 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "商汤科技 解决方案顾问" --company "商汤科技" --role "解决方案顾问" --city "广州"` |
| 7 | P0 | 基座大模型/Agent平台 | 月之暗面 | AI销售 | https://www.zhipin.com/ | `月之暗面 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 AI销售" --company "月之暗面" --role "AI销售" --city "广州"` |
| 8 | P0 | 基座大模型/Agent平台 | 月之暗面 | 大模型销售 | https://www.zhipin.com/ | `月之暗面 大模型销售` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 大模型销售" --company "月之暗面" --role "大模型销售" --city "广州"` |
| 9 | P0 | 基座大模型/Agent平台 | 月之暗面 | 解决方案顾问 | https://www.zhipin.com/ | `月之暗面 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "月之暗面 解决方案顾问" --company "月之暗面" --role "解决方案顾问" --city "广州"` |
| 10 | P0 | 基座大模型/Agent平台 | 智谱AI | AI销售 | https://www.zhipin.com/ | `智谱AI AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI AI销售" --company "智谱AI" --role "AI销售" --city "广州"` |
| 11 | P0 | 基座大模型/Agent平台 | 智谱AI | 大模型销售 | https://www.zhipin.com/ | `智谱AI 大模型销售` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI 大模型销售" --company "智谱AI" --role "大模型销售" --city "广州"` |
| 12 | P0 | 基座大模型/Agent平台 | 智谱AI | 解决方案顾问 | https://www.zhipin.com/ | `智谱AI 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "智谱AI 解决方案顾问" --company "智谱AI" --role "解决方案顾问" --city "广州"` |
| 13 | P0 | 基座大模型/Agent平台 | DeepSeek | AI销售 | https://www.zhipin.com/ | `DeepSeek AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "DeepSeek AI销售" --company "DeepSeek" --role "AI销售" --city "广州"` |
| 14 | P0 | 基座大模型/Agent平台 | DeepSeek | 大模型销售 | https://www.zhipin.com/ | `DeepSeek 大模型销售` | `npm run import:manual -- --source "BOSS直聘" --query "DeepSeek 大模型销售" --company "DeepSeek" --role "大模型销售" --city "广州"` |
| 15 | P0 | 基座大模型/Agent平台 | DeepSeek | 解决方案顾问 | https://www.zhipin.com/ | `DeepSeek 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "DeepSeek 解决方案顾问" --company "DeepSeek" --role "解决方案顾问" --city "广州"` |
| 16 | P0 | 基座大模型/Agent平台 | MiniMax | AI销售 | https://www.zhipin.com/ | `MiniMax AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "MiniMax AI销售" --company "MiniMax" --role "AI销售" --city "广州"` |
| 17 | P0 | 基座大模型/Agent平台 | MiniMax | 大模型销售 | https://www.zhipin.com/ | `MiniMax 大模型销售` | `npm run import:manual -- --source "BOSS直聘" --query "MiniMax 大模型销售" --company "MiniMax" --role "大模型销售" --city "广州"` |
| 18 | P0 | 基座大模型/Agent平台 | MiniMax | 解决方案顾问 | https://www.zhipin.com/ | `MiniMax 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "MiniMax 解决方案顾问" --company "MiniMax" --role "解决方案顾问" --city "广州"` |
| 20 | P0 | 云计算/大模型平台 | 阿里云 | 大客户销售 | https://www.zhipin.com/ | `阿里云 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "阿里云 大客户销售" --company "阿里云" --role "大客户销售" --city "广州"` |
| 21 | P0 | 云计算/大模型平台 | 阿里云 | 解决方案顾问 | https://www.zhipin.com/ | `阿里云 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "阿里云 解决方案顾问" --company "阿里云" --role "解决方案顾问" --city "广州"` |
| 22 | P0 | 云计算/大模型平台 | 百度智能云 | AI销售 | https://www.zhipin.com/ | `百度智能云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 AI销售" --company "百度智能云" --role "AI销售" --city "广州"` |
| 23 | P0 | 云计算/大模型平台 | 百度智能云 | 大客户销售 | https://www.zhipin.com/ | `百度智能云 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 大客户销售" --company "百度智能云" --role "大客户销售" --city "广州"` |
| 24 | P0 | 云计算/大模型平台 | 百度智能云 | 解决方案顾问 | https://www.zhipin.com/ | `百度智能云 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "百度智能云 解决方案顾问" --company "百度智能云" --role "解决方案顾问" --city "广州"` |
| 25 | P0 | 云计算/大模型平台 | 华为云 | AI销售 | https://www.zhipin.com/ | `华为云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 AI销售" --company "华为云" --role "AI销售" --city "广州"` |
| 26 | P0 | 云计算/大模型平台 | 华为云 | 大客户销售 | https://www.zhipin.com/ | `华为云 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 大客户销售" --company "华为云" --role "大客户销售" --city "广州"` |
| 27 | P0 | 云计算/大模型平台 | 华为云 | 解决方案顾问 | https://www.zhipin.com/ | `华为云 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "华为云 解决方案顾问" --company "华为云" --role "解决方案顾问" --city "广州"` |
| 28 | P0 | 云计算/大模型平台 | 火山引擎 | AI销售 | https://www.zhipin.com/ | `火山引擎 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 AI销售" --company "火山引擎" --role "AI销售" --city "广州"` |
| 29 | P0 | 云计算/大模型平台 | 火山引擎 | 大客户销售 | https://www.zhipin.com/ | `火山引擎 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 大客户销售" --company "火山引擎" --role "大客户销售" --city "广州"` |
| 30 | P0 | 云计算/大模型平台 | 火山引擎 | 解决方案顾问 | https://www.zhipin.com/ | `火山引擎 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "火山引擎 解决方案顾问" --company "火山引擎" --role "解决方案顾问" --city "广州"` |
| 33 | P0 | 云计算/大模型平台 | 科大讯飞 | 解决方案顾问 | https://www.zhipin.com/ | `科大讯飞 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "科大讯飞 解决方案顾问" --company "科大讯飞" --role "解决方案顾问" --city "广州"` |
| 34 | P0 | 云计算/大模型平台 | 腾讯云 | AI销售 | https://www.zhipin.com/ | `腾讯云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "腾讯云 AI销售" --company "腾讯云" --role "AI销售" --city "广州"` |
| 35 | P0 | 云计算/大模型平台 | 腾讯云 | 大客户销售 | https://www.zhipin.com/ | `腾讯云 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "腾讯云 大客户销售" --company "腾讯云" --role "大客户销售" --city "广州"` |
| 36 | P0 | 云计算/大模型平台 | 腾讯云 | 解决方案顾问 | https://www.zhipin.com/ | `腾讯云 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "腾讯云 解决方案顾问" --company "腾讯云" --role "解决方案顾问" --city "广州"` |
| 37 | P0 | 智能客服/营销/销售AI | 百应科技 | AI销售 | https://www.zhipin.com/ | `百应科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 AI销售" --company "百应科技" --role "AI销售" --city "广州"` |
| 38 | P0 | 智能客服/营销/销售AI | 百应科技 | SaaS销售 | https://www.zhipin.com/ | `百应科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 SaaS销售" --company "百应科技" --role "SaaS销售" --city "广州"` |
| 39 | P0 | 智能客服/营销/销售AI | 百应科技 | 销售经理 | https://www.zhipin.com/ | `百应科技 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "百应科技 销售经理" --company "百应科技" --role "销售经理" --city "广州"` |
| 40 | P0 | 智能客服/营销/销售AI | 七陌 | AI销售 | https://www.zhipin.com/ | `七陌 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 AI销售" --company "七陌" --role "AI销售" --city "广州"` |
| 41 | P0 | 智能客服/营销/销售AI | 七陌 | SaaS销售 | https://www.zhipin.com/ | `七陌 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 SaaS销售" --company "七陌" --role "SaaS销售" --city "广州"` |
| 42 | P0 | 智能客服/营销/销售AI | 七陌 | 销售经理 | https://www.zhipin.com/ | `七陌 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "七陌 销售经理" --company "七陌" --role "销售经理" --city "广州"` |
| 43 | P0 | 智能客服/营销/销售AI | 容联云 | AI销售 | https://www.zhipin.com/ | `容联云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 AI销售" --company "容联云" --role "AI销售" --city "广州"` |

## 六、文件

```text
/Users/MR/Documents/职场/01_行情收集/BOSS采样进度看板.csv
/Users/MR/Documents/职场/01_行情收集/BOSS采样任务状态.csv
```
