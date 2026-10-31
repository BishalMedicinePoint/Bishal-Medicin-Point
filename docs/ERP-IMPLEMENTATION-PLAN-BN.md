# Bishal Medicine Point — Pharmacy ERP Implementation Plan

## Confirmed scope

Implement all 30 modules requested by the owner. Preserve the current public medicine website, existing Admin login, and existing `public.medicines` table. All new work is additive and must be reviewed/tested before production deployment.

## Employee login and access

- Each employee receives an individual username/login ID and password.
- Passwords are handled by Supabase Auth; never store plaintext passwords in application tables or source code.
- Employee account creation, password reset, and login-ID mapping must run through a trusted server-side function. Never expose a Supabase service-role/secret key in browser code.
- Super Admin assigns per-employee permissions. Manager may add/edit/delete employee profiles only within granted permissions; Manager cannot grant or escalate permissions.
- Enforce authorization with database RLS and server-side checks, not merely hidden menus.
- Existing Admin account remains the Super Admin until an explicit, verified migration changes that arrangement.

## Module inventory

1. Dashboard — today's sales, profit, expenses, stock, alerts.
2. Medicine Management — add/edit/archive, brand, generic, company, image.
3. Batch Management — batch number, MRP, purchase price, manufacture and expiry dates.
4. Barcode Management — generate, scan, identify products.
5. POS Sales & Billing — sales, discounts, customer due, invoices, print.
6. Purchase Management — purchase invoices and returns.
7. Stock Management — stock in/out, low stock, damage, adjustments.
8. Supplier Management — profiles, payments, balances.
9. Customer Management — profiles, purchase history, balances.
10. Sales Return — returns and stock reconciliation.
11. Purchase Return — supplier returns.
12. Employee Management — employee profiles and lifecycle.
13. Custom Permission — per-user module/action access.
14. Attendance — check-in/out, late, absent, leave.
15. Fingerprint Integration — future biometric-device integration.
16. Salary & Payroll — salary, bonus, advance, payroll reports.
17. Accounts — cash, bank, income, expenses.
18. Customer & Supplier Due — receivables and payables.
19. Profit & Loss — income, expenses, profit/loss.
20. Financial Reports — daily, weekly, monthly, yearly.
21. Stock Reports — stock, batch, expiry.
22. Employee Reports — sales, attendance, salary.
23. PDF / Excel Export — report export and print.
24. Invoice Settings — layout, numbering, header/footer, paper size.
25. Shop Settings — shop name, logo, address, phone.
26. Multiple Branch — branch-scoped stock, sales, accounts.
27. Online Website — medicine search, price, image, shop information.
28. Online Order — order and delivery workflow.
29. Backup & Restore — controlled database backup/restore.
30. Activity Log & Security — actor, timestamp, action, audit history.

## Delivery sequence

### Phase 0 — safety and foundation
- Keep changes on this feature branch; do not push unfinished work to `main`.
- Record the current schema and RLS policies before changing the database.
- Additive migrations only; do not recreate or drop the existing `medicines` table.
- Define branch scoping, employee identity, permission catalogue, and audit strategy.

### Phase 1 — identity and permissions
- Employee profiles, login-ID mapping, roles, individual permissions, account lifecycle.
- Secure server-side account provisioning and password reset.
- Database-enforced access control and Super Admin protection.

### Phase 2 — catalogue and inventory
- Medicine extensions, batches, barcode, stock ledger, suppliers, purchase and purchase return.
- Expiry-aware stock selection and atomic stock adjustments.

### Phase 3 — sales
- POS, invoice numbering/printing, discounts, customer balances, sales return.
- Atomic sale + stock movement + payment posting.

### Phase 4 — people and finance
- Attendance, leave, payroll, cash/bank, expenses, due reconciliation.

### Phase 5 — reports and operations
- Dashboard, reports, PDF/Excel, settings, branch management, audit log, backup workflow.

### Phase 6 — online and hardware
- Online ordering/delivery; barcode scanner and receipt printer compatibility.
- Fingerprint integration after the exact device model/protocol is known.

## Safety and acceptance rules

- Never expose service-role/secret credentials in frontend files.
- Never store plaintext passwords.
- Every sensitive operation must be checked server-side/database-side.
- Financial and inventory operations must be transactional and auditable.
- Test with separate Super Admin, Manager, Pharmacist, Sales Staff, Accountant, and restricted employee accounts.
- Test unauthorized reads/writes, branch isolation, stock race conditions, returns, and backup restore before production.
- Do not apply SQL migrations to production until reviewed and explicitly approved.
