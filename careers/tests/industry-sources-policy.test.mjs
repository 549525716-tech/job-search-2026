import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { ROOT } from '../paths.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), 'utf8'));
const tiers = read('company-tier-policy');
const sources = read('source-catalog');
const discovery = read('discovery-policy');
const strategy = read('career-strategy');
const team = read('agent-team');

test('industry position has four buckets and cannot inherit organizational size or a parent brand', () => {
  assert.deepEqual(tiers.tiers.map((tier) => tier.id), ['leader', 'established', 'emerging', 'unverified']);
  assert.deepEqual(tiers.tiers.filter((tier) => tier.default).map((tier) => tier.id), ['unverified']);
  assert.equal(tiers.basis, 'position_in_defined_segment_not_organization_size');
  assert(tiers.classification_unit.includes('business_line_id'));
  assert(tiers.classification_unit.includes('geographic_market'));
  assert(tiers.classification_unit.includes('as_of_period'));
  assert.equal(tiers.report.organization_size_is_separate_field, true);
  assert.equal(tiers.report.group_inherits_tier_to_subsidiaries, false);
  assert.equal(tiers.report.cross_listing_inflates_unique_job_count, false);
  assert.equal(tiers.report.tier_implies_salary_or_stability, false);
});

test('supported tiers require independent comparison and commercial evidence, not absence or repeated publicity', () => {
  assert(tiers.evidence.minimum_independent_origin_publishers_for_supported_tier >= 2);
  assert.equal(tiers.evidence.requires_external_comparative_evidence, true);
  assert.equal(tiers.evidence.requires_business_evidence, true);
  assert.equal(tiers.evidence.reposts_count_as_independent, false);
  assert.equal(tiers.evidence.company_claim_alone_sufficient, false);
  assert.equal(tiers.decision_order.at(-1), 'otherwise_unverified');
  assert.equal(tiers.freshness.due_or_material_conflict_current_display, 'unverified_with_historical_assessment');
  for (const field of ['content_sha256', 'metric_period', 'coverage_and_method', 'segment_definition', 'conflicts']) assert(tiers.evidence.fields.includes(field));
});

test('all position buckets remain discoverable without a sample-relative ranking or mandatory tier assignment', () => {
  assert.equal(tiers.discovery.tiers_are_collection_filter, false);
  assert.equal(tiers.discovery.unknown_blocks_job_capture, false);
  assert.equal(tiers.discovery.all_four_buckets_in_scope_manifest, true);
  assert.equal(tiers.discovery.global_market_percentile_from_our_sample, false);
  assert.equal(tiers.discovery.no_forced_top10, true);
  assert.equal(discovery.scope.company_global_cap, null);
  assert.equal(discovery.scope.analysis_cap_stops_collection, false);
});

test('top-five rank cannot override concentration or conflicting early-stage evidence', () => {
  assert.equal(tiers.leader_guard.rank_alone_sufficient, false);
  assert.equal(tiers.leader_guard.independent_leading_cohort_evidence_required, true);
  assert.equal(tiers.leader_guard.rank_overrides_opposing_market_stage_evidence, false);
  assert.equal(tiers.leader_guard.unresolved_cohort_or_stage_conflict, 'unverified');
  assert.equal(tiers.leader_guard.cross_industry_share_threshold, null);
});

test('named sources separate discovery from JD evidence and do not clear access or salary gates', () => {
  assert.equal(new Set(sources.channels.map((channel) => channel.id)).size, sources.channels.length);
  const channel = (id) => sources.channels.find((entry) => entry.id === id);
  for (const id of ['official_policy', 'market_research', 'business_disclosure', 'official_jobs', 'boss', 'liepin', 'additional_job_boards', 'official_announcements', 'cross_site_search']) {
    assert(channel(id)?.names.length, id);
    assert(channel(id).admission);
    assert(channel(id).capability);
  }
  assert.equal(channel('boss').automatic_use, false);
  assert.equal(channel('liepin').automatic_use, false);
  assert.equal(channel('additional_job_boards').automatic_use, false);
  assert(channel('cross_site_search').cannot_prove.includes('complete_company_inventory'));
  assert(channel('official_jobs').cannot_prove.includes('all_ats_supported'));
  assert.equal(sources.gates.search_snippet_is_full_jd, false);
  assert.equal(sources.gates.catalog_entry_authorizes_network, false);
  assert.equal(sources.gates.static_catalog_clears_halt, false);
  assert.equal(sources.gates.prior_success_proves_current_access, false);
  assert.equal(sources.gates.restricted_source_fallback_transport_allowed, false);
  assert.equal(sources.gates.can_bypass_paywall_or_login, false);
  assert.equal(read('preferences').salary.min_monthly_opportunity, 20000);
  assert.equal(read('company-tier-policy').status, 'deferred');
});

test('source implementation and access are separate and carry traceable per-run entry records', () => {
  for (const field of ['channel_id', 'entry_url', 'ownership_evidence', 'route_ids', 'content_search_supported', 'pagination_supported', 'implementation_status', 'access_status', 'last_checked_at', 'last_success_at', 'halt_reason', 'evidence_refs']) assert(sources.endpoint_contract.includes(field), field);
  assert(sources.implementation_statuses.includes('quarantined'));
  assert(sources.access_statuses.includes('historical_success_recheck_due'));
  assert(sources.access_statuses.includes('preflight_passed_for_run'));
  assert.equal(sources.run_source_manifest_required, true);
  assert.equal(sources.gates.all_active_requests_share_serial_queue, true);
});

test('rule references reach the assigned agents without claiming runtime activation', () => {
  for (const key of ['company_tier_policy_ref', 'source_catalog_ref']) {
    assert.equal(discovery[key], strategy[key]);
    assert.equal(discovery[key], team[key]);
    for (const id of ['industry_company_researcher', 'job_scout', 'materials_advisor', 'independent_reviewer']) assert(team.roles.find((role) => role.id === id).inputs.includes(discovery[key]), id);
  }
  const reviewer = team.roles.find((role) => role.id === 'materials_advisor');
  assert.equal(reviewer.model, tiers.reviewer.model);
  assert.equal(reviewer.reasoning_effort, tiers.reviewer.reasoning_effort);
  assert.equal(tiers.runtime.grouped_report_implemented, true);
  assert.equal(tiers.runtime.automatic_classification_implemented, false);
  assert.equal(tiers.runtime.historical_companies_reclassified, false);
  assert.equal(sources.runtime.automatic_discovery_implemented, false);
  assert.equal(sources.runtime.scan_started_by_this_revision, false);
  assert.equal(sources.runtime.open_source_lead_import_implemented, true);
  assert.equal(sources.runtime.generic_static_official_reader_implemented, true);
  for (const path of [tiers.contract, sources.contract, sources.policy_origin_ref, sources.company_entry_ref, sources.adapter_ref, ...sources.access_refs]) {
    const absolute = resolve(ROOT, path);
    assert(!relative(ROOT, absolute).startsWith('..'));
    assert(existsSync(absolute), path);
  }
});
