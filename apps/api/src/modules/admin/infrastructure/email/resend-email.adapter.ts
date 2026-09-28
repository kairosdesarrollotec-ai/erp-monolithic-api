import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailNotificationPort } from '../../application/ports/email-notification.port';
import { buildWelcomeUserEmail } from './welcome-user.template';

@Injectable()
export class ResendEmailAdapter implements EmailNotificationPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly loginUrl: string;

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.from = config.get<string>('EMAIL_FROM') ?? 'no-reply@kairosnexo.com';
    this.loginUrl = config.get<string>('APP_BASE_URL') ?? 'https://kairos-nexo-dev.web.app/';
  }

  async sendWelcomeUser(toEmail: string, initialPassword: string): Promise<void> {
    const { subject, html } = buildWelcomeUserEmail({
      toEmail,
      initialPassword,
      loginUrl: this.loginUrl,
    });

    const { error } = await this.resend.emails.send({
      from: this.from,
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      this.logger.error('Resend rejected welcome email', { toEmail, error });
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
