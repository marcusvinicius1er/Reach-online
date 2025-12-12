/**
 * Cloudflare Worker for secure form submission
 * 
 * This worker acts as a proxy between the frontend and Airtable webhook,
 * keeping sensitive URLs and tokens server-side.
 * 
 * Environment Variables (set in Cloudflare Dashboard):
 * - AIRTABLE_WEBHOOK_URL: The Airtable webhook URL
 * - ALLOWED_ORIGIN: Your domain (e.g., https://yourdomain.com) for CORS
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per IP per hour (default: 10)
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate origin (optional but recommended)
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    
    if (allowedOrigin !== '*' && origin && !origin.includes(allowedOrigin)) {
      return new Response('Forbidden origin', { 
        status: 403,
        headers: getCORSHeaders(origin, env)
      });
    }

    // Rate limiting (basic IP-based)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `rate_limit:${clientIP}`;
    const rateLimitMax = parseInt(env.RATE_LIMIT_MAX_REQUESTS || '10', 10);
    
    const rateLimitCount = await env.RATE_LIMIT_KV?.get(rateLimitKey) || '0';
    const count = parseInt(rateLimitCount, 10);
    
    if (count >= rateLimitMax) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(origin, env)
        }
      });
    }

    // Increment rate limit counter
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(rateLimitKey, String(count + 1), {
        expirationTtl: 3600 // 1 hour
      });
    }

    try {
      // Parse and validate request body
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

      // Validate required fields
      const requiredFields = ['fullName', 'email', 'whatsapp'];
      const missingFields = requiredFields.filter(field => !payload[field] || !payload[field].trim());
      
      if (missingFields.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields',
          missing: missingFields
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(origin, env)
          }
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email.trim())) {
        return new Response(JSON.stringify({ 
          error: 'Invalid email format'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(origin, env)
          }
        });
      }

      // Sanitize and prepare data for Airtable
      const airtablePayload = {
        fullName: sanitizeString(payload.fullName),
        email: sanitizeString(payload.email),
        whatsapp: sanitizeString(payload.whatsapp),
        location: sanitizeString(payload.location || ''),
        goals: sanitizeString(payload.goals || ''),
        submittedAt: payload.submittedAt || new Date().toISOString(),
        sourcePage: payload.sourcePage || ''
      };

      // Get Airtable webhook URL from environment
      const airtableWebhookURL = env.AIRTABLE_WEBHOOK_URL;
      
      if (!airtableWebhookURL) {
        console.error('AIRTABLE_WEBHOOK_URL not configured');
        return new Response(JSON.stringify({ 
          error: 'Server configuration error' 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders(origin, env)
          }
        });
      }

      // Forward to Airtable webhook
      const formData = new URLSearchParams();
      Object.entries(airtablePayload).forEach(([key, value]) => {
        formData.append(key, value || '');
      });

      const airtableResponse = await fetch(airtableWebhookURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      // Check if Airtable accepted the request
      // Note: Airtable webhooks typically return 200 even with no-cors
      if (!airtableResponse.ok && airtableResponse.status !== 0) {
        throw new Error(`Airtable webhook returned status ${airtableResponse.status}`);
      }

      // Return success response
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Application submitted successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(origin, env)
        }
      });

    } catch (error) {
      console.error('Form submission error:', error);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to submit application. Please try again later.',
        details: env.ENVIRONMENT === 'development' ? error.message : undefined
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(origin, env)
        }
      });
    }
  }
};

function handleCORS(request, env) {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(origin, env)
  });
}

function getCORSHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const corsOrigin = allowedOrigin === '*' ? (origin || '*') : allowedOrigin;
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  // Remove potentially dangerous characters and trim
  return str.trim()
    .replace(/[<>]/g, '') // Remove < and >
    .substring(0, 1000); // Limit length
}


