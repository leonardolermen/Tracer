export const config = {
  port: process.env.PORT ?? '3000',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://traceflow:traceflow@localhost:5432/traceflow',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
}
