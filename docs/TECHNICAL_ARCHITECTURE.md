# BRC SaaS Technical Architecture

## Architecture objective

Build a production-ready, tenant-safe web application that follows the supplied screen sequence as its visual source of truth while remaining correct with zero business records. This document proposes architecture only. It does not initialize a project, install packages, connect to Supabase, create a deployment, or modify any UI.

## Proposed system shape

| Layer | Proposed responsibility |
| --- | --- |
| Web application | Server-rendered and client-interactive application hosted on Vercel; routes/pages reflecting the reference flow; accessible responsive UI. Exact framework choice should be confirmed, with Next.js App Router + TypeScript the recommended fit for Vercel and Supabase SSR. |
| Supabase Auth | Phone/password and/or email/password authentication; session issuance/refresh; user identity (`auth.users`). |
| PostgreSQL/Supabase | Tenant-scoped relational data, constraints, RLS, transactions, views and trusted database functions. |
| Supabase Storage | Company logos and later approved POD/receipt/document attachments, scoped by company path and storage policies. |
| Trusted server boundary | Next.js server actions/route handlers and, when appropriate, Supabase Edge Functions. Validates input, invokes business transactions, handles privileged work, and never exposes service-role keys. |
| Vercel | Preview/production deployment, environment management, routing, server runtime, observability integration. |

The browser uses the Supabase anonymous key only with RLS in force. It never holds a service-role key, direct SQL credential, unrestricted storage permission, or cross-tenant capability.

## Application route and module plan

Public routes: landing page (`00`) and auth pages (`01`). Protected tenant routes: dashboard; parties; trips and trip creation; suppliers; drivers; trucks; expenses; payments; ledger; invoices; reports; staff; settings. Modal designs are represented as accessible modal routes or stateful overlays, but every operation must have a reliable navigable URL/action path.

Suggested module boundaries:

- **Identity & tenant context:** resolve session, active membership/company, company switcher if multi-company is confirmed, and effective permissions.
- **Master data:** parties, suppliers, drivers, trucks and their forms/search/lists.
- **Trip operations:** create/edit/status transition/assignment, number generation and dependency-aware selectors.
- **Finance:** expenses, payments, invoices, allocations, ledger posting/statement and derived balances.
- **Insights:** dashboard/report queries, date filtering and export.
- **Administration:** company profile/bank/number settings, staff invitations and permissions.

Keep UI components separate from query/mutation services. Components render supplied state (loading, error, empty, content) and do not embed business calculations or tenant assumptions.

## Authentication and onboarding

The reference shows mobile number + password login and a Sign Up affordance. Supabase Auth requires a product decision on the canonical login identity:

- **Recommended:** support phone/password only if Supabase Auth supports the intended phone-password flow in the chosen configuration; otherwise use phone OTP, or collect email/password while treating phone as a profile attribute. Confirm provider/region/compliance and operational support before implementation.
- Normalize phone numbers to E.164 in profiles/memberships. Do not use a display phone number as authorization identity.
- Use Supabase SSR/session helpers (or current equivalent) so protected pages validate the session server-side and middleware refreshes session state safely.
- Sign up must atomically create (or queue creation of) the first company and owner membership through a trusted onboarding flow. Do not seed a company, staff member, or profile. If invitations are chosen instead, an admin-provisioning workflow replaces public self-sign-up.
- Enforce password policy, rate limiting, generic authentication errors, secure logout, session expiry/refresh, and recovery/change-password flow. Screen 24 exposes password change, which must require the current password/recent authentication.
- Invitation acceptance must bind an authenticated user to the intended company membership without permitting role or company escalation.

## Multi-company architecture

`auth.users` represents a person; `companies` represents a business tenant; `company_memberships` joins them. This supports an owner/accountant/staff user belonging to one or more companies without duplicating identity.

Every request resolves an **active company** from a valid membership. The active company can be represented in a signed server-side/session claim or selected server-side from a route/context preference, but it is never accepted as an unverified browser authority. Every business fetch/mutation includes company scope, then RLS independently validates membership and permission.

Company-owned configuration, numbering sequences, storage folders, master records, trips and all financial documents are isolated by `company_id`. Cross-company reporting, selection, number uniqueness and attachments are forbidden by schema, RLS and server validation.

## Authorization model

Roles visible in the reference are `Admin`/owner, `Staff`, and `Accountant`. Use baseline roles plus granular module actions: View, Add, Edit, Delete. Effective access is calculated from active membership and permission records; owner must retain full access but should still be auditable.

- Route guard: prevents direct navigation to unavailable modules.
- UI guard: hides/disables unauthorized CTAs and rows, while preserving a clear access-denied experience.
- Server guard: validates action permissions before mutations/exports.
- Database guard: RLS and trusted functions remain final enforcement.

Sensitive actions need additional rules: only authorized company admins manage staff/permissions; users cannot elevate themselves; financial posting/voiding is limited; and the last owner cannot be removed/demoted.

## Data access and financial consistency

Use a small set of typed domain services/queries with schemas shared at the server boundary. Validate browser input with a runtime validation library before calling a server action/API; repeat all critical validation inside transactional database functions or trusted server code.

Operations requiring a transaction include:

- onboarding company + first owner membership;
- atomic document-number reservation/finalization;
- creating/assigning trips while checking truck/driver availability;
- issuing/voiding invoices and invoice-trip links;
- posting/voiding payment and allocation records;
- posting/reversing derived ledger entries.

Money is decimal/numeric end-to-end, not JavaScript floating point. UI totals are formatted for INR only at display boundaries. Dashboard, ledger and reports query base financial documents/ledger views; they do not update stored counters or totals.

## Supabase PostgreSQL/RLS implementation requirements

- Enable RLS on all application tables and storage buckets; use per-table `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies with both `USING` and `WITH CHECK` tenant rules.
- Centralize permission checks in reviewed helper functions using `auth.uid()`, active memberships and module actions. Use safe `SECURITY DEFINER` function practices and least-privilege grants.
- Use constraints, foreign keys, checks, indexes and triggers from the database architecture plan as integrity controls, not merely application validation.
- Limit direct client mutation to safe draft/master operations. Use RPC/database functions or server-side transactions for numbering, posting, allocation, status transitions and ledger activity.
- Separate migration and production environments. Schema changes are versioned, reviewed and run in controlled CI/deployment steps only after approval. This phase must not run migrations.
- Store PII/payment data with field minimization/encryption/masking; log access to especially sensitive fields when compliance requirements call for it.
- Use company-prefixed storage paths, server-side file validation, signed URLs for non-public documents, and lifecycle/retention rules.

## UI state and zero-record resilience

Each page must explicitly implement `loading`, `error`, `empty`, and `populated` states. Do not rely on a non-empty record to determine the existence of a related entity.

- Aggregate queries use null-safe SQL (`COALESCE`) and return zero-card models.
- List queries return `[]`; components render the reference empty state and contextual CTA.
- Dependent selectors return zero options and explain the prerequisite; they never auto-select or synthesize a Party/Truck/Driver/Supplier.
- Charts show no-data messaging rather than fabricated datapoints.
- Invoice and report creation/exports check eligibility at action time, not only by the initial UI state.
- URL filters, search terms, date ranges and tabs handle no results and invalid/unauthorized values safely.

## Responsive, accessibility, and performance requirements

- Implement the desktop shell seen in screens 02–24 and the narrow auth experience in 01. At tablet/mobile breakpoints, collapse sidebar, stack grids/forms, preserve primary actions, and make data tables accessible via horizontal scroll or card representation.
- Forms use semantic labels, required indicators, accessible error text, keyboard-operable modal focus trapping, Escape/close handling, and non-color status cues.
- Use server pagination/filtering for lists expected to grow; debounce/cancel search; index database query paths; keep dashboard/report aggregates scoped and date-bounded.
- Treat phone, money, dates, privacy fields and permission controls as locale-aware; calculate/report dates in the company timezone.
- Preserve the reference visual system: green primary actions, restrained blue/red/orange semantic accents, rounded panels and visible empty-state illustrations. Visual tokens should be centralized so matching adjustments remain consistent.

## Vercel deployment requirements

1. Use separate local/development, preview, staging (recommended), and production Supabase projects/configurations. Preview deployments must never point at production data by default.
2. Configure Vercel environment variables per environment: public Supabase URL/anonymous key; server-only Supabase/service credentials only where indispensable; app origin; redirect allowlist; optional monitoring/export settings. Never commit secrets.
3. Configure Supabase Auth Site URL and redirect URLs for Vercel production, preview policy (if permitted), local development, password recovery and invitations. Use HTTPS-only production origins.
4. Deploy from version control with protected production branch, preview builds, lint/type/test/build gates, and an explicit approved migration pipeline. The deployment pipeline must not seed data.
5. Set security headers, CSP appropriate for Supabase/auth, secure cookies, request size limits for uploads, rate limits for auth and mutation routes, and observability/error tracking with PII redaction.
6. Define backups, migration rollback strategy, incident access, retention and export policies before accepting real financial data.

## Suggested delivery sequence after approval

1. Resolve product decisions in `PRODUCT_FLOW.md`.
2. Initialize the chosen app and quality tooling without seed data.
3. Implement auth/onboarding and tenant/permission foundations against a non-production Supabase environment.
4. Review and apply migrations in a controlled development project; test RLS with multiple tenants/users and an empty company.
5. Build master data, then trips, then finance and reporting modules with visual comparison to each reference screen.
6. Add automated tests for RLS, validation, tenant isolation, calculations, zero-data states and critical posting transactions.
7. Configure staging/preview/production deployment only after security, migration and recovery reviews.

## Open technical decisions

- Framework confirmation (Next.js recommended) and whether a native mobile application is in scope later.
- Supabase Auth identity method, SMS provider/cost/verification policy, self-sign-up versus invitation-only, and account recovery.
- Attachment requirements: POD, invoices, receipts, vehicle documents; allowed types/size/retention and whether virus scanning is required.
- Exact financial posting rules, fiscal-year/tax requirements, invoice PDFs/e-invoicing/GST compliance and Excel export format.
- Offline behavior and unreliable-network handling for drivers/dispatchers, which is not shown in the reference.
- Whether company users may switch among tenants; architecture supports it but the UI does not show a switcher.

