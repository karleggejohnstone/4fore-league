// auth.js — Supabase Auth helper for 4FORE League
// Include after supabase.js on every auth page.

(function () {
  const SUPABASE_URL = 'https://jfegilifmksmngslnbgm.supabase.co';
  const EDGE_BASE    = SUPABASE_URL + '/functions/v1';

  // ── Session helpers ────────────────────────────────────────────────────────

  /** Returns the current session, or null. */
  async function getSession() {
    const { data } = await window.sb.auth.getSession();
    return data.session;
  }

  /** Returns the current user, or null. */
  async function getUser() {
    const { data } = await window.sb.auth.getUser();
    return data.user ?? null;
  }

  /**
   * Redirect to login if not signed in.
   * Call at the top of any protected page.
   */
  async function requireAuth(redirectTo = 'login.html') {
    const session = await getSession();
    if (!session) {
      window.location.href = redirectTo;
    }
    return session;
  }

  /**
   * Redirect away from auth pages if already signed in.
   * Call on login.html / signup.html to skip if already authed.
   */
  async function redirectIfAuthed(redirectTo = 'index.html') {
    const session = await getSession();
    if (session) {
      window.location.href = redirectTo;
    }
  }

  // ── Auth actions ───────────────────────────────────────────────────────────

  async function signUp(email, password) {
    return window.sb.auth.signUp({ email, password });
  }

  async function signIn(email, password) {
    return window.sb.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    await window.sb.auth.signOut();
    window.location.href = 'login.html';
  }

  async function sendPasswordReset(email) {
    return window.sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html',
    });
  }

  // ── Profile helpers ────────────────────────────────────────────────────────

  async function getProfile(userId) {
    const { data, error } = await window.sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  }

  async function upsertProfile(userId, fields) {
    return window.sb
      .from('profiles')
      .upsert({ id: userId, ...fields, updated_at: new Date().toISOString() });
  }

  // ── Stripe SetupIntent ─────────────────────────────────────────────────────

  /**
   * Calls the create-setup-intent Edge Function.
   * Returns { clientSecret, customerId } or throws on error.
   */
  async function createSetupIntent(email, userId) {
    const res = await fetch(EDGE_BASE + '/create-setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  // ── Resend email helpers ───────────────────────────────────────────────────

  async function sendEmail(type, to, data = {}) {
    const res = await fetch(EDGE_BASE + '/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data }),
    });
    return res.json();
  }

  // ── Exports ────────────────────────────────────────────────────────────────

  window.auth = {
    getSession,
    getUser,
    requireAuth,
    redirectIfAuthed,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    getProfile,
    upsertProfile,
    createSetupIntent,
    sendEmail,
  };
})();
