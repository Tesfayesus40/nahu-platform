export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
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
  },
  sms: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
    // No fallback on purpose: an unregistered Sender ID causes Africa's
    // Talking to reject the message outright. Leave unset until a real
    // Sender ID is registered and approved.
    senderId: process.env.AT_SENDER_ID,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Ported from advisory.service.js, which used 'claude-sonnet-4-5' --
    // updated to the current Sonnet model. Override via env if needed.
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
  },
});
