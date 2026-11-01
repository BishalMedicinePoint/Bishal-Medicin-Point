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
  function formatTime(value){if(!value)return "—";const part=String(value).slice(0,5).split(":");if(part.length<2)return safe(value);const h=Number(part[0]),m=Number(part[1]);return new Date(2000,0,1,h,m).toLocaleTimeString("en-BD",{hour:"numeric",minute:"2-digit"});}
  const minutesOf=value=>{if(!value)return null;const p=String(value).split(":");return Number(p[0])*60+Number(p[1]||0);};
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
    window.employeeDutyStart=access.duty_start_time||"08:00";window.employeeMealBreakMinutes=Number(access.meal_break_minutes||40);window.employeeMonthlyLeaveDays=Number(access.monthly_leave_days||2);
    $("dutySchedule").textContent=formatTime(access.duty_start_time)+" – "+formatTime(access.duty_end_time)+" · Meal "+window.employeeMealBreakMinutes+" min";

    const permissions=access.permissions||{};
    const canViewAttendance=permissions.attendance?.view===true;
    const canCheckIn=permissions.attendance?.create===true;
    const canCheckOut=permissions.attendance?.update===true;
    const canViewPayroll=permissions.payroll?.view===true;
    $("attendanceCard").hidden=!canViewAttendance;
    $("payrollCard").hidden=!canViewPayroll;

    const tasks=[];
    if(canViewAttendance){tasks.push(loadAttendance(access.employee_id));}
    $("checkInBtn").hidden=!(canViewAttendance&&canCheckIn);
    $("checkOutBtn").hidden=!(canViewAttendance&&canCheckOut);
    if(canViewAttendance)tasks.push(loadTodayAttendance(access.employee_id));
    if(canViewPayroll)tasks.push(loadPayroll(access.employee_id));
    await Promise.all(tasks);
    if(!canViewAttendance&&!canViewPayroll){
      status("portalStatus","আপনার জন্য এখনো Attendance বা Payroll View Permission দেওয়া হয়নি। Admin-এর সঙ্গে যোগাযোগ করুন।");
    }else{
      status("portalStatus","আপনার অনুমোদিত ব্যক্তিগত তথ্য দেখানো হচ্ছে।");
    }
  }
  async function loadAttendance(employeeId){
    const {data,error}=await client.from("erp_attendance").select("attendance_date,attendance_status,check_in,meal_break_out,meal_break_in,check_out,notes").eq("employee_id",employeeId).order("attendance_date",{ascending:false}).limit(120);
    if(error){$("attendanceRows").innerHTML='<tr><td colspan="7">Attendance load হয়নি।</td></tr>';status("portalStatus","Attendance: "+error.message,true);return;}
    const rows=data||[],month=todayDhaka().slice(0,7),current=rows.filter(r=>String(r.attendance_date).startsWith(month));let dutyMinutes=0,lateMinutes=0,leaveDays=0;
    const start=minutesOf(window.employeeDutyStart||"08:00"),mealDefault=Number(window.employeeMealBreakMinutes||40);
    current.forEach(r=>{if(r.attendance_status==="leave")leaveDays++;if(r.attendance_status!=="present")return;const ci=minutesOf(r.check_in),co=minutesOf(r.check_out);if(ci!==null&&start!==null&&ci>start)lateMinutes+=ci-start;if(ci!==null&&co!==null){let span=co-ci;if(span<0)span+=1440;const mo=minutesOf(r.meal_break_out),mi=minutesOf(r.meal_break_in);let meal=mo!==null&&mi!==null?mi-mo:mealDefault;if(meal<0)meal+=1440;dutyMinutes+=Math.max(0,span-meal);}});
    $("monthlyDutyHours").textContent=(dutyMinutes/60).toFixed(2)+" ঘণ্টা";$("monthlyLateMinutes").textContent=lateMinutes+" মিনিট";$("monthlyLeaveBalance").textContent=Math.max(0,Number(window.employeeMonthlyLeaveDays||2)-leaveDays)+" / "+Number(window.employeeMonthlyLeaveDays||2)+" দিন";
    $("attendanceRows").innerHTML=rows.length?rows.map(row=>'<tr><td>'+formatDate(row.attendance_date)+'</td><td>'+safe(row.attendance_status)+'</td><td>'+formatTime(row.check_in)+'</td><td>'+formatTime(row.meal_break_out)+'</td><td>'+formatTime(row.meal_break_in)+'</td><td>'+formatTime(row.check_out)+'</td><td>'+safe(row.notes||"—")+'</td></tr>').join(""):'<tr><td colspan="7">এখনো কোনো Attendance Record নেই।</td></tr>';
  }
  function todayDhaka(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const v={};parts.forEach(p=>v[p.type]=p.value);return v.year+"-"+v.month+"-"+v.day;
  }
  async function loadTodayAttendance(employeeId){
    const {data,error}=await client.from("erp_attendance").select("attendance_date,attendance_status,check_in,check_out").eq("employee_id",employeeId).eq("attendance_date",todayDhaka()).maybeSingle();
    if(error){status("attendanceActionStatus","আজকের হাজিরা যাচাই হয়নি: "+error.message,true);return;}
    const checkedIn=!!data?.check_in;const checkedOut=!!data?.check_out;
    $("checkInBtn").disabled=checkedIn;$("checkInBtn").textContent=checkedIn?"Check In সম্পন্ন":"আজকের Check In";
    $("checkOutBtn").disabled=!checkedIn||checkedOut;$("checkOutBtn").textContent=checkedOut?"Check Out সম্পন্ন":"আজকের Check Out";
    if(checkedOut)status("attendanceActionStatus","আজকের Check In ও Check Out সম্পন্ন হয়েছে।");
    else if(checkedIn)status("attendanceActionStatus","Check In: "+formatTime(data.check_in)+" — Check Out করা যাবে।");
    else status("attendanceActionStatus","আজকের Check In এখনো হয়নি।");
  }
  async function attendanceAction(action){
    const button=action==="check_in"?$("checkInBtn"):$("checkOutBtn");button.disabled=true;
    status("attendanceActionStatus","Attendance save হচ্ছে...");
    const {data,error}=await client.rpc("bmp_employee_attendance_action",{p_action:action});
    if(error){status("attendanceActionStatus","Attendance save হয়নি: "+error.message,true);button.disabled=false;return;}
    status("attendanceActionStatus",data?.message||"Attendance update হয়েছে.");
    const {data:access}=await client.rpc("bmp_get_my_erp_access");
    if(access?.employee_id){await loadTodayAttendance(access.employee_id);await loadAttendance(access.employee_id);}
  }
  async function loadPayroll(employeeId){
    const {data,error}=await client.from("erp_employee_payroll")
      .select("payroll_month,net_salary,payment_status,paid_date")
      .eq("employee_id",employeeId).order("payroll_month",{ascending:false}).limit(36);
    if(error){$("payrollRows").innerHTML='<tr><td colspan="4">Payroll load হয়নি।</td></tr>';status("portalStatus","Payroll: "+error.message,true);return;}
    const rows=data||[];
    $("payrollRows").innerHTML=rows.length?rows.map(row=>'<tr><td>'+formatDate(row.payroll_month)+'</td><td>৳ '+money(row.net_salary)+'</td><td>'+safe(row.payment_status)+'</td><td>'+formatDate(row.paid_date)+'</td></tr>').join(""):'<tr><td colspan="4">এখনো কোনো Payroll Record নেই।</td></tr>';
  }
  $("checkInBtn").addEventListener("click",()=>attendanceAction("check_in"));
  $("checkOutBtn").addEventListener("click",()=>attendanceAction("check_out"));
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
