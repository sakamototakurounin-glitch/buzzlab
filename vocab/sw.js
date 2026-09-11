const CACHE='vocabstar-cache-v19-trio-guard';
const ASSETS=['./','./index.html','./trio.html','./manifest.webmanifest','./image-import.js','./account-config.js','./account.js'];

async function injectImageImport(resp){
  const type=resp.headers.get('content-type')||'';
  if(!type.includes('text/html'))return resp;
  const html=await resp.text();
  const patched=html.includes('image-import.js')
    ? html
    : html.replace('</body>','<script src="./image-import.js"></script></body>');
  const headers=new Headers(resp.headers);
  headers.delete('content-length');
  return new Response(patched,{
    status:resp.status,
    statusText:resp.statusText,
    headers
  });
}

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
])));

self.addEventListener('fetch',e=>{
  e.respondWith((async()=>{
    const url=new URL(e.request.url);
    const vocabShell=e.request.mode==='navigate'&&(url.pathname.endsWith('/vocab/')||url.pathname.endsWith('/vocab/index.html'));
    try{
      const network=await fetch(e.request);
      const response=vocabShell
        ? await injectImageImport(network)
        : network;
      const copy=response.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return response;
    }catch(err){
      let cached=await caches.match(e.request);
      if(!cached&&e.request.mode==='navigate')cached=await caches.match('./index.html');
      if(cached&&vocabShell)return injectImageImport(cached);
      return cached||Response.error();
    }
  })());
});
