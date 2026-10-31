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
 const n=id=>Number($(id).value||0);const payload={medicine_name:value("medicineName"),generic_name:value("genericName")||null,brand:value("brandName")||null,therapeutic_group:value("medicineGroup")||null,dosage_form:value("dosageForm"),strength:value("medicineStrength")||null,pack_size:value("packSize")||null,manufacturer:value("manufacturer")||null,barcode:value("barcode")||null,purchase_price:n("purchasePrice"),selling_price:n("sellingPrice"),mrp:n("mrp"),box_price:n("boxPrice"),strip_price:n("stripPrice"),unit_price:n("unitPrice"),units_per_strip:n("unitsPerStrip"),strips_per_box:n("stripsPerBox"),sale_units_allowed:value("saleUnitsAllowed")||null,description:value("medicineDescription")||null,is_active:$("medicineActive").value==="true"};
 if([payload.purchase_price,payload.selling_price,payload.mrp,payload.box_price,payload.strip_price,payload.unit_price,payload.units_per_strip,payload.strips_per_box].some(v=>v<0)){say($("medicineStatusText"),"Price ও conversion quantity ঋণাত্মক হতে পারবে না।",true);return;}
 say($("medicineStatusText"),"Medicine সংরক্ষণ হচ্ছে...");
 const id=value("medicineRecordId");const res=id?await db.from("erp_medicines").update(payload).eq("id",id):await db.from("erp_medicines").insert(payload);
 if(res.error){say($("medicineStatusText"),"সংরক্ষণ হয়নি: "+res.error.message,true);return;}
 $("medicineFormPanel").hidden=true;say($("medicineStatusText"),"Medicine সংরক্ষণ হয়েছে। Stock পরিবর্তন হয়নি।");await loadMedicines();
};
$("newMedicineBtn").onclick=()=>openMedicine();$("closeMedicineForm").onclick=$("cancelMedicineForm").onclick=()=>{$("medicineFormPanel").hidden=true;};
$("medicineSearch").oninput=loadMedicines;$("medicineStatus").onchange=loadMedicines;
$("customersTab").onclick=()=>{$("medicineModule").hidden=true;$("batchModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=true;$("newCustomerBtn").closest(".panel").hidden=false;$("customerFormPanel").hidden=true;$("customersTab").classList.add("active");$("medicinesTab").classList.remove("active");};
$("medicinesTab").onclick=()=>{$("batchModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=true;$("medicineModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;$("medicinesTab").classList.add("active");$("customersTab").classList.remove("active");loadMedicines();};


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
 $("medicineModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=true;$("batchModule").hidden=false;
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
 $("medicineModule").hidden=true;$("batchModule").hidden=true;$("posModule").hidden=true;$("barcodeModule").hidden=false;
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
$("posTab").onclick=async()=>{$("medicineModule").hidden=true;$("batchModule").hidden=true;$("barcodeModule").hidden=true;$("posModule").hidden=false;$("newCustomerBtn").closest(".panel").hidden=true;$("customerFormPanel").hidden=true;["customersTab","medicinesTab","batchesTab","barcodeTab"].forEach(id=>$(id).classList.remove("active"));$("posTab").classList.add("active");await pCustomers();await pInvoices();};

if(!window.supabase||!window.BMP_SUPABASE_URL||!window.BMP_SUPABASE_ANON_KEY||window.BMP_SUPABASE_ANON_KEY.startsWith("PASTE_")){say($("loginStatus"),"Supabase config পাওয়া যায়নি।",true);return;}
db=window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);
db.auth.getSession().then(({data})=>{if(data.session)verifyUser(data.session.user);});
})();