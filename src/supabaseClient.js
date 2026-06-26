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
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    console.error('[getCurrentClientSession] auth.getSession() error:', sessionErr);
    return null;
  }
  if (!session) {
    console.warn('[getCurrentClientSession] No active session found.');
    return null;
  }
  console.log('[getCurrentClientSession] Session found for user_id:', session.user.id, 'email:', session.user.email);

  // Find which client(s) this user is linked to
  const { data: links, error: linkErr } = await supabase
    .from('user_clients')
    .select('client_id, role')
    .eq('user_id', session.user.id)
    .limit(1)
    .single();

  if (linkErr) {
    console.error('[getCurrentClientSession] user_clients lookup FAILED:', linkErr.message, linkErr);
    return null;
  }
  if (!links) {
    console.warn('[getCurrentClientSession] No user_clients row found for user_id:', session.user.id);
    return null;
  }
  console.log('[getCurrentClientSession] Linked to client_id:', links.client_id, 'role:', links.role);

  // Pull the full client_config — RLS automatically scopes this to
  // only the rows this user is linked to, but we also filter
  // explicitly here for clarity and performance
  const { data: client, error: clientErr } = await supabase
    .from('client_config')
    .select('*')
    .eq('client_id', links.client_id)
    .single();

  if (clientErr) {
    console.error('[getCurrentClientSession] client_config lookup FAILED:', clientErr.message, clientErr);
    return null;
  }
  if (!client) {
    console.warn('[getCurrentClientSession] No client_config row found for client_id:', links.client_id);
    return null;
  }
  console.log('[getCurrentClientSession] SUCCESS — full client loaded:', client.client_id);

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

/**
 * Bulk-insert many FAQs at once — used by CSV/paste import.
 * Returns { inserted, skipped, errors } so the UI can show a summary.
 * Supabase batches a single INSERT for the whole array, so this is
 * one round trip regardless of how many rows are in `faqRows`.
 */
export async function addFaqsBulk(clientId, faqRows) {
  if (!faqRows.length) return { inserted: 0, skipped: 0, errors: [] };

  const rows = faqRows.map(r => ({
    client_id: clientId,
    question: r.question?.trim(),
    answer: r.answer?.trim(),
    category: r.category?.trim() || 'General',
  }));

  const { data, error } = await supabase
    .from('client_faqs')
    .insert(rows)
    .select();

  if (error) {
    return { inserted: 0, skipped: rows.length, errors: [error.message] };
  }
  return { inserted: data.length, skipped: 0, errors: [] };
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

/**
 * Bulk-insert many products at once — used by CSV/paste import.
 */
export async function addProductsBulk(clientId, productRows) {
  if (!productRows.length) return { inserted: 0, skipped: 0, errors: [] };

  const rows = productRows.map(r => ({
    client_id: clientId,
    name: r.name?.trim(),
    description: r.description?.trim() || '',
    price: r.price?.trim() || '',
    category: r.category?.trim() || 'General',
    availability: r.availability?.trim() || 'available',
  }));

  const { data, error } = await supabase
    .from('client_products')
    .insert(rows)
    .select();

  if (error) {
    return { inserted: 0, skipped: rows.length, errors: [error.message] };
  }
  return { inserted: data.length, skipped: 0, errors: [] };
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
        last_message: row.message || '',
        last_time: row.created_at,
        page_url: row.page_url || null,
        status: 'active',
      };
    }
    sessions[row.session_id].messages.push(row);
    // Use >= rather than > so the first row (where created_at equals
    // the initial last_time) still correctly sets last_message — the
    // strict > comparison previously meant a session's very first
    // message could never become its preview text.
    if (new Date(row.created_at) >= new Date(sessions[row.session_id].last_time)) {
      sessions[row.session_id].last_message = row.message || '';
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
   COMPLAINTS — read + update status
   ═══════════════════════════════════════════════════════════════════ */

export async function getComplaints(clientId) {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateComplaintStatus(complaintId, status) {
  const { data, error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', complaintId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


/* ═══════════════════════════════════════════════════════════════════
   HANDOVER SESSIONS — requests to speak with a human agent
   ═══════════════════════════════════════════════════════════════════ */

export async function getHandoverSessions(clientId) {
  const { data, error } = await supabase
    .from('handover_sessions')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateHandoverStatus(handoverId, status) {
  const { data, error } = await supabase
    .from('handover_sessions')
    .update({ status })
    .eq('id', handoverId)
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


/* ═══════════════════════════════════════════════════════════════════
   BUSINESS-TYPE-AWARE UI CONFIGURATION
   
   `business_type` is free text the client enters on the Train Agent
   tab. We match it (case-insensitively, fuzzy) against known presets
   below to relabel tabs, fields and status options so the dashboard
   feels built specifically for their industry — without maintaining
   a separate dashboard per industry.
   
   Anything that doesn't match a known preset falls back to GENERIC,
   so the dashboard always works even for an unrecognised business type.
   ═══════════════════════════════════════════════════════════════════ */

const BUSINESS_TYPE_PRESETS = {
  insurance: {
    match: ['insurance', 'insurer', 'underwrit'],
    bookings: {
      tabLabel: 'Policy Requests',
      heading: 'Policy & quote requests',
      subheading: 'New policy applications and quote requests from your widget.',
      serviceLabel: 'Policy type',
      statusOptions: [
        { value: 'new', label: 'New' },
        { value: 'confirmed', label: 'Quote sent' },
        { value: 'completed', label: 'Policy issued' },
        { value: 'cancelled', label: 'Declined' },
      ],
    },
    complaints: {
      tabLabel: 'Claims & Complaints',
      heading: 'Claims & complaints',
      subheading: 'Claims issues and policyholder complaints from your widget.',
    },
    leads: { interestLabel: 'Coverage interest' },
  },

  'vehicle diagnostics': {
    match: ['vehicle', 'diagnostic', 'auto', 'mechanic', 'garage', 'car repair'],
    bookings: {
      tabLabel: 'Bookings',
      heading: 'Diagnostic bookings',
      subheading: 'Vehicle diagnostic appointments booked through your widget.',
      serviceLabel: 'Service requested',
      statusOptions: [
        { value: 'new', label: 'New' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    complaints: {
      tabLabel: 'Complaints',
      heading: 'Complaints',
      subheading: 'Service issues reported through your widget.',
    },
    leads: { interestLabel: 'Service interest' },
  },

  healthcare: {
    match: ['health', 'clinic', 'hospital', 'medical', 'dental', 'pharmac'],
    bookings: {
      tabLabel: 'Appointments',
      heading: 'Patient appointments',
      subheading: 'Appointment requests booked through your widget.',
      serviceLabel: 'Appointment type',
      statusOptions: [
        { value: 'new', label: 'Requested' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'completed', label: 'Seen' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    complaints: {
      tabLabel: 'Patient Concerns',
      heading: 'Patient concerns',
      subheading: 'Concerns and feedback raised through your widget.',
    },
    leads: { interestLabel: 'Interested in' },
  },

  hospitality: {
    match: ['hotel', 'restaurant', 'hospitality', 'travel', 'tour'],
    bookings: {
      tabLabel: 'Reservations',
      heading: 'Reservations',
      subheading: 'Booking requests made through your widget.',
      serviceLabel: 'Reservation type',
      statusOptions: [
        { value: 'new', label: 'Requested' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'completed', label: 'Completed stay' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    complaints: {
      tabLabel: 'Guest Feedback',
      heading: 'Guest feedback',
      subheading: 'Issues and feedback raised by guests through your widget.',
    },
    leads: { interestLabel: 'Interested in' },
  },

  retail: {
    match: ['retail', 'ecommerce', 'e-commerce', 'shop', 'store'],
    bookings: {
      tabLabel: 'Orders & Pickups',
      heading: 'Orders & pickup requests',
      subheading: 'Order and pickup requests from your widget.',
      serviceLabel: 'Item / service',
      statusOptions: [
        { value: 'new', label: 'New' },
        { value: 'confirmed', label: 'Processing' },
        { value: 'completed', label: 'Fulfilled' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    complaints: {
      tabLabel: 'Customer Issues',
      heading: 'Customer issues',
      subheading: 'Order issues and complaints from your widget.',
    },
    leads: { interestLabel: 'Product interest' },
  },

  GENERIC: {
    bookings: {
      tabLabel: 'Bookings',
      heading: 'Bookings & appointments',
      subheading: 'Appointments and service requests booked through your widget.',
      serviceLabel: 'Service',
      statusOptions: [
        { value: 'new', label: 'New' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    complaints: {
      tabLabel: 'Complaints',
      heading: 'Complaints',
      subheading: 'Issues reported through your widget.',
    },
    leads: { interestLabel: 'Interest' },
  },
};

/**
 * Resolves a free-text business_type string to the closest matching
 * preset, falling back to GENERIC. Case-insensitive, substring match.
 */
export function getBusinessTypeConfig(businessType) {
  const normalized = (businessType || '').toLowerCase().trim();
  if (!normalized) return BUSINESS_TYPE_PRESETS.GENERIC;

  for (const [key, preset] of Object.entries(BUSINESS_TYPE_PRESETS)) {
    if (key === 'GENERIC') continue;
    if (preset.match.some(keyword => normalized.includes(keyword))) {
      return preset;
    }
  }
  return BUSINESS_TYPE_PRESETS.GENERIC;
}


/* ═══════════════════════════════════════════════════════════════════
   SUBSCRIPTION PLANS — pricing tiers read from the `plans` table
   ═══════════════════════════════════════════════════════════════════ */

export async function getPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export function formatNaira(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG');
}

export async function getPaymentHistory(clientId) {
  const { data, error } = await supabase
    .from('payment_history')
    .select('*')
    .eq('client_id', clientId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return data;
}


/* ═══════════════════════════════════════════════════════════════════
   PAYSTACK CHECKOUT
   
   Uses Paystack's Inline JS (loaded via a <script> tag — see
   loadPaystackScript below) rather than a server redirect, so the
   client never leaves your dashboard. The actual charge verification
   happens server-side via your n8n webhook calling mark_client_paid(),
   NOT trusted from this client-side callback alone — the callback
   below is only used to show immediate UI feedback while the
   authoritative confirmation comes from Paystack's webhook.
   ═══════════════════════════════════════════════════════════════════ */

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

/** Dynamically loads Paystack's inline checkout script once. */
let paystackScriptPromise = null;
export function loadPaystackScript() {
  if (paystackScriptPromise) return paystackScriptPromise;
  paystackScriptPromise = new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(window.PaystackPop);
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return paystackScriptPromise;
}

/**
 * Opens the Paystack checkout modal for a given plan.
 * client_id is passed as metadata — this is what your n8n webhook
 * handler reads to know which client to call mark_client_paid() for.
 *
 * Returns a Promise that resolves with Paystack's client-side
 * response on success, or rejects if the user closes the modal.
 * IMPORTANT: this resolution is for UI feedback only. The real
 * source of truth is the server-side webhook — do not unlock
 * access purely based on this resolving.
 */
export async function startPaystackCheckout({ email, clientId, plan }) {
  if (!PAYSTACK_PUBLIC_KEY) {
    throw new Error('Paystack is not configured. Set VITE_PAYSTACK_PUBLIC_KEY in your environment.');
  }
  const PaystackPop = await loadPaystackScript();

  return new Promise((resolve, reject) => {
    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: plan.price_ngn_kobo,
      currency: 'NGN',
      metadata: {
        client_id: clientId,
        plan_code: plan.plan_code,
        payment_type: 'subscription', // ← lets the unified Paystack webhook router (od2mk_paystack_unified_webhook.js) know this is a dashboard subscription, not e.g. a one-off diagnostic report purchase
        custom_fields: [
          { display_name: 'Client ID', variable_name: 'client_id', value: clientId },
          { display_name: 'Plan', variable_name: 'plan_code', value: plan.plan_code },
          { display_name: 'Payment Type', variable_name: 'payment_type', value: 'subscription' },
        ],
      },
      callback: (response) => resolve(response),
      onClose: () => reject(new Error('Payment window closed before completing.')),
    });
    handler.openIframe();
  });
}




/* ═══════════════════════════════════════════════════════════════════
   BULK IMPORT — CSV / pasted-text parsing
   No external library needed; handles quoted commas correctly for
   the simple 2-4 column files clients will realistically upload.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Parses raw CSV text into an array of row objects using the first
 * line as headers. Handles quoted fields containing commas.
 */
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);
    return fields.map(f => f.trim());
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

/**
 * Parses simple "Q: ... / A: ..." style pasted text into FAQ rows,
 * for clients who don't want to deal with CSV at all — just paste
 * from a document or email.
 *
 * Accepts blocks separated by blank lines, e.g.:
 *   Q: What is TangAuto?
 *   A: TangAuto is our motor insurance plan.
 *
 *   Q: How do I file a claim?
 *   A: Log into your portal and select File a Claim.
 */
export function parseQandAText(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  const rows = [];
  for (const block of blocks) {
    const qMatch = block.match(/^Q:\s*(.+)$/im);
    const aMatch = block.match(/^A:\s*([\s\S]+)$/im);
    if (qMatch && aMatch) {
      rows.push({
        question: qMatch[1].trim(),
        answer: aMatch[1].trim(),
        category: 'General',
      });
    }
  }
  return rows;
}

/** Validates FAQ rows before insert — returns { valid, invalid } */
export function validateFaqRows(rows) {
  const valid = [];
  const invalid = [];
  for (const r of rows) {
    if (r.question && r.answer) valid.push(r);
    else invalid.push(r);
  }
  return { valid, invalid };
}

/** Validates product rows before insert — returns { valid, invalid } */
export function validateProductRows(rows) {
  const valid = [];
  const invalid = [];
  for (const r of rows) {
    if (r.name) valid.push(r);
    else invalid.push(r);
  }
  return { valid, invalid };
}
