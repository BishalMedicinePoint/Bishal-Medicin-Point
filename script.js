const input=document.getElementById("searchInput"),list=document.getElementById("medicineList"),count=document.getElementById("resultCount"),empty=document.getElementById("emptyState"),hint=document.querySelector(".hint");
document.getElementById("year").textContent=new Date().getFullYear();
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
let medicineRows=[];
function renderMedicines(query=""){
 const q=query.trim().toLocaleLowerCase();
 const data=medicineRows.filter(m=>[m.name,m.generic_name,m.strength,m.form,m.manufacturer,m.pack_size].join(" ").toLocaleLowerCase().includes(q));
 count.textContent=`${data.length}টি তথ্য`;
 list.innerHTML=data.map(m=>{
  const img=m.image_url?`<img class="product-image" src="${safeText(m.image_url)}" alt="${safeText(m.name)}" loading="lazy">`:`<div class="product-image image-placeholder">+</div>`;
  const prices=[m.unit_price!=null?`ইউনিট: ৳${safeText(m.unit_price)}`:"",m.pack_price!=null?`প্যাক: ৳${safeText(m.pack_price)}`:""].filter(Boolean).join(" · ");
  return `<article class="medicine-card">${img}<div class="medicine-info"><h3>${safeText(m.name)}</h3><p class="generic">${safeText(m.generic_name||"জেনেরিক তথ্য যোগ করা হয়নি")}</p><div class="meta">${[m.strength,m.form].filter(Boolean).map(x=>`<span>${safeText(x)}</span>`).join("")}</div><p class="manufacturer">${safeText(m.manufacturer||"প্রস্তুতকারক উল্লেখ নেই")}</p><p class="pack">${safeText(m.pack_size||"")}</p>${prices?`<p class="price">${prices}</p>`:`<p class="pack">মূল্য যোগ করা হয়নি</p>`}</div></article>`;
 }).join("");
 empty.hidden=data.length>0;hint.hidden=data.length>0;
}
async function loadMedicines(){
 try{
  const {data,error}=await window.bmpSupabase.from("medicines").select("id,name,generic_name,strength,form,manufacturer,pack_size,unit_price,pack_price,image_url").eq("is_active",true).order("created_at",{ascending:false});
  if(error)throw error; medicineRows=data||[];renderMedicines(input.value);
 }catch(e){console.error(e);count.textContent="তথ্য লোড হয়নি";hint.hidden=false;hint.textContent="ওষুধের তথ্য এখন লোড করা যাচ্ছে না। পরে আবার চেষ্টা করুন।";empty.hidden=true;}
}
document.getElementById("searchForm").addEventListener("submit",e=>{e.preventDefault();renderMedicines(input.value);document.getElementById("results").scrollIntoView({behavior:"smooth"});});
input.addEventListener("input",()=>renderMedicines(input.value));
document.querySelectorAll("[data-query]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.query;renderMedicines(input.value);document.getElementById("results").scrollIntoView({behavior:"smooth"});}));
if(window.supabase&&window.BMP_SUPABASE_URL&&window.BMP_SUPABASE_ANON_KEY&&!window.BMP_SUPABASE_ANON_KEY.startsWith("PASTE_")){
 window.bmpSupabase=window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);loadMedicines();
}else{count.textContent="সেটআপ বাকি";hint.textContent="Database সংযোগ সেটআপ হলে এখানে ওষুধের তথ্য দেখা যাবে।";empty.hidden=true;}
