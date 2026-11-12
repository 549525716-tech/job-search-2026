# Sweep Source Review

状态：历史采集执行者草稿，保留前35份原始结果时的手记，部分结论未被总控采纳；不是最终统计或验收凭据。最终结果以 `collection-notes.md`、`coverage.json`、`capture-inventory.json` 和 `review-resolution.json` 为准。销售易本次完整职责与要求提取数为0。

- 队列审计：raw 目录实际有 35 个请求文件，ledger 有 35 个 begin、34 个 finish。027-search-A-kingdee 只有 begin；同时存在实际神策 open 的 raw/027-open-A-sensorsdata-400.json，但没有对应 admission/finish。这是一次会话中断/重启过程中的未闭合证据，历史 ledger 不补写、不改写；最终不得宣称全部调用通过时间审计。
- A 已对多个冻结种子执行定向检索，五行业均有实际 query；本轮可直接回查的官方招聘正文集中在探迹、纷享销客、销售易、神策数据。
- B 已发现名单外雇主或渠道：Noumena、北京掌上先机网络科技有限公司、牛客科技、网易智企、湖南中项网科技有限公司、字节跳动/飞书商业化。Noumena 官方 career open 超时，保留为技术失败；第三方岗位不冒充官网。
- 搜索索引、合作伙伴申请页、商务合作页和 AI 洞察页仅作线索或业务背景，不能升级为职位直链、完整 JD 或固定底薪证据。
- 猎聘、BOSS、MiniMax/Moonshot/Zhipu ATS、第四范式等既有停止边界保持不变；未登录、未申请、未发送消息。
- jobs.json 与 extraction-specs.json 已由主控接管，本执行者不再修改；职责和要求逐字连续范围由主控从 raw 校验。
- 剩余预算 31 次，建议保留 4-6 次给 GPT-6 审核后的 B 查询，其余用于新公司有限波次和必要的公开来源核验；不为凑数量堆校招或技术岗位。
- 032 LinkedIn open 已返回 429，已停源；035 按指定 click 回查网易官方招聘，返回 non-retryable error。033 的第三方职位地点“深圳/地区广州市”冲突原样保留，不能擅自裁决。
- run.json 分列 raw_request_count=35、ledger_finish_count=34、tool_calls_queue_unclosed=1；后续每个新请求必须形成 begin→实际 web 调用→raw→finish 闭环。
