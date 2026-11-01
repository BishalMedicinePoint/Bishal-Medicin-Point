(() => {
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = value => Number(value || 0).toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2});
  const client = window.supabase.createClient(window.BMP_SUPABASE_URL,window.BMP_SUPABASE_ANON_KEY);

  function status(id,message,isError=false){
    const el=$(id);el.textContent=message;el.style.color=isError?"#b42318":"";
  }
  function formatDate(value){
    if(!value)return "—";
    const date=new Date(value);
    return Number.isNaN(date.getTime())?safe(value):date.toLocaleDateString("en-GB");
  }
  function formatTime(value){
    if(!value)return "—";
    const date=new Date(value);
    return Number.isNaN(date.getTime())?safe(value):date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  }
  async function loadPortal(user){
    status("loginStatus","আপনার Employee Access যাচাই হচ্ছে...");
    const {data:access,error}=await client.rpc("bmp_get_my_erp_access");
    if(error || !access || access.authorized!==true || !access.employee_id){
      await client.auth.signOut();
      $("workspace").hidden=true;$("loginPanel").hidden=false;
      status("loginStatus",error?"Access যাচাই করা যায়নি: "+error.message:"এই Account-এর Employee Login সক্রিয় নয়। Admin-কে Login Account ও Permission যাচাই করতে বলুন।",true);
      return;
    }
    $("loginPanel").hidden=true;$("workspace").hidden=false;
    $("employeeName").textContent=access.full_name||"Employee";
    $("employeeRole").textContent=access.job_title||"";
    $("employeeCode").textContent=access.employee_code||"—";
    $("jobTitle").textContent=access.job_title||"—";
    $("systemRole").textContent=access.system_role||"employee";
    $("branchId").textContent=access.branch_id||"—";

    const permissions=access.permissions||{};
    const canViewAttendance=permissions.attendance?.view===true;
    const canViewPayroll=permissions.payroll?.view===true;
    $("attendanceCard").hidden=!canViewAttendance;
    $("payrollCard").hidden=!canViewPayroll;

    const tasks=[];
    if(canViewAttendance)tasks.push(loadAttendance(access.employee_id));
    if(canViewPayroll)tasks.push(loadPayroll(access.employee_id));
    await Promise.all(tasks);
    if(!canViewAttendance&&!canViewPayroll){
      status("portalStatus","আপনার জন্য এখনো Attendance বা Payroll View Permission দেওয়া হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।");
    }else{
      status("portalStatus","আপনার অনুমোদিত ব্যক্তিগত তথ্য দেখানো হচ্ছে।");
    }
  }
  async function loadAttendance(employeeId){
    const {data,error}=await client.from("erp_attendance")
      .select("attendance_date,attendance_status,check_in,check_out,notes")
      .eq("employee_id",employeeId).order("attendance_date",{ascending:false}).limit(120);
    if(error){$("attendanceRows").innerHTML='<tr><td colspan="5">Attendance load হয়নি।</td></tr>';status("portalStatus","Attendance: "+error.message,true);return;}
    const rows=data||[];
    $("attendanceRows").innerHTML=rows.length?rows.map(row=>'<tr><td>'+formatDate(row.attendance_date)+'</td><td>'+safe(row.attendance_status)+'</td><td>'+formatTime(row.check_in)+'</td><td>'+formatTime(row.check_out)+'</td><td>'+safe(row.notes||"—")+'</td></tr>').join(""):'<tr><td colspan="5">এখনো কোনো Attendance Record নেই।</td></tr>';
  }
  async function loadPayroll(employeeId){
    const {data,error}=await client.from("erp_employee_payroll")
      .select("payroll_month,net_salary,payment_status,paid_date")
      .eq("employee_id",employeeId).order("payroll_month",{ascending:false}).limit(36);
    if(error){$("payrollRows").innerHTML='<tr><td colspan="4">Payroll load হয়নি।</td></tr>';status("portalStatus","Payroll: "+error.message,true);return;}
    const rows=data||[];
    $("payrollRows").innerHTML=rows.length?rows.map(row=>'<tr><td>'+formatDate(row.payroll_month)+'</td><td>৳ '+money(row.net_salary)+'</td><td>'+safe(row.payment_status)+'</td><td>'+formatDate(row.paid_date)+'</td></tr>').join(""):'<tr><td colspan="4">এখনো কোনো Payroll Record নেই।</td></tr>';
  }
  $("loginForm").addEventListener("submit",async event=>{
    event.preventDefault();status("loginStatus","লগইন হচ্ছে...");
    const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
    $("password").value="";
    if(error){status("loginStatus","Login হয়নি: "+error.message,true);return;}
    await loadPortal(data.user);
  });
  $("logoutBtn").addEventListener("click",async()=>{
    await client.auth.signOut();$("workspace").hidden=true;$("loginPanel").hidden=false;status("loginStatus","আপনি Logout করেছেন।");
  });
  client.auth.getSession().then(({data})=>{if(data.session?.user)loadPortal(data.session.user);});
})();
