async function loadEmailSettings(){
  const message=$("emailSettingsMessage");
  try{
    const response=await fetch("/api/email-settings",{cache:"no-store"});
    if(!response.ok) throw new Error("ESP32 email settings endpoint not found");
    const data=await response.json();
    $("alertRecipient").value=data.recipient||"";
    $("temperatureThreshold").value=Number(data.threshold??25).toFixed(1);
    $("emailAlertsEnabled").checked=!!data.enabled;
    $("emailSenderStatus").textContent=data.senderConfigured
      ?"Sender account configured in email_config.h."
      :"Sender account NOT configured. Edit email_config.h before compiling.";
    if(message) message.textContent="Email settings loaded from the ESP32.";
  }catch(error){
    console.error(error);
    if(message) message.textContent="Could not load settings. Open this page using the ESP32 IP address (not VS Code Live Server).";
  }
}

async function saveEmailSettings(event){
  event.preventDefault();
  const message=$("emailSettingsMessage");
  const params=new URLSearchParams({
    recipient:$("alertRecipient").value.trim(),
    threshold:$("temperatureThreshold").value,
    enabled:$("emailAlertsEnabled").checked?"true":"false"
  });
  try{
    const response=await fetch("/api/email-settings",{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:params.toString()
    });
    const data=await response.json();
    if(!response.ok || !data.ok) throw new Error(data.error||"Unable to save email settings");
    if(message) message.textContent="Email settings saved successfully on the ESP32.";
    showToast("Email alert settings saved.");
  }catch(error){
    console.error(error);
    if(message) message.textContent=error.message+" Open this page from the ESP32 IP address.";
  }
}

async function sendTemperatureAlert(){
  const message=$("emailSettingsMessage");
  const button=$("sendTemperatureAlert");
  button.disabled=true;
  try{
    const response=await fetch("/api/email-alert-now",{method:"POST"});
    const data=await response.json();
    if(!response.ok || !data.ok) throw new Error(data.error||"Temperature alert email could not be sent.");
    if(message) message.textContent="Temperature alert email sent. Check the recipient inbox and spam folder.";
    showToast("Temperature alert email sent.");
  }catch(error){
    console.error(error);
    if(message) message.textContent=error.message;
  }finally{
    button.disabled=false;
  }
}

document.addEventListener("DOMContentLoaded",async()=>{
  bindFirebaseStatus();
  $("emailSettingsForm").addEventListener("submit",saveEmailSettings);
  $("sendTemperatureAlert").addEventListener("click",sendTemperatureAlert);
  loadEmailSettings();
  try{
    await ensureFirebaseAuth();

    database.ref(DB_PATHS.status).on("value",snapshot=>{
      const s=snapshot.val()||{};
      $("wifiState").textContent=s.wifiConnected?"CONNECTED":"DISCONNECTED";
      $("espIP").textContent=s.ip||"--";
      $("hostname").textContent=s.hostname||"smartstorage.local";
    });

    $("clearAll").onclick=async()=>{
      if(!confirm("Delete all DHT11 history records? This cannot be undone."))return;
      try{
        await database.ref(DB_PATHS.history).remove();
        await database.ref(DB_PATHS.recordCount).set(0);
        const ip=await getEspIP();
        if(ip) fetch(`http://${ip}/api/clear-history`,{mode:"no-cors"}).catch(()=>{});
        showToast("History cleared.");
      }catch(error){
        console.error(error);
        alert("Unable to clear history. Check Firebase Database Rules.");
      }
    };
  }catch(e){console.error(e);}
});

async function getEspIP(){
  return new Promise(resolve=>{
    database.ref(DB_PATHS.status).once("value").then(s=>resolve((s.val()||{}).ip||"")).catch(()=>resolve(""));
  });
}
