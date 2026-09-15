
function setCollectionUI(enabled, message){
  const toggle=$("collectionToggle");
  const state=$("collectionState");
  const msg=$("collectionMessage");
  if(toggle) toggle.checked=!!enabled;
  if(state){
    state.textContent=enabled?"● RUNNING":"● STOPPED";
    state.className="control-state "+(enabled?"running":"stopped");
  }
  if(msg) msg.textContent=message || (enabled?"ESP32 is collecting DHT11 data.":"Data collection is stopped. Wi-Fi remains connected.");
}

function watchCollectionStatus(){
  const ref=database.ref(DB_PATHS.status+"/collecting");
  ref.on("value", snapshot=>{
    const value=snapshot.val();
    setCollectionUI(value !== false, value === false ? "Data collection is stopped. Wi-Fi remains connected.":"ESP32 is collecting DHT11 data.");
  }, error=>{
    console.error("Collection status error:",error);
    const msg=$("collectionMessage");
    if(msg) msg.textContent="Unable to read collection status from Firebase.";
  });
}

// START/STOP uses a one-shot command path.
// ESP32 reads SmartStorage/command/collecting, applies the command,
// then clears that command. The status path is read-only from the website.
async function setCollectionStatus(enabled){
  const toggle=$("collectionToggle");
  if(toggle) toggle.disabled=true;
  try{
    await database.ref("SmartStorage/command/collecting").set(!!enabled);
    showToast(enabled?"Data collection STARTED":"Data collection STOPPED");
    setCollectionUI(!!enabled, enabled?"ESP32 is collecting DHT11 data.":"Data collection is stopped. Wi-Fi remains connected.");
  }catch(error){
    console.error("Unable to change collection status:",error);
    showToast("Unable to change data collection.");
    if(toggle) toggle.checked=!enabled;
  }finally{
    if(toggle) toggle.disabled=false;
  }
}

function updateDashboard(rows){
  const sorted=sortNewest(rows);
  const latest=sorted[0]?.data;

  $("summaryRecords").textContent=rows.length;

  if(!latest){
    $("deviceStatus").textContent="WAITING";
    $("deviceStatus").className="status-pill";
    $("deviceMessage").textContent="Waiting for ESP32 data...";
    $("dataLogBody").innerHTML='<tr><td colspan="5" class="empty">Waiting for ESP32 data...</td></tr>';
    $("latestTemperature").textContent="--";
    $("latestHumidity").textContent="--";
    $("latestDate").textContent="--";
    $("latestTime").textContent="--";
    $("avgTemperature").textContent="--";
    $("avgHumidity").textContent="--";
    return;
  }

  const p=timestampParts(latest.timestamp,latest.date,latest.time);
  $("deviceStatus").textContent="ONLINE";
  $("deviceStatus").className="status-pill running";
  $("deviceMessage").textContent=`Last DHT11 reading received on ${p.date} at ${p.time}.`;
  $("latestTemperature").textContent=formatFloat(getTemperature(latest))+" °C";
  $("latestHumidity").textContent=formatFloat(getHumidity(latest))+" %";
  $("latestDate").textContent=p.date;
  $("latestTime").textContent=p.time;

  const temps=rows.map(r=>getTemperature(r.data)).filter(Number.isFinite);
  const hums=rows.map(r=>getHumidity(r.data)).filter(Number.isFinite);
  $("avgTemperature").textContent=temps.length?(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(2)+" °C":"--";
  $("avgHumidity").textContent=hums.length?(hums.reduce((a,b)=>a+b,0)/hums.length).toFixed(2)+" %":"--";

  $("dataLogBody").innerHTML=sorted.slice(0,10).map(r=>formatRecord(r.key,r.data)).join("");
}

async function initializeDashboard(){
  try{
    await ensureFirebaseAuth();

    database.ref(DB_PATHS.current).on("value",snapshot=>{
      const d=snapshot.val();
      if(!d){
        $("deviceStatus").textContent="WAITING";
        $("deviceStatus").className="status-pill";
        $("deviceMessage").textContent="Waiting for ESP32 data in Firebase...";
        return;
      }
      const p=timestampParts(d.timestamp,d.date,d.time);
      const temp=getTemperature(d);
      const hum=getHumidity(d);
      $("latestTemperature").textContent=Number.isFinite(temp)?formatFloat(temp)+" °C":"--";
      $("latestHumidity").textContent=Number.isFinite(hum)?formatFloat(hum)+" %":"--";
      $("latestDate").textContent=p.date;
      $("latestTime").textContent=p.time;
      $("deviceStatus").textContent="ONLINE";
      $("deviceStatus").className="status-pill running";
      $("deviceMessage").textContent="ESP32 current reading is available.";
    },error=>{
      console.error("Firebase current reading error:",error);
      $("deviceStatus").textContent="ERROR";
      $("deviceStatus").className="status-pill";
      $("deviceMessage").textContent="Firebase access denied. Check your Realtime Database rules.";
    });

    const rows=await readAllRecords();
    updateDashboard(rows);
    subscribeHistory(updateDashboard);
  }catch(error){
    console.error(error);
    $("deviceStatus").textContent="ERROR";
    $("deviceMessage").textContent="Firebase authentication or database access failed.";
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  bindFirebaseStatus();
  watchCollectionStatus();
  const toggle=$("collectionToggle");
  if(toggle){
    toggle.addEventListener("change",()=>setCollectionStatus(toggle.checked));
  }
  initializeDashboard();
});