/* ═══════════════════════════════════════════════════════════════════
   OD2MK — Real Supabase Client Module
   
   This replaces every MOCK_* function in OD2MK_KB_Dashboard.jsx with
   real, working calls against your live Supabase project. Import this
   file at the top of the dashboard component and swap each mock
   function call for the matching real one below.
   
   Install first:  npm install @supabase/supabase-js
   ═══════════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

// ─── SETUP — values come from your hosting provider's environment ───
// Vite-based hosts (Vercel, Netlify, Cloudflare Pages) read these from
// a .env file locally and from the host's dashboard env settings in
// production. NEVER commit your actual .env file to git.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; // NEVER the service_role key here

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY in your .env file (local) or your hosting ' +
    "provider's environment settings (production)."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // handles the magic link redirect automatically
  },
});


/* ═══════════════════════════════════════════════════════════════════
   AUTH — magic link sign-in and self-signup
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Sends a magic link to an EXISTING client. Will not create a new
 * account — if the email isn't in auth.users, Supabase returns an
 * error that the UI should interpret as "offer signup instead".
 */
export async function sendSignInLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: false,
    },
  });
  if (error) throw new Error('NO_ACCOUNT');
  return true;
}

/**
 * Creates a brand new client account with a 24h trial.
 * The handle_new_client_signup() Postgres trigger (in
 * od2mk_trial_payment_gate.sql) fires automatically on signup and
 * creates the client_config row + user_clients link server-side.
 */
export async function signUpNewClient(email, businessName) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
      shouldCreateUser: true,
      data: { business_name: businessName },
    },
  });
  if (error) {
    console.error('Supabase signUpNewClient error:', error);
    const msg = error.message || error.error_description || error.msg || '';
    if (msg.includes('already registered')) {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }
    if (msg.includes('Signups not allowed') || error.status === 422) {
      throw new Error(
        'Sign-ups are currently disabled on this project. Enable email sign-ups in Supabase → Authentication → Providers → Email, or ask the site owner to add your account manually.'
      );
    }
    throw new Error(msg || 'Something went wrong creating your account. Please try again.');
  }
  return true;
}

/**
 * Call this once on app load. Supabase's detectSessionInUrl handles
 * the magic link click automatically — this just reads the resulting
 * session and resolves it to the client's full profile + access state.
 */
export async function getCurrentClientSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Find which client(s) this user is linked to
  const { data: links, error: linkErr } = await supabase
    .from('user_clients')
    .select('client_id, role')
    .eq('user_id', session.user.id)
    .limit(1)
    .single();

  if (linkErr || !links) return null;

  // Pull the full client_config — RLS automatically scopes this to
  // only the rows this user is linked to, but we also filter
  // explicitly here for clarity and performance
  const { data: client, error: clientErr } = await supabase
    .from('client_config')
    .select('*')
    .eq('client_id', links.client_id)
    .single();

  if (clientErr || !client) return null;

  return {
    ...client,
    role: links.role,
    email: session.user.email,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Live access check — mirrors the SQL client_has_access() function.
 * Use this to decide whether to show the Dashboard or PaymentLockScreen.
 */
export function hasAccess(client) {
  if (!client) return false;
  if (client.payment_status === 'paid') return true;
  if (client.payment_status === 'trial' && client.trial_ends_at) {
    return new Date(client.trial_ends_at) > new Date();
  }
  return false;
}

export function formatTimeRemaining(trialEndsAt) {
  const diff = new Date(trialEndsAt) - new Date();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}


/* ═══════════════════════════════════════════════════════════════════
   FAQs — client_faqs table (training data for the agent)
   ═══════════════════════════════════════════════════════════════════ */

export async function getFaqs(clientId) {
  const { data, error } = await supabase
    .from('client_faqs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addFaq(clientId, question, answer, category = 'General') {
  const { data, error } = await supabase
    .from('client_faqs')
    .insert({ client_id: clientId, question, answer, category })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFaq(faqId, updates) {
  const { data, error } = await supabase
    .from('client_faqs')
    .update(updates)
    .eq('id', faqId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFaq(faqId) {
  const { error } = await supabase
    .from('client_faqs')
    .delete()
    .eq('id', faqId);
  if (error) throw error;
  return true;
}


/* ═══════════════════════════════════════════════════════════════════
   PRODUCTS — client_products table
   ═══════════════════════════════════════════════════════════════════ */

export async function getProducts(clientId) {
  const { data, error } = await supabase
    .from('client_products')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addProduct(clientId, product) {
  const { data, error } = await supabase
    .from('client_products')
    .insert({
      client_id: clientId,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category || 'General',
      availability: product.availability || 'available',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(productId, updates) {
  const { data, error } = await supabase
    .from('client_products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(productId) {
  const { error } = await supabase
    .from('client_products')
    .delete()
    .eq('id', productId);
  if (error) throw error;
  return true;
}


/* ═══════════════════════════════════════════════════════════════════
   AGENT SETTINGS — updates to client_config (persona, greeting, etc.)
   This is the core "train your agent" surface — every field here
   feeds directly into the system prompt your n8n Code in JavaScript2
   node builds for every conversation.
   ═══════════════════════════════════════════════════════════════════ */

export async function updateAgentSettings(clientId, settings) {
  // settings can include any of: ai_persona_name, ai_greeting,
  // business_name, business_type, location, phone, email, whatsapp,
  // website, opening_hours, human_support_name, human_support_contact,
  // brand_color
  const { data, error } = await supabase
    .from('client_config')
    .update(settings)
    .eq('client_id', clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


/* ═══════════════════════════════════════════════════════════════════
   CONVERSATIONS — read-only live feed from the widget
   ═══════════════════════════════════════════════════════════════════ */

export async function getRecentConversations(clientId, limit = 50) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Groups flat conversation rows into sessions, for a cleaner UI list.
 */
export function groupConversationsBySession(rows) {
  const sessions = {};
  for (const row of rows) {
    if (!sessions[row.session_id]) {
      sessions[row.session_id] = {
        session_id: row.session_id,
        messages: [],
        last_message: '',
        last_time: row.created_at,
      };
    }
    sessions[row.session_id].messages.push(row);
    if (new Date(row.created_at) > new Date(sessions[row.session_id].last_time)) {
      sessions[row.session_id].last_message = row.message;
      sessions[row.session_id].last_time = row.created_at;
    }
  }
  return Object.values(sessions).sort(
    (a, b) => new Date(b.last_time) - new Date(a.last_time)
  );
}

/**
 * Live subscription — new messages appear in the dashboard instantly
 * without needing to refresh. Call this once when the Conversations
 * tab mounts, and unsubscribe when it unmounts.
 */
export function subscribeToConversations(clientId, onNewMessage) {
  const channel = supabase
    .channel(`conversations-${clientId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `client_id=eq.${clientId}`,
      },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}


/* ═══════════════════════════════════════════════════════════════════
   LEADS — read + update status
   ═══════════════════════════════════════════════════════════════════ */

export async function getLeads(clientId) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(leadId, status) {
  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


/* ═══════════════════════════════════════════════════════════════════
   BOOKINGS — read + update status
   ═══════════════════════════════════════════════════════════════════ */

export async function getBookings(clientId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateBookingStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


/* ═══════════════════════════════════════════════════════════════════
   WIDGET KEY — for the embed snippet
   ═══════════════════════════════════════════════════════════════════ */

export async function getWidgetKey(clientId) {
  const { data, error } = await supabase
    .from('widget_keys')
    .select('widget_key, is_active, allowed_domain')
    .eq('client_id', clientId)
    .single();
  if (error) throw error;
  return data;
}

export function buildEmbedSnippet(widgetKey, webhookUrl, agentName = 'Ava') {
  return `<script>
(function() {
  const OD2MK_WIDGET_KEY = "${widgetKey}";
  const OD2MK_WEBHOOK_URL = "${webhookUrl}";
  const OD2MK_AGENT_NAME = "${agentName}";
  // ... full widget script — see od2mk_widget_resolution.js Part 4
})();
</script>`;
}