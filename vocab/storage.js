/* Larger local persistence. Legacy localStorage is retained, never erased. */
(()=>{
  let db,tail=Promise.resolve(),initialState=null;
  const values=new Map();
  function transaction(mode,action){return new Promise((resolve,reject)=>{
    const tx=db.transaction('records',mode),store=tx.objectStore('records');let result;
    try{result=action(store)}catch(error){reject(error);return}
    tx.oncomplete=()=>resolve(result?.result);
    tx.onabort=tx.onerror=()=>reject(tx.error||new Error('端末への保存に失敗しました。'));
  })}
  function enqueue(action){const task=tail.then(action);tail=task.catch(()=>{});return task}
  function validate(text){const data=JSON.parse(text);if(!Array.isArray(data?.files)||!data.files.length)throw new Error('保存データを読み込めません。元データは削除していません。');return text}
  function smallWrite(){const snapshot=Object.fromEntries(values);const task=enqueue(()=>transaction('readwrite',s=>s.put(snapshot,'small')));task.catch(error=>window.dispatchEvent(new CustomEvent('vocabstar-storage-error',{detail:error})));return task}
  const api={
    get initialState(){return initialState},
    async write(text,{dirty=false}={}){
      validate(text);
      if(dirty)values.set('vocabstar_account_dirty_v1','1');
      const small=Object.fromEntries(values);
      await enqueue(()=>transaction('readwrite',s=>{s.put(text,'state');if(dirty)s.put(small,'small')}));
      initialState=text;
    },
    backup(text){return enqueue(()=>transaction('readwrite',s=>s.put(text,'pre-cloud-backup')))},
    flush:()=>tail,
    small:{getItem:key=>values.has(key)?values.get(key):localStorage.getItem(key),setItem(key,value){values.set(key,String(value));return smallWrite()},removeItem(key){values.set(key,null);return smallWrite()},entries:()=>[...values].filter(([,v])=>v!==null)}
  };
  api.ready=(async()=>{
    db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('vocabstar-large-storage-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('records');
      request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
      request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('別のタブを閉じてから開き直してください。'));
    });
    const saved=await transaction('readonly',s=>s.get('state'));
    const small=await transaction('readonly',s=>s.get('small'));
    Object.entries(small||{}).forEach(([k,v])=>values.set(k,v));
    if(saved!==undefined)initialState=validate(saved);
    else{
      const legacy=localStorage.getItem('vocabstar_v3');
      if(legacy){validate(legacy);await api.write(legacy)}
    }
    return api;
  })();
  window.VocabStarStorage=api;
})();
