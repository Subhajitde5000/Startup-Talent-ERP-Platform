/* No extra test dependency: exercise the actual shared client in an isolated browser-like VM. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function storage() {
  const data = new Map([['forma.access_token', 'legacy-access'], ['forma.refresh_token', 'legacy-refresh']]);
  return { getItem: key => data.get(key) || null, removeItem: key => data.delete(key), setItem() { throw new Error('Tokens must never be persisted'); }, data };
}
function loadClient(fetch) {
  const localStorage = storage(), sessionStorage = storage();
  const window = { localStorage, sessionStorage, dispatchEvent() {} };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/api/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: {} }, window, fetch, URLSearchParams, Response, Event });
  return { ...exports, localStorage, sessionStorage };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('tokens stay in memory, clear legacy storage, and disappear in a new module session', () => {
  const client = loadClient();
  assert.equal(client.localStorage.data.size, 0);
  assert.equal(client.sessionStorage.data.size, 0);
  client.setTokens({ access_token: 'access', refresh_token: 'refresh' });
  assert.equal(client.getAccessToken(), 'access');
  assert.equal(client.getRefreshToken(), 'refresh');
  assert.equal(client.localStorage.data.size, 0);
  assert.equal(client.sessionStorage.data.size, 0);
  assert.equal(loadClient().getAccessToken(), null);
  client.clearTokens();
  assert.equal(client.getAccessToken(), null);
  assert.equal(client.getRefreshToken(), null);
});

test('all nine jobs methods use the existing bearer client and correct organization-scoped paths', async () => {
  const requests = [];
  const client = loadClient(async (url, options) => { requests.push({ url, options }); return json({ id: 'job' }); });
  client.setTokens({ access_token: 'access', refresh_token: 'refresh' });
  await client.api.jobs.list('org', { limit: 20, offset: 0, q: 'A&B', status: 'open' });
  await client.api.jobs.summary('org');
  await client.api.jobs.get('org', 'job');
  await client.api.jobs.create('org', { title: 'Role', salary_min: '100.25' });
  await client.api.jobs.update('org', 'job', { title: 'Updated' });
  for (const action of ['publish', 'pause', 'close', 'archive']) await client.api.jobs[action]('org', 'job');
  assert.equal(requests.length, 9);
  assert.match(requests[0].url, /q=A%26B/);
  assert.equal(requests[1].url, '/api/v1/organizations/org/jobs/summary');
  assert.equal(requests[2].url, '/api/v1/organizations/org/jobs/job');
  assert.equal(JSON.parse(requests[3].options.body).salary_min, '100.25');
  assert.equal(requests[4].options.method, 'PATCH');
  for (const [index, action] of ['publish', 'pause', 'close', 'archive'].entries()) {
    assert.equal(requests[index + 5].url, `/api/v1/organizations/org/jobs/job/${action}`);
    assert.equal(requests[index + 5].options.method, 'POST');
  }
  assert.ok(requests.every(request => request.options.headers.Authorization === 'Bearer access'));
});

test('job requests retain single-flight automatic refresh without writing tokens to storage', async () => {
  let refreshes = 0;
  const client = loadClient(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(JSON.parse(options.body).refresh_token, 'refresh');
      return json({ access_token: 'renewed', refresh_token: 'rotated' });
    }
    return options.headers.Authorization === 'Bearer access' ? json({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }, 401) : json({ total: 0 });
  });
  client.setTokens({ access_token: 'access', refresh_token: 'refresh' });
  await Promise.all([client.api.jobs.list('org'), client.api.jobs.summary('org')]);
  assert.equal(refreshes, 1);
  assert.equal(client.getAccessToken(), 'renewed');
  assert.equal(client.getRefreshToken(), 'rotated');
  assert.equal(client.localStorage.data.size, 0);
});

test('job field errors use the existing envelope mapper', async () => {
  const client = loadClient(async () => json({ error: { code: 'VALIDATION_ERROR', message: 'Fix fields', details: [{ loc: ['body', 'salary_max'], msg: 'Maximum must exceed minimum' }] } }, 422));
  await assert.rejects(client.api.jobs.update('org', 'job', { salary_max: '1' }), error => {
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(client.fileFieldErrors(error).salary_max, 'Maximum must exceed minimum');
    return true;
  });
});

test('job form parses rupees/lakhs exactly and rejects ambiguous money', () => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/employer-job-form.jsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({}) });
  assert.equal(exports.parseJobMoney('₹22,00,000', 'salary_min'), '2200000.00');
  assert.equal(exports.parseJobMoney('₹22.01L', 'salary_min'), '2201000.00');
  assert.equal(exports.parseJobMoney('999999999999.99', 'salary_min'), '999999999999.99');
  assert.equal(exports.parseJobMoney('0.01', 'salary_min'), '0.01');
  assert.equal(exports.parseJobMoney('', 'salary_min'), null);
  for (const value of ['1.001', 'NaN', '1e5', 'about 22L', '-1']) assert.throws(() => exports.parseJobMoney(value, 'salary_min'));
});
