# BRC SaaS Product Flow

## Purpose and scope

BRC SaaS is a multi-company transport operations and accounting application for Indian road logistics operators. The reference screens are the primary visual source of truth for this document. This is an architecture plan only: no screens, application code, database objects, or business records are created by it.

The product must be useful from an entirely empty business database. A new company begins by configuring its profile, then creates its operational master records before recording trips. Counts and financial amounts shown below are calculated at runtime; example people, phone numbers, names, dates, and business amounts visible in the references are not product data.

## Global application shell

Authenticated screens use a desktop-first application shell:

- **Left navigation:** Dashboard; Parties; Trips; Suppliers; Drivers; Trucks; Expenses; Payments; Ledger; Invoices; Reports; a company identity area; Staff & Users; Settings; Logout. Expenses and Invoices are visually marked as newer modules.
- **Top bar:** an always-accessible `New Trip` action, followed by current-user avatar, name/phone, and role badge. These values come from the signed-in user and company membership, never hard-coded.
- **Content area:** pale neutral background, page heading and count/subtitle, summary cards, search/filter controls, and white rounded panels.
- **Reusable interaction patterns:** confirmation/modals with an overlay; page-level forms for trip entry; primary green CTA; destructive/owing red; management blue; status chips; date fields; searchable selectors; table/list empty panels with explanatory CTA.

Permission visibility is not enough: every route and action must be authorized server-side/RLS-side too. An unavailable action should be hidden or disabled consistently with the user’s permissions.

## Screen inventory and visible behavior

| Screens | Page / state | Visible functions and actions |
| --- | --- | --- |
| 00 | Public landing page | Brand header; route/service marketing; route coverage tiles; calls to call/contact; Login and Sign Up links. This is public content and distinct from tenant business data. |
| 01 | Authentication | Login / Sign Up tabs; Indian mobile number input; password input with visibility toggle; submit; switch between auth modes. Screens only show login fields; the sign-up/onboarding details require a product decision. |
| 02 | Dashboard | Greeting; `New Trip`; operational and financial KPI cards; Revenue vs Profit chart with period indicator; payment alerts and recent trips panels; explicit loading, clear, and no-trip states. |
| 03–04 | Parties | Party count, total party balance, text search, empty list state, and Add Party action. Add Party modal captures party contact, identity, credit, and opening balance data. |
| 05 | Trips | Trip count; text search by trip no/LR/party/route; status filters (All, Created, Assigned, In Transit, Delivered, POD Done, Closed, Cancelled); empty result state; `New Trip`. |
| 06, 08 | Add Trip | Full-page entry flow; back/save; party/truck/driver selectors; inline add truck/driver; route; billing; date/KM; material details; live financial summary. Screen 06 shows the early empty-dependency state; screen 08 shows selected-truck state. |
| 07 | Add Truck shortcut | Modal used from trip entry: truck number, ownership classification, vehicle type, capacity, confirm. It must be compatible with the fuller truck-management record. |
| 09–10 | Suppliers / Transporters | Supplier count and balance; search; table with supplier, phone, city, balance, action; empty table CTA; Add Supplier modal. |
| 11–12 | Drivers | Count, total driver balance, on-trip and available counts; Driver Gave / Driver Got filters or balance-direction shortcuts; search; Add Driver. Driver modal captures identity, compliance, contact/payment details and opening-balance direction. |
| 13–14 | Trucks | Counts and filters for all/my/market trucks; search; Add Truck. The detailed modal captures registration, vehicle type, model, capacity, compliance dates, owner information, ownership, and supplier when market-owned. |
| 15 | Expenses | Total, diesel, toll, and driver-expense summaries; search; `View Trips`; empty state explains expenses are added within a trip. |
| 16 | Payments | Receivable, payable, pending-trip summaries; Pending and History tabs; empty cleared state. Payment entry is implied by the module and trip/accounting lifecycle, though no entry modal is shown. |
| 17 | Ledger | Total receivable/payable/net-position summaries; party and transporter balance panels; ledger statement selector, date range and Load Statement action; zero-data states. |
| 18–19 | Invoices | Total billed/received/pending/overdue summaries; status tabs; search; empty CTA; Add Invoice. Invoice flow shows party selection/change, invoice date, due days/due date, GST %, eligible trip selection, terms, and derived total. |
| 20 | Reports | P&L Report, Balance Sheet, Driver Balance tabs; date range; load/clear; Excel export; calculated KPI cards and no-data state. |
| 21–23 | Staff & Users | Membership list with role/status/permissions summary; Add Staff. A two-step modal captures identity/credentials and role, then module-level View/Add/Edit/Delete permissions plus grant/revoke/view-only shortcuts. |
| 24 | Profile & Settings | Company logo upload; company profile and address/GST/PAN; bank information; password change; number-series configuration for trip, LR and invoice numbers. |

## End-to-end operational flow

1. A user reaches the public site and signs in or begins onboarding.
2. During onboarding, a company/tenant and initial owner membership must be established. The empty business database remains valid.
3. The owner configures company, bank, document numbering, and optionally branding in Settings.
4. The company adds Parties (customers), Suppliers/Transporters, Trucks, and Drivers as needed. They may also be added inline from the trip workflow where the reference offers that shortcut.
5. The dispatcher creates a Trip: party, truck, optionally driver, route, billing method/amount, dates/KM, and material. The trip number and LR number are generated by the company’s configured sequence at a controlled server-side boundary.
6. The team advances trip operational status through the permitted lifecycle. Expenses are recorded in the context of the trip. Settlement/payment records reduce receivables or payables; accounting views reflect these events.
7. Once eligible, closed/completed party trips may be selected for an Invoice. Invoice total, GST and outstanding amount are derived from the invoice and its selected trips.
8. Ledger, Payments, Dashboard, and Reports aggregate the same authoritative operational and financial events. They do not maintain disconnected hard-coded totals.
9. Owners can invite staff and assign roles/permissions. Staff only see and mutate information permitted for their company and membership.

## Domain relationships and module dependencies

| Module | Depends on | Produces / updates |
| --- | --- | --- |
| Parties | Company | Party profile, credit terms, opening-balance basis; party receivable and invoices. |
| Suppliers | Company | Transporter profile, banking, opening-balance basis; market-truck ownership and payable flows. |
| Trucks | Company; Supplier when market truck | Availability/assignment source for trips; compliance status. |
| Drivers | Company | Availability/assignment source for trips; driver balance and driver expenses/settlements. |
| Trips | Party; Truck; optionally Driver/Supplier | Operational status, billing basis, material/route data, costs and receivables/payables basis. |
| Expenses | Trip | Cost reporting and trip profitability; optionally driver/transporter payable context. |
| Payments | Party/Supplier/Driver; optionally Trip/Invoice | Settlement events, balances, alerts, ledger entries. |
| Invoices | Party; eligible Trips | Billed/received/pending/overdue calculations and party receivable. |
| Ledger | Parties/Suppliers plus financial events | Read model/statement of balances and movements. |
| Reports | Closed trips, expenses, payments, invoices, driver events | Time-bounded P&L, balance sheet and driver balance outputs. |

## Detailed forms and required validation intent

All fields need client feedback and authoritative server validation. Values must be scoped to the current company before being referenced.

### Party

- **Fields shown:** party name (required), contact person, phone, email, city, state, pincode, address, alternate phone, GST number, PAN number, credit limit (INR), credit days, opening balance (INR).
- **Validation:** normalized party name must be nonblank; phones must follow the chosen Indian/International phone policy; email format; pincode and tax identifiers must conform to their applicable formats when entered; currency values must be valid non-fractional-or-decimal money according to a defined policy; credit days cannot be negative. Opening balance direction must be explicitly represented, not inferred merely from a signed UI value.

### Supplier / transporter

- **Fields shown:** name (required), contact person, phone, alternate phone, email, address, city, state, pincode, GST/PAN, bank name, account number, IFSC, opening balance.
- **Validation:** same identity/contact rules as Party; IFSC format when present; bank details stored securely and masked in ordinary UI; opening balance direction explicit.

### Driver

- **Fields shown:** name (required), mobile (required), alternate mobile, license number, city, state, address, Aadhaar number, PAN, bank account, IFSC, UPI ID, licence expiry, opening balance direction/value.
- **Validation:** unique normalized mobile per company unless a deliberate shared-driver rule is adopted; licence expiry must be a valid date; Aadhaar/PAN/IFSC/UPI formats when supplied; sensitive identifiers must be protected and minimized; opening balance value must be nonnegative with direction selected separately.

### Truck

- **Quick form shown:** registration number (required), My/Market ownership, vehicle type, capacity.
- **Full form shown:** registration number, truck type, model, capacity, RC/insurance/fitness/permit expiry, RC number, insurer, owner name/phone, ownership, supplier (required for market truck).
- **Validation:** normalized registration number unique per company; capacity positive; all compliance dates valid; market ownership requires a supplier; owned truck must not be linked to a supplier unless a future business rule allows it; assigned/in-transit vehicles cannot be double-assigned to overlapping active trips.

### Trip

- **Fields shown:** party (required); truck (required); driver; origin (required); destination (required); party billing type (required: fixed, per tonne, per kg, per km, per trip, per day, per hour, per litre, per bag); party freight amount (required); party advance; commission; start date; LR number (auto-generated); start and end KM; material type; articles/package count; invoice value; weight; unit; notes.
- **Validation:** selected party/truck/driver must belong to current tenant and be active/eligible; a vehicle must be available; origin and destination nonblank and distinct under agreed normalization; billing quantity must exist and be positive for variable-rate billing (the design leaves the exact calculation base ambiguous); advances and commissions cannot violate defined financial policy; end KM cannot precede start KM; dates must follow status sequencing; LR/trip number collision checked atomically; monetary and weight values use precise numeric types.

### Expense and payment

- **Visible categories/intent:** diesel, toll, driver, and total expense; party receivables, transporter payables, pending payments, and payment history.
- **Required validation:** expense must belong to a tenant-scoped trip; category must be recognized; amount positive; payment payer/payee and direction must be unambiguous; allocation cannot exceed the source outstanding balance unless explicit credit/advance behavior is supported; reverse/correction flows must preserve history rather than editing settled financial facts destructively.

### Invoice

- **Fields shown:** party, invoice date, due days, derived due date, GST %, eligible trip selection, terms and conditions.
- **Validation:** party required; all selected trips belong to that party/company and meet the final eligibility rule; a trip cannot be invoiced twice beyond its remaining billable amount; GST rate is constrained to approved policy; due days nonnegative; due date must be derived consistently; invoice cannot be finalized with zero selected/billable value unless the business explicitly supports credit/zero invoices; invoice sequence unique per company.

### Staff, company, and number settings

- **Staff fields:** full name, phone, email, password, role (Staff or Accountant) and per-module permissions (Parties, Trips, Suppliers, Drivers, Trucks, Expenses, Payments, Ledger, Reports; View/Add/Edit/Delete).
- **Company fields:** logo, full name, company name, address, city/state, GST, PAN; bank name/account/IFSC; current/new/confirm password; trip/LR/invoice prefixes and next number values.
- **Validation:** staff phone/email uniqueness per intended identity scope; password policy; no user may grant permissions they do not hold or remove the last owner/admin; numbering prefix validation and positive next values; company registration/tax details validation; uploaded logo type/size restrictions.

## Statuses and calculations

### Trip lifecycle

The visible filters establish the expected statuses: `created`, `assigned`, `in_transit`, `delivered`, `pod_done`, `closed`, `cancelled`. Allowed transitions, who can perform them, whether a driver is mandatory at assignment, and when financial records become final must be explicitly defined before coding. Cancelled trips must be excluded from normal revenue/profit unless an approved cancellation charge policy applies.

### Dashboard and analytics calculations

These are views or queries, never stored counters:

- **Total trips:** company-scoped count, with definition documented (normally excluding soft-deleted drafts; status-specific cards use status).
- **Active trips:** count of operationally active statuses, tentatively assigned/in-transit (requires confirmation).
- **Closed / pending trips:** counts by lifecycle status; reference calls a separate `Pending` metric, whose exact mapping needs decision.
- **Party due:** total party receivable outstanding, including opening balance and invoices/trip receivables less valid payments/credits under the selected accounting model.
- **Transporter due:** total supplier payable outstanding, including opening balance and trip/expense costs less valid settlements.
- **Net profit:** closed-trip revenue less costs (supplier, driver, expenses, commissions and any agreed adjustments) for the selected period.
- **Month revenue:** eligible revenue for the current company-local calendar month. Recognition point (trip closed vs invoice issued) must be chosen.
- **Revenue vs Profit chart:** aggregation by month (or selected period) from the same revenue/cost rules.
- **Payment alerts:** receivables/payables that meet a defined overdue, pending, or credit-limit threshold.
- **Invoices:** total billed; received payments allocated to invoices; pending balance; overdue balance where due date passed and balance remains.
- **Reports:** P&L from closed/recognized trips and approved expenses; balance sheet from accounting balances; driver balance from driver advances/expenses/settlements. The accounting basis must be agreed before implementation.

## Empty-state contract

Zero business rows is a supported, intentional state. Every query must return empty arrays/zero aggregates without throwing, and every selector must be usable or explain why it cannot be used.

| Area | Required empty behavior |
| --- | --- |
| Dashboard | All counts/amounts render zero; chart renders a clear no-data/loading-safe state; payment alerts say clear; recent trips offers New Trip. |
| Parties, suppliers, drivers, trucks | Count/balance zero; search works against empty collection; table/list shows its illustrated CTA. |
| New Trip | Party and truck selectors show no records and clearly guide the user to add dependencies; Save remains invalid until required records exist. Inline add flows remain available when permitted. |
| Expenses | All category totals zero; empty state points to trips rather than inventing expense records. |
| Payments and Ledger | Zero summaries; pending payments reads clear; party/transporter balance panels show clear; statement selector has no options and no data. |
| Invoices | Zero totals and empty listing; Add Invoice may begin but cannot select a party/trip until suitable records exist. |
| Reports | Zero/no-data state; export should be disabled or produce an explicitly empty, correctly headed export only after a product decision. |
| Staff | The owner membership comes from onboarding/auth, not seeded business data. If no membership can exist, access must be denied rather than showing invented staff. |

## Responsive expectations

The main portal references are wide desktop layouts, while the authentication reference is narrow/mobile. The implementation must preserve information hierarchy at smaller widths:

- sidebar collapses to a controlled drawer; top actions remain reachable;
- multi-column card grids stack; table views horizontally scroll or switch to accessible cards without losing actions;
- modals become viewport-constrained, internally scrollable, and full-width on small screens;
- dense two-column forms stack with labels permanently visible; action bars stay reachable;
- filter chips wrap/scroll instead of disappearing; search and primary CTA remain accessible;
- do not rely on hover, fixed desktop widths, or color alone for statuses and permissions.

## Decisions required before implementation

1. Sign-up/onboarding: Is self-service company registration allowed, or are users invited only? What fields establish the initial company owner?
2. Accounting model: Is party revenue recognized on trip close, delivery/POD, or invoice issue? How do trip freight, invoice values, commission, advances, and tax relate?
3. Variable billing: Which input drives each rate type (weight, KM, articles, days, hours, litres, bags), and can users override the computed freight?
4. Supplier model: Does each market truck always require one supplier, and are supplier charges stored at trip level, expense level, or both?
5. Payments: Are allocations to trip/invoice mandatory or optional? Which payment methods, attachments, reversals and approvals are required?
6. Driver Gave/Got: Are these only opening-balance directions, or an ongoing driver cash-advance/settlement workflow?
7. Invoice eligibility and tax: Which trip statuses qualify, can partial trips be billed, and what GST rules/numbering/legal fields are required?
8. Operational lifecycle: exact allowed status transitions, POD attachment/review behavior, cancellation rules, and document retention.
9. Multi-company model: Can a person belong to more than one company and switch context? The proposed architecture supports this.

