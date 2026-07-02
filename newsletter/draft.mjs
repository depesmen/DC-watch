// Dépose la newsletter hebdomadaire en BROUILLON dans la boîte Gmail (via IMAP).
// Noémie relit puis envoie elle-même. Aucun envoi automatique.
// Secrets attendus (env) : GMAIL_USER, GMAIL_APP_PASSWORD (mot de passe d'application Google, IMAP activé).

import { readFile } from 'node:fs/promises';
import { ImapFlow } from 'imapflow';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

async function main() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD manquants.');

  const veille = JSON.parse(await readFile('data/veille.json', 'utf8'));
  const watchlist = JSON.parse(await readFile('data/watchlist.json', 'utf8').catch(() => '{}'));
  const { recipients = [] } = JSON.parse(await readFile('newsletter/recipients.json', 'utf8'));
  const list = recipients.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  // Sélection du contenu.
  const weekAgo = Date.now() - 8 * 24 * 3600 * 1000;
  const items = (veille.items || [])
    .map((it) => ({ ...it, ts: Date.parse((it.date || '').length === 7 ? it.date + '-15' : it.date) || 0 }))
    .sort((a, b) => b.ts - a.ts);
  const recent = items.filter((it) => it.ts >= weekAgo);
  const topItems = (recent.length ? recent : items).slice(0, 5);
  const takeaways = (veille.keyTakeaways || []).slice(0, 4);
  const companies = (watchlist.companies || [])
    .map((c) => ({ name: c.name, accent: c.accent, latest: (c.news || [])[0] }))
    .filter((c) => c.latest);

  const dateRange = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Luxembourg' }).format(new Date());
  const html = renderEmail({ takeaways, topItems, companies, dateRange, siteUrl: 'https://dc-watch.depesme-noemie.workers.dev' });

  // Construire le message MIME (destinataires internes pré-remplis en Cci).
  const mail = new MailComposer({
    from: `Data Center Watch <${GMAIL_USER}>`,
    to: GMAIL_USER,
    bcc: list.length ? list : undefined,
    subject: `DC Watch — ${dateRange}`,
    html,
  });
  const raw = await new Promise((res, rej) => mail.compile().build((err, msg) => (err ? rej(err) : res(msg))));

  // Déposer dans le dossier Brouillons (détection robuste FR/EN via special-use).
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }, logger: false });
  await client.connect();
  const boxes = await client.list();
  const drafts = boxes.find((b) => b.specialUse === '\\Drafts')?.path || '[Gmail]/Drafts';
  await client.append(drafts, raw, ['\\Draft']);
  await client.logout();
  console.log(`Brouillon déposé dans "${drafts}" (${list.length} destinataire(s) en Cci). Sujet : DC Watch — ${dateRange}`);
}

// ---- Rendu HTML (DA du site, compatible clients mail) ----
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderEmail({ takeaways, topItems, companies, dateRange, siteUrl }) {
  const CAT = { construction: 'Construction & Projets', land: 'Foncier & Transactions', power: 'Énergie & Réseau', legislation: 'Législation', market: 'État du marché', competition: 'Concurrence & Acteurs' };
  const ACCENT = { cyan: '#22d3ee', green: '#34d399', violet: '#a78bfa', pink: '#f472b6' };

  const takeawaysHtml = takeaways.map((t, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-bottom:14px;"><tr>
      <td width="30" valign="top"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="22" height="22" align="center" valign="middle" style="background:#22d3ee;border-radius:11px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#06131f;line-height:22px;">${i + 1}</td>
      </tr></table></td>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#eaf1f8;line-height:1.55;">${esc(t)}</td>
    </tr></table>`).join('');

  const itemsHtml = topItems.map((it) => `
    <tr><td style="padding:8px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121a28;border:1px solid #1f2a3a;border-radius:8px;"><tr><td style="padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.5px;color:#3b82f6;text-transform:uppercase;background:#0e1930;border:1px solid #23324d;border-radius:4px;padding:3px 8px;">${esc(CAT[it.category] || it.category)}</td>
        </tr></table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;padding-top:10px;line-height:1.35;">${esc(it.title)}</div>
        <div style="font-family:'Courier New',monospace;font-size:11px;color:#5f7186;padding-top:4px;">${esc(it.region)} · ${esc(it.date)}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#93a1b5;padding-top:8px;line-height:1.55;">${esc(it.summary)}</div>
        <div style="padding-top:10px;"><a href="${esc(it.url)}" style="font-family:'Courier New',monospace;font-size:12px;color:#22d3ee;text-decoration:none;">${esc(it.source)} →</a></div>
      </td></tr></table>
    </td></tr>`).join('');

  const companiesHtml = companies.map((c) => `
    <tr><td style="padding:8px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121a28;border:1px solid #1f2a3a;border-left:3px solid ${ACCENT[c.accent] || '#22d3ee'};border-radius:8px;"><tr><td style="padding:14px 18px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;padding-bottom:8px;">${esc(c.name)}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#c3ced9;line-height:1.5;"><span style="font-family:'Courier New',monospace;font-size:11px;color:#5f7186;">${esc(c.latest.date)} · </span>${esc(c.latest.title)} <a href="${esc(c.latest.url)}" style="color:#22d3ee;text-decoration:none;">· ${esc(c.latest.source)} →</a></div>
      </td></tr></table>
    </td></tr>`).join('');

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#070b12;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">L'essentiel de la semaine : foncier, énergie, législation et marché des data centers.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b12;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#0d1420;border:1px solid #1f2a3a;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px 28px;background:#0b1220;border-bottom:1px solid #1f2a3a;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;color:#22d3ee;text-transform:uppercase;">Data Center Watch</td>
          <td align="right" style="font-family:'Courier New',monospace;font-size:11px;color:#5f7186;">${esc(dateRange)}</td>
        </tr></table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#ffffff;padding-top:12px;line-height:1.25;">L'essentiel de la semaine</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#93a1b5;padding-top:6px;">Land + Power · construction, foncier, énergie, législation, marché</div>
      </td></tr>
      <tr><td style="padding:24px 28px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1c33;border:1px solid #22d3ee;border-radius:10px;">
          <tr><td style="padding:6px 20px;background:#22d3ee;border-radius:9px 9px 0 0;"><span style="font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;color:#06131f;text-transform:uppercase;font-weight:bold;">★ Les points clés de la semaine</span></td></tr>
          <tr><td style="padding:18px 20px 8px;">${takeawaysHtml}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 28px 4px;"><div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#5f7186;text-transform:uppercase;">// À la une</div></td></tr>
      ${itemsHtml}
      ${companiesHtml ? `<tr><td style="padding:16px 28px 4px;"><div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#5f7186;text-transform:uppercase;">// Concurrents &amp; Partenaires</div></td></tr>${companiesHtml}` : ''}
      <tr><td align="center" style="padding:20px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#2563eb;border-radius:8px;"><a href="${esc(siteUrl)}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Voir toute la veille →</a></td></tr></table></td></tr>
      <tr><td style="padding:20px 28px;background:#0b1220;border-top:1px solid #1f2a3a;"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5f7186;line-height:1.6;">Newsletter interne Data Center Watch.</div></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

main().catch((e) => { console.error(e); process.exit(1); });
