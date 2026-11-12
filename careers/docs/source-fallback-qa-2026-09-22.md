# 来源级兜底独立 QA

结论：本次限定复验通过。原 P1、薪资 P2 保持关闭，角色 P2 在 v10 关闭；本报告所列未解决 P1/P2 为 0。最后只读复验：2026-09-22 01:11:20（Asia/Shanghai）。本轮仅复验最后原反例、已列正反例和动鑫两条实际 JD，没有重跑 35 项测试、数据源审计或全市场研究；技术问题关闭不等于市场宽度通过。

## 角色 P2 已关闭

### v10 区分资格豁免与职责否定

- 位置：[role-policy.mjs:4](/Users/MR/Documents/职场/careers/role-policy.mjs:4)。新增 `hasNegatedDuty` 先剔除资格豁免，再检查商业职责否定；显式职责动词不按资格豁免移除。
- 原遗漏正例 `负责客户社群与内容运营，无需销售经验。` 和前置 `无需行业销售经验，负责市场增长与客户获客。` 均正确 primary。
- 无需出差在前/后、不参与设备巡检三条正例均仍 primary；“不承担市场增长职责”“无需负责客户获客”“不参与客户社群内容运营”三条负例均仍 excluded。
- `无需承担客户获客职责，有销售经验者优先。` 正确 excluded，未因后面的经验表述抹掉显式职责否定。原报告中的这一缺陷已关闭，不继续扩词或启动第四轮修复。

## v10 定向复验

- 仅运行 `node --test --test-name-pattern='fallback real operations director' careers/tests/role-policy.test.mjs`：1/1 测试通过，没有执行该文件其他测试。
- 另直接调用现有函数核对 9 条已列输入：9/9 通过，覆盖上述 5 条正例、3 条原否定反例和 1 条显式职责否定加经验偏好的反例；没有扩展新语义研究。
- 动鑫运营总监、运营专员的真实 JD 当前计算均为 primary；2026-09-21T17:10:47.161Z 重建的 decision JSON 中两条同为 primary，仍未评分。没有变更原始 JD 或重新采集。
- 未重验本轮新 HTML 的视觉回执或薪资逻辑；下方持久化、薪资、全量集成与视觉结论明确保留为前轮证据，不冒充本次执行。

## 已关闭问题

### P1：持久化错误后继续下一来源

- 新 [persistence.mjs:1](/Users/MR/Documents/职场/careers/persistence.mjs:1) 统一保留 `COLLECTION_PERSISTENCE_FAILED`、阶段及 cause；fallback 同时识别标记、failure_scope、旧采集器 fs syscall+path。
- 已静态核对 collector 的数据库 open/begin/finish/report/close，以及 HTTP 的 raw 目录、request/response/robots 证据写入均经过包装；内层捕获回传保留标记与阶段。
- 独立运行测试覆盖 EROFS、EMFILE、未知 errno 的抛出/返回两路径，均仅调用首源、批次 terminated、后源未启动、落盘不标成功；旧 fs 异常也停止。
- 真实 DB 目录失败与 HTTP 证据目录失败均在请求前标记为持久化故障，HTTP 准入调用数 0；未启动 DOM/浏览器、未获取共享 lease。原检查点写入失败、SQLite/队列错误停止和单源失败继续测试仍通过。
- 此项关闭。这里的失败注入是离线证据，不表示本轮实网发生过磁盘故障。

### P2：月薪区间外加提成被挡在机会池外

- 新解析仅接受严格独立数值区间加提成，保留 `salary_raw`，增加 `salary_range_raw` 与 `range_plus_commission`；不把提成加到数值区间。
- 实际销售总监原文 `30K-50K·14薪 + 提成`：解析 30000–50000、14 薪，招聘区间 eligible=true；固定底薪 eligible=false/pending=true。
- 纯提成、综合收入、含提成总额、底薪加另一金额、OTE、外币、年薪反例未进入月薪机会池；8–14K/月加提成仍 below_target。此项关闭。
- 原数据仍未确认固定底薪，进入机会池不等于收入保障、匹配通过或建议投递。

## 前轮验证

- Node v24.19.0，命令：
  `node --test careers/tests/persistence.test.mjs careers/tests/fallback.test.mjs careers/tests/salary-target.test.mjs careers/tests/role-policy.test.mjs`
- 独立实跑 35/35 通过；上述新增同句误排反例不在现有测试中，另行离线复现。主线程最终回传本轮 careers:test 306/306、批次 build.test 2/2 通过；本 QA 未重跑全量，按主线程执行回执记录，不冒充本 QA 独立全量验收。
- 已保存 decision JSON 生成时间 2026-09-21T17:02:38.034Z：销售总监、运营总监、运营专员的角色与薪资状态逐条等于当前函数计算；三条原文薪资不变、均未评分。销售总监/运营总监进区间池，运营专员因 8–14K 不进区间池但仍保留商业主线。
- 前轮最终集成 JSON 小范围回查：本批 54 条观察、6 条商业候选、1 条正文待复核，累计招聘区间池 71；计数相符，不代表匹配达标或市场宽度通过。
- 原产品经理仍 excluded，产品运营/FDE 仍 exploratory 且默认不进主线，研发仍 excluded；修复不改变这些优先边界。
- 最新视觉回执时间 2026-09-21T17:03:22.662Z，其报告 SHA 与当前 HTML 一致。本 QA 只读回执和生成文件，未运行视觉测试、未操作浏览器、未重新验收全站。
- 前轮已核验 HTML SHA256：`a93b226340c35ea9c82538a64f99afb295cbff1ac118f5a180828abe823310bd`；不作为 v10 重建后 HTML 的当前 SHA。

## 保留的批次结论

以下延续前轮独立核验；本轮确认 jobs SHA 未变化，不重新采集或重复全量检查。

- 54 条观察、5 家公司；54 条源全文已保存，20 条职责/要求双字段完整，34 条 DeepSeek 源全文未拆分。不是 54 个新增岗位。
- 正式 manifest `fallback-221a2908-0e82-4991-a300-5088f1a6f131`：MiniMax blocked、无 run_id；百炼 success 4、DeepSeek success 34。前轮 54 个正文 SHA 与 38 个 supporting metadata SHA 共 92 项通过。
- 网页 16 条为京东 1、动鑫 7、朗矽 8；o02 只记入口，o03/o06 超时无岗位入表，搜索摘要只入 backlog。未知薪资/底薪未补造。
- 8 web + 8 HTTP 已记录请求无重叠，实际 finish-to-start 最小 10729ms；保护平台页面请求 0。live-verification 只证明已记录活动，不证明历史登录恢复或长期无人值守能力。
- DeepSeek 原文逐字保留，`source_description_complete=true`、`full_source_not_split`、双字段 `description_complete=false`；34 条保存状态、全文标题和未拆分提示已在前轮核对。
- MiniMax 隔离、旧 halt、BOSS/猎聘普通 IAB 控制隔离继续保留；来源级成功不补齐故障平台或 HR 入口。
- 市场宽度仍未验收，`market_scan_complete=false`、`login_repaired=false`。商业主线展示不等于评分、推荐或宽度通过。
- 前轮 SIGTERM 假采集验证保留已完成源检查点；中断源仍 running、finished_at=null。未验收自动续跑或优雅中断终态，恢复不得按成功处理。

## 独立性与基线

仅本报告有持久写入；代码/正式数据只读，测试临时目录自动清理。未联网、未占真实队列、未启动或操作浏览器、未改实现或重建报告。

主线程本轮明确声明已用真实调度参数 `gpt-6-astra / xhigh` 派发本 QA。此处记录主线程提供的调度信息，不从代理自感知推断模型；本 QA 当前可见上下文未重新读取原 dispatch 回执，因此不补造 agent ID。

- fallback SHA256：`4f4e932a2e3079d391401d427c2c4088079162477b1b3f9c705652386d052186`
- persistence SHA256：`be8d087380a9f1c432c776378f6311e646717e04c40c9e66e72943fc71e1aff1`
- role-policy v10 SHA256：`7991aea09dca407e1798bb9cd142826a0cfd74167bd55fe38b9ac842eafb4fd8`
- jobs SHA256（未变）：`a52f90c89ce5135f9308ec8554a9b1ff4dd412ff4f770c29aa7c04d28e6fe649`

本项验收结束。启发式分类不代表通用语义理解或候选人达标，原始 JD 继续保留；没有在本次限定范围内观察到剩余缺陷。不重跑已关闭项目、实网或全市场研究。
