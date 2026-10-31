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
 activeUser=user;$("loginPanel").hidden=true;$("workspace").hidden=false;$("logoutBtn").hidden=false;$("dashboardTab").click();
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


const permissionModules=[
 ["customers","Customers"],["medicines","Medicine Management"],["batches","Batch & Expiry"],["barcode","Barcode Management"],["pos","POS Sales & Billing"],["purchases","Purchase Management"],["stock","Stock Management"],["customer_due","Customer Due & Payment"],["sales_returns","Sales Return"],["purchase_returns","Purchase Return"],["employees","Employee Management"],["attendance","Attendance"]
];
const permissionActions=["view","create","update","delete","approve","print"];
async function loadPermissionEmployees(){
 const {data,error}=await db.from("erp_employees").select("id,employee_code,full_name").order("full_name");
 if(error){say($("permissionStatus"),"Employee list load হয়নি: "+error.message,true);return;}
 const selected=value("permissionEmployee");
 $("permissionEmployee").innerHTML='<option value="">Employee নির্বাচন করুন</option>'+(data||[]).map(e=>'<option value="'+e.id+'">'+safe(e.employee_code)+' · '+safe(e.full_name)+'</option>').join("");
 if(selected&&data.some(e=>e.id===selected))$("permissionEmployee").value=selected;
}
function renderPermissionRows(saved=[]){
 const map=new Map(saved.map(p=>[p.module_key,p]));
 $("permissionRows").innerHTML=permissionModules.map(([key,label])=>{
  const p=map.get(key)||{};
  return '<tr><td>'+safe(label)+'</td>'+permissionActions.map(action=>'<td><input type="checkbox" class="permission-check" data-module="'+key+'" data-action="'+action+'" '+(p["can_"+action]?'checked':'')+' aria-label="'+safe(label)+' '+action+'"></td>').join("")+'</tr>';
 }).join("");
}
async function loadEmployeePermissions(){
 const employee=value("permissionEmployee");
 if(!employee){$("permissionRows").innerHTML='<tr><td colspan="7">প্রথমে Employee নির্বাচন করুন।</td></tr>';return;}
 const {data,error}=await db.from("erp_employee_permissions").select("*").eq("employee_id",employee);
 if(error){say($("permissionStatus"),"Permission load হয়নি: "+error.message,true);return;}
 renderPermissionRows(data||[]);say($("permissionStatus"),"Saved permission লোড হয়েছে।");
}
$("permissionEmployee").onchange=loadEmployeePermissions;
$("refreshPermissionsBtn").onclick=async()=>{await loadPermissionEmployees();await loadEmployeePermissions();};
$("savePermissionsBtn").onclick=async()=>{
 if(!activeUser||activeUser.id!==ADMIN_UID){say($("permissionStatus"),"শুধু Super Admin অনুমতি পরিবর্তন করতে পারবেন।",true);return;}
 const employee=value("permissionEmployee");if(!employee){say($("permissionStatus"),"একজন Employee নির্বাচন করুন।",true);return;}
 const rows=permissionModules.map(([module_key])=>{
  const row={employee_id:employee,module_key,updated_by:activeUser.id};
  permissionActions.forEach(action=>{const el=document.querySelector('.permission-check[data-module="'+module_key+'"][data-action="'+action+'"]');row["can_"+action]=!!el?.checked;});
  return row;
 });
 $("savePermissionsBtn").disabled=true;
 const {error}=await db.from("erp_employee_permissions").upsert(rows,{onConflict:"employee_id,module_key"});
 $("savePermissionsBtn").disabled=false;
 if(error){say($("permissionStatus"),"Permission সংরক্ষণ হয়নি: "+error.message,true);return;}
 say($("permissionStatus"),"এই Employee-এর সব Module Permission সংরক্ষণ হয়েছে।");
};
$("permissionsTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;$("permissionsModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab"].forEach(id=>$(id).classList.remove("active"));
 $("permissionsTab").classList.add("active");await loadPermissionEmployees();await loadEmployeePermissions();
};


["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab"].forEach(id=>{const tab=$(id);if(tab)tab.addEventListener("click",()=>{$("permissionsModule").hidden=true;});});


let payrollCache=[];
const payrollMoney=n=>"৳ "+money(n);
function payrollNet(){
 const total=["payrollBasic","payrollAllowances","payrollBonus"].reduce((s,id)=>s+Number(value(id)||0),0)-Number(value("payrollDeductions")||0);
 $("payrollNetPreview").textContent=payrollMoney(Math.max(0,total));
}
async function loadPayrollEmployees(){
 const {data,error}=await db.from("erp_employees").select("id,employee_code,full_name").order("full_name");
 if(error){say($("payrollStatus"),"Employee load হয়নি: "+error.message,true);return;}
 $("payrollEmployee").innerHTML='<option value="">Employee নির্বাচন করুন</option>'+(data||[]).map(e=>'<option value="'+e.id+'">'+safe(e.employee_code)+' · '+safe(e.full_name)+'</option>').join("");
}
async function loadPayroll(){
 const month=value("payrollFilterMonth");
 let q=db.from("erp_employee_payroll").select("*,erp_employees(employee_code,full_name)").order("payroll_month",{ascending:false}).limit(500);
 if(month)q=q.eq("payroll_month",month+"-01");
 const {data,error}=await q;
 if(error){say($("payrollStatus"),"Payroll load হয়নি: "+error.message,true);return;}
 payrollCache=data||[];renderPayroll();
}
function renderPayroll(){
 const term=value("payrollSearch").toLowerCase();
 const rows=payrollCache.filter(p=>(p.erp_employees?.full_name||"").toLowerCase().includes(term)||(p.erp_employees?.employee_code||"").toLowerCase().includes(term));
 $("payrollRows").innerHTML=rows.length?rows.map(p=>'<tr><td>'+safe(String(p.payroll_month).slice(0,7))+'</td><td>'+safe(p.erp_employees?.employee_code||"")+'</td><td>'+safe(p.erp_employees?.full_name||"")+'</td><td>'+money(p.basic_salary)+'</td><td>'+money(p.allowances)+'</td><td>'+money(p.bonus)+'</td><td>'+money(p.deductions)+'</td><td>'+money(p.net_salary)+'</td><td>'+safe(p.payment_status)+'</td><td>'+safe(p.paid_date||"—")+'</td></tr>').join(""):'<tr><td colspan="10">কোনো Payroll পাওয়া যায়নি।</td></tr>';
 const sum=key=>rows.reduce((s,p)=>s+Number(p[key]||0),0);
 $("payrollTotalNet").textContent=payrollMoney(sum("net_salary"));
 $("payrollPaidTotal").textContent=payrollMoney(rows.filter(p=>p.payment_status==="paid").reduce((s,p)=>s+Number(p.net_salary),0));
 $("payrollPendingTotal").textContent=payrollMoney(rows.filter(p=>p.payment_status==="pending").reduce((s,p)=>s+Number(p.net_salary),0));
}
["payrollBasic","payrollAllowances","payrollBonus","payrollDeductions"].forEach(id=>$(id).addEventListener("input",payrollNet));
$("payrollPaymentStatus").onchange=()=>{if(value("payrollPaymentStatus")==="paid"&&!value("payrollPaidDate"))$("payrollPaidDate").value=today();if(value("payrollPaymentStatus")==="pending")$("payrollPaidDate").value="";};
$("payrollForm").onsubmit=async e=>{
 e.preventDefault();
 if(!activeUser||activeUser.id!==ADMIN_UID){say($("payrollStatus"),"শুধু Super Admin Payroll সংরক্ষণ করতে পারবেন।",true);return;}
 const employee=value("payrollEmployee"),month=value("payrollMonth"),basic=Number(value("payrollBasic")),allow=Number(value("payrollAllowances")||0),bonus=Number(value("payrollBonus")||0),deduct=Number(value("payrollDeductions")||0),status=value("payrollPaymentStatus"),paidDate=value("payrollPaidDate")||null;
 if(!employee||!month){say($("payrollStatus"),"Employee ও Payroll Month নির্বাচন করুন।",true);return;}
 if([basic,allow,bonus,deduct].some(n=>!Number.isFinite(n)||n<0)||deduct>basic+allow+bonus){say($("payrollStatus"),"বেতনের অঙ্ক সঠিক দিন; Deduction মোট আয়ের বেশি হতে পারবে না।",true);return;}
 if(status==="paid"&&!paidDate){say($("payrollStatus"),"Paid হলে Paid Date দিতে হবে।",true);return;}
 if(status==="pending"&&paidDate){say($("payrollStatus"),"Pending Payroll-এর Paid Date খালি রাখুন।",true);return;}
 const row={employee_id:employee,payroll_month:month+"-01",basic_salary:basic,allowances:allow,bonus,deductions:deduct,payment_status:status,paid_date:paidDate,payment_method:value("payrollPaymentMethod")||null,notes:value("payrollNotes")||null,created_by:activeUser.id};
 $("savePayrollBtn").disabled=true;
 const {error}=await db.from("erp_employee_payroll").upsert(row,{onConflict:"employee_id,payroll_month"});
 $("savePayrollBtn").disabled=false;
 if(error){say($("payrollStatus"),"Payroll সংরক্ষণ হয়নি: "+error.message,true);return;}
 say($("payrollStatus"),"Payroll সংরক্ষণ হয়েছে। একই Employee ও Month থাকলে আগের রেকর্ড আপডেট হয়েছে।");
 $("payrollForm").reset();$("payrollMonth").value=new Date().toISOString().slice(0,7);$("payrollPaymentStatus").value="pending";payrollNet();await loadPayroll();
};
$("resetPayrollBtn").onclick=()=>{$("payrollForm").reset();$("payrollMonth").value=new Date().toISOString().slice(0,7);$("payrollNetPreview").textContent="৳ 0.00";};
$("refreshPayrollBtn").onclick=loadPayroll;$("payrollSearch").oninput=renderPayroll;$("payrollFilterMonth").onchange=loadPayroll;
$("payrollTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;$("permissionsModule").hidden=true;$("payrollModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","permissionsTab"].forEach(id=>$(id).classList.remove("active"));
 $("payrollTab").classList.add("active");await loadPayrollEmployees();await loadPayroll();
};
["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","permissionsTab"].forEach(id=>{const tab=$(id);if(tab)tab.addEventListener("click",()=>{$("payrollModule").hidden=true;});});
$("payrollMonth").value=new Date().toISOString().slice(0,7);
$("payrollFilterMonth").value=new Date().toISOString().slice(0,7);


let accountCache=[],accountTransactionCache=[];
function renderAccounts(){
 const byId=new Map(accountCache.map(a=>[a.id,{name:a.account_name,type:a.account_type,opening:Number(a.opening_balance),income:0,expense:0}]));
 accountTransactionCache.forEach(t=>{const a=byId.get(t.account_id);if(a)a[t.transaction_type]+=Number(t.amount);});
 const vals=[...byId.values()],sum=k=>vals.reduce((s,a)=>s+a[k],0);
 $("accountsOpeningTotal").textContent=payrollMoney(sum("opening"));
 $("accountsIncomeTotal").textContent=payrollMoney(sum("income"));
 $("accountsExpenseTotal").textContent=payrollMoney(sum("expense"));
 $("accountsCurrentTotal").textContent=payrollMoney(sum("opening")+sum("income")-sum("expense"));
 $("accountBalanceRows").innerHTML=vals.length?vals.map(a=>'<tr><td>'+safe(a.name)+'</td><td>'+safe(a.type)+'</td><td>'+money(a.opening)+'</td><td>'+money(a.income)+'</td><td>'+money(a.expense)+'</td><td>'+money(a.opening+a.income-a.expense)+'</td></tr>').join(""):'<tr><td colspan="6">কোনো Account নেই।</td></tr>';
 const term=value("accountTransactionSearch").toLowerCase();
 const rows=accountTransactionCache.filter(t=>[t.category,t.reference_number,t.description,t.erp_accounts?.account_name].some(v=>String(v||"").toLowerCase().includes(term)));
 $("accountTransactionRows").innerHTML=rows.length?rows.map(t=>'<tr><td>'+safe(t.erp_accounts?.account_name||"")+'</td><td>'+safe(t.transaction_date)+'</td><td>'+safe(t.transaction_type)+'</td><td>'+safe(t.category)+'</td><td>'+money(t.amount)+'</td><td>'+safe(t.reference_number||"—")+'</td><td>'+safe(t.description||"")+'</td></tr>').join(""):'<tr><td colspan="7">কোনো Transaction পাওয়া যায়নি।</td></tr>';
}
async function loadAccounts(){
 const [a,t]=await Promise.all([
  db.from("erp_accounts").select("*").eq("is_active",true).order("account_name"),
  (value("accountTransactionMonth")?db.from("erp_account_transactions").select("*,erp_accounts(account_name)").gte("transaction_date",value("accountTransactionMonth")+"-01").lt("transaction_date",new Date(new Date(value("accountTransactionMonth")+"-01").getFullYear(),new Date(value("accountTransactionMonth")+"-01").getMonth()+1,1).toISOString().slice(0,10)):db.from("erp_account_transactions").select("*,erp_accounts(account_name)")).order("transaction_date",{ascending:false}).limit(500)
 ]);
 if(a.error){say($("accountStatus"),"Account load হয়নি: "+a.error.message,true);return;}
 if(t.error){say($("accountStatus"),"Transaction load হয়নি: "+t.error.message,true);return;}
 accountCache=a.data||[];accountTransactionCache=t.data||[];
 $("transactionAccount").innerHTML='<option value="">Account নির্বাচন করুন</option>'+accountCache.map(x=>'<option value="'+x.id+'">'+safe(x.account_name)+'</option>').join("");
 renderAccounts();
}
$("accountForm").onsubmit=async e=>{
 e.preventDefault();if(!activeUser||activeUser.id!==ADMIN_UID){say($("accountStatus"),"শুধু Super Admin Account তৈরি করতে পারবেন।",true);return;}
 const name=value("accountName"),opening=Number(value("accountOpening"));
 if(!name||!Number.isFinite(opening)||opening<0){say($("accountStatus"),"Account তথ্য সঠিকভাবে দিন।",true);return;}
 $("saveAccountBtn").disabled=true;
 const {error}=await db.from("erp_accounts").insert({account_name:name,account_type:value("accountType"),opening_balance:opening,notes:value("accountNotes")||null,created_by:activeUser.id});
 $("saveAccountBtn").disabled=false;
 if(error){say($("accountStatus"),"Account তৈরি হয়নি: "+error.message,true);return;}
 $("accountForm").reset();$("accountOpening").value="0";say($("accountStatus"),"Account তৈরি হয়েছে।");await loadAccounts();
};
$("accountTransactionForm").onsubmit=async e=>{
 e.preventDefault();if(!activeUser||activeUser.id!==ADMIN_UID){say($("accountStatus"),"শুধু Super Admin Transaction যোগ করতে পারবেন।",true);return;}
 const amount=Number(value("transactionAmount"));
 if(!value("transactionAccount")||!value("transactionDate")||!value("transactionCategory")||!Number.isFinite(amount)||amount<=0){say($("accountStatus"),"Transaction-এর সব তথ্য সঠিকভাবে দিন।",true);return;}
 $("saveTransactionBtn").disabled=true;
 const {error}=await db.from("erp_account_transactions").insert({account_id:value("transactionAccount"),transaction_date:value("transactionDate"),transaction_type:value("transactionType"),category:value("transactionCategory"),amount,reference_number:value("transactionReference")||null,description:value("transactionDescription")||null,created_by:activeUser.id});
 $("saveTransactionBtn").disabled=false;
 if(error){say($("accountStatus"),"Transaction সংরক্ষণ হয়নি: "+error.message,true);return;}
 $("accountTransactionForm").reset();$("transactionDate").value=today();say($("accountStatus"),"Income / Expense Transaction সংরক্ষণ হয়েছে।");await loadAccounts();
};
$("refreshAccountsBtn").onclick=loadAccounts;
$("accountTransactionSearch").oninput=renderAccounts;
$("accountTransactionMonth").onchange=loadAccounts;
$("accountsTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;$("permissionsModule").hidden=true;$("payrollModule").hidden=true;$("accountsModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","permissionsTab","payrollTab"].forEach(id=>$(id).classList.remove("active"));
 $("accountsTab").classList.add("active");$("transactionDate").value=today();$("accountTransactionMonth").value=new Date().toISOString().slice(0,7);await loadAccounts();
};
["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","permissionsTab","payrollTab"].forEach(id=>{const tab=$(id);if(tab)tab.addEventListener("click",()=>{$("accountsModule").hidden=true;});});
$("transactionDate").value=today();
$("accountTransactionMonth").value=new Date().toISOString().slice(0,7);


let dueOverviewRows=[];
function renderDueOverview(){
 const term=value("dueOverviewSearch").toLowerCase(),type=value("dueOverviewType");
 const rows=dueOverviewRows.filter(r=>(type==="all"||r.type===type)&&[r.invoice,r.party,r.type].some(v=>String(v||"").toLowerCase().includes(term)));
 $("dueOverviewRows").innerHTML=rows.length?rows.map(r=>'<tr><td>'+safe(r.type==="customer"?"Customer Receivable":"Supplier Payable")+'</td><td>'+safe(r.invoice)+'</td><td>'+safe(r.date)+'</td><td>'+safe(r.party)+'</td><td>'+money(r.total)+'</td><td>'+money(r.paid)+'</td><td>'+money(r.due)+'</td></tr>').join(""):'<tr><td colspan="7">এই Filter-এ কোনো Due পাওয়া যায়নি।</td></tr>';
}
async function loadDueOverview(){
 $("dueOverviewRows").innerHTML='<tr><td colspan="7">Due তথ্য লোড হচ্ছে...</td></tr>';
 const [c,s]=await Promise.all([
  db.from("erp_sales_invoices").select("invoice_number,sale_date,total,paid,due,customers(customer_name)").gt("due",0).order("sale_date",{ascending:false}).limit(1000),
  db.from("erp_purchase_invoices").select("purchase_number,purchase_date,total,paid,due,erp_suppliers(supplier_name)").gt("due",0).order("purchase_date",{ascending:false}).limit(1000)
 ]);
 if(c.error||s.error){say($("dueOverviewStatus"),"Due তথ্য লোড হয়নি: "+(c.error?.message||s.error?.message),true);return;}
 const customer=(c.data||[]).map(x=>({type:"customer",invoice:x.invoice_number,date:x.sale_date,party:x.customers?.customer_name||"Walk-in",total:Number(x.total),paid:Number(x.paid),due:Number(x.due)}));
 const supplier=(s.data||[]).map(x=>({type:"supplier",invoice:x.purchase_number,date:x.purchase_date,party:x.erp_suppliers?.supplier_name||"",total:Number(x.total),paid:Number(x.paid),due:Number(x.due)}));
 dueOverviewRows=[...customer,...supplier].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const cDue=customer.reduce((a,x)=>a+x.due,0),sDue=supplier.reduce((a,x)=>a+x.due,0);
 $("overviewCustomerDue").textContent=payrollMoney(cDue);$("overviewSupplierDue").textContent=payrollMoney(sDue);
 $("overviewNetDue").textContent=payrollMoney(cDue-sDue);$("overviewDueCount").textContent=dueOverviewRows.length;
 renderDueOverview();say($("dueOverviewStatus"),"Customer ও Supplier-এর outstanding invoice একসাথে দেখানো হয়েছে। Customer payment নিতে Customer Due & Payment এবং Supplier payment দিতে Purchase Management ব্যবহার করুন।");
}
$("refreshDueOverviewBtn").onclick=loadDueOverview;
$("dueOverviewSearch").oninput=renderDueOverview;$("dueOverviewType").onchange=renderDueOverview;
$("dueOverviewTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;
 ["permissionsModule","payrollModule","accountsModule"].forEach(id=>$(id).hidden=true);
 $("dueOverviewModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","permissionsTab","payrollTab","accountsTab"].forEach(id=>$(id).classList.remove("active"));
 $("dueOverviewTab").classList.add("active");await loadDueOverview();
};
["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","permissionsTab","payrollTab","accountsTab"].forEach(id=>{const tab=$(id);if(tab)tab.addEventListener("click",()=>{$("dueOverviewModule").hidden=true;});});


async function loadProfitLoss(){
 const month=value("profitLossMonth");if(!month){say($("profitLossStatus"),"Report Month নির্বাচন করুন।",true);return;}
 const start=month+"-01",end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1).toISOString().slice(0,10);
 $("profitLossRows").innerHTML='<tr><td colspan="2">হিসাব করা হচ্ছে...</td></tr>';
 const [sales,returns,expenses,payroll]=await Promise.all([
  db.from("erp_sales_invoices").select("id,total").gte("sale_date",start).lt("sale_date",end+"T00:00:00").neq("status","cancelled").limit(5000),
  db.from("erp_sales_returns").select("return_total").gte("created_at",start+"T00:00:00").lt("created_at",end+"T00:00:00").limit(5000),
  db.from("erp_account_transactions").select("amount").eq("transaction_type","expense").gte("transaction_date",start).lt("transaction_date",end).limit(5000),
  db.from("erp_employee_payroll").select("net_salary").eq("payment_status","paid").gte("paid_date",start).lt("paid_date",end).limit(5000)
 ]);
 const err=[sales,returns,expenses,payroll].find(x=>x.error);
 if(err){say($("profitLossStatus"),"Report load হয়নি: "+err.error.message,true);return;}
 const ids=(sales.data||[]).map(x=>x.id);let cogs=0;
 if(ids.length){
  const lines=await db.from("erp_sales_invoice_items").select("quantity,purchase_price").in("invoice_id",ids).limit(20000);
  if(lines.error){say($("profitLossStatus"),"COGS হিসাব হয়নি: "+lines.error.message,true);return;}
  cogs=(lines.data||[]).reduce((sum,x)=>sum+Number(x.quantity||0)*Number(x.purchase_price||0),0);
 }
 const grossSales=(sales.data||[]).reduce((s,x)=>s+Number(x.total||0),0);
 const returnTotal=(returns.data||[]).reduce((s,x)=>s+Number(x.return_total||0),0);
 const netSales=grossSales-returnTotal,expenseTotal=(expenses.data||[]).reduce((s,x)=>s+Number(x.amount||0),0);
 const payrollTotal=(payroll.data||[]).reduce((s,x)=>s+Number(x.net_salary||0),0);
 const grossProfit=netSales-cogs,netProfit=grossProfit-expenseTotal-payrollTotal;
 const fmt=n=>payrollMoney(n);
 $("plNetSales").textContent=fmt(netSales);$("plCogs").textContent=fmt(cogs);$("plGrossProfit").textContent=fmt(grossProfit);
 $("plExpenses").textContent=fmt(expenseTotal);$("plPayroll").textContent=fmt(payrollTotal);$("plNetProfit").textContent=fmt(netProfit);
 const rows=[["Gross Sales",grossSales],["Sales Returns",returnTotal],["Net Sales",netSales],["Cost of Goods Sold",cogs],["Gross Profit",grossProfit],["Operating Expenses (Accounts)",expenseTotal],["Paid Payroll",payrollTotal],["Estimated Net Profit",netProfit]];
 $("profitLossRows").innerHTML=rows.map(x=>'<tr><td>'+safe(x[0])+'</td><td>'+fmt(x[1])+'</td></tr>').join("");
 say($("profitLossStatus"),"Report তৈরি হয়েছে: "+month+". "+(ids.length>=5000?"সতর্কতা: Sales record limit-এ পৌঁছেছে। ":"")+"COGS-এর জন্য invoice item-এ সংরক্ষিত purchase price ব্যবহার হয়েছে।");
}
$("refreshProfitLossBtn").onclick=loadProfitLoss;$("profitLossMonth").onchange=loadProfitLoss;
$("profitLossTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule","dueOverviewModule","accountsModule","payrollModule","permissionsModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;$("profitLossModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","dueOverviewTab","accountsTab","payrollTab","permissionsTab"].forEach(id=>{const el=$(id);if(el)el.classList.remove("active");});
 $("profitLossTab").classList.add("active");await loadProfitLoss();
};
["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","dueOverviewTab","accountsTab","payrollTab","permissionsTab"].forEach(id=>{const el=$(id);if(el)el.addEventListener("click",()=>{$("profitLossModule").hidden=true;});});
$("profitLossMonth").value=new Date().toISOString().slice(0,7);


async function loadFinancialReports(){
 const month=value("financialReportMonth");if(!month){say($("financialReportStatus"),"Report Month নির্বাচন করুন।",true);return;}
 const start=month+"-01",end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1).toISOString().slice(0,10),tsEnd=end+"T00:00:00";
 $("financialReportRows").innerHTML='<tr><td colspan="3">Report তৈরি হচ্ছে...</td></tr>';
 const requests=[
  db.from("erp_sales_invoices").select("id,total,paid,due").gte("sale_date",start+"T00:00:00").lt("sale_date",tsEnd).neq("status","cancelled").limit(5000),
  db.from("erp_purchase_invoices").select("total,paid,due").gte("purchase_date",start+"T00:00:00").lt("purchase_date",tsEnd).neq("status","cancelled").limit(5000),
  db.from("erp_customer_payments").select("amount").gte("created_at",start+"T00:00:00").lt("created_at",tsEnd).limit(5000),
  db.from("erp_supplier_payments").select("amount").gte("created_at",start+"T00:00:00").lt("created_at",tsEnd).limit(5000),
  db.from("erp_sales_returns").select("return_total,refund_amount").gte("created_at",start+"T00:00:00").lt("created_at",tsEnd).limit(5000),
  db.from("erp_purchase_returns").select("return_total").gte("created_at",start+"T00:00:00").lt("created_at",tsEnd).limit(5000),
  db.from("erp_account_transactions").select("transaction_type,amount").gte("transaction_date",start).lt("transaction_date",end).limit(5000)
 ];
 const results=await Promise.all(requests),bad=results.find(x=>x.error);
 if(bad){say($("financialReportStatus"),"Report load হয়নি: "+bad.error.message,true);return;}
 const sum=(arr,key="amount")=>(arr||[]).reduce((n,x)=>n+Number(x[key]||0),0);
 const [sales,purchases,collections,supplierPays,salesReturns,purchaseReturns,ledger]=results.map(x=>x.data||[]);
 const values={
  sales:sum(sales,"total"),purchase:sum(purchases,"total"),collections:sum(collections),
  supplierPayments:sum(supplierPays),salesReturns:sum(salesReturns,"return_total"),
  purchaseReturns:sum(purchaseReturns,"return_total"),
  income:sum(ledger.filter(x=>x.transaction_type==="income")),
  expense:sum(ledger.filter(x=>x.transaction_type==="expense"))
 };
 const fmt=payrollMoney;
 $("frSales").textContent=fmt(values.sales);$("frPurchase").textContent=fmt(values.purchase);
 $("frCollections").textContent=fmt(values.collections);$("frSupplierPayments").textContent=fmt(values.supplierPayments);
 $("frSalesReturns").textContent=fmt(values.salesReturns);$("frPurchaseReturns").textContent=fmt(values.purchaseReturns);
 $("frIncome").textContent=fmt(values.income);$("frExpense").textContent=fmt(values.expense);
 const rows=[
 ["Sales Invoices",sales.length,values.sales],["Purchase Invoices",purchases.length,values.purchase],
 ["Customer Due Collections",collections.length,values.collections],["Supplier Due Payments",supplierPays.length,values.supplierPayments],
 ["Sales Returns",salesReturns.length,values.salesReturns],["Purchase Returns",purchaseReturns.length,values.purchaseReturns],
 ["Cashbook Income",ledger.filter(x=>x.transaction_type==="income").length,values.income],
 ["Cashbook Expense",ledger.filter(x=>x.transaction_type==="expense").length,values.expense]
 ];
 $("financialReportRows").innerHTML=rows.map(r=>'<tr><td>'+safe(r[0])+'</td><td>'+r[1]+'</td><td>'+fmt(r[2])+'</td></tr>').join("");
 say($("financialReportStatus"),"Financial Activity Report তৈরি হয়েছে: "+month+". "+(results.some(x=>(x.data||[]).length>=5000)?"কোনো তালিকা ৫,০০০ রেকর্ড সীমায় পৌঁছেছে।":""));
}
$("refreshFinancialReportsBtn").onclick=loadFinancialReports;$("financialReportMonth").onchange=loadFinancialReports;
$("financialReportsTab").onclick=async()=>{
 ["medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule","dueOverviewModule","accountsModule","payrollModule","permissionsModule","profitLossModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("customerModulePanel").hidden=true;$("customerFormPanel").hidden=true;$("financialReportsModule").hidden=false;
 ["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","dueOverviewTab","accountsTab","payrollTab","permissionsTab","profitLossTab"].forEach(id=>{const el=$(id);if(el)el.classList.remove("active");});
 $("financialReportsTab").classList.add("active");await loadFinancialReports();
};
["customersTab","medicinesTab","batchesTab","barcodeTab","posTab","purchaseTab","stockTab","customerDueTab","salesReturnTab","purchaseReturnTab","employeesTab","attendanceTab","dueOverviewTab","accountsTab","payrollTab","permissionsTab","profitLossTab"].forEach(id=>{const el=$(id);if(el)el.addEventListener("click",()=>{$("financialReportsModule").hidden=true;});});
$("financialReportMonth").value=new Date().toISOString().slice(0,7);


async function loadStockReports(){
 const status=$("stockReportStatus"),body=$("stockReportRows");say(status,"Stock Report তৈরি হচ্ছে...");body.innerHTML='<tr><td colspan="10">তথ্য লোড হচ্ছে...</td></tr>';
 const [med,batch]=await Promise.all([
  db.from("erp_medicines").select("id,medicine_name,generic_name,barcode,is_active").eq("is_active",true).order("medicine_name").limit(10000),
  db.from("erp_medicine_batches").select("id,medicine_id,batch_number,expiry_date,quantity_available,purchase_price,mrp,is_active,erp_medicines(medicine_name,barcode)").eq("is_active",true).order("expiry_date").limit(20000)
 ]);
 if(med.error||batch.error){say(status,"Stock Report load হয়নি: "+(med.error||batch.error).message,true);body.innerHTML='<tr><td colspan="10">তথ্য পাওয়া যায়নি।</td></tr>';return;}
 const medicines=med.data||[],batches=batch.data||[],now=today(),soonD=new Date();soonD.setDate(soonD.getDate()+90);const soon=soonD.getFullYear()+"-"+String(soonD.getMonth()+1).padStart(2,"0")+"-"+String(soonD.getDate()).padStart(2,"0");
 const qtyByMedicine=new Map();batches.forEach(b=>{if(b.expiry_date>=now&&Number(b.quantity_available)>0)qtyByMedicine.set(b.medicine_id,(qtyByMedicine.get(b.medicine_id)||0)+Number(b.quantity_available));});
 const valid=batches.filter(b=>b.expiry_date>=now&&Number(b.quantity_available)>0),expired=batches.filter(b=>b.expiry_date<now&&Number(b.quantity_available)>0),expiring=batches.filter(b=>b.expiry_date>=now&&b.expiry_date<=soon&&Number(b.quantity_available)>0);
 const lowMedicines=medicines.filter(m=>{const q=qtyByMedicine.get(m.id)||0;return q>0&&q<=10;}),zeroMedicines=medicines.filter(m=>(qtyByMedicine.get(m.id)||0)===0);
 $("srUnits").textContent=valid.reduce((s,b)=>s+Number(b.quantity_available),0).toLocaleString("en-BD");
 $("srCost").textContent=payrollMoney(valid.reduce((s,b)=>s+Number(b.quantity_available)*Number(b.purchase_price||0),0));
 $("srMrp").textContent=payrollMoney(valid.reduce((s,b)=>s+Number(b.quantity_available)*Number(b.mrp||0),0));
 $("srLow").textContent=lowMedicines.length;$("srZero").textContent=zeroMedicines.length;$("srExpired").textContent=expired.length;$("srSoon").textContent=expiring.length;
 window.stockReportData={medicines,batches,qtyByMedicine,lowIds:new Set(lowMedicines.map(x=>x.id)),zeroIds:new Set(zeroMedicines.map(x=>x.id)),now,soon};renderStockReports();
 say(status,"Stock Report আপডেট হয়েছে। "+(batches.length>=20000||medicines.length>=10000?"সতর্কতা: তালিকা রেকর্ড সীমায় পৌঁছেছে।":""));
}
function renderStockReports(){
 const d=window.stockReportData;if(!d)return;const term=value("stockReportSearch").trim().toLowerCase(),filter=value("stockReportFilter");
 let rows=d.batches.map(b=>({medicine:b.erp_medicines?.medicine_name||"",barcode:b.erp_medicines?.barcode||"",batch:b.batch_number||"",expiry:b.expiry_date||"",qty:Number(b.quantity_available||0),purchase:Number(b.purchase_price||0),mrp:Number(b.mrp||0),medicineId:b.medicine_id}));
 if(filter==="low")rows=rows.filter(x=>d.lowIds.has(x.medicineId));
 if(filter==="zero")rows=d.medicines.filter(m=>d.zeroIds.has(m.id)).map(m=>({medicine:m.medicine_name,barcode:m.barcode||"",batch:"—",expiry:"—",qty:0,purchase:0,mrp:0,medicineId:m.id}));
 if(filter==="expired")rows=rows.filter(x=>x.expiry<d.now&&x.qty>0);
 if(filter==="soon")rows=rows.filter(x=>x.expiry>=d.now&&x.expiry<=d.soon&&x.qty>0);
 if(term)rows=rows.filter(x=>(x.medicine+" "+x.barcode+" "+x.batch).toLowerCase().includes(term));
 rows.sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry))||a.medicine.localeCompare(b.medicine));
 $("stockReportRows").innerHTML=rows.length?rows.slice(0,1000).map(x=>{const expired=x.expiry!=="—"&&x.expiry<d.now,soon=x.expiry!=="—"&&x.expiry>=d.now&&x.expiry<=d.soon;const status=x.qty<=0?"Zero Stock":expired?"Expired":soon?"Expiring Soon":d.lowIds.has(x.medicineId)?"Low Stock":"Available";return '<tr><td>'+safe(x.medicine)+'</td><td>'+safe(x.barcode)+'</td><td>'+safe(x.batch)+'</td><td>'+safe(x.expiry)+'</td><td>'+x.qty+'</td><td>'+payrollMoney(x.purchase)+'</td><td>'+payrollMoney(x.mrp)+'</td><td>'+payrollMoney(expired?0:x.qty*x.purchase)+'</td><td>'+payrollMoney(expired?0:x.qty*x.mrp)+'</td><td>'+safe(status)+'</td></tr>';}).join(""):'<tr><td colspan="10">এই Filter-এ কোনো Stock record নেই।</td></tr>';
 if(rows.length>1000)say($("stockReportStatus"),"প্রথম ১,০০০টি matching row দেখানো হয়েছে; Search দিয়ে আরও নির্দিষ্ট করুন।");
}
$("stockReportSearch").oninput=renderStockReports;$("stockReportFilter").onchange=renderStockReports;$("refreshStockReportsBtn").onclick=loadStockReports;
$("stockReportsTab").onclick=async()=>{
 ["customerModulePanel","customerFormPanel","medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule","permissionsModule","payrollModule","accountsModule","dueOverviewModule","profitLossModule","financialReportsModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("stockReportsModule").hidden=false;document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));$("stockReportsTab").classList.add("active");await loadStockReports();
};
document.querySelectorAll(".tab").forEach(t=>{if(t.id!=="stockReportsTab")t.addEventListener("click",()=>{$("stockReportsModule").hidden=true;});});


async function loadEmployeeReports(){
 const month=value("employeeReportMonth")||new Date().toISOString().slice(0,7),start=month+"-01",endDate=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1),end=endDate.getFullYear()+"-"+String(endDate.getMonth()+1).padStart(2,"0")+"-"+String(endDate.getDate()).padStart(2,"0");
 say($("employeeReportStatusText"),"Employee Report তৈরি হচ্ছে...");
 const [e,a,p]=await Promise.all([
  db.from("erp_employees").select("id,employee_code,full_name,mobile_number,job_title,joining_date,employment_status").order("full_name").limit(5000),
  db.from("erp_attendance").select("employee_id,attendance_date,attendance_status").gte("attendance_date",start).lt("attendance_date",end).limit(10000),
  db.from("erp_employee_payroll").select("employee_id,net_salary,payment_status,payroll_month").eq("payroll_month",start).limit(5000)
 ]);
 const bad=[e,a,p].find(x=>x.error);if(bad){say($("employeeReportStatusText"),"Employee Report load হয়নি: "+bad.error.message,true);return;}
 window.employeeReportData={employees:e.data||[],attendance:a.data||[],payroll:p.data||[]};renderEmployeeReports();
 say($("employeeReportStatusText"),"Employee Report আপডেট হয়েছে: "+month+". "+((a.data||[]).length>=10000||(e.data||[]).length>=5000||(p.data||[]).length>=5000?"কোনো তালিকা রেকর্ড সীমায় পৌঁছেছে।":""));
}
function renderEmployeeReports(){
 const d=window.employeeReportData;if(!d)return;const status=value("employeeReportStatus"),term=value("employeeReportSearch").trim().toLowerCase();
 const employees=d.employees.filter(x=>(status==="all"||x.employment_status===status)&&(!term||[x.employee_code,x.full_name,x.mobile_number].join(" ").toLowerCase().includes(term)));
 const counts={active:0,inactive:0,resigned:0};d.employees.forEach(x=>counts[x.employment_status]=(counts[x.employment_status]||0)+1);
 $("erTotal").textContent=d.employees.length;$("erActive").textContent=counts.active;$("erInactive").textContent=counts.inactive;$("erResigned").textContent=counts.resigned;
 const attendanceBy=new Map();d.attendance.forEach(x=>{if(!attendanceBy.has(x.employee_id))attendanceBy.set(x.employee_id,{present:0,absent:0,leave:0,holiday:0});const c=attendanceBy.get(x.employee_id);if(c[x.attendance_status]!==undefined)c[x.attendance_status]++;});
 const payrollBy=new Map();d.payroll.forEach(x=>{payrollBy.set(x.employee_id,{net:Number(x.net_salary||0),status:x.payment_status});});
 $("erPresent").textContent=d.attendance.filter(x=>x.attendance_status==="present").length;$("erAbsent").textContent=d.attendance.filter(x=>x.attendance_status==="absent").length;
 $("erPayrollPaid").textContent=payrollMoney(d.payroll.filter(x=>x.payment_status==="paid").reduce((s,x)=>s+Number(x.net_salary||0),0));
 $("erPayrollPending").textContent=payrollMoney(d.payroll.filter(x=>x.payment_status==="pending").reduce((s,x)=>s+Number(x.net_salary||0),0));
 $("employeeReportRows").innerHTML=employees.length?employees.map(x=>{const c=attendanceBy.get(x.id)||{present:0,absent:0,leave:0};const p=payrollBy.get(x.id);return '<tr><td>'+safe(x.employee_code)+'</td><td>'+safe(x.full_name)+'</td><td>'+safe(x.mobile_number)+'</td><td>'+safe(x.job_title||"—")+'</td><td>'+safe(x.joining_date||"—")+'</td><td>'+safe(x.employment_status)+'</td><td>'+c.present+'</td><td>'+c.absent+'</td><td>'+c.leave+'</td><td>'+payrollMoney(p?.net||0)+(p?' ('+safe(p.status)+')':'')+'</td></tr>';}).join(""):'<tr><td colspan="10">এই Filter-এ কোনো Employee নেই।</td></tr>';
}
$("refreshEmployeeReportsBtn").onclick=loadEmployeeReports;
$("employeeReportMonth").onchange=loadEmployeeReports;
$("employeeReportStatus").onchange=renderEmployeeReports;
$("employeeReportSearch").oninput=renderEmployeeReports;
$("employeeReportsTab").onclick=async()=>{
 ["customerModulePanel","customerFormPanel","medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","stockReportsModule","employeeModule","attendanceModule","permissionsModule","payrollModule","accountsModule","dueOverviewModule","customerDueModule","salesReturnModule","purchaseReturnModule","profitLossModule","financialReportsModule"].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
 $("employeeReportsModule").hidden=false;document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));$("employeeReportsTab").classList.add("active");await loadEmployeeReports();
};
document.querySelectorAll(".tab").forEach(t=>{if(t.id!=="employeeReportsTab")t.addEventListener("click",()=>{$("employeeReportsModule").hidden=true;});});

})();

async function loadDashboard(){
 const status=$("dashboardStatus"), rows=$("dashboardAlertRows");
 say(status,"Dashboard data লোড হচ্ছে...");
 try{
  const [sales,meds,cust,emps,batches]=await Promise.all([
   db.from("erp_sales_invoices").select("*").limit(5000),
   db.from("erp_medicines").select("id",{count:"exact",head:true}),
   db.from("customers").select("id",{count:"exact",head:true}),
   db.from("erp_employees").select("id",{count:"exact",head:true}),
   db.from("erp_medicine_batches").select("*").limit(5000)
  ]);
  const failed=[sales,meds,cust,emps,batches].find(x=>x.error);
  if(failed) throw failed.error;
  const now=today(), saleRows=sales.data||[];
  const todaySales=saleRows.filter(x=>String(x.created_at||x.invoice_date||"").slice(0,10)===now);
  const amount=x=>Number(x.total_amount??x.grand_total??x.net_total??x.total??0);
  $("dashSales").textContent=money(todaySales.reduce((s,x)=>s+amount(x),0));
  $("dashInvoices").textContent=String(todaySales.length);
  $("dashMedicines").textContent=String(meds.count??0);
  $("dashCustomers").textContent=String(cust.count??0);
  $("dashEmployees").textContent=String(emps.count??0);
  const batchRows=batches.data||[]; $("dashBatches").textContent=String(batchRows.length);
  const qty=x=>Number(x.available_quantity??x.quantity_available??x.remaining_quantity??x.quantity??x.current_quantity??0);
  const active=batchRows.filter(x=>qty(x)>0);
  const low=active.filter(x=>qty(x)<=10);
  const limit=new Date(now+"T00:00:00");limit.setDate(limit.getDate()+90);
  const expiring=active.filter(x=>x.expiry_date&&x.expiry_date>=now&&x.expiry_date<=limit.toISOString().slice(0,10));
  $("dashLowStock").textContent=String(low.length);
  $("dashExpiring").textContent=String(expiring.length);
  const alerts=[...low.map(x=>({...x,_alert:"Low stock"})),...expiring.map(x=>({...x,_alert:"Expiring soon"}))].slice(0,30);
  rows.innerHTML=alerts.length?alerts.map(x=>'<tr><td>'+safe(x.medicine_name||x.name||x.medicine_id||"—")+'</td><td>'+safe(x.batch_number||"—")+'</td><td>'+qty(x)+'</td><td>'+safe(x.expiry_date||"—")+'</td><td>'+safe(x._alert)+'</td></tr>').join(""):'<tr><td colspan="5">কোনো Low Stock / Expiry alert নেই।</td></tr>';
  say(status,"Dashboard আপডেট হয়েছে।");
 }catch(e){say(status,"Dashboard load হয়নি: "+e.message,true);rows.innerHTML='<tr><td colspan="5">তথ্য পাওয়া যায়নি।</td></tr>';}
}
$("dashboardTab").onclick=async()=>{
 document.querySelectorAll("#workspace > .panel").forEach(el=>el.hidden=true);
 $("dashboardModule").hidden=false;document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
 $("dashboardTab").classList.add("active");await loadDashboard();
};
$("refreshDashboardBtn").onclick=loadDashboard;
document.querySelectorAll(".tab").forEach(t=>{if(t.id!=="dashboardTab")t.addEventListener("click",()=>{$("dashboardModule").hidden=true;});});

/* Appearance preferences: theme and content zoom */
(()=>{
 const body=document.body, themeBtn=$("themeToggle"), level=$("zoomLevel");
 let theme="light", zoom=100;
 try{theme=localStorage.getItem("bmp-erp-theme")==="dark"?"dark":"light";zoom=Number(localStorage.getItem("bmp-erp-zoom"))||100;}catch(e){}
 const applyTheme=()=>{body.dataset.theme=theme;themeBtn.textContent=theme==="dark"?"☀️ Light":"🌙 Dark";themeBtn.setAttribute("aria-pressed",String(theme==="dark"));};
 const applyZoom=()=>{zoom=Math.max(80,Math.min(130,zoom));body.style.zoom=zoom+"%";level.textContent=zoom+"%";try{localStorage.setItem("bmp-erp-zoom",String(zoom));}catch(e){}};
 themeBtn.onclick=()=>{theme=theme==="dark"?"light":"dark";applyTheme();try{localStorage.setItem("bmp-erp-theme",theme);}catch(e){}};
 $("zoomIn").onclick=()=>{zoom+=10;applyZoom();};
 $("zoomOut").onclick=()=>{zoom-=10;applyZoom();};
 $("zoomReset").onclick=()=>{zoom=100;applyZoom();};
 applyTheme();applyZoom();
})();

/* Export visible ERP report/table data */
(()=>{
 const csvCell=v=>{const s=String(v??"").replace(/\s+/g," ").trim();return '"'+s.replace(/"/g,'""')+'"';};
 function activeModule(){
  const ids=["dashboardModule","customerModulePanel","medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule","permissionsModule","payrollModule","accountsModule","dueOverviewModule","profitLossModule","financialReportsModule","stockReportsModule","employeeReportsModule"];
  return ids.map(id=>$(id)).find(el=>el&&!el.hidden)||document.querySelector("#workspace .panel:not([hidden])");
 }
 $("exportExcelBtn").onclick=()=>{
  const module=activeModule();if(!module){alert("Export করার মতো কোনো Module পাওয়া যায়নি।");return;}
  const tables=[...module.querySelectorAll("table")].filter(t=>t.querySelector("tbody tr")&&!t.closest("[hidden]"));
  if(!tables.length){alert("এই Module-এ Export করার মতো Table নেই।");return;}
  const lines=[];
  tables.forEach((table,index)=>{
   if(index)lines.push("");
   const title=module.querySelector("h2")?.textContent||"Bishal Medicine Point ERP";
   lines.push(csvCell(title));
   [...table.querySelectorAll("tr")].forEach(tr=>lines.push([...tr.querySelectorAll("th,td")].map(cell=>csvCell(cell.innerText)).join(",")));
  });
  const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="bishal-medicine-point-erp-"+today()+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 };
 $("exportPdfBtn").onclick=()=>{
  const module=activeModule();if(!module){alert("PDF তৈরি করার মতো Module পাওয়া যায়নি।");return;}
  const title=module.querySelector("h2")?.textContent||"Bishal Medicine Point ERP";
  const old=document.title;document.title=title+" - Bishal Medicine Point";window.print();document.title=old;
 };
})();


/* Supabase-backed settings, branch register, audit viewer, photo storage and data export */
(()=>{
 const $=id=>document.getElementById(id);
 let client=null,ready=false;
 const adminId="7a3166f2-e4bb-42b8-a649-033dd2d02090";
 const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 async function connect(){
  try{
   if(!window.supabase?.createClient||!window.BMP_SUPABASE_URL||!window.BMP_SUPABASE_ANON_KEY)return;
   client=window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);
   const {data:{session}}=await client.auth.getSession();
   ready=!!session&&session.user.id===adminId;
   if(ready){await loadSettings("erp_shop_settings",["shopName","shopPhone","shopEmail","shopAddress"],{shop_name:"shopName",phone:"shopPhone",email:"shopEmail",address:"shopAddress"});await loadSettings("erp_invoice_settings",["invoiceTitle","invoicePrefix","invoicePaper","invoiceLogo","invoiceFooter"],{invoice_title:"invoiceTitle",invoice_prefix:"invoicePrefix",paper_size:"invoicePaper",show_logo:"invoiceLogo",footer_text:"invoiceFooter"});await renderBranches();await renderLog();}
  }catch(e){console.warn("ERP cloud module connection:",e);}
 }
 async function loadSettings(table,ids,map){
  const {data,error}=await client.from(table).select("*").eq("id",true).maybeSingle();if(error||!data)return;
  Object.entries(map).forEach(([col,id])=>{if(data[col]!==null&&data[col]!==undefined)$(id).value=col==="show_logo"?(data[col]?"yes":"no"):String(data[col]);});
 }
 async function saveSettings(table,values,status,label){
  if(!ready){$(status).textContent="Admin Supabase session নেই; cloud save করা যায়নি।";return;}
  const {error}=await client.from(table).upsert({...values,id:true,updated_by:adminId,updated_at:new Date().toISOString()});
  $(status).textContent=error?"Cloud save failed: "+error.message:label+" Supabase-এ সংরক্ষিত হয়েছে।";
 }
 $("shopSettingsForm").addEventListener("submit",e=>{e.preventDefault();saveSettings("erp_shop_settings",{shop_name:$("shopName").value.trim(),phone:$("shopPhone").value.trim(),email:$("shopEmail").value.trim(),address:$("shopAddress").value.trim()},"shopSettingsStatus","Shop settings");});
 $("invoiceSettingsForm").addEventListener("submit",e=>{e.preventDefault();saveSettings("erp_invoice_settings",{invoice_title:$("invoiceTitle").value.trim(),invoice_prefix:$("invoicePrefix").value.trim(),paper_size:$("invoicePaper").value,show_logo:$("invoiceLogo").value==="yes",footer_text:$("invoiceFooter").value.trim()},"invoiceSettingsStatus","Invoice settings");});
 async function renderBranches(){
  if(!ready)return;
  const {data,error}=await client.from("erp_branches").select("branch_code,branch_name,phone,address,is_active").order("created_at");
  if(error){$("branchStatus").textContent=error.message;return;}
  $("branchRows").innerHTML=data.length?data.map(x=>'<tr><td>'+esc(x.branch_name)+'</td><td>'+esc(x.branch_code)+'</td><td>'+esc(x.phone)+'</td><td>'+esc(x.address)+'</td></tr>').join(""):'<tr><td colspan="4">No branch added.</td></tr>';
 }
 $("branchForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!ready){$("branchStatus").textContent="Admin Supabase session নেই; cloud save হয়নি।";return;}
  const row={branch_name:$("branchName").value.trim(),branch_code:$("branchCode").value.trim(),phone:$("branchPhone").value.trim(),address:$("branchAddress").value.trim(),created_by:adminId};
  const {error}=await client.from("erp_branches").insert(row);
  $("branchStatus").textContent=error?"Branch save failed: "+error.message:"Branch Supabase-এ সংরক্ষিত হয়েছে।";if(!error){e.target.reset();await renderBranches();}
 });
 async function renderLog(){
  if(!ready)return;
  const {data,error}=await client.from("erp_activity_log").select("changed_at,table_name,operation,record_id,actor_id").order("changed_at",{ascending:false}).limit(200);
  if(error){$("activityLogRows").innerHTML='<tr><td colspan="2">'+esc(error.message)+'</td></tr>';return;}
  $("activityLogRows").innerHTML=data.length?data.map(x=>'<tr><td>'+esc(new Date(x.changed_at).toLocaleString())+'</td><td>'+esc(x.operation+" "+x.table_name+" "+(x.record_id||""))+'</td></tr>').join(""):'<tr><td colspan="2">No database activity yet.</td></tr>';
 }
 $("photoManagerInput").addEventListener("change",async e=>{
  if(!ready){$("photoManagerStatus").textContent="Admin Supabase session নেই; cloud upload করা যায়নি।";return;}
  const files=[...(e.target.files||[])];let ok=0;
  for(const file of files){
   if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5*1024*1024)continue;
   const path="uploads/"+Date.now()+"-"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const {error}=await client.storage.from("erp-photos").upload(path,file,{contentType:file.type,upsert:false});
   if(!error){ok++;const img=document.createElement("img");img.alt=file.name;img.src=URL.createObjectURL(file);img.style.maxWidth="130px";img.style.maxHeight="130px";$("photoManagerPreview").appendChild(img);}
  }
  $("photoManagerStatus").textContent=ok+"টি ছবি private Supabase storage-এ upload হয়েছে।";
 });
 $("downloadLocalBackup").addEventListener("click",async()=>{
  if(!ready){$("backupStatus").textContent="Admin Supabase session ছাড়া database backup নেওয়া যাবে না।";return;}
  const tables=["customers","customer_ledger","erp_medicines","erp_medicine_batches","erp_sales_invoices","erp_sales_invoice_items","erp_purchase_invoices","erp_purchase_invoice_items","erp_suppliers","erp_employees","erp_attendance","erp_employee_payroll","erp_accounts","erp_account_transactions","erp_branches","erp_shop_settings","erp_invoice_settings"];
  const backup={product:"Bishal Medicine Point ERP data export",createdAt:new Date().toISOString(),tables:{}};
  for(const table of tables){const {data,error}=await client.from(table).select("*").limit(10000);if(error){$("backupStatus").textContent="Backup থেমেছে ("+table+"): "+error.message;return;}backup.tables[table]=data;}
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="bmp-erp-database-export-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(url);$("backupStatus").textContent="Database JSON export তৈরি হয়েছে। এটি export; full restore tool এখনো নেই।";
 });
 $("clearLocalActivity").addEventListener("click",()=>{if(ready)renderLog();});
 connect();
})();

/* Additional roadmap modules (31-module workspace) */
(()=>{
 const esc=value=>String(value??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
 const $id=id=>document.getElementById(id), read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem("bmp-erp-"+k))??fallback}catch(e){return fallback}}, write=(k,v)=>{try{localStorage.setItem("bmp-erp-"+k,JSON.stringify(v));return true}catch(e){return false}};
 const log=message=>{const a=read("activity",[]);a.unshift({at:new Date().toLocaleString(),message});write("activity",a.slice(0,200));renderLog();};
 const renderLog=()=>{const el=$id("activityLogRows");if(!el)return;const a=read("activity",[]);el.innerHTML=a.length?a.map(x=>'<tr><td>'+String(x.at).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</td><td>'+String(x.message).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</td></tr>').join(""):'<tr><td colspan="2">No local activity.</td></tr>';};
 const moduleIds=["dashboardModule","customerModulePanel","customerFormPanel","medicineModule","batchModule","barcodeModule","posModule","purchaseModule","stockModule","customerDueModule","salesReturnModule","purchaseReturnModule","employeeModule","attendanceModule","permissionsModule","payrollModule","accountsModule","dueOverviewModule","profitLossModule","financialReportsModule","stockReportsModule","employeeReportsModule","suppliersModule","invoiceSettingsModule","shopSettingsModule","branchesModule","onlineWebsiteModule","onlineOrdersModule","backupModule","activityLogModule","photoManagementModule","fingerprintModule"];
 const tabMap=[["suppliersTab","suppliersModule"],["invoiceSettingsTab","invoiceSettingsModule"],["shopSettingsTab","shopSettingsModule"],["branchesTab","branchesModule"],["onlineWebsiteTab","onlineWebsiteModule"],["onlineOrdersTab","onlineOrdersModule"],["backupTab","backupModule"],["activityLogTab","activityLogModule"],["photoManagementTab","photoManagementModule"],["fingerprintTab","fingerprintModule"]];
 tabMap.forEach(([tabId,panelId])=>{$id(tabId).addEventListener("click",()=>{moduleIds.forEach(id=>{const el=$id(id);if(el)el.hidden=true;});$id(panelId).hidden=false;document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));$id(tabId).classList.add("active");if(panelId==="branchesModule")renderBranches();if(panelId==="onlineOrdersModule")renderOrders();if(panelId==="activityLogModule")renderLog();});});
 $id("openPurchaseFromSupplier").onclick=()=>$id("purchaseTab").click();
 const invoiceFields=["invoiceTitle","invoicePrefix","invoicePaper","invoiceLogo","invoiceFooter"],shopFields=["shopName","shopPhone","shopEmail","shopAddress"],websiteFields=["onlineWebsiteUrl","catalogueEnabled","cataloguePrices"];
 function loadFields(key,fields){const data=read(key,{});fields.forEach(id=>{if(data[id]!==undefined)$id(id).value=data[id];});}
 function saveFields(key,fields,statusId,label){const data={};fields.forEach(id=>data[id]=$id(id).value);const ok=write(key,data);$id(statusId).textContent=ok?label+" সংরক্ষণ হয়েছে (এই browser-এ)।":"Browser storage-এ জায়গা নেই; সংরক্ষণ হয়নি।";if(ok)log(label+" updated");}
 loadFields("invoiceSettings",invoiceFields);loadFields("shopSettings",shopFields);loadFields("websiteSettings",websiteFields);
 $id("invoiceSettingsForm").onsubmit=e=>{e.preventDefault();saveFields("invoiceSettings",invoiceFields,"invoiceSettingsStatus","Invoice settings");};
 $id("shopSettingsForm").onsubmit=e=>{e.preventDefault();saveFields("shopSettings",shopFields,"shopSettingsStatus","Shop settings");};
 $id("onlineWebsiteForm").onsubmit=e=>{e.preventDefault();saveFields("websiteSettings",websiteFields,"onlineWebsiteStatus","Website settings");};
 const renderBranches=()=>{const a=read("branches",[]);$id("branchRows").innerHTML=a.length?a.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.code)+'</td><td>'+esc(x.phone)+'</td><td>'+esc(x.address)+'</td></tr>').join(""):'<tr><td colspan="4">No branch added.</td></tr>';};
 $id("branchForm").onsubmit=e=>{e.preventDefault();const a=read("branches",[]),x={name:$id("branchName").value.trim(),code:$id("branchCode").value.trim(),phone:$id("branchPhone").value.trim(),address:$id("branchAddress").value.trim()};if(a.some(b=>b.code.toLowerCase()===x.code.toLowerCase())){$id("branchStatus").textContent="এই Branch Code আগে ব্যবহার হয়েছে।";return;}a.push(x);write("branches",a);e.target.reset();renderBranches();$id("branchStatus").textContent="Branch draft local browser-এ সংরক্ষিত হয়েছে; server stock/sales branch-wise নয়।";log("Branch draft added: "+x.code);};
 const renderOrders=()=>{const a=read("orders",[]);$id("onlineOrderRows").innerHTML=a.length?a.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.customer)+'</td><td>'+esc(x.phone)+'</td><td>'+esc(x.details)+'</td><td>Draft</td></tr>').join(""):'<tr><td colspan="5">No order notes.</td></tr>';};
 $id("onlineOrderForm").onsubmit=e=>{e.preventDefault();const a=read("orders",[]),x={date:new Date().toLocaleDateString(),customer:$id("onlineCustomer").value.trim(),phone:$id("onlinePhone").value.trim(),details:$id("onlineDetails").value.trim()};a.unshift(x);write("orders",a.slice(0,300));e.target.reset();renderOrders();$id("onlineOrderStatus").textContent="Order note local browser-এ সংরক্ষিত হয়েছে; এটি live online order নয়।";log("Manual online order note saved");};
 $id("downloadLocalBackup").onclick=()=>{const keys=["invoiceSettings","shopSettings","branches","websiteSettings","orders","activity"],data={product:"Bishal Medicine Point ERP local settings backup",createdAt:new Date().toISOString(),data:{}};keys.forEach(k=>data.data[k]=read(k,null));const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="bmp-local-settings-backup.json";a.click();URL.revokeObjectURL(url);$id("backupStatus").textContent="Local settings backup download শুরু হয়েছে; Supabase database অন্তর্ভুক্ত নয়।";};
 $id("restoreLocalBackup").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data.data||typeof data.data!=="object")throw new Error("Invalid backup");Object.entries(data.data).forEach(([k,v])=>{if(["invoiceSettings","shopSettings","branches","websiteSettings","orders","activity"].includes(k))write(k,v);});loadFields("invoiceSettings",invoiceFields);loadFields("shopSettings",shopFields);loadFields("websiteSettings",websiteFields);renderBranches();renderOrders();renderLog();$id("backupStatus").textContent="Local settings restore হয়েছে। Database restore হয়নি।";log("Local settings restored");}catch(err){$id("backupStatus").textContent="Restore failed: "+err.message;}e.target.value="";};
 $id("clearLocalActivity").onclick=()=>{write("activity",[]);renderLog();};
 $id("photoManagerInput").onchange=e=>{const files=[...(e.target.files||[])];$id("photoManagerPreview").innerHTML="";files.forEach(file=>{if(!/^image\/(png|jpeg|webp)$/.test(file.type))return;const img=document.createElement("img");img.alt=file.name;img.src=URL.createObjectURL(file);img.style.maxWidth="130px";img.style.maxHeight="130px";img.style.objectFit="cover";$id("photoManagerPreview").appendChild(img);});$id("photoManagerStatus").textContent=files.length+"টি ফাইল preview করা হয়েছে; স্থায়ী upload হয়নি।";};
 renderBranches();renderOrders();renderLog();
})();