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

  const port = Number(config.smtp.port) || 465;
  const isSecure = port === 465 || config.smtp.secure === true;

  return nodemailer.createTransport({
    host: config.smtp.host || 'smtp.hostinger.com',
    port: port,
    secure: isSecure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

export const defaultTransporter = createMailerTransporter();
