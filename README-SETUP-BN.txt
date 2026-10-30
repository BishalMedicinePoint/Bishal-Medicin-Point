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
