/** Binary data-room calls must use the same auth/refresh/error pipeline as JSON. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function loadClient(fetch) {
  const tokens = new Map([['forma.access_token', 'old-access'], ['forma.refresh_token', 'old-refresh']]);
  const exports = {};
  const sandbox = { exports, process: { env: {} }, fetch, Blob, Response, URLSearchParams, Event, AbortController, setTimeout, clearTimeout, window: { localStorage: { getItem: key => tokens.get(key) ?? null, setItem: (key, value) => tokens.set(key, value), removeItem: key => tokens.delete(key) }, dispatchEvent() {} } };
  const code = ts.transpileModule(readFileSync(path.join(__dirname, '../lib/api/client.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, sandbox);
  return { ...exports, tokens };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('protected bytes survive a 401 refresh/retry without JSON decoding', async () => {
  const calls = [];
  const bytes = Buffer.from('%PDF-1.7\nprotected\n%%EOF');
  const { api, tokens } = loadClient(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/refresh')) return json({ access_token: 'new-access', refresh_token: 'new-refresh' });
    if (options.headers.Authorization === 'Bearer old-access') return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
  });
  const result = await api.dataRooms.content('doc-id', 'version-id');
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
  assert.equal(result.type, 'application/pdf');
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, '/api/v1/data-room-documents/doc-id/content?version_id=version-id');
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[2].options.headers.Authorization, 'Bearer new-access');
  assert.equal(tokens.get('forma.refresh_token'), 'new-refresh');
});
test('NDA bytes map backend errors through ApiError, not an empty Blob', async () => {
  const { api, ApiError } = loadClient(async () => json({ error: { code: 'NDA_MISMATCH', message: 'Pinned agreement changed', details: [{ loc: ['body', 'nda_checksum'], msg: 'Mismatch' }] } }, 409));
  await assert.rejects(api.dataRoomAccess.nda('request-id'), error => error instanceof ApiError && error.status === 409 && error.code === 'NDA_MISMATCH' && error.details[0].loc[1] === 'nda_checksum');
});
test('binary and JSON calls share one in-flight refresh', async () => {
  let refreshes = 0;
  const { api } = loadClient(async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise(resolve => setTimeout(resolve, 20)); return json({ access_token: 'new', refresh_token: 'rotated' }); }
    if (options.headers.Authorization === 'Bearer old-access') return json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401);
    return url.includes('nda-content') ? new Response('nda') : json({ items: [], total: 0, limit: 20, offset: 0 });
  });
  const [blob, page] = await Promise.all([api.dataRoomAccess.nda('request-id'), api.dataRoomAccess.list({ startup_org_id: 'startup-id' })]);
  assert.equal(await blob.text(), 'nda'); assert.equal(page.total, 0); assert.equal(refreshes, 1);
});
test('mutations send only explicit action payloads and keep validation details', async () => {
  let sent;
  const { api, ApiError } = loadClient(async (url, options) => { sent = JSON.parse(options.body); return json({ detail: [{ loc: ['body', 'scope'], msg: 'Choose a folder', type: 'value_error' }] }, 422); });
  await assert.rejects(api.dataRoomAccess.decide('org', 'request', { action: 'approve', scope: [] }), error => error instanceof ApiError && error.status === 422 && error.details[0].msg === 'Choose a folder');
  assert.deepEqual(sent, { action: 'approve', scope: [] });
});
