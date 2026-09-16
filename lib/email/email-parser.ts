import { simpleParser } from 'mailparser';

export async function parseEmail(source: Buffer, seq: number, isRead: boolean) {
  const parsed = await simpleParser(source);

  let fromAddress = '';
  let fromName = '';
  const fromObj = parsed.from as any;
  if (fromObj && fromObj.value && fromObj.value.length > 0) {
    const fromVal = fromObj.value[0];
    fromAddress = fromVal.address || '';
    fromName = fromVal.name || fromVal.address || '';
  } else if ((parsed.from as any)?.text) {
    fromAddress = (parsed.from as any).text;
    fromName = (parsed.from as any).text;
  }

  let toAddress = '';
  const toObj = parsed.to as any;
  if (toObj && toObj.value && toObj.value.length > 0) {
    const toVal = toObj.value[0];
    toAddress = toVal.address || toVal.name || '';
  } else if ((parsed.to as any)?.text) {
    toAddress = (parsed.to as any).text;
  }

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const attachments = (parsed.attachments || []).map((att: any, idx: number) => {
    const mimeType = att.contentType || 'application/octet-stream';
    let fileUrl = '';
    const formattedSize = formatSize(att.size || (att.content ? att.content.length : 0));

    if (att.content) {
      try {
        const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content);
        fileUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      } catch (err) {
        console.error('Error processing attachment:', err);
      }
    }

    return {
      id: `att-${seq}-${idx}`,
      name: att.filename || `attachment-${idx + 1}`,
      type: (att.filename || '').split('.').pop()?.toUpperCase() || mimeType,
      size: formattedSize,
      url: fileUrl,
    };
  });

  const parsedDate = parsed.date ? new Date(parsed.date) : new Date();

  return {
    id: String(seq),
    from: fromAddress,
    fromName: fromName || fromAddress || 'Unknown Sender',
    to: toAddress,
    subject: parsed.subject || '(No Subject)',
    date: parsedDate.toISOString(),
    text: parsed.text || '',
    html: parsed.html || parsed.textAsHtml || '',
    isRead: isRead,
    attachments: attachments,
  };
}
