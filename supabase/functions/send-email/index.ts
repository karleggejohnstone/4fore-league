// supabase/functions/send-email/index.ts
// Sends transactional emails via Resend.
//
// Required env var (set in Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY  — re_...
//
// Request (POST, JSON):
//   {
//     "type":  "welcome" | "password-reset" | "trial-expiry-7" | "trial-expiry-3" | "trial-expiry-1",
//     "to":    "user@example.com",
//     "data":  { "name": "Marcus", ...extra fields per type }
//   }
//
// Response: { "id": "<resend-message-id>" } or { "error": "..." }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDRESS   = '4FORE League <hello@4fore.golf>';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return json({ error: 'Server configuration error' }, 500);
  }

  let body: { type?: string; to?: string; data?: Record<string, string> };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const { type, to, data = {} } = body;
  if (!type || !to) return json({ error: 'type and to are required' }, 400);

  const email = buildEmail(type, to, data);
  if (!email) return json({ error: `Unknown email type: ${type}` }, 400);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], ...email }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error('Resend error:', result);
      return json({ error: result.message ?? 'Failed to send email' }, 502);
    }

    return json({ id: result.id });
  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildEmail(
  type: string,
  _to: string,
  data: Record<string, string>,
): { subject: string; html: string } | null {
  const name = data.name ?? 'Golfer';

  switch (type) {
    case 'welcome':
      return {
        subject: 'Welcome to 4FORE League 🏌️',
        html: template(`Welcome, ${name}!`, `
          <p>You're in. Your 14-day free trial has started — no charge today.</p>
          <p>Here's what you can do right now:</p>
          <ul>
            <li><strong>Start a round</strong> — invite friends and score live</li>
            <li><strong>Complete your profile</strong> — set your handicap and display name</li>
            <li><strong>Explore the leaderboard</strong> — see how your group stacks up</li>
          </ul>
          ${ctaButton('https://4fore-league.vercel.app/round.html', 'Start Your First Round')}
          <p style="color:#6B6B6B;font-size:13px;margin-top:24px;">Questions? Just reply to this email.</p>
        `),
      };

    case 'password-reset':
      return {
        subject: 'Reset your 4FORE League password',
        html: template('Reset your password', `
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the link in the separate email from Supabase to set a new one.</p>
          <p>If you didn't request this, you can safely ignore this message — your account is secure.</p>
          <p style="color:#6B6B6B;font-size:13px;margin-top:24px;">This request will expire in 24 hours.</p>
        `),
      };

    case 'trial-expiry-7':
      return {
        subject: 'Your 4FORE trial ends in 7 days',
        html: template('7 days left on your trial', `
          <p>Hi ${name},</p>
          <p>Your free trial ends in <strong>7 days</strong>. After that, your card on file will be charged to keep your rounds, leaderboard, and profile active.</p>
          <p>You don't need to do anything — we'll handle it automatically.</p>
          ${ctaButton('https://4fore-league.vercel.app/round.html', 'Play a Round Today')}
        `),
      };

    case 'trial-expiry-3':
      return {
        subject: 'Your 4FORE trial ends in 3 days',
        html: template('3 days left on your trial', `
          <p>Hi ${name},</p>
          <p>Just a heads up — your trial ends in <strong>3 days</strong>. Your scoring history and league data will be preserved.</p>
          ${ctaButton('https://4fore-league.vercel.app/round.html', 'Make the most of it')}
        `),
      };

    case 'trial-expiry-1':
      return {
        subject: 'Last day of your 4FORE trial',
        html: template('Trial ends tomorrow', `
          <p>Hi ${name},</p>
          <p>Your trial ends <strong>tomorrow</strong>. Your card will be charged after midnight to continue your membership.</p>
          <p>If you'd like to cancel, reply to this email and we'll sort it out — no questions asked.</p>
          ${ctaButton('https://4fore-league.vercel.app/round.html', 'Play one last trial round')}
        `),
      };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// HTML email base template — forest green + gold, Bebas Neue headings
// ---------------------------------------------------------------------------

function template(heading: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  body { margin:0; background:#F5F0E8; font-family:'DM Sans',Arial,sans-serif; }
  a { color:#1B3D2A; }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5F0E8">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Header -->
      <tr>
        <td style="background:#1B3D2A; padding:28px 40px; border-radius:8px 8px 0 0;">
          <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:28px;color:#C9A84C;letter-spacing:2px;">4FORE LEAGUE</span>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#ffffff;padding:40px;border-radius:0 0 8px 8px;">
          <h1 style="font-family:'Bebas Neue',Arial,sans-serif;font-size:32px;color:#1B3D2A;margin:0 0 20px;letter-spacing:1px;">${heading}</h1>
          <div style="font-size:15px;line-height:1.7;color:#333;">
            ${body}
          </div>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 0;text-align:center;">
          <p style="font-size:12px;color:#9B9083;margin:0;">4FORE League · Never Lay Up</p>
          <p style="font-size:12px;color:#9B9083;margin:4px 0 0;">
            <a href="https://4fore-league.vercel.app" style="color:#9B9083;">4fore-league.vercel.app</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:28px 0;">
    <a href="${href}" style="display:inline-block;padding:14px 32px;background:#1B3D2A;color:#F5F0E8;font-family:'Bebas Neue',Arial,sans-serif;font-size:16px;letter-spacing:2px;text-decoration:none;border-radius:4px;">${label}</a>
  </p>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
