import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,existsSync,writeFileSync,unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import worker from '../dist/server/index.js';
const base=process.env.ALDEN_PREVIEW_DIR||join(tmpdir(),'alden-path-preview-'+createHash('sha256').update(process.cwd()).digest('hex').slice(0,12));
mkdirSync(base,{recursive:true});const sql=new DatabaseSync(join(base,'preview.sqlite'));
if(!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get())sql.exec(readFileSync('drizzle/0000_workspace.sql','utf8'));
function statement(q,params=[]){const stmt=sql.prepare(q);return{bind:(...values)=>statement(q,values),all:async()=>({results:stmt.all(...params)}),first:async()=>stmt.get(...params),run:async()=>({meta:{changes:Number(stmt.run(...params).changes)}})};}
const env={ALDEN_LOCAL_PREVIEW:"true",DB:{prepare:statement},BUCKET:{put:async(id,b)=>writeFileSync(join(base,id),Buffer.from(b)),get:async id=>existsSync(join(base,id))?{body:readFileSync(join(base,id))}:null,delete:async id=>{if(existsSync(join(base,id)))unlinkSync(join(base,id));}}};
createServer(async(req,res)=>{try{const parts=[];for await(const part of req)parts.push(part);const origin='http://'+req.headers.host;const out=await worker.fetch(new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,body:parts.length?Buffer.concat(parts):undefined}),env);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}}).listen(Number(process.env.PORT||4197),'127.0.0.1',()=>console.log('Alden Path preview: http://127.0.0.1:'+Number(process.env.PORT||4197)));