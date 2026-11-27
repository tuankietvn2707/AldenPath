import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../dist/server/index.js';
test('Teacher workspace, independent snapshots, read-only adapter, reviews, files and AI state',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_workspace.sql','utf8'));
  function prepare(q,args=[]){const stmt=sql.prepare(q);return {bind:(...a)=>prepare(q,a),all:async()=>({results:stmt.all(...args)}),first:async()=>stmt.get(...args),run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}})};}
  const objects=new Map(),env={ALDEN_LOCAL_PREVIEW:"true",DB:{prepare},BUCKET:{put:(id,b)=>objects.set(id,b),get:id=>objects.has(id)?{body:objects.get(id)}:null,delete:id=>objects.delete(id)}};
  const api=(url,method='GET',data)=>worker.fetch(new Request('https://local.example'+url,{method,...(data?{body:data instanceof FormData?data:JSON.stringify(data)}:{})}),env);
  const state=async()=>(await api('/api/workspace')).json();
  const put=(kind,id,data,version=0)=>api('/api/records/'+kind+'/'+id,'PUT',{data,version});
  const initial=await state();assert.equal(initial.records.length,0);assert.equal(initial.people.length,0);assert.equal(initial.sessions.length,0);
  const d={title:'Shopping',activities:[{id:'warm',title:'Warm-up'},{id:'role',title:'Role-play'}]};
  assert.equal((await put('lesson','one',d)).status,200);
  const t={title:'Giao tiếp',steps:[{lesson:d,stage:'Shopping'}]};await put('template','source',t);
  const copy=structuredClone(t);copy.title='Riêng';copy.steps[0].lesson.title='Mua sắm';await put('path','personal',copy);
  const id='session-1';await put('plan',id,d);await put('review',id,{title:'Kết quả',items:[{id:'warm',status:'done'},{id:'role',status:'todo'}]});
  const rows=(await state()).records;assert.equal(rows.find(r=>r.kind==='template').data.steps[0].lesson.title,'Shopping');assert.equal(rows.find(r=>r.kind==='path').data.steps[0].lesson.title,'Mua sắm');assert.equal(rows.find(r=>r.kind==='review').data.items[1].status,'todo');
  assert.equal((await put('lesson','one',{title:'stale'})).status,409);
  for(const k of ['sessions','people','groups'])assert.equal((await put(k,'one',{title:'x'})).status,405);
  assert.equal((await api('/api/ai','POST',{mode:'next'})).status,503);
  const f=new FormData();f.append('file',new File(['hello'],'notes.txt'));const uploaded=await api('/api/uploads','POST',f);assert.equal(uploaded.status,201);const info=await uploaded.json();assert.equal(await (await api('/api/file/'+info.id)).text(),'hello');
  const x=await api('/api/records/resource/'+info.id,'DELETE',{version:1});assert.equal(x.status,200);assert.equal((await api('/api/file/'+info.id)).status,404);
  sql.close();
});