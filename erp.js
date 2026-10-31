(() => {
const $ = id => document.getElementById(id);
const ADMIN_UID = "7a3166f2-e4bb-42b8-a649-033dd2d02090";
const ADMIN_EMAIL = "mdmeharajh9@gmail.com";
let db = null, activeUser = null, customers = [], photoPath = null;
const say = (el, message, error=false) => { el.textContent=message; el.classList.toggle("error",error); };
const value = id => $(id).value.trim();
const money = n => Number(n || 0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2});
const safe = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function today(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function resetForm(){
 $("customerForm").reset();$("recordId").value="";$("customerId").value="";$("previousDue").value="0";$("creditLimit").value="0";$("registrationDate").value=today();$("previousDue").disabled=false;$("photoPreview").hidden=true;$("photoPreview").removeAttribute("src");$("formTitle").textContent="Customer Information";photoPath=null;
}
function openForm(row=null){
 resetForm();$("customerFormPanel").hidden=false;
 if(row){
  $("formTitle").textContent="Edit Customer";$("recordId").value=row.id;$("customerId").value=row.customer_id;
  const map={customerName:"customer_name",mobile:"mobile_number",alternativePhone:"alternative_phone",customerEmail:"email",mid:"mid",referencePartner:"reference_partner",customerType:"customer_type",address:"address",previousDue:"previous_due",creditLimit:"credit_limit",notes:"notes",registrationDate:"registration_date"};
  Object.entries(map).forEach(([field,key])=>$(field).value=row[key]??"");
  $("previousDue").disabled=true;photoPath=row.photo_path||null;
  if(photoPath) db.storage.from("customer-photos").createSignedUrl(photoPath,3600).then(({data})=>{if(data?.signedUrl){$("photoPreview").src=data.signedUrl;$("photoPreview").hidden=false;}});
 }
 $("customerFormPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadCustomers(){
 $("customerRows").innerHTML='<tr><td colspan="8">তথ্য লোড হচ্ছে...</td></tr>';
 let q=db.from("customers").select("id,customer_id,customer_name,mobile_number,customer_type,previous_due,credit_limit,is_active,registration_date,photo_path").order("created_at",{ascending:false});
 const status=$("statusFilter").value;if(status==="active")q=q.eq("is_active",true);if(status==="inactive")q=q.eq("is_active",false);
 const {data,error}=await q;
 if(error){$("customerRows").innerHTML='<tr><td colspan="8">তথ্য আনা যায়নি।</td></tr>';say($("pageStatus"),"Customer list load হয়নি: "+error.message,true);return;}
 customers=data||[];renderRows();
}
function renderRows(){
 const term=value("searchInput").toLowerCase();
 const rows=customers.filter(c=>[c.customer_id,c.customer_name,c.mobile_number].some(v=>String(v||"").toLowerCase().includes(term)));
 if(!rows.length){$("customerRows").innerHTML='<tr><td colspan="8">কোনো Customer পাওয়া যায়নি।</td></tr>';return;}
 $("customerRows").innerHTML=rows.map(c=>`<tr><td><b>${safe(c.customer_id)}</b></td><td>${safe(c.customer_name)}</td><td>${safe(c.mobile_number)}</td><td>${safe(c.customer_type)}</td><td>৳ ${money(c.previous_due)}</td><td>৳ ${money(c.credit_limit)}</td><td><span class="pill ${c.is_active?"":"off"}">${c.is_active?"Active":"Inactive"}</span></td><td><div class="row-actions"><button class="btn muted" data-edit="${safe(c.id)}" type="button">Edit</button><button class="btn muted" data-toggle="${safe(c.id)}" type="button">${c.is_active?"Deactivate":"Activate"}</button></div></td></tr>`).join("");
 $("customerRows").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openForm(customers.find(c=>c.id===b.dataset.edit)));
 $("customerRows").querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleCustomer(b.dataset.toggle));
}
async function toggleCustomer(id){
 const row=customers.find(c=>c.id===id);if(!row)return;
 const action=row.is_active?"নিষ্ক্রিয়":"সক্রিয়";if(!confirm("এই Customer-কে "+action+" করতে চাও?"))return;
 const {error}=await db.from("customers").update({is_active:!row.is_active}).eq("id",id);
 if(error){say($("pageStatus"),"Status পরিবর্তন হয়নি: "+error.message,true);return;}
 say($("pageStatus"),"Customer status পরিবর্তন হয়েছে।");await loadCustomers();
}
async function uploadPhoto(file){
 if(!file)return photoPath;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new Error("ছবি JPG, PNG বা WebP হতে হবে এবং ৫ MB-এর কম হতে হবে।");
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const path=activeUser.id+"/"+crypto.randomUUID()+"."+ext;
 const {error}=await db.storage.from("customer-photos").upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw error;return path;
}
$("customerPhoto").addEventListener("change",e=>{
 const file=e.target.files[0];if(!file){$("photoPreview").hidden=true;return;}
 if(file.size>5*1024*1024){say($("pageStatus"),"ছবির সাইজ ৫ MB-এর বেশি।",true);e.target.value="";return;}
 $("photoPreview").src=URL.createObjectURL(file);$("photoPreview").hidden=false;
});
$("customerForm").onsubmit=async e=>{
 e.preventDefault();if(!activeUser||activeUser.id!==ADMIN_UID)return;
 const id=value("recordId"),mobile=value("mobile"),name=value("customerName");
 if(!name||!mobile){say($("pageStatus"),"Customer Name এবং Mobile Number আবশ্যক।",true);return;}
 const duplicateQuery=await db.from("customers").select("id,customer_name,mobile_number").eq("mobile_number",mobile).eq("is_active",true);
 if(duplicateQuery.error){say($("pageStatus"),"Duplicate check করা যায়নি: "+duplicateQuery.error.message,true);return;}
 const duplicates=(duplicateQuery.data||[]).filter(c=>c.id!==id);
 if(duplicates.length&&!confirm("এই Mobile Number দিয়ে আগে Customer আছে ("+duplicates.map(c=>c.customer_name).join(", ")+")। তারপরও সংরক্ষণ করবে?"))return;
 const previousDue=Number(value("previousDue")||0),creditLimit=Number(value("creditLimit")||0);
 if(!id&&(previousDue<0||creditLimit<0)){say($("pageStatus"),"Due ও Credit Limit ঋণাত্মক হতে পারবে না।",true);return;}
 say($("pageStatus"),"Customer সংরক্ষণ হচ্ছে...");
 try{
  const file=$("customerPhoto").files[0];const newPhoto=await uploadPhoto(file);
  const row={customer_name:name,mobile_number:mobile,alternative_phone:value("alternativePhone")||null,email:value("customerEmail")||null,mid:value("mid")||null,reference_partner:value("referencePartner")||null,customer_type:value("customerType"),address:value("address")||null,credit_limit:creditLimit,photo_path:newPhoto,notes:value("notes")||null,registration_date:value("registrationDate")};
  let result;
  if(id){result=await db.from("customers").update(row).eq("id",id).select("id").single();}
  else{row.previous_due=previousDue;result=await db.from("customers").insert(row).select("id,customer_id").single();}
  if(result.error)throw result.error;
  say($("pageStatus"),id?"Customer update হয়েছে।":"Customer তৈরি হয়েছে। Customer ID: "+result.data.customer_id);
  $("customerFormPanel").hidden=true;resetForm();await loadCustomers();
 }catch(err){say($("pageStatus"),"সংরক্ষণ হয়নি: "+(err.message||String(err)),true);}
};
$("newCustomerBtn").onclick=()=>openForm();$("closeFormBtn").onclick=$("cancelFormBtn").onclick=()=>{$("customerFormPanel").hidden=true;resetForm();};
$("searchInput").oninput=renderRows;$("statusFilter").onchange=loadCustomers;
$("loginForm").onsubmit=async e=>{
 e.preventDefault();say($("loginStatus"),"লগইন হচ্ছে...");
 const {data,error}=await db.auth.signInWithPassword({email:value("email"),password:$("password").value});$("password").value="";
 if(error){say($("loginStatus"),"Login হয়নি: "+error.message,true);return;}await verifyUser(data.user);
};
async function verifyUser(user){
 if(!user||user.id!==ADMIN_UID||String(user.email).toLowerCase()!==ADMIN_EMAIL){await db.auth.signOut();$("workspace").hidden=true;$("loginPanel").hidden=false;say($("loginStatus"),"এই অ্যাকাউন্টটি Super Admin হিসেবে অনুমোদিত নয়।",true);return;}
 activeUser=user;$("loginPanel").hidden=true;$("workspace").hidden=false;$("logoutBtn").hidden=false;await loadCustomers();
}
$("logoutBtn").onclick=async()=>{await db.auth.signOut();activeUser=null;$("workspace").hidden=true;$("loginPanel").hidden=false;$("logoutBtn").hidden=true;};

async function loadMedicines(){
 const body=$("medicineRows");if(!body)return;body.innerHTML='<tr><td colspan="9">তথ্য লোড হচ্ছে...</td></tr>';
 let q=db.from("erp_medicines").select("*").order("created_at",{ascending:false});
 const s=$("medicineStatus").value;if(s==="active")q=q.eq("is_active",true);if(s==="inactive")q=q.eq("is_active",false);
 const {data,error}=await q;if(error){body.innerHTML='<tr><td colspan="9">Medicine list load হয়নি।</td></tr>';say($("medicineStatusText"),"Database migration চালু না থাকলে এই তালিকা লোড হবে না: "+error.message,true);return;}
 const term=$("medicineSearch").value.trim().toLowerCase();
 const rows=(data||[]).filter(m=>[m.medicine_name,m.generic_name,m.brand,m.manufacturer,m.barcode].some(v=>String(v||"").toLowerCase().includes(term)));
 body.innerHTML=rows.length?rows.map(m=>`<tr><td><b>${safe(m.medicine_name)}</b></td><td>${safe(m.generic_name||"—")}</td><td>${safe(m.strength||"—")} / ${safe(m.dosage_form||"—")}</td><td>${safe(m.manufacturer||"—")}</td><td>${safe(m.barcode||"—")}</td><td>৳ ${money(m.purchase_price)}</td><td>৳ ${money(m.selling_price)} / ${money(m.mrp)}</td><td>${m.is_active?"Active":"Inactive"}</td><td><button class="btn muted" data-medit="${safe(m.id)}" type="button">Edit</button></td></tr>`).join(""):'<tr><td colspan="9">কোনো Medicine পাওয়া যায়নি।</td></tr>';
 body.querySelectorAll("[data-medit]").forEach(b=>b.onclick=()=>openMedicine(data.find(m=>m.id===b.dataset.medit)));
}
function openMedicine(m=null){
 $("medicineForm").reset();$("medicineRecordId").value=m?.id||"";$("medicineFormTitle").textContent=m?"Edit Medicine":"Add Medicine";
 const fields={medicineName:"medicine_name",genericName:"generic_name",brandName:"brand",medicineGroup:"therapeutic_group",dosageForm:"dosage_form",medicineStrength:"strength",packSize:"pack_size",manufacturer:"manufacturer",barcode:"barcode",purchasePrice:"purchase_price",sellingPrice:"selling_price",mrp:"mrp",boxPrice:"box_price",stripPrice:"strip_price",unitPrice:"unit_price",unitsPerStrip:"units_per_strip",stripsPerBox:"strips_per_box",saleUnitsAllowed:"sale_units_allowed",medicineDescription:"description"};
 if(m)Object.entries(fields).forEach(([a,b])=>$(a).value=m[b]??"");$("medicineActive").value=String(m?.is_active??true);$("medicineFormPanel").hidden=false;$("medicineFormPanel").scrollIntoView({behavior:"smooth"});
}
$("medicineForm").onsubmit=async e=>{e.preventDefault();if(!activeUser||activeUser.id!==ADMIN_UID)return;
 const n=Number(id=>$(id).value||0);const payload={medicine_name:value("medicineName"),generic_name:value("genericName")||null,brand:value("brandName")||null,therapeutic_group:value("medicineGroup")||null,dosage_form:value("dosageForm"),strength:value("medicineStrength")||null,pack_size:value("packSize")||null,manufacturer:value("manufacturer")||null,barcode:value("barcode")||null,purchase_price:n("purchasePrice"),selling_price:n("sellingPrice"),mrp:n("mrp"),box_price:n("boxPrice"),strip_price:n("stripPrice"),unit_price:n("unitPrice"),units_per_strip:n("unitsPerStrip"),strips_per_box:n("stripsPerBox"),sale_units_allowed:value("saleUnitsAllowed")||null,description:value("medicineDescription")||null,is_active:$("medicineActive").value==="true"};
 if([payload.purchase_price,payload.selling_price,payload.mrp,payload.box_price,payload.strip_price,payload.unit_price,payload.units_per_strip,payload.strips_per_box].some(v=>v<0)){say($("medicineStatusText"),"Price ও conversion quantity ঋণাত্মক হতে পারবে না।",true);return;}
 say($("medicineStatusText"),"Medicine সংরক্ষণ হচ্ছে...");
 const id=value("medicineRecordId");const res=id?await db.from("erp_medicines").update(payload).eq("id",id):await db.from("erp_medicines").insert(payload);
 if(res.error){say($("medicineStatusText"),"সংরক্ষণ হয়নি: "+res.error.message,true);return;}
 $("medicineFormPanel").hidden=true;say($("medicineStatusText"),"Medicine সংরক্ষণ হয়েছে। Stock পরিবর্তন হয়নি।");await loadMedicines();
};
$("newMedicineBtn").onclick=()=>openMedicine();$("closeMedicineForm").onclick=$("cancelMedicineForm").onclick=()=>{$("medicineFormPanel").hidden=true;};
$("medicineSearch").oninput=loadMedicines;$("medicineStatus").onchange=loadMedicines;
$("customersTab").onclick=()=>{$("medicineModule").hidden=true;$("newCustomerBtn").closest(".panel").hidden=false;$("customerFormPanel").hidden=true;$("customersTab").classList.add("active");$("medicinesTab").classList.remove("active");};
$("medicinesTab").onclick=()=>{$("medicineModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;$("medicinesTab").classList.add("active");$("customersTab").classList.remove("active");loadMedicines();};

if(!window.supabase||!window.BMP_SUPABASE_URL||!window.BMP_SUPABASE_ANON_KEY||window.BMP_SUPABASE_ANON_KEY.startsWith("PASTE_")){say($("loginStatus"),"Supabase config পাওয়া যায়নি।",true);return;}
db=window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);
db.auth.getSession().then(({data})=>{if(data.session)verifyUser(data.session.user);});
})();