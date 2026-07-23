// Dépose la newsletter hebdomadaire en BROUILLON dans la boîte Gmail (via IMAP).
// Design v3 : fond clair, titres sans-serif, vraies images d'articles (og:image) avec repli icône.
// Secrets attendus (env) : GMAIL_USER, GMAIL_APP_PASSWORD (mot de passe d'application Google, IMAP activé).

import { readFile } from 'node:fs/promises';
import { ImapFlow } from 'imapflow';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

const CAT = {
  construction: { label: 'Construction', emoji: '🏗️', color: '#2563eb', bg: '#eff6ff', bd: '#dbeafe' },
  land: { label: 'Foncier', emoji: '🏞️', color: '#059669', bg: '#ecfdf5', bd: '#a7f3d0' },
  power: { label: 'Énergie', emoji: '⚡', color: '#0e7490', bg: '#ecfeff', bd: '#a5f3fc' },
  legislation: { label: 'Législation', emoji: '⚖️', color: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  market: { label: 'État du marché', emoji: '📊', color: '#7c3aed', bg: '#f5f3ff', bd: '#ddd6fe' },
  competition: { label: 'Concurrence', emoji: '🤝', color: '#db2777', bg: '#fdf2f8', bd: '#fbcfe8' },
};
const FLAG = {
  'Amérique du Nord': '🇺🇸', 'Europe': '🇪🇺', 'Asie-Pacifique': '🌏', 'Monde': '🌍',
  'Allemagne': '🇩🇪', 'France': '🇫🇷', 'Émirats arabes unis': '🇦🇪', 'Moyen-Orient': '🌍',
  'Afrique': '🌍', 'Canada': '🇨🇦', 'Norvège': '🇳🇴',
};
const cat = (c) => CAT[c] || { label: c, emoji: '📰', color: '#0e7490', bg: '#f1f5f9', bd: '#e2e8f0' };
const flag = (r) => FLAG[r] || '🌍';

// Pages "agrégateur" : leur og:image ne correspond pas à l'actu précise → on force l'icône.
const AGG = ['new-data-center-developments', 'this-week-in-data-centers', 'weekly-data-centre-news', 'data-center-power-and-energy-news', 'data-centres-finding-net-new-power', 'blackridgeresearch.com/blog'];

async function main() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD manquants.');

  const veille = JSON.parse(await readFile('data/veille.json', 'utf8'));
  const watchlist = JSON.parse(await readFile('data/watchlist.json', 'utf8').catch(() => '{}'));
  const { recipients = [] } = JSON.parse(await readFile('newsletter/recipients.json', 'utf8'));
  const list = recipients.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  // Uniquement l'actualité des 7 derniers jours.
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const weekItems = (veille.items || [])
    .map((it) => ({ ...it, ts: itemTs(it.date) }))
    .filter((it) => it.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts);

  const TECH_KW = ['puce', 'chip', 'gpu', 'tpu', 'nvidia', 'amd', 'rubin', 'blackwell', 'hopper', 'trainium', 'ironwood', 'hbm', 'accélérat', 'refroidissement', 'immersion', 'tsmc', 'semiconduc', 'nvlink', 'cowos'];
  const isTech = (it) => TECH_KW.some((k) => `${it.title} ${it.summary}`.toLowerCase().includes(k));
  const nonTech = weekItems.filter((it) => !isTech(it));
  const techItemsRaw = weekItems.filter(isTech).slice(0, 3);

  // Récupérer les og:image (en parallèle, avec repli).
  const withImg = (items) => Promise.all(items.map(async (it) => ({ it, img: await ogImage(it.url) })));
  const nonTechImg = await withImg(nonTech.slice(0, 8));
  const techImg = await withImg(techItemsRaw);

  // "La Une" = 1re actu (top 3) qui a une belle image, sinon la toute première.
  const featured = nonTechImg.slice(0, 3).find((x) => x.img) || nonTechImg[0] || null;
  const listItems = nonTechImg.filter((x) => x !== featured).slice(0, 5);

  const takeaways = (veille.keyTakeaways || []).slice(0, 3);
  const companies = (watchlist.companies || [])
    .map((c) => ({ name: c.name, accent: c.accent, latest: (c.news || []).find((n) => itemTs(n.date) >= cutoff) }))
    .filter((c) => c.latest)
    .slice(0, 2);

  const dateRange = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Luxembourg' }).format(new Date());
  const html = renderEmail({ dateRange, featured, listItems, techItems: techImg, takeaways, companies, siteUrl: 'https://dc-watch.depesme-noemie.workers.dev' });

  const mail = new MailComposer({
    from: `Data Center Watch <${GMAIL_USER}>`,
    to: GMAIL_USER,
    bcc: list.length ? list : undefined,
    subject: `DC Watch — L'essentiel de la semaine (${dateRange})`,
    html,
  });
  const raw = await new Promise((res, rej) => mail.compile().build((err, msg) => (err ? rej(err) : res(msg))));

  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }, logger: false });
  await client.connect();
  const boxes = await client.list();
  const drafts = boxes.find((b) => b.specialUse === '\\Drafts')?.path || '[Gmail]/Drafts';
  await client.append(drafts, raw, ['\\Draft']);
  await client.logout();
  console.log(`Brouillon déposé dans "${drafts}" (${list.length} destinataire(s) en Cci). Une : ${featured?.it?.title || '—'}`);
}

function itemTs(date) {
  const d = String(date || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return Date.parse(d);
  if (/^\d{4}-\d{2}$/.test(d)) return Date.parse(d + '-28');
  return 0;
}

// Récupère l'og:image d'un article (repli null). Exclut les pages agrégateur.
async function ogImage(url) {
  try {
    if (!url || AGG.some((a) => url.includes(a))) return null;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DCWatchBot/1.0)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]*>/i);
    if (!m) return null;
    const c = m[0].match(/content=["']([^"']+)["']/i);
    let img = c && c[1] ? c[1].replace(/&amp;/g, '&').trim() : null;
    if (img && img.startsWith('//')) img = 'https:' + img;
    if (!img || !/^https?:\/\//i.test(img)) return null;
    return img;
  } catch { return null; }
}

// ---------- Rendu HTML (fond clair, sans-serif, images) ----------
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const SANS = "Arial,Helvetica,sans-serif";
const MONO = "'Courier New',monospace";

function badge(label, color, bg, bd) {
  return `<td style="font-family:${MONO};font-size:10.5px;color:${color};text-transform:uppercase;background:${bg};border:1px solid ${bd};border-radius:5px;padding:4px 10px;white-space:nowrap;">${label}</td>`;
}

function heroBlock(x) {
  const it = x.it, c = cat(it.category);
  const imgHtml = x.img
    ? `<tr><td style="padding:0;"><img src="${esc(x.img)}" alt="${esc(it.title)}" width="620" style="width:100%;max-width:620px;height:auto;display:block;border:0;"></td></tr>`
    : '';
  const pl = it.poweredLand
    ? `<td style="padding-left:8px;font-family:${MONO};font-size:10.5px;color:#b45309;text-transform:uppercase;background:#fef3c7;border:1px solid #fde68a;border-radius:5px;padding:4px 10px;white-space:nowrap;">⚡ Powered Land</td>`
    : '';
  return `
  <tr><td class="px" style="padding:24px 34px 6px;">
    <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:#b45309;text-transform:uppercase;padding-bottom:12px;">◆ La une de la semaine</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0;border-radius:14px;overflow:hidden;">
      ${imgHtml}
      <tr><td style="padding:20px 22px 22px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="padding-bottom:12px;"><tr>${badge(`${c.emoji} ${c.label}`, c.color, c.bg, c.bd)}${pl}</tr></table>
        <div style="font-family:${SANS};font-size:21px;font-weight:bold;color:#0f1b2d;line-height:1.35;letter-spacing:-0.3px;">${esc(it.title)}</div>
        <div style="font-family:${MONO};font-size:11.5px;color:#94a3b8;padding-top:8px;">${flag(it.region)} ${esc(it.region)} &nbsp;·&nbsp; ${esc(formatDate(it.date))}</div>
        <div style="font-family:${SANS};font-size:14.5px;color:#475569;padding-top:12px;line-height:1.65;">${esc(it.summary)}</div>
        <div style="padding-top:14px;"><a href="${esc(it.url)}" style="font-family:${MONO};font-size:12.5px;color:#0e7490;text-decoration:none;font-weight:bold;">Lire l'article →</a></div>
      </td></tr>
    </table>
  </td></tr>`;
}

function listRow(x, last) {
  const it = x.it, c = cat(it.category);
  const thumb = x.img
    ? `<img src="${esc(x.img)}" alt="" width="74" height="74" style="width:74px;height:74px;object-fit:cover;border-radius:12px;display:block;border:1px solid #e5e9f0;">`
    : `<div style="width:74px;height:74px;background:${c.bg};border:1px solid ${c.bd};border-radius:12px;text-align:center;line-height:74px;font-size:30px;">${c.emoji}</div>`;
  const divider = last ? '' : `<tr><td class="px" style="padding:0 34px;"><div style="border-top:1px solid #eef1f5;height:1px;line-height:1px;">&nbsp;</div></td></tr>`;
  return `
  <tr><td class="px" style="padding:12px 34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="86" valign="top">${thumb}</td>
      <td style="padding-left:14px;">
        <div style="font-family:${MONO};font-size:10.5px;color:${c.color};text-transform:uppercase;letter-spacing:0.4px;">${c.label} &nbsp;·&nbsp; ${flag(it.region)} ${esc(it.region)}${it.poweredLand ? ' &nbsp;·&nbsp; <span style="color:#b45309;">⚡</span>' : ''}</div>
        <div style="font-family:${SANS};font-size:16px;font-weight:bold;color:#0f1b2d;padding-top:4px;line-height:1.4;">${esc(it.title)}</div>
        <div style="font-family:${SANS};font-size:13.5px;color:#64748b;padding-top:6px;line-height:1.6;">${esc(it.summary)}</div>
        <div style="padding-top:8px;"><a href="${esc(it.url)}" style="font-family:${MONO};font-size:12px;color:#0e7490;text-decoration:none;">${esc(it.source)} →</a></div>
      </td>
    </tr></table>
  </td></tr>${divider}`;
}

function renderEmail({ dateRange, featured, listItems, techItems, takeaways, companies, siteUrl }) {
  const takeawaysHtml = takeaways.map((t, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-bottom:15px;"><tr>
      <td width="34" valign="top"><div style="width:26px;height:26px;background:#06b6d4;border-radius:13px;text-align:center;line-height:26px;font-family:${SANS};font-size:13px;font-weight:bold;color:#ffffff;">${i + 1}</div></td>
      <td style="font-family:${SANS};font-size:14.5px;color:#1e293b;line-height:1.6;">${esc(t)}</td>
    </tr></table>`).join('');

  const listHtml = listItems.map((x, i) => listRow(x, i === listItems.length - 1 && !techItems.length)).join('');

  const techHtml = techItems.length
    ? `<tr><td class="px" style="padding:24px 34px 6px;"><div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">🔬 Technologies</div></td></tr>`
      + techItems.map((x, i) => listRow(x, i === techItems.length - 1)).join('')
    : '';

  const companiesHtml = companies.length
    ? `<tr><td class="px" style="padding:24px 34px 4px;"><div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">🎯 Concurrents &amp; Partenaires</div></td></tr>`
      + companies.map((c) => {
        const col = { cyan: '#06b6d4', green: '#059669', violet: '#7c3aed', pink: '#db2777' }[c.accent] || '#06b6d4';
        return `<tr><td class="px" style="padding:12px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e5e9f0;border-left:4px solid ${col};border-radius:12px;"><tr><td style="padding:16px 20px;">
            <div style="font-family:${SANS};font-size:15px;font-weight:bold;color:#0f1b2d;">${esc(c.name)}</div>
            <div style="font-family:${SANS};font-size:13px;color:#475569;padding-top:6px;line-height:1.55;"><span style="font-family:${MONO};font-size:11px;color:#94a3b8;">${esc(formatDate(c.latest.date))} · </span>${esc(c.latest.title)} <a href="${esc(c.latest.url)}" style="color:#0e7490;text-decoration:none;">→</a></div>
          </td></tr></table>
        </td></tr>`;
      }).join('')
    : '';

  const emptyHtml = (!featured && !listItems.length)
    ? `<tr><td class="px" style="padding:24px 34px;"><div style="font-family:${SANS};font-size:15px;color:#64748b;">Pas d'actualité majeure cette semaine.</div></td></tr>`
    : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="light">
<style>
  @media only screen and (max-width:600px){
    .wrap{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
  }
</style></head>
<body style="margin:0;padding:0;background:#e9edf2;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">L'essentiel de la semaine — land + power, foncier énergisé, énergie, législation et marché des data centers.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf2;padding:28px 14px;"><tr><td align="center">
    <table role="presentation" width="620" class="wrap" cellpadding="0" cellspacing="0" style="width:620px;max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

      <tr><td class="px" style="padding:28px 34px 22px;border-bottom:1px solid #eef1f5;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;"><div style="width:34px;height:34px;border-radius:9px;background:#06b6d4;text-align:center;line-height:34px;font-size:18px;color:#fff;">▦</div></td>
          <td>
            <div style="font-family:${MONO};font-size:13px;letter-spacing:3px;color:#0e7490;font-weight:bold;">DC WATCH</div>
            <div style="font-family:${MONO};font-size:10px;letter-spacing:1px;color:#94a3b8;">VEILLE LAND + POWER</div>
          </td>
        </tr></table>
        <div style="font-family:${SANS};font-size:28px;font-weight:bold;color:#0f1b2d;padding-top:20px;line-height:1.2;letter-spacing:-0.5px;">L'essentiel de la semaine</div>
        <div style="font-family:${SANS};font-size:14px;color:#64748b;padding-top:7px;">Construction · Foncier · Énergie · Législation · Marché</div>
        <div style="font-family:${MONO};font-size:12px;color:#94a3b8;padding-top:12px;">📅 Semaine du ${esc(dateRange)}</div>
      </td></tr>

      ${featured ? heroBlock(featured) : ''}
      ${emptyHtml}

      ${takeaways.length ? `
      <tr><td class="px" style="padding:24px 34px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;">
          <tr><td style="padding:8px 22px;background:#06b6d4;border-radius:11px 11px 0 0;"><span style="font-family:${MONO};font-size:12px;letter-spacing:2px;color:#ffffff;text-transform:uppercase;font-weight:bold;">★ Les points clés de la semaine</span></td></tr>
          <tr><td style="padding:20px 22px 8px;">${takeawaysHtml}</td></tr>
        </table>
      </td></tr>` : ''}

      ${listHtml ? `<tr><td class="px" style="padding:26px 34px 6px;"><div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">📡 Le reste de l'actu</div></td></tr>${listHtml}` : ''}
      ${techHtml}
      ${companiesHtml}

      <tr><td align="center" class="px" style="padding:26px 34px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#06b6d4;border-radius:10px;"><a href="${esc(siteUrl)}" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Explorer toute la veille →</a></td></tr></table>
      </td></tr>

      <tr><td class="px" style="padding:22px 34px;background:#f8fafc;border-top:1px solid #eef1f5;">
        <div style="font-family:${SANS};font-size:12px;color:#94a3b8;line-height:1.7;">Newsletter interne <b style="color:#64748b;">Data Center Watch</b> — synthèse hebdomadaire land + power.<br>Sources citées pour chaque information.</div>
      </td></tr>

    </table>
  </td></tr></table>
</body></html>`;
}

function formatDate(iso) {
  const d = String(iso || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (/^\d{4}-\d{2}$/.test(d)) { const [y, m] = d.split('-'); return new Date(`${d}-01`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); }
  return d;
}

main().catch((e) => { console.error(e); process.exit(1); });
