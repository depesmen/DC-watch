// Désinscription RGPD : GET /api/unsubscribe?e=<email>&t=<jeton>
// Le jeton est un HMAC-SHA256(email) signé avec UNSUB_SECRET (le même que le Worker d'envoi).

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';

  if (!email || !token || !env.UNSUB_SECRET) {
    return page("Lien invalide", "Ce lien de désinscription est incomplet.");
  }

  const expected = await sign(email, env.UNSUB_SECRET);
  if (!timingSafeEqual(token, expected)) {
    return page("Lien invalide", "Ce lien de désinscription n'est pas valide ou a expiré.");
  }

  if (env.SUBSCRIBERS) {
    await env.SUBSCRIBERS.delete(email);
  }
  return page("Désinscription confirmée", `L'adresse <strong>${escapeHtml(email)}</strong> ne recevra plus la newsletter. À bientôt.`);
}

async function sign(email, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function page(title, message) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>
  <style>body{margin:0;background:#070b12;color:#e6edf5;font-family:Inter,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#0d1420;border:1px solid #1f2a3a;border-radius:12px;padding:36px 40px;max-width:440px;text-align:center}
  h1{font-size:20px;margin:0 0 12px}p{color:#93a1b5;line-height:1.6;margin:0 0 20px}a{color:#22d3ee;text-decoration:none;font-size:14px}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${message}</p><a href="/">← Retour au tableau de bord</a></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
