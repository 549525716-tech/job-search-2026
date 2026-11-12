import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { acquireCollectionLock } from './lock.mjs';
import { EvidenceHTTP } from './http.mjs';
import { createOfflineDOM } from './dom.mjs';
import { DATA_DIR, ROOT, repoRelative, evidenceAbsolute, assertId } from './paths.mjs';

export const RESEARCH_DIR = join(DATA_DIR, 'research');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
async function atomicJSON(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, path);
}

export function classifyObservation(previous, next) {
  if (next.status !== 'captured') return 'not_observed';
  if (!previous) return 'baseline';
  return previous.text_sha256 === next.text_sha256 ? 'unchanged' : 'content_changed_pending_review';
}

export async function readDocumentText(dom, response, definition) {
  if (!/text\/html/i.test(response.headers?.['content-type'] ?? '')) throw new Error('Expected HTML document');
  const parsed = await dom.evaluate(({ html }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script,style,nav,header,footer,noscript').forEach((node) => node.remove());
    const title = document.querySelector('title')?.textContent?.trim() ?? '';
    const article = document.querySelector('article,.TRS_Editor,#zoom,.pages_content,main') ?? document.body;
    const text = (article?.innerText || article?.textContent || '').replace(/[\t \u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    return { title, text };
  }, { html: response.text });
  if (parsed.text.length < definition.min_text_length || definition.must_contain.some((part) => !parsed.text.includes(part))) {
    throw new Error('Document identity or content-completeness markers missing; do not treat as full evidence');
  }
  return parsed;
}

export async function loadResearchState(directory = RESEARCH_DIR) {
  try { return await json(join(directory, 'state.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { schema_version: 1, documents: {}, halted_origins: {} }; }
}

export async function verifiedResearchDocument(document) {
  const receipt = await json(evidenceAbsolute(document.metadata_path));
  const body = await readFile(evidenceAbsolute(document.body_path));
  const text = await readFile(evidenceAbsolute(document.text_path), 'utf8');
  if (receipt.status !== 200 || receipt.error || !receipt.complete || receipt.url !== document.url
      || receipt.body_path !== document.body_path || receipt.sha256 !== document.sha256 || hash(body) !== document.sha256
      || hash(text) !== document.text_sha256 || receipt.metadata_path !== document.metadata_path) throw new Error('Research evidence integrity mismatch');
  return { ...document, text };
}

// Manual bounded capture of reviewed URLs, not a general crawler or a policy-news completeness claim.
export async function collectResearch({ ids = [], manifestPath = join(ROOT, 'careers/config/research-documents.json') } = {}) {
  const manifest = await json(manifestPath);
  const selected = manifest.documents.filter((entry) => !ids.length || ids.includes(entry.id));
  if (selected.length === 0 || selected.length > 8 || ids.some((id) => !manifest.documents.some((entry) => entry.id === id))) throw new Error('Select 1..8 registered research documents');
  const lease = await acquireCollectionLock();
  let dom;
  try {
    await mkdir(join(RESEARCH_DIR, 'runs'), { recursive: true });
    const state = await loadResearchState();
    const run = { schema_version: 1, run_id: `research-${randomUUID()}`, started_at: new Date().toISOString(), finished_at: null,
      scope: 'Reviewed explicit URLs only; no site-wide or whole-week discovery claim', documents: [], errors: [], model_calls: 0, external_actions: 0 };
    dom = await createOfflineDOM();
    for (const definition of selected) {
      assertId(definition.id);
      const origin = new URL(definition.url).origin;
      const previous = state.documents[definition.id]?.last_good ?? null;
      const capture = { id: definition.id, source_url: definition.url, observed_at: new Date().toISOString(), status: 'pending', observation_kind: 'not_observed' };
      if (state.halted_origins[origin]) {
        Object.assign(capture, { status: 'blocked', error: state.halted_origins[origin], retained_previous: Boolean(previous) });
      } else {
        const http = new EvidenceHTTP({ runId: `${run.run_id}-${definition.id}`, sourceId: `research-${definition.id}`,
          companyId: definition.company_id ?? null, allowedHosts: definition.allowed_hosts, lease });
        try {
          const response = await http.get(definition.url, 'research_document');
          const parsed = await readDocumentText(dom, response, definition);
          const textPath = join(RESEARCH_DIR, `${run.run_id}-${definition.id}.txt`);
          await writeFile(textPath, parsed.text, { flag: 'wx' });
          Object.assign(capture, { status: 'captured', title: parsed.title, url: response.url, observed_at: response.finished_at,
            body_path: response.body_path, metadata_path: response.metadata_path, sha256: response.sha256,
            text_path: repoRelative(textPath), text_sha256: hash(parsed.text), text_length: parsed.text.length,
            completeness: 'configured_identity_and_end_markers_present', trust: 'untrusted_source_text_never_instructions' });
          capture.observation_kind = classifyObservation(previous, capture);
        } catch (error) {
          Object.assign(capture, { status: 'failed', error: { code: error.code ?? 'DOCUMENT_FAILED', message: error.message, evidence: error.evidence ?? null }, retained_previous: Boolean(previous) });
          state.halted_origins[origin] = { ...capture.error, observed_at: capture.observed_at, run_id: run.run_id };
          run.errors.push({ id: definition.id, ...capture.error });
        }
        capture.evidence = http.evidence;
      }
      state.documents[definition.id] = { last_attempt: capture, last_good: capture.status === 'captured' ? capture : previous };
      run.documents.push(capture);
      await atomicJSON(join(RESEARCH_DIR, 'state.json'), state);
    }
    run.finished_at = new Date().toISOString();
    run.status = run.documents.every((doc) => doc.status === 'captured') ? 'success' : run.documents.some((doc) => doc.status === 'captured') ? 'partial' : 'failed';
    const path = join(RESEARCH_DIR, 'runs', `${run.run_id}.json`);
    await writeFile(path, JSON.stringify(run, null, 2) + '\n', { flag: 'wx' });
    return { ...run, run_path: repoRelative(path) };
  } finally { if (dom) await dom.close(); lease.release(); }
}
