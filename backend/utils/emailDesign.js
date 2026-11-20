'use strict';

// Shared email visual language: iRadiosGR / dark SwiftUI-inspired surfaces.
// Email clients do not support real SwiftUI or reliable backdrop blur, so the
// premium glass feeling is reproduced with nested table surfaces and inline CSS.
// Never depend on remote fonts or JavaScript to render transactional messages.

const DEFAULT_SITE = 'https://iradios.gr';
const ACCENT = '#CCFF00';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const BRAND_MARKER = 'data-iradios-email="v2"';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function siteOrigin() {
  const raw = String(process.env.FRONTEND_URL || DEFAULT_SITE).trim();
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return url.origin;
  } catch (_error) {}
  return DEFAULT_SITE;
}

function brandLogoUrl() {
  // Optionally use a stable public CDN for production transactional images.
  const source = String(process.env.EMAIL_ASSET_BASE_URL || siteOrigin()).trim();
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return url.origin + '/iradios-app-logo.png';
  } catch (_error) {}
  return siteOrigin() + '/iradios-app-logo.png';
}

function verifiedHref(value) {
  if (typeof value !== 'string') return '#';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '#';
  } catch (_error) { return '#'; }
}

const BUTTON_STYLE = [
  'background-color:#CCFF00', 'border:1px solid #CCFF00', 'border-radius:14px',
  'color:#071008!important', 'display:inline-block', 'font-family:' + FONT,
  'font-size:14px', 'font-weight:800', 'letter-spacing:.15px',
  'line-height:20px', 'padding:16px 26px', 'text-align:center',
  'text-decoration:none', '-webkit-text-size-adjust:none'
].join(';');

const OTP_STYLE = [
  'background-color:#0A0F16', 'border:1px solid #566B24', 'border-radius:18px',
  'color:#CCFF00', 'font-family:' + FONT, 'font-size:34px',
  'font-weight:800', 'letter-spacing:9px', 'line-height:48px',
  'padding:22px 12px', 'margin:24px 0', 'text-align:center'
].join(';');

// Existing templates use .btn and .otp-box. Inline those two crucial elements
// for Outlook and Gmail without losing per-message override styles.
function inlineLegacyControls(content) {
  return String(content ?? '').replace(/<(a|div)\b([^>]*\bclass=(["'])(btn|otp-box)\3[^>]*)>/gi,
    (original, tag, attributes, _quote, className) => {
      const essential = className === 'btn' ? BUTTON_STYLE : OTP_STYLE;
      const existing = attributes.match(/\bstyle=(["'])(.*?)\1/i);
      if (existing) {
        return '<' + tag + attributes.replace(existing[0],
          'style="' + essential + ';' + existing[2].replace(/"/g, '&quot;') + '"') + '>';
      }
      return '<' + tag + attributes + ' style="' + essential + '">';
    });
}

function actionButton(label, url) {
  const href = verifiedHref(url);
  if (href === '#') return '';
  return '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:26px 0 16px;">' +
    '<tr><td bgcolor="' + ACCENT + '" style="background:#CCFF00;border-radius:14px;">' +
    '<a href="' + escapeHtml(href) + '" target="_blank" style="' + BUTTON_STYLE + '">' +
    escapeHtml(label) + ' &nbsp;&#8594;</a></td></tr></table>';
}

function infoPanel(label, value, options = {}) {
  const highlight = options.highlight === true;
  return '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" ' +
    'style="margin:22px 0;border-collapse:separate;">' +
    '<tr><td style="padding:20px 22px;background:#0C121C;border:1px solid ' +
    (highlight ? '#53652C' : '#26303C') + ';border-radius:18px;">' +
    '<p style="margin:0 0 7px;color:#99A7B8;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">' +
    escapeHtml(label) + '</p><p style="margin:0;color:' + (highlight ? ACCENT : '#F6F8FD') +
    ';font-size:17px;font-weight:800;line-height:1.45;word-break:break-word;">' +
    escapeHtml(value) + '</p></td></tr></table>';
}

function renderBrandedEmail({
  content = '', preheader = '', category = 'IRADIOS NETWORK',
  headline = '', footerNote = '', showHomeLink = true
} = {}) {
  const origin = siteOrigin();
  const logo = brandLogoUrl();
  const body = inlineLegacyControls(content);
  const preview = escapeHtml(preheader || headline || 'Η νέα σου ενημέρωση από το iRadiosGR');
  const title = headline
    ? '<h1 style="color:#F6F8FF;font-family:' + FONT +
      ';font-size:28px;line-height:1.16;letter-spacing:-1.2px;font-weight:800;margin:14px 0 10px;">' +
      escapeHtml(headline) + '</h1>'
    : '';
  const safeFooter = footerNote ? '<p style="margin:12px 0 0;color:#8290A3;font-size:12px;line-height:19px;">' +
    escapeHtml(footerNote) + '</p>' : '';

  return '<!doctype html><html lang="el"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">' +
    '<title>iRadiosGR</title>' +
    '<style type="text/css">' +
    'body,table,td,p,a{font-family:' + FONT + ';}' +
    'body{margin:0!important;padding:0!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}' +
    'table{border-spacing:0;}img{border:0;outline:none;text-decoration:none;}' +
    'a{color:#CCFF00;} .email-body p{margin:0 0 17px;line-height:1.7;color:#C5CDD9;}' +
    '.email-body h3,.email-body h2{color:#F6F8FF;font-size:25px;line-height:1.25;letter-spacing:-.5px;margin:4px 0 18px;}' +
    '.email-body strong{color:#F6F8FF;} .email-body li{color:#C5CDD9;line-height:1.65;}' +
    '.email-body .neon-text{color:#CCFF00;}' +
    '.email-body .btn{background:#CCFF00;color:#071008!important;border-radius:14px;text-decoration:none;}' +
    '.email-body .otp-box{background:#0A0F16;border:1px solid #566B24;color:#CCFF00;border-radius:18px;}' +
    '@media only screen and (max-width:620px){.mail-outer{padding:18px 10px!important;}' +
    '.mail-card{border-radius:22px!important;}.mail-header{padding:29px 23px!important;}' +
    '.mail-body{padding:28px 22px 32px!important;}.mail-footer{padding:25px 22px!important;}' +
    '.email-body h3,.email-body h2{font-size:23px!important;}}' +
    '</style></head>' +
    '<body style="margin:0;padding:0;background-color:#080B12;color:#F6F8FF;">' +
    '<div style="display:none;font-size:1px;color:#080B12;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' +
    preview + '&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>' +
    '<table role="presentation" ' + BRAND_MARKER + ' border="0" cellpadding="0" cellspacing="0" width="100%" ' +
    'style="width:100%;background-color:#080B12;border-collapse:collapse;">' +
    '<tr><td align="center" class="mail-outer" style="padding:38px 14px 42px;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" ' +
    'style="max-width:600px;width:100%;border-collapse:separate;background-color:#111723;' +
    'border:1px solid #293340;border-radius:28px;overflow:hidden;" class="mail-card">' +
    '<tr><td height="4" bgcolor="#CCFF00" style="background:#CCFF00;font-size:0;line-height:0;height:4px;">&nbsp;</td></tr>' +
    '<tr><td class="mail-header" style="padding:38px 38px 34px;background-color:#16202D;' +
    'background-image:linear-gradient(125deg,#203142 0%,#141D2C 62%,#1B2821 100%);' +
    'border-bottom:1px solid #334052;">' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr>' +
    '<td valign="middle" style="width:100%;">' +
    '<a href="' + escapeHtml(origin) + '" style="text-decoration:none;" target="_blank">' +
    '<img src="' + escapeHtml(logo) +
    '" alt="iRadiosGR" width="174" style="display:block;width:174px;max-width:100%;height:auto;max-height:62px;object-fit:contain;">' +
    '</a></td>' +
    '<td valign="middle" align="right" style="white-space:nowrap;text-align:right;padding-left:8px;">' +
    '<span style="color:#C6D7E5;font-size:9px;letter-spacing:1.6px;font-weight:800;line-height:15px;">' +
    'RADIO<br>REIMAGINED</span></td></tr></table>' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:30px;">' +
    '<tr><td>' +
    '<span style="display:inline-block;padding:8px 12px;background-color:#27342F;' +
    'border:1px solid #44573D;border-radius:999px;color:#CCFF00;font-size:10px;' +
    'line-height:12px;letter-spacing:1.8px;font-weight:800;">' + escapeHtml(category) + '</span>' +
    title +
    '<p style="margin:14px 0 0;color:#9BAEC0;font-size:12px;line-height:19px;letter-spacing:.3px;">' +
    'Your sound. Your world. iRadiosGR.</p></td></tr></table></td></tr>' +
    '<tr><td class="mail-body email-body" style="padding:36px 38px 39px;color:#C5CDD9;' +
    'font-size:15px;line-height:1.7;background-color:#111723;">' + body + '</td></tr>' +
    '<tr><td class="mail-footer" style="padding:28px 38px 32px;background-color:#0D131D;border-top:1px solid #293340;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
    '<tr><td style="font-size:12px;letter-spacing:1px;color:#F6F8FF;font-weight:800;">' +
    'iRadios<span style="color:#CCFF00;">GR</span></td>' +
    '<td align="right" style="color:#8A97AA;font-size:10px;letter-spacing:1px;">DISCOVER · LISTEN · CONNECT</td></tr></table>' +
    '<p style="color:#96A3B4;font-size:12px;line-height:20px;margin:18px 0 0;">' +
    'Έλα πιο κοντά στη μουσική και τους σταθμούς που αγαπάς.</p>' +
    safeFooter +
    (showHomeLink ? '<p style="margin:14px 0 0;font-size:12px;"><a href="' +
      escapeHtml(origin) + '" style="color:#CCFF00;text-decoration:none;font-weight:700;">' +
      'Άνοιγμα iRadiosGR &#8599;</a></p>' : '') +
    '</td></tr></table>' +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin-top:20px;">' +
    '<tr><td align="center" style="color:#6E7D90;font-size:11px;line-height:19px;padding:0 16px;">' +
    '© iRadiosGR · Ένα οικοσύστημα της ILUMA Digital Agency.<br>' +
    'Αυτό το μήνυμα δημιουργήθηκε από την πλατφόρμα iRadiosGR. ' +
    'Μην απαντήσεις στο email αν προέρχεται από no-reply διεύθυνση.</td></tr></table>' +
    '</td></tr></table></body></html>';
}

function ensureBrandedEmail(html, options = {}) {
  if (typeof html === 'string' && html.includes(BRAND_MARKER)) return html;
  return renderBrandedEmail({ ...options, content: html || '' });
}

function plainTextContent(text) {
  return '<p>' + escapeHtml(text).replace(/\r?\n/g, '<br>') + '</p>';
}

module.exports = {
  ACCENT, BRAND_MARKER, escapeHtml, actionButton, infoPanel, renderBrandedEmail,
  ensureBrandedEmail, plainTextContent, verifiedHref, brandLogoUrl, siteOrigin
};
