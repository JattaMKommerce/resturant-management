/**
 * Outgoing email (password reset codes).
 *
 * Reads these environment variables, set in the hosting panel, never in the code:
 *   SMTP_HOST   e.g. smtp.gmail.com
 *   SMTP_PORT   465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER   the mailbox that sends, e.g. you@gmail.com
 *   SMTP_PASS   for Gmail this must be a 16-character App Password, not the normal password
 *   MAIL_FROM   optional display name and address, e.g. The Grand Palace <you@gmail.com>
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }
  return transporter;
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/**
 * Email a 6-digit password reset code.
 * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string }>}
 */
async function sendPasswordResetCode({ to, name, code, minutes = 10 }) {
  const mailer = getTransporter();
  if (!mailer) return { success: false, skipped: true, error: 'Email is not set up (SMTP_HOST / SMTP_USER / SMTP_PASS missing).' };

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const hello = name ? `Hi ${name},` : 'Hi,';
  const text = [
    hello,
    '',
    `Your password reset code is ${code}`,
    '',
    `It works for ${minutes} minutes and can be used once.`,
    'If you did not ask to reset your password, ignore this email. Your password stays the same.'
  ].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#eaf4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border:1px solid #d7e5e8;border-radius:16px;">
      <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:bold;">Reset your password</td></tr>
      <tr><td style="padding:0 28px;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(hello)}<br>Use this code to set a new password:</td></tr>
      <tr><td align="center" style="padding:22px 28px;">
        <div style="display:inline-block;padding:14px 26px;border-radius:12px;background:#f1f8f8;border:1px solid #3a7d7c;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1f2937;">${escapeHtml(code)}</div>
      </td></tr>
      <tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.6;color:#64748b;">
        It works for ${minutes} minutes and can be used once.<br>
        If you did not ask to reset your password, ignore this email. Your password stays the same.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  try {
    const info = await mailer.sendMail({ from, to, subject: `${code} is your password reset code`, text, html });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Never log the password or the code; the error text from the mail server is enough to fix set-up.
    return { success: false, error: err.message };
  }
}

/** Can we log in to the mail server? Used by /health/email so set-up can be checked without sending anything. */
async function checkMailServer() {
  const mailer = getTransporter();
  if (!mailer) return { configured: false, ready: false };
  try {
    await mailer.verify();
    return { configured: true, ready: true };
  } catch (err) {
    return { configured: true, ready: false, reason: err.code || err.responseCode || 'ERROR', detail: err.message };
  }
}

module.exports = { isMailConfigured, sendPasswordResetCode, checkMailServer };
