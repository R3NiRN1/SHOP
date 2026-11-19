// Minimal HTTP peer for exercising the checker's process/cookie/error handling.
import { createServer } from 'node:http';
const [port, scenario = 'normal'] = process.argv.slice(2);
if (scenario === 'exit') { console.error('Fixture startup failed'); process.exit(3); }
const preview = process.env.ENABLE_STARTER_CATALOG === 'true';
const json = (response, status, body, headers = {}) => { response.writeHead(status, { 'content-type': 'application/json', ...headers }); response.end(JSON.stringify(body)); };
const server = createServer(async (request, response) => {
  if (request.url === '/api/health') return json(response, 200, { ok: true, kind: 'liveness' });
  if (request.url === '/' || request.url === '/varieties') {
    response.writeHead(scenario === 'bad-page' ? 500 : 200, { 'content-type': 'text/html' });
    return response.end(`${request.url === '/' ? 'Seeds with stories.' : 'Seed varieties'} ${preview ? 'Development demo' : 'Published catalogue'}`);
  }
  if (request.url === '/api/ready') return json(response, preview || scenario === 'not-ready' ? 503 : 200, { ready: !preview && scenario !== 'not-ready', kind: 'readiness' });
  if (request.url === '/api/auth/csrf') return json(response, 200, { csrfToken: 'fixture-token' }, { 'set-cookie': 'fixture-csrf=fixture-token; Path=/' });
  if (request.url === '/api/auth/callback/credentials') {
    let text = '';
    for await (const chunk of request) text += chunk;
    const form = new URLSearchParams(text);
    if (!request.headers.cookie?.includes('fixture-csrf=fixture-token') || form.get('csrfToken') !== 'fixture-token' ||
        form.get('email') !== process.env.ADMIN_EMAIL || form.get('password') !== process.env.ADMIN_PASSWORD || scenario === 'bad-login') return json(response, 401, {});
    return json(response, 200, {}, { 'set-cookie': 'fixture-session=authenticated; Path=/' });
  }
  const signedIn = request.headers.cookie?.includes('fixture-session=authenticated');
  if (request.url === '/api/auth/session') return json(response, 200, signedIn ? { role: 'ADMIN', user: { email: process.env.ADMIN_EMAIL } } : {});
  if (request.url === '/api/admin/varieties') return json(response, signedIn ? 200 : 401, signedIn ? { varieties: [] } : {});
  json(response, 404, {});
});
server.listen(Number(port), '127.0.0.1', () => { if (scenario !== 'timeout') console.log('Ready in fixture'); });
