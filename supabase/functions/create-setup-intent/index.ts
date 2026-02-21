// supabase/functions/create-setup-intent/index.ts
// Deno Edge Function — creates a Stripe Customer + SetupIntent server-side.
// Called from signup.html after Supabase Auth sign-up.
//
// Required env var (set in Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  — sk_test_... or sk_live_...
//
// Request  (POST, JSON):
//   { "email": "user@example.com", "userId": "<supabase-auth-uid>" }
//
// Response (JSON):
//   { "clientSecret": "seti_...._secret_...", "customerId": "cus_..." }
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
  // Handle CORS pre-flight
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

  let body: { email?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { email, userId } = body;

  if (!email || !userId) {
    return json({ error: 'email and userId are required' }, 400);
  }

  try {
    // 1. Create (or retrieve) a Stripe Customer for this user
    // Stripe form-encoding requires metadata as metadata[key]=value
    const customer = await stripePost('customers', [
      ['email', email],
      ['metadata[supabase_uid]', userId],
    ]);

    if (customer.error) {
      console.error('Stripe customer error:', customer.error);
      return json({ error: customer.error.message ?? 'Failed to create customer' }, 502);
    }

    // 2. Create a SetupIntent attached to the customer
    //    usage=off_session means the card can be charged later without the user present
    const setupIntent = await stripePost('setup_intents', [
      ['customer', customer.id],
      ['usage', 'off_session'],
      ['automatic_payment_methods[enabled]', 'true'],
    ]);

    if (setupIntent.error) {
      console.error('Stripe setup_intent error:', setupIntent.error);
      return json({ error: setupIntent.error.message ?? 'Failed to create setup intent' }, 502);
    }

    return json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** POST to the Stripe REST API and return parsed JSON. */
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

/** Return a JSON response with CORS headers. */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
