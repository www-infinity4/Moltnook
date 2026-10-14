// Cloudflare Queue -> D1 evidence ledger. No wallet minting or model invocation.
// The event payload deliberately excludes raw source, secrets and credentials.
const REPO = /^www-infinity4\/[A-Za-z0-9_.-]{1,100}$/;
const SHA40 = /^[a-f0-9]{40}$/i;
const SHA64 = /^[a-f0-9]{64}$/i;
const STAGES = new Set(['RED', 'BLUE', 'YELLOW', 'BLACK']);
const OUTCOMES = new Set(['observed', 'accepted', 'rejected', 'blocked', 'failed']);
const ASSESSMENTS = new Set(['code_inspection', 'regex', 'layout', 'syntax', 'ci', 'review']);
const MAX_BODY = 64000;
const MAX_PER_HOUR = 20000; // telemetry only, never currency
const MAX_BATCH = 50; // producer batch; Queues consumer batch configured separately

function required(value, label, pattern, max = 160) {
  if (typeof value !== 'string' || !value || value.length > max || (pattern && !pattern.test(value))) {
    throw new Error('invalid_' + label);
  }
  return value;
}
function safePath(value) {
  required(value, 'file_path', /^[A-Za-z0-9_.\/@+-]+$/, 240);
  if (value.startsWith('/') || value.split('/').some(s => !s || s === '.' || s === '..') ||
      /(^|\/)(?:\.git|\.env|node_modules|secrets?|credentials?)(?:\/|$)/i.test(value)) {
    throw new Error('unsafe_file_path');
  }
  return value;
}
export function normalizeIteration(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_record');
  const repository = required(raw.repository, 'repository', REPO);
  const quantId = required(raw.quantId, 'quant_id', /^[A-Za-z0-9_:.-]+$/, 120);
  const jobId = required(raw.jobId, 'job_id', /^[A-Za-z0-9_:./#-]+$/, 160);
  const iterationId = required(raw.iterationId, 'iteration_id', /^[A-Za-z0-9_:.-]+$/, 120);
  const filePath = safePath(raw.filePath);
  const commitSha = required(raw.commitSha, 'commit_sha', SHA40, 40).toLowerCase();
  const fullFileSha256 = required(raw.fullFileSha256, 'file_sha256', SHA64, 64).toLowerCase();
  const snippetSha256 = required(raw.snippetSha256, 'snippet_sha256', SHA64, 64).toLowerCase();
  const stage = required(raw.stage, 'stage', null, 10);
  const outcome = required(raw.outcome, 'outcome', null, 10);
  const assessment = required(raw.assessment, 'assessment', null, 30);
  if (!STAGES.has(stage) || !OUTCOMES.has(outcome) || !ASSESSMENTS.has(assessment)) throw new Error('invalid_assessment_state');
  const start = raw.lineStart, end = raw.lineEnd;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end - start >= 15) {
    throw new Error('invalid_15_line_window');
  }
  // Explanations are machine-readable enums/short labels only. Source can be
  // recovered from the pinned Git SHA with separately authorized GitHub access.
  const ruleId = required(raw.ruleId, 'rule_id', /^[A-Za-z0-9_.:-]+$/, 100);
  const agentId = required(raw.agentId, 'agent_id', /^[A-Za-z0-9_.:-]+$/, 90);
  const scope = required(raw.websiteScope || 'quantaphi.org', 'website_scope', /^[A-Za-z0-9_.-]+$/, 120);
  const weight = raw.systemCreditValue === undefined ? 1 : raw.systemCreditValue;
  if (!Number.isSafeInteger(weight) || weight < 0 || weight > 5) throw new Error('invalid_telemetry_weight');
  const observedAt = raw.observedAt;
  if (!Number.isSafeInteger(observedAt) || observedAt < 1700000000000 ||
      observedAt > Date.now() + 300000) throw new Error('invalid_observed_at');
  return {repository, quantId, jobId, iterationId, filePath, commitSha,
    fullFileSha256, snippetSha256, stage, outcome, assessment, ruleId,
    agentId, scope, weight, lineStart: start, lineEnd: end, observedAt, hourBucket: Math.floor(observedAt / 3600000)};
}
export async function eventId(record) {
  const basis = [record.repository, record.jobId, record.iterationId, record.commitSha,
    record.filePath, record.snippetSha256, record.stage, record.outcome, record.ruleId].join('\n');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(basis));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}
});
const authorized = (request, env) => {
  const secret = env.BOT_INGEST_TOKEN;
  const bearer = request.headers.get('authorization');
  // A missing secret disables the entire handler; the token is NEVER logged.
  if (typeof secret !== 'string' || secret.length < 32) return false;
  if (!bearer || !bearer.startsWith('Bearer ')) return false;
  const supplied = bearer.slice(7);
  if (supplied.length !== secret.length) return false;
  let different = 0;
  for (let i = 0; i < secret.length; i++) different |= supplied.charCodeAt(i) ^ secret.charCodeAt(i);
  return different === 0;
};
function hourlyCeiling(env) {
  const configured = Number(env.MAX_EVENTS_PER_REPO_HOUR);
  return Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, MAX_PER_HOUR) : MAX_PER_HOUR;
}
function statement(env, record) {
  return env.BOT_TRANSITIONS_DB.prepare(
    'INSERT INTO token_state_transitions (transition_id, quant_id, job_id, iteration_id, repository_name, file_path, commit_sha, full_file_sha256, snippet_sha256, current_lifecycle_stage, outcome, assessment, rule_id, agent_id, website_scope_identifier, line_start, line_end, iteration_weight_type, system_credit_value, observed_at_ms, hour_bucket) ' +
    'SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ' +
    '(SELECT COUNT(*) FROM token_state_transitions WHERE repository_name = ? AND hour_bucket = ?) < ? ' +
    'ON CONFLICT(transition_id) DO NOTHING'
  ).bind(record.id, record.quantId, record.jobId, record.iterationId, record.repository,
    record.filePath, record.commitSha, record.fullFileSha256, record.snippetSha256,
    record.stage, record.outcome, record.assessment, record.ruleId, record.agentId,
    record.scope, record.lineStart, record.lineEnd, 'INSPECTION', record.weight,
    record.observedAt, record.hourBucket, record.repository, record.hourBucket, hourlyCeiling(env));
}
async function queueOneBatch(items, env) {
  // All inserts commit atomically in D1.batch. Only acknowledge persisted IDs.
  try {
    const results = await env.BOT_TRANSITIONS_DB.batch(items.map(x => statement(env, x.record)));
    const unknown = items.filter((x, i) => !results[i] || results[i].success === false || !(results[i].meta?.changes > 0));
    let existing = new Set();
    if (unknown.length) {
      const marks = unknown.map(() => '?').join(',');
      const found = await env.BOT_TRANSITIONS_DB.prepare(
        'SELECT transition_id FROM token_state_transitions WHERE transition_id IN (' + marks + ')'
      ).bind(...unknown.map(x => x.record.id)).all();
      existing = new Set((found.results || []).map(r => r.transition_id));
    }
    items.forEach((x, i) => {
      if (results[i]?.success !== false && (results[i]?.meta?.changes > 0 || existing.has(x.record.id))) x.msg.ack();
      else x.msg.retry({delaySeconds: 3600}); // hourly budget full; DLQ after configured max retries
    });
  } catch (error) {
    console.error('transition_batch_retry', String(error?.message || error).slice(0, 140));
    items.forEach(x => x.msg.retry({delaySeconds: 60}));
  }
}
export default {
  async fetch(request, env) {
    if (!env.BOT_INGEST_TOKEN || String(env.BOT_INGEST_TOKEN).length < 32) return json({error:'ingest_unconfigured'}, 503);
    if (!authorized(request, env)) return json({error:'unauthorized'}, 401);
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/v1/iterations') {
      if (!env.BOT_EVENTS_QUEUE || !env.INGEST_RATE_LIMITER) return json({error:'queue_or_rate_limit_binding_missing'}, 503);
      if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return json({error:'json_required'}, 415);
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json({error:'payload_too_large'}, 413);
      let raw;
      try {
        const payload = await request.text();
        if (new TextEncoder().encode(payload).byteLength > MAX_BODY) return json({error:'payload_too_large'}, 413);
        raw = JSON.parse(payload);
      } catch { return json({error:'invalid_json'}, 400); }
      if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_BATCH) return json({error:'invalid_batch_length'}, 400);
      let records;
      try {
        records = raw.map(normalizeIteration);
        // Native limiter is fast but approximate/local, not an accounting ledger.
        for (const repository of new Set(records.map(r => r.repository))) {
          const result = await env.INGEST_RATE_LIMITER.limit({key:repository});
          if (!result.success) return json({error:'repository_ingest_burst_limit'}, 429);
        }
        records = await Promise.all(records.map(async r => ({...r, id:await eventId(r)})));
      } catch (error) { return json({error:String(error.message).slice(0, 100)}, 400); }
      try {
        await env.BOT_EVENTS_QUEUE.sendBatch(records.map(body => ({body})));
        return json({queued:true, count:records.length, eventIds:records.map(x => x.id),
          persisted:false, payoutIssued:false}, 202);
      } catch (error) {
        console.error('transition_enqueue_failed', String(error?.message || error).slice(0, 140));
        return json({error:'enqueue_failed_retry_same_iterations'}, 503);
      }
    }
    if (request.method === 'GET' && url.pathname === '/v1/report') {
      if (!env.BOT_TRANSITIONS_DB) return json({error:'database_binding_missing'}, 503);
      const repository = url.searchParams.get('repo');
      if (!REPO.test(repository || '')) return json({error:'invalid_repository'}, 400);
      const hour = Math.floor(Date.now() / 3600000);
      const summary = await env.BOT_TRANSITIONS_DB.prepare(
        'SELECT COUNT(*) AS iterations, COALESCE(SUM(system_credit_value),0) AS processingWeight FROM token_state_transitions WHERE repository_name = ? AND hour_bucket >= ?'
      ).bind(repository, hour - 23).first();
      const recent = await env.BOT_TRANSITIONS_DB.prepare(
        'SELECT transition_id, quant_id, job_id, iteration_id, file_path, commit_sha, current_lifecycle_stage, outcome, assessment, rule_id, agent_id, line_start, line_end, observed_at_ms FROM token_state_transitions WHERE repository_name = ? ORDER BY observed_at_ms DESC, transition_id DESC LIMIT 10'
      ).bind(repository).all();
      return json({repository, last24Hours:summary, top10:recent.results || [], walletPayouts:'not_part_of_telemetry'});
    }
    if (request.method === 'GET' && url.pathname === '/v1/resume') {
      if (!env.BOT_TRANSITIONS_DB) return json({error:'database_binding_missing'}, 503);
      const repo = url.searchParams.get('repo'), quant = url.searchParams.get('quant');
      if (!REPO.test(repo || '') || !/^[A-Za-z0-9_:.-]{1,120}$/.test(quant || '')) return json({error:'invalid_lookup'},400);
      const latest = await env.BOT_TRANSITIONS_DB.prepare(
        'SELECT * FROM token_state_transitions WHERE repository_name = ? AND quant_id = ? ORDER BY observed_at_ms DESC, transition_id DESC LIMIT 1'
      ).bind(repo, quant).first();
      return json({found:!!latest, last:latest || null, sourceRetrieval:'Fetch pinned commit_sha and file_path with authorized GitHub reader; verify full_file_sha256. No raw source stored.'});
    }
    return json({error:'not_found'}, 404);
  },
  async queue(batch, env) {
    if (!env.BOT_TRANSITIONS_DB) {
      batch.messages.forEach(msg => msg.retry({delaySeconds: 60}));
      return;
    }
    for (let start = 0; start < batch.messages.length; start += 25) {
      const chunk = batch.messages.slice(start, start + 25);
      const items = [];
      for (const msg of chunk) {
        try {
          const record = normalizeIteration({
            repository:msg.body.repository, quantId:msg.body.quantId, jobId:msg.body.jobId,
            iterationId:msg.body.iterationId, filePath:msg.body.filePath, commitSha:msg.body.commitSha,
            fullFileSha256:msg.body.fullFileSha256, snippetSha256:msg.body.snippetSha256,
            stage:msg.body.stage, outcome:msg.body.outcome, assessment:msg.body.assessment,
            ruleId:msg.body.ruleId, agentId:msg.body.agentId, websiteScope:msg.body.scope,
            systemCreditValue:msg.body.weight, lineStart:msg.body.lineStart,
            lineEnd:msg.body.lineEnd, observedAt:msg.body.observedAt
          });
          record.id = await eventId(record);
          if (record.id !== msg.body.id) throw new Error('transition_hash_mismatch');
          items.push({msg, record});
        } catch (error) {
          console.error('invalid_queued_transition', String(error?.message || error).slice(0, 100));
          msg.retry({delaySeconds: 60}); // Do not silently drop invalid payloads
        }
      }
      if (items.length) await queueOneBatch(items, env);
    }
  }
};
