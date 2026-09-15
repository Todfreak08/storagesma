function $(id){return document.getElementById(id)}

function escapeHTML(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function timestampParts(ts,date,time){
  if(date || time) return {date:String(date||"--"),time:String(time||"--")};
  const s=String(ts||"");
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)){
    return {date:s.slice(0,10),time:s.slice(11)};
  }
  return {date:"--",time:s||"--"};
}

function showToast(message){
  const t=$("toast");
  if(!t)return;
  t.textContent=message;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2600);
}

function setFirebaseStatus(online){
  const el=$("firebaseStatus");
  if(!el)return;
  el.textContent=online?"🟢 Firebase Connected":"🔴 Firebase Disconnected";
  el.className="connection "+(online?"online":"offline");
}

function bindFirebaseStatus(){
  database.ref(".info/connected").on("value",s=>{
    setFirebaseStatus(s.val()===true);
  });
}

function formatFloat(v){
  const n=Number(v);
  return Number.isFinite(n)?n.toFixed(2):"--";
}

function getTemperature(d){
  const temperature=Number(d?.temperature);
  return Number.isFinite(temperature) ? temperature : NaN;
}

function getHumidity(d){
  const humidity=Number(d?.humidity);
  return Number.isFinite(humidity) ? humidity : NaN;
}

function formatRecord(key,d){
  const p=timestampParts(d.timestamp,d.date,d.time);
  return `<tr>
    <td>${escapeHTML(p.date)}</td>
    <td>${escapeHTML(p.time)}</td>
    <td>${escapeHTML(formatFloat(getTemperature(d)))} °C</td>
    <td>${escapeHTML(formatFloat(getHumidity(d)))} %</td>
    <td>${escapeHTML(d.recordNumber ?? "--")}</td>
  </tr>`;
}

async function ensureFirebaseAuth(){
  if(firebase.auth().currentUser) return firebase.auth().currentUser;
  if(typeof firebaseAuthReady !== "undefined") return await firebaseAuthReady;
  const result=await firebase.auth().signInAnonymously();
  return result.user;
}

function readAllRecords(){
  return database.ref(DB_PATHS.history).once("value").then(snapshot=>{
    const rows=[];
    snapshot.forEach(child=>{
      rows.push({key:child.key,data:child.val()||{}});
    });
    return rows;
  });
}

function subscribeHistory(callback){
  database.ref(DB_PATHS.history).on("value",snapshot=>{
    const rows=[];
    snapshot.forEach(child=>{
      rows.push({key:child.key,data:child.val()||{}});
    });
    callback(rows);
  },error=>{
    console.error("Firebase history listener:",error);
    callback([]);
  });
}

function sortNewest(rows){
  return rows.slice().sort((a,b)=>{
    const ta=String(a.data.timestamp||`${a.data.date||""} ${a.data.time||""}`);
    const tb=String(b.data.timestamp||`${b.data.date||""} ${b.data.time||""}`);
    return tb.localeCompare(ta);
  });
}
