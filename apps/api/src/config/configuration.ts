import { join } from 'path';

export default () => {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const publicBaseUrl =
    process.env.PUBLIC_API_URL?.replace(/\/$/, '') ?? `http://localhost:${port}`;

  return {
  port,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES ?? '10', 10),
    devBypassEnabled: process.env.OTP_DEV_BYPASS === 'true',
  },
  sms: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
    senderId: process.env.AT_SENDER_ID,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
  },
  storage: {
    uploadDir: process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
    publicBaseUrl,
  },
};
};
