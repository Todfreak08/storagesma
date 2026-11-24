
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

    database.ref("SmartStorage/motion/current").on("value",snapshot=>{
      const motion=snapshot.val()||{};
      const detected=motion.detected===true;
      $("motionDetected").textContent=detected?"MOTION DETECTED":"NO MOTION";
      $("motionDetected").className="status-pill "+(detected?"warning":"running");
      $("motionState").textContent=detected?"DETECTED":"CLEAR";
      $("motionLedState").textContent=motion.ledOn===true?"ON":"OFF";
    },error=>{
      console.error("PIR motion status error:",error);
      $("motionDetected").textContent="UNAVAILABLE";
      $("motionState").textContent="--";
      $("motionLedState").textContent="--";
    });

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
  initializeRelayControls();
  initializeMotionHistory();
});

// ============================================================
// ESP32 LOCAL RELAY WEB SERVER + LOCAL EVENT HISTORY
// Use the dashboard from the ESP32 IP (not VS Code Live Server).
// ============================================================
async function refreshRelayStatus(){
  try{
    const response=await fetch('/api/relay-status',{cache:'no-store'});
    if(!response.ok) throw new Error('ESP32 relay status unavailable');
    const data=await response.json();
    [1,2].forEach(n=>{
      const on=!!data['relay'+n];
      const toggle=$('relay'+n+'Toggle');
      const label=$('relay'+n+'State');
      if(toggle) toggle.checked=on;
      if(label){label.textContent=on?'ON':'OFF';label.className='relay-state '+(on?'is-on':'is-off');}
    });
    const badge=$('relayConnection'); if(badge){badge.textContent='ESP32 CONNECTED';badge.className='status-pill running';}
  }catch(error){
    const badge=$('relayConnection'); if(badge){badge.textContent='ESP32 UNAVAILABLE';badge.className='status-pill';}
    console.warn('Relay status:',error);
  }
}

async function setRelayFromDashboard(number,on){
  const toggle=$('relay'+number+'Toggle');
  if(toggle) toggle.disabled=true;
  try{
    const params=new URLSearchParams({relay:String(number),state:on?'on':'off'});
    const response=await fetch('/api/relay?'+params.toString(),{method:'POST',cache:'no-store'});
    const result=await response.json();
    if(!response.ok || !result.ok) throw new Error(result.error||'Relay command failed');
    showToast('Relay '+number+' '+(on?'ON':'OFF'));
    await refreshRelayStatus();
    await refreshLocalRelayHistory();
  }catch(error){
    console.error('Relay command failed:',error);
    showToast('Unable to control relay. Check ESP32 connection.');
    await refreshRelayStatus();
  }finally{if(toggle) toggle.disabled=false;}
}

async function refreshLocalRelayHistory(){
  const body=$('relayHistoryBody'); if(!body) return;
  try{
    const response=await fetch('/api/relay-history',{cache:'no-store'});
    if(!response.ok) throw new Error('History unavailable');
    const rows=await response.json();
    if(!rows.length){body.innerHTML='<tr><td colspan="5" class="empty">No relay activity recorded yet.</td></tr>';return;}
    body.innerHTML=rows.slice(-30).reverse().map(r=>{
      const state=String(r.state||'').toUpperCase();
      return `<tr><td>${escapeRelayText(r.date||'')}</td><td>${escapeRelayText(r.time||'')}</td><td>${escapeRelayText(r.relay||'')}</td><td><span class="status-pill ${state==='ON'?'running':''}">${escapeRelayText(state)}</span></td><td>${escapeRelayText(r.source||'')}</td></tr>`;
    }).join('');
  }catch(error){body.innerHTML='<tr><td colspan="5" class="empty">Unable to load ESP32 local relay history.</td></tr>';console.warn(error);}
}
function escapeRelayText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initializeRelayControls(){
  [1,2].forEach(n=>{const toggle=$('relay'+n+'Toggle');if(toggle)toggle.addEventListener('change',()=>setRelayFromDashboard(n,toggle.checked));});
  const refresh=$('refreshRelayHistory');if(refresh)refresh.addEventListener('click',refreshLocalRelayHistory);
  refreshRelayStatus();refreshLocalRelayHistory();
  setInterval(refreshRelayStatus,3000);
  setInterval(refreshLocalRelayHistory,10000);
}

// ============================================================
// PIR MOTION HISTORY
// Primary source: Firebase SmartStorage/motion/history (newest 30).
// Fallback: ESP32 local LittleFS history via /api/motion-history.
// ============================================================
const MOTION_HISTORY_PATH="SmartStorage/motion/history";
let motionLocalPollStarted=false;

function renderMotionHistory(rows){
  const body=$('motionHistoryBody'); if(!body) return;
  if(!rows.length){body.innerHTML='<tr><td colspan="4" class="empty">No motion events recorded yet.</td></tr>';return;}
  body.innerHTML=rows.slice(-30).reverse().map(r=>{
    const p=timestampParts(r.timestamp,r.date,r.time);
    const label=r.event==='motion_detected'?'Motion detected':String(r.event||'Motion');
    const state=String(r.state||'ON').toUpperCase();
    return `<tr><td>${escapeHTML(p.date)}</td><td>${escapeHTML(p.time)}</td><td>${escapeHTML(label)}</td><td><span class="status-pill ${state==='ON'?'warning':''}">${escapeHTML(state)}</span></td></tr>`;
  }).join('');
}

async function loadLocalMotionHistory(){
  const body=$('motionHistoryBody');
  try{
    const response=await fetch('/api/motion-history',{cache:'no-store'});
    if(!response.ok) throw new Error('ESP32 motion history unavailable');
    renderMotionHistory(await response.json());
  }catch(error){
    console.warn('PIR history (local):',error);
    if(body) body.innerHTML='<tr><td colspan="4" class="empty">Unable to load PIR motion history.</td></tr>';
  }
}

function startLocalMotionPolling(){
  loadLocalMotionHistory();
  if(!motionLocalPollStarted){motionLocalPollStarted=true;setInterval(loadLocalMotionHistory,10000);}
}

async function loadMotionHistoryOnce(){
  try{
    await ensureFirebaseAuth();
    const snap=await database.ref(MOTION_HISTORY_PATH).limitToLast(30).once('value');
    const rows=[]; snap.forEach(child=>{rows.push(child.val()||{});});
    renderMotionHistory(rows);
  }catch(error){
    console.warn('PIR history (Firebase) failed, using ESP32 local history:',error);
    await loadLocalMotionHistory();
  }
}

async function initializeMotionHistory(){
  const refresh=$('refreshMotionHistory');
  if(refresh) refresh.addEventListener('click',loadMotionHistoryOnce);
  try{
    await ensureFirebaseAuth();
    database.ref(MOTION_HISTORY_PATH).limitToLast(30).on('value',snapshot=>{
      const rows=[]; snapshot.forEach(child=>{rows.push(child.val()||{});});
      renderMotionHistory(rows);
    },error=>{
      console.warn('Firebase PIR history unavailable, using ESP32 local history:',error);
      startLocalMotionPolling();
    });
  }catch(error){
    console.warn('Firebase auth failed for PIR history:',error);
    startLocalMotionPolling();
  }
}
