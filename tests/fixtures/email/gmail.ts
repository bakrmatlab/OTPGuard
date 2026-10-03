/** Fabricated Gmail-shaped fixtures. Not captured mail or validated service templates. */
export const syntheticGmail = (
  text = 'Login code: 003719',
  mimeType = 'text/plain',
  charset = 'utf-8',
) => {
  const bytes = Buffer.from(text, charset === 'iso-8859-1' ? 'latin1' : 'utf8');
  return {
    id: 'synthetic-message',
    internalDate: '995000',
    sizeEstimate: bytes.length,
    payload: {
      mimeType,
      filename: '',
      headers: [
        { name: 'Subject', value: 'Sign in to Synthetic Lantern' },
        { name: 'From', value: 'Synthetic Lantern <codes@mailer.example>' },
        { name: 'Date', value: 'Thu, 01 Jan 1970 00:00:00 +0000' },
        { name: 'Content-Type', value: `${mimeType}; charset=${charset}` },
      ],
      body: { size: bytes.length, data: bytes.toString('base64url') },
    },
  };
};
