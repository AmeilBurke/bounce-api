const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

// Passed to ConfigModule so a missing variable stops the app at startup, not on first use
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return config;
}

// Comma separated in CORS_ORIGINS, e.g. "http://localhost:5173,http://192.168.1.95:5173"
export function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
