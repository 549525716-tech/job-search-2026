# Matching Import Contract

Top-level JSON: `{"batch_id":"<prepared batch ID>","analyses":[...]}`. Preserve job_key/cache_key from the prepared batch. Do not supply or optimize a score: the importer calculates weighted coverage (direct=1, transferable=0.5, gap=0).

The prepared batch now also includes `career_strategy` and per-job `salary_target`. Use these together with current preferences, not legacy salary upper-bound flags. In `verdict` and `resume_advice`, distinguish evidence coverage from management/durable ToB progression, income uncertainty and entry-path feasibility. Fixed monthly base must be explicitly at least CNY20,000; unspecified or crossing ranges remain pending. Do not treat policy support or a manager title as stability evidence. A strategy change invalidates prior cached assessments; the historical facts themselves do not change. This analysis contract never authorizes an application.

Each analysis contains:

```json
{
  "job_key": "COPY_FROM_BATCH",
  "cache_key": "COPY_FROM_BATCH",
  "execution": {"model":"gpt-6-astra", "reasoning_effort":"max", "agent_id":"ACTUAL_EXECUTOR_ID"},
  "role_mission": "What business outcome and organizational problem the role owns",
  "value_proposition": "Candidate value grounded in existing evidence, not invented experience",
  "verdict": "Worth exploring / needs evidence / not a current priority, with reason",
  "requirements": [
    {
      "id":"R1",
      "requirement":"One material capability or hard gate",
      "jd_quote":"An exact contiguous substring of description_text",
      "weight":5,
      "coverage":"transferable",
      "evidence_ids":["EXISTING_ID_FROM_BATCH_FACTS"],
      "evidence_quotes":[{"evidence_id":"EXISTING_ID_FROM_BATCH_FACTS","quote":"Exact substring of that fact's action, result or context"}],
      "explanation":"What the evidence proves and what it does not prove",
      "hard_gate":false
    }
  ],
  "hard_gates":[{"requirement_id":"R2","status":"unknown","reason":"Which evidence is missing"}],
  "hard_gate_review_complete":true,
  "same_positioning":false,
  "base_resume_reviewed":false,
  "resume_action":"tailor",
  "resume_advice":"Value proposition, what to foreground, what not to claim, and the minimum evidence needed",
  "questions":["One high-value factual question if necessary"]
}
```

The example is structural, not a valid finished analysis: use3–12requirements and replace placeholders. `hard_gates` must reference real requirement IDs. Detected degree/experience/technical signals need a quote and gate review even if their importance is conditional (explain preferred versus mandatory). `met` requires direct evidence; transferable is not a hard-gate pass. No hard gates may be omitted just to raise score.

`resume_action`: reuse / tailor / defer. Initial assessments use tailor or defer; they remain drafts until semantic review. Reuse additionally requires a separate approved review receipt from a registered independent reviewer, not the assessment author's own flags. Complete JD, computed score>=80, all gates reviewed and met, matching positioning, and an actually reviewed current base resume are also necessary. Cache keys bind job content, facts, preferences, rules and resume; import rejects stale batches or invented evidence IDs. Exact quotes establish provenance, not semantic equivalence; do not label an unrelated valid fact as direct proof.

The independent reviewer writes `official-careers/matching/reviews/<cache_key>.json` only after checking the source JD, mapped personal quotes, declared hard gates and proposed wording. Receipt fields: cache_key, analysis_sha256 (from exported assessmentDigest), reviewer_id (registered in careers/config/reviewers.json), verdict (approved/rejected), facts_checked, hard_gates_checked, source_quotes_checked, reviewed_at, notes. A review must be from a different executor than the assessment author. A matching worker must never author its own review receipt or edit reviewer registration. The report reloads approved review status without re-running the model.

Write only this output file. Do not alter source facts, collection results, code, rules, or existing resumes as part of analysis. Local import records execution metadata as supplied and the input file hash; it does not claim independent verification of model billing or token consumption.
