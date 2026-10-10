const VERSION='20261010-fixture1';
const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 const reply=(value,status=200)=>Response.json({...value,environment:env.ENVIRONMENT,version:VERSION,fixture:true,productionAccess:false},{status,headers:{'Cache-Control':'no-store'}});
 if(path==='/health'&&request.method==='GET')return reply({ok:true,service:'infinity-bot-fixture',bindings:[]});
 if(request.headers.has('authorization'))return reply({ok:false,error:'production_credentials_rejected'},400);
 if(path==='/v1/image'&&request.method==='POST'){
  if(Number(request.headers.get('content-length')||0)>16384)return reply({ok:false,error:'fixture_payload_too_large'},413);
  const text=await request.text();if(text.length>16384)return reply({ok:false,error:'fixture_payload_too_large'},413);
  let data;try{data=JSON.parse(text)}catch{return reply({ok:false,error:'invalid_json'},400)}
  if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>7500||data.reference_mode!=='text-only'||typeof data.mode!=='string')return reply({ok:false,error:'image_contract_invalid'},422);
  return reply({ok:true,provider:'local-fixture',realGeneration:false,image:'data:image/png;base64,'+pixel});
 }
 if(path.startsWith('/v1/wallet'))return reply({ok:false,error:'real_wallet_unavailable_in_fixture'},403);
 return reply({ok:false,error:'not_found'},404);
}};
