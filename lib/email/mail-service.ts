import { createImapClient } from './imap';
import { createMailerTransporter } from './mailer';
import { parseEmail } from './email-parser';
import { defaultMailConfig, MailConfig } from './mail-config';

export interface SendEmailPayload {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: string; // base64 string
    contentType?: string;
    path?: string;
  }>;
  customConfig?: Partial<MailConfig>;
}

export interface FetchMailOptions {
  page?: number;
  limit?: number;
  customConfig?: Partial<MailConfig>;
}

export async function getInboxEmails(options: FetchMailOptions = {}) {
  const { page = 1, limit = 20, customConfig } = options;
  const client = createImapClient(customConfig);
  let totalMessages = 0;
  let hasMore = false;
  const emailsList: any[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const status = await client.status('INBOX', { messages: true });
      totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        const offset = (page - 1) * limit;
        const endSeq = Math.max(0, totalMessages - offset);
        const startSeq = Math.max(1, endSeq - limit + 1);

        if (endSeq >= 1) {
          const range = `${startSeq}:${endSeq}`;
          hasMore = startSeq > 1;

          for await (const message of client.fetch(range, { source: true, flags: true })) {
            const isRead = message.flags && message.flags.has('\\Seen');
            try {
              const parsed = await parseEmail(message.source as Buffer, message.seq, !!isRead);
              emailsList.push(parsed);
            } catch (parseErr) {
              console.error(`Failed to parse email sequence ${message.seq}:`, parseErr);
            }
          }

          emailsList.reverse();
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return {
      success: true,
      emails: emailsList,
      hasMore,
      total: totalMessages,
      page,
      limit,
    };
  } catch (error: any) {
    console.error('Error fetching inbox via IMAP:', error);
    try {
      await client.logout();
    } catch (_) {}
    return {
      success: false,
      message: `Failed to load inbox emails: ${error.message || error}`,
      emails: [],
    };
  }
}

export async function getSentEmails(options: FetchMailOptions = {}) {
  const { page = 1, limit = 20, customConfig } = options;
  const client = createImapClient(customConfig);
  let totalMessages = 0;
  let hasMore = false;
  const emailsList: any[] = [];

  try {
    await client.connect();
    let mailboxName = 'INBOX.Sent';
    let lock: any;

    try {
      lock = await client.getMailboxLock(mailboxName);
    } catch (_) {
      mailboxName = 'Sent';
      lock = await client.getMailboxLock(mailboxName);
    }

    try {
      const status = await client.status(mailboxName, { messages: true });
      totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        const offset = (page - 1) * limit;
        const endSeq = Math.max(0, totalMessages - offset);
        const startSeq = Math.max(1, endSeq - limit + 1);

        if (endSeq >= 1) {
          const range = `${startSeq}:${endSeq}`;
          hasMore = startSeq > 1;

          for await (const message of client.fetch(range, { source: true, flags: true })) {
            try {
              const parsed = await parseEmail(message.source as Buffer, message.seq, true);
              emailsList.push({
                ...parsed,
                isSent: true,
              });
            } catch (parseErr) {
              console.error(`Failed to parse sent email sequence ${message.seq}:`, parseErr);
            }
          }

          emailsList.reverse();
        }
      }
    } finally {
      if (lock) lock.release();
    }

    await client.logout();

    return {
      success: true,
      emails: emailsList,
      hasMore,
      total: totalMessages,
      page,
      limit,
    };
  } catch (error: any) {
    console.error('Error fetching sent emails via IMAP:', error);
    try {
      await client.logout();
    } catch (_) {}
    return {
      success: false,
      message: `Failed to load sent emails: ${error.message || error}`,
      emails: [],
    };
  }
}

export async function sendEmail(payload: SendEmailPayload) {
  const { to, subject, html, text, attachments = [], customConfig } = payload;
  const config = { ...defaultMailConfig, ...customConfig };
  const transporter = createMailerTransporter(customConfig);

  const formattedAttachments = attachments.map((att) => {
    let rawContent = att.content || '';
    if (rawContent.includes(';base64,')) {
      rawContent = rawContent.split(';base64,').pop() || '';
    }
    return {
      filename: att.filename,
      contentType: att.contentType || 'application/octet-stream',
      content: rawContent ? Buffer.from(rawContent, 'base64') : undefined,
      path: att.path,
    };
  });

  const mailOptions: any = {
    from: payload.from || `"${config.email.split('@')[0]}" <${config.email}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text: text || html?.replace(/<[^>]*>?/gm, '') || '',
    html: html || text || '',
  };

  if (formattedAttachments.length > 0) {
    mailOptions.attachments = formattedAttachments;
  }

  try {
    const info = await transporter.sendMail(mailOptions);

    // Save copy to INBOX.Sent via IMAP if possible
    try {
      const MailComposer = require('nodemailer/lib/mail-composer');
      const composer = new MailComposer(mailOptions);
      const rawMimeBuffer = await composer.compile().build();

      const client = createImapClient(customConfig);
      await client.connect();
      await client.append('INBOX.Sent', rawMimeBuffer, ['\\Seen']);
      await client.logout();
    } catch (imapErr) {
      console.warn('Could not append sent copy to IMAP INBOX.Sent:', imapErr);
    }

    return {
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: `Failed to send email: ${error.message || error}`,
    };
  }
}

export async function testSmtpConnection(customConfig?: Partial<MailConfig>) {
  try {
    const transporter = createMailerTransporter(customConfig);
    await transporter.verify();
    return {
      success: true,
      message: 'SMTP connection verified successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `SMTP verification failed: ${error.message || error}`,
    };
  }
}
