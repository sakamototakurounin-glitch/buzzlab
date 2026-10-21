const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('vocab/index.html','utf8');
const code=html.slice(html.indexOf('/* speech */'),html.indexOf('let speechVoice=null;'));
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
const v=(name,lang,localService=true)=>({name,lang,localService});
// macOS/iOS: ノベルティ音声が名前順で先に来ても選ばない
assert.equal(ctx.pickEnglishVoice([v('Albert','en-US'),v('Bad News','en-US'),v('Daniel','en-GB'),v('Samantha','en-US'),v('Kyoko','ja-JP')]).name,'Samantha');
// Android: en_US のアンダースコア表記も英語として扱い、英米が混在しても en-US を優先
assert.equal(ctx.pickEnglishVoice([v('English United Kingdom','en_GB'),v('English United States','en_US')]).name,'English United States');
assert.equal(ctx.pickEnglishVoice([v('Kyoko','ja-JP')]),null);
const cases=[['apple','apple'],['run (v.)','run'],['color/colour','color'],['look forward to ~ing','look forward to doing'],['take care of sth','take care of something'],['remind sb of','remind someone of'],['abandon【動】','abandon'],['DNA','DNA'],['be fond of','be fond of'],['りんご',' りんご'.trim()]];
for(const [input,expected] of cases)assert.equal(ctx.speechText(input),expected,input);
assert.equal(ctx.applyPronunciationFixes('Misgiving'),'mis giving');assert.equal(ctx.applyPronunciationFixes('have misgivings about it'),'have mis givings about it');assert.equal(ctx.applyPronunciationFixes('giving'),'giving');
console.log('PASS: pronunciation fixes; English voice skips novelty voices and prefers en-US; speech text drops notes, alternates, Japanese and placeholders');
