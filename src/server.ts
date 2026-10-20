import { createApp } from './app.js';

const context = await createApp();
const server = context.app.listen(context.config.PORT, () => {
  context.app.locals.logger?.info?.({ port: context.config.PORT }, 'CarbonProof AI API started');
  process.stdout.write(`CarbonProof AI API listening on http://localhost:${context.config.PORT}\n`);
});

function shutdown(signal: string): void {
  process.stdout.write(`Received ${signal}; shutting down.\n`);
  server.close(() => process.exit(0));
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
