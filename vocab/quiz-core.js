(function(root){
  const key=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
  const meanings=v=>key(v).split(/[、,;；\/／]/).map(key).filter(Boolean);
  function build(pool,prompt,answer,{reference=pool,aliases=false}={}){
    const parts=x=>aliases?meanings(answer(x)):[key(answer(x))];
    const valid=pool.filter(x=>key(prompt(x))&&key(answer(x)));
    return valid.flatMap(x=>{
      if(reference.some(y=>key(prompt(y))===key(prompt(x))&&key(answer(y))&&key(answer(y))!==key(answer(x))))return [];
      const seen=new Set([key(answer(x))]);
      const distractors=valid.filter(y=>{
        const k=key(answer(y));
        if(seen.has(k)||parts(x).some(v=>parts(y).includes(v)))return false;
        seen.add(k);return true;
      });
      return distractors.length>=3?[{answer:x,distractors}]:[];
    });
  }
  const api={key,build};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.QuizCore=api;
})(globalThis);
