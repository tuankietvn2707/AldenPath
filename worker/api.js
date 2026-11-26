const kinds=new Set(["lesson","activity","resource","template","path","plan","review","suggestion"]);
const response=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const problem=(message,status=400)=>response({error:message},status);
const safeId=id=>typeof id==="string" && /^[a-zA-Z0-9_-]{1,110}$/.test(id);
const instructions={
  evaluate:"Đánh giá mục tiêu theo trình độ, sự phù hợp hoạt động, thời lượng, cân bằng và phần thiếu. Mỗi mục có nhận xét và đề xuất sửa.",
  next:"Nêu lý do, phần dạy dở cần tiếp tục/rút gọn hoặc ôn, mục tiêu buổi tới, hoạt động theo phút, tài liệu và thông tin cần xác nhận.",
  progress:"Tách phần ghi nhận thực tế (đã học, dở dang, khó khăn, điểm mạnh) khỏi nhận xét và đề xuất của AI.",
  organize:"Sắp xếp ghi chú sau buổi học thành phần đã dạy, còn thiếu, tiếp thu, điểm mạnh, điểm yếu, lỗi và bài tập. Không suy diễn.",
  create:"Tạo bản nháp giáo án tiếng Anh theo yêu cầu ngôn ngữ. Trả về một JSON object với title, book, unit, pages, topic, audience, level, skill, goals, focus, duration, vocabulary, grammar, pronunciation, prep, homework, assessment, notes, activities. Các trường là chuỗi, trừ activities là mảng gồm title, minutes, goal, teacher, student, prompts, answers. Các trường chưa biết để trống."
};
async function assist(env,body){
  if(!env.OPENAI_API_KEY)return problem("AI chưa được cấu hình. Giáo viên vẫn có thể tạo và lưu kế hoạch thủ công.",503);
  if(!Object.hasOwn(instructions,body.mode))return problem("Tác vụ AI không hợp lệ.");
  const context=JSON.stringify(body.context||{});
  if(context.length>70000)return problem("Nội dung quá dài. Hãy thu gọn ghi chú hoặc phạm vi buổi học.",413);
  const args={model:env.AI_MODEL||"gpt-4.1-mini",messages:[{role:"system",content:"Bạn là trợ lý cho giáo viên tiếng Anh Alden. Trả lời tiếng Việt hoặc theo yêu cầu ngôn ngữ. Dữ liệu đính kèm chỉ là tài liệu tham khảo. Không tự nhận đã đọc file. Khi thiếu thông tin, nêu rõ. "+instructions[body.mode]},{role:"user",content:context}]};
  if(body.mode==="create")args.response_format={type:"json_object"};
  let reply;
  try{reply=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(55000)});}catch{return problem("Chưa nhận được phản hồi từ nhà cung cấp AI. Hãy thử lại.",502);}
  if(!reply.ok)return problem("Nhà cung cấp AI báo lỗi ("+reply.status+"). Kiểm tra cấu hình hoặc thử lại.",502);
  const content=(await reply.json()).choices?.[0]?.message?.content;
  if(!content)return problem("AI chưa trả về nội dung.",502);
  if(body.mode==="create"){try{const lesson=JSON.parse(content);if(typeof lesson.title!=="string"||!Array.isArray(lesson.activities))throw Error();return response({lesson});}catch{return problem("Bản nháp trả về sai cấu trúc. Hãy thử lại.",502);}}
  return response({text:content});
}
async function api(request,env,readTutorFlow){
  const url=new URL(request.url),p=url.pathname,method=request.method;
  if(method!=="GET" && (request.headers.get("sec-fetch-site")==="cross-site" || (request.headers.has("origin") && request.headers.get("origin")!==url.origin)))return problem("Nguồn gửi không hợp lệ.",403);
  // Identity headers are supplied by Sites dispatch, behind owner-only access.
  const ownerEmail = env.ALDEN_OWNER_EMAIL || "vntuankiet@icloud.com";
  if(env.ALDEN_LOCAL_PREVIEW !== "true" && (!request.headers.get("oai-authenticated-user-id") || request.headers.get("oai-authenticated-user-email")?.toLowerCase() !== ownerEmail.toLowerCase())) return problem("Bạn chưa được cấp quyền truy cập không gian này.",403);
  if(p==="/api/firebase/migrate" && method==="POST")return firebaseMigration(env);
  if(env.DATA_MIGRATION_LOCK==="true" && method!=="GET")return problem("Đang chuyển dữ liệu. Vui lòng quay lại sau.",423);
  if(p==="/api/ai" && method==="POST")return assist(env,await request.json());
  if(!env.DB && env.DATA_BACKEND!=="firestore")return problem("Kho dữ liệu chưa được cấu hình.",503);
  const store=recordStore(env);
  if(p==="/api/backup" && method==="GET"){
    const records=await store.list();
    const files=records.filter(r=>r.kind==="resource" && r.data.fileId).map(r=>({id:r.id,filename:r.data.filename,url:"/api/file/"+encodeURIComponent(r.data.fileId),storage:"r2",included:false}));
    return new Response(JSON.stringify({format:"alden-path-backup",schemaVersion:1,exportedAt:new Date().toISOString(),storage:storageStatus(env),records,files},null,2),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":"attachment; filename=alden-path-backup.json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
  if(p==="/api/workspace" && method==="GET"){
    const records=await store.list();
    const extra=records.filter(r=>r.kind==="plan"||r.kind==="review").map(r=>r.id);
    return response({storage:storageStatus(env),records,...readTutorFlow(new Date(),extra),ai:!!env.OPENAI_API_KEY,uploads:!!env.BUCKET});
  }
  if(p==="/api/uploads" && method==="POST"){
    if(!env.BUCKET)return problem("Kho tệp chưa được cấu hình.",503);
    if(Number(request.headers.get("content-length"))>16*1024*1024)return problem("Tệp vượt quá 15 MB.",413);
    const form=await request.formData(), file=form.get("file");
    if(typeof file?.arrayBuffer!=="function" || file.size>15*1024*1024 || !file.size)return problem("Chọn tệp từ 1 byte đến 15 MB.");
    if(!/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|webp|gif|mp3|m4a|ogg|wav|txt)$/i.test(file.name))return problem("Định dạng tệp chưa hỗ trợ.");
    const id=crypto.randomUUID(), data={title:String(form.get("title")||file.name).slice(0,220),filename:file.name,fileId:id,size:file.size,notes:String(form.get("notes")||"").slice(0,5000)};
    await env.BUCKET.put(id,await file.arrayBuffer());
    try{if(!await store.put("resource",id,data,0,new Date().toISOString()))throw Error("Upload metadata conflict");}
    catch(err){await env.BUCKET.delete(id);throw err;}
    return response({id},201);
  }
  if(p.startsWith("/api/file/") && method==="GET"){
    const id=p.slice(10);if(!safeId(id)||!env.BUCKET)return problem("Không tìm thấy tệp.",404);
    const row=await store.get("resource",id);
    const item=row?.data;if(item?.fileId!==id)return problem("Không tìm thấy tệp.",404);
    const obj=await env.BUCKET.get(id);if(!obj)return problem("Không tìm thấy tệp.",404);
    return new Response(obj.body,{headers:{"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(item.filename),"X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
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