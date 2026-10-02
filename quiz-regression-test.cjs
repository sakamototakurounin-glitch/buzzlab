const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./vocab/quiz-core.js');
const rows=[['apple','りんご'],['dog','犬'],['cat','猫'],['book','本'],['tree','木']].map(([en,jp],id)=>({id,en,jp}));
const build=p=>core.build(p,x=>x.en,x=>x.jp,{aliases:true});
assert.equal(build(rows).length,5);
assert.equal(build(rows.slice(0,3)).length,0);
assert.equal(build([...rows,{en:' APPLE ',jp:'別の意味'}]).some(q=>q.answer.en==='apple'),false);
for(const q of build([...rows,{en:'hound',jp:'犬'},{en:'',jp:'空欄'},{en:'canine',jp:'犬、いぬ'}])){
  assert(q.distractors.length>=3);
  assert.equal(new Set([q.answer,...q.distractors].map(x=>core.key(x.jp))).size,q.distractors.length+1);
  if(q.answer.en==='dog')assert(!q.distractors.some(x=>['hound','canine'].includes(x.en)));
}
const trio=rows.map(x=>({id:x.id,values:[x.en,x.jp,'third']}));
assert.equal(core.build(trio,x=>x.values[2],x=>x.values[1]).length,0);
assert.equal(core.build(trio,x=>x.values[0],x=>x.values[1]).length,5);
assert.equal(core.build(trio,x=>x.values[0],x=>x.values[1],{reference:[...trio,{values:['apple','other']}] }).some(q=>q.answer.id===0),false);
for(const path of ['vocab/index.html','vocab/trio.html']){
  const html=fs.readFileSync(path,'utf8');
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:path});
  assert(html.includes('src="./quiz-core.js"'));
}
// Run the real parent quiz UI and verify exactly one answer is highlighted.
const html=fs.readFileSync('vocab/index.html','utf8');
const part=html.slice(html.indexOf('/* test */'),html.indexOf('/* recovery */'));
const elements={children:[],appendChild(x){this.children.push(x)}};
const ctx={QuizCore:core,wordsForView:()=>rows,shuffle:x=>[...x],alert:()=>assert.fail('Unexpected alert'),document:{createElement:()=>({dataset:{}})},testBtn:{},startTestBtn:{},testDialog:{},testEmpty:{classList:{add(){},remove(){}}},testBox:{classList:{add(){},remove(){}}},testProgress:{},sentence:{},feedback:{},nextQBtn:{classList:{add(){},remove(){}}},choices:elements,testState:{}};
vm.createContext(ctx);vm.runInContext(part,ctx);ctx.startTestBtn.onclick();
assert.equal(elements.children.length,4);
elements.children.forEach(x=>x.classList={add(){}});
elements.children[0].onclick();
assert.equal(ctx.testState.score,1);
assert(elements.children.every(x=>x.disabled));
const trioHtml=fs.readFileSync('vocab/trio.html','utf8');
const start=trioHtml.indexOf('function quizPool(){');
const end=trioHtml.indexOf('function closeModals()',start);
let data=trio;
const ui={quizStarOnly:{checked:false},quizShuffle:{checked:true},quizDirection:{value:'0,1'},quizArea:{innerHTML:''}};
const tc={QuizCore:core,currentDeck:'deck',itemsInDeck:()=>data,$:s=>ui[s.slice(1)],deckSchema:()=>({labels:['English','Meaning','Third'],types:['text','text','text']}),syncStudyQuizSelectors(){},shuffleCopy:x=>[...x],sample:(x,n)=>x.slice(0,n),esc:x=>x,mediaHTML:x=>x,quizState:null};
vm.createContext(tc);vm.runInContext(trioHtml.slice(start,end),tc);
tc.syncStudyQuizSelectors=()=>{};tc.newQuiz();
assert.equal((ui.quizArea.innerHTML.match(/data-choice/g)||[]).length,4);
data=trio.map(x=>({...x,values:[...x.values]}));data[0].values[1]='changed';tc.newQuiz();
assert.equal((ui.quizArea.innerHTML.match(/data-choice/g)||[]).length,4);
ui.quizDirection.value='2,1';tc.newQuiz();assert.equal(tc.quizState,null);
console.log('PASS: four distinct choices, blanks, ambiguous mappings, overlapping meanings, actual VocabStar/Trio quiz functions, edited items and syntax.');
