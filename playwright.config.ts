import { defineConfig, devices } from '@playwright/test';
import net from 'node:net';

const EXTERNAL_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;

async function isPortFree(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(startPort: number, attempts = 60): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }
  return startPort;
}

const requestedPort = Number(process.env.PLAYWRIGHT_PORT ?? '4300');
const PLAYWRIGHT_PORT = EXTERNAL_BASE_URL ? requestedPort : await findFreePort(requestedPort);
const BASE_URL = EXTERNAL_BASE_URL ?? `http://127.0.0.1:${PLAYWRIGHT_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  ...(EXTERNAL_BASE_URL
    ? {}
    : {
        webServer: {
          command: `npm run dev -- --host 127.0.0.1 --port ${PLAYWRIGHT_PORT} --strictPort`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
