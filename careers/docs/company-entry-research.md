# 公司官网岗位入口核验

核验日期：2026-09-09
范围：公司主页到官方招聘入口的归属链。
边界：本文件不是岗位清单、排名或采集授权；未打开招聘详情、未调用招聘接口、未发起投递，也未访问个人资料或简历。公司登记本身不批准 provider 配置，需由 core/main 单独审批。

## 结论

本轮登记 10 家公司，按官方来源核验入口，不作“Top10”或其他排名结论。`verified` 表示已经找到与公司主体匹配的官方主页/官方招聘入口证据，不表示入口当前有岗位、岗位仍有效、接口可采集或适合用户。

| 公司 | 总部口径（不是job city） | 官方主页 | 招聘入口 | 状态 | 入口判断 |
| --- | --- | --- | --- | --- | --- |
| [MiniMax](https://www.minimax.cn/) | 上海 | [官网](https://www.minimax.cn/) | [加入我们](https://www.minimax.cn/careers) → [飞书招聘](https://vrfi1sk8a0.jobs.feishu.cn/index/) | `verified` | 官网页直接出现“查看所有职位”并链接飞书招聘；未读岗位详情。 |
| [月之暗面](https://www.moonshot.ai/) | 北京 | [官网](https://www.moonshot.ai/) | [Kimi社会招聘](https://careers.kimi.com/social) | `verified` | 当前官方招聘站为 `careers.kimi.com`；方案文档中的旧Moka候选地址标为历史线索。 |
| [DeepSeek](https://www.deepseek.com/zh/) | 杭州 | [官网](https://www.deepseek.com/zh/) | [人才站](https://talent.deepseek.com/) | `verified` | DeepSeek官网明确出现“加入我们”和 `talent.deepseek.com`。 |
| [智谱](https://www.zhipuai.cn/) | 北京 | [官网](https://www.zhipuai.cn/) | [加入我们](https://www.zhipuai.cn/zh/joinus) | `verified` | 官方招聘页显示社会招聘、销售及产品/项目类别；未把职位类别当作当前岗位快照。 |
| [百炼智能](https://www.bailian-ai.com/) | 北京 | [官网](https://www.bailian-ai.com/) | [加入我们](https://www.bailian-ai.com/joinus) | `verified` | 官网导航和招聘页均匹配北京百炼智能主体；页面职位日期为历史信息。 |
| [第四范式](https://www.4paradigm.com/) | 北京 | [官网](https://www.4paradigm.com/) | [招聘页](https://www.4paradigm.com/about/hr.html) | `candidate` | 只有官方搜索摘要，页面正文打开超时；不算完成实时网页核验。 |
| [科大讯飞](https://www.iflytek.com/cn/) | 合肥 | [官网](https://www.iflytek.com/cn/) | [招聘承接页](https://sp.wintalent.cn/iflytek/index.html) | `candidate` | 搜索结果显示科大讯飞招聘页，但官网正文直链本轮无法读取，需人工确认授权归属。 |
| [火山引擎](https://www.volcengine.com/) | 北京 | [官网](https://www.volcengine.com/) | [招聘页](https://www.volcengine.com/jobs) | `verified` | 官方jobs页显示火山引擎招聘，并标明“字节跳动旗下的云服务平台”；页面需JavaScript。 |
| [阿里云](https://www.aliyun.com/) | 杭州 | [官网](https://www.aliyun.com/) | [阿里云招聘](https://careers.aliyun.com/home?lang=zh) | `verified` | 官方招聘域名显示招聘官网、社会招聘和校园招聘；页面重定向不改变归属判断。 |
| [腾讯云](https://cloud.tencent.com/) | 深圳 | [官网](https://cloud.tencent.com/) | [腾讯社会招聘](https://careers.tencent.com/jobopportunity.html) | `candidate` | careers.tencent.com 与搜索证据 hr.tencent.com 的重定向关系待核验；不能把腾讯集团所有职位标为腾讯云或AI。 |

## 证据与状态说明

- `official_link`：官方页面正文或官网导航明确链接到该入口。
- `official_search_result`：搜索结果明确显示官方主体与招聘入口，但页面正文未能在本轮完整打开或读取；可用于候选登记，不能替代后续人工复核。
- `historical_only`：仅保留方案文档、旧配置或带历史职位日期的线索；不得据此认定当前招聘开放。
- `verified`：入口归属证据足够进入公司登记，但仍需 core/main 单独批准 provider、访问节奏和采集范围。
- `candidate`：有匹配线索但官网链路未完成，不能进入已批准 provider 清单。
- 本轮未使用 `blocked` 或 `not_found`，因为 10 家均找到至少一个与公司名称匹配的官方或官方搜索结果线索；这不等于每个入口可访问。

## 不应推断的事项

1. 公司已登记，不等于已授权采集。
2. 招聘页存在，不等于岗位当前开放；百炼智能页面尤其包含 2025/2023 年职位日期，应标记历史或待复核。
3. 招聘入口可打开，不等于存在公开职位接口、完整分页、稳定字段或可自动读取权限。
4. 总部字段只用于公司身份识别，不能替代岗位地点；岗位城市必须来自后续岗位来源原文。
5. 旧方案或开源配置中的Moka、飞书、Wintalent等 provider 线索不能单独完成官方归属核验，也不能触发采集。

## 后续移交边界

只移交 `careers/config/company-discovery.json` 中的公司身份、官网、招聘入口、证据和状态。core/main 如需启用某个 provider，应另行确认：来源公开性、访问节奏、完整性、失败隔离、字段保留和停止条件。本轮没有运行 collection，也没有编辑岗位库或其他项目文件。
