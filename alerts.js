document.addEventListener("DOMContentLoaded",async()=>{
  bindFirebaseStatus();
  try{
    await ensureFirebaseAuth();
    database.ref(DB_PATHS.status).on("value",snapshot=>{
      const s=snapshot.val()||{};
      const el=$("sensorAlert");
      if(s.sensorConnected===true){
        el.className="notice ok";
        el.innerHTML="🟢 <b>DHT11 is responding.</b> The ESP32 is connected and reporting readings.";
      }else{
        el.className="notice warning";
        el.innerHTML="🟡 <b>Waiting for DHT11 reading.</b> Check the sensor wiring if this continues.";
      }
    });
    database.ref(DB_PATHS.current).on("value",snapshot=>{
      const d=snapshot.val();
      const el=$("dataAlert");
      if(!d || !Number.isFinite(getTemperature(d)) || !Number.isFinite(getHumidity(d))){
        el.className="notice warning";
        el.textContent="No valid DHT11 reading has been received yet.";
        $("alertTemperature").textContent="--";
        $("alertHumidity").textContent="--";
        $("alertTimestamp").textContent="--";
        return;
      }
      const p=timestampParts(d.timestamp,d.date,d.time);
      el.className="notice ok";
      el.innerHTML=`🟢 Latest DHT11 reading received at <b>${escapeHTML(p.date)} ${escapeHTML(p.time)}</b>.`;
      $("alertTemperature").textContent=formatFloat(getTemperature(d))+" °C";
      $("alertHumidity").textContent=formatFloat(getHumidity(d))+" %";
      $("alertTimestamp").textContent=`${p.date} ${p.time}`;
    });
  }catch(e){console.error(e);}
});