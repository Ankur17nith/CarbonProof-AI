import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z
    .string()
    .regex(/^\/[a-zA-Z0-9/_-]+$/)
    .default('/api/v1'),
  DATABASE_URL: z
    .string()
    .default('postgresql://carbonproof:carbonproof@localhost:5432/carbonproof?schema=public'),
  USE_IN_MEMORY: booleanFromEnv.default(true),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-me-please-1234567890'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  FILE_STORAGE_ROOT: z.string().default('./data/storage'),
  MAX_UPLOAD_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .max(104857600)
    .default(10 * 1024 * 1024),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  BLOCKCHAIN_ENABLED: booleanFromEnv.default(false),
  BLOCKCHAIN_RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  BLOCKCHAIN_CHAIN_ID: z.coerce.number().int().positive().default(31337),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().optional(),
  BLOCKCHAIN_SIGNER_PRIVATE_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['local', 'llm']).default('local'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  DEV_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let activeConfig: AppConfig | undefined;

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const parsed = envSchema.parse({ ...process.env, ...overrides });
  if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET.startsWith('development-only-')) {
    throw new Error('JWT_SECRET must be replaced in production.');
  }
  if (parsed.NODE_ENV === 'production' && parsed.USE_IN_MEMORY) {
    throw new Error('USE_IN_MEMORY must be false in production.');
  }
  activeConfig = parsed;
  return parsed;
}

export function getActiveConfig(): AppConfig {
  return activeConfig ?? loadConfig();
}
