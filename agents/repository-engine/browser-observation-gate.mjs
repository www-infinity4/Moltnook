// A green page load must never hide a failed source-grounded button inspection.
export function assessBrowserObservations(checks,sites){
 if(!Array.isArray(checks)||!Array.isArray(sites)||!sites.length)throw Error('Live observer requires expected sites');
 const failures=[];
 for(const site of sites){
  const record=checks.find(x=>x.repository===site.repository);
  if(!record?.browserPassed){failures.push({repository:site.repository,reason:'public page failed or was not observed'});continue}
  const required=(site.linkFacts||[]).filter(x=>x&&/^[A-Za-z][\w:-]{0,79}$/.test(String(x.id||'')));
  for(const row of required){
   for(const device of ['mobile','desktop']){
    const observations=(record.readOnlyControlChecks||[]).filter(x=>x.device===device);
    const found=observations.flatMap(x=>Array.isArray(x.controls)?x.controls:[]).find(x=>x.id===row.id);
    if(!found||found.verified!==true)failures.push({repository:site.repository,selector:'#'+row.id,device,reason:found?'live control did not match pinned selector, label or href':'required live control observation missing'});
   }
  }
 }
 return {status:failures.length?'public_browser_failed':'public_browser_passed',passed:failures.length===0,failures:failures.slice(0,30)};
}
