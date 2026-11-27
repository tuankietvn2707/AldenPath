// Records are isolated per authenticated user (ownerId) when signed in.
function d1Records(env, ownerId = null) {
  if (ownerId) {
    return {
      async list() {
        const { results } = await env.DB.prepare("SELECT kind,id,data,version,updated FROM user_records WHERE owner_id=? ORDER BY updated DESC").bind(ownerId).all();
        return results.map(row => ({ ...row, data: JSON.parse(row.data) }));
      },
      async get(kind, id) {
        const row = await env.DB.prepare("SELECT kind,id,data,version,updated FROM user_records WHERE owner_id=? AND kind=? AND id=?").bind(ownerId, kind, id).first();
        return row ? { ...row, data: JSON.parse(row.data) } : null;
      },
      async put(kind, id, data, version, updated) {
        const raw = JSON.stringify(data);
        const result = version === 0
          ? await env.DB.prepare("INSERT INTO user_records(owner_id,kind,id,data,version,updated) VALUES(?,?,?,?,1,?) ON CONFLICT DO NOTHING").bind(ownerId,kind,id,raw,updated).run()
          : await env.DB.prepare("UPDATE user_records SET data=?, version=version+1, updated=? WHERE owner_id=? AND kind=? AND id=? AND version=?").bind(raw,updated,ownerId,kind,id,version).run();
        return !!result.meta.changes;
      },
      async remove(kind,id,version) {
        const result = await env.DB.prepare("DELETE FROM user_records WHERE owner_id=? AND kind=? AND id=? AND version=?").bind(ownerId,kind,id,version).run();
        return !!result.meta.changes;
      }
    };
  }
  return {
    async list() {
      const { results } = await env.DB.prepare("SELECT kind,id,data,version,updated FROM records ORDER BY updated DESC").all();
      return results.map(row => ({ ...row, data: JSON.parse(row.data) }));
    },
    async get(kind, id) {
      const row = await env.DB.prepare("SELECT kind,id,data,version,updated FROM records WHERE kind=? AND id=?").bind(kind, id).first();
      return row ? { ...row, data: JSON.parse(row.data) } : null;
    },
    async put(kind, id, data, version, updated) {
      const raw = JSON.stringify(data);
      const result = version === 0
        ? await env.DB.prepare("INSERT INTO records(kind,id,data,version,updated) VALUES(?,?,?,1,?) ON CONFLICT DO NOTHING").bind(kind,id,raw,updated).run()
        : await env.DB.prepare("UPDATE records SET data=?, version=version+1, updated=? WHERE kind=? AND id=? AND version=?").bind(raw,updated,kind,id,version).run();
      return !!result.meta.changes;
    },
    async remove(kind,id,version) {
      const result = await env.DB.prepare("DELETE FROM records WHERE kind=? AND id=? AND version=?").bind(kind,id,version).run();
      return !!result.meta.changes;
    }
  };
}
const tokenCache = new Map();
function firebaseConfig(env) {
  const id = env.FIREBASE_ALDEN_PROJECT_ID;
  if (!id || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id)) throw Error("Firebase project is not configured");
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  if (account.project_id !== id || !account.client_email?.endsWith("@"+id+".iam.gserviceaccount.com") || !account.private_key) throw Error("Firebase project and credential do not match");
  return { id, account };
}
const base64url = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
async function firebaseToken(env) {
  const {id,account} = firebaseConfig(env);
  const cached = tokenCache.get(id);
  if(cached?.key === account.private_key && cached.expires > Date.now()+60000) return cached.token;
  const bytes = text => new TextEncoder().encode(text);
  const now = Math.floor(Date.now()/1000);
  const header = base64url(bytes(JSON.stringify({alg:"RS256",typ:"JWT"})));
  const payload = base64url(bytes(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/datastore",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g,"");
  const key = await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,bytes(header+"."+payload));
  const res = await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:header+"."+payload+"."+base64url(signature)}),signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error("Firebase authorization failed");
  const data = await res.json();
  tokenCache.set(id,{key:account.private_key,token:data.access_token,expires:Date.now()+data.expires_in*1000});
  return data.access_token;
}
function firestoreRecords(env, ownerId = null) {
  const {id} = firebaseConfig(env);
  const dbId = env.FIREBASE_ALDEN_DATABASE_ID || "(default)";
  const base = "https://firestore.googleapis.com/v1/projects/"+id+"/databases/"+encodeURIComponent(dbId)+"/documents";
  const col = ownerId ? "users/"+encodeURIComponent(ownerId)+"/records" : "aldenRecords";
  const key = (kind,id) => kind+"__"+id;
  const name = (kind,id) => "projects/"+env.FIREBASE_ALDEN_PROJECT_ID+"/databases/"+dbId+"/documents/"+col+"/"+key(kind,id);
  async function call(path,options={}) {
    const token = await firebaseToken(env);
    const res = await fetch(base+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},signal:AbortSignal.timeout(20000)});
    if(res.status===404)return null;
    if([409,412].includes(res.status))return {conflict:true};
    if(!res.ok)throw Error("Firestore operation failed ("+res.status+")");
    return res.json();
  }
  function decode(doc) {
    const f=doc.fields;
    return {kind:f.kind.stringValue,id:f.id.stringValue,data:JSON.parse(f.data.stringValue),version:Number(f.version.integerValue),updated:f.updated.stringValue,updateTime:doc.updateTime};
  }
  async function get(kind,id) {
    const doc=await call("/"+col+"/"+key(kind,id));
    return doc?decode(doc):null;
  }
  async function commit(write) {
    const out=await call(":commit",{method:"POST",body:JSON.stringify({writes:[write]})});
    return !!out && !out.conflict;
  }
  return {
    async list() {
      const records=[];let pageToken="";
      do {
        const out=await call("/"+col+"?pageSize=300"+(pageToken?"&pageToken="+encodeURIComponent(pageToken):""));
        for(const doc of out?.documents||[])records.push(decode(doc));
        pageToken=out?.nextPageToken||"";
      }while(pageToken);
      return records.sort((a,b)=>b.updated.localeCompare(a.updated));
    },
    get,
    async put(kind,id,data,version,updated) {
      const current=await get(kind,id);
      if((current?.version||0)!==version)return false;
      return commit({update:{name:name(kind,id),fields:{kind:{stringValue:kind},id:{stringValue:id},data:{stringValue:JSON.stringify(data)},version:{integerValue:String(version+1)},updated:{stringValue:updated}}},currentDocument:current?{updateTime:current.updateTime}:{exists:false}});
    },
    async remove(kind,id,version) {
      const current=await get(kind,id);
      if(!current || current.version!==version)return false;
      return commit({delete:name(kind,id),currentDocument:{updateTime:current.updateTime}});
    },
    async importRecord(row) {
      const current=await get(row.kind,row.id);
      if(current)return {status:JSON.stringify(current.data)===JSON.stringify(row.data)&&current.version===row.version?"identical":"conflict",id:row.id,kind:row.kind};
      const fields={kind:{stringValue:row.kind},id:{stringValue:row.id},data:{stringValue:JSON.stringify(row.data)},version:{integerValue:String(row.version)},updated:{stringValue:row.updated}};
      const ok=await commit({update:{name:name(row.kind,row.id),fields},currentDocument:{exists:false}});
      return {status:ok?"copied":"retry",id:row.id,kind:row.kind};
    }
  };
}
function recordStore(env, ownerId = null) {
  if(env.DATA_BACKEND && !["d1","firestore"].includes(env.DATA_BACKEND))throw Error("Unknown data backend");
  return env.DATA_BACKEND==="firestore"?firestoreRecords(env, ownerId):d1Records(env, ownerId);
}
const certCache = { certs: null, expires: 0 };
function readTlv(buf, pos) {
  const tag = buf[pos++];
  let len = buf[pos++];
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | buf[pos++]; }
  return { tag, content: pos, next: pos + len };
}
function extractSpkiFromPem(pem) {
  const raw = atob(pem.replace(/-----[^-]+-----|\s/g, ""));
  const der = Uint8Array.from(raw, c => c.charCodeAt(0));
  const cert = readTlv(der, 0);
  const tbs = readTlv(der, cert.content);
  let cur = tbs.content;
  if (der[cur] === 0xa0) cur = readTlv(der, cur).next;
  for (let i = 0; i < 5; i++) cur = readTlv(der, cur).next;
  const spkiEnd = readTlv(der, cur).next;
  return der.slice(cur, spkiEnd);
}
async function getFirebasePublicCerts() {
  if (certCache.certs && certCache.expires > Date.now()) return certCache.certs;
  const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com", { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw Error("Cannot load Firebase Auth certificates");
  const cc = res.headers.get("cache-control") || "";
  const m = /max-age=(\d+)/i.exec(cc);
  certCache.certs = await res.json();
  certCache.expires = Date.now() + (m ? Number(m[1]) * 1000 : 3600000);
  return certCache.certs;
}
async function verifyFirebaseIdToken(token, projectId) {
  if (!projectId) throw Error("Firebase project is not configured");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw Error("Invalid token");
  const b64d = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
  const dec = s => JSON.parse(new TextDecoder().decode(b64d(s)));
  const header = dec(parts[0]), payload = dec(parts[1]), now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid) throw Error("Unsupported token algorithm");
  if (payload.aud !== projectId || payload.iss !== "https://securetoken.google.com/" + projectId) throw Error("Token project mismatch");
  if (!payload.sub || !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.sub) || payload.exp <= now || payload.iat > now + 300) throw Error("Token expired or invalid");
  const certs = await getFirebasePublicCerts();
  const pem = certs[header.kid];
  if (!pem) throw Error("Unknown signing key");
  const key = await crypto.subtle.importKey("spki", extractSpkiFromPem(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64d(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw Error("Invalid token signature");
  return { uid: payload.sub, email: payload.email || "", name: payload.name || "", picture: payload.picture || "" };
}
function storageStatus(env) {
  return {backend:env.DATA_BACKEND==="firestore"?"firestore":"d1",firebaseConfigured:!!env.FIREBASE_ALDEN_PROJECT_ID&&!!env.FIREBASE_SERVICE_ACCOUNT_JSON,projectId:env.FIREBASE_ALDEN_PROJECT_ID||null,files:"r2",migrationLocked:env.DATA_MIGRATION_LOCK==="true"};
}
async function firebaseMigration(env) {
  // Requires writes to have been frozen in an earlier deployment and all in-flight
  // requests drained. The legacy DB remains unchanged for recovery.
  if(env.DATA_MIGRATION_LOCK!=="true" || env.DATA_BACKEND==="firestore")return problem("Cần khóa ghi và giữ nguồn D1 trước khi chuyển.",409);
  const source=await d1Records(env).list(),target=firestoreRecords(env),results=[];
  for(const row of source)results.push(await target.importRecord(row));
  const verified=[];
  for(const row of source) {
    const dest=await target.get(row.kind,row.id);
    verified.push({kind:row.kind,id:row.id,ok:!!dest&&dest.version===row.version&&JSON.stringify(dest.data)===JSON.stringify(row.data)});
  }
  return response({results,verified,ready:verified.every(r=>r.ok),filesTransferred:false,sourceRetained:true});
}
