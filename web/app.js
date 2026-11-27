const $=(q,root=document)=>root.querySelector(q), $$=(q,root=document)=>[...root.querySelectorAll(q)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const glyph={
 book:'<path d="M3 5q5-2 9 2 4-4 9-2v14q-5-2-9 2-4-4-9-2z"/><path d="M12 7v14"/>',brand:'<path d="M4 5q4 0 6.5 3v11Q7 16 4 16zM13 7q3-4 7-4v12q-4 0-7 4z" fill="currentColor" stroke="none"/>',dash:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',path:'<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M8 6h7a4 4 0 0 1 0 8H9a2 2 0 0 0 0 4h7"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2q0-5 7-5t7 5v2M16 5q5 0 4 5M18 14q4 1 4 5"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m3 0h2"/>',spark:'<path d="m12 3 2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1zM20 2v4m-2-2h4"/>',plug:'<path d="m8 8 8 8m-6-6 4-4m0 8 4-4M7 9l-2 2a5 5 0 0 0 7 7l2-2M5 19l-2 3"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m4 12 5 5L20 6"/>',pen:'<path d="m4 16-1 5 5-1 12-12-4-4zM13 7l4 4"/>',time:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',layers:'<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',chev:'<path d="m9 5 7 7-7 7"/>',menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',leaf:'<path d="M12 21c-2-7 1-12 7-16M12 16c-1-6 0-11 8-13 0 8-3 12-8 13zM11 17Q4 17 3 9q7 1 8 8Z"/>',note:'<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h6"/>',stack:'<rect x="4" y="4" width="13" height="14" rx="2"/><path d="M9 21h11V8"/>',undo:'<path d="M3 10h6M3 10l4-5M3 10a8 8 0 1 1 1 8"/>',flag:'<path d="M5 21V4q4-2 7 0t7 0v10q-4 2-7 0t-7 0"/>'};
const ico=n=>'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(glyph[n]||glyph.note)+'</svg>';
const navs={home:["Tổng quan","dash"],lessons:["Giáo án","book"],paths:["Lộ trình","path"],people:["Học viên","users"],sessions:["Buổi học","cal"],resources:["Tài nguyên","folder"],ai:["Trợ lý AI","spark"],connection:["TutorFlow","plug"]};
const navGroups=[["Không gian",["home","lessons","paths","people","sessions"]],["Công cụ",["resources","ai","connection"]]];
const navLinks=()=>navGroups.map(([group,items])=>'<div class="navgroup">'+group+'</div>'+items.map(id=>'<button class="navitem '+(page===id?'current':'')+'" '+(page===id?'aria-current="page"':'')+' title="'+esc(navs[id][0])+'" aria-label="'+esc(navs[id][0])+'" data-act="go" data-id="'+id+'">'+ico(navs[id][1])+'<span class="navlabel">'+navs[id][0]+'</span></button>').join('')).join('');
let db, page='', sessionTab='next', pathTab='template', resTab='resource', lessonView='list', filters={}, searchText='', editor=null, serial=0, authTab='login';
const authState={configured:false,localPreview:false,user:null,getToken:null,signOut:null,sdk:null};
const recs=k=>(db?.records||[]).filter(x=>x.kind===k), rec=(k,id)=>recs(k).find(x=>x.id===id), person=id=>db.people.find(x=>x.id===id), sess=id=>db.sessions.find(x=>x.id===id), uid=()=>crypto.randomUUID(), clone=x=>structuredClone(x);
const vi=(d,opts)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',...opts}).format(new Date(d)), day=d=>vi(d,{day:'2-digit',month:'2-digit'}), hour=d=>vi(d,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}), full=d=>vi(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'}), fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
const act=(a,id='')=>' data-act="'+esc(a)+'" data-id="'+esc(id)+'"';
const button=(label,a,id='',cls='outline',icon='')=>'<button type="button" class="'+cls+'"'+act(a,id)+'>'+(icon?ico(icon):'')+esc(label)+'</button>';
const tile=(icon,color)=>'<span class="tile '+color+'">'+ico(icon)+'</span>';
const badge=(t,cl='')=>'<span class="badge '+cl+'">'+esc(t)+'</span>';
const pagehead=(t,sub,buttons='')=>'<div class="pagehead"><div><h1>'+t+'</h1><p>'+sub+'</p></div><div class="actions">'+buttons+'</div></div>';
const card=(title,icon,body,last='')=>'<section class="card"><div class="cardhead"><h2>'+ico(icon)+esc(title)+'</h2>'+last+'</div>'+body+'</section>';
const empty=(title,description='',action='')=>'<div class="empty">'+ico('book')+'<strong>'+esc(title)+'</strong>'+(description?'<span class="sub">'+esc(description)+'</span>':'')+action+'</div>';
const tabs=(list,current,a)=>'<div class="tabs">'+Object.entries(list).map(([id,n])=>button(n,a,id,id===current?'active':'')).join('')+'</div>';
async function authHeaders(base={}){const h=new Headers(base);if(authState.getToken){const tok=await authState.getToken();if(tok)h.set('Authorization','Bearer '+tok);}return h;}
async function request(url,options={}){const headers=await authHeaders(options.headers);const r=await fetch(url,{...options,headers});let v;try{v=await r.json();}catch{throw Error("Máy chủ chưa phản hồi. Vui lòng thử lại.");}if(!r.ok)throw Error(v.error||"Không thể hoàn tất thao tác.");return v;}
async function downloadProtected(url,filename){const headers=await authHeaders();const r=await fetch(url,{headers});if(!r.ok)throw Error('Không thể tải tệp.');const blob=await r.blob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename||'tai-lieu';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);}
const apiJSON=(method,data)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
async function reload(){db=await request('/api/workspace');const pill=$('#source span');if(pill)pill.textContent=db.source==='tutorflow'?'TutorFlow · Đã kết nối':db.source==='error'?'TutorFlow · Lỗi kết nối':'TutorFlow · Chưa kết nối';}
function toast(message){const t=$('#toast');t.textContent=message;t.className='show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.className='',3000);}
function modal(title,body){$('#modalTitle').textContent=title;$('#modalbody').innerHTML=body;const d=$('#dialog');if(!d.open)d.showModal();d.scrollTop=0;}
function close(){if($('#dialog').open)$('#dialog').close();editor=null;}
function go(p){if(!navs[p])p='home';close();if(location.hash!=='#'+p)location.hash=p;else render();document.body.classList.remove('navopen');}
function render(){page=navs[location.hash.slice(1)]?location.hash.slice(1):'home';$('#section').textContent=navs[page][0];$('#nav').innerHTML=navLinks();$('#main').innerHTML=({home:dashboard,lessons:lessonList,paths:pathList,people:peopleList,sessions:sessionList,resources:resources,ai:aiPage,connection:connection})[page]();document.title=navs[page][0]+' · Alden Path';}
const upcoming=()=>db.sessions.filter(s=>s.end>Date.now()), past=()=>db.sessions.filter(s=>s.end<=Date.now()).sort((a,b)=>b.start-a.start);
const weekAhead=()=>upcoming().filter(s=>s.start<Date.now()+7*86400000);
const openTasks=()=>recs('review').flatMap(r=>(r.data.items||[]).filter(a=>a.status!=='done').map(a=>({id:r.id,title:a.title})));
function slot(s){const p=person(s.personId)||{name:'Học viên',goal:''},ts=s.start,plan=rec('plan',s.id),review=rec('review',s.id);
const state=s.end<=Date.now()?(review?'Đã ghi nhận':'Chờ cập nhật'):(plan?'Đã lên kế hoạch':'Chưa có kế hoạch');
return '<button class="slot"'+act('session',s.id)+'><span class="datebox"><small>'+esc(vi(ts,{weekday:'short'}).toUpperCase())+'</small><b>'+esc(vi(ts,{day:'2-digit'}))+'</b></span><span class="grow"><strong>'+esc(p.name)+'</strong><small>'+hour(ts)+' – '+hour(s.end)+' · '+esc(p.goal)+'</small></span>'+badge(state,plan||review?'':'pending')+'</button>';}
const quick=(name,icon,color,a,id='')=>'<button class="quick"'+act(a,id)+'>'+tile(icon,color)+esc(name)+'</button>';
function dashboard(){
const near=weekAhead(),missing=near.filter(s=>!rec('plan',s.id)),unlogged=past().filter(s=>!rec('review',s.id)),left=openTasks();
const stats=[
 ['BUỔI TRONG 7 NGÀY','Trong tuần',near.length,'cal','lilac','week'],
 ['CHƯA CÓ KẾ HOẠCH','Cần soạn bài',missing.length,'note','gold','unplanned'],
 ['CHỜ CẬP NHẬT','Sau buổi học',unlogged.length,'time','sky','pending'],
 ['CẦN TIẾP TỤC','Hoạt động dở',left.length,'flag','mint','carry']
];
const recent=[...db.records].filter(r=>['lesson','template','path','plan'].includes(r.kind)).slice(0,4);
const helloName=authState.user?.displayName||authState.user?.email?.split('@')[0]||'Alden';
const nextSoon=upcoming().filter(s=>s.start<=Date.now()+24*3600000)[0];
const nextPerson=nextSoon?(person(nextSoon.personId)||{name:'Học viên'}):null;
const remindHtml=nextSoon?'<div class="remind"><div><strong>'+(nextSoon.start<=Date.now()?'Đang diễn ra':'Sắp dạy trong 24 giờ tới')+': '+esc(nextPerson.name)+'</strong><small>'+day(nextSoon.start)+' · '+hour(nextSoon.start)+' – '+hour(nextSoon.end)+(rec('plan',nextSoon.id)?' · Đã có giáo án':' · Chưa gắn giáo án')+'</small></div>'+button(rec('plan',nextSoon.id)?'Xem kế hoạch':'Lập kế hoạch ngay','session',nextSoon.id,rec('plan',nextSoon.id)?'outline':'btn')+'</div>':'';
return '<section class="tfhero"><div><div class="tfchip">'+ico('cal')+'<span>'+esc(full(Date.now()))+'</span></div><h1 class="tfgreet">Chào '+esc(helloName)+'!</h1><p class="tfsub">Bạn có <b>'+near.length+' buổi dạy</b> trong 7 ngày tới'+(db.source==='tutorflow'?' · Đã đồng bộ từ TutorFlow':'')+'.</p></div><div class="actions">'+button('Tạo giáo án','newlesson','','btn','plus')+'</div></section>'
+remindHtml
+'<div class="stats">'+stats.map(([label,pill,n,i,c,id])=>'<button class="stat"'+act('sessiontab',id)+'><div class="statTop">'+tile(i,c)+'<div class="statmeta"><span class="statlabel">'+label+'</span><span class="statpill"><i class="dot '+c+'"></i>'+pill+'</span></div></div><div class="statnum"><strong>'+n+'</strong></div></button>').join('')+'</div>'
+'<div class="dashcols"><div class="stack">'+card('Buổi dạy sắp tới','cal',upcoming().slice(0,4).map(slot).join('')||empty('Chưa có buổi sắp tới'),button('Xem lịch','sessiontab','next','textbtn'))+card('Giáo án & lộ trình gần đây','book',recent.length?recent.map(r=>'<button class="rowlink"'+act('openrecord',r.kind+'|'+r.id)+'>'+esc(r.data.title)+'</button>').join(''):'<div class="quiet">Giáo án, lộ trình và kế hoạch bạn vừa lưu sẽ xuất hiện ở đây.</div>')+'</div><div class="stack">'+card('Thao tác nhanh','layers',quick('Tạo lộ trình mẫu','path','mint','newtemplate')+quick('Cập nhật sau buổi học','pen','gold','sessiontab','pending')+quick('Mở trợ lý AI','spark','lilac','go','ai'))+card('Nội dung cần tiếp tục','flag',left.length?left.slice(0,4).map(x=>'<button class="rowlink"'+act('session',x.id)+'>'+esc(x.title)+'</button>').join(''):'<div class="quiet">Chưa có hoạt động dạy dở được ghi nhận.</div>')+card('Đề xuất đã lưu','spark',savedSuggestions(3))+'</div></div>';}
function tutorflowConnection(){
 const ok=db?.source==='tutorflow', err=db?.source==='error';
 const statusHtml=ok
  ?'<p><b>Đã kết nối TutorFlow (chỉ đọc)</b></p><p>Đang đồng bộ <b>'+db.people.length+' học viên</b> và <b>'+db.sessions.length+' buổi học</b> từ TutorFlow. Giáo án, kế hoạch và ghi nhận vẫn được lưu riêng trong Alden Path theo từng tài khoản.</p>'
  :err?'<p><b>Chưa đọc được dữ liệu TutorFlow</b></p><p class="err">'+esc(db.tutorflowError||'Lỗi kết nối TutorFlow.')+'</p>'
  :'<p><b>Chưa kết nối TutorFlow</b></p><p>Khi kết nối nguồn TutorFlow, danh sách học viên và lịch dạy sẽ hiển thị tại đây ở chế độ chỉ đọc. Giáo án, kế hoạch và ghi nhận được lưu riêng trong Alden Path.</p>';
 return pagehead('Kết nối TutorFlow','Nguồn học viên, nhóm và buổi học.')+'<div class="split">'+card('Trạng thái kết nối','plug',statusHtml)+card('Nguyên tắc đồng bộ chỉ đọc','note','<ul class="biglist"><li>Alden Path chỉ đọc danh sách học viên và lịch buổi dạy từ TutorFlow.</li><li>Không bao giờ ghi, sửa hay xóa dữ liệu ngược lại vào TutorFlow.</li><li>Giáo án, lộ trình, kế hoạch và ghi nhận sau buổi học được lưu riêng trong Alden Path.</li></ul>')+'</div>';
}
function connection(){
 const s=db.storage||{backend:"d1",files:"r2"};
 const count=Object.fromEntries(["lesson","activity","resource","template","path","plan","review","suggestion"].map(k=>[k,recs(k).length]));
 return tutorflowConnection()+'<div style="margin-top:18px">'+card('Lưu trữ & sao lưu','folder',
 '<p><b>'+esc(s.backend==="firestore"?"Cloud Firestore (Đang kết nối)":s.firebaseConfigured?"D1 / Cục bộ (Firebase đã cấu hình, chưa kích hoạt)":"D1 · Firebase chưa kích hoạt")+'</b></p>'+
 (s.projectId?'<p>Project ID: <code>'+esc(s.projectId)+'</code></p>':'<p class="sub">Chưa cấu hình dự án Firebase riêng của Alden Path.</p>')+
 '<p>Tệp đang lưu trong R2. Bản JSON chứa dữ liệu và thông tin tệp. Bạn cần tải từng tệp riêng để sao lưu nội dung.</p>'+
 '<button type="button" class="btn" data-act="backup">Tải bản sao lưu JSON</button>'+
 '<p class="sub">Giáo án '+count.lesson+' · Hoạt động '+count.activity+' · Tài liệu '+count.resource+' · Lộ trình mẫu '+count.template+' · Lộ trình riêng '+count.path+' · Kế hoạch '+count.plan+' · Ghi nhận '+count.review+' · Đề xuất AI '+count.suggestion+'</p>'+
 recs("resource").filter(r=>r.data.fileId).map(r=>'<p>'+resourceLink(r)+'</p>').join('')+
 '<p class="notice">Site riêng tư dùng kiểm soát truy cập của ChatGPT bên ngoài ứng dụng. Máy chủ kiểm tra quyền chủ sở hữu cho API dữ liệu, sao lưu, AI và tệp.</p>')+'</div>';
}
function peopleList(){
 const q=fold(searchText);
 const rows=db.people.filter(p=>!q||fold(p.name+' '+p.goal).includes(q));
 return pagehead('Học viên','Danh sách học viên và nhóm từ TutorFlow.')
 +(db.people.length?'<div class="toolbar"><input id="peopleSearch" aria-label="Tìm học viên" placeholder="Tìm tên học viên hoặc mục tiêu…" value="'+esc(searchText)+'"></div>':'')
 +(rows.length?'<div class="gridlist">'+rows.map(p=>{
  const pPaths=recs('path').filter(r=>r.data.personId===p.id);
  const doneCount=past().filter(s=>s.personId===p.id).length;
  const upCount=upcoming().filter(s=>s.personId===p.id).length;
  const pg=pPaths[0]?pathProgress(pPaths[0].data):null;
  return '<article class="itemcard">'+tile('users',p.color)+'<h3>'+esc(p.name)+'</h3><div class="badges">'+badge(p.type)+badge(doneCount+' đã dạy')+badge(upCount+' sắp tới')+'</div><p class="sub">'+esc(p.goal||'Chưa có mục tiêu')+'</p>'+(pg?'<div class="pbox"><div class="pbar"><span style="width:'+pg.pct+'%"></span></div><small class="sub">Lộ trình: '+pg.pct+'% ('+pg.done+'/'+pg.total+' bước)</small></div>':'')+button('Xem hồ sơ dạy học','person',p.id,'outline')+'</article>';
 }).join('')+'</div>':'<div class="card">'+empty(db.people.length?'Không tìm thấy học viên phù hợp':'Chưa có học viên nào',db.people.length?'Thử từ khóa tìm kiếm khác.':'Chưa kết nối nguồn dữ liệu TutorFlow hoặc chưa có học viên được đồng bộ.')+'</div>');
}
function showPerson(id){
 const p=person(id);if(!p)return;
 const paths=recs('path').filter(r=>r.data.personId===id),history=past().filter(s=>s.personId===id),nexts=upcoming().filter(s=>s.personId===id);
 const avgPct=paths.length?Math.round(paths.reduce((a,r)=>a+pathProgress(r.data).pct,0)/paths.length):0;
 modal(p.name,'<p>'+badge(p.type)+' '+esc(p.goal)+'</p>'
  +'<div class="miniStats"><div><b>'+history.length+'</b><small>Đã dạy</small></div><div><b>'+nexts.length+'</b><small>Sắp tới</small></div><div><b>'+(paths.length?avgPct+'%':'—')+'</b><small>Lộ trình</small></div></div>'
  +'<div class="subhead"><h3>Lộ trình riêng</h3>'+button('Tạo từ mẫu','assign','@'+id,'outline','plus')+'</div>'
  +paths.map(r=>{const pg=pathProgress(r.data);return '<div style="margin:8px 0">'+button(r.data.title+' · '+pg.pct+'%','editpath',r.id)+'<div class="pbar" style="margin-top:6px"><span style="width:'+pg.pct+'%"></span></div></div>';}).join('')
  +(paths.length?'':'<p class="quiet">Chưa có lộ trình riêng.</p>')
  +'<h3>Lịch sử buổi học</h3>'+(history.length?history.slice(0,8).map(slot).join(''):'<p class="quiet">Chưa có buổi học đã qua.</p>'));
}
function sessionList(){const list=sessionTab==='week'?weekAhead():sessionTab==='unplanned'?weekAhead().filter(s=>!rec('plan',s.id)):sessionTab==='pending'?past().filter(s=>!rec('review',s.id)):sessionTab==='past'?past():sessionTab==='carry'?db.sessions.filter(s=>openTasks().some(t=>t.id===s.id)):upcoming();
return pagehead('Buổi học','Lịch buổi dạy theo giờ Việt Nam. Mở một buổi để lên kế hoạch hoặc ghi nhận kết quả.')+tabs({next:'Sắp tới',week:'7 ngày tới',unplanned:'Chưa có kế hoạch · 7 ngày',past:'Đã dạy',pending:'Chờ cập nhật',carry:'Cần tiếp tục'},sessionTab,'sessiontab')+card('Danh sách buổi học','cal',list.length?list.map(s=>'<div class="grouphead"><small class="sub">'+day(s.start)+'</small>'+slot(s)+'</div>').join(''):empty('Không có buổi nào trong mục này'));}
function toggleNav(){document.body.classList.toggle('navopen');}
$('#brand').innerHTML='<span class="mark">'+ico('brand')+'</span>Alden Path';
$('#crumbicon').innerHTML=ico('panel');$('#menu').innerHTML=ico('menu');$('#close').innerHTML=ico('close');$('#menu').onclick=toggleNav;$('#shade').hidden=false;$('#shade').onclick=toggleNav;$('#source').onclick=()=>go('connection');$('#close').onclick=close;
window.addEventListener('hashchange',()=>{if(db){close();render();window.scrollTo(0,0);}});
const googleIcon='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3.1h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3.1c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.2v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.2 14.1a7.2 7.2 0 0 1 0-4.2V6.8H1.2a12 12 0 0 0 0 10.4l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.2 6.8l4 3.1c1-2.9 3.7-5.1 6.8-5.1z"/></svg>';
function authErrorText(e){
  const code=e?.code||'';
  if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found')return 'Email hoặc mật khẩu chưa đúng.';
  if(code==='auth/email-already-in-use')return 'Email này đã được đăng ký. Hãy chuyển sang tab Đăng nhập.';
  if(code==='auth/weak-password')return 'Mật khẩu cần ít nhất 6 ký tự.';
  if(code==='auth/invalid-email')return 'Địa chỉ email chưa hợp lệ.';
  if(code==='auth/popup-closed-by-user')return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  if(code==='auth/unauthorized-domain')return 'Tên miền hiện tại chưa được thêm vào Authorized domains trong Firebase Authentication.';
  if(code==='auth/operation-not-allowed')return 'Phương thức đăng nhập này chưa được bật trong Firebase Console → Authentication → Sign-in method.';
  return e?.message||'Không thể đăng nhập. Vui lòng thử lại.';
}
function syncProfile(user){
  const name=user?.displayName||(user?.email?user.email.split('@')[0]:'Alden');
  const meta=user?.email||'Không gian giáo viên';
  $('#profileName').textContent=name;
  $('#profileMeta').textContent=meta;
  const av=$('#profileAvatar');
  if(user?.photoURL){av.innerHTML='<img src="'+esc(user.photoURL)+'" alt="">';}
  else{av.textContent=(name[0]||'A').toUpperCase();}
  $('#logoutBtn').hidden=!user;
}
function showApp(user){
  $('#authscreen').hidden=true;
  $('.shell').hidden=false;
  syncProfile(user);
  init();
}
function renderAuthScreen(){
  $('.shell').hidden=true;
  const el=$('#authscreen');
  el.hidden=false;
  const reg=authTab==='register';
  el.innerHTML='<section class="authcard"><div class="authbrand"><span class="mark">'+ico('brand')+'</span>Alden Path</div>'
    +'<h1>'+(reg?'Tạo tài khoản mới':'Đăng nhập không gian dạy học')+'</h1>'
    +'<p class="sub">Mỗi tài khoản lưu trữ giáo án, lộ trình và ghi nhận buổi học riêng biệt.</p>'
    +'<div class="tabs"><button type="button" id="tabLogin" class="'+(!reg?'active':'')+'">Đăng nhập</button><button type="button" id="tabReg" class="'+(reg?'active':'')+'">Tạo tài khoản</button></div>'
    +(!authState.configured?'<div class="notice">Chưa cấu hình <code>FIREBASE_WEB_API_KEY</code> trong <code>.env</code> để kích hoạt đăng nhập Email &amp; Google trên Firebase.</div>':'')
    +'<form class="authform" id="loginForm">'
    +(reg?'<label class="field"><span>Tên hiển thị</span><input name="name" placeholder="Ví dụ: Cô Lan" autocomplete="name"></label>':'')
    +'<label class="field"><span>Email</span><input type="email" name="email" required placeholder="ten@gmail.com" autocomplete="email"></label>'
    +'<label class="field"><span>Mật khẩu</span><input type="password" name="password" required minlength="6" placeholder="Ít nhất 6 ký tự" autocomplete="'+(reg?'new-password':'current-password')+'"></label>'
    +'<div id="authErr" class="formerror" role="alert"></div>'
    +'<button type="submit" class="btn" '+(!authState.configured?'disabled':'')+'>'+(reg?'Tạo tài khoản':'Đăng nhập')+'</button>'
    +'</form>'
    +(!reg&&authState.configured?'<div class="authlinks"><button type="button" id="forgotBtn" class="textbtn">Quên mật khẩu?</button></div>':'')
    +'<div class="authsep"><span>hoặc</span></div>'
    +'<button type="button" id="googleBtn" class="googlebtn" '+(!authState.configured?'disabled':'')+'>'+googleIcon+'<span>Tiếp tục với Google</span></button>'
    +(!authState.configured&&authState.localPreview?'<div style="margin-top:14px;text-align:center"><button type="button" id="guestBtn" class="textbtn">Dùng thử cục bộ (chưa đăng nhập)</button></div>':'')
    +'</section>';
  $('#tabLogin').onclick=()=>{authTab='login';renderAuthScreen();};
  $('#tabReg').onclick=()=>{authTab='register';renderAuthScreen();};
  const showAuthErr=(msg,ok=false)=>{const b=$('#authErr');b.className=ok?'formerror notice':'formerror err';b.textContent=msg;};
  $('#loginForm').onsubmit=async e=>{
    e.preventDefault();if(!authState.sdk)return;
    const f=e.target, email=f.email.value.trim(), pass=f.password.value, name=f.name?.value.trim()||'';
    const btn=f.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      if(reg){
        const cred=await authState.sdk.createUserWithEmailAndPassword(authState.sdk.auth,email,pass);
        if(name)await authState.sdk.updateProfile(cred.user,{displayName:name});
      }else{
        await authState.sdk.signInWithEmailAndPassword(authState.sdk.auth,email,pass);
      }
    }catch(err){showAuthErr(authErrorText(err));btn.disabled=false;}
  };
  if($('#forgotBtn'))$('#forgotBtn').onclick=async()=>{
    const email=$('#loginForm').email.value.trim();
    if(!email){showAuthErr('Hãy nhập email của bạn ở ô phía trên trước khi đặt lại mật khẩu.');return;}
    try{await authState.sdk.sendPasswordResetEmail(authState.sdk.auth,email);showAuthErr('Đã gửi email đặt lại mật khẩu tới '+email+'.',true);}
    catch(err){showAuthErr(authErrorText(err));}
  };
  $('#googleBtn').onclick=async()=>{
    if(!authState.sdk)return;
    const btn=$('#googleBtn');btn.disabled=true;
    try{await authState.sdk.signInWithPopup(authState.sdk.auth,new authState.sdk.GoogleAuthProvider());}
    catch(err){showAuthErr(authErrorText(err));btn.disabled=false;}
  };
  if($('#guestBtn'))$('#guestBtn').onclick=()=>showApp(null);
}
async function boot(){
  try{
    const cfg=await fetch('/api/auth/config').then(r=>r.json());
    authState.configured=!!cfg.configured;
    authState.localPreview=!!cfg.localPreview;
    if(!cfg.configured){renderAuthScreen();return;}
    const [{initializeApp},authMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js')
    ]);
    const app=initializeApp({apiKey:cfg.apiKey,authDomain:cfg.authDomain,projectId:cfg.projectId});
    const auth=authMod.getAuth(app);
    authState.sdk={...authMod,auth};
    authState.signOut=()=>authMod.signOut(auth);
    authMod.onAuthStateChanged(auth,user=>{
      authState.user=user||null;
      authState.getToken=user?()=>user.getIdToken():null;
      if(user)showApp(user);
      else renderAuthScreen();
    });
  }catch(e){
    renderAuthScreen();
    const b=$('#authErr');if(b){b.className='formerror err';b.textContent=e.message||'Không thể khởi tạo đăng nhập.';}
  }
}