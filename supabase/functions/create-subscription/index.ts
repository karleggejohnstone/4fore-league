// supabase/functions/create-subscription/index.ts
// Deno Edge Function — creates a Stripe Subscription for an existing customer.
// The customer must already have a payment method from the SetupIntent at signup.
//
// Required env var:
//   STRIPE_SECRET_KEY  — sk_test_... or sk_live_...
//
// Request  (POST, JSON):
//   { "customerId": "cus_...", "priceId": "price_..." }
//
// Response (JSON):
//   { "subscriptionId": "sub_...", "status": "active" }
//   or on error:
//   { "error": "<message>" }

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

  let body: { customerId?: string; priceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { customerId, priceId } = body;

  if (!customerId || !priceId) {
    return json({ error: 'customerId and priceId are required' }, 400);
  }

  try {
    // Get the customer's default payment method
    const customer = await stripeGet(`customers/${customerId}`);
    if (customer.error) {
      return json({ error: customer.error.message ?? 'Customer not found' }, 404);
    }

    // Find the payment method — check invoice_settings first, then list payment methods
    let paymentMethodId = customer.invoice_settings?.default_payment_method;

    if (!paymentMethodId) {
      const pms = await stripeGet(`payment_methods?customer=${customerId}&type=card`);
      if (pms.data?.length > 0) {
        paymentMethodId = pms.data[0].id;
      }
    }

    if (!paymentMethodId) {
      return json({ error: 'No payment method found for this customer. Please update your payment method first.' }, 400);
    }

    // Create the subscription
    const subscription = await stripePost('subscriptions', [
      ['customer', customerId],
      ['items[0][price]', priceId],
      ['default_payment_method', paymentMethodId],
      ['payment_behavior', 'default_incomplete'],
      ['expand[]', 'latest_invoice.payment_intent'],
    ]);

    if (subscription.error) {
      console.error('Stripe subscription error:', subscription.error);
      return json({ error: subscription.error.message ?? 'Failed to create subscription' }, 502);
    }

    return json({
      subscriptionId: subscription.id,
      status: subscription.status,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

async function stripePost(path: string, params: string[][]): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
