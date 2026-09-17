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
  email:
    process.env.EXPO_PUBLIC_MAIL_USER ||
    process.env.MAIL_USER ||
    process.env.EXPO_PUBLIC_SMTP_USER ||
    process.env.SMTP_USER ||
    process.env.IMAP_USER ||
    'ask@morrai.com',
  password:
    process.env.EXPO_PUBLIC_MAIL_PASS ||
    process.env.MAIL_PASS ||
    process.env.EXPO_PUBLIC_SMTP_PASS ||
    process.env.SMTP_PASS ||
    process.env.IMAP_PASS ||
    '0un:ZX3JOs&E',
  smtp: {
    host:
      process.env.EXPO_PUBLIC_SMTP_HOST ||
      process.env.SMTP_HOST ||
      'smtp.hostinger.com',
    port: parseInt(
      process.env.EXPO_PUBLIC_SMTP_PORT || process.env.SMTP_PORT || '587',
      10
    ),
    secure:
      (process.env.EXPO_PUBLIC_SMTP_SECURE || process.env.SMTP_SECURE) === 'true',
    requireTLS:
      (process.env.EXPO_PUBLIC_SMTP_REQUIRE_TLS || process.env.SMTP_REQUIRE_TLS) !==
      'false',
  },
  imap: {
    host:
      process.env.EXPO_PUBLIC_IMAP_HOST ||
      process.env.IMAP_HOST ||
      'imap.hostinger.com',
    port: parseInt(
      process.env.EXPO_PUBLIC_IMAP_PORT || process.env.IMAP_PORT || '993',
      10
    ),
    secure:
      (process.env.EXPO_PUBLIC_IMAP_SECURE || process.env.IMAP_SECURE) !==
      'false',
  },
};
