# 匹配模型门禁修复（2026-09-23）

## 结论

当前匹配执行和独立语义复核的唯一有效档位为 `gpt-6-astra / xhigh`。`max` 是旧记录的历史元数据，不再是当前审批条件；它仍保留在 `careers/config/reviewers.json` 的 `historical_reviewers`，不可被改写为 xhigh，也不可放行新的评估或简历沿用。

当前批准名单刻意为空。只有已实际调度、且未参与该评估实现的 Astra xhigh 审核者，才可被登记到 `reviewers` 后授权复核；未登记、同一执行者自审、低档/其他模型、缺少事实/硬门槛/原文引文检查的回执都继续拒绝。因此，本修复没有伪造已经发生的本轮独立审核。

## 变更范围

- `careers/config/matching-rules.json`：版本升级为 `2026-09-23-xhigh-evidence-v3`，当前执行要求改为 Astra xhigh，并将独立 xhigh 复核写入复用门禁。
- `careers/config/reviewers.json`：将旧 max 审核者移至历史记录，新增当前 xhigh 登记和独立性要求；未虚构当前审核者身份。
- `careers/matching.mjs`：语义回执自身和已登记审核者都必须与当前规则的模型和推理档位一致，且审核者必须不同于执行者。
- `careers/tests/matching.test.mjs`：覆盖 Astra xhigh 正常放行、max 历史记录不放行、低档/不同模型/自审/缺少检查拒绝，以及规则哈希变化导致缓存与批次失效。

## 备份与哈希

编辑前原件已复制到 `careers/docs/project-refresh-2026-09-23/before/` 的同相对路径。原始 SHA-256：

- `careers/matching.mjs`：`830631723635ac27bf0b75d3c76059d42325d98643fade109479b0d1b00abee8`
- `careers/config/matching-rules.json`：`9b07c41f6e0b7ce0c49c03ce0847d637522f912b1a46da8236935a915ff8bc51`
- `careers/config/reviewers.json`：`06c84cbc2a282a658a450bcaabe135efcd816d972be6a5e459d3305ef415d5ae`
- `careers/tests/matching.test.mjs`：`58cde43afc033510fd26aa1240732e12742b32880b53e222dc760417b9037b75`

## 验收边界

本次仅完成本地门禁和定向测试，未生成真实匹配审批、未登记本轮审核者、未修改历史匹配库、报告或进度，也未联网或操作浏览器。当前名单为空时，任何新评估均只能保持待独立复核，不能沿用简历。
