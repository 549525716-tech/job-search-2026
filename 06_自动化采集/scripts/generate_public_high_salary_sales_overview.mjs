#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const inputCsvPath = join(projectRoot, "01_行情收集/公开高薪销售岗位补充线索.csv");
const sourceMdPath = join(projectRoot, "01_行情收集/公开高薪销售岗位补充线索.md");
const outputMdPath = join(projectRoot, "01_行情收集/公开高薪销售线索状态总览.md");
const outputCsvPath = join(projectRoot, "01_行情收集/公开高薪销售线索状态总览.csv");
const reviewQueueMdPath = join(projectRoot, "01_行情收集/BOSS公开高薪线索低频复核清单.md");
const reviewQueueCsvPath = join(projectRoot, "01_行情收集/BOSS公开高薪线索低频复核清单.csv");
const reviewInboxMdPath = join(projectRoot, "01_行情收集/BOSS公开线索复核收件箱.md");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function formatDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} Asia/Shanghai`;
}

function salaryNumbers(salary) {
  return [...String(salary || "").matchAll(/(\d+(?:\.\d+)?)/g)]
    .map((match) => Number.parseFloat(match[1]))
    .filter(Number.isFinite);
}

function salaryMaxK(salary) {
  const numbers = salaryNumbers(salary);
  if (!numbers.length) return 0;
  return Math.max(...numbers);
}

function sourceTier(source) {
  if (source === "BOSS公开页" || source === "企业官网") return "较高：公开页面可直接复核";
  if (source === "猎聘公开页" || source === "智乐聘" || source === "Michael Page" || source === "职友集") return "中：公开页可读但需二次核验";
  if (source === "猎聘搜索结果") return "低：搜索结果信号，需详情页或BOSS复核";
  return "待判断";
}

function opportunityPriority(row) {
  const segment = row.segment || "";
  const roleFamily = row.roleFamily || "";
  const salaryMax = salaryMaxK(row.salary);
  const source = row.source || "";
  if (/互联网广告|营销|SaaS|云计算|大模型|AI Agent|企业知识库/.test(segment) && salaryMax >= 35) {
    return "主攻：销售能力和现有履历迁移度较高";
  }
  if (/云计算|大模型/.test(segment) && roleFamily.includes("客户成功")) {
    return "可拓展：适合补续费增购和客户成功证据";
  }
  if (/AI芯片|AI服务器|智算|数据中心|机器人|智能硬件|AI视觉/.test(segment)) {
    return "观察：高薪但需补硬件/项目型销售语言";
  }
  if (source === "猎聘搜索结果") {
    return "待核验：只作公开信号";
  }
  return "补充观察";
}

function nextBossKeyword(row) {
  const company = row.company || "";
  const title = row.title || "";
  const normalizedTitle = title
    .replace(/\s*\([^)]*\)\s*/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/-.*$/, "")
    .trim();
  return `${company} ${normalizedTitle}`.trim();
}

function countBy(rows, field) {
  return [...rows.reduce((map, row) => {
    const key = row[field] || "未标注";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map()).entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
}

function groupStats(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const key = row[field] || "未标注";
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([name, group]) => {
    const maxSalary = Math.max(...group.map((row) => salaryMaxK(row.salary)), 0);
    const roleFamilies = countBy(group, "roleFamily").slice(0, 3).map(([key, count]) => `${key}(${count})`).join("、");
    const sources = countBy(group, "source").slice(0, 3).map(([key, count]) => `${key}(${count})`).join("、");
    const examples = group
      .slice()
      .sort((a, b) => salaryMaxK(b.salary) - salaryMaxK(a.salary))
      .slice(0, 3)
      .map((row) => `${row.company}/${row.title}/${row.salary || "未公开"}`)
      .join("；");
    return { name, count: group.length, maxSalary, roleFamilies, sources, examples };
  }).sort((a, b) => b.count - a.count || b.maxSalary - a.maxSalary || a.name.localeCompare(b.name, "zh-CN"));
}

function topRows(rows, limit = 15) {
  return rows
    .slice()
    .sort((a, b) => {
      const salaryDiff = salaryMaxK(b.salary) - salaryMaxK(a.salary);
      if (salaryDiff) return salaryDiff;
      const sourceWeight = (source) => (source === "BOSS公开页" ? 3 : source === "企业官网" ? 2 : source === "猎聘公开页" ? 1 : source === "职友集" ? 1 : 0);
      return sourceWeight(b.source) - sourceWeight(a.source);
    })
    .slice(0, limit);
}

function queueScore(row) {
  let score = salaryMaxK(row.salary);
  if (row.source === "BOSS公开页") score += 40;
  else if (row.source === "企业官网") score += 20;
  else if (row.source === "猎聘公开页") score += 10;
  else if (row.source === "职友集") score += 5;
  if (row.opportunityPriority.startsWith("主攻")) score += 30;
  if (row.roleFamily === "销售管理/区域负责人") score += 12;
  if (row.roleFamily === "大客户/行业销售经理") score += 10;
  if (row.roleFamily === "AI软件/大模型销售") score += 8;
  if (/云计算|大模型|企业服务SaaS|互联网广告|营销/.test(row.segment || "")) score += 10;
  if (/AI芯片|AI服务器|智算|数据中心/.test(row.segment || "")) score += 4;
  return score;
}

function reviewRoleRank(roleFamily) {
  if (roleFamily === "销售管理/区域负责人") return 0;
  if (roleFamily === "大客户/行业销售经理") return 1;
  if (roleFamily === "AI软件/大模型销售") return 2;
  if (roleFamily === "硬件/智算/半导体行业销售") return 3;
  if (roleFamily === "渠道/生态/伙伴销售") return 4;
  if (roleFamily === "客户成功/交付顾问") return 5;
  if (roleFamily === "售前/解决方案顾问") return 6;
  return 7;
}

function reviewSourceRank(source) {
  if (source === "BOSS公开页") return 0;
  if (source === "企业官网") return 1;
  if (source === "猎聘公开页" || source === "职友集" || source === "智乐聘" || source === "Michael Page") return 2;
  if (source === "猎聘搜索结果") return 3;
  return 4;
}

function reviewStage(row) {
  if (row.source === "BOSS公开页") return "BOSS首页优先复核";
  if (row.source === "企业官网") return "官网线索，BOSS二次复核";
  if (row.source === "猎聘公开页" || row.source === "职友集") return "公开页线索，BOSS二次复核";
  return "搜索结果线索，低优先级复核";
}

function buildReviewQueue(enrichedRows) {
  return enrichedRows
    .slice()
    .sort((a, b) => {
      const sourceDiff = reviewSourceRank(a.source) - reviewSourceRank(b.source);
      if (sourceDiff) return sourceDiff;
      const roleDiff = reviewRoleRank(a.roleFamily) - reviewRoleRank(b.roleFamily);
      if (roleDiff) return roleDiff;
      return queueScore(b) - queueScore(a) || salaryMaxK(b.salary) - salaryMaxK(a.salary);
    })
    .map((row, index) => ({
      ...row,
      queueRank: index + 1,
      reviewStage: reviewStage(row),
      copyTarget: row.source === "BOSS公开页" ? "复制1-3条BOSS岗位详情" : "先在BOSS首页确认是否有同岗，再复制详情",
      cooldown: index === 0 ? "本条可立即处理" : "与上一关键词间隔10-20分钟"
    }));
}

function reviewQueueMd(queueRows) {
  const topRows = queueRows.slice(0, 20);
  return `# BOSS公开高薪线索低频复核清单

更新时间：${formatDate()}

## 一、本质判断

这份清单不是自动爬取队列，而是把公开高薪销售线索转成 BOSS 首页人工低频复核入口。当前仍然不使用 9333、CDP、内置浏览器或批量打开 BOSS 页面。

## 二、低频规则

1. 只在系统 Chrome 的 BOSS 首页站内搜索框输入关键词。
2. 每次只处理 1 个关键词；两个关键词之间间隔 10-20 分钟。
3. 每个关键词只复制 1-3 条岗位详情，复制后停止。
4. 连续处理 3 个关键词后冷却 30 分钟。
5. 不批量开页、不刷新搜索结果、不使用脚本直连 BOSS 搜索 URL。

排序规则：同为 BOSS 公开页时，优先复核销售管理、大客户销售、AI/大模型销售、硬件/智算/半导体销售，再复核客户成功和售前/解决方案岗位；高薪售前会保留，但不会压过销售岗。

## 三、下一批优先复核

${mdTable(
  ["排名", "复核阶段", "搜索关键词", "公司", "岗位", "薪资", "赛道", "岗位族", "动作"],
  topRows.map((row) => [
    row.queueRank,
    row.reviewStage,
    `\`${row.nextBossKeyword}\``,
    row.company,
    row.title,
    row.salary || "未公开",
    row.segment,
    row.roleFamily,
    row.copyTarget
  ])
)}

## 四、完整清单文件

\`\`\`text
${reviewQueueCsvPath}
\`\`\`

## 五、粘贴后命令

如果已经复制了某个岗位详情文本：

\`\`\`bash
npm run paste:public-review-current
npm run sampling:public-review-status
npm run import:public-review-inbox -- --dry-run
npm run import:public-review-inbox -- --refresh
\`\`\`

对应收件箱：

\`\`\`text
${reviewInboxMdPath}
\`\`\`
`;
}

function routeForSegment(segment) {
  if (/芯片|GPU|服务器|智算|数据中心|IDC|半导体|硬件/.test(segment || "")) return "硬件/智算/半导体观察线";
  if (/云计算|大模型|MaaS|Agent|知识库/.test(segment || "")) return "云/MaaS/大模型主线";
  if (/营销|广告|SaaS|金融科技/.test(segment || "")) return "AI应用/营销AI/SaaS主线";
  if (/机器人|智能汽车|视觉|制造|工业/.test(segment || "")) return "智能硬件/工业AI观察线";
  return "高薪销售公开线索";
}

function priorityForRow(row) {
  if (row.opportunityPriority.startsWith("主攻")) return "P0";
  if (row.source === "BOSS公开页") return "P1";
  if (row.opportunityPriority.startsWith("观察")) return "P1";
  return "P2";
}

function cityFromLocation(location) {
  const text = String(location || "");
  const match = text.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|厦门|重庆|天津/);
  return match?.[0] || "全国/待确认";
}

function reviewInboxMd(queueRows) {
  const sections = queueRows.map((row) => {
    const metadata = {
      rank: row.queueRank,
      company: row.company,
      role: row.title,
      safeHomeUrl: "https://www.zhipin.com/",
      searchKeyword: row.nextBossKeyword,
      targetCopies: "3",
      sourceUrl: row.sourceUrl,
      args: {
        source: "BOSS直聘",
        query: row.nextBossKeyword,
        company: row.company,
        role: row.title,
        city: cityFromLocation(row.location),
        batchId: "BOSS-PUBLIC-REVIEW",
        batchTask: String(row.queueRank),
        batchTargetCopies: "3",
        priority: priorityForRow(row),
        route: routeForSegment(row.segment),
        segment: row.segment,
        roleFamily: row.roleFamily,
        salaryBand: row.salary || "未公开"
      }
    };
    return `## ${row.queueRank}. ${row.company} / ${row.title}

目标导入：3 条

薪资参考：${row.salary || "未公开"}

BOSS首页：https://www.zhipin.com/

站内搜索关键词：${row.nextBossKeyword}

公开来源：${row.source} / ${row.sourceUrl || "未记录"}

复核阶段：${row.reviewStage}

<!-- BOSS_INBOX_TASK_START -->
${JSON.stringify(metadata)}
<!-- BOSS_INBOX_TASK_END -->

<!-- BOSS_INBOX_TEXT_START -->
在这里粘贴 ${row.company} / ${row.title} 的岗位详情。导入后可清空本段文本，保留标记。
<!-- BOSS_INBOX_TEXT_END -->`;
  });

  return `# BOSS公开线索复核收件箱

更新时间：${formatDate()}

## 使用边界

- 这个文件只接收你从 BOSS 页面人工复制回来的岗位详情文本。
- 不要在这里粘贴简历、账号、聊天记录或隐私信息。
- 每个公司段落可以一次粘贴 1 到 3 条岗位详情；多条岗位之间用空行或 \`---\` 分隔。
- 粘贴后先运行 \`npm run sampling:public-review-status\` 做质量预检。
- 预检可导入后运行 \`npm run import:public-review-inbox -- --refresh\`。
- 采样时只从 BOSS 首页站内搜索进入，不直开搜索 URL，不批量刷新。

${sections.join("\n\n")}
`;
}

function mdTable(headers, rows) {
  const lines = [];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${row.map((cell) => String(cell ?? "").replaceAll("\n", " ").replaceAll("|", "/")).join(" | ")} |`);
  }
  return lines.join("\n");
}

function sourceMd(enrichedRows, sourceCounts, segmentStats, roleStats) {
  const bossCount = sourceCounts.find(([source]) => source === "BOSS公开页")?.[1] || 0;
  const topRole = roleStats[0];
  const topSegment = segmentStats[0];
  const primaryRows = enrichedRows.filter((row) => row.opportunityPriority.startsWith("主攻"));
  const observationRows = enrichedRows.filter((row) => row.opportunityPriority.startsWith("观察"));

  return `# 公开高薪销售岗位补充线索

更新时间：${formatDate()}

## 一、用途

这份表是 BOSS 人工复制岗位详情进入本地收件箱之前的公开来源补充样本。它不替代 BOSS 收件箱导入，也不计入 \`BOSS-HIGHSALARY\` 批次完成度；用途是先补足高薪销售市场的公开信号，帮助判断互联网、AI、云、智算、硬件和半导体相关销售岗位在买什么能力。

当前公开线索数：${enrichedRows.length} 条。

## 二、本轮公开线索

${mdTable(
  ["来源", "公司", "岗位", "薪资", "赛道", "能力信号"],
  enrichedRows.map((row) => [
    row.source,
    row.company,
    row.title,
    row.salary || "未公开",
    row.segment,
    row.requirementsSummary
  ])
)}

## 三、来源分布

${mdTable(["来源", "数量"], sourceCounts)}

## 四、赛道分布

${mdTable(
  ["赛道", "线索数", "最高薪资K", "主要岗位族", "代表岗位"],
  segmentStats.map((item) => [item.name, item.count, item.maxSalary, item.roleFamilies, item.examples])
)}

## 五、岗位族分布

${mdTable(
  ["岗位族", "线索数", "最高薪资K", "代表岗位"],
  roleStats.map((item) => [item.name, item.count, item.maxSalary, item.examples])
)}

## 六、阶段判断

1. 高薪 AI 销售岗位不是只看“会销售”，更看行业客户、AI/云/算力产品理解、解决方案表达和商务闭环。
2. 当前公开线索中，${topRole?.name || "大客户/行业销售经理"} 占 ${topRole?.count || 0}/${enrichedRows.length}，是最核心岗位族；${topSegment?.name || "云计算/大模型平台"} 占 ${topSegment?.count || 0}/${enrichedRows.length}，是最密集赛道。
3. BOSS 公开页线索 ${bossCount} 条，适合作为下一批 BOSS 首页低频人工搜索入口；其余来源只作为公开信号，需要二次核验。
4. 主攻机会 ${primaryRows.length} 条，集中在 AI应用/营销AI/SaaS、云/MaaS、大模型商业化和互联网广告/营销技术方向。
5. 硬件/智算/机器人观察线索 ${observationRows.length} 条，薪资上限更高，但对硬件链路、政企/云/IDC客户、生态伙伴和长周期项目要求更高。
6. 对个人简历而言，第一阶段更应主攻 AI应用/营销AI/SaaS、云/MaaS 和大客户销售；硬件/芯片作为高薪观察与补课方向。

## 七、数据文件

\`\`\`text
${inputCsvPath}
${outputMdPath}
\`\`\`
`;
}

function main() {
  if (!existsSync(inputCsvPath)) {
    throw new Error(`未找到输入文件：${inputCsvPath}`);
  }
  const rows = parseCsv(readFileSync(inputCsvPath, "utf8"));
  mkdirSync(dirname(outputMdPath), { recursive: true });

  const enrichedRows = rows.map((row) => ({
    ...row,
    salaryMaxK: salaryMaxK(row.salary),
    sourceTier: sourceTier(row.source),
    opportunityPriority: opportunityPriority(row),
    nextBossKeyword: nextBossKeyword(row)
  }));

  const summaryCsvRows = [
    ["type", "name", "count", "maxSalaryK", "roleFamilies", "sources", "examples"],
    ...groupStats(enrichedRows, "segment").map((item) => [
      "segment", item.name, item.count, item.maxSalary, item.roleFamilies, item.sources, item.examples
    ]),
    ...groupStats(enrichedRows, "roleFamily").map((item) => [
      "roleFamily", item.name, item.count, item.maxSalary, item.roleFamilies, item.sources, item.examples
    ])
  ];
  writeFileSync(outputCsvPath, `${toCsv(summaryCsvRows)}\n`, "utf8");

  const sourceCounts = countBy(enrichedRows, "source");
  const segmentStats = groupStats(enrichedRows, "segment");
  const roleStats = groupStats(enrichedRows, "roleFamily");
  const topSalaryRows = topRows(enrichedRows, 15);
  const firstPriority = enrichedRows.filter((row) => row.opportunityPriority.startsWith("主攻"));
  const observation = enrichedRows.filter((row) => row.opportunityPriority.startsWith("观察"));
  const bossPageRows = enrichedRows.filter((row) => row.source === "BOSS公开页");
  const reviewQueue = buildReviewQueue(enrichedRows);

  const reviewQueueCsvRows = [
    [
      "rank",
      "reviewStage",
      "searchKeyword",
      "company",
      "title",
      "salary",
      "salaryMaxK",
      "segment",
      "roleFamily",
      "source",
      "sourceTier",
      "opportunityPriority",
      "copyTarget",
      "cooldown",
      "sourceUrl"
    ],
    ...reviewQueue.map((row) => [
      row.queueRank,
      row.reviewStage,
      row.nextBossKeyword,
      row.company,
      row.title,
      row.salary || "未公开",
      row.salaryMaxK,
      row.segment,
      row.roleFamily,
      row.source,
      row.sourceTier,
      row.opportunityPriority,
      row.copyTarget,
      row.cooldown,
      row.sourceUrl
    ])
  ];
  writeFileSync(reviewQueueCsvPath, `${toCsv(reviewQueueCsvRows)}\n`, "utf8");

  const md = `# 公开高薪销售线索状态总览

更新时间：${formatDate()}

## 一、本质判断

这份总览不是正式 BOSS 大样本结论，而是把公开可见的高薪销售岗位信号转成下一步采样和简历判断。公开线索可以帮助判断方向，但不能替代 BOSS 详情页人工复制样本。

## 二、当前数据

| 指标 | 当前值 |
| --- | ---: |
| 公开高薪销售线索 | ${enrichedRows.length} |
| BOSS公开页线索 | ${bossPageRows.length} |
| 主攻机会线索 | ${firstPriority.length} |
| 硬件/智算/机器人观察线索 | ${observation.length} |
| 最高薪资数字观察 | ${Math.max(...enrichedRows.map((row) => row.salaryMaxK), 0)}K |

## 三、来源分布

${mdTable(["来源", "数量"], sourceCounts)}

## 四、赛道分布

${mdTable(
  ["赛道", "线索数", "最高薪资K", "主要岗位族", "主要来源", "代表岗位"],
  segmentStats.map((item) => [item.name, item.count, item.maxSalary, item.roleFamilies, item.sources, item.examples])
)}

## 五、岗位族分布

${mdTable(
  ["岗位族", "线索数", "最高薪资K", "主要来源", "代表岗位"],
  roleStats.map((item) => [item.name, item.count, item.maxSalary, item.sources, item.examples])
)}

## 六、高薪优先线索

${mdTable(
  ["公司", "岗位", "薪资", "赛道", "岗位族", "来源可信度", "下一步"],
  topSalaryRows.map((row) => [
    row.company,
    row.title,
    row.salary || "未公开",
    row.segment,
    row.roleFamily,
    row.sourceTier,
    row.opportunityPriority
  ])
)}

## 七、下一批 BOSS 人工采样建议

优先从 BOSS 公开页线索里抽样，因为这些线索更容易在 BOSS 首页用站内搜索复核。仍然遵守低频规则：每次只搜一个关键词，复制 1 到 3 条岗位详情后停止。

${mdTable(
  ["优先级", "搜索关键词", "公司", "岗位", "薪资", "理由"],
  reviewQueue
    .slice(0, 12)
    .map((row, index) => [
      index + 1,
      `\`${row.nextBossKeyword}\``,
      row.company,
      row.title,
      row.salary || "未公开",
      row.opportunityPriority
    ])
)}

## 八、对简历和投递的即时判断

1. 第一主线：AI应用/营销AI/SaaS、云/MaaS、大模型商业化销售，原因是薪资高且与客户经营、销售漏斗、ROI表达可迁移。
2. 第一补充线：互联网广告/营销技术大客户销售，原因是与懂车帝平台营销、线索、投放、ROI经历最接近。
3. 第二观察线：工业视觉、机器人、智能硬件，原因是汽车背景可迁移，但要补机器视觉、人形机器人、3C/锂电/汽车零部件语言。
4. 高薪观察线：芯片、AI服务器、智算、IDC，原因是薪资上限高，但需要硬件链路、政企/云厂商/数据中心客户和长周期项目证据。

## 九、文件

\`\`\`text
${outputCsvPath}
${inputCsvPath}
\`\`\`
`;

  writeFileSync(sourceMdPath, sourceMd(enrichedRows, sourceCounts, segmentStats, roleStats), "utf8");
  writeFileSync(outputMdPath, md, "utf8");
  writeFileSync(reviewQueueMdPath, reviewQueueMd(reviewQueue), "utf8");
  writeFileSync(reviewInboxMdPath, reviewInboxMd(reviewQueue), "utf8");
  console.log(`已生成：${outputMdPath}`);
  console.log(`已生成：${outputCsvPath}`);
  console.log(`已生成：${sourceMdPath}`);
  console.log(`已生成：${reviewQueueMdPath}`);
  console.log(`已生成：${reviewQueueCsvPath}`);
  console.log(`已生成：${reviewInboxMdPath}`);
  console.log(`公开线索：${enrichedRows.length}`);
  console.log(`BOSS公开页线索：${bossPageRows.length}`);
}

main();
