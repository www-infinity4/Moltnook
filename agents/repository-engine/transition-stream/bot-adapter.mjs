// Bot-accessible source-window -> Queue event adapter.
// Pure Node module: callers choose WHEN to execute and supply an authorized token.
import {sha256, sourceWindows} from '../context-windows.mjs';

function splitWindow(part) {
  const lines = part.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const output = [];
  for (let offset = 0; offset < lines.length; offset += 15) {
    const slice = lines.slice(offset, offset + 15);
    output.push({lineOffset:offset, text:slice.join('\n'), count:slice.length});
  }
  return output;
}
export function inspectionEvents({
  original, task, repository, commitSha, jobId, quantId, agentId = 'pink-panther',
  ruleId = 'oracle.bounded-source-review', stage = 'RED', outcome = 'observed',
  assessment = 'code_inspection', observedAt = Date.now(), websiteScope = 'quantaphi.org'
}) {
  const packet = sourceWindows(original, {task, maxChars:32000});
  const events = [];
  for (const [filePath, file] of Object.entries(packet.source)) {
    if (file.kind !== 'existing') continue;
    const full = original[filePath];
    for (const window of file.windows) {
      // The pinned SHA and absolute character offsets make partial/minified
      // source windows independently recoverable by the next authorized bot.
      const firstLine = 1 + (full.slice(0, window.start).match(/\n/g) || []).length;
      for (const slice of splitWindow(window.text)) {
        if (!slice.count || !slice.text) continue;
        const lineStart = firstLine + slice.lineOffset;
        const iterationId = sha256(
          [jobId, filePath, file.sha256, window.start, window.end, slice.lineOffset, ruleId].join('\n')
        ).slice(0, 40);
        events.push({repository, commitSha, jobId, quantId, agentId,
          iterationId, filePath, fullFileSha256:file.sha256,
          snippetSha256:sha256(slice.text), lineStart, lineEnd:lineStart + slice.count - 1,
          ruleId, stage, outcome, assessment, observedAt, websiteScope,
          systemCreditValue:1});
      }
    }
  }
  return {events, metadata:{
    sourceHashes:Object.fromEntries(Object.entries(packet.source).map(([p,v])=>[p,v.sha256])),
    totalWindows:events.length, sourcePacketVersion:packet.schemaVersion,
    payoutIssued:false, executed:false
  }};
}
export async function submitInspectionEvents(events, {
  url, bearerToken, fetchImpl = fetch
}) {
  if (!/^https:\/\//.test(url || '') || typeof bearerToken !== 'string' || bearerToken.length < 32) {
    throw Error('transition_stream_not_configured');
  }
  if (!Array.isArray(events) || !events.length) return {queued:0,persisted:false,payoutIssued:false};
  let queued = 0;
  for (let start = 0; start < events.length; start += 50) {
    // Never send raw source; validated caller fields only.
    const chunk = events.slice(start, start + 50);
    const response = await fetchImpl(url.replace(/\/$/, '') + '/v1/iterations', {
      method:'POST',
      headers:{authorization:'Bearer ' + bearerToken, 'content-type':'application/json'},
      body:JSON.stringify(chunk),
      signal:AbortSignal.timeout(15000)
    });
    if (response.status !== 202) throw Error('transition_stream_enqueue_failed_status_' + response.status);
    const receipt = await response.json();
    if (receipt.queued !== true || receipt.count !== chunk.length || receipt.persisted !== false) {
      throw Error('transition_stream_unexpected_receipt');
    }
    queued += receipt.count;
  }
  return {queued,persisted:false,payoutIssued:false};
}
