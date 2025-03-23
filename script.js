/***********************************************
 * script.js
 *
 * 1) Load day-by-day data => yearData[year][monthIndex].
 * 2) drawMonthChart => GitHub squares for chosen month.
 * 3) The timeline below shows a chunk of months (5 on large screens, 3 on small). 
 *    - The selected month is placed in the center if possible.
 *    - If user picks near Jan or Dec, we pin left or right so we never go past the range [0..11].
 *    - No partial months are rendered; only exactly 5 or 3 months in the DOM at once.
 * 4) Prev/Next shift the selected month by ±1 (not the chunk). 
 *    The chunk is recomputed so the selected month is centered if possible.
 **********************************************/

// ----- Calendar config
const muscleGroups = ["Chest","Back","Legs","Shoulders","Bicep","Tricep"];
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let yearData = {};
let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth(); // 0..11

// DOM
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");
const timelinePrevBtn = document.getElementById("timelinePrevBtn");
const timelineNextBtn = document.getElementById("timelineNextBtn");
const timelineMonthsDiv = document.getElementById("timelineMonths");

// Timeline state
let selectedMonthIndex = 0; // which month is selected
let chunkStartIndex = 0; // first month in the chunk

// ========== 1) Populate Year Select ==========
function populateYearSelect() {
  const years=[2023,2024,2025,2026];
  years.forEach(yr=>{
    const opt=document.createElement("option");
    opt.value=yr;
    opt.textContent=yr;
    yearSelect.appendChild(opt);
  });
  yearSelect.value=currentYear;
}
populateYearSelect();

yearSelect.addEventListener("change",()=>{
  currentYear=+yearSelect.value;
  if(!yearData[currentYear]){
    loadDataForYear(currentYear).then(()=>{
      drawMonthChart(currentYear, currentMonthIndex);
      renderTimeline(); 
    });
  } else {
    drawMonthChart(currentYear, currentMonthIndex);
    renderTimeline();
  }
});

// ========== 2) Load Data For a Year ==========
async function loadDataForYear(year){
  yearData[year]=new Array(12).fill(null).map(()=>[]);
  // fill
  for(let m=0;m<12;m++){
    for(let d=1;d<=31;d++){
      muscleGroups.forEach(mg=>{
        yearData[year][m].push({day:d,muscle:mg,volume:0});
      });
    }
  }
  // load day-by-day
  let start=new Date(year,0,1);
  let end=new Date(year,11,31);
  for(let dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
    const dd=String(dt.getDate()).padStart(2,"0");
    const mm=String(dt.getMonth()+1).padStart(2,"0");
    const yyyy=dt.getFullYear();
    const fileName=`data/${dd}-${mm}-${yyyy}.json`;
    try{
      const json=await d3.json(fileName);
      if(json && json.workout){
        let volumeMap={};
        muscleGroups.forEach(mg=>volumeMap[mg]=0);
        json.workout.forEach(entry=>{
          const mg=entry["Muscle-Group"]||"Unknown";
          if(muscleGroups.includes(mg)){
            const reps=+entry.Reps||0;
            const weight=parseFloat(entry.Weight)||0;
            volumeMap[mg]+=reps*weight;
          }
        });
        const monIdx=dt.getMonth();
        const dayIdx=dt.getDate();
        const off=(dayIdx-1)*muscleGroups.length;
        muscleGroups.forEach((mg,i)=>{
          yearData[year][monIdx][off+i].volume=volumeMap[mg];
        });
      }
    } catch(err){
      // missing => volume=0
    }
  }
  // days beyond real month => null
  for(let m=0;m<12;m++){
    const dim=new Date(year,m+1,0).getDate();
    for(let d=dim+1; d<=31; d++){
      const off=(d-1)*muscleGroups.length;
      for(let i=0;i<muscleGroups.length;i++){
        yearData[year][m][off+i].volume=null;
      }
    }
  }
}

// ========== 3) Draw Calendar Plot ==========
function drawMonthChart(year, monthIndex){
  chartContainer.innerHTML="";
  if(!yearData[year]) return;
  const arr=yearData[year][monthIndex];
  const maxVol=d3.max(arr,d=>d.volume===null?0:d.volume)||0;

  const colorScale=d3.scaleLinear()
    .domain([1,maxVol])
    .range(["#c6e48b","#196127"])
    .clamp(true);

  const cellSize=15, cellGap=4;
  const margin={top:20,right:20,bottom:20,left:80};
  const days=31, rows=muscleGroups.length;

  const squaresWidth=(cellSize+cellGap)*days;
  const squaresHeight=(cellSize+cellGap)*rows;
  const chartWidth=margin.left+margin.right+squaresWidth;
  const chartHeight=margin.top+margin.bottom+squaresHeight;

  const svg=d3.select("#chartContainer")
    .append("svg")
    .attr("width",chartWidth)
    .attr("height",chartHeight);

  const g=svg.append("g")
    .attr("transform",`translate(${margin.left},${margin.top})`);

  function fillColor(d){
    if(d.volume===null) return "none";
    if(d.volume===0) return "#ebedf0";
    return colorScale(d.volume);
  }

  g.selectAll("rect.cell")
    .data(arr)
    .join("rect")
      .attr("class","cell")
      .attr("x",(d,i)=>{
        let dayI=Math.floor(i/muscleGroups.length);
        return dayI*(cellSize+cellGap);
      })
      .attr("y",(d,i)=>{
        let mgI=i%muscleGroups.length;
        return mgI*(cellSize+cellGap);
      })
      .attr("width",cellSize)
      .attr("height",cellSize)
      .attr("fill",fillColor);

  // x-axis
  const xScale=d3.scaleBand()
    .domain(d3.range(1,32).map(String))
    .range([0,squaresWidth]);
  const xAxis=d3.axisTop(xScale)
    .tickValues(xScale.domain().filter((_,i)=>i%2===0))
    .tickSize(0);

  g.append("g")
    .call(xAxis)
    .attr("font-size",9)
    .call(g=>g.select(".domain").remove());

  // y-axis
  const yScale=d3.scaleBand()
    .domain(muscleGroups)
    .range([0,squaresHeight]);
  const yAxis=d3.axisLeft(yScale).tickSize(0);

  g.append("g")
    .call(yAxis)
    .attr("font-size",10)
    .call(g=>g.select(".domain").remove());
}

// ========== 4) Timeline Logic ==========

// How many months are visible? 5 if >=768px, else 3
function getVisibleCount(){
  return (window.innerWidth>=768)?5:3;
}

// We want the selected month near the "center" if possible.
function computeChunkStart(selected) {
  const visible = getVisibleCount();
  const half = Math.floor(visible/2); // center index in the chunk
  let start = selected - half;
  if(start<0) start=0; // can't go before month 0
  const maxStart = 12 - visible; // can't go beyond month 11
  if(start>maxStart) start=maxStart;
  return start;
}

// Render the chunk in #timelineMonths
function renderTimeline() {
  // Recompute chunkStart
  chunkStartIndex = computeChunkStart(selectedMonthIndex);

  // Clear
  timelineMonthsDiv.innerHTML="";

  const visible = getVisibleCount();
  const end = chunkStartIndex + visible; // not inclusive
  // create chunk
  for(let i=chunkStartIndex; i<end; i++){
    let btn=document.createElement("button");
    btn.textContent=monthNames[i];
    if(i===selectedMonthIndex){
      btn.classList.add("selectedMonth");
    }
    btn.addEventListener("click",()=>{
      selectedMonthIndex=i;
      drawMonthChart(currentYear, selectedMonthIndex);
      renderTimeline();
    });
    timelineMonthsDiv.appendChild(btn);
  }

  // enable/disable prev/next
  // If selectedMonthIndex=0 => can't go prev
  timelinePrevBtn.disabled=(selectedMonthIndex<=0);
  // If selectedMonthIndex=11 => can't go next
  timelineNextBtn.disabled=(selectedMonthIndex>=11);
}

// Prev => selectedMonthIndex--
timelinePrevBtn.addEventListener("click",()=>{
  if(selectedMonthIndex>0){
    selectedMonthIndex--;
    drawMonthChart(currentYear, selectedMonthIndex);
    renderTimeline();
  }
});

// Next => selectedMonthIndex++
timelineNextBtn.addEventListener("click",()=>{
  if(selectedMonthIndex<11){
    selectedMonthIndex++;
    drawMonthChart(currentYear, selectedMonthIndex);
    renderTimeline();
  }
});

// On resize => re-render timeline (the chunk might become 5->3 or vice versa)
window.addEventListener("resize",()=>{
  renderTimeline();
});

// ========== 5) Initialization ==========
(async function init(){
  if(!yearData[currentYear]){
    await loadDataForYear(currentYear);
  }
  selectedMonthIndex=currentMonthIndex; // start with user's real current month
  drawMonthChart(currentYear, currentMonthIndex);
  renderTimeline();
})();
