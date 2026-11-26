import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [page,style,...modules]=await Promise.all(['web/index.html','web/style.css','web/app.js','web/editors.js','web/routes.js','web/assistant.js','worker/tutorflow.js','worker/storage.js','worker/api.js','worker/index.js'].map(read));
const [core,editors,routes,ai,adapter,storage,api,worker]=modules;
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js','const assets='+JSON.stringify({'/':page,'/style.css':style,'/app.js':[core,editors,routes,ai].join('\n')})+';\n'+adapter.replace('export function','function')+'\n'+storage+'\n'+api+'\n'+worker);
console.log('Built Alden Path.');