// Fixed owner-approved targets from the QuantaPhi card catalog (2026-10-22).
// Never treat arbitrary forked libraries with index.html as owner site rebuilds.
export const CARD_TARGETS=Object.freeze([
 {repo:'Bitcoin-Crusher',card:'bitcoin-crusher',route:'/bitcoin-crusher/'},
 {repo:'Alien-Radio',card:'infinity-radio',route:'/infinity-radio/'},
 {repo:'C13b0',card:'infinity-phi',route:'/infinity-phi/'},
 {repo:'Omni-Phi',card:'omni-phi',route:'/omni-phi/'},
 {repo:'News-Phi',card:'news-phi',route:'/news-phi/'},
 {repo:'Omni-TV',card:'omni-tv',route:'/omni-tv/'},
 {repo:'ShopLC',card:'shoplc',route:'/shoplc/'},
 {repo:'Alien-Coin',card:'alien-coin',route:'/alien-coin/'},
 {repo:'Mckee-Coins-Inc',card:'mckee-coins',route:'/mckee-coins/'},
 {repo:'Oracle-Octaves',card:'oracle-octaves',route:'/oracle-octaves/'},
 {repo:'QuantaPhi',card:'quantaphi',route:'/'}
]);
export const FOCUS_MARKER='<!-- bubbles-serialized-owner-card-audit-v1 -->';
export function cardTarget(name){
 if(typeof name!=='string'||!/^www-infinity4\/[A-Za-z0-9_.-]+$/.test(name))return null;
 return CARD_TARGETS.find(x=>'www-infinity4/'+x.repo===name)||null;
}
export function focusIssue(finding){
 const target=cardTarget(finding?.name);
 if(!target||!Array.isArray(finding?.concerns)||!finding.concerns.length||!Array.isArray(finding?.uiPaths)||!finding.uiPaths.length)return null;
 const sha=/^[a-f0-9]{40}$/.test(finding.sha||'')?finding.sha:'unverified';
 const title='[Bubbles Card Proposal] '+target.repo+' → '+target.card;
 return {title,body:[
  FOCUS_MARKER,
  'One owner-card repository at a time. This issue is an investigation and approval proposal, NOT a completed build, approved Brain ticket, PR, merge or live deployment.',
  'Target repository: '+finding.name,
  'Pinned source SHA: '+sha,
  'Source tree: https://github.com/'+finding.name+'/tree/'+sha,
  'Existing QuantaPhi card: '+target.card,
  'Expected public route: '+target.route,
  '',
  'Evidence-based concerns:',...finding.concerns.map(x=>'- '+String(x).slice(0,240)),
  '',
  'Bubbles autonomous preparation: inspect pinned repo and current live route, inspect existing registered card and legacy components, map broken links/players/wallet integrations, make a small reproducible test plan, write a robot/* DRAFT PR in the target repository, run source tests and mobile/desktop browser acceptance, obtain independent reviewer receipts.',
  'Use Oracle Octaves white cards (#fff), paper (#f7f4f0), warm ink (#312722), red actions (#b83b32), readable 44px controls and responsive layout. Preserve the working site, playback, wallet and existing user data.',
  'For Bitcoin Crusher: preserve the current real search/research system and its card; do not bring back the obsolete Copilot-like game environment.',
  'Owner approval required before registering or publishing new QuantaPhi cards, changing the live route, or merging a card-catalog/host edit. Leave drafts for approval, not a claim of success.',
  'Report truthful receipts: source SHA, exact changes, tests, browser before/after, draft PR URL and remaining blockers. When this focused issue is closed, the next eligible registered-card repository can be proposed.'
 ].join('\n')};
}
export function chooseFocus(findings,issues){
 if(!Array.isArray(findings)||!Array.isArray(issues))throw Error('Complete owner inventory and tracker issue listing required');
 const active=issues.find(x=>x&&!x.pull_request&&x.state==='open'&&String(x.body||'').includes(FOCUS_MARKER));
 if(active)return {status:'awaiting_existing_focus',activeUrl:active.html_url||null,proposal:null};
 const prior=new Set(issues.filter(x=>x&&!x.pull_request).map(x=>x.title).filter(Boolean));
 for(const target of CARD_TARGETS){
  const finding=findings.find(x=>x?.name==='www-infinity4/'+target.repo);
  const proposal=focusIssue(finding);
  if(proposal&&!prior.has(proposal.title))return {status:'ready',activeUrl:null,proposal};
 }
 return {status:'no_unreviewed_registered_card',activeUrl:null,proposal:null};
}
