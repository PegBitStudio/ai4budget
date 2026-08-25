/**
 * Seeds a demo account with three months of realistic Nigerian household finances.
 * Usage: node scripts/seed-demo.mjs
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import fs from 'node:fs';
import path from 'node:path';

// --- Load .env.local ---
const envPath = path.join(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@kobo.app';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoBudget2026!';

const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

async function api(pathname, init = {}) {
  const res = await fetch(`${URL}${pathname}`, { ...init, headers: { ...h, ...(init.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text.slice(0, 400)}`);
  return json;
}

// --- 1. Find or create the demo user ---
async function ensureUser() {
  const list = await api('/auth/v1/admin/users?per_page=200');
  const existing = (list.users || []).find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    console.log(`Demo user exists: ${existing.id}`);
    return existing.id;
  }
  const created = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true }),
  });
  console.log(`Created demo user: ${created.id}`);
  return created.id;
}

// --- 2. Build three months of transactions ---
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const r = (n) => Math.round(n / 50) * 50;

function buildTransactions(userId) {
  const rows = [];
  const add = (date, description, amount, category, type = 'expense') =>
    rows.push({ user_id: userId, date, description, amount, category, type, source: 'demo-seed' });

  // Jun = baseline, Jul = mid, Aug = current (creeping costs + one anomaly)
  const months = [
    { y: 2026, m: 6, salary: 450000, dining: 1.0, transport: 1.0, subs: 1.0 },
    { y: 2026, m: 7, salary: 450000, dining: 1.28, transport: 1.15, subs: 1.0 },
    { y: 2026, m: 8, salary: 450000, dining: 1.62, transport: 1.42, subs: 1.35 },
  ];

  for (const { y, m, salary, dining, transport, subs } of months) {
    // Income
    // Payday on the 25th: the app rejects future-dated transactions, so a
    // later payday would leave the current month's salary unenterable.
    add(iso(y, m, 25), 'Salary - Zenith Bank credit', salary, 'Other', 'income');
    if (m !== 6) add(iso(y, m, 14), 'Freelance design payout', m === 8 ? 85000 : 60000, 'Other', 'income');

    // Housing
    add(iso(y, m, 1), 'Rent contribution - landlord', 150000, 'Housing');

    // Utilities
    add(iso(y, m, 3), 'EKEDC prepaid electricity', r(18500 * (m === 8 ? 1.3 : 1)), 'Utilities');
    add(iso(y, m, 5), 'MTN data bundle', 12000, 'Utilities');
    add(iso(y, m, 20), 'EKEDC prepaid top-up', r(9000 * (m === 8 ? 1.3 : 1)), 'Utilities');

    // Groceries
    add(iso(y, m, 2), 'Shoprite monthly stock-up', 38000, 'Groceries');
    add(iso(y, m, 9), 'Mile 12 market - vegetables', 9500, 'Groceries');
    add(iso(y, m, 16), 'Shoprite top-up', 14500, 'Groceries');
    add(iso(y, m, 23), 'Mile 12 market - provisions', 11000, 'Groceries');

    // Transport - creeping
    for (const d of [2, 6, 11, 15, 19, 24, 27]) {
      add(iso(y, m, d), 'Bolt ride to work', r(3200 * transport), 'Transport');
    }
    add(iso(y, m, 8), 'Fuel - Total filling station', r(22000 * transport), 'Transport');

    // Dining - the habit that grows
    for (const d of [4, 10, 13, 18, 22, 26]) {
      add(iso(y, m, d), 'Chicken Republic lunch', r(4800 * dining), 'Dining');
    }
    if (m >= 7) add(iso(y, m, 21), 'Jollof and Co. dinner delivery', r(12500 * dining), 'Dining');

    // Subscriptions - quiet creep in August
    add(iso(y, m, 7), 'Netflix subscription', r(7500 * subs), 'Subscriptions');
    add(iso(y, m, 7), 'Spotify Premium', 2500, 'Subscriptions');
    add(iso(y, m, 12), 'Gym membership - i-Fitness', 25000, 'Subscriptions');
    if (m === 8) add(iso(y, m, 15), 'Showmax subscription', 4400, 'Subscriptions');

    // Health
    add(iso(y, m, 17), 'HealthPlus pharmacy', 7800, 'Health');

    // Entertainment / Shopping
    add(iso(y, m, 25), 'Filmhouse cinema', 6500, 'Entertainment');
    add(iso(y, m, 19), 'Jumia - household items', 15500, 'Shopping');
  }

  // The anomaly the analyser should catch: a one-off Shopping spike in August
  rows.push({
    user_id: userId, date: iso(2026, 8, 22), description: 'Slot - replacement phone',
    amount: 285000, category: 'Shopping', type: 'expense', source: 'demo-seed',
  });

  return rows;
}

async function main() {
  const userId = await ensureUser();

  // Wipe prior demo data so the script is idempotent
  for (const table of ['transactions', 'budgets', 'savings_goals', 'commitments', 'spending_alerts']) {
    await api(`/rest/v1/${table}?user_id=eq.${userId}`, { method: 'DELETE' });
  }

  const txs = buildTransactions(userId);
  await api('/rest/v1/transactions', { method: 'POST', body: JSON.stringify(txs) });
  console.log(`Inserted ${txs.length} transactions`);

  await api('/rest/v1/budgets', {
    method: 'POST',
    body: JSON.stringify([{
      user_id: userId,
      period_type: 'monthly',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      total_income: 535000,
      allocations: [
        { category: 'Housing', amount: 150000 },
        { category: 'Groceries', amount: 70000 },
        { category: 'Transport', amount: 45000 },
        { category: 'Utilities', amount: 40000 },
        { category: 'Health', amount: 10000 },
        { category: 'Dining', amount: 30000 },
        { category: 'Subscriptions', amount: 35000 },
        { category: 'Entertainment', amount: 12000 },
        { category: 'Shopping', amount: 20000 },
        { category: 'Other', amount: 10000 },
      ],
    }]),
  });
  console.log('Inserted budget');

  await api('/rest/v1/savings_goals', {
    method: 'POST',
    body: JSON.stringify([{
      user_id: userId, target_amount: 1200000, deadline: '2027-06-30',
      current_amount: 185000, monthly_contribution: 90000,
    }]),
  });

  await api('/rest/v1/commitments', {
    method: 'POST',
    body: JSON.stringify([
      { user_id: userId, description: 'Rent contribution', amount: 150000, frequency: 'monthly', category: 'Housing' },
      { user_id: userId, description: 'Gym membership', amount: 25000, frequency: 'monthly', category: 'Subscriptions' },
      { user_id: userId, description: 'Netflix', amount: 7500, frequency: 'monthly', category: 'Subscriptions' },
      { user_id: userId, description: 'School fees savings', amount: 60000, frequency: 'monthly', category: 'Other' },
    ]),
  });
  console.log('Inserted savings goal + commitments');
  console.log(`\nDemo login -> ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
