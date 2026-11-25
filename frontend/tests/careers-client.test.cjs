/* No extra test dependency: exercise the actual shared client in an isolated browser-like VM. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) || null, removeItem: key => data.delete(key), setItem: (key, val) => data.set(key, String(val)), data };
}
function loadClient(fetch) {
  const localStorage = storage(), sessionStorage = storage();
  const window = { localStorage, sessionStorage, dispatchEvent() {} };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/api/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: {} }, window, fetch, URL, URLSearchParams, Response, Event });
  return { ...exports, localStorage, sessionStorage };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('public discovery never sends a token; signed discovery repeats bounded filters', async () => {
 const calls=[];const client=loadClient(async(url,options)=>{calls.push({url,options});return json({items:[],total:0});});
 client.setTokens({access_token:'secret',refresh_token:'refresh'});
 await client.api.careers.jobs({q:'A&B',work_modes:['remote','hybrid'],stages:['idea','growth'],sector:null},false);
 await client.api.careers.jobs({verified_only:true},true);
 await client.api.careers.job('job',false);
 await client.api.careers.company('org',true);
 await client.api.careers.startups({stage:'growth'},false);
 assert.equal(calls[0].options.headers.Authorization,undefined);
 const params=new URL(calls[0].url,'https://forma.dev').searchParams;
 assert.deepEqual(params.getAll('work_modes'),['remote','hybrid']);assert.equal(params.has('sector'),false);assert.equal(params.get('q'),'A&B');
 assert.equal(calls[1].options.headers.Authorization,'Bearer secret');
 assert.equal(calls[2].url,'/api/v1/public/jobs/job');assert.equal(calls[3].url,'/api/v1/companies/org');
 assert.match(calls[4].url,/\/public\/hiring-startups\?stage=growth/);
});

test('self-service actions use the shared client and preserve exact decimal/boolean values',async()=>{
 const calls=[];const client=loadClient(async(url,options)=>{calls.push({url,options});return json({id:'app'});});
 client.setTokens({access_token:'access',refresh_token:'refresh'});
 await client.api.careers.context('job');
 await client.api.careers.submit('job',{salary_expectation:'1800000.50',accuracy_confirmed:true,consent_share:true,screening_answers:[{key:'remote_comfort',value:false}]});
 await client.api.careers.applications({stage:'review',q:'Design',limit:20,offset:20});
 await client.api.careers.application('app');await client.api.careers.history('app',{offset:20});await client.api.careers.withdraw('app');
 await client.api.files.listPersonal({kind:'resume'});
 assert.equal(calls[0].url,'/api/v1/jobs/job/application-context');
 const body=JSON.parse(calls[1].options.body);assert.equal(body.salary_expectation,'1800000.50');assert.equal(body.screening_answers[0].value,false);
 assert.match(calls[2].url,/stage=review&q=Design&limit=20&offset=20/);
 assert.equal(calls[3].url,'/api/v1/applications/app');assert.match(calls[4].url,/stage-events\?offset=20/);
 assert.equal(calls[5].url,'/api/v1/applications/app/withdraw');assert.equal(calls[5].options.method,'POST');assert.equal(calls[5].options.body,'{}');
 assert.match(calls[6].url,/\/users\/me\/files\?kind=resume/);
 assert.ok(calls.every(call=>call.options.headers.Authorization==='Bearer access'));
});

test('application requests share rotating refresh and map nested server validation',async()=>{
 let refreshes=0;const client=loadClient(async(url,options)=>{
  if(url.endsWith('/auth/refresh')){refreshes++;return json({access_token:'new',refresh_token:'rotated'});}
  if(options.headers.Authorization==='Bearer old')return json({error:{code:'UNAUTHORIZED',message:'Expired'}},401);
  if(url.endsWith('/applications'))return json({error:{code:'VALIDATION_ERROR',message:'Invalid contact',details:[{loc:['body','contact','email'],msg:'Invalid email'}]}},422);
  return json({});
 });
 client.setTokens({access_token:'old',refresh_token:'refresh'});
 await Promise.all([client.api.careers.context('job'),client.api.careers.application('app')]);assert.equal(refreshes,1);
 await assert.rejects(client.api.careers.submit('job',{}),error=>error instanceof client.ApiError && error.details[0].loc.join('.')==='body.contact.email');
 assert.equal(client.getRefreshToken(),'rotated');assert.equal(client.localStorage.data.size,0);assert.equal(client.sessionStorage.data.size,0);
});

test('personal resume upload reserves/confirms with bearer auth but signed byte PUT has none', async()=>{
 const calls=[];const client=loadClient(async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/upload-requests'))return json({file:{id:'resume'},upload_url:'https://private-storage.example/upload',headers:{'Content-Type':'application/pdf'}});
  if(url.startsWith('https://'))return new Response(null,{status:200});
  return json({id:'resume',upload_status:'ready',scan_status:'clean'});
 });
 client.setTokens({access_token:'access',refresh_token:'refresh'});
 const file=new File(['%PDF'],'resume.pdf',{type:'application/pdf'});
 const result=await client.api.files.uploadPersonal('resume',file);
 assert.equal(result.scan_status,'clean');assert.equal(calls[0].url,'/api/v1/users/me/files/upload-requests');assert.equal(calls[0].options.headers.Authorization,'Bearer access');
 assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.headers.Authorization,undefined);assert.equal(calls[1].options.credentials,'omit');assert.equal(calls[1].options.redirect,'error');assert.equal(calls[1].options.body,file);
 assert.equal(calls[2].url,'/api/v1/files/resume/confirm');assert.equal(calls[2].options.headers.Authorization,'Bearer access');
});

test('resume validation rejects unsupported files; failed storage upload never confirms or retries bytes',async()=>{
 const calls=[];const client=loadClient(async(url,options)=>{calls.push({url,options});if(url.startsWith('https://'))return new Response(null,{status:403});return json({file:{id:'resume'},upload_url:'https://private-storage.example/upload',headers:{}});});
 await assert.rejects(client.api.files.uploadPersonal('resume',new File(['bad'],'resume.exe')),error=>error.code==='VALIDATION_ERROR');assert.equal(calls.length,0);
 await assert.rejects(client.api.files.uploadPersonal('resume',new File(['%PDF'],'resume.pdf')),error=>error.code==='STORAGE_UPLOAD_FAILED');assert.equal(calls.length,2);assert.ok(!calls.some(call=>call.url.endsWith('/confirm')));
});


test('only signed local-storage URLs become same-origin; production R2 URLs are untouched',()=>{
 const client=loadClient();
 assert.equal(client.browserStorageUrl('http://127.0.0.1:8000/api/v1/files/local-upload/signed'),'/api/v1/files/local-upload/signed');
 assert.equal(client.browserStorageUrl('http://localhost:8000/api/v1/files/local-serve/signed'),'/api/v1/files/local-serve/signed');
 assert.equal(client.browserStorageUrl('https://bucket.example/api/v1/files/local-upload/signed'),'https://bucket.example/api/v1/files/local-upload/signed');
 assert.equal(client.browserStorageUrl('https://bucket.example/object?signature=real'),'https://bucket.example/object?signature=real');
 assert.equal(client.browserStorageUrl('/api/v1/files/local-serve/signed'),'/api/v1/files/local-serve/signed');
});
