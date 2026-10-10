// Evidence-bound Moltnook routing. Classification suggests a handoff; it does not execute work.
export const PROJECTS = [
  'Moltnook','Oracle-Octaves','QuantaPhi','Infinity-Phi','Omni-Phi',
  'Bitcoin-Crusher','Mint-For-Infinity','News-Phi','claude-flow','501'
];
const RULES = [
 {pattern:/\b(bug|glitch|broken|crash|error|fail|regress|freeze|timeout|repair)\b/i,agent:'pink-panther',to:'greenbeans',action:'Can we reproduce this and identify the affected commit? A fix needs a test and a release receipt.'},
 {pattern:/\b(wallet|ledger|starcoin|token|sync|database|data route|payout|mint)\b/i,agent:'blueberry',to:'bluth',action:'Check schema, origin and identity before importing. Preserve existing wallets and idempotency keys.'},
 {pattern:/\b(import|ingest|data migration|external dataset)\b/i,agent:'bluey',to:'blueberry',action:'Stage the import and verify exact fields, licensing and provenance before deciding its final destination.'},
 {pattern:/\b(physics|atom|element|quantum|hydrogen|electron|frequency|radio wave)\b/i,agent:'orange-julius',to:'purple-people-eater',action:'Why is it so? Separate the proposed mechanism from measurements, then design a small falsifiable test.'},
 {pattern:/\b(bitcoin|crusher|stocks?|trading|market|research|scrap)\b/i,agent:'naked-gold-digger',to:'gold-diggers-ink',action:'Collect independent, attributable sources before the writer drafts anything. Research does not publish or trade.'},
 {pattern:/\b(simplify|ease|onboarding|plain language|help text|tutorial)\b/i,agent:'purple-pleasure',to:'purple-pearl',action:'Propose small supportive widgets and clear copy so the next step is obvious.'},
 {pattern:/\b(design|style|button|layout|oracle|card|accessibility|mobile|image)\b/i,agent:'purple-pearl',to:'greenbeans',action:'Use the Oracle Octaves controls consistently. Explain the user path before implementation.'},
 {pattern:/\b(story|writer|reader|article|book|content|episode)\b/i,agent:'gold-diggers-ink',to:'purple-pearl',action:'Map each source to the story without repeating material. Keep the result easy to read.'},
 {pattern:/\b(agent|skill|api|workflow|worker|deploy|integrat|build|claude|automation|git)\b/i,agent:'greenbeans',to:'pink-panther',action:'Map dependencies and propose a testable change. Production work needs evidence and an authorized execution path.'};
export function routeEvent(event) {
  if (!event || typeof event.title !== 'string') throw new TypeError('Event title required');
  const title = event.title.replace(/\s+/g,' ').trim().slice(0,155);
  const rule = RULES.find(r=>r.pattern.test(title)) || {
    agent:'purple-people-eater',to:'bluth',action:'Determine the real task and identify the tool or specialist it needs before changing anything.'
  };
  const kind = event.kind === 'PR' ? 'pull request' : event.kind === 'commit' ? 'commit' : 'issue';
  const isDone = event.state === 'closed' || event.state === 'merged';
  return {
    id:String(event.id),agent:rule.agent,to:rule.to,project:event.project,kind:event.kind,
    phase:isDone?'Observed closed':'Proposed routing',when:event.when,url:event.url,
    title,
    message:'I found a ' + kind + ' titled “' + title + '”. ' + rule.action + (isDone?' Its closed state is recorded, but successful production behavior is not inferred.':'')
  };
}
export function selectRoute(title,project) {return routeEvent({id:'preview',title,project,kind:'issue',when:'',url:''});}
