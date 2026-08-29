const encoder=new TextEncoder();
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
const bytesToBase64=bytes=>btoa(String.fromCharCode(...bytes));
const base64ToBytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const randomBase64=size=>bytesToBase64(crypto.getRandomValues(new Uint8Array(size))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function sha256(value){return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
async function passwordHash(password,salt){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return bytesToBase64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:base64ToBytes(salt),iterations:100000},key,256)))
}
function normalizedUsername(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('en-US')}
function allowedOrigin(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin)?origin:''
}
function cors(origin){return origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Vary':'Origin'}:{}}
async function authenticate(request,env){
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return null;
  const tokenHash=await sha256(token);
  const row=await env.DB.prepare(`SELECT u.id,u.username_display FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash,new Date().toISOString()).first();
  return row||null
}
async function createSession(userId,env){
  const token=randomBase64(32),now=new Date(),expires=new Date(now.getTime()+30*24*60*60*1000);
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now.toISOString()).run();
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sha256(token),userId,expires.toISOString(),now.toISOString()).run();
  return token
}
export default {async fetch(request,env){
  const origin=allowedOrigin(request,env),headers=cors(origin);
  if(request.method==='OPTIONS')return origin?new Response(null,{status:204,headers}):json({error:'許可されていない接続元です。'},403);
  if(request.headers.get('Origin')&&!origin)return json({error:'許可されていない接続元です。'},403);
  const url=new URL(request.url);
  try{
    if(url.pathname==='/api/register'&&request.method==='POST'){
      const body=await request.json(),display=String(body.username||'').trim(),username=normalizedUsername(display),password=String(body.password||'');
      if(!/^[\p{L}\p{N}_.-]{3,32}$/u.test(display))return json({error:'ユーザー名は3〜32文字の文字・数字・_・.・-で入力してください。'},400,headers);
      if(password.length<8||password.length>128)return json({error:'パスワードは8〜128文字で入力してください。'},400,headers);
      const salt=bytesToBase64(crypto.getRandomValues(new Uint8Array(16))),id=crypto.randomUUID(),now=new Date().toISOString();
      try{await env.DB.prepare('INSERT INTO users(id,username,username_display,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').bind(id,username,display,await passwordHash(password,salt),salt,now).run()}
      catch(error){if(String(error).includes('UNIQUE'))return json({error:'そのユーザー名はすでに使われています。'},409,headers);throw error}
      return json({token:await createSession(id,env),username:display},201,headers)
    }
    if(url.pathname==='/api/login'&&request.method==='POST'){
      const body=await request.json(),username=normalizedUsername(body.username),password=String(body.password||'');
      const user=await env.DB.prepare('SELECT id,username_display,password_hash,password_salt FROM users WHERE username=?').bind(username).first();
      if(!user||await passwordHash(password,user.password_salt)!==user.password_hash)return json({error:'ユーザー名またはパスワードが違います。'},401,headers);
      return json({token:await createSession(user.id,env),username:user.username_display},200,headers)
    }
    const user=await authenticate(request,env);
    if(!user)return json({error:'ログインの有効期限が切れました。もう一度ログインしてください。'},401,headers);
    if(url.pathname==='/api/me'&&request.method==='GET')return json({username:user.username_display},200,headers);
    if(url.pathname==='/api/logout'&&request.method==='POST'){
      const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
      return json({ok:true},200,headers)
    }
    if(url.pathname==='/api/data'&&request.method==='GET'){
      const row=await env.DB.prepare('SELECT data_json,updated_at FROM user_data WHERE user_id=?').bind(user.id).first();
      return json({data:row?JSON.parse(row.data_json):null,updatedAt:row?.updated_at||null},200,headers)
    }
    if(url.pathname==='/api/data'&&request.method==='PUT'){
      const body=await request.json(),serialized=JSON.stringify(body.data),now=new Date().toISOString();
      if(!body.data?.state?.files?.length)return json({error:'保存データの形式が正しくありません。'},400,headers);
      if(encoder.encode(serialized).byteLength>8*1024*1024)return json({error:'保存データが大きすぎます。画像を減らしてください。'},413,headers);
      await env.DB.prepare(`INSERT INTO user_data(user_id,data_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at`).bind(user.id,serialized,now).run();
      return json({ok:true,updatedAt:now},200,headers)
    }
    return json({error:'見つかりません。'},404,headers)
  }catch(error){console.error(error);return json({error:'サーバーで問題が発生しました。'},500,headers)}
}};
