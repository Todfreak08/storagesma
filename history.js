let allRows=[];

function dateForRow(d){
  return String(d.date || String(d.timestamp||"").slice(0,10));
}

function filteredRows(){
  const selected=$("dateFilter").value;
  if(!selected)return sortNewest(allRows);
  return sortNewest(allRows.filter(r=>dateForRow(r.data)===selected));
}

function renderHistory(){
  const rows=filteredRows();
  $("historyCount") && ($("historyCount").textContent=`${rows.length} record${rows.length===1?"":"s"}`);
  $("historySummary").textContent=$("dateFilter").value
    ? `${rows.length} DHT11 record${rows.length===1?"":"s"} found for ${$("dateFilter").value}.`
    : `${rows.length} DHT11 record${rows.length===1?"":"s"} available in Firebase.`;

  if(!rows.length){
    $("historyBody").innerHTML='<tr><td colspan="5" class="empty">No readings found for the selected date.</td></tr>';
    return;
  }

  $("historyBody").innerHTML=rows.map(r=>formatRecord(r.key,r.data)).join("");
}

async function initializeHistory(){
  try{
    await ensureFirebaseAuth();
    allRows=await readAllRecords();
    renderHistory();

    subscribeHistory(rows=>{
      allRows=rows;
      renderHistory();
    });

    $("dateFilter").addEventListener("change",renderHistory);
    $("todayBtn").onclick=()=>{
      const d=new Date();
      const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
      $("dateFilter").value=local;
      renderHistory();
    };
    $("clearDate").onclick=()=>{
      $("dateFilter").value="";
      renderHistory();
    };
    $("refreshHistory").onclick=async()=>{
      $("refreshHistory").disabled=true;
      try{allRows=await readAllRecords();renderHistory();showToast("History refreshed.");}
      finally{$("refreshHistory").disabled=false;}
    };
    $("clearHistory").onclick=async()=>{
      if(!confirm("Delete all Smart Storage history records from Firebase? This cannot be undone."))return;
      try{
        await database.ref(DB_PATHS.history).remove();
        await database.ref(DB_PATHS.recordCount).set(0);
        // Tell the ESP32 that Firebase was cleared. The ESP32 will reset its
        // persistent local counter so the next reading becomes Record 1.
        await database.ref("SmartStorage/command/collecting").set(false);
        allRows=[];
        renderHistory();
        showToast("History cleared.");
      }catch(error){
        console.error(error);
        alert("Unable to clear history. Check Firebase rules.");
      }
    };
  }catch(error){
    console.error(error);
    $("historyBody").innerHTML='<tr><td colspan="5" class="empty">Firebase authentication failed.</td></tr>';
    $("historySummary").textContent="Unable to load Firebase history.";
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  bindFirebaseStatus();
  initializeHistory();
});