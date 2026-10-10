/* QuantaPhi.org /moltnook proxy.
   Only public static files from the owner's Moltnook repository can be served.
   Worker routes must be scoped to /moltnook*; no wallet or GitHub write keys. */
addEventListener('fetch',event=>event.respondWith((async()=>{
 const request=event.request,url=new URL(request.url);
 if(url.pathname==='/moltnook')return Response.redirect(url.origin+'/moltnook/'+url.search,308);
 if(!url.pathname.startsWith('/moltnook/'))return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 let suffix=url.pathname.slice('/moltnook/'.length);
 if(!suffix||suffix.endsWith('/'))suffix+='index.html';
 if(suffix.includes('..')||suffix.startsWith('/'))return new Response('Invalid path',{status:400});
 const extension=suffix.split('.').pop().toLowerCase(),mime={
   html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',
   css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',
   txt:'text/plain; charset=utf-8',svg:'image/svg+xml; charset=utf-8',
   png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',ico:'image/x-icon'
 }[extension]||'application/octet-stream';
 const text=['html','js','css','json','txt','svg'].includes(extension);
 const upstream=text?'https://raw.githubusercontent.com/www-infinity4/Moltnook/main/'+suffix+
   '?moltnookFresh='+Date.now():'https://www-infinity4.github.io/Moltnook/'+suffix;
 let response;
 try{response=await fetch(upstream,{redirect:'follow',signal:AbortSignal.timeout(12000)});}
 catch(error){return new Response('Moltnook source temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
 if(!response.ok)return new Response(response.status===404?'File not found':'Moltnook source unavailable',{status:response.status===404?404:502,headers:{'Cache-Control':'no-store'}});
 const headers=new Headers(response.headers);
 headers.set('Content-Type',mime);headers.set('Cache-Control',text?'no-store, max-age=0':'public, max-age=180');
 headers.set('X-Content-Type-Options','nosniff');
 headers.delete('content-security-policy');headers.delete('content-security-policy-report-only');headers.delete('x-frame-options');
 headers.delete('set-cookie');headers.delete('content-encoding');headers.delete('content-length');
 headers.set('X-Moltnook-Source','www-infinity4/Moltnook');
 return new Response(request.method==='HEAD'?null:response.body,{status:200,headers});
})()));
