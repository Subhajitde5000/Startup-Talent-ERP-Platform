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

test('all nine pipeline methods share scoped bearer transport and exact payloads', async () => {
 const calls=[]; const client=loadClient(async(url,options)=>{calls.push({url,options});return options.method==='DELETE'?new Response(null,{status:204}):json({items:[],total:0});});
 client.setTokens({access_token:'access',refresh_token:'refresh'});
 const signal=new AbortController().signal;
 await client.api.applicants.list('org','job',{q:'A&B',limit:20,offset:20,stage:'review'},signal);
 await client.api.applicants.get('org','job','app',signal);
 await client.api.applicants.update('org','job','app',{stage:'review',expected_stage:'applied'});
 await client.api.applicants.history('org','job','app',{limit:20,offset:20},signal);
 await client.api.applicants.notes('org','job','app',{},signal);
 await client.api.applicants.addNote('org','job','app',{body:'Private note'});
 await client.api.applicants.deleteNote('org','job','app','note');
 await client.api.applicants.settings('org','job',{blind_review_enabled:true});
 await client.api.applicants.resume('org','job','app');
 await client.api.applicants.resume('org','job','app',{disposition:'inline'});
 assert.equal(calls.length,10); assert.match(calls[0].url,/q=A%26B/);
 assert.equal(calls[0].options.signal,signal);
 assert.equal(calls[1].url,'/api/v1/organizations/org/jobs/job/applications/app');
 assert.equal(calls[2].options.method,'PATCH');assert.equal(JSON.parse(calls[2].options.body).expected_stage,'applied');
 assert.equal(calls[6].options.method,'DELETE');assert.ok(calls[6].url.endsWith('/notes/note'));
 assert.ok(calls[7].url.endsWith('/review-settings'));assert.deepEqual(JSON.parse(calls[8].options.body),{});
 assert.ok(calls[9].url.includes('disposition=inline'));
 assert.ok(calls.every(call=>call.options.headers.Authorization==='Bearer access'));
 assert.equal(client.localStorage.data.size,0);assert.equal(client.sessionStorage.data.size,0);
});

test('pipeline refresh uses the existing single-flight refresh and field error mapping',async()=>{
 let refreshes=0;
 const client=loadClient(async(url,options)=>{
  if(url.endsWith('/auth/refresh')){refreshes++;return json({access_token:'new',refresh_token:'rotated'});}
  if(options.headers.Authorization==='Bearer old')return json({error:{code:'TOKEN_EXPIRED',message:'Expired'}},401);
  return json({error:{code:'VALIDATION_ERROR',message:'Invalid assignee',details:[{loc:['body','assignee_id'],msg:'Same organization required'}]}},422);
 });
 client.setTokens({access_token:'old',refresh_token:'refresh'});
 for(const result of await Promise.allSettled([client.api.applicants.update('org','job','a',{assignee_id:'foreign'}),client.api.applicants.update('org','job','b',{assignee_id:'foreign'})])){
  assert.equal(result.status,'rejected');assert.equal(client.fileFieldErrors(result.reason).assignee_id,'Same organization required');
 }
 assert.equal(refreshes,1);assert.equal(client.localStorage.data.size,0);
});

test('signed development resume URLs reuse the same-origin storage helper',()=>{
 const client=loadClient();assert.equal(client.browserStorageUrl('http://localhost:8000/api/v1/files/local-serve/signed'),'/api/v1/files/local-serve/signed');
 assert.equal(client.browserStorageUrl('https://private.example/signed'),'https://private.example/signed');
});
