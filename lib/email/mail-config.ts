export interface MailConfig {
  email: string;
  password: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
}

export const defaultMailConfig: MailConfig = {
  email: process.env.MAIL_USER || process.env.SMTP_USER || process.env.IMAP_USER || 'ask@morrai.com',
  password: process.env.MAIL_PASS || process.env.SMTP_PASS || process.env.IMAP_PASS || '0un:ZX3JOs&E',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
  },
  imap: {
    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
  },
};
