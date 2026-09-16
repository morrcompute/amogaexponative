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
  email: 'ask@morrai.com',
  password: '0un:ZX3JOs&E',
  smtp: {
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    requireTLS: true,
  },
  imap: {
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
  },
};
