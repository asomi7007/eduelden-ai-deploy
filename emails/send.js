// ACS Email sender — called from GitHub Actions workflow
// Usage: node emails/send.js
//
// Required env vars:
//   ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS,
//   STUDENT_EMAIL, STUDENT_ID, API_KEY, EVENT_ID

const crypto = require('crypto');

async function main() {
  const studentEmail = process.env.STUDENT_EMAIL;
  const studentId = process.env.STUDENT_ID;
  const apiKey = process.env.API_KEY;
  const eventId = process.env.EVENT_ID || 'default';
  const apimUrl = 'https://apim-eduelden-ai.azure-api.net';
  const azAccount = `${studentId}@eduelden.kr`;
  const azPassword = '!!ed7788';

  // Load the correct template
  const templateMap = {
    'powerbi-mcp-20260530': './powerbi-mcp',
  };
  const templatePath = templateMap[eventId] || './default';
  const template = require(templatePath);

  const { subject, html } = template.generate({
    studentId, apiKey, apimUrl, azAccount, azPassword,
  });

  // Parse ACS connection string
  const connStr = process.env.ACS_CONNECTION_STRING;
  const endpoint = connStr.match(/endpoint=([^;]+)/)[1].replace(/\/$/, '');
  const accessKey = connStr.match(/accesskey=(.*)/)[1];
  const host = endpoint.replace('https://', '');
  const sender = process.env.ACS_SENDER_ADDRESS;

  const body = JSON.stringify({
    senderAddress: sender,
    content: { subject, html },
    recipients: { to: [{ address: studentEmail }] },
  });

  // HMAC-SHA256 auth
  const url = new URL(`${endpoint}/emails:send?api-version=2023-03-31`);
  const dateStr = new Date().toUTCString();
  const contentHash = crypto.createHash('sha256').update(body).digest('base64');
  const pathAndQuery = url.pathname + url.search;
  const stringToSign = `POST\n${pathAndQuery}\n${dateStr};${host};${contentHash}`;
  const signature = crypto.createHmac('sha256', Buffer.from(accessKey, 'base64'))
    .update(stringToSign).digest('base64');

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'x-ms-date': dateStr,
      'x-ms-content-sha256': contentHash,
      'Authorization': `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      'Content-Type': 'application/json',
      'repeatability-request-id': crypto.randomUUID(),
      'repeatability-first-sent': dateStr,
    },
    body,
  });

  const result = await resp.text();
  console.log(`ACS Email response: HTTP ${resp.status}`);
  console.log(result);

  if (resp.status !== 202) {
    console.error(`Email send failed: HTTP ${resp.status} - ${result}`);
    process.exit(1);
  } else {
    console.log(`Email sent to ${studentEmail} via ACS`);
  }
}

main().catch((err) => {
  console.error('Email send error:', err);
  process.exit(1);
});
