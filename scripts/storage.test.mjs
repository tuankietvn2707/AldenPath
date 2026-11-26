import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../dist/server/index.js";
test("All API routes require owner identity, including backup, files, AI and migration",async()=>{
  for(const [path,method] of [["workspace","GET"],["backup","GET"],["file/example","GET"],["records/lesson/test","PUT"],["uploads","POST"],["ai","POST"],["firebase/migrate","POST"]]){
    const response=await worker.fetch(new Request("https://example.test/api/"+path,{method}),{});
    assert.equal(response.status,403,path);
  }
  const wrong=await worker.fetch(new Request("https://example.test/api/backup",{headers:{"oai-authenticated-user-id":"visitor","oai-authenticated-user-email":"visitor@example.test"}}),{});
  assert.equal(wrong.status,403);
});
test("Firestore REST migration is repeatable, preserves IDs, versions and source records",async()=>{
  const sql=new DatabaseSync(":memory:");
  sql.exec(readFileSync("drizzle/0000_workspace.sql","utf8"));
  const data={title:"Original",activities:[{id:"a1",title:"Role play"}]};
  sql.prepare("INSERT INTO records VALUES(?,?,?,?,?)").run("lesson","stable-id",JSON.stringify(data),3,"2026-11-26T00:00:00Z");
  const prepare=(q,args=[])=>({bind:(...a)=>prepare(q,a),all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args),run:async()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})});
  const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
  const key=Buffer.from(await crypto.subtle.exportKey("pkcs8",pair.privateKey)).toString("base64");
  const env={DB:{prepare},DATA_MIGRATION_LOCK:"true",FIREBASE_ALDEN_PROJECT_ID:"alden-test-123",FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:"alden-test-123",client_email:"server@alden-test-123.iam.gserviceaccount.com",private_key:"-----BEGIN PRIVATE KEY-----\n"+key+"\n-----END PRIVATE KEY-----"})};
  const headers={"oai-authenticated-user-id":"owner","oai-authenticated-user-email":"vntuankiet@icloud.com"};
  const docs=new Map(),oldFetch=globalThis.fetch;
  globalThis.fetch=async(url,options={})=>{
    const p=new URL(url);
    if(p.hostname==="oauth2.googleapis.com")return Response.json({access_token:"test-token",expires_in:3600});
    assert.equal(options.headers.Authorization,"Bearer test-token");
    if(p.pathname.endsWith(":commit")){
      const w=JSON.parse(options.body).writes[0],name=w.update?.name||w.delete,current=docs.get(name);
      if(w.currentDocument.exists===false&&current || w.currentDocument.updateTime && w.currentDocument.updateTime!==current?.updateTime)return Response.json({}, {status:409});
      if(w.delete)docs.delete(name);else docs.set(name,{...w.update,updateTime:new Date().toISOString()});
      return Response.json({});
    }
    const name=p.pathname.replace("/v1/","");
    if(docs.has(name))return Response.json(docs.get(name));
    if(name.endsWith("/aldenRecords"))return Response.json({documents:[...docs.values()]});
    return Response.json({}, {status:404});
  };
  const api=(path,method="GET",body)=>worker.fetch(new Request("https://example.test/api/"+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env);
  try{
    const first=await (await api("firebase/migrate","POST")).json();assert.equal(first.ready,true);assert.equal(first.results[0].status,"copied");
    const second=await (await api("firebase/migrate","POST")).json();assert.equal(second.results[0].status,"identical");assert.equal(docs.size,1);
    assert.equal(sql.prepare("SELECT version FROM records").get().version,3);
    assert.equal((await api("records/lesson/new","PUT",{version:0,data:{title:"blocked"}})).status,423);
    env.DATA_BACKEND="firestore";env.DATA_MIGRATION_LOCK="false";
    const workspace=await (await api("workspace")).json();assert.equal(workspace.records[0].id,"stable-id");assert.equal(workspace.records[0].version,3);
    assert.equal((await api("records/lesson/stable-id","PUT",{version:2,data:{title:"stale"}})).status,409);
    assert.equal((await api("records/lesson/stable-id","PUT",{version:3,data:{title:"Updated"}})).status,200);
    const backup=await (await api("backup")).json();assert.equal(backup.records[0].data.title,"Updated");assert.equal(backup.records[0].version,4);
    assert.equal((await api("records/lesson/stable-id","DELETE",{version:4})).status,200);assert.equal(docs.size,0);
    env.FIREBASE_ALDEN_PROJECT_ID="another-project";assert.equal((await api("workspace")).status,503);
  }finally{globalThis.fetch=oldFetch;sql.close();}
});