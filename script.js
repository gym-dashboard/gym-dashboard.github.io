/*******************************************
 * script.js
 * 
 * Steps:
 *  1) We center the entire chart (SVG) in #chartContainer 
 *     using .d-flex justify-content-center (Bootstrap).
 *  2) We compute the squares' total width (squaresWidth).
 *  3) We measure #chartContainer’s width (the space used).
 *  4) Because the chart is centered, the squares start 
 *     at offsetX = (containerWidth - chartWidth)/2 + marginObj.left.
 *  5) We place #plotContainer with that offsetX, 
 *     and set its width to squaresWidth. 
 *  6) We set #sliderWrapper to 75% of squaresWidth, 
 *     so the slider is narrower and is also centered with margin: 0 auto.
 ********************************************/

// 1) Configuration
const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Bicep", "Tricep"];
const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Data structure: yearData[year][month] => array of 31*muscleGroups
// Each: { day, muscle, volume }
let yearData = {};

// Default to current year & month
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0..11

// 2) DOM references
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");
const plotContainer = document.getElementById("plotContainer");
const sliderWrapper = document.getElementById("sliderWrapper");
const monthSlider = document.getElementById("monthSlider");
const sliderLabel = document.getElementById("sliderLabel");

// 3) Populate <select> for year
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

// 4) Event listeners

yearSelect.addEventListener("change", () => {
  currentYear = +yearSelect.value;
  if (!yearData[currentYear]) {
    loadDataForYear(currentYear).then(() => {
      drawMonthChart(currentYear, currentMonth);
      updateSliderLabelPosition();
    });
  } else {
    drawMonthChart(currentYear, currentMonth);
    updateSliderLabelPosition();
  }
});

monthSlider.addEventListener("input", () => {
  let val = +monthSlider.value; // 1..12
  currentMonth = val - 1;
  drawMonthChart(currentYear, currentMonth);
  updateSliderLabelPosition();
});

// 5) loadDataForYear
async function loadDataForYear(year) {
  // Initialize
  yearData[year] = new Array(12).fill(null).map(() => []);
  
  // For each month, define 31 * muscleGroups
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= 31; d++) {
      muscleGroups.forEach(mg => {
        yearData[year][m].push({ day: d, muscle: mg, volume: 0 });
      });
    }
  }
  
  // Load day by day
  let startDate = new Date(year, 0, 1);
  let endDate = new Date(year, 11, 31);
  
  for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
    let dd = String(dt.getDate()).padStart(2, "0");
    let mm = String(dt.getMonth() + 1).padStart(2, "0");
    let yyyy = dt.getFullYear();
    let fileName = `data/${dd}-${mm}-${yyyy}.json`;
    
    try {
      let json = await d3.json(fileName);
      if (json && json.workout) {
        let volumeMap = {};
        muscleGroups.forEach(mg => volumeMap[mg] = 0);
        
        json.workout.forEach(entry => {
          let mg = entry["Muscle-Group"] || "Unknown";
          if (muscleGroups.includes(mg)) {
            let reps = +entry.Reps || 0;
            let weight = parseFloat(entry.Weight) || 0;
            volumeMap[mg] += reps * weight;
          }
        });
        
        let mIndex = dt.getMonth();
        let dIndex = dt.getDate();
        let offset = (dIndex - 1) * muscleGroups.length;
        muscleGroups.forEach((mg, i) => {
          yearData[year][mIndex][offset + i].volume = volumeMap[mg];
        });
      }
    } catch (err) {
      // Missing => volume=0
    }
  }
  
  // Mark days beyond real month length => volume=null
  for (let m = 0; m < 12; m++) {
    let daysInMonth = new Date(year, m+1, 0).getDate();
    for (let d = daysInMonth+1; d <= 31; d++) {
      let off = (d - 1) * muscleGroups.length;
      for (let i = 0; i < muscleGroups.length; i++) {
        yearData[year][m][off + i].volume = null;
      }
    }
  }
}

// 6) drawMonthChart
function drawMonthChart(year, month) {
  chartContainer.innerHTML = ""; // clear old
  
  // Get data
  let arr = yearData[year][month];
  let maxVol = d3.max(arr, d => d.volume === null ? 0 : d.volume) || 0;
  
  // Color scale
  let colorScale = d3.scaleLinear()
    .domain([1, maxVol])
    .range(["#c6e48b", "#196127"])
    .clamp(true);
  
  // Dimensions
  const cellSize = 15;
  const cellGap = 4;
  const marginObj = { top: 20, right: 20, bottom: 20, left: 80 };
  const days = 31;
  const rows = muscleGroups.length;
  
  const squaresWidth = (cellSize + cellGap) * days;
  const squaresHeight = (cellSize + cellGap) * rows;
  
  const chartWidth = marginObj.left + marginObj.right + squaresWidth;
  const chartHeight = marginObj.top + marginObj.bottom + squaresHeight;
  
  // Create SVG
  let svg = d3.select(chartContainer)
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight);
  
  let g = svg.append("g")
    .attr("transform", `translate(${marginObj.left},${marginObj.top})`);
  
  // Fill color logic
  function fillColor(d) {
    if (d.volume === null) return "none";
    if (d.volume === 0) return "#ebedf0";
    return colorScale(d.volume);
  }
  
  g.selectAll("rect.cell")
    .data(arr)
    .join("rect")
      .attr("class", "cell")
      .attr("x", (d, i) => {
        let dayIndex = Math.floor(i / muscleGroups.length);
        return dayIndex * (cellSize + cellGap);
      })
      .attr("y", (d, i) => {
        let muscleIndex = i % muscleGroups.length;
        return muscleIndex * (cellSize + cellGap);
      })
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", fillColor);
  
  // X-axis
  let xScale = d3.scaleBand()
    .domain(d3.range(1, 32).map(String))
    .range([0, squaresWidth]);
  
  let xAxis = d3.axisTop(xScale)
    .tickValues(xScale.domain().filter((d, i) => i % 2 === 0))
    .tickSize(0);
  
  g.append("g")
    .call(xAxis)
    .attr("font-size", 9)
    .call(g => g.select(".domain").remove());
  
  // Y-axis
  let yScale = d3.scaleBand()
    .domain(muscleGroups)
    .range([0, squaresHeight]);
  
  let yAxis = d3.axisLeft(yScale).tickSize(0);
  
  g.append("g")
    .call(yAxis)
    .attr("font-size", 10)
    .call(g => g.select(".domain").remove());
  
  // ---- Now line up the slider container (#plotContainer) under the squares ----
  // 1) We measure the container's width. The chart is centered in it.
  let containerWidth = chartContainer.getBoundingClientRect().width;
  
  // 2) The chart is centered => squares start at offset:
  //    offsetX = (containerWidth - chartWidth)/2 + marginObj.left
  //    i.e. half leftover + left margin
  let offsetX = (containerWidth - chartWidth)/2 + marginObj.left;
  if (offsetX < 0) offsetX = 0; // in case container is smaller
  
  // 3) #plotContainer gets left margin => offsetX
  plotContainer.style.marginLeft = offsetX + "px";
  
  // 4) #plotContainer width => squaresWidth (just the squares)
  plotContainer.style.width = squaresWidth + "px";
  
  // 5) #sliderWrapper => 75% of squaresWidth, centered by margin: 0 auto;
  sliderWrapper.style.width = (squaresWidth * 0.75) + "px";
}

// 7) updateSliderLabelPosition
function updateSliderLabelPosition() {
  let sliderVal = +monthSlider.value; // 1..12
  let monthName = monthNames[sliderVal - 1];
  sliderLabel.textContent = monthName;
  
  const min = +monthSlider.min;
  const max = +monthSlider.max;
  const fraction = (sliderVal - min) / (max - min);
  
  const sliderWidth = monthSlider.offsetWidth;
  const labelWidth = sliderLabel.offsetWidth;
  
  let xPos = fraction * sliderWidth - (labelWidth / 2);
  sliderLabel.style.transform = `translateX(${xPos}px)`;
}

// 8) init
(async function init() {
  if (!yearData[currentYear]) {
    await loadDataForYear(currentYear);
  }
  monthSlider.value = (currentMonth + 1).toString();
  drawMonthChart(currentYear, currentMonth);
  updateSliderLabelPosition();
})();
