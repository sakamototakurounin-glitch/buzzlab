// Isolated local UI fixture: never calls the production API or touches its data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('vocab');
const seed={files:[{id:'fixture-file',name:'保存テスト',lists:[{id:'fixture-list',name:'移行済み単語',words:[{id:'fixture-word',en:'apple',jp:'りんご',example:'An apple.',star:1}]}]}],settings:{},learningHistory:[]};
http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/seed.js'){
    res.setHeader('Content-Type','application/javascript');
    res.end(`if(!localStorage.getItem('vocabstar_v3'))localStorage.setItem('vocabstar_v3',${JSON.stringify(JSON.stringify(seed))});window.alert=()=>{};`);return;
  }
  if(pathname.endsWith('/account-config.js')){res.setHeader('Content-Type','application/javascript');res.end('window.VOCABSTAR_CONFIG={apiBaseUrl:""};');return}
  if(pathname.endsWith('/sw.js')){res.writeHead(404);res.end();return}
  const file=path.resolve(root,pathname==='/'?'index.html':'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);res.end();return}
    const types={'.js':'application/javascript','.html':'text/html','.webmanifest':'application/manifest+json'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    if(path.extname(file)==='.html'&&path.basename(file)==='index.html')data=data.toString().replace('<script src="./storage.js">','<script src="/seed.js"></script><script src="./storage.js">');
    res.end(data);
  });
}).listen(8765,'127.0.0.1',()=>console.log('Isolated preview: http://127.0.0.1:8765/'));
