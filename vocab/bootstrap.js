(async()=>{
  const errorBox=document.getElementById('storageNotice');
  const fail=error=>{console.error(error);errorBox.hidden=false;errorBox.textContent='保存領域を開けませんでした。サイトデータは削除せず、他のタブを閉じて開き直してください。元の単語データは残しています。'};
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(src+' を読み込めません'));document.body.appendChild(s)})}
  try{
    await window.VocabStarStorage.ready;
    // A classic script preserves the existing shared globals and extensions.
    const main=document.createElement('script');main.textContent=document.getElementById('vocabAppSource').textContent;document.body.appendChild(main);
    if(typeof window.save!=='function')throw new Error('アプリを準備できませんでした。');
    if(!window.VocabStarStorage.initialState&&await window.save()===false)throw new Error('保存データを準備できませんでした。');
    const modes=document.createElement('script');modes.textContent=document.getElementById('vocabModeSource').textContent;document.body.appendChild(modes);
    await load('./account-config.js');await load('./account.js');await load('./image-import.js');
    document.getElementById('storageLoading').remove();
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  }catch(error){fail(error)}
})();
