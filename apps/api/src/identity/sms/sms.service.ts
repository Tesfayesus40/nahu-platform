import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Ported from nahu-buna-gebaya's src/modules/sms.service.js.
 *
 * Same behavior as the original: throws on genuine delivery failure rather
 * than swallowing it, because a caller that thinks an OTP was sent when it
 * wasn't leaves the user stuck with no way to log in.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: any = null;

  constructor(private readonly config: ConfigService) {}

  private getClient() {
    if (!this.client) {
      const apiKey = this.config.get<string>('sms.apiKey');
      const username = this.config.get<string>('sms.username');

      if (!apiKey || !username) {
        throw new Error(
          'AT_API_KEY and AT_USERNAME must be set to send SMS (see .env.example).',
        );
      }

      const AfricasTalking = require('africastalking')({ apiKey, username });
      this.client = AfricasTalking.SMS;
    }
    return this.client;
  }

  async sendOtpSms(phone: string, code: string): Promise<void> {
    const otpExpiresMinutes = this.config.get<number>('otp.expiresMinutes');
    const senderId = this.config.get<string>('sms.senderId');

    const sms = this.getClient();

    const message = `Nahu Platform: your login code is ${code}. It expires in ${otpExpiresMinutes} minutes. Do not share this code.`;

    const options: { to: string[]; message: string; from?: string } = {
      to: [phone],
      message,
    };

    // Only set 'from' when a real, registered Sender ID is configured.
    // Africa's Talking rejects unregistered Sender IDs outright
    // ("InvalidSenderId") -- omitting this lets AT use its default
    // sandbox/shared sender instead.
    if (senderId) {
      options.from = senderId;
    }

    const response = await sms.send(options);

    // Africa's Talking returns 200 even for numbers it couldn't actually
    // reach -- the real delivery status is per-recipient inside the body.
    const recipients = response?.SMSMessageData?.Recipients || [];
    const recipient = recipients[0];

    if (!recipient || !['Success', 'Sent', 'Queued'].includes(recipient.status)) {
      const reason = recipient?.status || 'Unknown error';
      throw new Error(`SMS delivery failed: ${reason}`);
    }
  }
}
