document.addEventListener("DOMContentLoaded",async()=>{
  bindFirebaseStatus();
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