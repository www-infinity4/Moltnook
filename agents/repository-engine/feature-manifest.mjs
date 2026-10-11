// Generate reproducible read-only acceptance probes from the pinned source.
// A source-derived expectation is never an owner-specified change request.
const roots={
 'www-infinity4/QuantaPhi':'https://quantaphi.org/',
 'www-infinity4/Omni-Phi':'https://quantaphi.org/omni-phi/',
 'www-infinity4/C13b0':'https://quantaphi.org/infinity-phi/',
 'www-infinity4/News-Phi':'https://quantaphi.org/news-phi/',
 'www-infinity4/ShopLC':'https://quantaphi.org/shoplc/'
};
export function deriveFeatureManifest({repository,linkFacts=[],liveBrowser}={}){
 const origin=roots[repository]||null,items=[];
 const rows=Array.isArray(linkFacts)?linkFacts.slice(0,8):[];
 for(const row of rows){
  if(!origin||!row||!/^[A-Za-z][\w:-]{0,79}$/.test(String(row.id||''))||!/^https:\/\/quantaphi\.org\/|^\//.test(String(row.href||'')))continue;
  const u=new URL(row.href,'https://quantaphi.org/');
  if(u.origin!=='https://quantaphi.org')continue;
  const browserTarget=Array.isArray(liveBrowser?.targets)?liveBrowser.targets.find(t=>t.url===u.origin+u.pathname):null;
  const checked=browserTarget&&Array.isArray(browserTarget.views)&&browserTarget.views.length>0&&browserTarget.views.every(x=>x.passed===true);
  items.push({id:'source-control-'+items.length,sourcePath:row.sourcePath||'index.html',selector:'#'+row.id,
    currentLabel:String(row.label||'').slice(0,140),sourceHref:row.href,
    browserPage:origin,targetURL:u.origin+u.pathname,
    expectedOutcome:'The source control keeps its current label and href; verify it is visible in the live DOM, resolves to the same-origin destination, and that destination renders.',
    verified:{destinationPublicLoad:!!checked,controlDOM:'not_checked',deploymentVersion:'not_checked'},
    evidence:{browserStatus:browserTarget?.views?.map(x=>x.httpStatus||null)||[],screenshots:browserTarget?.views?.map(x=>x.screenshotPath).filter(Boolean)||[]},
    excludes:['No click/checkout/mint','No login or wallet mutation','No claim that the current commit is deployed']});
 }
 return {schemaVersion:1,repository,createdAt:new Date().toISOString(),
  source:'pinned_repository_anchor_facts',manifestProvidedByOwner:false,publicBrowserAvailable:liveBrowser?.status==='public_browser_passed',
  artifactDirectory:'repository-receipts/',checks:items.slice(0,6),
  status:items.length?'source_derived_unverified':'no_safe_source_controls',
  note:'Source-derived assertions are suggested read-only checks, not proof of intended labels, feature behavior or release provenance.'};
}
