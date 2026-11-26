const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function client(fetch) {
  const map = new Map();
  const localStorage = {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/api/client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,fetch,process:{env:{}},window:{localStorage,dispatchEvent(){}},URL,URLSearchParams,Response,Event});
  return exports;
}
const json = (body,status=200) => new Response(JSON.stringify(body),{status});

test('hiring, saved jobs and alerts use the shared client and refresh on 401',async()=>{
  const calls=[];
  const c=client(async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/auth/refresh')) return json({access_token:'new',refresh_token:'rotated'});
    if(options.headers.Authorization==='Bearer old') return json({error:{code:'UNAUTHORIZED',message:'Expired'}},401);
    return options.method==='DELETE' ? new Response(null,{status:204}) : json({items:[],total:0});
  });
  c.setTokens({access_token:'old',refresh_token:'refresh'});
  await c.api.hiringInsights.analytics('org');
  await c.api.hiringInsights.activity('org',{limit:10,offset:20});
  await c.api.savedJobs.update('job',{note:'private'});
  await c.api.jobAlerts.create({title:'Remote',criteria:{salary_min:'1800000.00'},frequency:'daily'});
  await c.api.jobAlerts.delete('alert');
  assert.equal(calls[0].url,'/api/v1/organizations/org/hiring/analytics');
  assert.equal(calls[1].url,'/api/v1/auth/refresh');
  assert.equal(calls[2].options.headers.Authorization,'Bearer new');
  assert.match(calls[3].url,/hiring\/activity\?limit=10&offset=20/);
  assert.equal(JSON.parse(calls[4].options.body).note,'private');
  assert.equal(JSON.parse(calls[5].options.body).criteria.salary_min,'1800000.00');
  assert.equal(calls[6].options.method,'DELETE');
});
