// supabase/functions/create-portal-session/index.ts
// Deno Edge Function — creates a Stripe Customer Portal session server-side.
// Called from account.html when the user clicks "Manage billing".
//
// Required env var:
//   STRIPE_SECRET_KEY  — sk_test_... or sk_live_...
//
// Request  (POST, JSON):
//   { "customerId": "cus_...", "returnUrl": "https://..." }
//
// Response (JSON):
//   { "url": "https://billing.stripe.com/..." }
//   or on error:
//   { "error": "<message>" }  with appropriate HTTP status

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    return json({ error: 'Server configuration error' }, 500);
  }

  let body: { customerId?: string; returnUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { customerId, returnUrl } = body;

  if (!customerId || !returnUrl) {
    return json({ error: 'customerId and returnUrl are required' }, 400);
  }

  try {
    const session = await stripePost('billing_portal/sessions', [
      ['customer', customerId],
      ['return_url', returnUrl],
    ]);

    if (session.error) {
      console.error('Stripe portal session error:', session.error);
      return json({ error: session.error.message ?? 'Failed to create portal session' }, 502);
    }

    return json({ url: session.url });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function stripePost(path: string, params: string[][]): Promise<any> {
  const body = new URLSearchParams(params).toString();

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  return res.json();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
