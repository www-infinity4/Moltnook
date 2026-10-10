export function executionContext(env=process.env){
 const trusted=env.GITHUB_ACTIONS==='true'&&env.GITHUB_REPOSITORY==='www-infinity4/Moltnook'&&env.GITHUB_REF==='refs/heads/main'&&['push','schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)&&!env.GITHUB_HEAD_REF&&env.IS_FORK!=='true'&&env.TARGET_ENV!=='FORK';
 return {mode:trusted?'trusted_main':'isolated',productionAccess:trusted,reason:trusted?'Expected owner main workflow context':'Fork, pull request, local or unidentified context; production adapters disabled'};
}
