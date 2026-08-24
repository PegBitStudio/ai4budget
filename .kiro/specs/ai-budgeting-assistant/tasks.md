# Implementation Plan: AI Budgeting Assistant

## Overview

A commercial-ready AI budgeting assistant built with Next.js 14 (App Router), Supabase (PostgreSQL + Auth + RLS), OpenAI GPT-4o-mini, Chart.js, Tailwind CSS, and PWA support. Implementation proceeds from project scaffolding through data layer, business logic, API routes, UI components, and finally integration wiring.

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Initialize Next.js 14 project with TypeScript, Tailwind CSS, and core dependencies
    - Create Next.js 14 app with App Router (`create-next-app --typescript --tailwind --app`)
    - Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `chart.js`, `react-chartjs-2`, `papaparse`, `@serwist/next`, `serwist`, `openai`, `zod`
    - Install dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `@types/papaparse`
    - Configure `tsconfig.json` with path aliases (`@/` pointing to `src/`)
    - _Requirements: All (foundational setup)_

  - [x] 1.2 Configure Supabase client utilities and environment variables
    - Create `src/lib/supabase/server.ts` with server-side Supabase client using cookies
    - Create `src/lib/supabase/client.ts` with browser-side Supabase client
    - Create `src/lib/supabase/middleware.ts` with auth middleware helper
    - Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`
    - _Requirements: 12.1, 12.4_

  - [x] 1.3 Set up Supabase database schema with RLS policies
    - Create SQL migration with all tables: `transactions`, `budgets`, `savings_goals`, `commitments`, `spending_alerts`, `classification_rules`
    - Apply RLS policies ensuring each user only accesses their own data
    - Create indexes for common queries (`idx_transactions_user_date`, `idx_transactions_user_category`, `idx_budgets_user_period`, `idx_alerts_user_period`)
    - Generate TypeScript types from Supabase schema into `src/lib/supabase/types.ts`
    - _Requirements: 12.1, 1.1, 1.5, 1.6, 9.1_

  - [x] 1.4 Configure PWA with @serwist/next and service worker
    - Configure `next.config.js` with `@serwist/next` plugin (swSrc, swDest, cacheOnNavigation)
    - Create `src/app/sw.ts` with precaching, runtime caching strategies (NetworkFirst for API, CacheFirst for static assets), and offline fallback
    - Create `src/app/manifest.ts` using Next.js Metadata API for web app manifest
    - Create `public/offline.html` static offline fallback page with retry button
    - Add PWA icons to `public/icons/` (192x192, 512x512, maskable variants)
    - _Requirements: 10.3 (browser rendering without additional software)_

  - [x] 1.5 Set up Vitest testing framework with fast-check
    - Create `vitest.config.ts` with path aliases and test environment settings
    - Create test setup file with any global mocks (Supabase client mock)
    - Add test scripts to `package.json` (`test`, `test:watch`, `test:coverage`)
    - Verify test runner works with a trivial test
    - _Requirements: All (testing infrastructure)_

  - [x] 1.6 Create Next.js middleware for auth guard
    - Create `src/middleware.ts` that validates Supabase auth sessions
    - Redirect unauthenticated users to `/login` for protected routes
    - Allow public routes: `/`, `/login`, `/signup`, `/offline`
    - _Requirements: 12.1, 12.4_

- [x] 2. Core TypeScript models and validation
  - [x] 2.1 Define TypeScript interfaces and Zod validation schemas
    - Create `src/models/transaction.ts` with `Transaction` interface and Zod schema (amount 0.01–999,999,999.99, ISO date not future, description 1–255 chars, type income/expense)
    - Create `src/models/budget.ts` with `Budget`, `CategoryAllocation`, `BudgetComparison` interfaces
    - Create `src/models/category.ts` with `Category` type union and `CATEGORIES` constant array
    - Create `src/models/savingsGoal.ts` with `SavingsGoal` interface and Zod schema
    - Create `src/models/commitment.ts` with `FinancialCommitment` interface and Zod schema (frequency: weekly/fortnightly/monthly/yearly)
    - Create `src/models/alert.ts` with `SpendingAlert` interface
    - Create `src/lib/validation.ts` with shared validation functions using Zod
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 2.2_

  - [ ]* 2.2 Write property tests for transaction validation (Property 1 & 2)
    - **Property 1: Transaction validation round trip** — For any valid transaction data, storing and retrieving produces identical field values
    - **Property 2: Invalid transaction rejection** — For any invalid transaction data, the validation function rejects and no data is stored
    - **Validates: Requirements 1.1, 1.4**

  - [x] 2.3 Create utility modules
    - Create `src/utils/dateUtils.ts` with budget period calculations (monthly: 1st to last day, weekly: Monday to Sunday), ISO date parsing, period overlap detection
    - Create `src/utils/formatters.ts` with currency formatting (2 decimal places), percentage formatting, date display formatting
    - Create `src/config/categories.ts` with category definitions, needs/wants classification for 50/30/20 heuristic
    - _Requirements: 3.1, 3.4, 4.2, 13.3_

- [x] 3. Checkpoint - Core models verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Classification engine
  - [x] 4.1 Implement rule-based classifier with LLM fallback
    - Create `src/lib/classifier.ts` implementing `IClassifier` interface
    - Implement three-tier classification: user corrections (exact match) → rule-based (regex patterns) → LLM fallback
    - Define `DEFAULT_RULES` with regex patterns for all 10 categories (Housing, Transport, Groceries, Utilities, Entertainment, Dining, Health, Shopping, Subscriptions, Other)
    - Implement `addUserCorrection()` that stores description→category mapping and applies to future identical descriptions
    - If both rule and LLM fail or LLM unavailable, assign "Other" and flag for manual review
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 4.2 Implement OpenAI LLM client (server-side only)
    - Create `src/lib/llmClient.ts` implementing `ILLMClient` interface
    - Implement `classifyTransaction()` with system prompt constraining output to valid categories
    - Implement `generateSummary()` for financial summary generation
    - Implement `answerQuestion()` for natural-language Q&A
    - Add request timeout (10s), exponential backoff (max 3 retries), graceful degradation
    - Track token usage for cost monitoring
    - Ensure only transaction descriptions (not raw account numbers or PII) are sent to LLM
    - _Requirements: 2.4, 7.1, 8.1, 12.2_

  - [ ]* 4.3 Write property tests for classification (Property 4 & 5)
    - **Property 4: Classification always assigns exactly one category** — For any non-empty description string, classify returns exactly one Category from the defined set
    - **Property 5: User correction overrides future classification** — After correcting description D to category C, all subsequent classify(D) calls return C
    - **Validates: Requirements 2.1, 2.3, 2.5**

- [ ] 5. Budget engine and spending analysis
  - [x] 5.1 Implement budget creation and allocation engine
    - Create `src/lib/budgetEngine.ts` with budget generation logic
    - Calculate available income: total_income - commitments_for_period - savings_contribution
    - If historical data exists: allocate proportionally based on past category spending
    - If no history: use 50/30/20 heuristic (50% needs, 30% wants, 20% savings)
    - Implement budget modification: adjust one category, redistribute difference proportionally across remaining categories
    - Handle shortfall case: if commitments + savings > income, return error with shortfall amount
    - Round allocations to 2 decimal places, adjust largest category to eliminate rounding error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 Write property tests for budget engine (Property 6 & 7)
    - **Property 6: Budget allocations sum to available income** — Generated allocations sum to income minus obligations within ±0.01 tolerance
    - **Property 7: Budget modification preserves total** — After modifying one category, total allocations still equal available income
    - **Validates: Requirements 3.1, 3.2, 3.5**

  - [x] 5.3 Implement spending comparison and pattern detection
    - Create `src/lib/spendingAnalyser.ts` with spending comparison logic
    - Implement `getComparison()`: for each category, calculate budgeted vs actual, compute variance (actual - budgeted)
    - Classify status: over (actual > budgeted), on-track (actual ≥ 90% of budgeted AND ≤ budgeted), under (actual < 90% of budgeted)
    - Detect increasing categories: >20% increase vs prior Budget_Period (requires ≥2 periods)
    - Detect anomalies: single transaction > 2× category average (requires ≥3 prior transactions in category)
    - Generate plain-language explanations with actual amount, baseline, and deviation percentage/multiple
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.4 Write property tests for spending analysis (Property 8, 9, 10)
    - **Property 8: Spending comparison status classification** — For any budgeted B and actual A, status correctly maps to over/on-track/under per threshold rules
    - **Property 9: Anomaly detection threshold** — Transaction flagged as unusual iff amount > 2× category average with ≥3 prior transactions
    - **Property 10: Category trend detection** — Category included in increasing-spend results iff spending increased >20% vs prior period
    - **Validates: Requirements 4.3, 4.4, 4.5, 5.1, 5.2**

- [x] 6. Alert engine and savings advisor
  - [x] 6.1 Implement budget alert generation
    - Create `src/lib/alertEngine.ts` with alert generation logic
    - On transaction insert: check if category spending reaches 80% (warning) or exceeds 100% (exceeded) of budgeted amount
    - Enforce at-most-once per alert type per category per budget period per user
    - Include category name, amount spent, budgeted amount, remaining balance (or overage)
    - Skip alert generation if no budget exists for current period
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 6.2 Write property test for alert engine (Property 12)
    - **Property 12: Alert generation at-most-once per type per category per period** — For any sequence of transactions, at most one warning and one exceeded alert per category per period
    - **Validates: Requirements 9.3**

  - [x] 6.3 Implement savings recommendation advisor
    - Create `src/lib/savingsAdvisor.ts` with savings recommendation logic
    - With deadline: recommended monthly = remaining_amount / months_until_deadline
    - Without deadline: recommend 10% of discretionary income (income - commitments)
    - If recommendation > 30% of discretionary income: suggest longer timeline or reduced goal, present both alternatives
    - If no savings goal: recommend starter target = 10% of average monthly income
    - Present recommendations in plain language with concrete numeric actions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.4 Write property test for savings advisor (Property 11)
    - **Property 11: Savings recommendation with deadline** — For remaining amount R and D months until deadline (D > 0), recommended contribution = R / D rounded to 2 decimals
    - **Validates: Requirements 6.1**

- [x] 7. CSV service and summary generator
  - [x] 7.1 Implement CSV import and export service
    - Create `src/lib/csvService.ts` with PapaParse integration
    - Import: parse CSV with columns date, description, amount (up to 10,000 rows), validate each row, skip invalid rows with row-number error reporting
    - Export: generate CSV with headers (date, description, amount, category), ISO 8601 dates, 2 decimal amounts, RFC 4180 escaping for commas/quotes
    - Filename format: `budget_export_YYYY-MM-DD.csv`
    - Handle empty data case (inform user no data to export)
    - _Requirements: 1.2, 1.3, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 7.2 Write property test for CSV round trip (Property 3 & 13)
    - **Property 3: CSV parsing preserves valid rows** — For any CSV with N valid rows, parsing produces exactly N transactions with matching fields
    - **Property 13: CSV export round trip** — Exporting transactions to CSV and re-importing produces equivalent transaction set
    - **Validates: Requirements 1.2, 13.1, 13.2, 13.3, 13.4**

  - [x] 7.3 Implement financial summary generator
    - Create `src/lib/summaryGenerator.ts` that builds summary data (total income, total spending, savings progress, top 3 categories)
    - Use LLM to generate plain-language summary text with no abbreviations or unexplained financial terms
    - Include one-sentence on-track/over-budget assessment
    - Handle insufficient data case gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 7.4 Implement natural-language Q&A engine
    - Create `src/lib/qaEngine.ts` that interprets user questions about financial data
    - Support queries about: spending in a category, spending in a date range, comparisons between categories or periods, trends across periods
    - Respond with specific numeric values from stored data
    - Handle: data-not-available, ambiguous questions (ask follow-up), off-topic questions (refuse gracefully)
    - Enforce response time constraints (5s for local data, 15s for LLM processing)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 8. Checkpoint - Business logic verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. API routes
  - [x] 9.1 Implement transaction API routes
    - Create `src/app/api/transactions/route.ts` with POST (create with auto-classification) and GET (list with pagination and filters)
    - Create `src/app/api/transactions/[id]/route.ts` with PATCH (update category, triggering `addUserCorrection`) and DELETE
    - On POST: validate input, classify transaction, store in Supabase, check for budget alerts, return confirmation
    - Enforce all validation rules (amount, date, description constraints)
    - _Requirements: 1.1, 1.4, 2.1, 2.3, 9.1, 9.2_

  - [x] 9.2 Implement CSV import/export API routes
    - Create `src/app/api/csv/import/route.ts` for POST (parse uploaded CSV, validate rows, store valid transactions, return error report)
    - Create `src/app/api/csv/export/route.ts` for GET (generate CSV from all user transactions, return as downloadable file)
    - _Requirements: 1.2, 1.3, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 9.3 Implement budget API routes
    - Create `src/app/api/budget/route.ts` with POST (generate budget), GET (retrieve current budget), PATCH (modify allocation)
    - Integrate budget engine for generation and modification
    - Return 422 with shortfall amount if commitments exceed income
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.4 Implement analysis, summary, and Q&A API routes
    - Create `src/app/api/analysis/route.ts` for GET (spending analysis with anomalies and trends)
    - Create `src/app/api/summary/route.ts` for GET (financial summary via LLM)
    - Create `src/app/api/qa/route.ts` for POST (natural-language question answering via LLM)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 9.5 Implement savings, commitments, and alerts API routes
    - Create `src/app/api/savings/route.ts` for CRUD on savings goals (with recommendations)
    - Create `src/app/api/commitments/route.ts` for CRUD on financial commitments
    - Create `src/app/api/alerts/route.ts` for GET (active alerts for current period)
    - _Requirements: 1.5, 1.6, 6.1, 6.2, 6.3, 6.4, 6.5, 9.4, 9.5_

- [x] 10. Authentication UI
  - [x] 10.1 Implement auth pages and layout
    - Create `src/app/(auth)/layout.tsx` with centered card layout for auth forms
    - Create `src/app/(auth)/login/page.tsx` with email/password login form, validation, error display
    - Create `src/app/(auth)/signup/page.tsx` with registration form, first-time disclaimer acknowledgement
    - Handle auth errors: invalid credentials, email already registered, session expired
    - _Requirements: 11.4, 12.1_

- [ ] 11. Dashboard layout and navigation
  - [x] 11.1 Implement root layout with PWA meta and auth provider
    - Create `src/app/layout.tsx` with viewport configuration (device-width, no zoom on iOS), safe-area-inset CSS variables, apple-web-app meta
    - Set up Supabase auth provider/context for session management
    - Include global disclaimer in footer on every page (same font size as body text)
    - _Requirements: 11.1, 11.5, 12.1_

  - [-] 11.2 Implement dashboard shell with responsive navigation
    - Create `src/app/(dashboard)/layout.tsx` with responsive shell (sidebar on lg+, bottom nav on mobile)
    - Create `src/components/layout/MobileNav.tsx` — fixed bottom tab bar with 5 tabs (Home, Transactions, Budget, Analysis, Ask AI), 44px min tap targets, safe-area padding
    - Create `src/components/layout/DesktopSidebar.tsx` — 256px fixed sidebar for lg+ screens
    - Display active spending alerts at top of dashboard
    - Add `pb-20` to content area to prevent overlap with bottom nav on mobile
    - _Requirements: 9.5, 11.5_

  - [-] 11.3 Implement PWA install prompt component
    - Create `src/components/layout/InstallPrompt.tsx` — listens for `beforeinstallprompt`, shows iOS Safari instructions, dismissible with 7-day re-prompt, auto-hides when installed
    - _Requirements: 10.3 (browser-native, no additional software)_

- [ ] 12. Transaction management UI
  - [-] 12.1 Implement transaction input and list page
    - Create `src/app/(dashboard)/transactions/page.tsx` with transaction form (amount, date, description, type income/expense)
    - Display transaction list with category badges, date, amount
    - Allow category correction (tap to change category, triggers user correction storage)
    - Show confirmation message on successful save
    - Show field-level error messages on validation failure
    - _Requirements: 1.1, 1.4, 1.7, 2.1, 2.3_

  - [-] 12.2 Implement CSV upload component
    - Create CSV upload component with file input, drag-and-drop area
    - Display parsing progress and row-level error report (row number, missing field)
    - Show count of successfully imported transactions
    - _Requirements: 1.2, 1.3_

- [ ] 13. Budget and comparison UI
  - [x] 13.1 Implement budget creation and comparison page
    - Create `src/app/(dashboard)/budget/page.tsx` with budget generation (choose weekly/monthly period)
    - Display budget allocations per category with editable amounts
    - Show planned vs actual comparison table with variance and status indicators (under/on-track/over)
    - Handle no-budget state: inform user to create budget before comparison
    - Display shortfall error when commitments exceed income
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 14. Spending analysis and savings UI
  - [x] 14.1 Implement spending analysis page
    - Create `src/app/(dashboard)/analysis/page.tsx` displaying unusual transactions, increasing-spend categories
    - Show plain-language explanations with actual amount, baseline, and deviation
    - Handle no-patterns-found state with confirmation message
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 14.2 Implement savings goals and recommendations page
    - Create `src/app/(dashboard)/savings/page.tsx` with savings goal CRUD (target amount, optional deadline)
    - Display savings recommendations with concrete actions and amounts
    - Show alternatives when recommendation exceeds 30% of discretionary income
    - _Requirements: 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 15. Q&A, visualizations, and settings
  - [x] 15.1 Implement natural-language Q&A chat interface
    - Create `src/app/(dashboard)/qa/page.tsx` with chat-style interface (client component)
    - Send questions to `/api/qa`, display responses with numeric values
    - Handle states: loading, data-missing, ambiguous question, off-topic
    - Include financial advice disclaimer in Q&A responses when relevant
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 11.2_

  - [x] 15.2 Implement Chart.js visualization components
    - Create `src/components/charts/CategoryBreakdown.tsx` — pie/doughnut chart with category names, amounts, percentages
    - Create `src/components/charts/SpendingTrend.tsx` — line chart plotting total spending per period (up to 12 periods)
    - Configure responsive chart options (maintainAspectRatio: false, legend position responsive)
    - Use responsive container heights (`h-[250px] sm:h-[300px] md:h-[400px]`)
    - Handle no-data state with informative message
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 15.3 Implement settings page with data export and deletion
    - Create `src/app/(dashboard)/settings/page.tsx` with CSV export button (triggers download), data deletion with confirmation dialog
    - Show "what data is sent to LLM" transparency panel
    - Implement savings goals and financial commitments management
    - Implement data deletion (remove all user data within 5 seconds, display confirmation)
    - _Requirements: 12.3, 12.5, 13.5, 13.6_

- [x] 16. Dashboard home page and wiring
  - [x] 16.1 Implement main dashboard page
    - Create `src/app/(dashboard)/page.tsx` as server component fetching summary data
    - Display: active alerts at top, financial summary (income, spending, top 3 categories), quick-action links
    - Show spending visualizations (category breakdown chart, trend chart if data available)
    - Handle first-time user with disclaimer acknowledgement modal
    - _Requirements: 7.1, 7.2, 7.3, 9.5, 10.1, 10.2, 11.1, 11.4_

  - [x] 16.2 Implement responsible use disclaimer components
    - Create disclaimer notice component for first-time user acknowledgement (must dismiss before proceeding)
    - Create footer disclaimer displayed on every page (general budgeting support, not professional advice)
    - Add reminder in responses about investment/tax/debt topics to consult a professional
    - Restrict responses on investment/tax/debt to general educational information only
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 17. Checkpoint - Full application wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Data isolation and integration testing
  - [ ]* 18.1 Write property test for user data isolation (Property 14)
    - **Property 14: User data isolation** — For any two distinct users, queries in user A's session never return user B's data across all tables
    - **Validates: Requirements 12.1**

  - [ ]* 18.2 Write integration tests for critical flows
    - Test full transaction flow: input → classify → store → query → export
    - Test budget creation from historical data end-to-end
    - Test alert triggering across multiple transaction inserts
    - Test auth flow: signup → login → session refresh → protected route access
    - Test RLS isolation: data created as user A is inaccessible to user B
    - _Requirements: 1.1, 2.1, 3.1, 9.1, 12.1_

- [x] 19. Final checkpoint - All tests pass and application complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout as specified in the design
- All LLM interactions happen server-side via API routes (API keys never reach the client)
- Supabase RLS ensures data isolation at the database level without application-level filtering
- PWA configuration enables installable, offline-capable experience across all platforms
- Mobile-first Tailwind CSS ensures responsive design with safe-area handling for notched devices

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.3", "1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "7.1"] },
    { "id": 5, "tasks": ["4.3", "5.1", "7.2", "7.3", "7.4"] },
    { "id": 6, "tasks": ["5.2", "5.3", "6.1", "6.3"] },
    { "id": 7, "tasks": ["5.4", "6.2", "6.4"] },
    { "id": 8, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 9, "tasks": ["10.1", "11.1"] },
    { "id": 10, "tasks": ["11.2", "11.3", "12.1", "12.2"] },
    { "id": 11, "tasks": ["13.1", "14.1", "14.2", "15.1", "15.2", "15.3"] },
    { "id": 12, "tasks": ["16.1", "16.2"] },
    { "id": 13, "tasks": ["18.1", "18.2"] }
  ]
}
```
