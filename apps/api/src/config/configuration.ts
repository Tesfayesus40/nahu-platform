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
  adminAuth: {
    accessTokenTtl: process.env.ADMIN_ACCESS_TOKEN_TTL ?? '15m',
    refreshAbsoluteHours: parseInt(process.env.ADMIN_REFRESH_ABSOLUTE_HOURS ?? '12', 10),
    refreshIdleMinutes: parseInt(process.env.ADMIN_REFRESH_IDLE_MINUTES ?? '30', 10),
    invitationTtlHours: parseInt(process.env.ADMIN_INVITATION_TTL_HOURS ?? '72', 10),
    mfaEncryptionKey: process.env.ADMIN_MFA_ENCRYPTION_KEY,
    failedLoginMax: parseInt(process.env.ADMIN_FAILED_LOGIN_MAX ?? '5', 10),
    failedLoginWindowMinutes: parseInt(
      process.env.ADMIN_FAILED_LOGIN_WINDOW_MINUTES ?? '15',
      10,
    ),
    reauthWindowMinutes: parseInt(process.env.ADMIN_REAUTH_WINDOW_MINUTES ?? '5', 10),
  },
};
};
