/***********************************************
 * script.js
 * 
 * 1) Load data for each day from data/DD-MM-YYYY.json
 * 2) drawMonthChart => 31 columns x 6 muscle groups
 * 3) Horizontal timeline is below the chart:
 *    - Only shows a subset of months at a time
 *    - "Prev" / "Next" switch which chunk of months is visible
 *    - Clicking a month => updates chart
 **********************************************/

// ---- Calendar Config ----
const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Bicep", "Tricep"];
const monthNames = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

// yearData[year][monthIndex] => array of 31 * muscleGroups
let yearData = {};
let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth(); // 0..11

// DOM
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");
const timelinePrevBtn = document.getElementById("timelinePrevBtn");
const timelineNextBtn = document.getElementById("timelineNextBtn");
const timelineMonthsDiv = document.getElementById("timelineMonths");

// 1) Populate year select
function populateYearSelect() {
  const years = [2023, 2024, 2025, 2026];
  years.forEach(yr => {
    let opt = document.createElement("option");
    opt.value = yr;
    opt.textContent = yr;
    yearSelect.appendChild(opt);
  });
  yearSelect.value = currentYear;
}
populateYearSelect();

yearSelect.addEventListener("change", () => {
  currentYear = +yearSelect.value;
  if (!yearData[currentYear]) {
    loadDataForYear(currentYear).then(() => {
      drawMonthChart(currentYear, currentMonthIndex);
    });
  } else {
    drawMonthChart(currentYear, currentMonthIndex);
  }
});

// 2) loadDataForYear
async function loadDataForYear(year) {
  yearData[year] = new Array(12).fill(null).map(() => []);

  // fill each month with 31*g
  for (let m=0; m<12; m++){
    for (let d=1; d<=31; d++){
      muscleGroups.forEach(mg => {
        yearData[year][m].push({ day:d, muscle: mg, volume:0 });
      });
    }
  }

  // load from data/...
  let startDate = new Date(year, 0,1);
  let endDate = new Date(year,11,31);

  for(let dt=new Date(startDate); dt<=endDate; dt.setDate(dt.getDate()+1)){
    let dd=String(dt.getDate()).padStart(2,"0");
    let mm=String(dt.getMonth()+1).padStart(2,"0");
    let yyyy=dt.getFullYear();
    let fileName=`data/${dd}-${mm}-${yyyy}.json`;

    try {
      let json=await d3.json(fileName);
      if(json && json.workout){
        let volumeMap={};
        muscleGroups.forEach(mg => volumeMap[mg]=0);

        json.workout.forEach(entry=>{
          let mg=entry["Muscle-Group"]||"Unknown";
          if(muscleGroups.includes(mg)){
            let reps=+entry.Reps||0;
            let weight=parseFloat(entry.Weight)||0;
            volumeMap[mg]+=reps*weight;
          }
        });

        let monIdx=dt.getMonth();
        let dayIdx=dt.getDate();
        let offset=(dayIdx-1)*muscleGroups.length;
        muscleGroups.forEach((mg,i)=>{
          yearData[year][monIdx][offset+i].volume=volumeMap[mg];
        });
      }
    } catch(err){
      // missing => volume=0
    }
  }

  // days beyond real month => volume=null
  for(let m=0;m<12;m++){
    let dim=new Date(year,m+1,0).getDate();
    for(let d=dim+1; d<=31; d++){
      let off=(d-1)*muscleGroups.length;
      for(let i=0;i<muscleGroups.length;i++){
        yearData[year][m][off+i].volume=null;
      }
    }
  }
}

// 3) drawMonthChart
function drawMonthChart(year, monthIndex){
  chartContainer.innerHTML="";

  if(!yearData[year]) return;
  let arr=yearData[year][monthIndex];
  let maxVol=d3.max(arr,d=>d.volume===null?0:d.volume)||0;

  let colorScale=d3.scaleLinear()
    .domain([1,maxVol])
    .range(["#c6e48b","#196127"])
    .clamp(true);

  const cellSize=15, cellGap=4;
  const margin={ top:20,right:20,bottom:20,left:80 };
  const days=31, rows=muscleGroups.length;

  const squaresWidth=(cellSize+cellGap)*days;
  const squaresHeight=(cellSize+cellGap)*rows;
  const chartWidth=margin.left+margin.right+squaresWidth;
  const chartHeight=margin.top+margin.bottom+squaresHeight;

  let svg=d3.select("#chartContainer")
    .append("svg")
    .attr("width",chartWidth)
    .attr("height",chartHeight);

  let g=svg.append("g")
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

  // X-axis
  let xScale=d3.scaleBand()
    .domain(d3.range(1,32).map(String))
    .range([0,squaresWidth]);
  let xAxis=d3.axisTop(xScale)
    .tickValues(xScale.domain().filter((_,i)=>i%2===0))
    .tickSize(0);

  g.append("g")
    .call(xAxis)
    .attr("font-size",9)
    .call(g=>g.select(".domain").remove());

  // Y-axis
  let yScale=d3.scaleBand()
    .domain(muscleGroups)
    .range([0,squaresHeight]);
  let yAxis=d3.axisLeft(yScale).tickSize(0);

  g.append("g")
    .call(yAxis)
    .attr("font-size",10)
    .call(g=>g.select(".domain").remove());
}

// 4) Timeline with "paged" months
// We'll define a 12-month array for the chosen year, but we only show a chunk at a time.
let timelineStart=0; // index of first displayed month in [0..11]
let selectedMonthIndex=0; // which month is selected? e.g. 0=Jan

// The months array for the timeline
// We'll update it if you want to show a different year label, but for now let's keep year=2025 in data-date
// Actually, let's store the "monthIndex" 0..11 and label them "Jan..Dec"
let timelineMonths = monthNames.map((name, i) => {
  return { label: name, monthIndex: i }; // no year stored here; we rely on currentYear
});

// We'll show a variable # of months per page (6 on large screens, 3 on small).
function getMonthsPerPage() {
  // simple approach: if window width >= 768 => 6, else 3
  if(window.innerWidth>=768) return 6;
  else return 3;
}

// Render the subset of months in [timelineStart..(timelineStart+ monthsPerPage-1)]
function renderTimeline() {
  // clamp timelineStart so it doesn't exceed 0..(12-monthsPerPage)
  const mpp=getMonthsPerPage();
  const maxStart=12-mpp;
  if(timelineStart<0) timelineStart=0;
  if(timelineStart>maxStart) timelineStart=maxStart;

  // clear
  timelineMonthsDiv.innerHTML="";

  // slice the array
  let visibleMonths=timelineMonths.slice(timelineStart, timelineStart+mpp);

  visibleMonths.forEach(mObj => {
    let btn=document.createElement("button");
    btn.textContent=mObj.label;
    // if selected
    if(mObj.monthIndex===selectedMonthIndex) {
      btn.classList.add("selectedMonth");
    }
    btn.addEventListener("click", ()=>{
      // on click => update chart
      selectedMonthIndex=mObj.monthIndex;
      drawMonthChart(currentYear, selectedMonthIndex);
      renderTimeline(); // re-render to highlight new selected
    });
    timelineMonthsDiv.appendChild(btn);
  });

  // disable prev if timelineStart=0
  timelinePrevBtn.disabled=(timelineStart<=0);
  // disable next if timelineStart >= 12-mpp
  timelineNextBtn.disabled=(timelineStart>=maxStart);
}

// handle prev/next
timelinePrevBtn.addEventListener("click", ()=>{
  timelineStart-=getMonthsPerPage();
  renderTimeline();
});
timelineNextBtn.addEventListener("click", ()=>{
  timelineStart+=getMonthsPerPage();
  renderTimeline();
});

// on resize => recalc months per page, clamp, re-render
window.addEventListener("resize", ()=>{
  let oldMPP=getMonthsPerPage();
  // re-render
  renderTimeline();
});

// 5) Initialization
(async function init(){
  // load currentYear if needed
  if(!yearData[currentYear]) {
    await loadDataForYear(currentYear);
  }
  // draw chart for currentMonthIndex
  drawMonthChart(currentYear, currentMonthIndex);

  // set timelineStart=0 if the user is in the first half or 6 if the user is in the second half
  // but let's just keep it 0 for now
  timelineStart=0;
  selectedMonthIndex=currentMonthIndex;
  renderTimeline();
})();
