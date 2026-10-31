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
 await loadFingerprintSetting();
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
 const n=id=>Number($(id).value||0);const payload={medicine_name:value("medicineName"),generic_name:value("genericName")||null,brand:value("brandName")||null,therapeutic_group:value("medicineGroup")||null,dosage_form:value("dosageForm"),strength:value("medicineStrength")||null,pack_size:value("packSize")||null,manufacturer:value("manufacturer")||null,barcode:value("barcode")||null,purchase_price:n("purchasePrice"),selling_price:n("sellingPrice"),mrp:n("mrp"),box_price:n("boxPrice"),strip_price:n("stripPrice"),unit_price:n("unitPrice"),units_per_strip:n("unitsPerStrip"),strips_per_box:n("stripsPerBox"),sale_units_allowed:value("saleUnitsAllowed")||null,description:value("medicineDescription")||null,is_active:$("medicineActive").value==="true"};
 if([payload.purchase_price,payload.selling_price,payload.mrp,payload.box_price,payload.strip_price,payload.unit_price,payload.units_per_strip,payload.strips_per_box].some(v=>v<0)){say($("medicineStatusText"),"Price ও conversion quantity ঋণাত্মক হতে পারবে না।",true);return;}
 say($("medicineStatusText"),"Medicine সংরক্ষণ হচ্ছে...");
 const id=value("medicineRecordId");const res=id?await db.from("erp_medicines").update(payload).eq("id",id):await db.from("erp_medicines").insert(payload);
 if(res.error){say($("medicineStatusText"),"সংরক্ষণ হয়নি: "+res.error.message,true);return;}
 $("medicineFormPanel").hidden=true;say($("medicineStatusText"),"Medicine সংরক্ষণ হয়েছে। Stock পরিবর্তন হয়নি।");await loadMedicines();
};
$("newMedicineBtn").onclick=()=>openMedicine();$("closeMedicineForm").onclick=$("cancelMedicineForm").onclick=()=>{$("medicineFormPanel").hidden=true;};
$("medicineSearch").oninput=loadMedicines;$("medicineStatus").onchange=loadMedicines;
$("customersTab").onclick=()=>{$("medicineModule").hidden=true;$("batchModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=true;$("purchaseModule").hidden=true;$("newCustomerBtn").closest(".panel").hidden=false;$("customerFormPanel").hidden=true;$("customersTab").classList.add("active");$("medicinesTab").classList.remove("active");};
$("medicinesTab").onclick=()=>{$("batchModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=true;$("purchaseModule").hidden=true;$("medicineModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;$("medicinesTab").classList.add("active");$("customersTab").classList.remove("active");loadMedicines();};


async function loadBatchMedicineOptions(selected=""){
 const {data,error}=await db.from("erp_medicines").select("id,medicine_name,brand,strength").eq("is_active",true).order("medicine_name");
 if(error){say($("batchStatusText"),"Medicine list আনা যায়নি: "+error.message,true);return;}
 $("batchMedicine").innerHTML='<option value="">Medicine নির্বাচন করুন</option>'+(data||[]).map(m=>'<option value="'+safe(m.id)+'">'+safe(m.medicine_name)+(m.strength?" · "+safe(m.strength):"")+(m.brand?" · "+safe(m.brand):"")+'</option>').join("");
 $("batchMedicine").value=selected;
}
async function loadBatches(){
 const body=$("batchRows");if(!body)return;
 body.innerHTML='<tr><td colspan="10">Batch list লোড হচ্ছে...</td></tr>';
 const {data,error}=await db.from("erp_medicine_batches").select("*,erp_medicines(medicine_name,brand,strength)").order("expiry_date",{ascending:true});
 if(error){body.innerHTML='<tr><td colspan="10">Batch list load হয়নি।</td></tr>';say($("batchStatusText"),"Batch list আনা যায়নি: "+error.message,true);return;}
 const term=value("batchSearch").toLowerCase(), filter=$("batchExpiryFilter").value, now=today();
 const edge=new Date();edge.setDate(edge.getDate()+90);const edgeDate=new Date(edge.getTime()-edge.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const rows=(data||[]).filter(b=>{
  const name=b.erp_medicines?.medicine_name||"";
  const matches=[name,b.batch_number,b.erp_medicines?.brand].some(v=>String(v||"").toLowerCase().includes(term));
  const expiry=b.expiry_date<now;
  return matches&&(filter==="all"||(filter==="expired"&&expiry)||(filter==="soon"&&!expiry&&b.expiry_date<=edgeDate));
 });
 if(!rows.length){body.innerHTML='<tr><td colspan="10">কোনো Batch পাওয়া যায়নি।</td></tr>';return;}
 body.innerHTML=rows.map(b=>{
  const expired=b.expiry_date<now, soon=!expired&&b.expiry_date<=edgeDate;
  const label=expired?"Expired":soon?"Expiring Soon":b.is_active?"Active":"Inactive";
  return '<tr><td><b>'+safe(b.erp_medicines?.medicine_name||"Unknown")+'</b></td><td>'+safe(b.batch_number)+'</td><td>'+safe(b.manufacturing_date||"—")+'</td><td>'+safe(b.expiry_date)+'</td><td>৳ '+money(b.purchase_price)+'</td><td>৳ '+money(b.mrp)+'</td><td>'+safe(b.quantity_received)+'</td><td>'+safe(b.quantity_available)+'</td><td><span class="pill '+(expired?"off":"")+'">'+label+'</span></td><td><button class="btn muted" data-bedit="'+safe(b.id)+'" type="button">Edit</button></td></tr>';
 }).join("");
 body.querySelectorAll("[data-bedit]").forEach(btn=>btn.onclick=()=>openBatch(rows.find(b=>b.id===btn.dataset.bedit)));
}
function openBatch(batch=null){
 $("batchForm").reset();$("batchRecordId").value=batch?.id||"";
 $("batchFormTitle").textContent=batch?"Edit Batch":"Add Batch";
 $("batchReceived").value=today();$("batchQuantity").value="0";
 $("batchMedicine").disabled=false;$("batchQuantity").disabled=false;$("batchQuantityNote").hidden=true;
 loadBatchMedicineOptions(batch?.medicine_id||"").then(()=>{
  if(batch){$("batchMedicine").disabled=true;$("batchQuantity").value=batch.quantity_received;$("batchQuantity").disabled=true;$("batchQuantityNote").hidden=false;}
 });
 const fields={batchNumber:"batch_number",batchMfg:"manufacturing_date",batchExpiry:"expiry_date",batchReceived:"received_date",batchPurchasePrice:"purchase_price",batchMrp:"mrp",batchSupplier:"supplier_name",batchNotes:"notes"};
 if(batch)Object.entries(fields).forEach(([a,b])=>$(a).value=batch[b]??"");
 $("batchFormPanel").hidden=false;$("batchFormPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
$("batchForm").onsubmit=async e=>{
 e.preventDefault();if(!activeUser||activeUser.id!==ADMIN_UID)return;
 const medicineId=value("batchMedicine"),batchNumber=value("batchNumber"),expiry=value("batchExpiry"),mfg=value("batchMfg"),qty=Number(value("batchQuantity"));
 if(!medicineId||!batchNumber||!expiry||!value("batchReceived")){say($("batchStatusText"),"Medicine, Batch Number, Expiry ও Received Date আবশ্যক।",true);return;}
 if(mfg&&expiry<=mfg){say($("batchStatusText"),"Expiry Date অবশ্যই Manufacturing Date-এর পরে হতে হবে।",true);return;}
 if(!Number.isInteger(qty)||qty<0){say($("batchStatusText"),"Quantity শূন্য বা ধনাত্মক পূর্ণসংখ্যা হতে হবে।",true);return;}
 const id=value("batchRecordId");
 const payload={medicine_id:medicineId,batch_number:batchNumber,manufacturing_date:mfg||null,expiry_date:expiry,received_date:value("batchReceived"),purchase_price:Number(value("batchPurchasePrice")||0),mrp:Number(value("batchMrp")||0),supplier_name:value("batchSupplier")||null,notes:value("batchNotes")||null};
 if(payload.purchase_price<0||payload.mrp<0){say($("batchStatusText"),"Price ঋণাত্মক হতে পারবে না।",true);return;}
 say($("batchStatusText"),"Batch সংরক্ষণ হচ্ছে...");
 let result;
 if(id) result=await db.from("erp_medicine_batches").update(payload).eq("id",id);
 else {payload.quantity_received=qty;payload.quantity_available=qty;payload.created_by=activeUser.id;result=await db.from("erp_medicine_batches").insert(payload);}
 if(result.error){say($("batchStatusText"),"Batch সংরক্ষণ হয়নি: "+result.error.message,true);return;}
 $("batchFormPanel").hidden=true;$("batchMedicine").disabled=false;$("batchQuantity").disabled=false;
 say($("batchStatusText"),id?"Batch-এর তথ্য আপডেট হয়েছে। Quantity অপরিবর্তিত আছে।":"Batch যোগ হয়েছে। প্রাথমিক Available Quantity সেট হয়েছে।");
 await loadBatches();
};
$("newBatchBtn").onclick=()=>openBatch();
$("closeBatchForm").onclick=$("cancelBatchForm").onclick=()=>{$("batchFormPanel").hidden=true;$("batchMedicine").disabled=false;$("batchQuantity").disabled=false;};
$("batchSearch").oninput=loadBatches;$("batchExpiryFilter").onchange=loadBatches;
$("batchesTab").onclick=()=>{
 $("medicineModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=true;$("purchaseModule").hidden=true;$("batchModule").hidden=false;
 $("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;
 $("batchesTab").classList.add("active");$("customersTab").classList.remove("active");$("medicinesTab").classList.remove("active");
 loadBatches();
};


let barcodeMedicines=[];
async function loadBarcodeMedicines(){
 const body=$("barcodeRows");if(!body)return;
 body.innerHTML='<tr><td colspan="4">Medicine list লোড হচ্ছে...</td></tr>';
 const {data,error}=await db.from("erp_medicines").select("id,medicine_name,brand,strength,barcode,is_active").order("medicine_name");
 if(error){body.innerHTML='<tr><td colspan="4">তথ্য আনা যায়নি।</td></tr>';say($("barcodeStatus"),"Barcode list load হয়নি: "+error.message,true);return;}
 barcodeMedicines=data||[];renderBarcodeRows();
}
function renderBarcodeRows(){
 const term=value("barcodeSearch").toLowerCase(),filter=$("barcodeFilter").value;
 const rows=barcodeMedicines.filter(m=>{
  const match=[m.medicine_name,m.brand,m.barcode,m.strength].some(v=>String(v||"").toLowerCase().includes(term));
  return match&&(filter==="all"||(filter==="missing"&&!m.barcode)||(filter==="has"&&m.barcode));
 });
 $("barcodeRows").innerHTML=rows.length?rows.map(m=>'<tr><td><b>'+safe(m.medicine_name)+'</b></td><td>'+safe([m.brand,m.strength].filter(Boolean).join(" · ")||"—")+'</td><td>'+safe(m.barcode||"Not assigned")+'</td><td><div class="row-actions"><button class="btn muted" data-bview="'+safe(m.id)+'" type="button">View / Print</button><button class="btn muted" data-bassign="'+safe(m.id)+'" type="button">'+(m.barcode?"Regenerate":"Generate")+'</button></div></td></tr>').join(""):'<tr><td colspan="4">কোনো Medicine পাওয়া যায়নি।</td></tr>';
 $("barcodeRows").querySelectorAll("[data-bview]").forEach(b=>b.onclick=()=>showBarcode(barcodeMedicines.find(m=>m.id===b.dataset.bview)));
 $("barcodeRows").querySelectorAll("[data-bassign]").forEach(b=>b.onclick=()=>assignBarcode(b.dataset.bassign));
}
function renderBarcodeLabel(m){
 if(!m)return;
 if(!m.barcode){say($("barcodeStatus"),"এই Medicine-এর barcode নেই। Generate চাপুন।",true);return;}
 if(!window.JsBarcode){say($("barcodeStatus"),"Barcode library load হয়নি। Internet connection পরীক্ষা করুন।",true);return;}
 $("barcodeLabelName").textContent=m.medicine_name;
 $("barcodeLabelMeta").textContent=[m.brand,m.strength,m.is_active?"Active":"Inactive"].filter(Boolean).join(" · ");
 $("barcodeLabelCode").textContent=m.barcode;
 try{window.JsBarcode("#barcodeSvg",m.barcode,{format:"CODE128",lineColor:"#111",width:2,height:62,displayValue:false,margin:8});}
 catch(err){say($("barcodeStatus"),"এই code দিয়ে barcode তৈরি করা যায়নি: "+err.message,true);return;}
 $("barcodeLabelPanel").hidden=false;$("barcodeLabelPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function showBarcode(m){if(!m)return;renderBarcodeLabel(m);}
async function assignBarcode(id){
 const m=barcodeMedicines.find(x=>x.id===id);if(!m)return;
 if(m.barcode&&!confirm("বর্তমান barcode বদলে নতুন barcode তৈরি করবেন?"))return;
 const code="BMP"+crypto.randomUUID().replace(/-/g,"").slice(0,16).toUpperCase();
 say($("barcodeStatus"),"নতুন barcode সংরক্ষণ হচ্ছে...");
 const {error}=await db.from("erp_medicines").update({barcode:code}).eq("id",id);
 if(error){say($("barcodeStatus"),"Barcode সংরক্ষণ হয়নি: "+error.message,true);return;}
 m.barcode=code;renderBarcodeRows();renderBarcodeLabel(m);say($("barcodeStatus"),"Barcode তৈরি ও সংরক্ষণ হয়েছে।");
}
async function findScannedBarcode(){
 const code=value("barcodeScanInput");if(!code){say($("barcodeStatus"),"আগে Barcode scan বা লিখুন।",true);return;}
 const match=barcodeMedicines.find(m=>String(m.barcode||"").trim().toLowerCase()===code.toLowerCase());
 if(match){showBarcode(match);say($("barcodeStatus"),"Medicine পাওয়া গেছে: "+match.medicine_name);return;}
 const {data,error}=await db.from("erp_medicines").select("id,medicine_name,brand,strength,barcode,is_active").eq("barcode",code).maybeSingle();
 if(error){say($("barcodeStatus"),"খোঁজা যায়নি: "+error.message,true);return;}
 if(!data){$("barcodeLabelPanel").hidden=true;say($("barcodeStatus"),"এই Barcode-এর কোনো Medicine পাওয়া যায়নি।",true);return;}
 showBarcode(data);say($("barcodeStatus"),"Medicine পাওয়া গেছে: "+data.medicine_name);
}
$("barcodeScanBtn").onclick=findScannedBarcode;
$("barcodeScanInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findScannedBarcode();}});
$("barcodeSearch").oninput=renderBarcodeRows;$("barcodeFilter").onchange=renderBarcodeRows;
$("printBarcodeBtn").onclick=()=>{if(!$("barcodeLabelPanel").hidden)window.print();};
$("barcodeTab").onclick=()=>{
 $("medicineModule").hidden=true;$("batchModule").hidden=true;$("posModule").hidden=true;$("purchaseModule").hidden=true;$("barcodeModule").hidden=false;
 $("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;
 ["customersTab","medicinesTab","batchesTab"].forEach(id=>$(id).classList.remove("active"));
 $("barcodeTab").classList.add("active");loadBarcodeMedicines();
};


let posCart=[],posBatches=[];
const pMoney=n=>Number(n||0).toFixed(2);
function pRender(){const body=$("posCartRows");body.innerHTML=posCart.length?posCart.map((x,i)=>'<tr><td>'+safe(x.name)+'<br><small>'+safe(x.batch)+'</small></td><td>'+x.qty+'</td><td>'+pMoney(x.price)+'</td><td>'+pMoney(x.qty*x.price)+'</td><td><button class="btn muted" data-r="'+i+'">Remove</button></td></tr>').join(""):'<tr><td colspan="5">Cart খালি।</td></tr>';body.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{posCart.splice(+b.dataset.r,1);pRender();});const sub=posCart.reduce((s,x)=>s+x.qty*x.price,0),disc=Number(value("posDiscount")||0);$("posSubtotal").textContent=pMoney(sub);$("posTotal").textContent=pMoney(Math.max(0,sub-disc));if(!$("posPaid").dataset.touched)$("posPaid").value=pMoney(Math.max(0,sub-disc));}
async function pSearch(){const q=value("posMedicineSearch");if(!q)return;const {data,error}=await db.from("erp_medicines").select("id,medicine_name,selling_price,barcode").eq("is_active",true).or("medicine_name.ilike.%"+q+"%,barcode.eq."+q).limit(10);if(error){say($("posProductStatus"),error.message,true);return;}const all=await Promise.all((data||[]).map(async m=>{const r=await db.from("erp_medicine_batches").select("id,batch_number,expiry_date,quantity_available,mrp").eq("medicine_id",m.id).eq("is_active",true).gt("quantity_available",0).gte("expiry_date",today()).order("expiry_date");return (r.data||[]).map(b=>({...b,m}));}));posBatches=all.flat();$("posBatchSelect").innerHTML='<option value="">Batch নির্বাচন করুন</option>'+posBatches.map(b=>'<option value="'+b.id+'">'+safe(b.m.medicine_name)+' · '+safe(b.batch_number)+' · Qty '+b.quantity_available+'</option>').join("");say($("posProductStatus"),posBatches.length?posBatches.length+"টি Batch পাওয়া গেছে।":"Stock নেই।",!posBatches.length);}
$("posMedicineSearch").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();pSearch();}};
$("posBatchSelect").onchange=()=>{const b=posBatches.find(x=>x.id===value("posBatchSelect"));if(b)$("posUnitPrice").value=Number(b.m.selling_price||b.mrp||0).toFixed(2);};
$("addPosItemBtn").onclick=()=>{const b=posBatches.find(x=>x.id===value("posBatchSelect")),qty=Number(value("posQuantity")),price=Number(value("posUnitPrice"));if(!b||!Number.isInteger(qty)||qty<1||qty>b.quantity_available||price<0||!Number.isFinite(price)){say($("posProductStatus"),"Batch, Quantity ও Price সঠিক দিন।",true);return;}const x=posCart.find(x=>x.batch_id===b.id);if(x){if(x.qty+qty>b.quantity_available){say($("posProductStatus"),"Stock যথেষ্ট নেই।",true);return;}x.qty+=qty;}else posCart.push({batch_id:b.id,name:b.m.medicine_name,batch:b.batch_number,qty,price});pRender();};
$("posDiscount").oninput=pRender;$("posPaid").oninput=()=>{$("posPaid").dataset.touched="1";};
async function pCustomers(){const {data,error}=await db.from("customers").select("id,customer_name,mobile_number").eq("is_active",true).order("customer_name");if(error)return;$("posCustomer").innerHTML='<option value="">Walk-in Customer</option>'+(data||[]).map(c=>'<option value="'+c.id+'">'+safe(c.customer_name)+' · '+safe(c.mobile_number)+'</option>').join("");}
async function pInvoices(){const {data,error}=await db.from("erp_sales_invoices").select("invoice_number,sale_date,total,paid,due,customers(customer_name)").order("created_at",{ascending:false}).limit(20);if(error)return;$("posInvoiceRows").innerHTML=(data||[]).map(x=>'<tr><td>'+safe(x.invoice_number)+'</td><td>'+new Date(x.sale_date).toLocaleString("en-BD")+'</td><td>'+safe(x.customers?.customer_name||"Walk-in")+'</td><td>'+pMoney(x.total)+'</td><td>'+pMoney(x.paid)+'</td><td>'+pMoney(x.due)+'</td></tr>').join("")||'<tr><td colspan="6">Invoice নেই।</td></tr>';}
$("completeSaleBtn").onclick=async()=>{const sub=posCart.reduce((s,x)=>s+x.qty*x.price,0),disc=Number(value("posDiscount")||0),paid=Number(value("posPaid")||0),total=sub-disc;if(!activeUser||activeUser.id!==ADMIN_UID||!posCart.length||disc<0||disc>sub||paid<0||paid>total||(total>paid&&!value("posCustomer"))){say($("posStatus"),"Cart, Discount, Paid Amount ও Credit Customer পরীক্ষা করুন।",true);return;}if(!confirm("৳ "+pMoney(total)+" বিক্রি সম্পন্ন করবেন?"))return;$("completeSaleBtn").disabled=true;const {data,error}=await db.rpc("bmp_create_sale",{p_customer_id:value("posCustomer")||null,p_discount:disc,p_paid:paid,p_payment_method:value("posPaymentMethod"),p_payment_reference:value("posPaymentReference"),p_notes:value("posNotes"),p_items:posCart.map(x=>({batch_id:x.batch_id,quantity:x.qty,unit_price:x.price}))});$("completeSaleBtn").disabled=false;if(error){say($("posStatus"),"বিক্রি হয়নি; Stock অপরিবর্তিত। "+error.message,true);return;} $("posReceiptMeta").textContent=data.invoice_number;$("posReceiptContent").innerHTML='<h2>Bishal Medicine Point</h2><p>Hospital Road, Maijdee, Noakhali · 01816367262</p><h3>Invoice '+safe(data.invoice_number)+'</h3><p>Subtotal ৳ '+pMoney(data.subtotal)+'<br>Discount ৳ '+pMoney(data.discount)+'<br><b>Total ৳ '+pMoney(data.total)+'</b><br>Paid ৳ '+pMoney(data.paid)+'<br>Due ৳ '+pMoney(data.due)+'</p>'+posCart.map(x=>'<p>'+safe(x.name)+' × '+x.qty+' = ৳ '+pMoney(x.qty*x.price)+'</p>').join("");$("posReceiptPanel").hidden=false;posCart=[];$("posDiscount").value=0;$("posPaid").dataset.touched="";pRender();say($("posStatus"),"বিক্রি সফল: "+data.invoice_number);await pInvoices();await pSearch();};
$("printPosReceiptBtn").onclick=()=>window.print();$("refreshPosBtn").onclick=async()=>{await pCustomers();await pInvoices();};$("clearPosBtn").onclick=()=>{posCart=[];pRender();};
$("posTab").onclick=async()=>{$("medicineModule").hidden=true;$("batchModule").hidden=true;$("barcodeModule").hidden=true;$("purchaseModule").hidden=true;$("posModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;["customersTab","medicinesTab","batchesTab","barcodeTab"].forEach(id=>$(id).classList.remove("active"));$("posTab").classList.add("active");await pCustomers();await pInvoices();};


let purchaseCart=[],purchaseMedicines=[];
const purMoney=n=>Number(n||0).toFixed(2);
function renderPurchaseCart(){const body=$("purchaseCartRows");body.innerHTML=purchaseCart.length?purchaseCart.map((x,i)=>'<tr><td>'+safe(x.name)+'</td><td>'+safe(x.batch)+'</td><td>'+x.qty+'</td><td>৳ '+purMoney(x.price)+'</td><td>৳ '+purMoney(x.mrp)+'</td><td>৳ '+purMoney(x.qty*x.price)+'</td><td><button class="btn muted" data-premove="'+i+'" type="button">Remove</button></td></tr>').join(""):'<tr><td colspan="7">Purchase cart খালি।</td></tr>';body.querySelectorAll("[data-premove]").forEach(b=>b.onclick=()=>{purchaseCart.splice(+b.dataset.premove,1);renderPurchaseCart();});const sub=purchaseCart.reduce((s,x)=>s+x.qty*x.price,0),disc=Number(value("purchaseDiscount")||0),total=Math.max(0,sub-disc);$("purchaseSubtotal").textContent=purMoney(sub);$("purchaseTotal").textContent=purMoney(total);if(!$("purchasePaid").dataset.touched)$("purchasePaid").value=purMoney(total);}
async function loadPurchaseLists(){const [s,m]=await Promise.all([db.from("erp_suppliers").select("id,supplier_code,supplier_name").eq("is_active",true).order("supplier_name"),db.from("erp_medicines").select("id,medicine_name,strength").eq("is_active",true).order("medicine_name")]);if(s.error){say($("supplierStatus"),s.error.message,true);return;} $("purchaseSupplier").innerHTML='<option value="">Supplier নির্বাচন করুন</option>'+(s.data||[]).map(x=>'<option value="'+x.id+'">'+safe(x.supplier_code)+' · '+safe(x.supplier_name)+'</option>').join("");if(m.error){say($("purchaseItemStatus"),m.error.message,true);return;}purchaseMedicines=m.data||[];$("purchaseMedicine").innerHTML='<option value="">Medicine নির্বাচন করুন</option>'+purchaseMedicines.map(x=>'<option value="'+x.id+'">'+safe(x.medicine_name)+' · '+safe(x.strength||"")+'</option>').join("");await loadPurchaseRows();}
$("saveSupplierBtn").onclick=async()=>{const name=value("supplierName").trim();if(!name){say($("supplierStatus"),"Supplier Name দিন।",true);return;}const {error}=await db.from("erp_suppliers").insert({supplier_name:name,mobile:value("supplierMobile")||null,email:value("supplierEmail")||null,contact_person:value("supplierContact")||null,address:value("supplierAddress")||null,created_by:activeUser.id});if(error){say($("supplierStatus"),"Supplier save হয়নি: "+error.message,true);return;}["supplierName","supplierMobile","supplierEmail","supplierContact","supplierAddress"].forEach(id=>$(id).value="");say($("supplierStatus"),"Supplier সংরক্ষণ হয়েছে।");await loadPurchaseLists();};
$("addPurchaseItemBtn").onclick=()=>{const med=purchaseMedicines.find(x=>x.id===value("purchaseMedicine")),batch=value("purchaseBatchNumber").trim(),qty=Number(value("purchaseQuantity")),price=Number(value("purchasePrice")),mrp=Number(value("purchaseMrp")),expiry=value("purchaseExpiry"),mfg=value("purchaseMfg");if(!med||!batch||!Number.isInteger(qty)||qty<1||!expiry||!Number.isFinite(price)||price<0||!Number.isFinite(mrp)||mrp<0||(mfg&&expiry<=mfg)){say($("purchaseItemStatus"),"Medicine, Batch, Quantity, Price ও Expiry সঠিকভাবে দিন।",true);return;}purchaseCart.push({medicine_id:med.id,name:med.medicine_name,batch,qty,price,mrp,expiry,manufacturing_date:mfg||null,received_date:value("purchaseReceived")||null});renderPurchaseCart();};
$("purchaseDiscount").oninput=renderPurchaseCart;$("purchasePaid").oninput=()=>{$("purchasePaid").dataset.touched="1";};
$("clearPurchaseBtn").onclick=()=>{purchaseCart=[];$("purchaseDiscount").value=0;$("purchasePaid").value=0;$("purchasePaid").dataset.touched="";renderPurchaseCart();};
async function loadPurchaseRows(){
 const {data,error}=await db.from("erp_purchase_invoices").select("id,purchase_number,purchase_date,total,paid,due,erp_suppliers(supplier_name)").order("created_at",{ascending:false}).limit(100);
 if(error){$("purchaseRows").innerHTML='<tr><td colspan="6">Purchase history load হয়নি।</td></tr>';say($("supplierPaymentStatus"),"Purchase history: "+error.message,true);return;}
 const rows=data||[];
 $("purchaseRows").innerHTML=rows.length?rows.map(x=>'<tr><td>'+safe(x.purchase_number)+'</td><td>'+new Date(x.purchase_date).toLocaleString("en-BD")+'</td><td>'+safe(x.erp_suppliers?.supplier_name||"")+'</td><td>৳ '+purMoney(x.total)+'</td><td>৳ '+purMoney(x.paid)+'</td><td>৳ '+purMoney(x.due)+'</td></tr>').join(""):'<tr><td colspan="6">এখনো কোনো Purchase নেই।</td></tr>';
 const dueRows=rows.filter(x=>Number(x.due)>0);
 $("supplierDuePurchase").innerHTML='<option value="">বকেয়া Purchase নির্বাচন করুন</option>'+dueRows.map(x=>'<option value="'+x.id+'" data-due="'+Number(x.due)+'">'+safe(x.purchase_number)+' · '+safe(x.erp_suppliers?.supplier_name||"")+' · Due ৳ '+purMoney(x.due)+'</option>').join("");
 $("supplierSelectedDue").textContent="0.00";
 const p=await db.from("erp_supplier_payments").select("created_at,amount,payment_method,reference_number,erp_purchase_invoices(purchase_number),erp_suppliers(supplier_name)").order("created_at",{ascending:false}).limit(30);
 if(p.error){$("supplierPaymentRows").innerHTML='<tr><td colspan="6">Payment history load হয়নি: '+safe(p.error.message)+'</td></tr>';return;}
 $("supplierPaymentRows").innerHTML=p.data?.length?p.data.map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString("en-BD")+'</td><td>'+safe(x.erp_purchase_invoices?.purchase_number||"")+'</td><td>'+safe(x.erp_suppliers?.supplier_name||"")+'</td><td>৳ '+purMoney(x.amount)+'</td><td>'+safe(x.payment_method)+'</td><td>'+safe(x.reference_number||"")+'</td></tr>').join(""):'<tr><td colspan="6">এখনো Supplier Payment নেই।</td></tr>';
}
$("completePurchaseBtn").onclick=async()=>{const supplier=value("purchaseSupplier"),sub=purchaseCart.reduce((s,x)=>s+x.qty*x.price,0),discount=Number(value("purchaseDiscount")||0),paid=Number(value("purchasePaid")||0),total=sub-discount;if(!activeUser||activeUser.id!==ADMIN_UID||!supplier||!purchaseCart.length||discount<0||discount>sub||paid<0||paid>total){say($("purchaseStatus"),"Supplier, Cart, Discount ও Paid Amount পরীক্ষা করুন।",true);return;}if(!confirm("৳ "+purMoney(total)+" Purchase সংরক্ষণ করে Stock-এ যোগ করবেন?"))return;$("completePurchaseBtn").disabled=true;say($("purchaseStatus"),"Purchase ও Stock সংরক্ষণ হচ্ছে...");const {data,error}=await db.rpc("bmp_create_purchase",{p_supplier_id:supplier,p_discount:discount,p_paid:paid,p_payment_method:value("purchasePaymentMethod"),p_reference:value("purchaseReference"),p_notes:value("purchaseNotes"),p_items:purchaseCart.map(x=>({medicine_id:x.medicine_id,batch_number:x.batch,quantity:x.qty,purchase_price:x.price,mrp:x.mrp,expiry_date:x.expiry,manufacturing_date:x.manufacturing_date,received_date:x.received_date}))});$("completePurchaseBtn").disabled=false;if(error){say($("purchaseStatus"),"Purchase হয়নি; Stock অপরিবর্তিত। "+error.message,true);return;}purchaseCart=[];$("purchaseDiscount").value=0;$("purchasePaid").dataset.touched="";renderPurchaseCart();say($("purchaseStatus"),"Purchase সফল: "+data.purchase_number+" · Stock যোগ হয়েছে।");await loadPurchaseRows();};

$("supplierDuePurchase").onchange=()=>{const o=$("supplierDuePurchase").selectedOptions[0];$("supplierSelectedDue").textContent=purMoney(o?.dataset.due||0);$("supplierPaymentAmount").max=o?.dataset.due||"";};
$("recordSupplierPaymentBtn").onclick=async()=>{
 const purchase=value("supplierDuePurchase"),amount=Number(value("supplierPaymentAmount"));
 const due=Number($("supplierDuePurchase").selectedOptions[0]?.dataset.due||0);
 if(!activeUser||activeUser.id!==ADMIN_UID||!purchase||!Number.isFinite(amount)||amount<=0||amount>due){say($("supplierPaymentStatus"),"বকেয়া Purchase নির্বাচন করুন এবং Due-এর বেশি নয় এমন Payment Amount দিন।",true);return;}
 if(!confirm("৳ "+purMoney(amount)+" Supplier Payment সংরক্ষণ করবেন?"))return;
 $("recordSupplierPaymentBtn").disabled=true;say($("supplierPaymentStatus"),"Payment সংরক্ষণ হচ্ছে...");
 const {data,error}=await db.rpc("bmp_record_supplier_payment",{p_purchase_id:purchase,p_amount:amount,p_payment_method:value("supplierPaymentMethod"),p_reference:value("supplierPaymentReference"),p_note:value("supplierPaymentNote")});
 $("recordSupplierPaymentBtn").disabled=false;
 if(error){say($("supplierPaymentStatus"),"Payment সংরক্ষণ হয়নি: "+error.message,true);return;}
 $("supplierPaymentAmount").value="0";$("supplierPaymentReference").value="";$("supplierPaymentNote").value="";
 say($("supplierPaymentStatus"),"Payment সফল। Purchase: "+data.purchase_number+" · বাকি Due: ৳ "+purMoney(data.due));
 await loadPurchaseRows();
};
$("refreshPurchaseBtn").onclick=loadPurchaseLists;
$("purchaseTab").onclick=async()=>{["medicineModule","batchModule","barcodeModule","posModule","employeeModule"].forEach(id=>$(id).hidden=true);$("purchaseModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;["customersTab","medicinesTab","batchesTab","barcodeTab","posTab"].forEach(id=>$(id).classList.remove("active"));$("purchaseTab").classList.add("active");await loadPurchaseLists();};


let stockMedicines=[],stockBatches=[];
function renderStockRows(){
 const term=value("stockSearch").toLowerCase(),filter=value("stockFilter");
 const totals=new Map();
 stockMedicines.forEach(m=>totals.set(m.id,{name:m.medicine_name,qty:0,batches:0}));
 stockBatches.forEach(b=>{if(b.is_active&&b.expiry_date>=today()&&Number(b.quantity_available)>0){const t=totals.get(b.medicine_id);if(t){t.qty+=Number(b.quantity_available);t.batches++;}}});
 const rows=[...totals.values()].filter(x=>(x.name.toLowerCase().includes(term))&&(filter==="all"||(filter==="low"&&x.qty>0&&x.qty<=10)||(filter==="out"&&x.qty===0)));
 $("stockRows").innerHTML=rows.length?rows.sort((a,b)=>a.name.localeCompare(b.name)).map(x=>'<tr><td>'+safe(x.name)+'</td><td>'+x.batches+'</td><td>'+x.qty+'</td><td><span class="pill '+(x.qty===0?'off':'')+'">'+(x.qty===0?'Out of Stock':x.qty<=10?'Low Stock':'In Stock')+'</span></td></tr>').join(""):'<tr><td colspan="4">কোনো Medicine পাওয়া যায়নি।</td></tr>';
}
async function loadStock(){
 say($("stockStatus"),"Stock তথ্য লোড হচ্ছে...");
 const [m,b,mv]=await Promise.all([
  db.from("erp_medicines").select("id,medicine_name,is_active").eq("is_active",true).order("medicine_name"),
  db.from("erp_medicine_batches").select("id,medicine_id,batch_number,expiry_date,quantity_available,is_active,erp_medicines(medicine_name)").order("expiry_date"),
  db.from("erp_stock_movements").select("created_at,movement_type,quantity_change,reference_type,reference_id,note,erp_medicines(medicine_name),erp_medicine_batches(batch_number)").order("created_at",{ascending:false}).limit(40)
 ]);
 if(m.error||b.error||mv.error){say($("stockStatus"),"Stock তথ্য আনা যায়নি: "+(m.error||b.error||mv.error).message,true);return;}
 stockMedicines=m.data||[];stockBatches=b.data||[];
 const now=today(),soon=new Date();soon.setDate(soon.getDate()+90);const soonDate=new Date(soon.getTime()-soon.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const active=stockBatches.filter(x=>x.is_active),expired=active.filter(x=>x.expiry_date<now),expiring=active.filter(x=>x.expiry_date>=now&&x.expiry_date<=soonDate);
 const valid=active.filter(x=>x.expiry_date>=now&&Number(x.quantity_available)>0);
 $("stockMedicineCount").textContent=stockMedicines.length;
 $("stockUnitCount").textContent=valid.reduce((s,x)=>s+Number(x.quantity_available),0);
 $("stockExpiredCount").textContent=expired.length;$("stockSoonCount").textContent=expiring.length;
 const qtyByMedicine=new Map();valid.forEach(x=>qtyByMedicine.set(x.medicine_id,(qtyByMedicine.get(x.medicine_id)||0)+Number(x.quantity_available)));
 $("stockLowCount").textContent=stockMedicines.filter(x=>(qtyByMedicine.get(x.id)||0)>0&&(qtyByMedicine.get(x.id)||0)<=10).length;
 $("stockExpiryRows").innerHTML=(expired.concat(expiring).sort((a,b)=>a.expiry_date.localeCompare(b.expiry_date)).slice(0,100).map(x=>'<tr><td>'+safe(x.erp_medicines?.medicine_name||"")+'</td><td>'+safe(x.batch_number)+'</td><td>'+safe(x.expiry_date)+'</td><td>'+Number(x.quantity_available)+'</td><td><span class="pill '+(x.expiry_date<now?'off':'')+'">'+(x.expiry_date<now?'Expired':'Expiring Soon')+'</span></td></tr>').join(""))||'<tr><td colspan="5">মেয়াদোত্তীর্ণ বা আগামী ৯০ দিনের মধ্যে মেয়াদ শেষ হবে এমন Batch নেই।</td></tr>';
 $("stockMovementRows").innerHTML=(mv.data||[]).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString("en-BD")+'</td><td>'+safe(x.erp_medicines?.medicine_name||"")+'</td><td>'+safe(x.erp_medicine_batches?.batch_number||"")+'</td><td>'+safe(x.movement_type)+'</td><td>'+(Number(x.quantity_change)>0?'<span>+'+Number(x.quantity_change)+'</span>':'<span>'+Number(x.quantity_change)+'</span>')+'</td><td>'+safe(x.reference_type)+'</td><td>'+safe(x.note||"")+'</td></tr>').join("")||'<tr><td colspan="7">কোনো Stock movement নেই।</td></tr>';
 renderStockRows();say($("stockStatus"),"Stock তথ্য আপডেট হয়েছে।");
}
$("stockSearch").oninput=renderStockRows;$("stockFilter").onchange=renderStockRows;$("refreshStockBtn").onclick=loadStock;
$("stockTab").onclick=async()=>{["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","employeeModule"].forEach(id=>$(id).hidden=true);$("stockModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab"].forEach(id=>$(id).classList.remove("active"));$("stockTab").classList.add("active");await loadStock();};


async function loadCustomerDue(){
 const [inv,pay]=await Promise.all([
  db.from("erp_sales_invoices").select("id,invoice_number,sale_date,total,paid,due,customers(customer_name,mobile_number)").gt("due",0).not("customer_id","is",null).order("sale_date",{ascending:false}).limit(500),
  db.from("erp_customer_payments").select("created_at,amount,payment_method,reference_number,erp_sales_invoices(invoice_number),customers(customer_name)").order("created_at",{ascending:false}).limit(50)
 ]);
 if(inv.error){say($("customerPaymentStatus"),"Due list load হয়নি: "+inv.error.message,true);return;}
 const rows=inv.data||[];
 $("customerDueInvoiceCount").textContent=rows.length;
 $("customerDueTotal").textContent=purMoney(rows.reduce((s,x)=>s+Number(x.due||0),0));
 $("customerDueInvoice").innerHTML='<option value="">বকেয়া Invoice নির্বাচন করুন</option>'+rows.map(x=>'<option value="'+x.id+'" data-due="'+Number(x.due)+'">'+safe(x.invoice_number)+' · '+safe(x.customers?.customer_name||"")+' · '+safe(x.customers?.mobile_number||"")+' · Due ৳ '+purMoney(x.due)+'</option>').join("");
 $("customerDueRows").innerHTML=rows.length?rows.map(x=>'<tr><td>'+safe(x.invoice_number)+'</td><td>'+new Date(x.sale_date).toLocaleString("en-BD")+'</td><td>'+safe(x.customers?.customer_name||"")+'</td><td>৳ '+purMoney(x.total)+'</td><td>৳ '+purMoney(x.paid)+'</td><td>৳ '+purMoney(x.due)+'</td></tr>').join(""):'<tr><td colspan="6">কোনো Customer Invoice Due নেই।</td></tr>';
 if(pay.error){$("customerPaymentRows").innerHTML='<tr><td colspan="6">Payment history load হয়নি: '+safe(pay.error.message)+'</td></tr>';return;}
 $("customerPaymentRows").innerHTML=pay.data?.length?pay.data.map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString("en-BD")+'</td><td>'+safe(x.customers?.customer_name||"")+'</td><td>'+safe(x.erp_sales_invoices?.invoice_number||"")+'</td><td>৳ '+purMoney(x.amount)+'</td><td>'+safe(x.payment_method)+'</td><td>'+safe(x.reference_number||"")+'</td></tr>').join(""):'<tr><td colspan="6">এখনো Customer Due Payment নেই।</td></tr>';
 $("customerSelectedDue").textContent="0.00";
}
$("customerDueInvoice").onchange=()=>{const o=$("customerDueInvoice").selectedOptions[0];$("customerSelectedDue").textContent=purMoney(o?.dataset.due||0);$("customerPaymentAmount").max=o?.dataset.due||"";};
$("recordCustomerPaymentBtn").onclick=async()=>{
 const invoice=value("customerDueInvoice"),amount=Number(value("customerPaymentAmount")),due=Number($("customerDueInvoice").selectedOptions[0]?.dataset.due||0);
 if(!activeUser||activeUser.id!==ADMIN_UID||!invoice||!Number.isFinite(amount)||amount<=0||amount>due){say($("customerPaymentStatus"),"বকেয়া Invoice নির্বাচন করুন এবং Due-এর বেশি নয় এমন Amount দিন।",true);return;}
 if(!confirm("৳ "+purMoney(amount)+" Customer Due Payment সংরক্ষণ করবেন?"))return;
 $("recordCustomerPaymentBtn").disabled=true;say($("customerPaymentStatus"),"Payment সংরক্ষণ হচ্ছে...");
 const {data,error}=await db.rpc("bmp_record_customer_payment",{p_invoice_id:invoice,p_amount:amount,p_payment_method:value("customerPaymentMethod"),p_reference:value("customerPaymentReference"),p_note:value("customerPaymentNote")});
 $("recordCustomerPaymentBtn").disabled=false;
 if(error){say($("customerPaymentStatus"),"Payment সংরক্ষণ হয়নি: "+error.message,true);return;}
 $("customerPaymentAmount").value="0";$("customerPaymentReference").value="";$("customerPaymentNote").value="";
 say($("customerPaymentStatus"),"Payment সফল: "+data.invoice_number+" · বাকি Due ৳ "+purMoney(data.due));
 await loadCustomerDue();
};
$("refreshCustomerDueBtn").onclick=loadCustomerDue;
$("customerDueTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","salesReturnModule","employeeModule"].forEach(id=>$(id).hidden=true);
 $("customerDueModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","salesReturnTab"].forEach(id=>$(id).classList.remove("active"));
 $("customerDueTab").classList.add("active");await loadCustomerDue();
};




let employees=[];
function resetEmployeeForm(){
 $("employeeForm").reset();$("employeeRecordId").value="";$("employeeCode").value="";
 $("employeeJoiningDate").value=today();$("employeeEmploymentStatus").value="active";
 $("employeeFormTitle").textContent="Add Employee";
}
function openEmployeeForm(row=null){
 resetEmployeeForm();$("employeeFormPanel").hidden=false;
 if(row){
  $("employeeFormTitle").textContent="Edit Employee";$("employeeRecordId").value=row.id;$("employeeCode").value=row.employee_code;
  const map={employeeName:"full_name",employeeMobile:"mobile_number",employeeAltPhone:"alternative_phone",employeeEmail:"email",employeeJobTitle:"job_title",employeeDepartment:"department",employeeAddress:"address",employeeEmergencyName:"emergency_contact_name",employeeEmergencyPhone:"emergency_contact_phone",employeeJoiningDate:"joining_date",employeeEmploymentStatus:"employment_status",employeeNotes:"notes"};
  Object.entries(map).forEach(([id,key])=>$(id).value=row[key]??"");
 }
 $("employeeFormPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadEmployees(){
 $("employeeRows").innerHTML='<tr><td colspan="8">তথ্য লোড হচ্ছে...</td></tr>';
 let q=db.from("erp_employees").select("*").order("created_at",{ascending:false});
 const status=value("employeeStatusFilter");
 if(status!=="all")q=q.eq("employment_status",status);
 const {data,error}=await q;
 if(error){$("employeeRows").innerHTML='<tr><td colspan="8">Employee list load হয়নি।</td></tr>';say($("employeeStatusText"),"Employee list load হয়নি: "+error.message,true);return;}
 employees=data||[];renderEmployees();
}
function renderEmployees(){
 const term=value("employeeSearch").toLowerCase();
 const rows=employees.filter(e=>[e.employee_code,e.full_name,e.mobile_number,e.job_title,e.department].some(v=>String(v||"").toLowerCase().includes(term)));
 if(!rows.length){$("employeeRows").innerHTML='<tr><td colspan="8">কোনো Employee পাওয়া যায়নি।</td></tr>';return;}
 $("employeeRows").innerHTML=rows.map(e=>'<tr><td><b>'+safe(e.employee_code)+'</b></td><td>'+safe(e.full_name)+'</td><td>'+safe(e.mobile_number)+'</td><td>'+safe(e.job_title)+'</td><td>'+safe(e.department||"—")+'</td><td>'+safe(e.joining_date)+'</td><td>'+safe(e.employment_status)+'</td><td><button class="btn muted" data-employee-edit="'+safe(e.id)+'" type="button">Edit</button></td></tr>').join("");
 $("employeeRows").querySelectorAll("[data-employee-edit]").forEach(b=>b.onclick=()=>openEmployeeForm(employees.find(e=>e.id===b.dataset.employeeEdit)));
}
$("employeeForm").onsubmit=async e=>{
 e.preventDefault();if(!activeUser||activeUser.id!==ADMIN_UID)return;
 const id=value("employeeRecordId"),name=value("employeeName"),mobile=value("employeeMobile"),job=value("employeeJobTitle");
 if(!name||!mobile||!job){say($("employeeStatusText"),"Name, Mobile ও Job Title আবশ্যক।",true);return;}
 const row={full_name:name,mobile_number:mobile,alternative_phone:value("employeeAltPhone")||null,email:value("employeeEmail")||null,job_title:job,department:value("employeeDepartment")||null,address:value("employeeAddress")||null,emergency_contact_name:value("employeeEmergencyName")||null,emergency_contact_phone:value("employeeEmergencyPhone")||null,joining_date:value("employeeJoiningDate"),employment_status:value("employeeEmploymentStatus"),notes:value("employeeNotes")||null};
 say($("employeeStatusText"),"Employee সংরক্ষণ হচ্ছে...");
 const result=id?await db.from("erp_employees").update(row).eq("id",id).select("id").single():await db.from("erp_employees").insert({...row,created_by:activeUser.id}).select("id,employee_code").single();
 if(result.error){say($("employeeStatusText"),"সংরক্ষণ হয়নি: "+result.error.message,true);return;}
 say($("employeeStatusText"),id?"Employee তথ্য আপডেট হয়েছে।":"Employee তৈরি হয়েছে। Employee ID: "+result.data.employee_code);
 $("employeeFormPanel").hidden=true;resetEmployeeForm();await loadEmployees();
};
$("newEmployeeBtn").onclick=()=>openEmployeeForm();
$("closeEmployeeForm").onclick=$("cancelEmployeeForm").onclick=()=>{$("employeeFormPanel").hidden=true;resetEmployeeForm();};
$("employeeSearch").oninput=renderEmployees;$("employeeStatusFilter").onchange=loadEmployees;
$("employeesTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule"].forEach(id=>$(id).hidden=true);
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;$("employeeModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab"].forEach(id=>$(id).classList.remove("active"));
 $("employeesTab").classList.add("active");await loadEmployees();
};

let purchaseReturnOptions=[];
async function loadPurchaseReturns(){
 const [items,returned,history]=await Promise.all([
  db.from("erp_purchase_invoice_items").select("id,purchase_id,medicine_id,batch_id,medicine_name,batch_number,quantity,purchase_price,erp_purchase_invoices(purchase_number,supplier_id,erp_suppliers(supplier_name)),erp_medicine_batches(quantity_available)").order("created_at",{ascending:false}).limit(500),
  db.from("erp_purchase_return_items").select("purchase_item_id,quantity"),
  db.from("erp_purchase_returns").select("return_number,created_at,return_total,reason,erp_purchase_invoices(purchase_number,erp_suppliers(supplier_name))").order("created_at",{ascending:false}).limit(50)
 ]);
 if(items.error){say($("purchaseReturnStatus"),"Purchase item load হয়নি: "+items.error.message,true);return;}
 if(returned.error){say($("purchaseReturnStatus"),"Return history যাচাই হয়নি: "+returned.error.message,true);return;}
 const used={};(returned.data||[]).forEach(x=>used[x.purchase_item_id]=(used[x.purchase_item_id]||0)+Number(x.quantity));
 purchaseReturnOptions=(items.data||[]).map(x=>({...x,remaining:Number(x.quantity)-(used[x.id]||0),available:Number(x.erp_medicine_batches?.quantity_available||0)})).filter(x=>x.remaining>0&&x.available>0);
 $("purchaseReturnItem").innerHTML='<option value="">Purchase item নির্বাচন করুন</option>'+purchaseReturnOptions.map(x=>'<option value="'+x.id+'">'+safe(x.erp_purchase_invoices?.purchase_number||"")+' · '+safe(x.medicine_name)+' · Batch '+safe(x.batch_number)+' · Qty '+x.remaining+' · Available '+x.available+'</option>').join("");
 $("purchaseReturnRows").innerHTML=history.error?'<tr><td colspan="6">History load হয়নি।</td></tr>':(history.data||[]).map(x=>'<tr><td>'+safe(x.return_number)+'</td><td>'+new Date(x.created_at).toLocaleString("en-BD")+'</td><td>'+safe(x.erp_purchase_invoices?.purchase_number||"")+'</td><td>'+safe(x.erp_purchase_invoices?.erp_suppliers?.supplier_name||"")+'</td><td>৳ '+purMoney(x.return_total)+'</td><td>'+safe(x.reason)+'</td></tr>').join("")||'<tr><td colspan="6">এখনো Purchase Return নেই।</td></tr>';
 updatePurchaseReturnPreview();
}
function updatePurchaseReturnPreview(){
 const item=purchaseReturnOptions.find(x=>x.id===value("purchaseReturnItem"));
 const qty=Math.max(0,Math.floor(Number(value("purchaseReturnQty"))||0));
 $("purchaseReturnMax").textContent=item?Math.min(item.remaining,item.available):0;
 $("purchaseReturnQty").max=item?Math.min(item.remaining,item.available):1;
 $("purchaseReturnValue").textContent=purMoney(item?qty*Number(item.purchase_price):0);
}
$("purchaseReturnItem").onchange=updatePurchaseReturnPreview;
$("purchaseReturnQty").oninput=updatePurchaseReturnPreview;
$("submitPurchaseReturnBtn").onclick=async()=>{
 const item=purchaseReturnOptions.find(x=>x.id===value("purchaseReturnItem"));
 const qty=Math.floor(Number(value("purchaseReturnQty"))||0),reason=value("purchaseReturnReason").trim();
 if(!activeUser||activeUser.id!==ADMIN_UID||!item||qty<1||qty>item.remaining||qty>item.available||!reason){say($("purchaseReturnStatus"),"Purchase item, Available Quantity ও Return Reason সঠিকভাবে দিন।",true);return;}
 if(!confirm("Supplier-কে Purchase Return করবেন? Qty: "+qty+" · Value ৳ "+purMoney(qty*Number(item.purchase_price))+" · Stock কমবে এবং বকেয়া সমন্বয় হবে।"))return;
 $("submitPurchaseReturnBtn").disabled=true;
 const {data,error}=await db.rpc("bmp_create_purchase_return",{p_purchase_item_id:item.id,p_quantity:qty,p_reason:reason});
 $("submitPurchaseReturnBtn").disabled=false;
 if(error){say($("purchaseReturnStatus"),"Return হয়নি: "+error.message,true);return;}
 say($("purchaseReturnStatus"),"Purchase Return সফল: "+data.return_number+" · ৳ "+purMoney(data.return_total)+" · নতুন Due ৳ "+purMoney(data.purchase_due));
 $("purchaseReturnQty").value="1";$("purchaseReturnReason").value="";
 await loadPurchaseReturns();
};
$("refreshPurchaseReturnBtn").onclick=loadPurchaseReturns;
$("purchaseReturnTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","employeeModule"].forEach(id=>$(id).hidden=true);
 $("purchaseReturnModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab"].forEach(id=>$(id).classList.remove("active"));
 $("purchaseReturnTab").classList.add("active");await loadPurchaseReturns();
};

let salesReturnOptions=[];
async function loadSalesReturns(){
 const [items,returned,history]=await Promise.all([
  db.from("erp_sales_invoice_items").select("id,invoice_id,medicine_name,batch_number,quantity,unit_price,erp_sales_invoices(invoice_number,customer_id,customers(customer_name))").order("created_at",{ascending:false}).limit(500),
  db.from("erp_sales_return_items").select("invoice_item_id,quantity"),
  db.from("erp_sales_returns").select("return_number,created_at,return_total,refund_amount,reason,erp_sales_invoices(invoice_number,customers(customer_name))").order("created_at",{ascending:false}).limit(50)
 ]);
 if(items.error){say($("salesReturnStatus"),"Invoice item load হয়নি: "+items.error.message,true);return;}
 if(returned.error){say($("salesReturnStatus"),"Return history যাচাই হয়নি: "+returned.error.message,true);return;}
 const used={};(returned.data||[]).forEach(x=>used[x.invoice_item_id]=(used[x.invoice_item_id]||0)+Number(x.quantity));
 salesReturnOptions=(items.data||[]).map(x=>({...x,remaining:Number(x.quantity)-(used[x.id]||0)})).filter(x=>x.remaining>0);
 $("salesReturnItem").innerHTML='<option value="">Invoice item নির্বাচন করুন</option>'+salesReturnOptions.map(x=>'<option value="'+x.id+'">'+safe(x.erp_sales_invoices?.invoice_number||"")+' · '+safe(x.medicine_name)+' · Batch '+safe(x.batch_number)+' · বাকি Qty '+x.remaining+' · ৳ '+purMoney(x.unit_price)+'</option>').join("");
 $("salesReturnRows").innerHTML=history.error?'<tr><td colspan="7">Return history load হয়নি।</td></tr>':(history.data||[]).map(x=>'<tr><td>'+safe(x.return_number)+'</td><td>'+new Date(x.created_at).toLocaleString("en-BD")+'</td><td>'+safe(x.erp_sales_invoices?.invoice_number||"")+'</td><td>'+safe(x.erp_sales_invoices?.customers?.customer_name||"")+'</td><td>৳ '+purMoney(x.return_total)+'</td><td>৳ '+purMoney(x.refund_amount)+'</td><td>'+safe(x.reason)+'</td></tr>').join("")||'<tr><td colspan="7">এখনো Sales Return নেই।</td></tr>';
}
function updateSalesReturnPreview(){
 const item=salesReturnOptions.find(x=>x.id===value("salesReturnItem"));
 const qty=Math.max(0,Math.floor(Number(value("salesReturnQty"))||0));
 $("salesReturnMax").textContent=item?item.remaining:0;
 $("salesReturnValue").textContent=purMoney(item?qty*Number(item.unit_price):0);
 $("salesReturnQty").max=item?item.remaining:1;
 $("salesReturnRefund").max=purMoney(item?qty*Number(item.unit_price):0);
}
$("salesReturnItem").onchange=updateSalesReturnPreview;
$("salesReturnQty").oninput=updateSalesReturnPreview;
$("submitSalesReturnBtn").onclick=async()=>{
 const item=salesReturnOptions.find(x=>x.id===value("salesReturnItem"));
 const qty=Math.floor(Number(value("salesReturnQty"))||0),condition=value("salesReturnCondition");
 const refund=Number(value("salesReturnRefund")),reason=value("salesReturnReason").trim();
 if(!activeUser||activeUser.id!==ADMIN_UID||!item||qty<1||qty>item.remaining||!reason||!Number.isFinite(refund)||refund<0||refund>qty*Number(item.unit_price)){
  say($("salesReturnStatus"),"Invoice item, সঠিক Quantity, Refund Amount ও Return Reason দিন।",true);return;
 }
 if(!confirm("Sales Return সংরক্ষণ করবেন? Quantity: "+qty+" · Condition: "+condition+" · Refund: ৳ "+purMoney(refund)))return;
 $("submitSalesReturnBtn").disabled=true;
 const {data,error}=await db.rpc("bmp_create_sales_return",{p_invoice_item_id:item.id,p_quantity:qty,p_condition:condition,p_refund_amount:refund,p_reason:reason});
 $("submitSalesReturnBtn").disabled=false;
 if(error){say($("salesReturnStatus"),"Return সংরক্ষণ হয়নি: "+error.message,true);return;}
 say($("salesReturnStatus"),"Return সফল: "+data.return_number+" · Return Value ৳ "+purMoney(data.return_total)+" · Invoice Due ৳ "+purMoney(data.invoice_due));
 $("salesReturnQty").value="1";$("salesReturnRefund").value="0";$("salesReturnReason").value="";
 await loadSalesReturns();updateSalesReturnPreview();
};
$("refreshSalesReturnBtn").onclick=loadSalesReturns;
$("salesReturnTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","employeeModule"].forEach(id=>$(id).hidden=true);
 $("salesReturnModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab"].forEach(id=>$(id).classList.remove("active"));
 $("salesReturnTab").classList.add("active");await loadSalesReturns();
};

if(!window.supabase||!window.BMP_SUPABASE_URL||!window.BMP_SUPABASE_ANON_KEY||window.BMP_SUPABASE_ANON_KEY.startsWith("PASTE_")){say($("loginStatus"),"Supabase config পাওয়া যায়নি।",true);return;}
db=window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);
db.auth.getSession().then(({data})=>{if(data.session)verifyUser(data.session.user);});

let attendanceCache=[];
function attendanceMonthBounds(){
 const m=value("attendanceMonth")||new Date().toISOString().slice(0,7);
 const [y,mo]=m.split("-").map(Number);
 return {start:m+"-01",end:new Date(y,mo,1).toISOString().slice(0,10)};
}
async function loadFingerprintSetting(){
 const {data,error}=await db.from("erp_attendance_settings").select("fingerprint_enabled").eq("id",true).maybeSingle();
 if(error){say($("fingerprintModeStatus"),"Fingerprint setting load হয়নি: "+error.message,true);return;}
 $("fingerprintEnabled").checked=!!data?.fingerprint_enabled;
 $("fingerprintModeStatus").textContent=data?.fingerprint_enabled?"Fingerprint System ON — মেশিন এখনো সংযুক্ত নয়; Manual Attendance চালু আছে।":"Fingerprint System OFF — Manual Attendance চালু আছে।";
}
$("saveFingerprintSettingBtn").onclick=async()=>{
 if(!activeUser||activeUser.id!==ADMIN_UID){say($("fingerprintModeStatus"),"শুধু Super Admin এই সেটিং পরিবর্তন করতে পারবেন।",true);return;}
 const enabled=$("fingerprintEnabled").checked;
 $("saveFingerprintSettingBtn").disabled=true;
 const {error}=await db.from("erp_attendance_settings").upsert({id:true,fingerprint_enabled:enabled,updated_by:activeUser.id},{onConflict:"id"});
 $("saveFingerprintSettingBtn").disabled=false;
 if(error){say($("fingerprintModeStatus"),"সেটিং সংরক্ষণ হয়নি: "+error.message,true);return;}
 $("fingerprintModeStatus").textContent=enabled?"Fingerprint System ON — মেশিন এখনো সংযুক্ত নয়; Manual Attendance চালু আছে।":"Fingerprint System OFF — Manual Attendance চালু আছে।";
};
async function loadAttendance(){
 if(!activeUser||activeUser.id!==ADMIN_UID)return;
 const [emps,month]=await Promise.all([
  db.from("erp_employees").select("id,employee_code,full_name").eq("employment_status","active").order("full_name"),
  Promise.resolve(attendanceMonthBounds())
 ]);
 if(emps.error){say($("attendanceStatusText"),"Employee load হয়নি: "+emps.error.message,true);return;}
 $("attendanceEmployee").innerHTML='<option value="">Employee নির্বাচন করুন</option>'+(emps.data||[]).map(e=>'<option value="'+e.id+'">'+safe(e.employee_code)+' · '+safe(e.full_name)+'</option>').join("");
 const {data,error}=await db.from("erp_attendance").select("id,employee_id,attendance_date,attendance_status,check_in,check_out,notes,erp_employees(employee_code,full_name)").gte("attendance_date",month.start).lt("attendance_date",month.end).order("attendance_date",{ascending:false}).limit(2000);
 if(error){say($("attendanceStatusText"),"Attendance load হয়নি: "+error.message,true);return;}
 attendanceCache=data||[];renderAttendance();
}
function renderAttendance(){
 const term=value("attendanceSearch").trim().toLowerCase(),filter=value("attendanceFilter");
 const rows=attendanceCache.filter(r=>(filter==="all"||r.attendance_status===filter)&&(!term||((r.erp_employees?.employee_code||"")+" "+(r.erp_employees?.full_name||"")).toLowerCase().includes(term)));
 const counts={present:0,absent:0,leave:0,holiday:0};
 attendanceCache.forEach(r=>counts[r.attendance_status]=(counts[r.attendance_status]||0)+1);
 $("attendancePresentCount").textContent=counts.present;$("attendanceAbsentCount").textContent=counts.absent;$("attendanceLeaveCount").textContent=counts.leave;$("attendanceHolidayCount").textContent=counts.holiday;
 $("attendanceRows").innerHTML=rows.map(r=>'<tr><td>'+safe(r.attendance_date)+'</td><td>'+safe(r.erp_employees?.employee_code||"")+'</td><td>'+safe(r.erp_employees?.full_name||"")+'</td><td>'+safe(r.attendance_status)+'</td><td>'+safe(r.check_in||"—")+'</td><td>'+safe(r.check_out||"—")+'</td><td>'+safe(r.notes||"")+'</td></tr>').join("")||'<tr><td colspan="7">এই মাসে কোনো Attendance পাওয়া যায়নি।</td></tr>';
}
function resetAttendanceForm(){
 $("attendanceEmployee").value="";$("attendanceStatus").value="present";$("attendanceCheckIn").value="";$("attendanceCheckOut").value="";$("attendanceNotes").value="";
}
$("saveAttendanceBtn").onclick=async()=>{
 if(!activeUser||activeUser.id!==ADMIN_UID){say($("attendanceStatusText"),"শুধু Super Admin Attendance সংরক্ষণ করতে পারবেন।",true);return;}
 const employee=value("attendanceEmployee"),date=value("attendanceDate"),status=value("attendanceStatus"),cin=value("attendanceCheckIn")||null,cout=value("attendanceCheckOut")||null,notes=value("attendanceNotes").trim()||null;
 if(!employee||!date){say($("attendanceStatusText"),"তারিখ ও Employee নির্বাচন করুন।",true);return;}
 if(cin&&cout&&cout<cin){say($("attendanceStatusText"),"Check-out সময় Check-in-এর আগে হতে পারবে না।",true);return;}
 const row={employee_id:employee,attendance_date:date,attendance_status:status,check_in:status==="present"?cin:null,check_out:status==="present"?cout:null,notes,created_by:activeUser.id};
 $("saveAttendanceBtn").disabled=true;
 const {error}=await db.from("erp_attendance").upsert(row,{onConflict:"employee_id,attendance_date"});
 $("saveAttendanceBtn").disabled=false;
 if(error){say($("attendanceStatusText"),"Attendance সংরক্ষণ হয়নি: "+error.message,true);return;}
 say($("attendanceStatusText"),"Attendance সংরক্ষণ হয়েছে। একই Employee ও Date হলে আগের রেকর্ড আপডেট হবে।");
 resetAttendanceForm();await loadAttendance();
};
$("resetAttendanceBtn").onclick=resetAttendanceForm;
$("refreshAttendanceBtn").onclick=loadAttendance;
$("attendanceSearch").oninput=renderAttendance;
$("attendanceFilter").onchange=renderAttendance;
$("attendanceMonth").onchange=loadAttendance;
$("attendanceTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule"].forEach(id=>$(id).hidden=true);
 $("attendanceModule").hidden=false;$("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab"].forEach(id=>$(id).classList.remove("active"));
 $("attendanceTab").classList.add("active");await loadAttendance();
};
const attendanceToday=new Date().toISOString().slice(0,10);
$("attendanceDate").value=attendanceToday;
const monthNow=attendanceToday.slice(0,7);
$("attendanceMonth").value=monthNow;

})();