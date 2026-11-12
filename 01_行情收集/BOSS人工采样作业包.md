# BOSS人工采样作业包

更新时间：2026-06-30 09:34:45 Asia/Shanghai

## 一、本质判断

这份作业包不是自动采集脚本，而是 BOSS 风控恢复期的人工采样清单。它把 AI 全行业销售岗位调研拆成可逐条执行的搜索任务：打开 BOSS 首页、站内搜索关键词、人工判断岗位质量、复制岗位文本、用导入命令沉淀样本。

## 二、作业规模

| 优先级 | 任务数 | 说明 |
| --- | ---: | --- |
| P0 | 90 | 先补足大模型、云平台、智能客服/营销、AI芯片、AI服务器/智算 |
| P1 | 75 | 再补工业AI、RPA/Agent、数据/MLOps、机器人/具身、AI安全 |
| P2 | 24 | 最后补视觉安防质检、智算中心/IDC |
| 合计 | 189 | 每个任务建议人工挑选 1 条高相关岗位导入 |

## 三、执行方法

1. 每次只处理 1 个站内搜索关键词，不连续刷新。
2. 优先选择薪资可读、职责完整、客户类型清晰的销售/售前/销售管理岗位。
3. 复制岗位卡片或岗位详情全文。
4. 执行该行的导入命令。
5. 每导入 10 条后运行：

```bash
npm run summary:jobs
npm run report:full
npm run audit:research
```

## 四、前80条采样任务

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
| 19 | P0 | 云计算/大模型平台 | 阿里云 | AI销售 | https://www.zhipin.com/ | `阿里云 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "阿里云 AI销售" --company "阿里云" --role "AI销售" --city "广州"` |
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
| 31 | P0 | 云计算/大模型平台 | 科大讯飞 | AI销售 | https://www.zhipin.com/ | `科大讯飞 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "科大讯飞 AI销售" --company "科大讯飞" --role "AI销售" --city "广州"` |
| 32 | P0 | 云计算/大模型平台 | 科大讯飞 | 大客户销售 | https://www.zhipin.com/ | `科大讯飞 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "科大讯飞 大客户销售" --company "科大讯飞" --role "大客户销售" --city "广州"` |
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
| 44 | P0 | 智能客服/营销/销售AI | 容联云 | SaaS销售 | https://www.zhipin.com/ | `容联云 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 SaaS销售" --company "容联云" --role "SaaS销售" --city "广州"` |
| 45 | P0 | 智能客服/营销/销售AI | 容联云 | 销售经理 | https://www.zhipin.com/ | `容联云 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "容联云 销售经理" --company "容联云" --role "销售经理" --city "广州"` |
| 46 | P0 | 智能客服/营销/销售AI | 沃丰科技 | AI销售 | https://www.zhipin.com/ | `沃丰科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "沃丰科技 AI销售" --company "沃丰科技" --role "AI销售" --city "广州"` |
| 47 | P0 | 智能客服/营销/销售AI | 沃丰科技 | SaaS销售 | https://www.zhipin.com/ | `沃丰科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "沃丰科技 SaaS销售" --company "沃丰科技" --role "SaaS销售" --city "广州"` |
| 48 | P0 | 智能客服/营销/销售AI | 沃丰科技 | 销售经理 | https://www.zhipin.com/ | `沃丰科技 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "沃丰科技 销售经理" --company "沃丰科技" --role "销售经理" --city "广州"` |
| 49 | P0 | 智能客服/营销/销售AI | 智齿科技 | AI销售 | https://www.zhipin.com/ | `智齿科技 AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "智齿科技 AI销售" --company "智齿科技" --role "AI销售" --city "广州"` |
| 50 | P0 | 智能客服/营销/销售AI | 智齿科技 | SaaS销售 | https://www.zhipin.com/ | `智齿科技 SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "智齿科技 SaaS销售" --company "智齿科技" --role "SaaS销售" --city "广州"` |
| 51 | P0 | 智能客服/营销/销售AI | 智齿科技 | 销售经理 | https://www.zhipin.com/ | `智齿科技 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "智齿科技 销售经理" --company "智齿科技" --role "销售经理" --city "广州"` |
| 52 | P0 | 智能客服/营销/销售AI | Udesk | AI销售 | https://www.zhipin.com/ | `Udesk AI销售` | `npm run import:manual -- --source "BOSS直聘" --query "Udesk AI销售" --company "Udesk" --role "AI销售" --city "广州"` |
| 53 | P0 | 智能客服/营销/销售AI | Udesk | SaaS销售 | https://www.zhipin.com/ | `Udesk SaaS销售` | `npm run import:manual -- --source "BOSS直聘" --query "Udesk SaaS销售" --company "Udesk" --role "SaaS销售" --city "广州"` |
| 54 | P0 | 智能客服/营销/销售AI | Udesk | 销售经理 | https://www.zhipin.com/ | `Udesk 销售经理` | `npm run import:manual -- --source "BOSS直聘" --query "Udesk 销售经理" --company "Udesk" --role "销售经理" --city "广州"` |
| 55 | P0 | AI服务器/智算基础设施 | 超聚变 | 大客户销售 | https://www.zhipin.com/ | `超聚变 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 大客户销售" --company "超聚变" --role "大客户销售" --city "广州"` |
| 56 | P0 | AI服务器/智算基础设施 | 超聚变 | 行业销售 | https://www.zhipin.com/ | `超聚变 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 行业销售" --company "超聚变" --role "行业销售" --city "广州"` |
| 57 | P0 | AI服务器/智算基础设施 | 超聚变 | 售前 | https://www.zhipin.com/ | `超聚变 售前` | `npm run import:manual -- --source "BOSS直聘" --query "超聚变 售前" --company "超聚变" --role "售前" --city "广州"` |
| 58 | P0 | AI服务器/智算基础设施 | 华为 | 大客户销售 | https://www.zhipin.com/ | `华为 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为 大客户销售" --company "华为" --role "大客户销售" --city "广州"` |
| 59 | P0 | AI服务器/智算基础设施 | 华为 | 行业销售 | https://www.zhipin.com/ | `华为 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "华为 行业销售" --company "华为" --role "行业销售" --city "广州"` |
| 60 | P0 | AI服务器/智算基础设施 | 华为 | 售前 | https://www.zhipin.com/ | `华为 售前` | `npm run import:manual -- --source "BOSS直聘" --query "华为 售前" --company "华为" --role "售前" --city "广州"` |
| 61 | P0 | AI服务器/智算基础设施 | 浪潮信息 | 大客户销售 | https://www.zhipin.com/ | `浪潮信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "浪潮信息 大客户销售" --company "浪潮信息" --role "大客户销售" --city "广州"` |
| 62 | P0 | AI服务器/智算基础设施 | 浪潮信息 | 行业销售 | https://www.zhipin.com/ | `浪潮信息 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "浪潮信息 行业销售" --company "浪潮信息" --role "行业销售" --city "广州"` |
| 63 | P0 | AI服务器/智算基础设施 | 浪潮信息 | 售前 | https://www.zhipin.com/ | `浪潮信息 售前` | `npm run import:manual -- --source "BOSS直聘" --query "浪潮信息 售前" --company "浪潮信息" --role "售前" --city "广州"` |
| 64 | P0 | AI服务器/智算基础设施 | 联想 | 大客户销售 | https://www.zhipin.com/ | `联想 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "联想 大客户销售" --company "联想" --role "大客户销售" --city "广州"` |
| 65 | P0 | AI服务器/智算基础设施 | 联想 | 行业销售 | https://www.zhipin.com/ | `联想 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "联想 行业销售" --company "联想" --role "行业销售" --city "广州"` |
| 66 | P0 | AI服务器/智算基础设施 | 联想 | 售前 | https://www.zhipin.com/ | `联想 售前` | `npm run import:manual -- --source "BOSS直聘" --query "联想 售前" --company "联想" --role "售前" --city "广州"` |
| 67 | P0 | AI服务器/智算基础设施 | 新华三 | 大客户销售 | https://www.zhipin.com/ | `新华三 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "新华三 大客户销售" --company "新华三" --role "大客户销售" --city "广州"` |
| 68 | P0 | AI服务器/智算基础设施 | 新华三 | 行业销售 | https://www.zhipin.com/ | `新华三 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "新华三 行业销售" --company "新华三" --role "行业销售" --city "广州"` |
| 69 | P0 | AI服务器/智算基础设施 | 新华三 | 售前 | https://www.zhipin.com/ | `新华三 售前` | `npm run import:manual -- --source "BOSS直聘" --query "新华三 售前" --company "新华三" --role "售前" --city "广州"` |
| 70 | P0 | AI服务器/智算基础设施 | 中科曙光 | 大客户销售 | https://www.zhipin.com/ | `中科曙光 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "中科曙光 大客户销售" --company "中科曙光" --role "大客户销售" --city "广州"` |
| 71 | P0 | AI服务器/智算基础设施 | 中科曙光 | 行业销售 | https://www.zhipin.com/ | `中科曙光 行业销售` | `npm run import:manual -- --source "BOSS直聘" --query "中科曙光 行业销售" --company "中科曙光" --role "行业销售" --city "广州"` |
| 72 | P0 | AI服务器/智算基础设施 | 中科曙光 | 售前 | https://www.zhipin.com/ | `中科曙光 售前` | `npm run import:manual -- --source "BOSS直聘" --query "中科曙光 售前" --company "中科曙光" --role "售前" --city "广州"` |
| 73 | P0 | AI芯片/GPU/加速卡 | 壁仞科技 | 大客户销售 | https://www.zhipin.com/ | `壁仞科技 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "壁仞科技 大客户销售" --company "壁仞科技" --role "大客户销售" --city "广州"` |
| 74 | P0 | AI芯片/GPU/加速卡 | 壁仞科技 | 渠道销售 | https://www.zhipin.com/ | `壁仞科技 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "壁仞科技 渠道销售" --company "壁仞科技" --role "渠道销售" --city "广州"` |
| 75 | P0 | AI芯片/GPU/加速卡 | 壁仞科技 | 解决方案顾问 | https://www.zhipin.com/ | `壁仞科技 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "壁仞科技 解决方案顾问" --company "壁仞科技" --role "解决方案顾问" --city "广州"` |
| 76 | P0 | AI芯片/GPU/加速卡 | 海光信息 | 大客户销售 | https://www.zhipin.com/ | `海光信息 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 大客户销售" --company "海光信息" --role "大客户销售" --city "广州"` |
| 77 | P0 | AI芯片/GPU/加速卡 | 海光信息 | 渠道销售 | https://www.zhipin.com/ | `海光信息 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 渠道销售" --company "海光信息" --role "渠道销售" --city "广州"` |
| 78 | P0 | AI芯片/GPU/加速卡 | 海光信息 | 解决方案顾问 | https://www.zhipin.com/ | `海光信息 解决方案顾问` | `npm run import:manual -- --source "BOSS直聘" --query "海光信息 解决方案顾问" --company "海光信息" --role "解决方案顾问" --city "广州"` |
| 79 | P0 | AI芯片/GPU/加速卡 | 海思 | 大客户销售 | https://www.zhipin.com/ | `海思 大客户销售` | `npm run import:manual -- --source "BOSS直聘" --query "海思 大客户销售" --company "海思" --role "大客户销售" --city "广州"` |
| 80 | P0 | AI芯片/GPU/加速卡 | 海思 | 渠道销售 | https://www.zhipin.com/ | `海思 渠道销售` | `npm run import:manual -- --source "BOSS直聘" --query "海思 渠道销售" --company "海思" --role "渠道销售" --city "广州"` |

完整 CSV：

```text
/Users/MR/Documents/职场/01_行情收集/BOSS人工采样作业包.csv
```
