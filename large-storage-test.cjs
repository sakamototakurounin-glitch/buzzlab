// Requires fake-indexeddb (test dependency only; never shipped to the site).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {IDBFactory}=require(process.env.VOCABSTAR_IDB_MODULE||'fake-indexeddb');
const source=fs.readFileSync('vocab/storage.js','utf8');
const raw=JSON.stringify({files:[{id:'f',lists:[{id:'l',words:[{id:'w',en:'apple',jp:'りんご',star:2}]}]}]});
function boot(indexedDB,local){
  const ctx={indexedDB,window:{dispatchEvent(){}},CustomEvent:class{},localStorage:{getItem:k=>local.get(k)??null}};
  vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.window.VocabStarStorage;
}
(async()=>{
  const indexedDB=new IDBFactory(),legacy=new Map([['vocabstar_v3',raw],['vocabstar_account_dirty_v1','1']]);
  const a=boot(indexedDB,legacy);await a.ready;
  assert.equal(a.initialState,raw);assert.equal(legacy.get('vocabstar_v3'),raw);
  const large=JSON.stringify({files:[{id:'f',lists:[{id:'l',words:[{en:'big',jp:'大きい',example:'x'.repeat(7*1024*1024),star:1}]}]}]});
  await a.write(large,{dirty:true});assert.equal(a.small.getItem('vocabstar_account_dirty_v1'),'1');
  await a.small.setItem('vocabstar_flash_progress_v2','progress');
  const b=boot(indexedDB,legacy);await b.ready;
  assert.equal(b.initialState,large);assert.equal(b.small.getItem('vocabstar_flash_progress_v2'),'progress');assert.equal(legacy.get('vocabstar_v3'),raw);
  await b.small.removeItem('vocabstar_account_dirty_v1');assert.equal(b.small.getItem('vocabstar_account_dirty_v1'),null);
  const c=boot(indexedDB,legacy);await c.ready;assert.equal(c.small.getItem('vocabstar_account_dirty_v1'),null);
  const before=c.initialState;await assert.rejects(()=>c.write('{invalid'));assert.equal(c.initialState,before);
  await Promise.all([c.write(raw),c.write(large)]);
  const d=boot(indexedDB,legacy);await d.ready;assert.equal(d.initialState,large);
  const bad=boot(new IDBFactory(),new Map([['vocabstar_v3','invalid']]));await assert.rejects(()=>bad.ready);
  const unavailable=boot({open(){throw new Error('unavailable')}},legacy);await assert.rejects(()=>unavailable.ready);
  assert.equal(legacy.get('vocabstar_v3'),raw);
  // Simulate a real IndexedDB commit abort, not merely an app-level error.
  const factory=new IDBFactory(),realOpen=factory.open.bind(factory);
  let abortWrites=false;
  const intercepted={open(...args){const req=realOpen(...args);req.addEventListener('success',()=>{
    const db=req.result,original=db.transaction.bind(db);
    db.transaction=(stores,mode)=>{const tx=original(stores,mode);if(abortWrites&&mode==='readwrite')queueMicrotask(()=>tx.abort());return tx};
  });return req}};
  const e=boot(intercepted,legacy);await e.ready;abortWrites=true;
  await assert.rejects(()=>e.write(large));assert.equal(e.initialState,raw);
  abortWrites=false;const f=boot(factory,legacy);await f.ready;assert.equal(f.initialState,raw);
  console.log('PASS: legacy migration retained, 7 MiB save/reload, progress/dirty persistence, queued writes, invalid data, unavailable DB and commit abort preserve previous data');
})().catch(error=>{console.error(error);process.exitCode=1});
