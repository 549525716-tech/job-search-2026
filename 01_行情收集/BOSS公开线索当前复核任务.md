# BOSS公开线索当前复核任务

更新时间：2026-07-20 22:11:29 Asia/Shanghai

## 一、当前状态

| 字段 | 内容 |
| --- | --- |
| 复核入口总数 | 529 |
| 已粘贴段落 | 0 |
| 可导入段落 | 0 |
| 估算岗位数 | 0 |
| 当前状态 | 等待人工复制岗位详情 |

## 二、当前只处理这一条

| 字段 | 内容 |
| --- | --- |
| 排名 | 1 |
| 公司 | 甲骨文 |
| 岗位 | 云销售总监 |
| 赛道 | 云计算/大模型平台 |
| 岗位族 | 销售管理/区域负责人 |
| 薪资参考 | 60-90K |
| 复核阶段 | BOSS首页优先复核 |
| 站内搜索关键词 | `甲骨文 云销售总监` |
| 来源 | BOSS公开页 |
| 公开来源URL | https://www.zhipin.com/zhaopin/6c185162d73070101HN60t6_/ |
| 粘贴命令 | npm run paste:public-review-current -- --rank 1 |
| 预检命令 | npm run sampling:public-review-status |
| 导入命令 | npm run import:public-review-inbox -- --dry-run && npm run import:public-review-inbox -- --refresh |

## 三、低频规则

1. 只从系统 Chrome 的 BOSS 首页进入，在站内搜索框输入当前关键词。
2. 本轮只处理这一条，不连续搜索多个关键词。
3. 复制 1 到 3 条岗位详情后停止。
4. 处理完本条后至少间隔 10-20 分钟；连续 3 条后冷却 30 分钟。
5. 不使用 9333/CDP/内置浏览器，不打开脚本搜索 URL，不批量刷新。

## 四、复制岗位时至少包含

- 岗位名称
- 公司名称
- 薪资
- 城市
- 经验
- 学历
- 岗位职责
- 任职要求

## 五、粘贴后运行

```bash
npm run paste:public-review-current -- --rank 1
npm run sampling:public-review-status
npm run import:public-review-inbox -- --dry-run
npm run import:public-review-inbox -- --refresh
```

## 六、相关文件

- `01_行情收集/BOSS公开高薪线索低频复核清单.md`
- `01_行情收集/BOSS公开线索复核收件箱.md`
- `01_行情收集/BOSS公开线索复核收件箱质量预检.md`
