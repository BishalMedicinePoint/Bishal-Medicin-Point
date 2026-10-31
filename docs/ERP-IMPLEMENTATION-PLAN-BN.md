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
25. Shop Settings — shop name/name change, logo, address, phone, email, receipt details; Super Admin can update the displayed shop name.
26. Multiple Branch — branch-scoped stock, sales, accounts.
27. Online Website — medicine search, price, image, shop information.
28. Online Order — order and delivery workflow.
29. Backup & Restore — manual backup, restore from a verified backup, scheduled automatic backups, backup history/status, and restore confirmation; access restricted to Super Admin.
30. Activity Log & Security — actor, timestamp, action, audit history.
31. Photo Management (separate menu/module) — upload, preview, change, and remove photos for employee profiles, medicines, customers, suppliers, and the shop logo; manage image files in secure storage and link them to the correct records. Access is controlled by individual permissions.

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
- Shop name and business details can be changed from Shop Settings without editing source code.
- Implement scheduled automatic backups plus manual backup and carefully confirmed restore. Show last backup time and backup status; protect backup files and restrict restore to Super Admin.
- Build Photo Management as its own menu/module, separate from Employee Management and Medicine Management. Existing medicine photo upload remains supported; the new module provides a central place to manage linked photos.

### Phase 6 — online and hardware
- Online ordering/delivery; barcode scanner and receipt printer compatibility.
- Fingerprint integration after the exact device model/protocol is known.

## Safety and acceptance rules

- Never expose service-role/secret credentials in frontend files.
- Never store plaintext passwords.
- Every sensitive operation must be checked server-side/database-side.
- Financial and inventory operations must be transactional and auditable.
- Test with separate Super Admin, Manager, Pharmacist, Sales Staff, Accountant, and restricted employee accounts.
- Test unauthorized reads/writes, branch isolation, stock race conditions, returns, photo upload limits/file types, storage access, scheduled backup completion, backup integrity, and restore on a test environment before production.
- Do not apply SQL migrations to production until reviewed and explicitly approved.

## MedEx catalogue integration (pending authorization)

- Add a dedicated MedEx Integration / Sync screen in the ERP for connection status, last successful sync, sync history, and error reporting.
- Design an import adapter that can use an official MedEx API or a data feed/API supplied under written permission. Do not scrape, bulk-copy, or redistribute MedEx content unless MedEx authorizes that use.
- Sync permitted catalogue fields (for example brand name, generic, strength, dosage form, and manufacturer) into a separate external-catalogue mapping layer; retain source identifiers and sync timestamps.
- Match existing medicines carefully and flag uncertain matches for review; do not create duplicates or silently overwrite shop-specific fields.
- Catalogue sync must NOT increase shop stock. Stock changes only through a verified purchase/stock-receipt transaction entered by an authorized employee.
- Do not treat catalogue prices as the shop's purchase cost or selling price. Shop prices, batches, expiry, and on-hand quantity remain controlled by the shop.
- Current integration status: not connected. Public research did not establish an official/licensed MedEx API or permission for automated bulk reuse. Enable live sync only after the data provider confirms an authorized integration method and terms.

## MedEx lookup without API (safe fallback)

- Provide a MedEx Search / Open MedEx link in the medicine catalogue so staff can look up a medicine on the MedEx website in a new tab.
- Provide a bulk medicine import screen for a CSV/Excel file that the shop owns or is authorized to use; validate columns, preview rows, detect duplicates, and require confirmation before import.
- Do not scrape MedEx pages, automate browser extraction, or bulk-copy its database without MedEx permission. A public website link alone does not grant reuse rights.
- Without an official API or authorized data export, automatic MedEx-to-ERP catalogue synchronization is not technically/legally available. The external lookup link and authorized file import are the supported no-API alternatives.
- Imported catalogue data does not add stock; only a verified purchase/stock receipt changes on-hand quantity.

## Medicine catalogue fields and categories

- Catalogue records should support medicine/product name, generic/active ingredient, therapeutic group/category, dosage form, strength, pack size/pack description, manufacturer, barcode where available, product image where authorized, and reference/source information.
- Support product categories and forms including tablets, capsules, syrup, drops, injections, cream, ointment, gel, shampoo, lotion, powder, and other pack types.
- Store price fields separately and explicitly: source/reference price (only when supplied by an authorized source), shop purchase price, shop selling price/MRP, and pack price. Never assume an external listed price is the shop's current buying cost.
- Provide image URL/upload fields only for images the shop owns or is authorized to use. Do not copy MedEx images or catalogue data in bulk without permission.
- Provide search/filter by name, generic, group/category, company, dosage form, and pack size.

## Medicine Add/Edit form requirements

- The Add Medicine and Edit Medicine forms must expose the catalogue fields directly; these are not just list/report fields.
- Required/available fields: Medicine/Product Name, Generic Name, Brand, Group/Therapeutic Category, dosage form (tablet, capsule, syrup, drop, injection, cream, ointment, gel, shampoo, lotion, powder, etc.), strength, pack size/pack description, manufacturer/company, barcode, product image upload/preview, description, and status.
- Pricing inputs must be separate: purchase price, selling price/MRP, and pack price. Do not auto-fill shop stock from catalogue data.
- Include searchable dropdowns with an option to add a new Group, Company, Dosage Form, and Generic where appropriate; validate duplicates before saving.
- Keep the existing public medicines table and website compatible; implement schema changes additively and test the form before deployment.

## Box/pack/unit pricing and quantity fields

- The Add/Edit Medicine and Batch/Purchase forms must support box/pack price, per-tablet/per-capsule/per-unit price, purchase rate, and sale price as distinct values.
- Capture units per box/pack (e.g. tablets per strip, strips per box) and the sale unit (box, strip, tablet, bottle, tube, etc.).
- Allow separate purchase rates at box/pack and unit level where relevant, and separate sale prices at box/pack and unit level. Show MRP separately when provided.
- Calculate derived unit rates only when pack conversion quantity is known; display the calculation and allow authorized users to review/override with validation. Avoid rounding errors in inventory and billing.
- Track stock in a consistent base unit and convert box/strip/unit sales accurately; do not assume all medicines are sold by tablet.
- Store actual purchase price by batch, because different batches may have different costs. Preserve historical batch cost and sale records.

## Medicine Add screen — pricing fields placement

- Put the complete box/pack/strip/tablet pricing and conversion controls directly inside the Medicine Add form (and keep them editable in Medicine Edit), not only in Purchase or Batch screens.
- Fields on Medicine Add: box price, strip price, per-tablet/per-unit price, purchase rate, sale price, MRP, units per strip, strips per box, and sale units allowed.
- The Add form should preview calculated conversions (for example box → strip → tablet) and validate that quantities and prices are consistent. Batch-specific actual purchase cost and expiry remain recorded on the Batch/Purchase entry.

## Customer Add form — confirmed fields

- Organize the form under the heading **Customer Information**.
- Show a unique **Customer ID** generated automatically by the system; it is read-only and must not replace MID.
- Add fields in this order:
  1. Customer ID (auto-generated, read-only)
  2. Customer Name (required)
  3. Mobile Number (required)
  4. Alternative Phone (optional; includes the previously requested Alt Cell)
  5. Email (optional)
  6. MID (optional)
  7. Reference Partner (optional; select/link an existing partner)
  8. Customer Type (select from configured customer types; provide a sensible default and allow authorized configuration)
  9. Address (optional; supports the previously requested Postal Address)
  10. Previous Due (opening due balance; default zero, entered/adjusted only by authorized staff and recorded as an opening-balance transaction)
  11. Credit Limit (optional; default zero or no credit limit, with validation)
  12. Customer Photo (optional; upload, preview, replace, remove, and store securely through Photo Management)
  13. Notes (optional; includes the previously requested Internal Notes)
  14. Registration Date (defaults to current local date; editable only by authorized staff)
- Validate Customer Name and Mobile Number; warn about possible duplicate mobile numbers and let authorized staff review before creating a duplicate.
- Validate email format when supplied, and validate Previous Due/Credit Limit as non-negative monetary values using the shop's configured currency/precision.
- Previous Due is an opening balance only; it must be posted to the customer ledger with actor, timestamp, and audit history. Never silently add it to sales or stock.
- Credit Limit must be checked when recording a credit sale; users without permission cannot override the limit.
- Support Add, Save, Edit, customer search, and photo management. Link each customer to invoices, purchase/sales history, due balance, collections, and payment ledger.
- Reference Partner should link to an existing partner where available, with permission-controlled partner creation/management.
- Keep optional fields optional and make the form quick to use at the sales counter.

## Invoice paper-size selector and print layouts

- On the POS invoice creation screen, show the paper-size selector before the invoice is generated/printed. Use **Auto Thermal (thermal receipt)** as the preselected default option.
- Staff can override the default for an individual invoice whenever a different paper is needed; changing one invoice's format must not silently change the saved shop-wide default.
- Include common presets: Auto Thermal, Thermal 80mm, Thermal 58mm, Invoice 10cm (100mm), A4, A5, Legal, Letter/Office, and Custom size. Provide a clear Custom width/height option for other printer or office-paper formats.
- If “Auto Thermal” is selected, choose the configured/available thermal receipt width (80mm or 58mm) and show the detected/selected width in preview; if it cannot be detected reliably, let the user choose 80mm or 58mm rather than guessing.
- Keep a Super Admin setting for the shop's default paper size, initially Auto Thermal. The POS selector should start with that saved default, while allowing a per-invoice override.
- The selected format must control the print preview, page width/height, margins, font sizing, line wrapping, and browser print/PDF output.
- Keep invoice contents, item quantities, prices, discounts, tax (if configured), paid amount, and due amount identical across all paper sizes; only the layout changes.
- Every invoice must display the shop's current logo prominently in the header, alongside the shop name and contact details. Load the logo from Shop Settings / Photo Management, preserve its aspect ratio, and size it appropriately for the selected paper format. If no logo is configured, show a clear placeholder in preview and let Super Admin upload or replace the logo; do not break invoice printing when the logo is absent.
- The invoice logo must appear in both print preview and printed/PDF output for all supported paper sizes, including thermal receipts.
- Add printer-friendly CSS and test thermal printers and standard office printers before production release.
