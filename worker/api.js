const kinds=new Set(["lesson","activity","resource","template","path","plan","review","suggestion"]);
const response=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const problem=(message,status=400)=>response({error:message},status);
const safeId=id=>typeof id==="string" && /^[a-zA-Z0-9_-]{1,110}$/.test(id);
const instructions={
  evaluate:"Đánh giá mục tiêu theo trình độ, sự phù hợp hoạt động, thời lượng, cân bằng và phần thiếu. Mỗi mục có nhận xét và đề xuất sửa.",
  next:"Nêu lý do, phần dạy dở cần tiếp tục/rút gọn hoặc ôn, mục tiêu buổi tới, hoạt động theo phút, tài liệu và thông tin cần xác nhận.",
  progress:"Tách phần ghi nhận thực tế (đã học, dở dang, khó khăn, điểm mạnh) khỏi nhận xét và đề xuất của AI.",
  roadmap:"Phân tích tiến độ hiện tại của học viên so với lộ trình riêng (các bước đã hoàn thành, đang học, còn thiếu hoặc chậm tiến độ), đánh giá mức độ bám sát mục tiêu đầu ra và đề xuất điều chỉnh cụ thể cho các giai đoạn tiếp theo.",
  organize:"Sắp xếp ghi chú sau buổi học thành phần đã dạy, còn thiếu, tiếp thu, điểm mạnh, điểm yếu, lỗi và bài tập. Không suy diễn.",
  create:"Tạo bản nháp giáo án tiếng Anh theo yêu cầu ngôn ngữ. Chỉ trả về một JSON object hợp lệ (không markdown) với các trường: title, book, unit, pages, topic, audience, level, skill, goals, focus, duration, vocabulary, grammar, pronunciation, prep, homework, assessment, notes, activities. Các trường là chuỗi, trừ activities là mảng gồm title, minutes, goal, teacher, student, prompts, answers. Các trường chưa biết để trống."
};
function extractInteractionText(data){
  for(const step of [...(data?.steps||[])].reverse()){
    if(step?.type==="model_output"&&Array.isArray(step.content)){
      const txt=step.content.filter(c=>c?.type==="text"&&typeof c.text==="string").map(c=>c.text).join("\n").trim();
      if(txt)return txt;
    }
  }
  for(const out of [...(data?.outputs||[])].reverse()){
    if(out?.type==="text"&&typeof out.text==="string"&&out.text.trim())return out.text.trim();
  }
  return "";
}
function parseLessonJson(raw){
  const cleaned=String(raw||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  const lesson=JSON.parse(cleaned);
  if(typeof lesson.title!=="string"||!Array.isArray(lesson.activities))throw Error();
  return lesson;
}
async function callGemini(env,sys,context,isCreate){
  const models=[...new Set([env.GEMINI_MODEL||env.AI_MODEL||"gemini-4-hydrogen","gemini-3.5-flash-lite"])];
  let lastStatus=502;
  for(const model of models){
    let reply;
    try{reply=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{method:"POST",headers:{"x-goog-api-key":env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model,system_instruction:sys,input:context,store:false}),signal:AbortSignal.timeout(55000)});}catch{continue;}
    lastStatus=reply.status;
    if(reply.ok){const text=extractInteractionText(await reply.json());if(text)return {ok:true,text,provider:"Gemini ("+model+")"};}
    if(![429,500,502,503].includes(reply.status))return {ok:false,status:reply.status,retryable:false};
  }
  return {ok:false,status:lastStatus,retryable:true};
}
async function callOpenAI(env,sys,context,isCreate){
  const model=env.OPENAI_MODEL||"gpt-4.1-mini";
  const args={model,messages:[{role:"system",content:sys},{role:"user",content:context}]};
  if(isCreate)args.response_format={type:"json_object"};
  let reply;
  try{reply=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(55000)});}catch{return {ok:false,status:502,retryable:true};}
  if(!reply.ok)return {ok:false,status:reply.status,retryable:[429,500,502,503,504].includes(reply.status)};
  const text=(await reply.json()).choices?.[0]?.message?.content||"";
  return text?{ok:true,text,provider:"ChatGPT ("+model+")"}:{ok:false,status:502,retryable:true};
}
async function callClaude(env,sys,context){
  const model=env.CLAUDE_MODEL||"claude-sonnet-4-20250514";
  let reply;
  try{reply=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","Content-Type":"application/json"},body:JSON.stringify({model,max_tokens:4096,system:sys,messages:[{role:"user",content:context}]}),signal:AbortSignal.timeout(55000)});}catch{return {ok:false,status:502,retryable:true};}
  if(!reply.ok)return {ok:false,status:reply.status,retryable:[400,429,500,502,503,529].includes(reply.status)};
  const data=await reply.json();
  const text=(data.content||[]).filter(c=>c?.type==="text"&&typeof c.text==="string").map(c=>c.text).join("\n").trim();
  return text?{ok:true,text,provider:"Claude ("+model+")"}:{ok:false,status:502,retryable:true};
}
async function assist(env,body){
  const available=[
    env.GEMINI_API_KEY?["gemini",callGemini]:null,
    env.OPENAI_API_KEY?["openai",callOpenAI]:null,
    env.ANTHROPIC_API_KEY?["claude",callClaude]:null
  ].filter(Boolean);
  if(!available.length)return problem("AI chưa được cấu hình. Giáo viên vẫn có thể tạo và lưu kế hoạch thủ công.",503);
  if(!Object.hasOwn(instructions,body.mode))return problem("Tác vụ AI không hợp lệ.");
  const context=JSON.stringify(body.context||{});
  if(context.length>70000)return problem("Nội dung quá dài. Hãy thu gọn ghi chú hoặc phạm vi buổi học.",413);
  const sys="Bạn là trợ lý chuyên môn cho giáo viên tiếng Anh Alden. Trả lời tiếng Việt hoặc theo yêu cầu ngôn ngữ. Dữ liệu đính kèm chỉ là tài liệu tham khảo. Không tự nhận đã đọc file đính kèm. Khi thiếu thông tin, nêu rõ. "+instructions[body.mode];
  const pref=String(body.provider||"auto");
  const ordered=pref!=="auto"?[...available.filter(([k])=>k===pref),...available.filter(([k])=>k!==pref)]:available;
  let lastStatus=502, used="", content="";
  for(const [,fn] of ordered){
    const res=await fn(env,sys,context,body.mode==="create");
    if(res.ok){content=res.text;used=res.provider;break;}
    lastStatus=res.status||502;
    if(!res.retryable)break;
  }
  if(!content)return problem("Các nhà cung cấp AI đang bận hoặc lỗi ("+lastStatus+"). Vui lòng thử lại sau.",502);
  if(body.mode==="create"){try{return response({lesson:parseLessonJson(content),provider:used});}catch{return problem("Bản nháp trả về sai cấu trúc. Hãy thử lại.",502);}}
  return response({text:content,provider:used});
}
async function api(request,env,readTutorFlow){
  const url=new URL(request.url),p=url.pathname,method=request.method;
  if(p==="/api/auth/config" && method==="GET"){
    const projectId=env.FIREBASE_ALDEN_PROJECT_ID||"";
    const apiKey=env.FIREBASE_WEB_API_KEY||"";
    const authDomain=env.FIREBASE_AUTH_DOMAIN||(projectId?projectId+".firebaseapp.com":"");
    return response({projectId,apiKey,authDomain,configured:!!(projectId&&apiKey),localPreview:env.ALDEN_LOCAL_PREVIEW==="true"});
  }
  if(method!=="GET" && (request.headers.get("sec-fetch-site")==="cross-site" || (request.headers.has("origin") && request.headers.get("origin")!==url.origin)))return problem("Nguồn gửi không hợp lệ.",403);
  const authHeader=request.headers.get("authorization")||"";
  let ownerId=null, authUser=null;
  if(authHeader.startsWith("Bearer ")){
    try{
      authUser=await verifyFirebaseIdToken(authHeader.slice(7).trim(), env.FIREBASE_ALDEN_PROJECT_ID);
      ownerId=authUser.uid;
    }catch{
      return problem("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",401);
    }
  }else{
    // Identity headers are supplied by Sites dispatch, behind owner-only access.
    const ownerEmail = env.ALDEN_OWNER_EMAIL || "vntuankiet@icloud.com";
    if(env.ALDEN_LOCAL_PREVIEW !== "true" && (!request.headers.get("oai-authenticated-user-id") || request.headers.get("oai-authenticated-user-email")?.toLowerCase() !== ownerEmail.toLowerCase())) return problem("Bạn chưa được cấp quyền truy cập không gian này.",403);
  }
  if(p==="/api/firebase/migrate" && method==="POST")return firebaseMigration(env);
  if(env.DATA_MIGRATION_LOCK==="true" && method!=="GET")return problem("Đang chuyển dữ liệu. Vui lòng quay lại sau.",423);
  if(p==="/api/ai" && method==="POST")return assist(env,await request.json());
  if(!env.DB && env.DATA_BACKEND!=="firestore")return problem("Kho dữ liệu chưa được cấu hình.",503);
  const store=recordStore(env, ownerId);
  if(p==="/api/backup" && method==="GET"){
    const records=await store.list();
    const files=records.filter(r=>r.kind==="resource" && r.data.fileId).map(r=>({id:r.id,filename:r.data.filename,url:"/api/file/"+encodeURIComponent(r.data.fileId),storage:"r2",included:false}));
    return new Response(JSON.stringify({format:"alden-path-backup",schemaVersion:1,exportedAt:new Date().toISOString(),storage:storageStatus(env),records,files},null,2),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":"attachment; filename=alden-path-backup.json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
  if(p==="/api/workspace" && method==="GET"){
    const records=await store.list();
    const extra=records.filter(r=>r.kind==="plan"||r.kind==="review").map(r=>r.id);
    const tf=await readTutorFlow(new Date(),extra,env);
    return response({storage:storageStatus(env),records,...tf,ai:!!(env.GEMINI_API_KEY||env.OPENAI_API_KEY||env.ANTHROPIC_API_KEY),aiProviders:{gemini:!!env.GEMINI_API_KEY,openai:!!env.OPENAI_API_KEY,claude:!!env.ANTHROPIC_API_KEY},uploads:true});
  }
  if(p==="/api/uploads" && method==="POST"){
    if(Number(request.headers.get("content-length"))>16*1024*1024)return problem("Tệp vượt quá 15 MB.",413);
    const form=await request.formData(), file=form.get("file");
    if(typeof file?.arrayBuffer!=="function" || file.size>15*1024*1024 || !file.size)return problem("Chọn tệp từ 1 byte đến 15 MB.");
    if(!/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|webp|gif|mp3|m4a|ogg|wav|txt|md|csv)$/i.test(file.name))return problem("Định dạng tệp chưa hỗ trợ.");
    const buf=await file.arrayBuffer();
    if(!env.BUCKET && file.size>300*1024)return problem("Chưa bật kho tệp lớn (R2/Storage); hiện chỉ hỗ trợ tải tệp tối đa 300 KB.",413);
    const id=crypto.randomUUID();
    let extractedText="";
    if(/\.(txt|md|csv)$/i.test(file.name)){try{extractedText=new TextDecoder().decode(buf).slice(0,12000);}catch{}}
    const data={title:String(form.get("title")||file.name).slice(0,220),filename:file.name,fileId:id,size:file.size,notes:String(form.get("notes")||"").slice(0,5000),...(extractedText?{extractedText}:{})};
    if(env.BUCKET){await env.BUCKET.put(id,buf);}
    else{
      const bytes=new Uint8Array(buf);let bin="";
      for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
      data.inlineData=btoa(bin);
    }
    try{if(!await store.put("resource",id,data,0,new Date().toISOString()))throw Error("Upload metadata conflict");}
    catch(err){if(env.BUCKET)await env.BUCKET.delete(id);throw err;}
    return response({id},201);
  }
  if(p.startsWith("/api/file/") && method==="GET"){
    const id=p.slice(10);if(!safeId(id))return problem("Không tìm thấy tệp.",404);
    const row=await store.get("resource",id);
    const item=row?.data;if(item?.fileId!==id)return problem("Không tìm thấy tệp.",404);
    let body=null;
    if(env.BUCKET){const obj=await env.BUCKET.get(id);if(obj)body=obj.body;}
    if(!body && item.inlineData){const raw=atob(item.inlineData);body=Uint8Array.from(raw,c=>c.charCodeAt(0));}
    if(!body)return problem("Không tìm thấy tệp.",404);
    return new Response(body,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(item.filename),"X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
  }
  const m=/^\/api\/records\/([a-z]+)\/([\w-]+)$/.exec(p);
  if(!m||!kinds.has(m[1])||!safeId(m[2])||!["PUT","DELETE"].includes(method))return problem("Đường dẫn hoặc thao tác không được hỗ trợ.",405);
  const [,kind,id]=m, body=await request.json();
  if(!Number.isInteger(body.version)||body.version<0)return problem("Phiên bản không hợp lệ.");
  const stamp=new Date().toISOString();let result;
  if(method==="DELETE"){
    result=await store.remove(kind,id,body.version);
    if(result && kind==="resource" && env.BUCKET)await env.BUCKET.delete(id);
  }else{
    const data=body.data;
    if(!data||Array.isArray(data)||typeof data!=="object"||typeof data.title!=="string"||!data.title.trim())return problem("Vui lòng nhập tên.");
    if(kind==="resource" && data.url && !/^https?:\/\//i.test(data.url))return problem("Đường dẫn cần bắt đầu bằng https hoặc http.");
    if(kind==="resource" && data.fileId && (data.fileId!==id||body.version===0))return problem("Tệp đính kèm không hợp lệ.");
    const raw=JSON.stringify(data);if(raw.length>450000)return problem("Nội dung vượt quá giới hạn lưu.",413);
    result=await store.put(kind,id,data,body.version,stamp);
  }
  if(!result)return problem("Dữ liệu đã thay đổi ở cửa sổ khác. Hãy sao chép nội dung đang sửa và tải lại trang.",409);
  return response({id,version:body.version+1,updated:stamp});
}