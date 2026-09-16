import nodemailer from 'nodemailer';
import { defaultMailConfig, MailConfig } from './mail-config';

export function createMailerTransporter(customConfig?: Partial<MailConfig>) {
  const config = {
    ...defaultMailConfig,
    ...customConfig,
    smtp: {
      ...defaultMailConfig.smtp,
      ...(customConfig?.smtp || {}),
    },
  };

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    requireTLS: config.smtp.requireTLS,
    auth: {
      user: config.email,
      pass: config.password,
    },
  });
}

export const defaultTransporter = createMailerTransporter();
