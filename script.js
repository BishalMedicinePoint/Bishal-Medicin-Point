const input=document.getElementById("searchInput"),list=document.getElementById("medicineList"),count=document.getElementById("resultCount"),empty=document.getElementById("emptyState"),hint=document.querySelector(".hint");
document.getElementById("year").textContent=new Date().getFullYear();
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderMedicines(query=""){
 const q=query.trim().toLocaleLowerCase();
 const data=(Array.isArray(medicines)?medicines:[]).filter(m=>[m.name,m.generic,m.strength,m.form,m.manufacturer,m.pack].join(" ").toLocaleLowerCase().includes(q));
 count.textContent=`${data.length}টি তথ্য`;
 list.innerHTML=data.map(m=>{
  const img=m.image?`<img class="product-image" src="${safeText(m.image)}" alt="${safeText(m.name||"ওষুধের প্যাকেট")}" loading="lazy">`:`<div class="product-image image-placeholder" aria-label="ছবি যোগ করা হয়নি">+</div>`;
  const prices=[m.unitPrice?`ইউনিট: ${safeText(m.unitPrice)}`:"",m.packPrice?`প্যাক: ${safeText(m.packPrice)}`:""].filter(Boolean).join(" · ");
  return `<article class="medicine-card">${img}<div class="medicine-info"><h3>${safeText(m.name||"নাম দেওয়া হয়নি")}</h3><p class="generic">${safeText(m.generic||"জেনেরিক তথ্য যোগ করা হয়নি")}</p><div class="meta">${[m.strength,m.form].filter(Boolean).map(x=>`<span>${safeText(x)}</span>`).join("")}</div><p class="manufacturer">${safeText(m.manufacturer||"প্রস্তুতকারক যাচাই করা হয়নি")}</p><p class="pack">${safeText(m.pack||"")}</p>${prices?`<p class="price">${prices}</p>`:`<p class="pack">মূল্য যাচাই করে যোগ করতে হবে</p>`}</div></article>`;
 }).join("");
 empty.hidden=data.length>0;hint.hidden=data.length>0;
}
document.getElementById("searchForm").addEventListener("submit",e=>{e.preventDefault();renderMedicines(input.value);document.getElementById("results").scrollIntoView({behavior:"smooth"});});
input.addEventListener("input",()=>renderMedicines(input.value));
document.querySelectorAll("[data-query]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.query;renderMedicines(input.value);document.getElementById("results").scrollIntoView({behavior:"smooth"});}));
renderMedicines();
