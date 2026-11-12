# 累计覆盖账本

`buildCoverageCampaign({ snapshots, companyDiscoveries, channelDefinitions })` 是离线纯函数。输出可重建的公司展示目标、六类渠道矩阵、独立 `source_scopes` 和逐条原始 `observations`。不会调用采集器、修改原始岗位、HR 或投递身份。

## 输入与身份

- `readCoverageSnapshot(directory)` 读取真实 `scope/coverage/jobs/run/capture-inventory/discoveries` 及其引用的 raw JSON，保存读取文件的路径和 SHA256。`coverage.json`、`jobs.json` 必须存在；可选文件缺失明确记录，不伪装成空扫描。
- scope 支持 `route_A_seeds`、`companies`、`industry_groups` 下的 `companies/company_seeds/route_A_seeds`；无公司种子的历史快照以 coverage 中的公司行保全目录目标。任何预算和分析数量不裁减总目标。09-11 实际缺少 scope 和 capture-inventory。
- 跨快照同一规范化展示名聚合为一行，所有原始观察、岗位 ID、HR 字段和来源分别保留。不同名字不进行法律主体归并。同名聚合只服务展示，`company_entity_unknown=true`，不声称经过公司实体认证。
- 新公司证据可提供 `company_name/industry/source_url/evidence_file/verbatim_quote/observed_at/source_purpose`。`source_purpose: industry_directory` 仅增加开放发现积压，不算招聘渠道访问。
- 未知 `source_kind` 原值保存在观察及渠道字段中，缺失值原文保留 null、渠道汇总显示 unknown。原始 URL 和历史时间不改成生成时间。

## 完整性与访问

六类渠道为官网及 ATS、BOSS、猎聘、其他招聘平台、公告和开放发现。每个展示目标均有全部渠道单元。渠道 `scope_complete=false`、`channel_exhausted=false` 恒定，渠道只记录访问、失败、暂停或待核验。

源范围按 `展示目标 + 渠道 + snapshot_id + source_id + scope_id` 隔离。只有同一条有日期及证据路径的访问记录，同时声明 `native_pagination_complete=true` 与 `detail_completion_complete=true`，才能完成这个明确源范围；也接受两个字段位于同一 `proof` 对象。不跨源、跨快照或跨记录 OR 拼证明。`job_count=0` 只有在该源范围证明成立时才是 `zero_with_proof`，未知和失败不记零。

已知暂停及访问拒绝保持阻塞。阻塞渠道下的源范围不能被普通岗位或后来的成功声明复活。读取历史记录不解除 halt，也不会发起新尝试。`attempted` 是输入中历史访问证据，不是本次生成器执行了网络访问。

coverage 父行只作为汇总证据保存，其混合 URLs 和 attempted 声明不证明某个平台被访问。访问依据是 source_outcomes 的精确 request、其关联 raw 记录，以及逐条已保存的非索引岗位证据。raw 中公司为空的泛词检索不能被父行归到某公司。无法解析的 `turn...` 引用保留原始 request，不猜实际访问的站点。

公司绑定以原始 capture 的公司名和 scope/coverage 明确声明的 `aliases` 为准。Alpha 父行引用 Beta 的具名回执时，回执保留在 Beta；父行仍保留，并在 `binding_conflicts` 输出双方名称、证据路径和 `pending_identity_review`，不给 Alpha 访问或完成证明。同一回执被多个父行引用只保留一份 capture 观察。未声明别名的不同名字保持待核。

reader 使用 `mergeCoverageCapture` 区分字段缺失与明确 null：raw 没有公司字段时，可以保留 capture-inventory 的具名绑定，并标 `company_binding_origin=capture_inventory`；raw 明确 `company:null` 时，保持未绑定，不能由 inventory 或父行补成具名查询。raw 具名始终优先，原始文件路径与 SHA 保留。

`source_kind=search_index` 即使 status 写 captured_job 也只是发现。公司定向的实际搜索 request 只计开放发现访问；索引里出现 BOSS／猎聘 URL 不计平台访问。每条岗位的完整原文、HR、原始 ID 独立保存在 observations；不会只保存同公司的最后一条。

## 汇总口径

- `catalog_targets`：全部目录输入中按展示名聚合后的目标数。
- `candidate_employer_records`：带雇主名的原始 job/discovery 观察数，并非公司数；不同 HR 和不同快照分别保留。
- `distinct_display_names`：目录及新发现合计的不重复展示名数；法律主体总数未知。
- `sources_pending`：尚无访问证据且未暂停的渠道单元数，包含入口待核，不是全网来源总数。
- `attempted`：有历史访问证据的渠道单元数，含开放发现搜索；`blocked` 单独统计。历史访问与现有暂停可能重叠。
- `scope_complete`：有完整证明且未被阻塞的明确源范围数量，绝不是完成渠道数。
- `unknown_market_total=null`，`market_complete=false`。

## CLI

```bash
node careers/coverage-campaign.mjs \
  --input 01_行情收集/official-careers/research/sweep-2026-09-13 \
  --input 01_行情收集/official-careers/research/sweep-2026-09-11 \
  --companies /absolute/path/company-evidence.json \
  --output 01_行情收集/official-careers/reports/coverage-campaign.json
```

重复 input 按实际目录去重；`--companies` 可省略，支持数组及 companies/discoveries/jobs/results 容器。输出只接受 reports 内的 JSON 文件，并生成不同路径的相邻 Markdown；拒绝越界路径、输出符号链接或硬链接、覆盖输入及 Markdown 输入碰撞。不会覆写 CLI/package 接线。

`--companies` JSON 还可包含 `channels: ["association", {"id":"niche_board"}]`，CLI 将其传给 `channelDefinitions`；对应 channel/channel_family/platform/source_kind 的精确值会进入扩展渠道单元。未知声明保留 `declared_channel` 与 `channel_definition_status=unrecognized_or_discovery_only`，原字段不丢弃。行业目录记录仍只进入开放发现，不因定义了新渠道而增加招聘访问。

Markdown 全中文，使用公司展示名，列出所有 pending/blocked/attempted/failed 单元、最近观察和下一步。JSON 的 evidence 为 observations ID，可追溯原始请求、文件和 source_kind。

## 验证与边界

运行 `node --test careers/tests/coverage-campaign.test.mjs`。测试包含真实 09-13 与 09-11 的只读集成，核对 75 条原始岗位全部保留、起始公司完整、同名跨期聚合、索引不计平台访问、暂停保留、重复输入幂等及输入文件 SHA256 未改变。统计通过测试诊断行输出，不生成运行数据或报告文件。

本模块校验的是输入证据的结构与归属边界，不能独立证明上游提交的分页声明真实，也不能把历史职位认定为当前在招。没有 source_id/scope_id 或完整证明的历史数据保持未完成。真实 CLI 的 channels 接线已通过 fs 模块内存 mock 验证，JSON/Markdown 写入均被截获，未生成实际报告文件。该测试子进程使用 Node 的 `--experimental-test-module-mocks`，并复用当前 Node 运行时。
