(()=>{
  'use strict';
  const API_BASE=String(window.VOCABSTAR_CONFIG?.apiBaseUrl||'').replace(/\/$/,'');
  const SESSION_KEY='vocabstar_account_session_v1';
  const USER_KEY='vocabstar_account_user_v1';
  const DIRTY_KEY='vocabstar_account_dirty_v1';
  const DATA_KEY='vocabstar_v3';
  let token=localStorage.getItem(SESSION_KEY)||'';
  let username=localStorage.getItem(USER_KEY)||'';
  let authMode='login';
  let syncTimer=null;
  let applyingCloud=false;
  let pendingCloudData=null;

  const el=id=>document.getElementById(id);
  const countWords=x=>(x?.files||[]).reduce((n,f)=>n+(f.lists||[]).reduce((m,l)=>m+(l.words||[]).length,0),0);
  const setStatus=(text,kind='')=>{
    el('accountStatusText').textContent=text;
    el('accountDot').className='accountDot '+kind;
  };
  const setSession=(nextToken,nextUser)=>{
    token=nextToken||'';username=nextUser||'';
    if(token){localStorage.setItem(SESSION_KEY,token);localStorage.setItem(USER_KEY,username)}
    else{localStorage.removeItem(SESSION_KEY);localStorage.removeItem(USER_KEY)}
    el('accountBtn').textContent=token?username:'ログイン';
    setStatus(token?'同期済み':'この端末のみ',token?'online':'');
  };
  async function api(path,options={}){
    if(!API_BASE)throw new Error('アカウント機能の接続先がまだ設定されていません。');
    const headers={'Content-Type':'application/json',...(options.headers||{})};
    if(token)headers.Authorization=`Bearer ${token}`;
    const response=await fetch(`${API_BASE}${path}`,{...options,headers});
    let body={};try{body=await response.json()}catch(e){}
    if(!response.ok){
      if(response.status===401)setSession('','');
      throw new Error(body.error||'通信に失敗しました。');
    }
    return body
  }
  async function trioApi(){
    const frame=el('trioFrame');
    if(!frame)return null;
    if(frame.contentWindow?.VocabStarTrioCloud)return frame.contentWindow.VocabStarTrioCloud;
    await new Promise(resolve=>{frame.addEventListener('load',resolve,{once:true});setTimeout(resolve,2500)});
    return frame.contentWindow?.VocabStarTrioCloud||null
  }
  async function makeBundle(){
    const auxiliary={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith('vocabstar_')&&![DATA_KEY,SESSION_KEY,USER_KEY,DIRTY_KEY].includes(key))auxiliary[key]=localStorage.getItem(key);
    }
    const trio=await trioApi();
    return {version:2,state,auxiliary,trio:trio?await trio.exportData():null}
  }
  async function applyBundle(bundle){
    if(!bundle?.state?.files?.length)throw new Error('クラウドデータの形式が正しくありません。');
    applyingCloud=true;
    try{
      try{localStorage.setItem(`vocabstar_pre_cloud_backup_${Date.now()}`,JSON.stringify(state))}catch(e){}
      state=ensureUserDataShape(bundle.state);
      localStorage.setItem(DATA_KEY,JSON.stringify(state));
      Object.entries(bundle.auxiliary||{}).forEach(([key,value])=>{
        if(key.startsWith('vocabstar_')&&typeof value==='string')localStorage.setItem(key,value)
      });
      activeFileId=state.files[0].id;activeListId=state.files[0].lists[0].id;viewMode='list';
      autoSpeak.checked=Boolean(state.settings.autoSpeak);
      render();
      const trio=await trioApi();
      if(bundle.trio&&trio)await trio.importData(bundle.trio)
    }finally{applyingCloud=false}
  }
  async function upload(){
    if(!token||applyingCloud)return;
    clearTimeout(syncTimer);setStatus('同期中…','syncing');
    try{
      const result=await api('/api/data',{method:'PUT',body:JSON.stringify({data:await makeBundle()})});
      localStorage.removeItem(DIRTY_KEY);setStatus('同期済み','online');
      el('lastSyncText').textContent=`最終同期: ${new Date(result.updatedAt).toLocaleString()}`
      return true
    }catch(error){setStatus('同期できません','');console.error(error);throw error}
  }
  function scheduleUpload(){
    if(!token||applyingCloud)return;
    localStorage.setItem(DIRTY_KEY,'1');clearTimeout(syncTimer);setStatus('変更あり','syncing');syncTimer=setTimeout(()=>upload().catch(()=>{}),700)
  }
  window.addEventListener('vocabstar-trio-changed',scheduleUpload);
  const originalSave=window.save;
  window.save=function(){originalSave();scheduleUpload()};

  function openAuth(mode='login'){
    authMode=mode;el('authError').textContent='';el('authPassword').value='';
    el('authTitle').textContent=mode==='login'?'ログイン':'新規登録';
    el('authSubmitBtn').textContent=mode==='login'?'ログイン':'登録する';
    el('authModeBtn').textContent=mode==='login'?'新規登録はこちら':'ログインはこちら';
    el('authPassword').autocomplete=mode==='login'?'current-password':'new-password';
    el('authDialog').showModal()
  }
  async function afterAuthentication(result){
    setSession(result.token,result.username);el('authDialog').close();
    const cloud=await api('/api/data');
    pendingCloudData=cloud.data;
    const localWords=countWords(state),cloudWords=countWords(cloud.data?.state);
    el('migrationInfo').innerHTML=`この端末: <b>${localWords}語</b><br>クラウド: <b>${cloudWords}語</b><br><span class="muted">どちらを選んでも、この端末の元データは削除しません。</span>`;
    el('useCloudBtn').disabled=!cloud.data;
    el('migrationDialog').showModal()
  }
  el('accountBtn').onclick=()=>token?(el('accountUsername').textContent=username,el('accountDialog').showModal()):openAuth();
  el('authModeBtn').onclick=()=>openAuth(authMode==='login'?'register':'login');
  el('authSubmitBtn').onclick=async()=>{
    const user=el('authUsername').value.trim(),password=el('authPassword').value;
    el('authError').textContent='';el('authSubmitBtn').disabled=true;
    try{await afterAuthentication(await api(`/api/${authMode}`,{method:'POST',body:JSON.stringify({username:user,password})}))}
    catch(error){el('authError').textContent=error.message}
    finally{el('authSubmitBtn').disabled=false}
  };
  el('migrateLocalBtn').onclick=async()=>{try{if(pendingCloudData)try{localStorage.setItem(`vocabstar_cloud_backup_${Date.now()}`,JSON.stringify(pendingCloudData))}catch(e){}await upload();pendingCloudData=null;el('migrationDialog').close()}catch(error){alert(error.message)}};
  el('useCloudBtn').onclick=async()=>{try{const cloud=await api('/api/data');await applyBundle(cloud.data);pendingCloudData=null;el('migrationDialog').close();setStatus('同期済み','online')}catch(error){alert(error.message)}};
  el('keepLocalBtn').onclick=async()=>{try{await api('/api/logout',{method:'POST'})}catch(e){}pendingCloudData=null;setSession('','');el('migrationDialog').close()};
  el('syncNowBtn').onclick=()=>upload().catch(error=>alert(error.message));
  el('logoutBtn').onclick=async()=>{
    if(localStorage.getItem(DIRTY_KEY))try{await upload()}catch(error){alert('クラウドへ同期できませんでした。端末内のデータは残っています。')}
    try{await api('/api/logout',{method:'POST'})}catch(e){}
    setSession('','');el('accountDialog').close()
  };

  setSession(token,username);
  if(token&&API_BASE)api('/api/me').then(async me=>{
    setSession(token,me.username);
    if(localStorage.getItem(DIRTY_KEY))await upload();
    else{
      const cloud=await api('/api/data');
      if(cloud.data)await applyBundle(cloud.data)
    }
  }).catch(()=>setSession('',''));
})();


