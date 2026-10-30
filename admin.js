(() => {
const $=id=>document.getElementById(id),loginPanel=$("loginPanel"),dashboard=$("dashboard"),loginStatus=$("loginStatus"),adminStatus=$("adminStatus"),ADMIN_EMAIL="mdmeharajh9@gmail.com";let client=null,currentUser=null;
function msg(el,s,bad=false){el.textContent=s;el.style.background=bad?"#fff0f0":"#eef7f1";}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function val(id){const v=$(id).value.trim();return v===""?null:v;}
function reset(){ $("medicineForm").reset();$("medicineId").value="";$("image_url").value="";$("formTitle").textContent="নতুন ওষুধ যোগ করো";}
async function loadList(){
 const box=$("medicineAdminList");box.textContent="তথ্য লোড হচ্ছে...";
 const {data,error}=await client.from("medicines").select("*").eq("is_active",true).order("created_at",{ascending:false});
 if(error){box.textContent="তথ্য লোড করা যায়নি: "+error.message;return;}
 if(!data.length){box.textContent="এখনো কোনো ওষুধ যোগ করা হয়নি।";return;}
 box.innerHTML=data.map(m=>`<div class="admin-item">${m.image_url?`<img src="${esc(m.image_url)}" alt="">`:""}<div class="admin-item-info"><strong>${esc(m.name)}</strong><span class="admin-small">${esc([m.strength,m.form,m.manufacturer].filter(Boolean).join(" · "))}</span></div><button class="admin-btn secondary" data-edit="${m.id}" type="button">Edit</button><button class="admin-btn danger" data-delete="${m.id}" type="button">Delete</button></div>`).join("");
 box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const m=data.find(x=>String(x.id)===b.dataset.edit);$("medicineId").value=m.id;["name","generic_name","strength","form","manufacturer","pack_size","unit_price","pack_price","image_url","description"].forEach(k=>$(k).value=m[k]??"");$("formTitle").textContent="ওষুধের তথ্য পরিবর্তন";window.scrollTo({top:0,behavior:"smooth"});});
 box.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("এই পণ্যটি ওয়েবসাইট থেকে সরাতে চাও?"))return;const {error}=await client.from("medicines").update({is_active:false}).eq("id",b.dataset.delete);if(error)msg(adminStatus,"Delete করা যায়নি: "+error.message,true);else{msg(adminStatus,"পণ্যটি ওয়েবসাইট থেকে সরানো হয়েছে।");loadList();}});
}
function showUser(user){
 currentUser=user;if(!user||String(user.email).toLowerCase()!==ADMIN_EMAIL){loginPanel.hidden=false;dashboard.hidden=true;msg(loginStatus,"এই ইমেইলটি Admin হিসেবে অনুমোদিত নয়।",true);if(client)client.auth.signOut();return;}
 loginPanel.hidden=true;dashboard.hidden=false;loadList();
}
if(!window.supabase||!window.BMP_SUPABASE_URL||!window.BMP_SUPABASE_ANON_KEY||window.BMP_SUPABASE_ANON_KEY.startsWith("PASTE_")){msg(loginStatus,"প্রথমে supabase-config.js ফাইলে Supabase publishable/anon key বসাও।",true);$("loginForm").onsubmit=e=>e.preventDefault();return;}
client=window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);
$("loginForm").onsubmit=async e=>{e.preventDefault();msg(loginStatus,"লগইন হচ্ছে...");const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("password").value="";if(error){msg(loginStatus,"লগইন হয়নি: "+error.message,true);return;}showUser(data.user);};
$("logoutBtn").onclick=async()=>{await client.auth.signOut();currentUser=null;dashboard.hidden=true;loginPanel.hidden=false;msg(loginStatus,"Logout সম্পন্ন হয়েছে।");};
$("resetBtn").onclick=reset;
$("medicineForm").onsubmit=async e=>{
 e.preventDefault();if(!currentUser||String(currentUser.email).toLowerCase()!==ADMIN_EMAIL){msg(adminStatus,"Admin Login প্রয়োজন।",true);return;}msg(adminStatus,"তথ্য সংরক্ষণ হচ্ছে...");
 let imageUrl=val("image_url");const file=$("imageFile").files[0];
 if(file){if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){msg(adminStatus,"ছবি JPG, PNG বা WebP হতে হবে এবং ৫ MB-এর কম হতে হবে।",true);return;}
 const name=file.name.toLowerCase().replace(/[^a-z0-9._-]/g,"-"),path=`${currentUser.id}/${Date.now()}-${name}`;
 const {error}=await client.storage.from("medicine-images").upload(path,file,{contentType:file.type,upsert:false});if(error){msg(adminStatus,"ছবি আপলোড হয়নি: "+error.message,true);return;}
 imageUrl=client.storage.from("medicine-images").getPublicUrl(path).data.publicUrl;
 }
 const row={name:val("name"),generic_name:val("generic_name"),strength:val("strength"),form:val("form"),manufacturer:val("manufacturer"),pack_size:val("pack_size"),unit_price:val("unit_price"),pack_price:val("pack_price"),image_url:imageUrl,description:val("description"),is_active:true};
 const id=$("medicineId").value;const result=id?await client.from("medicines").update(row).eq("id",id):await client.from("medicines").insert(row);
 if(result.error){msg(adminStatus,"তথ্য সংরক্ষণ হয়নি: "+result.error.message,true);return;}msg(adminStatus,id?"ওষুধের তথ্য আপডেট হয়েছে।":"নতুন ওষুধ যোগ হয়েছে।");reset();loadList();
};
client.auth.getSession().then(({data})=>{if(data.session)showUser(data.session.user);});
})();
