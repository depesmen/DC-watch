const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Requête invalide.' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'Adresse email invalide.' }, 400);
  }

  if (!env.SUBSCRIBERS) {
    return jsonResponse({ error: 'Stockage des inscriptions non configuré.' }, 500);
  }

  const existing = await env.SUBSCRIBERS.get(email);
  if (!existing) {
    await env.SUBSCRIBERS.put(email, JSON.stringify({ subscribedAt: new Date().toISOString() }));
  }

  return jsonResponse({ ok: true });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
