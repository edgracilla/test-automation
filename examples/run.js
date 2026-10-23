// Starts the example API on a free port, runs the example features against it, then stops it.
// Extra arguments go to cucumber-js, e.g. `pnpm test:example --tags @crud`.
import { spawn } from 'node:child_process';
import { EXAMPLE_REPORTS_KEY, EXAMPLE_USERS, startMockServer } from './mock-server.js';

const server = await startMockServer();

const env = {
  ...process.env,
  TEST_CONFIG: 'examples/example.config.js',
  EXAMPLE_API_URL: server.url,
  EXAMPLE_ADMIN_USER: EXAMPLE_USERS.admin.username,
  EXAMPLE_ADMIN_PASSWORD: EXAMPLE_USERS.admin.password,
  EXAMPLE_VIEWER_USER: EXAMPLE_USERS.viewer.username,
  EXAMPLE_VIEWER_PASSWORD: EXAMPLE_USERS.viewer.password,
  EXAMPLE_REPORTS_KEY,
};

const child = spawn('cucumber-js', ['--profile', 'example', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', async code => {
  await server.close();
  process.exit(code ?? 1);
});
