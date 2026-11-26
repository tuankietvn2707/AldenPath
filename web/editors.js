const statuses={new:'Chưa bắt đầu',active:'Đang học',done:'Hoàn thành',review:'Cần ôn tập'};
const str=v=>typeof v==='string'||typeof v==='number'?String(v):'';
const val=(o,k)=>str(o?.[k]);
function field(k,label,d={},type='text',wide=false,values=null){const id='field-'+(++serial),v=val(d,k);
const attrs=' id="'+id+'" name="'+esc(k)+'"';
const control=type==='textarea'?'<textarea'+attrs+'>'+esc(v)+'</textarea>':type==='select'?'<select'+attrs+'>'+Object.entries(values||{}).map(([id,t])=>'<option value="'+esc(id)+'" '+(v===id?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select>':'<input'+attrs+' type="'+type+'" '+(type==='number'?'min="0" step="1" ':'')+(k==='title'?'required ':'')+'value="'+esc(v)+'">';
return '<div class="field '+(wide?'wide':'')+'"><label for="'+id+'">'+esc(label)+'</label>'+control+'</div>';}
const grid=html=>'<div class="formgrid">'+html+'</div>';
const details=(name,body,open=false)=>'<details class="bucket" '+(open?'open':'')+'><summary>'+esc(name)+'</summary><div class="inside">'+body+'</div></details>';
const footer=(label='Lưu',extra='')=>'<div class="formactions">'+button('Đóng','close')+extra+'<button type="submit" class="btn">'+ico('check')+esc(label)+'</button></div>';
const form=(html,label='Lưu',extra='')=>'<form id="editform">'+html+'<div class="formerror" role="alert"></div>'+footer(label,extra)+'</form>';
const mapFields=(d,items)=>items.map(([k,t,type,w])=>field(k,t,d,type,w)).join('');
function getFields(root){return Object.fromEntries($$('input[name],textarea[name],select[name]',root).filter(el=>!el.disabled&&el.type!=='checkbox'&&el.type!=='file'&&el.closest('[data-nested]')===root.closest('[data-nested]')).map(el=>[el.name,el.value]));}
function options(rs,blank='Chọn…'){return Object.fromEntries([['',blank],...rs.map(r=>[r.id,r.data?.title??r.name])]);}
function attach(d){const list=recs('resource');return list.length?list.map(r=>'<label class="check"><input type="checkbox" data-resource="'+esc(r.id)+'" '+((d.resourceIds||[]).includes(r.id)?'checked':'')+'>'+esc(r.data.title)+'</label>').join(''):'<p class="quiet">Chưa có tài liệu trong mục Tài nguyên.</p>';}
function resourcesRead(d){return (d.resourceIds||[]).map(id=>{const r=rec('resource',id);return r?resourceLink(r):'<span class="sub">Tài liệu đã gỡ</span>';}).join(' · ');}
const activityFields=[['title','Tên hoạt động'],['minutes','Thời lượng (phút)','number'],['goal','Mục tiêu','textarea'],['teacher','Hướng dẫn giáo viên','textarea'],['student','Việc học viên thực hiện','textarea'],['prompts','Câu hỏi gợi ý','textarea'],['answers','Đáp án','textarea',true]];
function moveControls(a,i,count){return '<div class="actions">'+(i>0?button('Lên',a+'up',i,'tinybtn'):'')+(i<count-1?button('Xuống',a+'down',i,'tinybtn'):'')+button('Bỏ',a+'remove',i,'tinybtn danger')+'</div>';}
function activityRows(d){return (d.activities||[]).map((ac,i)=>'<div data-nested="activity" data-key="'+esc(ac.id)+'" class="editorblock"><div class="subhead"><h3>Hoạt động '+(i+1)+'</h3>'+moveControls('act',i,d.activities.length)+'</div>'+grid(mapFields(ac,activityFields))+'</div>').join('');}
const lessonCore=[['title','Tên giáo án'],['duration','Thời lượng dự kiến (phút)','number'],['book','Bộ sách'],['unit','Unit / bài'],['pages','Trang'],['topic','Chủ đề'],['level','Trình độ'],['audience','Đối tượng'],['skill','Kỹ năng'],['type','Loại bài']];
const lessonContent=[['goals','Mục tiêu đầu ra','textarea'],['focus','Kiến thức trọng tâm','textarea'],['vocabulary','Từ vựng','textarea'],['grammar','Ngữ pháp','textarea'],['pronunciation','Phát âm','textarea'],['prep','Chuẩn bị trước buổi học','textarea']];
function lessonForm(d){const bank=recs('activity');return grid(mapFields(d,lessonCore))+details('Mục tiêu & kiến thức',grid(mapFields(d,lessonContent)))+details('Tài liệu đính kèm',attach(d))+details('Hoạt động theo thứ tự','<div id="activityRows">'+activityRows(d)+'</div><div class="actions">'+button('Thêm hoạt động','actadd','','outline','plus')+(bank.length?'<select aria-label="Hoạt động từ ngân hàng" id="bankPick" style="width:auto;max-width:60%">'+Object.entries(options(bank,'Chọn từ ngân hàng')).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join('')+'</select>'+button('Chèn','actbank','','outline'):'')+'</div>',true)+details('Bài tập, đánh giá & ghi chú',grid(mapFields(d,[['homework','Bài tập về nhà','textarea'],['assessment','Cách đánh giá','textarea'],['notes','Ghi chú bổ sung','textarea',true]])));}
function cleanLesson(data){const d={};for(const [k] of [...lessonCore,...lessonContent,['homework'],['assessment'],['notes']])d[k]=val(data,k);d.activities=(Array.isArray(data.activities)?data.activities:[]).map(a=>Object.fromEntries([['id',uid()],...activityFields.map(([k])=>[k,val(a,k)])]));d.resourceIds=[];return d;}
function edit(kind,id='',data=null,parent=null){
const r=id?rec(kind,id):null;editor={kind,id:id||uid(),version:r?.version??0,d:clone(data??r?.data??{}),parent};drawEditor();}
function capture(){
const f=$('#editform');if(!f||!editor)return;
const d=editor.d;Object.assign(d,getFields(f));
if(['lesson','plan','nested','template','path'].includes(editor.kind)){
 d.resourceIds=$$('[data-resource]:checked',f).map(i=>i.dataset.resource);
}
if(['lesson','plan','nested'].includes(editor.kind)){
 d.activities=$$('[data-nested="activity"]',f).map(el=>({id:el.dataset.key,...getFields(el)}));
}
if(['template','path'].includes(editor.kind)){
 d.steps=$$('[data-nested="step"]',f).map((el,i)=>({...d.steps[i],...getFields(el)}));
}
if(editor.kind==='review'){
 d.items=$$('[data-nested="result"]',f).map(el=>({id:el.dataset.key,title:el.dataset.title,...getFields(el)}));
}
}
function drawEditor(){
const {kind,d,version}=editor;let title,body,label='Lưu',extra='';
if(['lesson','plan','nested'].includes(kind)){
 title=kind==='plan'?'Kế hoạch riêng cho buổi dạy':kind==='nested'?'Giáo án trong lộ trình':version?'Chỉnh sửa giáo án':'Tạo giáo án';
 if(kind==='plan'){const p=sess(editor.id);body=grid(field('pathId','Lộ trình riêng',d,'select',true,options(recs('path').filter(r=>r.data.personId===p?.personId),'Không gắn lộ trình')))+lessonForm(d);}
 else body=lessonForm(d);
 if(kind==='lesson'){extra=button('Lưu nháp','draft','','outline');label='Lưu giáo án';}
}else if(kind==='template'||kind==='path'){
 title=kind==='template'?(version?'Chỉnh sửa lộ trình mẫu':'Tạo lộ trình mẫu'):'Chỉnh sửa lộ trình riêng';body=routeForm(d,kind);
}else if(kind==='activity'){title='Hoạt động tái sử dụng';body=grid(mapFields(d,activityFields));}
else if(kind==='resource'){title='Tài liệu';body=grid(field('title','Tên tài liệu',d,'text',true)+(d.fileId?'':field('url','Đường dẫn tài liệu',d,'url',true))+field('notes','Ghi chú / đáp án',d,'textarea',true));}
else if(kind==='review'){title='Ghi nhận sau buổi học';body=reviewForm(d);label='Lưu ghi nhận';}
else if(kind==='suggestion'){title='Đề xuất của AI';body=grid(field('title','Tên đề xuất',d,'text',true)+field('text','Bản nháp có thể chỉnh sửa',d,'textarea',true)+field('status','Quyết định',d,'select',true,{draft:'Lưu nháp',accepted:'Chấp nhận',ignored:'Bỏ qua'}));}
modal(title,form(body,label,extra));}
function adjust(arr,i,action){if(action==='remove')arr.splice(i,1);else{const j=i+(action==='up'?-1:1);if(j>=0&&j<arr.length)[arr[j],arr[i]]=[arr[i],arr[j]];}}
function resetRows(type){const f=$('#editform'),d=editor.d;if(type==='act')$('#activityRows',f).innerHTML=activityRows(d);else $('#stepRows',f).innerHTML=stepRows(d,editor.kind);}
function addActivity(fromBank){const id=fromBank?$('#bankPick')?.value:'';if(fromBank&&!id){toast('Chọn một hoạt động từ ngân hàng.');return;}capture();editor.d.activities.push({...clone(rec('activity',id)?.data||{}),id:uid()});resetRows('act');}
async function saveEditor(draft=false){
const f=$('#editform');if(!f?.reportValidity())return;capture();const {kind,id,d,version,parent}=editor;
if(kind==='nested'){parent.d.steps[parent.editIndex].lesson=clone(d);editor=parent;drawEditor();return;}
if(kind==='lesson')d.status=draft?'draft':'ready';
if(kind==='resource'&&!d.url&&!d.fileId)throw Error('Nhập đường dẫn tài liệu.');
await request('/api/records/'+kind+'/'+encodeURIComponent(id),apiJSON('PUT',{version,data:d}));
await reload();close();render();toast(draft?'Đã lưu giáo án nháp.':'Đã lưu thay đổi.');
if(['plan','review'].includes(kind))showSession(id);
}
function selectedFilters(all){return [['book','Bộ sách'],['level','Trình độ'],['skill','Kỹ năng'],['type','Loại bài'],['duration','Số phút']].map(([k,n])=>'<select aria-label="Lọc '+n+'" data-filter="'+k+'"><option value="">'+n+'</option>'+[...new Set(all.map(r=>r.data[k]).filter(Boolean))].sort().map(v=>'<option value="'+esc(v)+'" '+(filters[k]===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>').join('');}
function lessonTile(r){const d=r.data;return '<article class="itemcard">'+tile('book','mint')+'<h3>'+esc(d.title)+'</h3><div class="badges">'+[d.book,d.level,d.skill,d.duration&&d.duration+' phút',d.status==='draft'?'Bản nháp':''].filter(Boolean).map(n=>badge(n)).join('')+'</div><div class="actions">'+button('Mở giáo án','viewlesson',r.id,'textbtn')+button('Sao chép','copylesson',r.id,'textbtn')+'</div></article>';}
function lessonResults(){const all=recs('lesson'),rows=all.filter(r=>Object.entries(filters).every(([k,v])=>!v||str(r.data[k])===v)&&fold(JSON.stringify(r.data)).includes(fold(searchText)));
if(!rows.length)return '<div class="card">'+empty(all.length?'Không tìm thấy giáo án':'Chưa có giáo án. Hãy tạo giáo án đầu tiên của bạn.',all.length?'Thử đổi từ khóa hoặc bộ lọc.':'Tạo giáo án đầu tiên để dùng cho nhiều buổi dạy.',all.length?button('Xóa bộ lọc','clearfilter'):button('Tạo giáo án','newlesson','','btn','plus'))+'</div>';
if(lessonView==='list')return '<div class="gridlist">'+rows.map(lessonTile).join('')+'</div>';
const grouping=(rs,level)=>{if(level===3)return rs.map(r=>button(r.data.title,'viewlesson',r.id,'rowlink')).join('');const groups=new Map();for(const r of rs){const k=r.data[['book','unit','skill'][level]]||['Giáo án độc lập','Chưa phân unit','Kỹ năng chung'][level];if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}return [...groups].map(([k,v])=>details(k,grouping(v,level+1),true)).join('');};return grouping(rows,0);}
function lessonList(){return pagehead('Thư viện giáo án','Soạn bài, lưu nháp và tái sử dụng cho từng lớp.',button('Tạo giáo án','newlesson','','btn','plus'))+'<div class="toolbar"><input id="lessonSearch" aria-label="Tìm giáo án" placeholder="Tìm tên bài, unit, chủ đề…" value="'+esc(searchText)+'">'+selectedFilters(recs('lesson'))+'</div>'+tabs({list:'Danh sách',tree:'Theo bộ sách'},lessonView,'lessonview')+'<div id="lessonResults">'+lessonResults()+'</div>';}
const definition=(label,v)=>v?'<p><b>'+esc(label)+'</b><br><span class="report">'+esc(v)+'</span></p>':'';
function lessonRead(d){return '<div class="badges">'+[d.book,d.unit,d.level,d.skill,d.duration&&d.duration+' phút'].filter(Boolean).map(v=>badge(v)).join('')+'</div>'+[...lessonCore.filter(([k])=>['pages','topic','type','audience'].includes(k)),...lessonContent].map(([k,t])=>definition(t,d[k])).join('')+(d.activities||[]).map((a,i)=>details((i+1)+'. '+(a.title||'Hoạt động')+(a.minutes?' · '+a.minutes+' phút':''),activityFields.slice(2).map(([k,t])=>definition(t,a[k])).join('')||'Chưa có hướng dẫn.',false)).join('')+definition('Bài tập về nhà',d.homework)+definition('Đánh giá',d.assessment)+definition('Ghi chú',d.notes)+resourcesRead(d);}
function viewLesson(id){const r=rec('lesson',id);modal(r.data.title,lessonRead(r.data)+'<div class="formactions">'+button('Xóa','delete','lesson|'+id,'textbtn danger')+button('Sao chép','copylesson',id)+button('Chỉnh sửa','editlesson',id,'btn','pen')+'</div>');}
function resourceLink(r){const d=r.data;const href=d.fileId?'/api/file/'+encodeURIComponent(d.fileId):/^https?:\/\//i.test(d.url)?d.url:'';return href?'<a class="textbtn" target="_blank" rel="noopener noreferrer" href="'+esc(href)+'">'+esc(d.title)+'</a>':esc(d.title);}
function resources(){const activity=resTab==='activity',rows=recs(resTab);return pagehead('Tài nguyên','Tài liệu, đáp án và hoạt động có thể dùng lại trong nhiều giáo án.',activity?button('Thêm hoạt động','newactivity','','btn','plus'):button('Gắn đường dẫn','newresource','','btn','plus')+(db.uploads?button('Tải tệp lên','upload'):''))
+tabs({resource:'Tài liệu & đáp án',activity:'Ngân hàng hoạt động'},resTab,'restab')+(!activity?'<p class="notice">Tệp và đường dẫn được lưu để sử dụng khi dạy. AI chưa đọc nội dung bên trong các tài liệu này.</p>':'')+(rows.length?'<div class="gridlist">'+rows.map(r=>'<article class="itemcard">'+tile(activity?'layers':'folder',activity?'gold':'sky')+'<h3>'+(activity?esc(r.data.title):resourceLink(r))+'</h3><p class="sub">'+esc(activity?r.data.goal:r.data.notes)+'</p><div class="actions">'+button('Chỉnh sửa','openrecord',r.kind+'|'+r.id,'textbtn')+button('Xóa','delete',r.kind+'|'+r.id,'textbtn danger')+'</div></article>').join('')+'</div>':'<div class="card">'+empty(activity?'Chưa có hoạt động':'Chưa có tài liệu')+'</div>');}
function upload(){editor=null;modal('Tải tài liệu lên','<form id="uploadform">'+grid(field('title','Tên tài liệu',{},'text',true)+'<label class="field wide"><span>Chọn tệp (tối đa 15 MB)</span><input required type="file" name="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.ogg,.wav,.txt"></label>'+field('notes','Ghi chú / đáp án',{},'textarea',true))+'<div class="formerror" role="alert"></div>'+footer('Tải lên')+'</form>');}
