# Search Index Offline Processing

> 历史开发快照：下文15次查询及279条结果是脚本首次验证时的数量，不是本轮最终扫描量。当前数量以重建后的 `search-index.json.counts`、`report-run.json.counts` 和 `summary.md` 为准。脚本保留相同的确定性解析与证据边界。

## 状态

本轮只做本地确定性解析和索引生成：不联网、不操作浏览器、不外发，不修改 `raw`、`catalog-plan`、config 或 progress。当前主控的 raw 目录由单一主控写入，本处理不重复取证，只读取已落盘的搜索回执。

## 输入 Shape

- 当前 raw 目录有 15 个已完成搜索 capture：`a01`-`a08`、`b01`-`b07`。主控在本轮处理期间新增了 `b06`、`b07`，脚本按 raw 当前状态重建。
- 项目既有搜索分段规则为 `/-{20,}/`；脚本复用该规则，分隔后的每一段原文完整保留。
- 现有文件实际使用顶层 `result` 字符串；脚本同时兼容 `capture.result` 字符串，缺少完成字符串的记录会进入 skipped，不猜测结果。
- 每个条目保留 `heading_raw`、`title_raw`、实际 URL、完整 `summary_raw`、`capture_id`、query、target company、route、时间、capture SHA 和分段 SHA。

## 产物

- `search-index.mjs`：可重复从当前目录 `raw/*.json` 离线重建两个 JSON；不调用网络或浏览器。
- `search-index.json`：所有原始结果分段的程序索引，不做模型摘要、不删除商业词命中。
- `source-candidates.json`：按实际 URL 精确去重的来源候选；同一 URL 的不同 query/capture 证据放在同一 URL 项的 `evidence` 数组中。

## 当前验证结果

| 项目 | 数量 |
| --- | ---: |
| raw 文件 | 15 |
| 完成的 search capture | 15 |
| 原始结果分段 | 279 |
| 带 URL 的结果条目 | 264 |
| 无法从分段首部解析 URL 的条目 | 15 |
| URL 去重后的来源 | 255 |
| 非已知隔离来源候选 | 231 |
| 隔离待补来源 | 24 |

capture 分段数如下：`a01=25`、`a02=18`、`a03=19`、`a04=18`、`a05=23`、`a06=18`、`a07=20`、`a08=18`、`b01=18`、`b02=18`、`b03=18`、`b04=18`、`b05=17`、`b06=18`、`b07=13`。

已抽查首尾条目的标题、URL 和 SHA：首条为 `a01-r001`，标题 `ZHIPU AI OPEN PLATFORM`；末条为 `b07-r013`，标题和 URL 可在 JSON 回查。每条结果和 capture 均保存 SHA。

## 分类边界

- `source_kind=entry`：结果 URL/原文呈现招聘入口、加入我们、人才或 careers/jobs 入口，但不因此声称已取得全站岗位。
- `source_kind=job`：URL 路径呈现职位详情或明确单岗位路径；仍不代表已取得完整 JD 或当前在招。
- `source_kind=unknown`：无法由固定 URL/文本规则稳定判断，保留原文待主控处理。
- `source_origin_hint` 只表示官网候选或第三方候选的程序提示，不是法律主体或雇主核验。
- `target_company` 是查询范围字段，永远不写入返回条目的 employer；`employer` 和 `legal_entity` 在来源候选中保持 `null`，除非后续有独立证据。
- 搜索摘要只作为线索；不把摘要、标题或搜索结果页包装成 JD、职位详情、在招确认或公司法律实体。

## 隔离与后续读取

- BOSS、猎聘以及 MiniMax 相关隔离 URL 仅标记 `isolated_pending`，没有访问、刷新、绕过或替代验证。
- 其余 231 个 URL 只是 `candidate_for_independent_read`，表示可供后续主控按来源准入读取，不表示本轮已经读取或验证可访问。
- 來源候选按实际 URL 去重，不按标题、target company、摘要中的公司名或猜测法律实体去重。
- 所有 279 个原始结果分段都在 `search-index.json.results` 保留；商业词只用于后续线索筛选，不作为本轮删除条件。

## 重建命令

在项目根目录执行：

```bash
node 01_行情收集/official-careers/research/market-wide-2026-09-22/search-index.mjs
```

该命令只读取本目录 `raw`，并重写本任务允许的 `search-index.json` 与 `source-candidates.json`。
