// Read-only adapter for TutorFlow (never writes, updates, or deletes TutorFlow data).
const tfCache = { key: "", at: 0, data: null };
const tfTokenCache = new Map();

function tfVal(v) {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(tfVal);
  if ("mapValue" in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = tfVal(val);
    return out;
  }
  return undefined;
}
function tfDoc(doc) {
  const out = { _id: doc.name.split("/").pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) out[k] = tfVal(v);
  return out;
}
async function tfAccessToken(projectId, jsonStr) {
  const acc = JSON.parse(jsonStr);
  if (acc.project_id !== projectId || !acc.client_email || !acc.private_key) throw Error("TutorFlow credential mismatch");
  const cached = tfTokenCache.get(projectId);
  if (cached && cached.key === acc.private_key && cached.expires > Date.now() + 60000) return cached.token;
  const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const enc = s => new TextEncoder().encode(s);
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(enc(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64u(enc(JSON.stringify({ iss: acc.client_email, scope: "https://www.googleapis.com/auth/datastore", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
  const pem = acc.private_key.replace(/-----[^-]+-----|\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc(header + "." + payload));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: header + "." + payload + "." + b64u(sig) }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw Error("TutorFlow OAuth failed");
  const data = await res.json();
  tfTokenCache.set(projectId, { key: acc.private_key, token: data.access_token, expires: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}
function tfTimeMs(dateStr, timeStr) {
  if (!dateStr || !timeStr) return NaN;
  return Date.parse(dateStr + "T" + (timeStr.length === 5 ? timeStr + ":00" : timeStr) + "+07:00");
}
const tfColors = ["mint", "gold", "lilac", "sky", "peach"];
export async function readTutorFlow(now = new Date(), _extraIds = [], env = {}) {
  const projectId = env?.TUTORFLOW_PROJECT_ID;
  const saJson = env?.TUTORFLOW_SERVICE_ACCOUNT_JSON;
  if (!projectId || !saJson) return { source: "unconnected", people: [], sessions: [] };
  const cacheKey = projectId + ":" + saJson.slice(0, 48);
  if (tfCache.key === cacheKey && tfCache.expires > Date.now()) {
    const nowMs = now.getTime();
    return {
      ...tfCache.data,
      sessions: tfCache.data.sessions.map(s => ({ ...s, status: nowMs >= s.end ? "Đã kết thúc" : nowMs >= s.start ? "Đang diễn ra" : "Sắp tới" }))
    };
  }
  try {
    const token = await tfAccessToken(projectId, saJson);
    const base = "https://firestore.googleapis.com/v1/projects/" + encodeURIComponent(projectId) + "/databases/(default)/documents";
    const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    const [stuRes, slotDocs] = await Promise.all([
      fetch(base + ":runQuery", { method: "POST", headers, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "students", allDescendants: true }] } }), signal: AbortSignal.timeout(15000) }),
      (async () => {
        const all = [];
        let pageToken = "";
        do {
          const r = await fetch(base + "/time_slots?pageSize=300" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""), { headers, signal: AbortSignal.timeout(15000) });
          if (!r.ok) throw Error("TutorFlow time_slots read failed (" + r.status + ")");
          const j = await r.json();
          for (const d of j.documents || []) all.push(tfDoc(d));
          pageToken = j.nextPageToken || "";
        } while (pageToken);
        return all;
      })()
    ]);
    if (!stuRes.ok) throw Error("TutorFlow students read failed (" + stuRes.status + ")");
    const stuRows = await stuRes.json();
    const people = [];
    const byId = new Map();
    const byName = new Map();
    for (const row of stuRows) {
      if (!row.document) continue;
      const s = tfDoc(row.document);
      const pid = String(s.id || s._id);
      const name = String(s.name || [s.lastName, s.firstName].filter(Boolean).join(" ") || "Học viên").trim();
      const goal = String(s.goal || s.currentLevel || "").trim();
      const p = { id: pid, name, type: s.role === "group" ? "Nhóm" : "Cá nhân", goal, color: tfColors[people.length % tfColors.length] };
      people.push(p);
      byId.set(pid, p);
      byName.set(name.toLowerCase(), p);
    }
    const nowMs = now.getTime();
    const sessions = [];
    for (const slot of slotDocs) {
      if (slot.status !== "booked" && !slot.studentName && !slot.bookedBy) continue;
      const start = tfTimeMs(slot.date, slot.startTime);
      const end = tfTimeMs(slot.date, slot.endTime) || (start + 90 * 60000);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const matched = (slot.bookedBy && byId.get(String(slot.bookedBy))) || (slot.studentName && byName.get(String(slot.studentName).trim().toLowerCase()));
      let personId = matched?.id;
      if (!personId) {
        const label = String(slot.studentName || slot.bookedBy || "Học viên").trim();
        const fallbackId = "tf-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tf-student";
        if (!byId.has(fallbackId)) {
          const fp = { id: fallbackId, name: label, type: "Cá nhân", goal: "", color: tfColors[people.length % tfColors.length] };
          people.push(fp);
          byId.set(fallbackId, fp);
        }
        personId = fallbackId;
      }
      sessions.push({
        id: "tf-" + String(slot.id || slot._id),
        personId,
        start,
        end,
        status: nowMs >= end ? "Đã kết thúc" : nowMs >= start ? "Đang diễn ra" : "Sắp tới"
      });
    }
    sessions.sort((a, b) => a.start - b.start);
    const out = { source: "tutorflow", people, sessions };
    tfCache.key = cacheKey;
    tfCache.expires = Date.now() + 30000;
    tfCache.data = out;
    return out;
  } catch (err) {
    return { source: "error", people: [], sessions: [], tutorflowError: err?.message || "Không thể đọc dữ liệu TutorFlow." };
  }
}