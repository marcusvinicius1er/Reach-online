/**
 * Cloudflare Worker for secure form submission and admin authentication.
 * Proxy between frontend and Airtable API; credentials stay server-side.
 *
 * Environment variables (Cloudflare Dashboard → Worker → Settings → Variables):
 * - AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, AIRTABLE_TOKEN (Airtable API)
 * - ADMIN_PASSWORD (admin.html access, Secret)
 * - ALLOWED_ORIGIN (required in production) — one origin or comma-separated list, e.g.:
 *     https://online.reach.fitness
 *     https://online.reach.fitness,https://reach-online.pages.dev
 *   Do NOT use "*" — it allows any site to call this Worker and can cause high traffic/abuse.
 * - RATE_LIMIT_MAX_REQUESTS (optional, default 10), RATE_LIMIT_KV (optional KV namespace for rate limiting)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    if (path === '/admin/auth' && request.method === 'POST') {
      return handleAdminAuth(request, env);
    }

    if (path === '/submit' || path === '/' || path === '') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      return handleFormSubmission(request, env);
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    return handleFormSubmission(request, env);
  }
};

async function handleAdminAuth(request, env) {
  const origin = request.headers.get('Origin');
  try {
    const payload = await request.json();
    const providedPassword = payload.password || '';
    const adminPassword = env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return new Response(JSON.stringify({ error: 'Admin authentication not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
      });
    }

    const isValid = constantTimeCompare(providedPassword, adminPassword);
    if (isValid) {
      return new Response(JSON.stringify({ success: true, message: 'Authentication successful' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
      });
    }
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
    });
  }
}

function constantTimeCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getAllowedOrigins(env) {
  const raw = (env.ALLOWED_ORIGIN || '').trim();
  if (!raw) return [];
  return raw.split(',').map(o => o.trim()).filter(Boolean);
}

function isOriginAllowed(origin, env) {
  const allowed = getAllowedOrigins(env);
  if (allowed.length === 0) return false;
  return allowed.includes(origin);
}

function getRequestOrigin(request) {
  const o = request.headers.get('Origin');
  if (o) return o;
  const ref = request.headers.get('Referer');
  if (!ref) return '';
  try {
    return new URL(ref).origin;
  } catch {
    return '';
  }
}

async function handleFormSubmission(request, env) {
  const origin = getRequestOrigin(request);
  const allowed = getAllowedOrigins(env);

  // Require ALLOWED_ORIGIN to be set in production (no "*")
  if (allowed.length === 0) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: no allowed origins' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Reject requests without Origin/Referer (e.g. bots, curl) or from unknown domains
  if (!origin || !isOriginAllowed(origin, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
    });
  }

  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `rate_limit:${clientIP}`;
  const rateLimitMax = parseInt(env.RATE_LIMIT_MAX_REQUESTS || '10', 10);
  const rateLimitCount = await env.RATE_LIMIT_KV?.get(rateLimitKey) || '0';
  const count = parseInt(rateLimitCount, 10);

  if (count >= rateLimitMax) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
    });
  }

  if (env.RATE_LIMIT_KV) {
    await env.RATE_LIMIT_KV.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });
  }

  try {
    const contentType = request.headers.get('Content-Type') || '';
    let payload;
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData);
    } else {
      return new Response('Unsupported content type', { status: 400 });
    }

    const requiredFields = ['fullName', 'email', 'whatsapp'];
    const missingFields = requiredFields.filter(f => !payload[f] || !payload[f].trim());
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields', missing: missingFields }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
      });
    }

    const airtableBaseId = env.AIRTABLE_BASE_ID;
    const airtableTableId = env.AIRTABLE_TABLE_ID;
    const airtableToken = env.AIRTABLE_TOKEN;
    if (!airtableBaseId || !airtableTableId || !airtableToken) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
      });
    }

    const airtableRecord = {
      fields: {
        'Full Name': sanitizeString(payload.fullName),
        'Email': sanitizeString(payload.email),
        'WhatsApp': sanitizeString(payload.whatsapp),
        'Location': sanitizeString(payload.location || ''),
        'Goals': sanitizeString(payload.goals || ''),
        'Submitted At': payload.submittedAt || new Date().toISOString(),
        'Source Page': (payload.sourcePage && payload.sourcePage.trim()) || '',
        'Origin': origin
      }
    };

    const airtableAPIUrl = `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableId}`;
    const airtableResponse = await fetch(airtableAPIUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(airtableRecord)
    });

    if (!airtableResponse.ok) {
      const errorData = await airtableResponse.json().catch(() => ({}));
      throw new Error(`Airtable API ${airtableResponse.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Application submitted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to submit application. Please try again later.',
      details: env.ENVIRONMENT === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCORSHeaders(origin, env) }
    });
  }
}

function handleCORS(request, env) {
  const origin = request.headers.get('Origin');
  return new Response(null, { status: 204, headers: getCORSHeaders(origin, env) });
}

function getCORSHeaders(origin, env) {
  const allowed = getAllowedOrigins(env);
  // Only echo the request origin if it's in the allowed list; never use "*"
  const corsOrigin = (origin && allowed.length && isOriginAllowed(origin, env)) ? origin : (allowed[0] || '');
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '').substring(0, 1000);
}
