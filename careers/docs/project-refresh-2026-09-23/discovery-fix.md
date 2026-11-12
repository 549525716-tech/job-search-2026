# Discovery 跨次复查修复（2026-09-23）

## 变更边界

仅调整 `careers/discovery.mjs` 的下一轮批次选择，以及其离线回归测试。

- 成功或已核验空结果的来源，在前一冻结批次已完成后，默认进入下一次 `discovery:prepare` 的候选。
- 新任务标记 `recheck: true`，并冻结 `cursor: null`，使运行时重新读取当前来源，而不是续用历史分页游标。
- `discovery:run` 首次执行 recheck 时只使用冻结的 null cursor；若该次执行产生 checkpoint，后续同一 batch 使用已持久化的续页 cursor。
- 在同一既有优先级内，所有来源按最近实际 `finished_at` 由旧到新排序；这使 success/verified_empty 的复查轮转，也让未完成尝试的来源按最旧处理。准备 batch 不推进该时间，启动时间不能替代完成时间，queue ID 仅作稳定并列收尾。
- 尚未完成的冻结批次仍由原逻辑复用；`discovery:run` 对已完成 batch 的 no-op 行为没有变化。
- 失败、受限和 blocked 状态仍遵从原有重试上限、halt 与准入逻辑；本修复不清除任何 halt，也不扩大来源准入。

## 复现与验证

修复前，构造一个带完整历史 success 状态的来源，运行下一次 `prepareDiscovery` 会得到 `selected_companies: 0`。

新增测试 `completed source enters the next frozen batch as a fresh recheck, while its completed batch remains a no-op` 验证：下一轮选中该来源、冻结清单标记 recheck、cursor 被清空，且连续 prepare 复用同一未完成 batch。

新增测试 `a recheck run passes its frozen null cursor to collection once, then completed batch is a no-op` 通过真实 `runDiscovery` 控制流和无网络的 collection fixture 验证：首次 collection 收到 null，完成后的同一 batch 不会再次调用 collection。

新增测试 `successful and verified-empty rechecks rotate by actual completion time under a one-company budget` 验证 alpha、beta 两个已完成来源在 `maxCompanies: 1` 时按 alpha → beta → alpha 轮转；`a recheck checkpoint resumes the cursor persisted by its first partial collection` 验证首轮 partial 后同一冻结 batch 使用保存的 next-page cursor，而不是再次传入 null。

新增测试 `same-priority discovery entries use one completion-time ordering key` 验证待核、旧复查和新复查混排时使用统一的完成时间排序键，避免成对比较造成非传递顺序。

已通过：

```text
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node --test --test-name-pattern='completed source enters|recheck run passes|rotate by actual|same-priority|checkpoint resumes' careers/tests/discovery-runtime.test.mjs
```

完整 `discovery-runtime.test.mjs` 在本受限环境中仍有既有的离线 Chrome 启动失败（Playwright headless Chrome 被沙箱终止），导致依赖 `createOfflineDOM()` 的旧集成项未能运行到采集断言；这不是本次变更引入的失败。此次新增回归不创建浏览器，也不发起网络请求。

## 原始文件备份

变更前备份：

- `careers/docs/project-refresh-2026-09-23/before/careers/discovery.mjs`
- `careers/docs/project-refresh-2026-09-23/before/careers/tests/discovery-runtime.test.mjs`

变更前 SHA-256：

```text
0ac595d1d8492cb3b58eae0a1fbb25fbb8ff22b88c584a474302c1789c6ebb17  careers/discovery.mjs
11edf384c568d1c77e6d0b669818b6feba6d4e3a13c901d81523a3422ce0623c  careers/tests/discovery-runtime.test.mjs
```
