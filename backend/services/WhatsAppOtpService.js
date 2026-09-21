const axios = require('axios');
require('dotenv').config();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Normalizes phone numbers to WhatsApp international format without leading +
 * (Defaults to country code 91 for standard 10-digit Indian mobile numbers)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return digits;
}

/**
 * Send WhatsApp OTP using Meta Cloud API
 * Uses the pre-approved AUTHENTICATION template 'hms_login_otp' with 1-tap Copy Code button.
 * 
 * @param {string} phone - Recipient phone number
 * @param {string} otp - 4 to 6 digit OTP
 * @param {string} [templateName='hms_login_otp'] - Approved template name
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendWhatsAppOtp(phone, otp, templateName = 'hms_login_otp') {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn('[WhatsAppOtpService] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env. Skipping WhatsApp send.');
    return { success: false, error: 'WhatsApp credentials not configured in environment.' };
  }

  const recipient = normalizePhoneNumber(phone);
  if (!recipient) {
    return { success: false, error: 'Invalid phone number format.' };
  }

  const cleanOtp = String(otp).trim();
  const url = `${WHATSAPP_API_URL}/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'en_US'
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: cleanOtp
            }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: cleanOtp
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const msgId = response.data?.messages?.[0]?.id;
    console.log(`✅ [WhatsApp OTP Delivered] To: ${recipient} | Code: ${cleanOtp} | Message ID: ${msgId}`);
    return { success: true, messageId: msgId, recipient };
  } catch (err) {
    const errData = err.response?.data?.error;
    console.error(`❌ [WhatsApp OTP Error] To: ${recipient} | Error:`, errData?.message || err.message);
    return {
      success: false,
      error: errData?.message || err.message,
      code: errData?.code,
      details: errData
    };
  }
}

module.exports = {
  sendWhatsAppOtp,
  normalizePhoneNumber
};
