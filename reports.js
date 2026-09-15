let reportRows=[];
let environmentChart=null;

function selectedReportRows(){
  const date=$("reportDate").value;
  return sortNewest(date ? reportRows.filter(r=>dateFor(r.data)===date) : reportRows);
}

function dateFor(d){
  return String(d.date || String(d.timestamp||"").slice(0,10));
}

function updateMetrics(rows){
  const temps=rows.map(r=>getTemperature(r.data)).filter(Number.isFinite);
  const hums=rows.map(r=>getHumidity(r.data)).filter(Number.isFinite);

  $("totalRecords").textContent=rows.length;
  $("avgTemperature").textContent=temps.length?(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(2)+" °C":"--";
  $("avgHumidity").textContent=hums.length?(hums.reduce((a,b)=>a+b,0)/hums.length).toFixed(2)+" %":"--";
  $("minTemperature").textContent=temps.length?Math.min(...temps).toFixed(2)+" °C":"--";
  $("maxTemperature").textContent=temps.length?Math.max(...temps).toFixed(2)+" °C":"--";
  $("humidityRange").textContent=hums.length?`${Math.min(...hums).toFixed(1)}–${Math.max(...hums).toFixed(1)} %`:"--";

  const date=$("reportDate").value;
  $("reportSummary").textContent=rows.length
    ? `Analysis contains ${rows.length} DHT11 reading${rows.length===1?"":"s"}${date?" for "+date:" across all available dates"}.`
    : "No DHT11 readings are available for the selected date.";
}

function makeChartData(rows){
  const ordered=rows.slice().sort((a,b)=>{
    const ta=String(a.data.timestamp||`${a.data.date||""} ${a.data.time||""}`);
    const tb=String(b.data.timestamp||`${b.data.date||""} ${b.data.time||""}`);
    return ta.localeCompare(tb);
  });

  const selectedDate=$("reportDate")?.value || "";
  return {
    labels:ordered.map(r=>{
      const d=r.data||{};
      const p=timestampParts(d.timestamp,d.date,d.time);
      return selectedDate ? p.time : `${p.date} ${p.time}`;
    }),
    temps:ordered.map(r=>getTemperature(r.data)),
    hums:ordered.map(r=>getHumidity(r.data)),
    sessions:ordered.map(r=>r.data?.newSession===true)
  };
}

function renderCharts(rows){
  const canvas=$("environmentChart");
  if(!canvas)return;
  if(environmentChart)environmentChart.destroy();

  const c=makeChartData(rows);

  environmentChart=new Chart(canvas,{
    type:"line",
    data:{
      labels:c.labels,
      datasets:[
        {
          label:"Temperature (°C)",
          data:c.temps,
          borderColor:"#d94b35",
          backgroundColor:"rgba(217,75,53,.10)",
          tension:.12,
          spanGaps:true,
          pointRadius:2.5,
          pointHoverRadius:5,
          borderWidth:2.5
        },
        {
          label:"Humidity (%)",
          data:c.hums,
          borderColor:"#3158c8",
          backgroundColor:"rgba(49,88,200,.10)",
          tension:.12,
          spanGaps:true,
          pointRadius:2.5,
          pointHoverRadius:5,
          borderWidth:2.5
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      animation:{duration:500},
      plugins:{
        legend:{display:true,position:"top",labels:{usePointStyle:true,boxWidth:10}},
        tooltip:{
          enabled:true,
          callbacks:{
            title:(items)=>items.length ? c.labels[items[0].dataIndex] : "",
            afterTitle:(items)=>{
              const i=items.length?items[0].dataIndex:-1;
              return i>=0 && c.sessions[i] ? "NEW RECORDING SESSION" : "";
            }
          }
        }
      },
      scales:{
        x:{
          grid:{display:true},
          ticks:{maxRotation:45,minRotation:0,autoSkip:true,maxTicksLimit:18}
        },
        y:{
          min:0,
          max:100,
          title:{display:true,text:"Temperature / Humidity"},
          ticks:{stepSize:10}
        }
      }
    }
  });
}

function updateReport(){
  const rows=selectedReportRows();
  updateMetrics(rows);
  renderCharts(rows);
}

function csvEscape(v){
  return `"${String(v??"").replace(/"/g,'""')}"`;
}

function exportCSV(){
  const rows=selectedReportRows();
  if(!rows.length){alert("No readings available to export.");return;}
  let csv="Date,Time,Temperature (C),Humidity (%),Record Number,New Session,Session ID\n";
  rows.forEach(r=>{
    const d=r.data||{};
    csv+=[d.date,d.time,getTemperature(d),getHumidity(d),d.recordNumber,d.newSession?"Yes":"No",d.sessionId||""]
      .map(csvEscape).join(",")+"\n";
  });
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="SmartStorage_DHT11_Report.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function initializeReports(){
  try{
    await ensureFirebaseAuth();
    reportRows=await readAllRecords();
    updateReport();

    subscribeHistory(rows=>{
      reportRows=rows;
      updateReport();
    });

    $("reportDate").addEventListener("change",updateReport);
    $("reportToday").onclick=()=>{
      const d=new Date();
      const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
      $("reportDate").value=local;
      updateReport();
    };
    $("reportAll").onclick=()=>{
      $("reportDate").value="";
      updateReport();
    };
    $("exportCSV").onclick=exportCSV;
  }catch(error){
    console.error(error);
    $("reportSummary").textContent="Unable to load Firebase analytics.";
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  bindFirebaseStatus();
  initializeReports();
});
