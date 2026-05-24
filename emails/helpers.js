// Common HTML helpers for email templates
const tbl = 'border="1" cellpadding="8" style="border-collapse:collapse;width:100%"';

const code = (t) =>
  `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:Consolas,monospace;font-size:13px">${t}</code>`;

const codeBox = (t) =>
  `<div style="background:#1e293b;border-radius:8px;padding:14px;margin:8px 0;overflow-x:auto"><code style="color:#e2e8f0;font-family:'Cascadia Code',Consolas,monospace;font-size:13px;line-height:1.6">${t}</code></div>`;

const codeBoxLink = (t, url) =>
  `<div style="background:#1e293b;border-radius:8px;padding:14px;margin:8px 0;overflow-x:auto"><code style="color:#e2e8f0;font-family:'Cascadia Code',Consolas,monospace;font-size:13px;line-height:1.6">${t.replace(url, `<a href="${url}" style="color:#93c5fd;text-decoration:underline">${url}</a>`)}</code></div>`;

const stepCircle = (n, bg) =>
  `<div style="width:28px;height:28px;background:${bg};border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:13px;color:#1a1a1a;display:inline-block">${n}</div>`;

module.exports = { tbl, code, codeBox, codeBoxLink, stepCircle };
