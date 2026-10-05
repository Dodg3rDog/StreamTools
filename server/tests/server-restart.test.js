const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

test('authenticated restart replaces the child and health reports a new instance', { timeout: 20000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamtools-restart-'));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  fs.copyFileSync(path.join(root, 'server.js'), path.join(dir, 'server.js'));
  fs.writeFileSync(path.join(dir, 'app.js'), `
    const express = require(${JSON.stringify(require.resolve('express'))});
    const app = express();
    app.use('/', require(${JSON.stringify(path.join(root, 'routes/health.js'))}));
    app.use('/api', require(${JSON.stringify(path.join(root, 'routes/health.js'))}));
    const server = app.listen(${port}, '127.0.0.1');
    app.locals.restartServer = () => {
      server.close(() => process.exit(75));
      setTimeout(() => process.exit(75), 1000).unref();
    };
  `);
  const launcher = fork(path.join(dir, 'server.js'), [], {
    env: { ...process.env, BEARER_TOKEN: 'test-only-token' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true
  });
  const base = `http://127.0.0.1:${port}`;
  async function waitHealth(oldId) {
    for (let i = 0; i < 80; i++) {
      try {
        const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) });
        const data = await response.json();
        if (data.ok && data.instanceId !== oldId) return data;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Server did not become healthy');
  }
  try {
    const first = await waitHealth();
    assert.equal(first.restartSupported, true);
    const denied = await fetch(`${base}/api/server/restart`, { method: 'POST' });
    assert.equal(denied.status, 401);
    assert.equal((await waitHealth()).instanceId, first.instanceId);
    const accepted = await fetch(`${base}/api/server/restart`, {
      method: 'POST', headers: { Authorization: 'Bearer test-only-token' }
    });
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).instanceId, first.instanceId);
    const second = await waitHealth(first.instanceId);
    assert.notEqual(second.instanceId, first.instanceId);
    assert.equal(second.restartSupported, true);
  } finally {
    const exited = once(launcher, 'exit');
    launcher.disconnect();
    await exited;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('restart refuses unsupported launchers', async () => {
  const express = require('express');
  const app = express();
  app.use('/api', require('../routes/health'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const previous = process.env.BEARER_TOKEN;
  process.env.BEARER_TOKEN = 'test-only-token';
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/server/restart`, {
      method: 'POST', headers: { Authorization: 'Bearer test-only-token' }
    });
    assert.equal(response.status, 503);
  } finally {
    if (previous === undefined) delete process.env.BEARER_TOKEN;
    else process.env.BEARER_TOKEN = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
