export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')){try{return await api(request,env,readTutorFlow);}catch(e){if(e instanceof SyntaxError)return problem("Nội dung gửi không hợp lệ.");return problem("Không thể truy cập dữ liệu lúc này. Vui lòng thử lại.",503);}}
  if(!Object.hasOwn(assets,path)||request.method!=="GET")return new Response("Không tìm thấy",{status:404});
  return new Response(assets[path],{headers:{"Content-Type":({'/':'text/html','/app.js':'text/javascript','/style.css':'text/css'})[path]+'; charset=utf-8',"Cache-Control":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin"}});
}};