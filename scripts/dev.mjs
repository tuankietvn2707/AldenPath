import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,existsSync,writeFileSync,unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import worker from '../dist/server/index.js';
const base=process.env.ALDEN_PREVIEW_DIR||join(process.cwd(),'.alden-data');
mkdirSync(base,{recursive:true});const sql=new DatabaseSync(join(base,'preview.sqlite'));
if(!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get())sql.exec(readFileSync('drizzle/0000_workspace.sql','utf8'));
if(!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_records'").get())sql.exec("CREATE TABLE IF NOT EXISTS user_records (owner_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL, PRIMARY KEY (owner_id, kind, id));");
function loadDotEnv(){
  const out={};
  if(!existsSync('.env'))return out;
  for(const rawLine of readFileSync('.env','utf8').split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line||line.startsWith('#'))continue;
    const eq=line.indexOf('=');
    if(eq<=0)continue;
    const k=line.slice(0,eq).trim();
    let v=line.slice(eq+1).trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
    out[k]=v;
  }
  return out;
}
const fileEnv=loadDotEnv();
const cfg=k=>process.env[k]??fileEnv[k]??"";
let serviceAccountJson=cfg('FIREBASE_SERVICE_ACCOUNT_JSON');
if(!serviceAccountJson&&cfg('FIREBASE_SERVICE_ACCOUNT_PATH')&&existsSync(cfg('FIREBASE_SERVICE_ACCOUNT_PATH'))){
  serviceAccountJson=readFileSync(cfg('FIREBASE_SERVICE_ACCOUNT_PATH'),'utf8').trim();
}
function statement(q,params=[]){const stmt=sql.prepare(q);return{bind:(...values)=>statement(q,values),all:async()=>({results:stmt.all(...params)}),first:async()=>stmt.get(...params),run:async()=>({meta:{changes:Number(stmt.run(...params).changes)}})};}
const env={
  ALDEN_LOCAL_PREVIEW:"true",
  DATA_BACKEND:cfg('DATA_BACKEND')||"d1",
  DATA_MIGRATION_LOCK:cfg('DATA_MIGRATION_LOCK')||"false",
  FIREBASE_ALDEN_PROJECT_ID:cfg('FIREBASE_ALDEN_PROJECT_ID'),
  FIREBASE_ALDEN_DATABASE_ID:cfg('FIREBASE_ALDEN_DATABASE_ID')||"(default)",
  FIREBASE_WEB_API_KEY:cfg('FIREBASE_WEB_API_KEY'),
  FIREBASE_AUTH_DOMAIN:cfg('FIREBASE_AUTH_DOMAIN'),
  FIREBASE_SERVICE_ACCOUNT_JSON:serviceAccountJson,
  TUTORFLOW_PROJECT_ID:cfg('TUTORFLOW_PROJECT_ID'),
  TUTORFLOW_SERVICE_ACCOUNT_JSON:cfg('TUTORFLOW_SERVICE_ACCOUNT_JSON'),
  ALDEN_OWNER_EMAIL:cfg('ALDEN_OWNER_EMAIL'),
  GEMINI_API_KEY:cfg('GEMINI_API_KEY'),
  OPENAI_API_KEY:cfg('OPENAI_API_KEY'),
  ANTHROPIC_API_KEY:cfg('ANTHROPIC_API_KEY'),
  GEMINI_MODEL:cfg('GEMINI_MODEL'),
  OPENAI_MODEL:cfg('OPENAI_MODEL'),
  CLAUDE_MODEL:cfg('CLAUDE_MODEL'),
  AI_MODEL:cfg('AI_MODEL'),
  DB:{prepare:statement},
  BUCKET:{put:async(id,b)=>writeFileSync(join(base,id),Buffer.from(b)),get:async id=>existsSync(join(base,id))?{body:readFileSync(join(base,id))}:null,delete:async id=>{if(existsSync(join(base,id)))unlinkSync(join(base,id));}}
};
createServer(async(req,res)=>{try{const parts=[];for await(const part of req)parts.push(part);const origin='http://'+req.headers.host;const out=await worker.fetch(new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,body:parts.length?Buffer.concat(parts):undefined}),env);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}}).listen(Number(process.env.PORT||4197),'127.0.0.1',()=>console.log('Alden Path preview: http://127.0.0.1:'+Number(process.env.PORT||4197)+' (storage: '+env.DATA_BACKEND+(env.FIREBASE_ALDEN_PROJECT_ID?' / '+env.FIREBASE_ALDEN_PROJECT_ID:'')+')'));