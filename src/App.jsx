import React, { useState, useEffect } from 'react';
import { Mail, Building2, Plus, Trash2, Edit3, Save, X, LogOut, HelpCircle, Package, ChevronRight, CheckCircle2, AlertCircle, MessageSquare, Users, Code2, Copy, Check, Clock, Calendar, Sparkles, Lock, CreditCard, ArrowLeft, Upload, FileText, Download, AlertTriangle, PhoneCall } from 'lucide-react';
import {
  sendSignInLink, signUpNewClient, getCurrentClientSession, signOut as signOutDb,
  hasAccess, formatTimeRemaining,
  getFaqs, addFaq as addFaqDb, updateFaq as updateFaqDb, deleteFaq as deleteFaqDb, addFaqsBulk,
  getProducts, addProduct as addProductDb, addProductsBulk,
  updateAgentSettings,
  getRecentConversations, groupConversationsBySession, subscribeToConversations,
  getLeads, updateLeadStatus,
  getBookings, updateBookingStatus,
  getComplaints, updateComplaintStatus,
  getHandoverSessions, updateHandoverStatus,
  getBusinessTypeConfig,
  getWidgetKey,
  parseCsv, parseQandAText, validateFaqRows, validateProductRows,
  getPlans, formatNaira, startPaystackCheckout,
} from './supabaseClient';

/* ════════════════════════════════════════════════════════════════
   OD2MK — Multi-Tenant Knowledge Base Dashboard (PRODUCTION)
   
   Live and wired to Supabase via ./supabaseClient.js. Real tables:
   client_config, client_faqs, client_products, conversations,
   leads, bookings, complaints, handover_sessions, widget_keys,
   user_clients.
   
   AUTH: magic-link only (no passwords). Self-signup creates a 24h
   trial via the handle_new_client_signup() Postgres trigger.
   
   ACCESS GATE: hasAccess(user) mirrors the SQL client_has_access()
   function — payment_status === 'paid', or trial still within its
   24h window. When false, App renders PaymentLockScreen instead of
   Dashboard. Wire PaymentLockScreen's "Subscribe" button to your
   real payment gateway checkout (Paystack/Flutterwave/Stripe); their
   webhook should call the mark_client_paid() RPC server-side, which
   this app picks up on next session refresh.
   ════════════════════════════════════════════════════════════════ */

// ─── LIVE BACKEND ───────────────────────────────────────────────
// FAQs, products, conversations, leads and widget keys are now
// fetched live from Supabase inside the Dashboard component's
// useEffect — see supabaseClient.js for the underlying queries.

// ════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [stage, setStage] = useState('enter-email'); // enter-email | link-sent | signup-success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendLink = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendSignInLink(email);
      setStage('link-sent');
    } catch (err) {
      if (err.message === 'NO_ACCOUNT') {
        setMode('signup');
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // The handle_new_client_signup() Postgres trigger creates
      // client_config with a 24h trial automatically, server-side,
      // the moment this auth.users row is created.
      await signUpNewClient(email, businessName);
      setStage('signup-success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-9 h-9 rounded-lg bg-[#E8500A] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">OD2MK <span className="text-[#E8500A]">KB Portal</span></span>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8">

          {mode === 'signin' && stage === 'enter-email' && (
            <>
              <h1 className="text-white text-xl font-semibold mb-1">Sign in to your workspace</h1>
              <p className="text-[#888] text-sm mb-7">We'll email you a secure link — no password needed.</p>

              <form onSubmit={handleSendLink} className="space-y-4">
                <div>
                  <label className="block text-[#AAA] text-xs font-medium mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com"
                      required
                      className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#E8500A] transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-[#2A1515] border border-[#5A2A2A] rounded-lg px-3 py-2.5 text-[#F87171] text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#E8500A] hover:bg-[#D14709] disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? 'Checking...' : 'Continue'}
                  {!loading && <ChevronRight className="w-4 h-4" />}
                </button>
              </form>

              <p className="text-[#666] text-xs text-center mt-5">
                No account yet?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }} className="text-[#E8500A] hover:underline font-medium">
                  Start your free 24-hour trial
                </button>
              </p>
            </>
          )}

          {mode === 'signin' && stage === 'link-sent' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#1A2A1A] flex items-center justify-center mx-auto mb-4">
                <Mail className="w-5 h-5 text-[#4ADE80]" />
              </div>
              <h1 className="text-white text-lg font-semibold mb-2">Check your inbox</h1>
              <p className="text-[#888] text-sm mb-1">We sent a sign-in link to</p>
              <p className="text-white text-sm font-medium mb-6">{email}</p>
              <p className="text-[#666] text-xs leading-relaxed mb-6">Click the link in the email to sign in. It expires in 1 hour and can only be used once.</p>

              <button onClick={() => { setStage('enter-email'); setMode('signin'); }} className="text-[#888] hover:text-white text-xs font-medium">
                ← Use a different email
              </button>
            </div>
          )}

          {mode === 'signup' && stage === 'enter-email' && (
            <>
              <button onClick={() => { setMode('signin'); setError(''); }} className="flex items-center gap-1 text-[#888] hover:text-white text-xs font-medium mb-5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>

              <h1 className="text-white text-xl font-semibold mb-1">Start your free trial</h1>
              <p className="text-[#888] text-sm mb-7">24 hours full access, no card required to start.</p>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-[#AAA] text-xs font-medium mb-1.5">Business name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Your Company Ltd"
                      required
                      className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#E8500A] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#AAA] text-xs font-medium mb-1.5">Work email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com"
                      required
                      className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#E8500A] transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-[#2A1515] border border-[#5A2A2A] rounded-lg px-3 py-2.5 text-[#F87171] text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#E8500A] hover:bg-[#D14709] disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? 'Creating workspace...' : 'Create my workspace'}
                  {!loading && <ChevronRight className="w-4 h-4" />}
                </button>

                <p className="text-[#555] text-[11px] text-center leading-relaxed">After 24 hours, payment is required to keep using your AI agent and dashboard.</p>
              </form>
            </>
          )}

          {mode === 'signup' && stage === 'signup-success' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#1A2A1A] flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-5 h-5 text-[#4ADE80]" />
              </div>
              <h1 className="text-white text-lg font-semibold mb-2">Workspace created!</h1>
              <p className="text-[#888] text-sm mb-1">Your sign-in link is on its way to</p>
              <p className="text-white text-sm font-medium mb-6">{email}</p>
              <div className="bg-[#1A1310] border border-[#3A2415] rounded-lg px-4 py-3 text-left">
                <p className="text-[#FBBF24] text-xs font-medium mb-1">⏱ 24-hour free trial active</p>
                <p className="text-[#888] text-[11px] leading-relaxed">Full access to your AI agent and dashboard. Add payment anytime from Settings to keep access after the trial ends.</p>
              </div>
              <p className="text-[#666] text-xs mt-5">Click the link in your inbox to sign in and get started.</p>
            </div>
          )}
        </div>

        <p className="text-[#555] text-xs text-center mt-6">Your account is secured and can only be accessed via the link sent.<br/>your updates will only be used by your agent to engage clients.</p>
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════════════
// BULK IMPORT MODAL — used for both FAQs and Products
// Two input modes: file upload (CSV) or paste-in text box.
// For FAQs, paste mode also accepts simple "Q: ... / A: ..." format
// so non-technical clients don't need to deal with CSV at all.
// ════════════════════════════════════════════════════════════════
function BulkImportModal({ type, onClose, onImport }) {
  const [mode, setMode] = useState('paste'); // paste | file
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const isFaq = type === 'faqs';

  const faqCsvTemplate = 'question,answer,category\n"What is TangAuto?","Our comprehensive motor insurance plan.","Products"\n"How do I file a claim?","Log into your portal and select File a Claim.","Claims"';
  const productCsvTemplate = 'name,description,price,category\n"AI Diagnostic Report","Full fault code analysis delivered to email","5500","Diagnostics"';
  const faqTextTemplate = 'Q: What is TangAuto?\nA: Our comprehensive motor insurance plan covering third-party and full damage.\n\nQ: How do I file a claim?\nA: Log into your portal, select "File a Claim" and upload required documents.';

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setRawText(evt.target.result);
      parseAndPreview(evt.target.result, true);
    };
    reader.readAsText(file);
  };

  const parseAndPreview = (text, isCsvFile) => {
    let rows = [];
    const looksLikeCsv = isCsvFile || text.split('\n')[0]?.toLowerCase().includes(isFaq ? 'question' : 'name');

    if (looksLikeCsv) {
      rows = parseCsv(text);
    } else if (isFaq) {
      rows = parseQandAText(text);
    } else {
      rows = parseCsv(text); // products always expect CSV-style
    }

    const { valid, invalid } = isFaq ? validateFaqRows(rows) : validateProductRows(rows);
    setPreview(valid.slice(0, 200)); // cap preview/import at 200 rows per batch
    setInvalidCount(invalid.length);
  };

  const handleTextChange = (text) => {
    setRawText(text);
    if (text.trim()) parseAndPreview(text, false);
    else { setPreview([]); setInvalidCount(0); }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    try {
      const res = await onImport(preview);
      setResult(res);
    } catch (err) {
      setResult({ inserted: 0, skipped: preview.length, errors: [err.message] });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const content = isFaq ? faqCsvTemplate : productCsvTemplate;
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isFaq ? 'faq_template.csv' : 'product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2A]">
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#E8500A]" />
            Bulk import {isFaq ? 'FAQs' : 'Products'}
          </h3>
          <button onClick={onClose} className="text-[#666] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          // ── RESULT SCREEN ─────────────────────────────────────
          <div className="p-6 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${result.inserted > 0 ? 'bg-[#1A2A1A]' : 'bg-[#2A1515]'}`}>
              {result.inserted > 0
                ? <CheckCircle2 className="w-5 h-5 text-[#4ADE80]" />
                : <AlertCircle className="w-5 h-5 text-[#F87171]" />}
            </div>
            <h4 className="text-white text-base font-semibold mb-1">
              {result.inserted > 0 ? `${result.inserted} ${isFaq ? 'FAQs' : 'products'} imported` : 'Import failed'}
            </h4>
            {result.skipped > 0 && (
              <p className="text-[#888] text-xs mb-1">{result.skipped} rows skipped</p>
            )}
            {result.errors?.length > 0 && (
              <p className="text-[#F87171] text-xs mt-2 px-4">{result.errors[0]}</p>
            )}
            <button onClick={onClose} className="mt-5 bg-[#E8500A] hover:bg-[#D14709] text-white text-sm font-medium rounded-lg px-5 py-2.5">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Mode tabs */}
            <div className="flex gap-1 px-5 pt-4">
              <button onClick={() => setMode('paste')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${mode === 'paste' ? 'bg-[#E8500A] text-white' : 'bg-[#0F0F0F] text-[#888] border border-[#2A2A2A]'}`}>
                <FileText className="w-3.5 h-3.5" /> Paste text
              </button>
              <button onClick={() => setMode('file')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${mode === 'file' ? 'bg-[#E8500A] text-white' : 'bg-[#0F0F0F] text-[#888] border border-[#2A2A2A]'}`}>
                <Upload className="w-3.5 h-3.5" /> Upload CSV
              </button>
              <button onClick={downloadTemplate} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#888] hover:text-white">
                <Download className="w-3.5 h-3.5" /> Template
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1">
              {mode === 'paste' && (
                <>
                  <textarea
                    value={rawText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={isFaq
                      ? `Paste CSV (question,answer,category) or simple Q&A text:\n\n${faqTextTemplate}`
                      : 'Paste CSV: name,description,price,category'}
                    rows={8}
                    className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-xs placeholder-[#555] focus:outline-none focus:border-[#E8500A] font-mono resize-none"
                  />
                  {isFaq && (
                    <p className="text-[#555] text-[11px] mt-1.5">Tip: paste plain "Q: ... / A: ..." pairs separated by blank lines, or CSV with a header row.</p>
                  )}
                </>
              )}

              {mode === 'file' && (
                <label className="block border-2 border-dashed border-[#2A2A2A] hover:border-[#E8500A] rounded-xl p-8 text-center cursor-pointer transition-colors">
                  <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
                  <Upload className="w-6 h-6 text-[#666] mx-auto mb-2" />
                  <p className="text-[#888] text-sm">{fileName || 'Click to choose a CSV file'}</p>
                  <p className="text-[#555] text-[11px] mt-1">Header row required: {isFaq ? 'question, answer, category' : 'name, description, price, category'}</p>
                </label>
              )}

              {/* Preview */}
              {preview.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[#888] text-xs font-medium">Preview — {preview.length} ready to import</p>
                    {invalidCount > 0 && <p className="text-[#FBBF24] text-[11px]">{invalidCount} rows skipped (missing required fields)</p>}
                  </div>
                  <div className="border border-[#2A2A2A] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {preview.slice(0, 8).map((row, i) => (
                      <div key={i} className="px-3 py-2 border-b border-[#2A2A2A] last:border-b-0 bg-[#0F0F0F]">
                        <p className="text-white text-xs font-medium truncate">{isFaq ? row.question : row.name}</p>
                        <p className="text-[#666] text-[11px] truncate">{isFaq ? row.answer : row.description}</p>
                      </div>
                    ))}
                    {preview.length > 8 && (
                      <p className="text-[#555] text-[11px] text-center py-2 bg-[#0F0F0F]">+ {preview.length - 8} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2A2A2A]">
              <button onClick={onClose} className="text-[#888] hover:text-white text-xs font-medium px-3 py-2">Cancel</button>
              <button
                onClick={handleImport}
                disabled={!preview.length || importing}
                className="bg-[#E8500A] hover:bg-[#D14709] disabled:opacity-40 text-white text-sm font-medium rounded-lg px-5 py-2.5 flex items-center gap-2"
              >
                {importing ? 'Importing...' : `Import ${preview.length || ''} ${isFaq ? 'FAQs' : 'products'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FAQ EDITOR ROW
// ════════════════════════════════════════════════════════════════
function FaqRow({ faq, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(faq.question);
  const [a, setA] = useState(faq.answer);

  const save = () => {
    onSave({ ...faq, question: q, answer: a });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-[#1A1A1A] border border-[#E8500A] rounded-xl p-4">
        <input value={q} onChange={e => setQ(e.target.value)} className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-[#E8500A]" placeholder="Question" />
        <textarea value={a} onChange={e => setA(e.target.value)} rows={2} className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-[#E8500A] resize-none" placeholder="Answer" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-[#888] px-3 py-1.5 hover:text-white">Cancel</button>
          <button onClick={save} className="flex items-center gap-1.5 bg-[#E8500A] text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-[#D14709]">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 group hover:border-[#3A3A3A] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium mb-1">{faq.question}</p>
          <p className="text-[#888] text-xs leading-relaxed">{faq.answer}</p>
          {faq.category && <span className="inline-block mt-2 bg-[#2A1F18] text-[#E8500A] text-[10px] font-medium px-2 py-0.5 rounded">{faq.category}</span>}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => setEditing(true)} className="p-1.5 text-[#888] hover:text-white hover:bg-[#2A2A2A] rounded-md"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(faq.id)} className="p-1.5 text-[#888] hover:text-[#F87171] hover:bg-[#2A2A2A] rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:    { bg: '#1A2A1A', text: '#4ADE80', label: 'Active' },
    resolved:  { bg: '#1A1F2A', text: '#60A5FA', label: 'Resolved' },
    handover:  { bg: '#2A1F15', text: '#FBBF24', label: 'Human requested' },
    new:       { bg: '#2A1F15', text: '#FBBF24', label: 'New' },
    contacted: { bg: '#1A1F2A', text: '#60A5FA', label: 'Contacted' },
    converted: { bg: '#1A2A1A', text: '#4ADE80', label: 'Converted' },
  };
  const s = map[status] || map.new;
  return (
    <span style={{ background: s.bg, color: s.text }} className="text-[10px] font-medium px-2 py-0.5 rounded-full">
      {s.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// TRAIN AGENT TAB
// This is the core "train your agent" surface. Every field here
// writes to client_config and feeds directly into the system prompt
// that n8n's Code in JavaScript2 node builds for every conversation.
// ════════════════════════════════════════════════════════════════
function FormField({ label, value, onChange, placeholder, multiline, hint }) {
  return (
    <div className="mb-4">
      <label className="block text-[#AAA] text-xs font-medium mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#E8500A] transition-colors resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#E8500A] transition-colors"
        />
      )}
      {hint && <p className="text-[#555] text-[11px] mt-1">{hint}</p>}
    </div>
  );
}

function TrainAgentTab({ user }) {
  const [settings, setSettings] = useState({
    ai_persona_name: user.ai_persona_name || 'Ava',
    ai_greeting: user.ai_greeting || '',
    business_name: user.business_name || '',
    business_type: user.business_type || '',
    location: user.location || '',
    phone: user.phone || '',
    email: user.email || '',
    whatsapp: user.whatsapp || '',
    website: user.website || '',
    opening_hours: user.opening_hours || '24/7',
    human_support_name: user.human_support_name || '',
    human_support_contact: user.human_support_contact || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewMsg, setPreviewMsg] = useState('What services do you offer?');

  const update = (field) => (value) => setSettings(s => ({ ...s, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgentSettings(user.client_id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save agent settings:', err);
      alert('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const greeting = settings.ai_greeting ||
    `Hi! I'm ${settings.ai_persona_name || 'Ava'}, how can I help you with ${settings.business_name || 'us'} today?`;

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT — Settings forms */}
        <div className="lg:col-span-3 space-y-5">

          {/* Agent Identity */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
            <h3 className="text-white text-sm font-semibold mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E8500A]" /> Agent identity
            </h3>
            <p className="text-[#666] text-xs mb-4">How your AI agent introduces itself to every visitor.</p>

            <FormField
              label="Agent name"
              value={settings.ai_persona_name}
              onChange={update('ai_persona_name')}
              placeholder="Ava"
              hint="Your agent will never refer to itself as an AI or bot — always by this name."
            />
            <FormField
              label="Custom greeting (optional)"
              value={settings.ai_greeting}
              onChange={update('ai_greeting')}
              placeholder={`Hi! I'm ${settings.ai_persona_name || 'Ava'}, how can I help today?`}
              multiline
              hint="Leave blank to use the default greeting shown in the preview."
            />
          </div>

          {/* Business Info */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
            <h3 className="text-white text-sm font-semibold mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#E8500A]" /> Business information
            </h3>
            <p className="text-[#666] text-xs mb-4">Used by your agent to answer questions accurately.</p>

            <div className="grid grid-cols-2 gap-x-3">
              <FormField label="Business name" value={settings.business_name} onChange={update('business_name')} placeholder="Your Company Ltd" />
              <FormField label="Business type" value={settings.business_type} onChange={update('business_type')} placeholder="e.g. Insurance, Retail" />
            </div>
            <FormField label="Location" value={settings.location} onChange={update('location')} placeholder="Lagos, Nigeria" />
            <div className="grid grid-cols-2 gap-x-3">
              <FormField label="Phone" value={settings.phone} onChange={update('phone')} placeholder="+234 800 000 0000" />
              <FormField label="WhatsApp" value={settings.whatsapp} onChange={update('whatsapp')} placeholder="+234 800 000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-x-3">
              <FormField label="Email" value={settings.email} onChange={update('email')} placeholder="hello@business.com" />
              <FormField label="Website" value={settings.website} onChange={update('website')} placeholder="business.com" />
            </div>
            <FormField label="Opening hours" value={settings.opening_hours} onChange={update('opening_hours')} placeholder="24/7 or Mon-Fri 9am-5pm" />
          </div>

          {/* Human Escalation */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
            <h3 className="text-white text-sm font-semibold mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#E8500A]" /> Human escalation
            </h3>
            <p className="text-[#666] text-xs mb-4">Who your agent hands off to when a visitor needs a real person.</p>

            <div className="grid grid-cols-2 gap-x-3">
              <FormField label="Support contact name" value={settings.human_support_name} onChange={update('human_support_name')} placeholder="Support Team" />
              <FormField label="Support phone/WhatsApp" value={settings.human_support_contact} onChange={update('human_support_contact')} placeholder="+234 800 000 0000" />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#E8500A] hover:bg-[#D14709] disabled:opacity-60 text-white text-sm font-medium rounded-lg py-3 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save & retrain agent'}
          </button>
          <p className="text-[#555] text-[11px] text-center">Changes apply to every new conversation immediately — no restart needed.</p>
        </div>

        {/* RIGHT — Live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <p className="text-[#888] text-xs font-medium mb-2">Live preview</p>
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
              <div className="bg-[#E8500A] px-4 py-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4ADE80]"></span>
                <span className="text-white text-sm font-semibold">{settings.ai_persona_name || 'Ava'}</span>
              </div>
              <div className="p-4 bg-[#0F0F0F] min-h-[280px] space-y-3">
                <div className="bg-white/5 text-[#ddd] text-xs rounded-xl rounded-bl-sm px-3 py-2 max-w-[85%] leading-relaxed">
                  {greeting}
                </div>
                <div className="bg-[#E8500A] text-white text-xs rounded-xl rounded-br-sm px-3 py-2 max-w-[85%] ml-auto leading-relaxed">
                  {previewMsg}
                </div>
                <div className="bg-white/5 text-[#ddd] text-xs rounded-xl rounded-bl-sm px-3 py-2 max-w-[85%] leading-relaxed">
                  {settings.business_name
                    ? `Great question! At ${settings.business_name}, we offer a range of services tailored to your needs. Would you like me to walk you through our most popular options?`
                    : 'Add your business name above to see a realistic preview here.'}
                </div>
              </div>
              <div className="px-4 py-2.5 border-t border-[#2A2A2A]">
                <input
                  value={previewMsg}
                  onChange={(e) => setPreviewMsg(e.target.value)}
                  placeholder="Try a different question..."
                  className="w-full bg-transparent text-white text-xs placeholder-[#555] focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[#555] text-[11px] text-center mt-3">This preview is illustrative — your live agent uses your FAQs and products too.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════════════════════
function Dashboard({ user, onLogout, onUserRefresh }) {
  const [tab, setTab] = useState('train');
  const [faqs, setFaqs] = useState([]);
  const [products, setProducts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const [widgetKey, setWidgetKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkImportOpen, setBulkImportOpen] = useState(null); // null | 'faqs' | 'products'
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);
  const [upgradePaymentPending, setUpgradePaymentPending] = useState(false);

  // Resolve business-type-specific labels, fields and status options
  // once per render — cheap, pure function, no need to memoize.
  const typeConfig = getBusinessTypeConfig(user.business_type);

  // Fetch all real data once when the dashboard mounts for this client
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      try {
        const [faqRows, productRows, convoRows, leadRows, bookingRows, complaintRows, handoverRows, widgetRow] = await Promise.all([
          getFaqs(user.client_id),
          getProducts(user.client_id),
          getRecentConversations(user.client_id, 100),
          getLeads(user.client_id),
          getBookings(user.client_id),
          getComplaints(user.client_id),
          getHandoverSessions(user.client_id),
          getWidgetKey(user.client_id),
        ]);
        if (cancelled) return;
        setFaqs(faqRows);
        setProducts(productRows);
        setConversations(groupConversationsBySession(convoRows));
        setLeads(leadRows);
        setBookings(bookingRows);
        setComplaints(complaintRows);
        setHandovers(handoverRows);
        setWidgetKey(widgetRow?.widget_key || '');
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    // Live updates — new conversations appear without a manual refresh
    const unsubscribe = subscribeToConversations(user.client_id, () => {
      getRecentConversations(user.client_id, 100).then((rows) => {
        setConversations(groupConversationsBySession(rows));
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user.client_id]);

  const embedSnippet = `<script>
  const OD2MK_WIDGET_KEY = "${widgetKey}";
  const OD2MK_WEBHOOK_URL = "https://your-n8n.app.n8n.cloud/webhook/front-desk";
  // ... full script in your downloaded od2mk_widget_resolution.js file
</script>`;

  const copyEmbed = () => {
    navigator.clipboard?.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const addFaq = async () => {
    if (!newQ.trim() || !newA.trim()) return;
    try {
      const faq = await addFaqDb(user.client_id, newQ, newA, 'General');
      setFaqs([faq, ...faqs]);
      setNewQ(''); setNewA(''); setShowAddFaq(false);
      showToast('FAQ added to your knowledge base');
    } catch (err) {
      console.error('Failed to add FAQ:', err);
      showToast('Could not add FAQ — please try again');
    }
  };

  const saveFaq = async (updated) => {
    try {
      const saved = await updateFaqDb(updated.id, {
        question: updated.question,
        answer: updated.answer,
        category: updated.category,
      });
      setFaqs(faqs.map(f => f.id === saved.id ? saved : f));
      showToast('FAQ updated');
    } catch (err) {
      console.error('Failed to update FAQ:', err);
      showToast('Could not update FAQ — please try again');
    }
  };

  const deleteFaq = async (id) => {
    try {
      await deleteFaqDb(id);
      setFaqs(faqs.filter(f => f.id !== id));
      showToast('FAQ removed');
    } catch (err) {
      console.error('Failed to delete FAQ:', err);
      showToast('Could not remove FAQ — please try again');
    }
  };

  // ── BULK IMPORT ───────────────────────────────────────────────
  const handleBulkImportFaqs = async (rows) => {
    const res = await addFaqsBulk(user.client_id, rows);
    if (res.inserted > 0) {
      const refreshed = await getFaqs(user.client_id);
      setFaqs(refreshed);
      showToast(`${res.inserted} FAQs imported`);
    }
    return res;
  };

  const handleBulkImportProducts = async (rows) => {
    const res = await addProductsBulk(user.client_id, rows);
    if (res.inserted > 0) {
      const refreshed = await getProducts(user.client_id);
      setProducts(refreshed);
      showToast(`${res.inserted} products imported`);
    }
    return res;
  };

  // ── STATUS UPDATES ────────────────────────────────────────────
  const handleUpdateLeadStatus = async (leadId, status) => {
    try {
      const updated = await updateLeadStatus(leadId, status);
      setLeads(leads.map(l => l.id === leadId ? updated : l));
      showToast('Lead status updated');
    } catch (err) {
      console.error('Failed to update lead:', err);
      showToast('Could not update lead — please try again');
    }
  };

  const handleUpdateBookingStatus = async (bookingId, status) => {
    try {
      const updated = await updateBookingStatus(bookingId, status);
      setBookings(bookings.map(b => b.id === bookingId ? updated : b));
      showToast('Booking status updated');
    } catch (err) {
      console.error('Failed to update booking:', err);
      showToast('Could not update booking — please try again');
    }
  };

  const handleUpdateComplaintStatus = async (complaintId, status) => {
    try {
      const updated = await updateComplaintStatus(complaintId, status);
      setComplaints(complaints.map(c => c.id === complaintId ? updated : c));
      showToast('Status updated');
    } catch (err) {
      console.error('Failed to update complaint:', err);
      showToast('Could not update — please try again');
    }
  };

  const handleUpdateHandoverStatus = async (handoverId, status) => {
    try {
      const updated = await updateHandoverStatus(handoverId, status);
      setHandovers(handovers.map(h => h.id === handoverId ? updated : h));
      showToast('Status updated');
    } catch (err) {
      console.error('Failed to update handover:', err);
      showToast('Could not update — please try again');
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Top bar */}
      <header className="border-b border-[#2A2A2A] bg-[#141414]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E8500A] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-medium leading-tight">{user.business_name}</p>
              <p className="text-[#666] text-xs leading-tight">client_id: <span className="font-mono text-[#888]">{user.client_id}</span></p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-[#888] hover:text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-[#2A2A2A] transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Trial countdown banner — only shown during active trial */}
        {user.payment_status === 'trial' && (
          <div className="flex items-center justify-between gap-3 bg-[#1A1310] border border-[#3A2415] rounded-lg px-4 py-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FBBF24] flex-shrink-0" />
              <p className="text-[#FBBF24] text-xs">Free trial — {formatTimeRemaining(user.trial_ends_at)}. Subscribe to keep access after it ends.</p>
            </div>
            <button onClick={() => setShowPricingModal(true)} className="flex items-center gap-1.5 bg-[#E8500A] hover:bg-[#D14709] text-white text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors flex-shrink-0">
              <CreditCard className="w-3 h-3" /> Subscribe now
            </button>
          </div>
        )}

        {/* Isolation banner */}
        <div className="flex items-center gap-2 bg-[#15201A] border border-[#2A3F2A] rounded-lg px-4 py-2.5 mb-6">
          <CheckCircle2 className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />
          <p className="text-[#4ADE80] text-xs">You're viewing data from yur agent  to <strong>{user.client_id}</strong> only. you and your assigned staffs can access and update this page.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-1 w-fit flex-wrap">
          <button onClick={() => setTab('train')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'train' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <Sparkles className="w-3.5 h-3.5" /> Train Agent
          </button>
          <button onClick={() => setTab('conversations')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'conversations' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <MessageSquare className="w-3.5 h-3.5" /> Conversations ({conversations.length})
          </button>
          <button onClick={() => setTab('leads')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'leads' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <Users className="w-3.5 h-3.5" /> Leads ({leads.length})
          </button>
          <button onClick={() => setTab('bookings')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'bookings' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <Calendar className="w-3.5 h-3.5" /> {typeConfig.bookings.tabLabel} ({bookings.length})
          </button>
          <button onClick={() => setTab('complaints')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'complaints' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> {typeConfig.complaints.tabLabel} ({complaints.length})
          </button>
          <button onClick={() => setTab('handovers')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'handovers' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <PhoneCall className="w-3.5 h-3.5" /> Human Requests ({handovers.filter(h => h.status === 'pending').length})
          </button>
          <button onClick={() => setTab('faqs')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'faqs' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <HelpCircle className="w-3.5 h-3.5" /> FAQs ({faqs.length})
          </button>
          <button onClick={() => setTab('products')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'products' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <Package className="w-3.5 h-3.5" /> Products ({products.length})
          </button>
          <button onClick={() => setTab('embed')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'embed' ? 'bg-[#E8500A] text-white' : 'text-[#888] hover:text-white'}`}>
            <Code2 className="w-3.5 h-3.5" /> Widget setup
          </button>
        </div>

        {tab === 'train' && <TrainAgentTab user={user} />}

        {tab === 'conversations' && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Live widget conversations</h2>
            <p className="text-[#666] text-xs mb-4">Every conversation from your installed widget at {user.business_name}'s website.</p>
            <div className="space-y-2.5">
              {conversations.map(c => {
                const isOpen = expandedSession === c.session_id;
                const sortedMessages = [...c.messages].sort(
                  (a, b) => new Date(a.created_at) - new Date(b.created_at)
                );
                return (
                  <div key={c.session_id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden hover:border-[#3A3A3A] transition-colors">
                    <button
                      onClick={() => setExpandedSession(isOpen ? null : c.session_id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">Session {c.session_id.slice(-8)}</span>
                          <span className="text-[#555] text-[10px]">{c.messages.length} message{c.messages.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[#666] text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {c.last_time ? new Date(c.last_time).toLocaleString() : ''}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-[#666] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      <p className="text-[#AAA] text-xs mb-1 leading-relaxed truncate">
                        {c.last_message ? `"${c.last_message}"` : 'No message text recorded'}
                      </p>
                      <p className="text-[#555] text-[10px] font-mono">{c.session_id}</p>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[#2A2A2A] bg-[#0F0F0F] p-4 space-y-2.5 max-h-96 overflow-y-auto">
                        {sortedMessages.map((m, i) => (
                          <div
                            key={i}
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              m.role === 'assistant'
                                ? 'bg-[#1A1A1A] text-[#ddd] rounded-bl-sm'
                                : 'bg-[#E8500A] text-white ml-auto rounded-br-sm'
                            }`}
                          >
                            <p>{m.message}</p>
                            <p className={`text-[10px] mt-1 ${m.role === 'assistant' ? 'text-[#666]' : 'text-white/60'}`}>
                              {m.role === 'assistant' ? (m.agent_name || 'Agent') : 'Visitor'} · {new Date(m.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {conversations.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No conversations yet. Install your widget to start receiving chats.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Leads captured</h2>
            <p className="text-[#666] text-xs mb-4">Prospects who showed interest through your widget.</p>
            <div className="space-y-2.5">
              {leads.map(l => (
                <div key={l.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-white text-sm font-medium">{l.customer_name}</span>
                    <select
                      value={l.status}
                      onChange={(e) => handleUpdateLeadStatus(l.id, e.target.value)}
                      className="bg-[#0F0F0F] border border-[#2A2A2A] text-[#888] text-[10px] rounded-md px-2 py-1 focus:outline-none focus:border-[#E8500A]"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="converted">Converted</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <div className="text-[#888] text-xs space-y-0.5 mb-2">
                    <p>{l.customer_email} · {l.customer_phone}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="bg-[#2A1F18] text-[#E8500A] text-[10px] font-medium px-2 py-0.5 rounded">{typeConfig.leads.interestLabel}: {l.interest}</span>
                    <span className="text-[#555] text-[10px]">{l.created_at}</span>
                  </div>
                </div>
              ))}
              {leads.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No leads captured yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">{typeConfig.bookings.heading}</h2>
            <p className="text-[#666] text-xs mb-4">{typeConfig.bookings.subheading}</p>
            <div className="space-y-2.5">
              {bookings.map(b => (
                <div key={b.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-white text-sm font-medium">{b.customer_name || 'Unnamed customer'}</span>
                    <select
                      value={b.status}
                      onChange={(e) => handleUpdateBookingStatus(b.id, e.target.value)}
                      className="bg-[#0F0F0F] border border-[#2A2A2A] text-[#888] text-[10px] rounded-md px-2 py-1 focus:outline-none focus:border-[#E8500A]"
                    >
                      {typeConfig.bookings.statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[#888] text-xs space-y-0.5 mb-2">
                    <p>{b.customer_email} · {b.customer_phone}</p>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-[#2A1F18] text-[#E8500A] text-[10px] font-medium px-2 py-0.5 rounded">{typeConfig.bookings.serviceLabel}: {b.service}</span>
                    <span className="text-[#555] text-[10px]">{b.created_at}</span>
                  </div>
                  {(b.preferred_date || b.preferred_time) && (
                    <div className="flex items-center gap-1.5 text-[#AAA] text-xs bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-2.5 py-1.5">
                      <Calendar className="w-3 h-3 text-[#E8500A] flex-shrink-0" />
                      {b.preferred_date || 'Date TBC'}{b.preferred_time ? ` at ${b.preferred_time}` : ''}
                    </div>
                  )}
                  {b.notes && (
                    <p className="text-[#666] text-[11px] mt-2 leading-relaxed">{b.notes}</p>
                  )}
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No {typeConfig.bookings.tabLabel.toLowerCase()} yet. They'll appear here as your widget collects them.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'complaints' && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">{typeConfig.complaints.heading}</h2>
            <p className="text-[#666] text-xs mb-4">{typeConfig.complaints.subheading}</p>
            <div className="space-y-2.5">
              {complaints.map(c => (
                <div key={c.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-white text-sm font-medium">{c.customer_name || 'Unnamed customer'}</span>
                    <select
                      value={c.status}
                      onChange={(e) => handleUpdateComplaintStatus(c.id, e.target.value)}
                      className="bg-[#0F0F0F] border border-[#2A2A2A] text-[#888] text-[10px] rounded-md px-2 py-1 focus:outline-none focus:border-[#E8500A]"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <p className="text-[#888] text-xs mb-2">{c.customer_email}</p>
                  <p className="text-[#AAA] text-xs leading-relaxed bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-3 py-2">{c.complaint}</p>
                  <p className="text-[#555] text-[10px] mt-2">{c.created_at}</p>
                </div>
              ))}
              {complaints.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No {typeConfig.complaints.tabLabel.toLowerCase()} yet — hopefully it stays that way.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'handovers' && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Human takeover requests</h2>
            <p className="text-[#666] text-xs mb-4">Conversations where a visitor asked to speak with a real person instead of the AI agent.</p>
            <div className="space-y-2.5">
              {handovers.map(h => (
                <div key={h.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-white text-sm font-medium flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-[#E8500A]" /> Session {h.session_id?.slice(-8) || ''}
                    </span>
                    <select
                      value={h.status}
                      onChange={(e) => handleUpdateHandoverStatus(h.id, e.target.value)}
                      className="bg-[#0F0F0F] border border-[#2A2A2A] text-[#888] text-[10px] rounded-md px-2 py-1 focus:outline-none focus:border-[#E8500A]"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  {h.user_message && (
                    <p className="text-[#AAA] text-xs leading-relaxed bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-3 py-2 mb-2">"{h.user_message}"</p>
                  )}
                  {h.agent_name && (
                    <p className="text-[#666] text-[11px]">Assigned to: {h.agent_name}</p>
                  )}
                  <p className="text-[#555] text-[10px] mt-2">{h.created_at}</p>
                </div>
              ))}
              {handovers.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No human takeover requests yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'embed' && (
          <div>
            <h2 className="text-white text-lg font-semibold mb-1">Your widget embed code</h2>
            <p className="text-[#666] text-xs mb-4">Paste this once into your website, just before the closing &lt;/body&gt; tag. Your widget key is unique and pre-configured — nothing else to set up.</p>

            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#888] text-xs font-medium">Your unique widget key</span>
              </div>
              <code className="text-[#E8500A] text-sm font-mono">{widgetKey}</code>
            </div>

            <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl p-4 relative">
              <button onClick={copyEmbed} className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#1A1A1A] border border-[#2A2A2A] text-[#888] hover:text-white text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <pre className="text-[#888] text-[11px] font-mono leading-relaxed overflow-x-auto pr-20">{embedSnippet}</pre>
            </div>

            <div className="mt-4 flex items-center gap-2 bg-[#15201A] border border-[#2A3F2A] rounded-lg px-4 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />
              <p className="text-[#4ADE80] text-xs">Every conversation through this widget is automatically tagged to your account — no manual configuration needed.</p>
            </div>
          </div>
        )}

        {tab === 'faqs' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-semibold">Knowledge Base — FAQs</h2>
              <div className="flex gap-2">
                <button onClick={() => setBulkImportOpen('faqs')} className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#E8500A] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Bulk import
                </button>
                <button onClick={() => setShowAddFaq(!showAddFaq)} className="flex items-center gap-1.5 bg-[#E8500A] hover:bg-[#D14709] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add FAQ
                </button>
              </div>
            </div>

            {showAddFaq && (
              <div className="bg-[#1A1A1A] border border-[#E8500A] rounded-xl p-4 mb-4">
                <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Question" className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-[#E8500A]" />
                <textarea value={newA} onChange={e => setNewA(e.target.value)} placeholder="Answer" rows={2} className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-md px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-[#E8500A] resize-none" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddFaq(false)} className="text-xs text-[#888] px-3 py-1.5 hover:text-white">Cancel</button>
                  <button onClick={addFaq} className="bg-[#E8500A] text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-[#D14709]">Add to knowledge base</button>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {faqs.map(faq => (
                <FaqRow key={faq.id} faq={faq} onSave={saveFaq} onDelete={deleteFaq} />
              ))}
              {faqs.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No FAQs yet. Add one above, or bulk import a whole list.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-semibold">Products & Services</h2>
              <button onClick={() => setBulkImportOpen('products')} className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#E8500A] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                <Upload className="w-3.5 h-3.5" /> Bulk import
              </button>
            </div>
            <div className="space-y-2.5">
              {products.map(p => (
                <div key={p.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{p.name}</p>
                      <p className="text-[#888] text-xs mt-1">{p.description}</p>
                    </div>
                    <span className="text-[#E8500A] text-sm font-semibold flex-shrink-0">{p.price}</span>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div className="text-center py-12 text-[#555] text-sm">No products yet. Bulk import a price list to get started fast.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk import modal */}
      {bulkImportOpen && (
        <BulkImportModal
          type={bulkImportOpen}
          onClose={() => setBulkImportOpen(null)}
          onImport={bulkImportOpen === 'faqs' ? handleBulkImportFaqs : handleBulkImportProducts}
        />
      )}

      {/* Pricing / subscribe modal — for clients mid-trial who want to upgrade early */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-base font-semibold">Choose your plan</h3>
              <button onClick={() => setShowPricingModal(false)} className="text-[#666] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {upgradePaymentPending ? (
              <div className="text-center py-10">
                <div className="w-10 h-10 border-2 border-[#2A2A2A] border-t-[#E8500A] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-sm font-medium mb-1">Confirming your payment...</p>
                <p className="text-[#888] text-xs">This usually takes a few seconds.</p>
              </div>
            ) : (
              <PricingTiers
                user={user}
                onPaymentInitiated={() => {
                  setUpgradePaymentPending(true);
                  // Poll briefly, then refresh the parent's user object
                  // once payment_status flips to 'paid' server-side.
                  let attempts = 0;
                  const interval = setInterval(async () => {
                    attempts += 1;
                    const refreshed = await getCurrentClientSession();
                    if (refreshed && refreshed.payment_status === 'paid') {
                      clearInterval(interval);
                      setUpgradePaymentPending(false);
                      setShowPricingModal(false);
                      onUserRefresh?.(refreshed);
                      showToast('Payment confirmed — plan updated!');
                    } else if (attempts >= 20) {
                      clearInterval(interval);
                      setUpgradePaymentPending(false);
                    }
                  }, 3000);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A1A1A] border border-[#2A2A2A] text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" /> {toast}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAYMENT LOCK SCREEN — shown when trial expired and unpaid
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// PRICING TIERS — fetches real plans from Supabase, opens Paystack
// checkout on selection. Reusable across PaymentLockScreen and the
// trial countdown banner's "Subscribe" flow.
// ════════════════════════════════════════════════════════════════
function PricingTiers({ user, onPaymentInitiated }) {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkingOutPlan, setCheckingOutPlan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .catch(err => {
        console.error('Failed to load plans:', err);
        setError('Could not load pricing. Please refresh and try again.');
      })
      .finally(() => setLoadingPlans(false));
  }, []);

  const handleSelectPlan = async (plan) => {
    setError('');
    setCheckingOutPlan(plan.plan_code);
    try {
      const response = await startPaystackCheckout({
        email: user.email,
        clientId: user.client_id,
        plan,
      });
      // Paystack's client-side callback fired — this is UI feedback
      // only. The authoritative unlock happens when Paystack's
      // webhook reaches your n8n flow and calls mark_client_paid().
      // We still notify the parent so it can show a "processing,
      // check back shortly" state rather than leaving the user stuck.
      onPaymentInitiated(response);
    } catch (err) {
      // err is also thrown if the user simply closes the modal —
      // that's not a real error, so don't show scary red text for it.
      if (err.message !== 'Payment window closed before completing.') {
        console.error('Paystack checkout error:', err);
        setError(err.message || 'Something went wrong starting checkout.');
      }
    } finally {
      setCheckingOutPlan(null);
    }
  };

  if (loadingPlans) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#2A2A2A] border-t-[#E8500A] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 bg-[#2A1515] border border-[#5A2A2A] rounded-lg px-3 py-2.5 text-[#F87171] text-xs mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plans.map((plan, i) => {
          const isPopular = i === 1; // middle tier highlighted, matches typical 3-tier convention
          return (
            <div
              key={plan.plan_code}
              className={`relative bg-[#1A1A1A] border rounded-xl p-5 flex flex-col ${isPopular ? 'border-[#E8500A]' : 'border-[#2A2A2A]'}`}
            >
              {isPopular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#E8500A] text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full">
                  Most popular
                </span>
              )}
              <p className="text-white text-sm font-semibold mb-1">{plan.name}</p>
              <p className="text-white text-2xl font-bold mb-1">
                {formatNaira(plan.price_ngn_kobo)}
                <span className="text-[#666] text-xs font-normal">/{plan.billing_period}</span>
              </p>
              <p className="text-[#666] text-[11px] mb-4">{plan.description}</p>

              <ul className="space-y-1.5 mb-5 flex-1">
                {(plan.features || []).map((f, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[#AAA] text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-[#4ADE80] flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={checkingOutPlan === plan.plan_code}
                className={`w-full text-xs font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2 ${
                  isPopular
                    ? 'bg-[#E8500A] hover:bg-[#D14709] text-white'
                    : 'bg-[#0F0F0F] border border-[#2A2A2A] hover:border-[#E8500A] text-white'
                } disabled:opacity-60`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                {checkingOutPlan === plan.plan_code ? 'Opening checkout...' : `Choose ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[#555] text-[11px] text-center mt-4">Secure checkout powered by Paystack. Cards, bank transfer and USSD accepted.</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAYMENT LOCK SCREEN — shown when trial expired and unpaid
// ════════════════════════════════════════════════════════════════
function PaymentLockScreen({ user, onLogout, onPaymentInitiated, paymentPending }) {
  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-[#E8500A] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">OD2MK <span className="text-[#E8500A]">KB Portal</span></span>
        </div>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-[#2A1F15] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-[#FBBF24]" />
          </div>
          <h1 className="text-white text-lg font-semibold mb-2">Your free trial has ended</h1>
          <p className="text-[#888] text-sm leading-relaxed">{user.business_name}'s 24-hour trial expired. Choose a plan below to reactivate your AI agent and dashboard instantly.</p>
        </div>

        {paymentPending ? (
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 text-center max-w-md mx-auto">
            <div className="w-10 h-10 border-2 border-[#2A2A2A] border-t-[#E8500A] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-sm font-medium mb-1">Confirming your payment...</p>
            <p className="text-[#888] text-xs">This usually takes a few seconds. Your access unlocks automatically once confirmed — no need to refresh.</p>
          </div>
        ) : (
          <PricingTiers user={user} onPaymentInitiated={onPaymentInitiated} />
        )}

        <div className="text-center mt-8">
          <button onClick={onLogout} className="text-[#666] hover:text-white text-xs font-medium">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [paymentPending, setPaymentPending] = useState(false);

  // On load, check whether the visitor already has a valid session —
  // this is what catches them right after they click their magic link
  // and Supabase redirects them back to this app (detectSessionInUrl
  // handles reading the token from the URL automatically).
  useEffect(() => {
    getCurrentClientSession()
      .then(setUser)
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogout = async () => {
    await signOutDb();
    setUser(null);
  };

  // Called the instant Paystack's client-side checkout modal reports
  // success. This is NOT the authoritative confirmation — that comes
  // from Paystack's server-side webhook calling mark_client_paid()
  // via your n8n flow, which may land a second or two later. So we
  // show a "confirming" state and poll client_config until
  // payment_status flips to 'paid', rather than unlocking immediately
  // based on the client-side callback alone (which could be spoofed).
  const handlePaymentInitiated = () => {
    setPaymentPending(true);
  };

  useEffect(() => {
    if (!paymentPending) return;

    let attempts = 0;
    const maxAttempts = 20; // ~60 seconds at 3s intervals

    const interval = setInterval(async () => {
      attempts += 1;
      const refreshed = await getCurrentClientSession();
      if (refreshed && hasAccess(refreshed)) {
        setUser(refreshed);
        setPaymentPending(false);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        // Stop polling after ~1 minute — webhook may be delayed or
        // the payment may have failed. User can refresh manually,
        // or contact support; we don't want to poll forever.
        setPaymentPending(false);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentPending]);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2A2A2A] border-t-[#E8500A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  if (!hasAccess(user)) {
    return (
      <PaymentLockScreen
        user={user}
        onLogout={handleLogout}
        onPaymentInitiated={handlePaymentInitiated}
        paymentPending={paymentPending}
      />
    );
  }

  return <Dashboard user={user} onLogout={handleLogout} onUserRefresh={setUser} />;
}
