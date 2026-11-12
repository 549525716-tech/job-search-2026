import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { ROOT } from '../paths.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const policy = read('discovery-policy');
const preferences = read('preferences');
const team = read('agent-team');
const strategy = read('career-strategy');

test('full-market collection remains the objective, never an automatic completion label', () => {
  assert.equal(policy.market_objective.label, '全市场已收齐');
  assert.equal(policy.market_objective.kind, 'business_target_not_completion_claim');
  assert.equal(policy.market_objective.every_update_closing_line, '目标：全市场已收齐');
  for (const field of ['fixed_count_is_completion', 'batch_finished_is_market_complete', 'unknown_market_denominator_allows_coverage_percentage']) {
    assert.equal(policy.market_objective[field], false, field);
  }
  assert(policy.market_objective.required_before_closing.includes('remaining_unscanned_partial_and_blocked_scopes'));
  assert(policy.market_objective.required_before_closing.includes('next_wave_frontier'));
});

test('incremental screening skips repeat work, not distinct opportunities or unfinished scopes', () => {
  const triage = policy.incremental_triage;
  assert.equal(triage.status, 'execution_contract_not_new_scheduler');
  for (const field of ['tag_equality_is_job_identity', 'partial_task_counts_as_complete', 'unknown_identity_can_be_skipped', 'previously_seen_company_skips_next_update', 'delete_raw_observations']) {
    assert.equal(triage[field], false, field);
  }
  assert.equal(triage.job_lists_rechecked_each_update, true);
  assert.equal(triage.unchanged_requires_current_source_evidence, true);
  assert.equal(triage.source_halts_preserved, true);
  assert.deepEqual(triage.task_identity_fields, ['source', 'industry_or_employer_scope', 'query_verbatim', 'filters', 'geography', 'language', 'page_or_cursor', 'rules_version']);
  assert(triage.request_reuse_requires.includes('same_batch'));
  assert(triage.request_reuse_requires.includes('successful_persisted_raw_receipt'));
  assert(triage.request_reuse_requires.includes('preserved_route_provenance_and_reuse_reference'));
  assert.deepEqual(triage.analysis_reuse_requires, ['same_jd_hash', 'same_profile_hash', 'same_rules_version', 'same_evidence_context']);
  assert(existsSync(resolve(ROOT, triage.identity_contract_ref)));
});

test('dual discovery routes cross-feed without a seed whitelist or collection cap', () => {
  assert.equal(new Set(policy.routes.map((route) => route.id)).size, 2);
  const routeA = policy.routes.find((route) => route.id === 'A');
  const routeB = policy.routes.find((route) => route.id === 'B');
  assert.equal(routeA.steps.at(-1), 'keyword_extraction');
  assert.equal(routeB.steps.at(-1), 'company_frontier_for_A');
  assert(policy.routes.every((route) => route.requires_seed_company_membership === false));
  assert.equal(policy.allow_new_industries, true);
  assert.equal(policy.cross_feed.preserve_all_discovery_routes, true);
  assert.equal(policy.cross_feed.new_items_enter_next_wave, true);
  assert.equal(policy.scope.company_global_cap, null);
  assert.equal(policy.scope.job_collection_global_cap, null);
  assert.equal(policy.scope.analysis_batch_max, preferences.match_batch_limit);
  assert.equal(policy.scope.analysis_cap_stops_collection, false);
  assert.equal(policy.scope.request_budget_requires_checkpoint, true);
  assert.equal(policy.scope.freeze_company_and_query_denominators, true);
});

test('title and content recall keep niche aliases and unknown pay without promoting them to verified requirements', () => {
  assert.deepEqual(policy.query_policy.axes, ['title', 'content']);
  assert.deepEqual(policy.query_policy.breadth, ['precise', 'expanded']);
  for (const key of ['company_restricted_only', 'industry_required_for_every_query', 'ai_word_required_for_every_query', 'one_query_means_company_complete']) {
    assert.equal(policy.query_policy[key], false, key);
  }
  assert.equal(policy.keyword_policy.single_source_niche_discovery_allowed, true);
  assert(policy.keyword_policy.shared_min_independent_employers >= 2);
  assert.equal(policy.keyword_policy.aliases_require_semantic_review, true);
  assert.equal(policy.keyword_policy.generic_soft_skills_as_standalone_queries, false);
  assert.equal(policy.keyword_policy.unknown_title_with_commercial_content, 'review_queue_not_auto_excluded');
  assert.equal(policy.strategy.unknown_salary_kept, true);
  assert.equal(policy.strategy.profile_score_is_collection_gate, false);
  assert.equal(policy.strategy.policy_evidence_required_for_every_job, false);
  assert.equal(preferences.salary.mode, 'advertised_monthly_range');
  assert.equal(preferences.salary.min_monthly_opportunity, 20000);
  assert.equal(preferences.salary.ote_is_base_salary, false);
});

test('source completeness and freshness cannot be inferred from search-only or failed observations', () => {
  for (const status of ['unscanned', 'query_only', 'pagination_pending', 'details_missing', 'source_scope_complete', 'verified_empty', 'access_blocked']) {
    assert(policy.coverage.statuses.includes(status), status);
  }
  assert(policy.coverage.complete_requires.includes('native_pagination_end'));
  assert(policy.coverage.empty_requires.includes('native_zero_evidence'));
  assert.equal(policy.coverage.search_results_can_prove_company_empty, false);
  assert.equal(policy.coverage.blocked_counts_as_complete, false);
  assert.equal(policy.freshness.older_than_window_is_closed, false);
  assert.equal(policy.freshness.undated_jobs_kept, true);
  assert.equal(policy.freshness.historical_samples_are_latest_standards, false);
  assert.equal(policy.scope.global_market_exhaustion_claim_allowed, false);
  assert(policy.industry_research_groups.every((group) => group.status === 'research_hypothesis'));
});

test('route B can bootstrap when A has no JD without promoting hypotheses to current demand', () => {
  assert.equal(policy.cold_start.trigger, 'route_A_no_usable_full_jd');
  assert.equal(policy.cold_start.route, 'B');
  assert(policy.cold_start.allowed_term_states.every((state) => policy.keyword_policy.states.includes(state)));
  assert.equal(policy.cold_start.uses_declared_batch_budget, true);
  assert.equal(policy.cold_start.gpt6_reviews_alias_ambiguity, true);
  assert.equal(policy.cold_start.terms_are_latest_demand_evidence, false);
  assert.equal(policy.cold_start.without_full_jd_generate_common_demand_or_full_match, false);
  assert.equal(policy.cold_start.after_full_jd, 'gpt6_evidence_bound_extraction_and_employer_verification_then_backfill_A');
});

test('documented model task bindings match the real team configuration', () => {
  for (const [task, modelKey] of [['industry_facts', 'execution'], ['route_A_and_B_execution', 'execution'], ['keyword_and_industry_judgment', 'keyword_and_industry_judgment'], ['evidence_and_coverage_review', 'independent_review']]) {
    const role = team.roles.find((candidate) => candidate.id === team.discovery_task_bindings[task]);
    assert(role, task);
    assert.equal(role.model, policy.models[modelKey].model);
    assert.equal(role.reasoning_effort, policy.models[modelKey].reasoning_effort);
    assert(role.inputs.includes('careers/config/discovery-policy.json'));
  }
  assert.equal(policy.models.fixed_data_processing_calls_model, false);
  assert.equal(policy.models.silently_substitute_unavailable_model, false);
  assert.equal(team.discovery_policy_ref, strategy.discovery_policy_ref);
});

test('rules-only change does not enable scanning, timers, applications or clear access boundaries', () => {
  for (const field of ['automatic_discovery_implemented', 'keyword_engine_implemented', 'coverage_scheduler_implemented', 'activate_on_rule_edit', 'schedule_enabled']) assert.equal(policy.runtime[field], false);
  for (const field of ['persistent_discovery_frontier_implemented', 'approved_static_source_followup_implemented', 'body_review_queue_implemented']) assert.equal(policy.runtime[field], true);
  assert(Object.values(policy.current_turn_actions).every((value) => value === 0));
  assert.equal(policy.network.shared_serial_queue, true);
  assert.equal(policy.network.min_interval_ms, 10000);
  assert.equal(policy.network.max_interval_ms, 20000);
  assert.equal(policy.network.access_denial_stop_first, true);
  assert.equal(policy.network.preserve_existing_source_halts, true);
  assert.equal(policy.network.invent_missing_timestamps, false);
  assert.equal(read('application-policy').runtime.enabled, false);
  assert.equal(strategy.schedule.activated, false);
  for (const name of [policy.contract, policy.preferences_ref, policy.roles_ref, strategy.discovery_policy_ref]) {
    const path = resolve(ROOT, name);
    assert(!relative(ROOT, path).startsWith('..'));
    assert(existsSync(path), name);
  }
});
