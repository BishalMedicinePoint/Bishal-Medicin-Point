BISHAL MEDICINE POINT - ADMIN PANEL UPDATE

1. আগে GitHub Repository > Code > Download ZIP দিয়ে ব্যাকআপ রাখুন।
2. এই ZIP Extract করুন।
3. Supabase Dashboard > Project Settings > API Keys খুলুন।
4. Publishable key (নতুন UI) অথবা anon/public key (পুরোনো UI) কপি করুন।
   Secret key বা service_role key কখনো ব্যবহার করবেন না।
5. supabase-config.js খুলে PASTE_YOUR... অংশের বদলে ওই public key বসান।
6. GitHub repository root-এ এই ফাইলগুলো upload/replace করুন:
   index.html, script.js, supabase-config.js, admin.html, admin.js
   style.css এবং google verification HTML অপরিবর্তিত রাখুন।
7. Commit changes করুন। Deploy হওয়ার পর Admin পেজ:
   https://bishalmedicinepoint.github.io/Bishal-Medicin-Point/admin.html

নিরাপত্তা:
- Browser code-এ শুধু publishable/anon key ব্যবহার হবে।
- service_role/secret key কখনো GitHub বা browser code-এ দেবেন না।
- Admin email: mdmeharajh9@gmail.com
- SQL table, RLS policies এবং medicine-images bucket আগেই তৈরি করা আছে বলে ধরা হয়েছে।
- ওষুধের নাম, ছবি, strength, প্যাক সাইজ ও মূল্য প্রকাশের আগে নির্ভরযোগ্যভাবে যাচাই করুন।


ERP CUSTOMER MODULE — FIRST DEVELOPMENT PHASE

ERP Workspace (শুধু main branch-এ deploy/merge করার পর):
https://bishalmedicinepoint.github.io/Bishal-Medicin-Point/erp.html
বর্তমানে কোডটি erp-foundation branch-এ আছে; তাই live URL এখনো চালু নয়।

Setup:
1. Supabase Dashboard খুলে SQL Editor-এ যান।
2. Repository-এর supabase/migrations/001_customer_management.sql ফাইলের সম্পূর্ণ SQL কপি করে একবার Run করুন।
3. SQL সফল হলে erp.html খুলে Super Admin account দিয়ে Login করুন।
4. Customer Add, Edit, Search এবং Active/Inactive পরীক্ষা করুন।

Security:
- Customer records ও customer photos public নয়।
- এই প্রথম পর্যায়ে শুধু নির্দিষ্ট Super Admin UID access পাবে।
- SQL migration production database-এ চালানোর আগে SQL review করুন।
- এই ERP code এখন erp-foundation branch-এ আছে; main/live website-এ deploy করা হয়নি।
