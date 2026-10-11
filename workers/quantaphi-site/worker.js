const EDGE_VERSION = 'quantaphi-org-v47-shoplc-same-origin';
const CANONICAL_ORIGIN = 'https://quantaphi.org';
const APPS = [
 { slug: '/infinity-phi/', aliases: ['/infinity/', '/InfinityPhi/', '/Infinity-Phi/'], repo: 'C13b0' },
 { slug: '/omni-phi/', aliases: ['/omni/', '/OmniPhi/'], repo: 'Omni-Phi' },
 { slug: '/news-phi/', aliases: ['/news/', '/NewsPhi/'], repo: 'News-Phi' },
 { slug: '/web-phi/', aliases: ['/web/', '/WebPhi/'], repo: 'Web-Phi' },
 { slug: '/builder-reserve/', aliases: ['/builder/', '/BuilderReserve/'], repo: 'Builder-Reserve' },
 { slug: '/infinity-radio/', aliases: ['/radio/', '/InfinityRadio/'], repo: 'Alien-Radio' },
 { slug: '/omni-tv/', aliases: ['/tv/', '/OmniTV/'], repo: 'Omni-TV' },
 { slug: '/alien-coin/', aliases: ['/alien/', '/AlienCoin/'], repo: 'Alien-Coin' },
 { slug: '/bitcoin-crusher/', aliases: ['/crusher/', '/BitcoinCrusher/'], repo: 'Bitcoin-Crusher' },
 { slug: '/oracle-octaves/', aliases: ['/octaves/'], repo: 'Oracle-Octaves' },
 { slug: '/mckee-coins/', aliases: ['/coins/', '/McKeeCoins/'], repo: 'Mckee-Coins-Inc' },
 { slug: '/shoplc/', aliases: ['/shop/'], repo: 'ShopLC' }
];
const SUPPORT_REPOS=[
 {prefix:'/TV-Database/',repo:'TV-Database'},
 {prefix:'/Mint-For-Infinity/',repo:'Mint-For-Infinity'},
 {prefix:'/Control-Phi/',repo:'Control-Phi'},
 {prefix:"/Hermit-TV/",repo:"Hermit-TV"},
 {prefix:"/Star-Launcher/",repo:"Star-Launcher"},
 {prefix:"/HBO/",repo:"HBO"},
 {prefix:"/Starz/",repo:"Starz"},
 {prefix:"/Cinemax/",repo:"Cinemax"},
 {prefix:"/Showtime/",repo:"Showtime"},
 {prefix:"/Encore/",repo:"Encore"},
 {prefix:"/Cartoon-Network/",repo:"Cartoon-Network"},
 {prefix:"/WGN/",repo:"WGN"},
 {prefix:"/TNT/",repo:"TNT"},
 {prefix:"/NBC/",repo:"NBC"},
 {prefix:"/FOX/",repo:"FOX"},
 {prefix:"/FX/",repo:"FX"},
 {prefix:"/Nickelodeon/",repo:"Nickelodeon"},
 {prefix:"/FSN/",repo:"FSN"},
 {prefix:"/ESPN/",repo:"ESPN"},
 {prefix:"/MTV/",repo:"MTV"},
 {prefix:"/VH1/",repo:"VH1"},
 {prefix:"/AMC/",repo:"AMC"},
 {prefix:"/Disney/",repo:"Disney"},
 {prefix:"/USA/",repo:"USA"},
 {prefix:"/Comedy-Central/",repo:"Comedy-Central"},
 {prefix:"/BET/",repo:"BET"},
 {prefix:"/Discovery/",repo:"Discovery"},
 {prefix:"/Nintendo-TV/",repo:"Nintendo-TV"},
 {prefix:"/Chiller/",repo:"Chiller"},
 {prefix:"/TBS/",repo:"TBS"},
 {prefix:"/ABC/",repo:"ABC"},
 {prefix:"/CBS/",repo:"CBS"},
 {prefix:"/PBS/",repo:"PBS"},
 {prefix:"/History-Channel/",repo:"History-Channel"},
 {prefix:"/CNN/",repo:"CNN"},
 {prefix:"/Trump-TV/",repo:"Trump-TV"},
 {prefix:"/ShopLC/",repo:"ShopLC"},
 {prefix:"/Ozzy-TV/",repo:"Ozzy-TV"},
 {prefix:"/CCR-TV/",repo:"CCR-TV"},
 {prefix:"/Motor-TV/",repo:"Motor-TV"},
 {prefix:"/Physics-TV/",repo:"Physics-TV"},
 {prefix:"/Adventure-TV/",repo:"Adventure-TV"},
 {prefix:"/Trigger-TV/",repo:"Trigger-TV"},
 {prefix:"/Time-Surfers/",repo:"Time-Surfers"},
 {prefix:"/Syncord/",repo:"Syncord"},
 {prefix:"/Astraflix/",repo:"Astraflix"},
 {prefix:"/Vintech/",repo:"Vintech"},
 {prefix:"/Flix-Blender/",repo:"Flix-Blender"},
 {prefix:"/Abstractia-/",repo:"Abstractia-"},
 {prefix:"/Animasync/",repo:"Animasync"},
 {prefix:"/SeekSync/",repo:"SeekSync"}
];
const RAW_TYPES = {
 html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8',
 css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
 svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
 webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
 woff: 'font/woff', woff2: 'font/woff2'
};
const appByIncomingPath = path => APPS.find(app => [app.slug, ...app.aliases].some(prefix => path === prefix.slice(0, -1) || path.startsWith(prefix)));
const OMNI_SUBROUTES=['build','overview','images','video','audio','structured','cards','code','create','ecosystem','share','share-card'];
const INFINITY_SUBROUTES=['wallet','profile','history','business','research','phi'];
const routeFor = incoming => {
 let path = incoming.pathname;
 const first=path.split('/').filter(Boolean)[0]||'';
 if(OMNI_SUBROUTES.includes(first)){
  return {redirect:'/omni-phi'+path+(path==='/' + first?'/':'')+incoming.search};
 }
 if(INFINITY_SUBROUTES.includes(first)){
  if(path==='/' + first)return {redirect:path+'/'};
  return {repo:'C13b0',sourcePath:path.endsWith('/')?path+'index.html':path,publicPath:path};
 }
 if (path === '/oracle-interface.css') return {repo:'Oracle',sourcePath:'/oracle-interface.css',publicPath:path};
 if (path === '/QuantaPhi' || path === '/QuantaPhi/' || path === '/QuantaPhi/index.html') return { redirect: '/' + incoming.search };
 if (path === '/' || path === '/index.html') return { repo: 'QuantaPhi', sourcePath: '/index.html', publicPath: '/' };
 if (path === '/page') return { redirect: '/page/' + incoming.search };
 if (path === '/page/' || path === '/page/index.html') return { repo: 'QuantaPhi', sourcePath: '/page/index.html', publicPath: '/page/' };
 if (path === '/learn') return { redirect: '/learn/' };
 if (path.startsWith('/learn/')) return { repo: 'QuantaPhi', sourcePath: path.endsWith('/') ? path + 'index.html' : path, publicPath: path };
 const support=SUPPORT_REPOS.find(item=>path.startsWith(item.prefix));
 if(support){let suffix=path.slice(support.prefix.length);if(!suffix||suffix.endsWith('/'))suffix+='index.html';return {repo:support.repo,sourcePath:'/'+suffix,publicPath:path};}
 const app = appByIncomingPath(path);
 if (app) {
  const matched = [app.slug, ...app.aliases].find(prefix => path === prefix.slice(0, -1) || path.startsWith(prefix));
  if (path === matched.slice(0, -1)) return { redirect: app.slug };
  let suffix = path.slice(matched.length);
  if (!suffix || suffix.endsWith('/')) suffix += 'index.html';
  return { repo: app.repo, sourcePath: '/' + suffix, publicPath: app.slug + suffix.replace(/index\.html$/, '') };
 }
 const legacy = APPS.find(item => path === '/' + item.repo || path.startsWith('/' + item.repo + '/'));
 if (legacy) {
  const suffix = path.slice(legacy.repo.length + 1).replace(/^\//, '');
  return { redirect: legacy.slug + suffix + incoming.search };
 }
 if (!path.slice(1).includes('/')) return { repo: 'QuantaPhi', sourcePath: path, publicPath: path };
 return { repo: 'QuantaPhi', sourcePath: path, publicPath: path };
};

function decodePublicHtml(value){
 return String(value||'')
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&nbsp;/gi,' ').replace(/&#(\d+);/g,(_m,n)=>String.fromCharCode(Number(n)))
  .replace(/\s+/g,' ').trim();
}
function allowedIbmUrl(value){
 try{
  const url=new URL(String(value||''));
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||!(host==='ibm.com'||host.endsWith('.ibm.com')))return null;
  url.hash='';return url;
 }catch{return null}
}
async function readIbmPublicPage(request,incoming){
 const target=allowedIbmUrl(incoming.searchParams.get('url'));
 if(!target)return Response.json({ok:false,error:'invalid_ibm_url'},{status:400,headers:{'Cache-Control':'no-store'}});
 const response=await fetch(target.href,{headers:{'Accept':'text/html,application/xhtml+xml','User-Agent':'QuantaPhi-IBM-Reader/1.0'},redirect:'follow',signal:AbortSignal.timeout(10000)});
 const finalUrl=allowedIbmUrl(response.url);
 if(!response.ok||!finalUrl)return Response.json({ok:false,error:'ibm_page_unavailable'},{status:502,headers:{'Cache-Control':'no-store'}});
 const type=response.headers.get('content-type')||'';
 if(!/text\/html/i.test(type))return Response.json({ok:false,error:'ibm_page_not_html'},{status:415,headers:{'Cache-Control':'no-store'}});
 const html=await response.text();
 const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'IBM').replace(/\s+/g,' ').trim().slice(0,240);
 const text=decodePublicHtml(html).slice(0,30000);
 return Response.json({ok:true,title,text,url:finalUrl.href},{headers:{'Cache-Control':'no-store','x-quantaphi-edge':EDGE_VERSION}});
}

async function getUpstream(url, request, headers) {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), 10000);
 try {
  return await fetch(new Request(url, {
   method: request.method, headers, redirect: 'manual', signal: controller.signal,
   body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body
  }));
 } finally { clearTimeout(timer); }
}
function rewriteSuiteText(text) {
 // Preserve inline Crusher behavior even while the page origin serves older HTML.
 if(text.includes('id="quanta-inline-crusher"')){
  text=text.replace('<a class="bodyShoe left bitcoinCrusherShoe" id="bitcoinCrusherShoe" href="/bitcoin-crusher/"','<button type="button" class="bodyShoe left bitcoinCrusherShoe" id="bitcoinCrusherShoe"').replace('▶ Play here</small></span></a>','▶ Play here</small></span></button>');
  text=text.replace("  event?.preventDefault();\n  const opening=wrap.hidden;","  event?.preventDefault();\n  event?.stopImmediatePropagation();\n  const opening=wrap.hidden;").replace(" foot.addEventListener('click',show);"," foot.addEventListener('click',show,true);");
 }

 // This bridge must execute on the old storage origin. It authenticates
 // postMessage replies against that origin, so suite navigation rewriting
 // must never move the bridge itself to quantaphi.org.
 const bridgeUrl='https://www-infinity4.github.io/QuantaPhi/wallet-link.html';
 text=text.split(bridgeUrl).join('__QUANTAPHI_STORAGE_BRIDGE__');
 text=text.split('https://www-infinity4.github.io/Infinity-Phi/').join(CANONICAL_ORIGIN + '/infinity-phi/');
 text=text.split('https://www-infinity4.github.io/Infinity-Phi').join(CANONICAL_ORIGIN + '/infinity-phi');
 for(const support of SUPPORT_REPOS){
  text=text.split('https://www-infinity4.github.io/'+support.repo+'/').join(CANONICAL_ORIGIN+support.prefix);
 }
 for (const app of APPS) {
  const github = 'https://www-infinity4.github.io/' + app.repo;
  text = text.split(github + '/').join(CANONICAL_ORIGIN + app.slug);
  text = text.split(github).join(CANONICAL_ORIGIN + app.slug.slice(0, -1));
  text = text.split('/' + app.repo + '/').join(app.slug);
  text = text.split('/' + app.repo).join(app.slug.slice(0, -1));
 }
 text = text.split('https://www-infinity4.github.io/QuantaPhi/').join(CANONICAL_ORIGIN + '/');
 return text.split('__QUANTAPHI_STORAGE_BRIDGE__').join(bridgeUrl);
}
// Social crawlers do not execute the browser app. Render topic metadata on the edge.
const QP_PREVIEW_IMAGE = CANONICAL_ORIGIN + '/preview.png?v=20261008-share1';
function qpShareEscape(value) {
 return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function qpSharePlain(value, max) {
 return String(value || '').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function qpShareImage(value) {
 try {
  const url=new URL(String(value || ''));
  if(url.protocol!=='https:' || url.href.length>1600 || !/\.(?:png|jpe?g|webp|gif)$/i.test(url.pathname)) return '';
  if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(url.hostname) || url.hostname.endsWith('.local')) return '';
  return url.href;
 }catch{return ''}
}
function qpShareResponse(incoming) {
 const search=qpSharePlain(incoming.searchParams.get('q'),320);
 const title=qpSharePlain(incoming.searchParams.get('title'),160) || search || 'QuantaPhi AI Research';
 const summary=qpSharePlain(incoming.searchParams.get('text'),450) || 'Discover original research, surprising stories, images, video and sound with QuantaPhi.';
 const kind=qpSharePlain(incoming.searchParams.get('kind'),30) || 'research';
 const customImage=qpShareImage(incoming.searchParams.get('image'));
 const image=customImage || QP_PREVIEW_IMAGE;
 const destination=new URL('/',CANONICAL_ORIGIN);
 if(search)destination.searchParams.set('q',search);
 destination.hash='result';
 const provided=qpSharePlain(incoming.searchParams.get('dest'),1800);
 if(provided) {
  try{const next=new URL(provided,CANONICAL_ORIGIN);if(next.origin===CANONICAL_ORIGIN && !next.pathname.startsWith('/q-share')){destination.pathname=next.pathname;destination.search=next.search;destination.hash=next.hash;}}
  catch {}
 }
 const canonical=new URL(incoming);canonical.hash='';
 const tags=[
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>'+qpShareEscape(title)+' | QuantaPhi</title>',
  '<meta name="description" content="'+qpShareEscape(summary.slice(0,240))+'">',
  '<link rel="canonical" href="'+qpShareEscape(canonical.href)+'">',
  '<meta property="og:type" content="article">',
  '<meta property="og:site_name" content="QuantaPhi">',
  '<meta property="og:url" content="'+qpShareEscape(canonical.href)+'">',
  '<meta property="og:title" content="'+qpShareEscape(title)+'">',
  '<meta property="og:description" content="'+qpShareEscape(summary.slice(0,240))+'">',
  '<meta property="og:image" content="'+qpShareEscape(image)+'">',
  '<meta property="og:image:alt" content="'+qpShareEscape(customImage?'QuantaPhi research image about '+title:'QuantaPhi copper emblem on deep blue background')+'">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="'+qpShareEscape(title)+'">',
  '<meta name="twitter:description" content="'+qpShareEscape(summary.slice(0,240))+'">',
  '<meta name="twitter:image" content="'+qpShareEscape(image)+'">',
  '<meta name="twitter:image:alt" content="'+qpShareEscape(customImage?'QuantaPhi research image about '+title:'QuantaPhi research cover artwork')+'">',
 ];
 if(!customImage)tags.push('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/png">');
 const html=tags.join('\n')+'</head><body style="background:#0a215f;color:white;font:16px system-ui;padding:2rem;max-width:42rem;margin:auto">'+
  '<h1>'+qpShareEscape(title)+'</h1><p>'+qpShareEscape(summary.slice(0,800))+'</p>'+
  '<a style="color:#ffe2b5" href="'+qpShareEscape(destination.href)+'">Open in QuantaPhi</a>'+
  '<script>location.replace('+JSON.stringify(destination.href).replace(/</g,'\\u003c')+')</script></body></html>';
 return new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=120, s-maxage=300','x-content-type-options':'nosniff','x-quantaphi-edge':EDGE_VERSION,'x-quantaphi-share':kind}});
}

const LEGACY_HANDOFF_HTML="<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>Moving QuantaPhi wallet</title></head><body><p>Recovering your existing wallet\u2026</p><script>\n'use strict';\nconst target=(()=>{try{const u=new URL(new URLSearchParams(location.search).get('return')||'');return ['https://quantaphi.org','https://www.quantaphi.org'].includes(u.origin)?u:null}catch{return null}})();\nconst prefix='starquest_ledger_device_v1:',values={};\ntry{\n const sessionRaw=localStorage.getItem('starquest_session');if(sessionRaw)values.starquest_session=sessionRaw;\n let session=null;try{session=JSON.parse(sessionRaw||'null')}catch{}\n const username=String(session?.username||session?.key||'').toLowerCase(),keys=[];\n for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'',value=localStorage.getItem(key)||'';if(key.startsWith(prefix)&&(/^sq_[A-Za-z0-9_-]{32,}$/.test(value)||/\"deviceToken\"\\s*:\\s*\"sq_[A-Za-z0-9_-]{32,}\"/.test(value)))keys.push(key)}\n const chosen=username?keys.filter(key=>key===prefix+username):(keys.length===1?keys:[]);\n for(const key of chosen)values[key]=localStorage.getItem(key);\n const accountKey=String(session?.key||username||chosen[0]?.slice(prefix.length)||'').toLowerCase();\n let users={},backup={};try{users=JSON.parse(localStorage.getItem('starquest_users')||'{}')}catch{}try{backup=JSON.parse(localStorage.getItem('starquest_users_backup_v1')||'{}')}catch{}\n const user=users[accountKey]||backup[accountKey];\n if(chosen.length===1&&user&&String(user.key||accountKey).toLowerCase()===accountKey){\n  const profile={key:accountKey,username:String(user.username||accountKey),passwordHash:String(user.passwordHash||''),joinedAt:user.joinedAt,lastLoginAt:user.lastLoginAt,tokens:user.tokens,pendingShareCredits:user.pendingShareCredits,shareCount:user.shareCount};\n  values.starquest_users=JSON.stringify({[accountKey]:profile});\n  if(!values.starquest_session)values.starquest_session=JSON.stringify({key:accountKey,username:profile.username,signedInAt:Date.now()});\n }\n}catch{}\nif(!target){document.body.textContent='Wallet return address rejected.'}\nelse if(Object.keys(values).some(key=>key.startsWith(prefix))){\n const bytes=new TextEncoder().encode(JSON.stringify({version:1,issuedAt:Date.now(),source:location.origin,values}));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);\n target.hash='quantaWalletLink='+btoa(binary).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');\n location.replace(target.href);\n}else{\n const fallback=new URL('https://www-infinity4.github.io/QuantaPhi/wallet-link.html');fallback.searchParams.set('mode','top');fallback.searchParams.set('v','20261004-account6');fallback.searchParams.set('return',target.href);location.replace(fallback.href);\n}\n</script></body></html>";
export default {
 async fetch(request, env) {
  const incoming = new URL(request.url);
  if (/^(?:www\.)?quantaphi\.net$/.test(incoming.hostname) && incoming.pathname === '/__wallet-handoff') return new Response(LEGACY_HANDOFF_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'x-quantaphi-edge': EDGE_VERSION } });
  if (/^(?:www\.)?quantaphi\.org$/.test(incoming.hostname) && incoming.pathname === '/__wallet-handoff') return new Response(LEGACY_HANDOFF_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'x-quantaphi-edge': EDGE_VERSION } });
  if (/^(?:www\.)?quantaphi\.(?:net|org)$/.test(incoming.hostname) && incoming.hostname !== 'quantaphi.org') {
   incoming.hostname = 'quantaphi.org'; incoming.protocol = 'https:';
   return Response.redirect(incoming.toString(), 308);
  }
  if (incoming.pathname.startsWith('/api/codephi/')) {
   if (!env.CODEPHI) return Response.json({ok:false,error:'Code Phi workshop is not bound.'},{status:503});
   const safeHeaders=new Headers(request.headers);safeHeaders.set('x-codephi-edge','trusted-router');
   return env.CODEPHI.fetch(new Request(request,{headers:safeHeaders}));
  }
  if (['/infinity-phi/phi/code','/infinity-phi/phi/code/','/phi/code','/phi/code/'].includes(incoming.pathname)) {
   const destination=new URL('/omni-phi/code/',CANONICAL_ORIGIN);destination.search=incoming.search;destination.searchParams.set('from','infinity');
   return Response.redirect(destination.href,302);
  }
  if (incoming.pathname === '/q-share' && (request.method === 'GET' || request.method === 'HEAD')) { const response=qpShareResponse(incoming); return request.method === 'HEAD' ? new Response(null,{status:response.status,headers:response.headers}) : response; }
  if (incoming.pathname === '/v1/site-read' && request.method === 'GET') {
   const site=(incoming.searchParams.get('site')||'').toLowerCase();
   if(site==='ibm')return readIbmPublicPage(request,incoming);
   return Response.json({ok:false,error:'unknown_site'},{status:404,headers:{'Cache-Control':'no-store'}});
  }
  if (incoming.pathname === '/health') return Response.json({
   ok: true, service: 'quantaphi-site', canonicalOrigin: CANONICAL_ORIGIN, appPath: '/QuantaPhi/index.html',
   version: EDGE_VERSION,
   routes: Object.fromEntries([['quantaPhi','/'], ...APPS.map(app => [app.repo, app.slug])])
  }, { headers: { 'Cache-Control': 'no-store', 'x-quantaphi-edge': EDGE_VERSION } });
  const route = routeFor(incoming);
  if (route.redirect) return Response.redirect(new URL(route.redirect, incoming.origin).toString(), 308);
  const repoPath = '/' + route.repo + route.sourcePath;
  // Versioned repair assets read the exact published commit, avoiding stale main responses.
  const repairRef = ['20261009-billboard-grid5','20261009-eight-subjects5'].includes(incoming.searchParams.get('v'));
  const newQuantaRelease = route.repo === 'QuantaPhi' && (route.sourcePath === '/index.html' || ['20261009-bright-star6','20261009-octaves-routing6'].includes(incoming.searchParams.get('v')));
  const newOctavesRelease = route.repo === 'Oracle-Octaves' && (route.sourcePath === '/index.html' || ['20261009-origin-timing2','20261009-resilient2'].includes(incoming.searchParams.get('v')));
  const sourceRef = route.repo === 'Control-Phi' ? '08563cfd39d0ee692ba6b3c73b92da29736ddd23' : route.repo === 'Bitcoin-Crusher' ? 'a2899745962de6ef43be78e63f441fe8361e9b1f' : route.repo === 'Omni-Phi' && route.sourcePath.startsWith('/code/') ? '4db62fa3f8644254ed4137b99e8db860513f99ae' : newQuantaRelease ? 'main' : newOctavesRelease ? '60c9436507cc34cb674a7b9a766c335a399b8dec' : repairRef && route.repo === 'QuantaPhi' ? 'f2a7ca87a3869397b201acd5d44990e23a47d947' : route.repo === 'QuantaPhi' && ['20261009-fresh-writer4','20261009-card-colors4'].includes(incoming.searchParams.get('v')) ? 'd0480d2f93007e10c73180097057fb05d2484971' : 'main';
  const origin = new URL('https://www-infinity4.github.io' + repoPath);
  origin.search = incoming.search;
  const extension = route.sourcePath.split('.').pop().toLowerCase();
  const textual = ['html','js','css','json','xml','txt'].includes(extension);
  if (textual) origin.searchParams.set('__qpedge', EDGE_VERSION);
  const headers = new Headers(request.headers);
  for (const name of ['Host', 'Cookie', 'Authorization']) headers.delete(name);
  if (textual) headers.set('Cache-Control', 'no-cache');
  let upstream, raw = false;
  const readRequest = ['GET', 'HEAD'].includes(request.method);
  // QuantaPhi itself follows current main first. GitHub Pages can be healthy but
  // briefly stale after a commit, which must never keep an old wallet/search script live.
  if (((route.repo === 'Omni-Phi' && route.sourcePath.startsWith('/code/')) || (route.repo === 'Alien-Radio' && route.sourcePath === '/oracle-track-feed.json') || route.repo === 'Oracle-Octaves' || route.repo === 'Oracle' || route.repo === 'QuantaPhi' || route.repo === 'Bitcoin-Crusher' || route.repo === 'TV-Database' || route.repo === 'ShopLC' || route.repo === 'Control-Phi' || SUPPORT_REPOS.some(x=>x.repo===route.repo)) && textual && readRequest) {
   const source = new URL('https://raw.githubusercontent.com/www-infinity4/' + route.repo + '/' + sourceRef + route.sourcePath);
   source.searchParams.set('__qpedge', EDGE_VERSION);
   try { upstream = await getUpstream(source, request, headers); raw = true; } catch {}
   if (upstream && !upstream.ok) { if (upstream.body) await upstream.body.cancel(); upstream = null; raw = false; }
  }
  if (!upstream) {
   try { upstream = await getUpstream(origin, request, headers); raw = false; } catch {}
  }
  if ((!upstream || (upstream.status >= 300 && upstream.status < 400) || upstream.status >= 500 || upstream.status === 404) && readRequest) {
   if (upstream?.body) await upstream.body.cancel();
   const source = new URL('https://raw.githubusercontent.com/www-infinity4/' + route.repo + '/' + sourceRef + route.sourcePath);
   source.searchParams.set('__qpedge', EDGE_VERSION);
   try { upstream = await getUpstream(source, request, headers); raw = true; } catch { upstream = null; }
  }
  if (!upstream) return new Response('The Phi gateway could not reach this page source. Please retry shortly.', {
   status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '10', 'x-quantaphi-edge': EDGE_VERSION }
  });
  const out = new Headers(upstream.headers);
  out.set('x-quantaphi-edge', EDGE_VERSION);
  out.set('x-quantaphi-app', route.repo);
  if (raw && upstream.ok && RAW_TYPES[extension]) out.set('Content-Type', RAW_TYPES[extension]);
  if (raw) { out.delete('Content-Security-Policy'); out.delete('Content-Disposition'); }
  // Upstream GitHub headers prohibit even our own embedded suite pages.
  if (['Bitcoin-Crusher','ShopLC'].includes(route.repo) && /text\/html/i.test(out.get('Content-Type') || '')) out.set('X-Frame-Options', 'SAMEORIGIN');
  if (textual || !upstream.ok) out.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  const contentType = out.get('Content-Type') || '';
  const infinityHtml = route.repo === 'C13b0' && /text\/html/i.test(contentType);
  if (infinityHtml) {
   // Infinity is a hashed Next.js export. Never let a browser reuse HTML from
   // one deployment after GitHub Pages has switched to a newer chunk set.
   // This preserves wallet/storage state while preventing stale HTML -> 404 CSS/JS.
   out.set('Cache-Control','no-store, no-cache, max-age=0, must-revalidate');
   out.set('Pragma','no-cache');
   out.set('Expires','0');
  }
  if (request.method === 'GET' && upstream.ok && /text\/html|javascript|text\/css|application\/json/.test(contentType)) {
   const rewritten = rewriteSuiteText(await upstream.text());
   out.delete('Content-Length'); out.delete('Content-Encoding'); out.delete('ETag');
   return new Response(rewritten, { status: upstream.status, headers: out });
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
 }
};
