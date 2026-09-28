import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailNotificationPort } from '../../application/ports/email-notification.port';
import { buildWelcomeUserEmail } from './welcome-user.template';

@Injectable()
export class ResendEmailAdapter implements EmailNotificationPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private _client: Resend | null = null;

  constructor(private readonly config: ConfigService) {}

  private get client(): Resend {
    if (!this._client) {
      const apiKey = this.config.get<string>('RESEND_API_KEY');
      if (!apiKey) throw new Error('RESEND_API_KEY no está configurado');
      this._client = new Resend(apiKey);
    }
    return this._client;
  }

  private get from(): string {
    return this.config.get<string>('EMAIL_FROM') ?? 'no-reply@kairosnexo.com';
  }

  private get loginUrl(): string {
    return this.config.get<string>('APP_BASE_URL') ?? 'https://kairos-nexo-dev.web.app/';
  }

  async sendWelcomeUser(toEmail: string, initialPassword: string): Promise<void> {
    const { subject, html } = buildWelcomeUserEmail({
      toEmail,
      initialPassword,
      loginUrl: this.loginUrl,
    });

    const { error } = await this.client.emails.send({
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
