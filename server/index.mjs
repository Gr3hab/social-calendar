import { createAuthServer } from './authServer.mjs';

let runtime;

async function start() {
  runtime = await createAuthServer();
  const { server, config } = runtime;

  server.on('error', (error) => {
    console.error('[auth-api] server error', error);
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    console.log(
      `[auth-api] listening on http://${config.host}:${config.port} (authStore=${config.store}, dataStore=${config.dataStore}, sms=${config.smsProvider})`,
    );
  });
}

async function shutdown(signal) {
  if (signal) {
    console.log(`[auth-api] shutdown requested (${signal})`);
  }

  if (!runtime) {
    return;
  }

  try {
    await runtime.close();
    console.log('[auth-api] stopped');
  } catch (error) {
    console.error('[auth-api] shutdown error', error);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT').finally(() => process.exit());
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => process.exit());
});

start().catch((error) => {
  console.error('[auth-api] failed to start', error);
  process.exit(1);
});
