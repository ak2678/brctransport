# BRC SaaS Database Architecture

## Principles

- PostgreSQL/Supabase is proposed, but this document does **not** create tables, execute migrations, connect to Supabase, or add any records.
- The schema is tenant-first: every business table is scoped by `company_id`; no query or RLS policy may infer tenant boundaries from client input.
- An empty business database is valid. No seed, demo, sample, fake, or real business records are needed for the UI to operate.
- UUID primary keys, `timestamptz` audit timestamps, `numeric(14,2)` monetary amounts, `numeric(14,3)` quantities, and `date` for business dates are proposed. UTC timestamps are stored; each company keeps an IANA timezone for display/report boundaries.
- Financial history is append-only where practical. Use void/reversal records rather than destructive edits after posting. Soft deletion is suitable for mutable master data but not as a substitute for accounting history.
- All `company_id` foreign keys target `companies.id`. `created_by` / `updated_by` target `auth.users(id)` where applicable.

## Common columns and conventions

Unless noted, tenant business tables include:

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key, server-generated. |
| `company_id` | `uuid` | Required FK to `companies.id`; tenant boundary. |
| `created_at`, `updated_at` | `timestamptz` | Required, default `now()`; `updated_at` trigger maintained. |
| `created_by`, `updated_by` | `uuid` | Nullable/required by workflow; FK to `auth.users(id)`; audit identity. |
| `deleted_at`, `deleted_by` | `timestamptz`, `uuid` | Present only on soft-deletable master records; default null. |

Normalization fields (e.g. `name_normalized`, `phone_e164`, `registration_number_normalized`) are stored/generated consistently to enforce practical uniqueness without weakening display formatting.

## Identity, tenant, and authorization tables

### `companies`

**Why / screens:** Tenant root and company profile used by all authenticated screens, particularly Settings (24), header branding, document numbering, and report dates.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Tenant key. |
| `legal_name` | `text` | Required company name. |
| `display_name` | `text` | Required header/branding name. |
| `address_line`, `city`, `state`, `pincode` | `text` | Settings profile fields; optional until onboarding policy says otherwise. |
| `gstin`, `pan` | `text` | Optional, normalized and validated when present. |
| `logo_path` | `text` | Optional Supabase Storage object path, not public arbitrary URL. |
| `timezone` | `text` | Required IANA value, default chosen during onboarding. |
| `currency_code` | `char(3)` | Required, default/validated `INR` under current scope. |
| common audit | | No soft-delete while memberships/business data exist. |

Constraints/indexes: unique normalized GSTIN/PAN only if the product requires global uniqueness; index on `deleted_at` if soft deletion is adopted (otherwise do not soft delete). Deletion is **RESTRICT**; archive/deactivate instead.

### `company_memberships`

**Why / screens:** Connects Supabase users to companies, drives header identity, Staff & Users (21–23), permissions and all RLS decisions. Supports a person belonging to multiple companies.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Membership key. |
| `company_id` | `uuid` FK | `ON DELETE RESTRICT`. |
| `user_id` | `uuid` FK `auth.users` | `ON DELETE RESTRICT`/managed auth lifecycle policy. |
| `full_name` | `text` | Display name; optional synchronization policy with auth metadata. |
| `phone_e164`, `email` | `text` | Contact/display data; email must not be trusted for authorization. |
| `role_code` | `text` | `owner`, `staff`, `accountant`; role is a baseline, not sole authorization. |
| `status` | `text` | `invited`, `active`, `suspended`; checked constraint. |
| `last_active_company_at` | `timestamptz` | Optional UX preference only. |
| common audit | | Membership changes audited; no soft delete needed if status is retained. |

Constraints/indexes: unique `(company_id, user_id)`; index `(user_id, status)`; index `(company_id, status)`. Prevent deletion/demotion of the last active owner in a trusted database function/transaction.

### `membership_permissions`

**Why / screens:** Persists per-module View/Add/Edit/Delete controls from Staff step 2 (23). Owner access can be implicit, but explicit rows make the UI and policy auditable.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `membership_id` | `uuid` FK | `ON DELETE CASCADE`. |
| `module_code` | `text` | Checked enum-like value: parties, trips, suppliers, drivers, trucks, expenses, payments, ledger, reports, invoices, settings, staff. |
| `can_view`, `can_add`, `can_edit`, `can_delete` | `boolean` | Defaults false; `add/edit/delete` imply view by validation. |
| audit fields | | Permission edits must be audited. |

Constraints/indexes: unique `(membership_id, module_code)`; index through membership’s `company_id` is available via join. No direct company deletion cascade.

### `company_number_series`

**Why / screens:** Settings number-series section (24); safely generates trip, LR, and invoice numbers per company.

Columns: `id uuid PK`, `company_id uuid FK`, `document_type text` (`trip`, `lr`, `invoice`), `prefix text`, `next_value bigint CHECK (next_value > 0)`, `padding smallint`, common audit. Unique `(company_id, document_type)`. Generate/reserve numbers using a security-definer transactional function with a row lock; never by client-side increment. `ON DELETE RESTRICT` from company.

### `company_bank_accounts`

**Why / screens:** Bank details in Settings (24), future invoice/receipt presentation.

Columns: `id uuid PK`, `company_id uuid FK`, `bank_name text`, `account_holder_name text`, `account_number_encrypted text`, `account_number_last4 char(4)`, `ifsc text`, `is_default boolean`, `is_active boolean`, audit. At most one active default per company via partial unique index. Sensitive values require restricted select access; do not return full values to ordinary staff.

## Operational master data

### `parties`

**Why / screens:** Customer list/form (03–04), trip selection (06/08), receivables, invoices, ledger, dashboard and reports.

Columns: `id uuid PK`, `company_id uuid FK`, `name text`, `name_normalized text`, `contact_person text`, `phone_e164 text`, `alternate_phone_e164 text`, `email text`, `address text`, `city text`, `state text`, `pincode text`, `gstin text`, `pan text`, `credit_limit numeric(14,2) CHECK >= 0`, `credit_days integer CHECK >= 0`, `opening_balance numeric(14,2) CHECK >= 0`, `opening_balance_direction text` (`receivable`,`payable`), `is_active boolean default true`, common audit and soft-delete.

Constraints/indexes: unique `(company_id, name_normalized)` among non-deleted parties; indexes `(company_id, is_active, deleted_at)`, `(company_id, phone_e164)`, search index/trigram policy for name/phone/code search. `ON DELETE RESTRICT` once referenced by a trip/invoice/payment; otherwise soft delete only.

### `suppliers`

**Why / screens:** Transporters/Suppliers (09–10), market-truck ownership (14), payables, payments, ledger and reports.

Columns match party contact/address/tax fields plus `bank_name`, `account_number_encrypted`, `account_number_last4`, `ifsc`, `opening_balance numeric(14,2)`, `opening_balance_direction text` (`payable`,`receivable`), `is_active`, audit/soft-delete. Required: `name`, company scope. 

Constraints/indexes: partial unique `(company_id, name_normalized)`; indexes for `(company_id, is_active, deleted_at)`, phone and search; `ON DELETE RESTRICT` if referenced by trucks/trips/payments. Store sensitive banking data encrypted/masked.

### `drivers`

**Why / screens:** Drivers (11–12), trip assignment, driver balances and reports.

Columns: `id uuid PK`, `company_id uuid FK`, `full_name text`, `name_normalized text`, `phone_e164 text`, `alternate_phone_e164 text`, `license_number text`, `license_expiry date`, address/city/state, `aadhaar_encrypted text`, `aadhaar_last4 char(4)`, `pan text`, `bank_account_encrypted text`, `bank_account_last4 char(4)`, `ifsc text`, `upi_id text`, `opening_balance numeric(14,2)`, `opening_balance_direction text` (`company_owes_driver`,`driver_owes_company`), `is_active boolean`, audit/soft-delete.

Constraints/indexes: partial unique `(company_id, phone_e164)` and `(company_id, license_number_normalized)` when not null; availability index `(company_id, is_active, deleted_at)`; `ON DELETE RESTRICT` after assignment or financial reference. PII fields require stricter column exposure and audit logging.

### `trucks`

**Why / screens:** Truck list/form (07, 13–14), trip assignment (06/08), availability, compliance and supplier relationship.

Columns: `id uuid PK`, `company_id uuid FK`, `registration_number text`, `registration_number_normalized text`, `truck_type text`, `model text`, `capacity_tonnes numeric(14,3) CHECK > 0`, `ownership_type text` (`company_owned`,`market`), `supplier_id uuid nullable FK suppliers`, `owner_name text`, `owner_phone_e164 text`, `rc_number text`, `rc_expiry date`, `insurance_company text`, `insurance_expiry date`, `fitness_expiry date`, `permit_expiry date`, `is_active boolean`, audit/soft-delete.

Constraints/indexes: partial unique `(company_id, registration_number_normalized)`; index `(company_id, ownership_type, is_active, deleted_at)`; foreign key `supplier_id ON DELETE RESTRICT`; check requiring supplier for market and null supplier for company-owned (unless a future rule deliberately permits it). Do not store mutable `availability`; derive it from active trips.

## Trips and costs

### `trips`

**Why / screens:** Trips list and status filters (05), Add Trip (06/08), dashboard, expense entry, payments, invoice eligibility and reports.

Columns: `id uuid PK`, `company_id uuid FK`, `trip_number text`, `lr_number text`, `party_id uuid FK parties`, `truck_id uuid FK trucks`, `driver_id uuid nullable FK drivers`, `supplier_id uuid nullable FK suppliers` (snapshot/explicit transport provider where needed), `status text`, `origin text`, `destination text`, `billing_type text`, `billing_rate numeric(14,2)`, `freight_amount numeric(14,2)`, `party_advance_amount numeric(14,2) default 0`, `commission_amount numeric(14,2) default 0`, `start_date date`, `delivery_date date`, `pod_received_at timestamptz`, `closed_at timestamptz`, `start_km numeric(14,1)`, `end_km numeric(14,1)`, `material_type text`, `article_count numeric(14,3)`, `invoice_value numeric(14,2)`, `weight numeric(14,3)`, `weight_unit text`, `notes text`, `cancelled_at timestamptz`, `cancellation_reason text`, common audit.

Constraints/indexes: unique `(company_id, trip_number)` and `(company_id, lr_number)` when values present; indexes `(company_id, status, start_date DESC)`, `(company_id, party_id, status)`, `(company_id, truck_id, status)`, `(company_id, driver_id, status)`, and search index for numbers/origin/destination. FKs `RESTRICT` deletion. Use check constraints for valid statuses/money/quantities and a trigger or transaction lock to prevent conflicting active-truck assignments. A `trip_status_history` table below records changes.

### `trip_status_history`

**Why / screens:** Required to support the trip lifecycle shown in 05 and to audit dashboard/report status-based calculations.

Columns: `id uuid PK`, `company_id uuid FK`, `trip_id uuid FK trips ON DELETE RESTRICT`, `from_status text nullable`, `to_status text`, `changed_at timestamptz`, `changed_by uuid FK auth.users`, `reason text nullable`. Index `(trip_id, changed_at DESC)` and `(company_id, to_status, changed_at DESC)`. Inserts only; no updates/deletes through application roles.

### `trip_expenses`

**Why / screens:** Expense totals/list (15), trip profitability, supplier/driver cost context, dashboard and P&L.

Columns: `id uuid PK`, `company_id uuid FK`, `trip_id uuid FK trips`, `expense_date date`, `expense_category text` (at least `diesel`,`toll`,`driver`; extensible controlled taxonomy), `amount numeric(14,2) CHECK > 0`, `paid_to_type text` (`supplier`,`driver`,`other`), `supplier_id uuid nullable FK`, `driver_id uuid nullable FK`, `description text`, `reference_number text`, `status text` (`posted`,`voided`), `voided_at`, `voided_by`, `void_reason`, audit.

Indexes `(company_id, expense_date DESC)`, `(company_id, trip_id)`, `(company_id, expense_category, expense_date)`, payable-party indexes for supplier/driver. FKs `RESTRICT`; posted expense values immutable, correction by void/replacement. The UI has no independent expense form; permissions should allow creation from authorized trip context.

## Financial documents, payments, and ledger

### `invoices`

**Why / screens:** Invoice list/dashboard (18), invoice creation (19), payment allocation, party receivables and reports.

Columns: `id uuid PK`, `company_id uuid FK`, `invoice_number text`, `party_id uuid FK parties`, `invoice_date date`, `due_date date`, `due_days integer`, `gst_rate numeric(5,2)`, `subtotal_amount numeric(14,2)`, `gst_amount numeric(14,2)`, `total_amount numeric(14,2)`, `status text` (`draft`,`issued`,`partially_paid`,`paid`,`overdue`,`voided`), `terms_and_conditions text`, `issued_at timestamptz`, `voided_at`, `void_reason`, audit.

Constraints/indexes: unique `(company_id, invoice_number)`; indexes `(company_id, party_id, status, due_date)`, `(company_id, invoice_date DESC)` and an outstanding/overdue query index. `party_id ON DELETE RESTRICT`. Totals are finalized calculation snapshots on issuance, not editable independent values; payment balance is derived.

### `invoice_trips`

**Why / screens:** Selected trip list and total during invoice creation (19); prevents unsupported/invisible invoice-trip association.

Columns: `id uuid PK`, `company_id uuid FK`, `invoice_id uuid FK invoices`, `trip_id uuid FK trips`, `billed_amount numeric(14,2) CHECK > 0`, audit. Unique `(invoice_id, trip_id)`; indexes `(company_id, trip_id)` and `(invoice_id)`. `ON DELETE RESTRICT` after issuing; enforce same company/party and no overbilling transactionally. It supports future partial billing if approved.

### `payments`

**Why / screens:** Payments (16), invoice received totals, supplier/party balances, dashboard alerts, ledger and reports.

Columns: `id uuid PK`, `company_id uuid FK`, `payment_number text`, `payment_date date`, `counterparty_type text` (`party`,`supplier`,`driver`), `party_id uuid nullable FK`, `supplier_id uuid nullable FK`, `driver_id uuid nullable FK`, `direction text` (`receipt`,`disbursement`), `amount numeric(14,2) CHECK > 0`, `payment_method text`, `reference_number text`, `notes text`, `status text` (`posted`,`voided`), void metadata, audit.

Constraints/indexes: exactly one counterparty FK via check; direction must match counterparty policy; unique `(company_id, payment_number)` if exposed; indexes `(company_id, payment_date DESC)`, `(company_id, counterparty_type, status)`, and per-counterparty date indexes. FKs restrict deletion. Posted records immutable except controlled void.

### `payment_allocations`

**Why / screens:** Supports accurate invoice received/pending/overdue (18), payment history (16), and traceable settlement rather than storing unpaid totals.

Columns: `id uuid PK`, `company_id uuid FK`, `payment_id uuid FK payments`, `invoice_id uuid nullable FK invoices`, `trip_id uuid nullable FK trips`, `allocation_amount numeric(14,2) CHECK > 0`, audit.

Constraints/indexes: require exactly one target once product allocation policy is settled; index `(invoice_id)` and `(trip_id)`; enforce same company/counterparty and allocation sum ≤ posted payment/target outstanding inside a transaction. `ON DELETE RESTRICT` for posted history.

### `ledger_entries`

**Why / screens:** Ledger balances/statements (17), financial auditability, Dashboard balances and balance-sheet reporting. This is an append-only accounting projection from opening balances, trip financial recognition, invoices, expenses, payments and corrections.

Columns: `id uuid PK`, `company_id uuid FK`, `entry_date date`, `counterparty_type text` (`party`,`supplier`,`driver`), `party_id/supplier_id/driver_id uuid nullable FKs`, `entry_type text` (opening_balance, trip_charge, invoice, expense, payment, adjustment, reversal), `debit_amount numeric(14,2) default 0`, `credit_amount numeric(14,2) default 0`, `source_table text`, `source_id uuid`, `description text`, `is_void boolean default false`, `reversed_entry_id uuid nullable self FK`, `posted_at timestamptz`, `posted_by uuid`, audit.

Constraints/indexes: one counterparty; debit/credit mutually exclusive and one positive; unique `(company_id, source_table, source_id, entry_type)` where a source should generate one entry; indexes `(company_id, counterparty_type, entry_date DESC)`, each counterparty FK + date, and source lookup. Create only from transactional database functions or a trusted server workflow; prohibit direct client inserts/updates/deletes. Do not delete entries; reversals are linked rows.

## Derived views (not mutable tables)

The following should be SQL views/materialized views only if measurement shows a need, never hand-maintained fields:

- `v_party_balances`, `v_supplier_balances`, `v_driver_balances`: opening entries plus ledger movements.
- `v_trip_costs` and `v_trip_profitability`: expense sums and agreed supplier/driver/commission costs per trip.
- `v_invoice_balances`: invoice total minus non-void payment allocations, with computed paid/pending/overdue status.
- `v_dashboard_metrics` and report queries: company-and-period aggregates over operational/financial base data.

Materialized views, if later used, must be refreshed safely and never become the sole source of financial truth.

## Row Level Security (RLS)

Enable and force RLS on every `public` business table, derived view exposure layer, and storage object policy. No policy may rely on a user-supplied company ID alone.

1. Define a hardened helper such as `has_company_permission(company_id, module_code, action)` using `auth.uid()`, active `company_memberships`, and the permission matrix. It must be `SECURITY DEFINER`, set a safe `search_path`, and have tightly limited execute grants.
2. `companies`: active members may select their company; owner/settings-authorized members may update allowed profile fields; no tenant user may insert/delete companies except controlled onboarding backend.
3. `company_memberships` and permissions: active members may list allowed co-members; owners/staff-admins manage invitations/permissions. Prevent self-escalation and last-owner removal in database functions.
4. Master data: scoped select requires module `view`; insert `add`; update `edit`; soft delete requires `delete`. `WITH CHECK` must verify `company_id` is a company the caller belongs to and never allow changing it.
5. Trips, expenses, invoices and payments: same module permissions plus immutable/posting protections. Client roles cannot post/void ledger entries directly.
6. Ledger/reports: read-only for authorized roles. Financial posting functions must validate membership, source relations, company scope, and transaction consistency.
7. Supabase Storage logo/POD/receipt buckets need path policies beginning with `company_id/`; content type/size validation happens in server code or Edge Functions.
8. Service-role credentials are server-only (Vercel/server actions/API/Edge Functions), never shipped to browser. Service role bypasses RLS, so all tenant checks still occur in trusted code.

## Delete and update behavior

- **Master data:** use `is_active` + `deleted_at` for records not yet referenced. Once referenced, preserve records; deactivate rather than delete. All referenced FKs are `RESTRICT`.
- **Trips:** never hard delete after creation. Cancel with reason; retain status history and financial reversals.
- **Invoices/payments/expenses/ledger:** drafts may be edited under permissions; posted/issued facts are immutable and adjusted by void/reversal/credit workflow. Do not cascade-delete financial facts.
- **Company:** never hard delete from tenant UI. Handle retention/export/legal deletion via privileged operations designed separately.
- **Audit:** trigger-maintained timestamps, actor IDs, status history and ledger sources make changes traceable. Consider a protected generic `audit_events` table later if compliance requires before/after JSON snapshots; it is not needed merely to display the reference screens.

## Cross-table integrity rules

- All related records must have the same `company_id`; enforce by validation triggers/functions where a simple FK cannot prove it.
- Truck and driver assignment must be valid for the trip’s active interval; a partial unique/exclusion strategy or transactional check prevents conflicts.
- An invoice may include only eligible trips of the same party; enforce billed total against remaining billable amount.
- Sum of allocations may not exceed payment amount or invoice/trip outstanding amount without an explicitly enabled advance/credit feature.
- Company-level sequence increments must occur atomically and only at document finalization/reservation policy points.
- Sensitive data (bank accounts, Aadhaar) must be encrypted or minimized, masked in outputs, and omitted from broad select policies.

