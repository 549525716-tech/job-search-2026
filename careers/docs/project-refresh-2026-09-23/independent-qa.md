# 独立 QA：2026-09-23 项目更新

状态：passed_limited_scope。本轮局部实现及本地材料已通过独立审查；未遗留本范围 P1/P2。市场宽度业务验收仍未通过。

审核者为 `refresh_independent_qa`，由总控实际派发 `gpt-6-astra / xhigh`。未参与产品实现，仅提出缺陷、审查修复和执行独立验证；写入范围为本报告及运行后已清理的隔离测试夹具。实际派发参数不是独立计费遥测，Token 用量未知。

## 范围

已读取 AGENTS.md、official-career-intelligence 技能、变更前备份、工程说明、discovery 与 matching 实现及定向测试；核对根 README、careers/README、当前策略、方向文档、获客包、合成演示和空白台账。个人事实以当前画像/补充证据核对。本次未联网、未访问招聘浏览器、未调用实际采集源、未获取或清除共享采集锁；所有程序夹具传入独立 lease。

## 发现与返工

| 问题 | 可复现影响 | 最终处理 |
| --- | --- | --- |
| P1：recheck 的 null 只写入 manifest，run 仍传历史 entry.cursor | 完成来源的新批次会携带旧分页状态，无法保证重读当前列表；原新增测试只测准备阶段 | 首次 recheck 调用传 null；同批出现 partial 后继续使用本轮持久化游标；已独立复验 |
| P2：成功来源按固定次序反复占满小预算批次 | 两个 success 来源、maxCompanies=1，独立 prepare/run 夹具连续三轮均选 alpha，beta 永久排队 | 同 ready 等级统一按最近有效 attempts.finished_at 旧者优先，缺失最旧，queue_id 稳定收尾；已独立复验 |

P2 首次返工曾只对双方均为 recheck 的记录按时间排序，和其他记录按 ID 比较，可能形成非传递关系；已要求改为统一比较键。最终无此分支差异，三轮轮转和混入未尝试记录的排序均通过。

总控完整集成中间态曾出现一项旧停源测试失败：夹具依赖原插入顺序先执行 denied，新排序先执行了另外来源。该失败不证明首次 403 后仍有请求。独立裁决保留生产公平排序，在该隔离夹具中显式冻结 denied→sibling→healthy 的执行顺序并重算 manifest 摘要；不得删除同集团零请求、健康来源继续执行和后续批次仍停源的断言。修正后的最终完整 discovery 集成 23/23 通过，见最终回执节。

## 独立验证证据

- `node --test careers/tests/matching.test.mjs`：11/11 通过。
- 最终 discovery 无 DOM 定向集合：12/12 通过，覆盖准备复用、首轮 null、完成 no-op、三轮公平轮转、同级统一排序、partial 续页、冻结预算/当前来源导入等边界。
- 额外执行真实 prepare/run 的无网络夹具：既有 halt 原样保留，blocked 源 collector 调用为 0；已有 3 次 failed 的来源不进入新批，失败次数未重置。
- 额外读取真实 matching 配置：当前 Astra/xhigh、当前审核者名单为空、旧 max 审核者保存在历史区。无审核者时只能 pending，不可沿用简历；缺少 facts/hard-gates/source-quotes 任一检查、错误 cache_key/analysis_sha256、max/high/medium 执行档位均拒绝；独立 fixture 的合法 xhigh 回执可通过。
- 合成演示复制至临时目录运行：保存输出逐字重放一致；3 天边界、零余额、零消耗、负消耗、缺失余额 5 种输入符合说明，缺失不当零；输入摘要独立复算一致。没有改写交付目录的输出。
- 最终检查 35 个文档本地链接全部存在。

定向命令：

```bash
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node --test careers/tests/matching.test.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node --test --test-name-pattern='completed source enters|recheck run passes|rotate by actual|checkpoint resumes|mix|ordering|unattempted|open company/job/channel|CLI rejects|unchanged terminal pending|shared ATS|default current-sweep|current-sweep pointer rejects|CLI help' careers/tests/discovery-runtime.test.mjs
```

计数是各次检查的结果，存在覆盖重叠，不加总成独立功能数量。测试 fixture 的审核者和 collector 回执只存在于隔离上下文，不登记为真实 JD 审批或来源采集。

## 内容和事实边界

根 README、当前策略和最新方向采用人民币招聘月薪区间上界达到 20K 入池，固定底薪另核；客户成功、产品经理主岗排除。管理与长期 To B 是发展方向，不缩窄原始采集。方向文档明确岗位材料最近批次仍是 2026-09-22，本轮不是当天在招推荐。

10 人同期直管、210 家个人客户、累计带教与个人/团队效果在新材料中分开；示例管理权限与当前本人确认材料一致。未把内部 AI 工作流写成 AI 客户签约、外部 POC、团队提效或付费交付。

获客包中的 199 元、999 元均标为实验报价；合成例子不含真实客户或成交。台账 records=[]、payment_status=unknown_no_evidence_recorded，明确空台账不证明历史收入为零。未伪造线索、发布、发送、付款或验收。

当前 reviewer 白名单为空是安全关闭状态，不是已完成新 JD 匹配；本轮工程 QA 不能当作任一 JD 的语义复核。旧 max 历史未改写为 xhigh。

## 业务与运行边界

总控保存的 network-status.json 表明共享队列超时，实际网页调用 0，未强制解锁。该文件证明本次未取得新的外部证据，不证明任何来源已恢复。业务状态仍需保留 not_accepted / breadth not_passed；本轮新增市场覆盖为 0，未完成范围及下一波队列已在 summary 中展示。

完整既有 suite 的中间态回执为 312/312；其 scope 明确最后公平排序还需定向复跑，不作为最终代码的全量重跑声明。独立 QA 未重复尝试沙箱 Chrome，也不把环境失败猜成实现缺陷。

## 最终回执与限制

已独立回读总控运行保存的 `discovery-final.log` 和 `discovery-final-receipt.json`：最终受影响完整集成 23/23 通过、退出码 0。重新计算 discovery 实现/测试摘要，与回执绑定摘要一致。该集成由总控运行，独立 QA 审核其完整落盘日志与源码绑定；不冒称 QA 自己重复运行了 Chrome 集成。

已独立重算 `delivery-hashes.json` 的 16 个产品文件摘要，全部匹配。当前 discovery 实现 SHA-256 为 `50c6b1036d419db4d90e6c2f2d1b328e969ad61be21cb82317f7df64e73dccf2`，matching 为 `e2a9eebc69088bb18c15f3af875bb6719ab8cd7f182d14ead222e22e82264992`。

已回读 summary 与 progress 的 `project_refresh_2026_09_23` 记录：两轮测试计数标记重叠、实网调用 0、新增市场覆盖 0、未投递/发消息/发布/上传/启用调度；business_acceptance 与 before 备份逐值一致，仍为 not_accepted / not_passed。待回读状态记录已完成审查，总控可以将本轮工程状态改为 passed_limited_scope，不改变业务验收。

未遗留本范围 P1/P2。本结论只覆盖本轮局部实现和本地材料，不证明全市场已收齐、网站兼容性恢复、无人值守覆盖、正式岗位推荐或外部收入。

目标：全市场已收齐
