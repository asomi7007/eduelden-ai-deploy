'use strict';

const crypto = require('crypto');

/**
 * Azure Communication Services 이메일 발송 (HMAC-SHA256 인증).
 * 환경변수: ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS
 * @param {string} toAddress 수신 이메일
 * @param {string} subject 제목
 * @param {string} html 본문 HTML
 * @returns {Promise<{status:number, result:string}>}
 */
async function sendEmail(toAddress, subject, html) {
  const connStr = process.env.ACS_CONNECTION_STRING;
  const sender = process.env.ACS_SENDER_ADDRESS;
  if (!connStr || !sender) {
    throw new Error('ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS 환경변수가 설정되지 않았습니다.');
  }

  const endpoint = connStr.match(/endpoint=([^;]+)/)[1].replace(/\/$/, '');
  const accessKey = connStr.match(/accesskey=(.*)/i)[1];
  const host = endpoint.replace('https://', '');

  const body = JSON.stringify({
    senderAddress: sender,
    content: { subject, html },
    recipients: { to: [{ address: toAddress }] },
  });

  const url = new URL(`${endpoint}/emails:send?api-version=2023-03-31`);
  const dateStr = new Date().toUTCString();
  const contentHash = crypto.createHash('sha256').update(body).digest('base64');
  const pathAndQuery = url.pathname + url.search;
  const stringToSign = `POST\n${pathAndQuery}\n${dateStr};${host};${contentHash}`;
  const signature = crypto
    .createHmac('sha256', Buffer.from(accessKey, 'base64'))
    .update(stringToSign)
    .digest('base64');

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'x-ms-date': dateStr,
      'x-ms-content-sha256': contentHash,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      'Content-Type': 'application/json',
      'repeatability-request-id': crypto.randomUUID(),
      'repeatability-first-sent': dateStr,
    },
    body,
  });

  const result = await resp.text();
  return { status: resp.status, result };
}

module.exports = { sendEmail };
