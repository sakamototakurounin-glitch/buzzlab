const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('vocab/index.html','utf8');
const code=html.slice(html.indexOf("const FLASH_PROGRESS_KEY="),html.indexOf('function showFlashScope('));
const store={};const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
const words=(p)=>[0,1,2,3].map(i=>({id:p+i,en:p+i,jp:'x',star:0}));
const state={files:[{id:'f',name:'F',lists:[{id:'l1',name:'L1',words:words('a')},{id:'l2',name:'L2',words:words('b')}]}]};
const ctx={localStorage,state,activeFileId:'f',activeListId:'l1',viewMode:'list',flashState:null,Date,defaultFlashScope:()=>'all'};
vm.createContext(ctx);vm.runInContext(code,ctx);
const run=(src)=>vm.runInContext(src,ctx);
const start=(list,index)=>{const l=state.files[0].lists.find(x=>x.id===list);run(`activeListId='${list}'`);
  ctx.flashState={scope:'all',items:l.words.map(w=>({...w,listId:list})),index,known:[],unknown:[],round:1,history:[]};run('saveFlashProgress()')};
// 1枚も進んでいない状態では保存せず、既存の進み具合を消さない
start('l2',2);start('l1',0);
assert.ok(JSON.parse(store.vocabstar_flash_progress_v2).items['f|l2|list|all'],'l2 の続きが消えた');
// 別のリストの続きも、最後に中断したものとして見つかる
run("activeListId='l1'");
let found=run('findFlashResume()');assert.equal(found.saved.listId,'l2');assert.equal(found.saved.index,2);
// 開いているリストの続きがあれば、それを優先する
start('l1',1);run("activeListId='l2'");found=run('findFlashResume()');assert.equal(found.saved.listId,'l2');
run("activeListId='l1'");assert.equal(run('findFlashResume()').saved.listId,'l1');
// 削除された単語は飛ばし、位置も合わせる
state.files[0].lists[1].words.shift();run("activeListId='l2'");found=run('findFlashResume()');assert.equal(found.saved.index,1);assert.equal(found.saved.items.length,3);
// 1周を終えたら続きは消える
ctx.flashState.index=ctx.flashState.items.length;run('saveFlashProgress()');
assert.equal(JSON.parse(store.vocabstar_flash_progress_v2).items['f|l2|list|all'],undefined);
// 旧形式の保存を引き継ぐ
for(const k of Object.keys(store))delete store[k];
store.vocabstar_flash_progress=JSON.stringify({fileId:'f',listId:'l1',viewMode:'list',scope:'all',round:1,index:2,items:[['a0','l1'],['a1','l1'],['a2','l1'],['a3','l1']],known:[['a0','l1'],['a1','l1']],unknown:[],history:[true,true]});
run("activeListId='l2'");found=run('findFlashResume()');assert.equal(found.saved.listId,'l1');assert.equal(found.saved.index,2);
console.log('PASS: progress is kept per list, opening never erases it, last-paused list is found, deleted words skipped, legacy data migrated');
