// Replace this adapter only after verifying a scoped, read-only TutorFlow account.
const people = [
  {id:"demo-maianh",name:"Mai Anh",type:"Cá nhân",goal:"IELTS Foundation",color:"lilac"},
  {id:"demo-sun",name:"Nhóm Sunflower",type:"Nhóm",goal:"Tiếng Anh giao tiếp",color:"gold"},
  {id:"demo-minh",name:"Minh Khang",type:"Cá nhân",goal:"Global Success 8",color:"sky"}
];
const slots = [[1,0,18,0],[2,2,17,30],[4,0,18,0],[5,2,17,30],[6,1,8,0],[0,1,8,0]];
export function readTutorFlow(now=new Date(), extraIds=[]) {
  const day=86400000, offset=7*3600000;
  const first=Math.floor((now.getTime()+offset)/day);
  const days=new Set(Array.from({length:43},(_,i)=>first-21+i));
  for (const id of extraIds) {
    const m=/^demo-(\d+)-\d+$/.exec(id);
    if(m && +m[1]>15000 && +m[1]<50000) days.add(+m[1]);
  }
  const sessions=[];
  for(const d of days) {
    const weekday=new Date(d*day).getUTCDay();
    for(const [w,p,h,m] of slots.filter(s=>s[0]===weekday)){
      const start=d*day-offset+(60*h+m)*60000;
      sessions.push({id:'demo-'+d+'-'+p,personId:people[p].id,start,end:start+90*60000,status:now>=start+90*60000?'Đã kết thúc':now>=start?'Đang diễn ra':'Sắp tới'});
    }
  }
  return {source:"sample",people,sessions:sessions.sort((a,b)=>a.start-b.start)};
}