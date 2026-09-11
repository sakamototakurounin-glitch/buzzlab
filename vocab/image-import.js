(()=>{
  if(window.__vocabstarImageImportV1)return;
  window.__vocabstarImageImportV1=true;
  const importDialogNode=document.getElementById('importDialog');
  if(!importDialogNode||!document.getElementById('importText'))return;

  const style=document.createElement('style');
  style.textContent=`
    .vocabImageThumb{width:54px;height:38px;object-fit:contain;border:1px solid var(--line);border-radius:6px;background:#fff;flex:0 0 auto}
    .flashFlagImage{display:none;max-width:210px;max-height:125px;width:auto;height:auto;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff;margin-bottom:14px}
    .imageImportBox{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px;background:#f9fafb}
    .imageImportBox label{display:block;font-weight:750;font-size:13px;margin-bottom:6px}
    .imageImportStatus{font-size:12px;color:var(--sub);margin-top:6px;line-height:1.45}
    .imageImportFile{width:100%}
  `;
  document.head.appendChild(style);

  const imageBox=document.createElement('div');
  imageBox.className='imageImportBox';
  imageBox.innerHTML=`
    <label for="bulkImageInput">画像をまとめて選択（任意）</label>
    <input class="imageImportFile" id="bulkImageInput" type="file" accept="image/*" multiple>
    <div class="imageImportStatus" id="bulkImageStatus">画像なしでも通常どおりインポートできます。</div>
  `;
  importText.insertAdjacentElement('afterend',imageBox);

  const imageInput=imageBox.querySelector('#bulkImageInput');
  const imageStatus=imageBox.querySelector('#bulkImageStatus');
  let imageFiles=new Map();

  const help=importDialogNode.querySelector('.help');
  if(help){
    help.innerHTML='1行1件：<b>表面[TAB]裏面[TAB]例文（任意）[TAB]画像ファイル名（任意）</b><br>国旗セットは <b>国名｜首都｜画像ファイル名</b> のまま貼り付けできます。';
  }

  function splitImportLine(line){
    if(line.includes('\t'))return line.split('\t');
    if(line.includes('｜'))return line.split('｜');
    return line.split(',');
  }

  parseImport=function(text){
    return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(line=>{
      const p=splitImportLine(line).map(x=>x.trim());
      const en=p[0]||'';
      const jp=p[1]||'';
      let example='';
      let imageName='';
      if(p.length>=4){
        example=p[2]||'';
        imageName=p[3]||'';
      }else if(p.length===3){
        if(/\.(png|jpe?g|webp|gif|svg)$/i.test(p[2]||''))imageName=p[2]||'';
        else example=p[2]||'';
      }
      return {en,jp,example,imageName};
    }).filter(x=>x.en&&x.jp&&!(
      (x.en==='国名'||x.en==='英単語'||x.en==='表面') &&
      (x.jp==='首都'||x.jp==='日本語'||x.jp==='裏面')
    ));
  };

  function fileToDataURL(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('画像を読み込めませんでした'));
      reader.readAsDataURL(file);
    });
  }

  imageInput.onchange=()=>{
    imageFiles=new Map(Array.from(imageInput.files||[]).map(f=>[f.name.toLowerCase(),f]));
    const bytes=Array.from(imageFiles.values()).reduce((s,f)=>s+(f.size||0),0);
    const mb=(bytes/1024/1024).toFixed(1);
    imageStatus.textContent=imageFiles.size
      ? `${imageFiles.size}枚を選択中（約${mb} MB）。リスト内の画像ファイル名と自動照合します。`
      : '画像なしでも通常どおりインポートできます。';
  };

  const originalImportClick=importBtn.onclick;
  importBtn.onclick=()=>{
    imageFiles.clear();
    imageInput.value='';
    imageStatus.textContent='画像なしでも通常どおりインポートできます。';
    originalImportClick?.();
  };

  doImportBtn.onclick=async()=>{
    const rows=parseImport(importText.value);
    if(!rows.length){alert('インポートできるデータがありません。');return}
    const l=currentList();
    if(!l)return;

    const existing=new Map(l.words.map(w=>[String(w.en||'').toLowerCase(),w]));
    let added=0,imagesAdded=0,imagesMissing=0;

    doImportBtn.disabled=true;
    const oldLabel=doImportBtn.textContent;
    doImportBtn.textContent='読み込み中…';

    try{
      for(const r of rows){
        const key=r.en.toLowerCase();
        let w=existing.get(key);

        if(!w){
          w={id:uid(),en:r.en,jp:r.jp,example:r.example||'',star:0};
          l.words.push(w);
          existing.set(key,w);
          added++;
        }else{
          if(r.jp)w.jp=r.jp;
          if(r.example)w.example=r.example;
        }

        if(r.imageName){
          w.imageName=r.imageName;
          const file=imageFiles.get(r.imageName.toLowerCase());
          if(file){
            w.image=await fileToDataURL(file);
            imagesAdded++;
          }else if(!w.image){
            imagesMissing++;
          }
        }
      }

      save();
      importDialogNode.close();

      let msg=`${added}件を追加しました。`;
      if(imagesAdded)msg+=`\n画像 ${imagesAdded}枚を登録しました。`;
      if(imagesMissing)msg+=`\n${imagesMissing}枚は対応画像が未選択です。`;
      alert(msg);
    }catch(e){
      console.error(e);
      alert('画像の保存に失敗しました。画像が多すぎる場合は、画像サイズを小さくして再度お試しください。');
    }finally{
      doImportBtn.disabled=false;
      doImportBtn.textContent=oldLabel;
    }
  };

  const originalRender=render;
  render=function(){
    originalRender();
    try{
      const words=filteredWords();
      const rows=Array.from(wordBody.querySelectorAll('tr'));
      rows.forEach((tr,i)=>{
        const w=words[i];
        if(!w?.image)return;
        const head=tr.querySelector('.wordHead');
        if(!head||head.querySelector('.vocabImageThumb'))return;
        const img=document.createElement('img');
        img.className='vocabImageThumb';
        img.src=w.image;
        img.alt='';
        head.insertBefore(img,head.firstChild);
      });
    }catch(e){
      console.warn('VocabStar image render:',e);
    }
  };

  const frontFace=flashCard?.querySelector('.flashFace');
  let flashImage=document.getElementById('flashFlagImage');
  if(frontFace&&!flashImage){
    flashImage=document.createElement('img');
    flashImage.id='flashFlagImage';
    flashImage.className='flashFlagImage';
    flashImage.alt='';
    frontFace.insertBefore(flashImage,flashWord);
  }

  const originalShowFlash=showFlash;
  showFlash=function(){
    originalShowFlash();
    if(!flashImage)return;
    const w=flashState?.items?.[flashState.index];
    if(w?.image){
      flashImage.src=w.image;
      flashImage.style.display='block';
    }else{
      flashImage.removeAttribute('src');
      flashImage.style.display='none';
    }
  };

  render();
})();
