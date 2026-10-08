const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('vocab/index.html','utf8');
const source=html.slice(html.indexOf('function exportFileWords(){'),html.indexOf('/* star merged export */'));
const file={name:'Test/File',lists:[{words:[{en:'apple',jp:'りんご',star:0}]},{words:[{en:'apple',jp:'林檎',example:'a\tline\nnext',star:2}]}]};
const original=JSON.stringify(file);let blob,link={},clicked=0,alerts=0;
const ctx={currentFile:()=>file,Blob,URL:{createObjectURL(b){blob=b;return 'blob:test'},revokeObjectURL(){}},document:{getElementById:()=>({}),createElement:()=>Object.assign(link,{click(){clicked++},remove(){}}),body:{appendChild(){}}},setTimeout:f=>f(),alert:()=>alerts++};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
  ctx.exportFileWords();
  assert.equal(await blob.text(),'apple\tりんご\t\napple\t林檎\ta line next');
  assert.equal(link.download,'Test_File_all_words.tsv');assert.equal(clicked,1);
  assert.equal(JSON.stringify(file),original);
  file.lists=[];ctx.exportFileWords();assert.equal(alerts,1);assert.equal(clicked,1);
  console.log('PASS: all lists, duplicate words preserved, TSV escaping, filename, empty file, no data changes');
})().catch(e=>{console.error(e);process.exitCode=1});
