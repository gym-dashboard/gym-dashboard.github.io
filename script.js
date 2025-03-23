/***********************************************
 * script.js
 **********************************************/

// ----- Calendar config
const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Bicep", "Tricep"];
const muscleDisplayNames = {
  "Chest": "Chest",
  "Back": "Back",
  "Legs": "Legs",
  "Shoulders": "SH.",
  "Bicep": "Biceps",
  "Tricep": "Triceps"
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let yearData = {};
let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth(); // 0..11

// DOM elements
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");
const timelinePrevBtn = document.getElementById("timelinePrevBtn");
const timelineNextBtn = document.getElementById("timelineNextBtn");
const timelineMonthsDiv = document.getElementById("timelineMonths");

// Timeline state
let selectedMonthIndex = 0; // which month is selected
let chunkStartIndex = 0;    // first month in the chunk

// For updating the top bar text
function computeYearlyWorkoutCount(year) {
  let totalDaysWithWorkouts = 0;
  if (!yearData[year]) return 0;

  yearData[year].forEach(monthArr => {
    // Each day of each month
    for (let d = 1; d <= 31; d++) {
      let dayVolumeSum = 0;
      const offset = (d - 1) * muscleGroups.length;
      for (let i = 0; i < muscleGroups.length; i++) {
        const entry = monthArr[offset + i];
        if (entry && entry.volume) {
          dayVolumeSum += entry.volume;
        }
      }
      if (dayVolumeSum > 0) {
        totalDaysWithWorkouts++;
      }
    }
  });

  return totalDaysWithWorkouts;
}

function updateYearlyWorkoutCount(year) {
  const total = computeYearlyWorkoutCount(year);
  const countElem = document.getElementById("yearlyWorkoutsCount");
  // Replicating GitHub's phrasing: "X contributions in the last year"
  // But you can phrase it however you like:
  countElem.textContent = `${total} Logged Workouts in the last year`;
}

/***********************************************
 * Helper to dynamically set margins for large vs. small screens
 ***********************************************/
function getMargins() {
  if (window.innerWidth < 768) {
    // For small screens, slightly bigger margins
    return { top: 25, right: 5, bottom: 0, left: 50 };
  } else {
    // For larger screens, standard margins
    return { top: 20, right: 20, bottom: 0, left: 70 };
  }
}

/***********************************************
 * 1) Populate Year Select
 ***********************************************/
function populateYearSelect() {
  const years = [2023, 2024, 2025, 2026];
  years.forEach(yr => {
    const opt = document.createElement("option");
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
      renderTimeline();
      updateYearlyWorkoutCount(currentYear);
    });
  } else {
    drawMonthChart(currentYear, currentMonthIndex);
    renderTimeline();
    updateYearlyWorkoutCount(currentYear);
  }
});

/***********************************************
 * 2) Load Data For a Year
 ***********************************************/
async function loadDataForYear(year) {
  yearData[year] = new Array(12).fill(null).map(() => []);
  // fill each month with default objects for each day/muscle
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= 31; d++) {
      muscleGroups.forEach(mg => {
        yearData[year][m].push({ day: d, muscle: mg, volume: 0 });
      });
    }
  }
  // load day-by-day workout data
  let start = new Date(year, 0, 1);
  let end = new Date(year, 11, 31);
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const fileName = `data/${dd}-${mm}-${yyyy}.json`;
    try {
      const json = await d3.json(fileName);
      if (json && json.workout) {
        let volumeMap = {};
        muscleGroups.forEach(mg => volumeMap[mg] = 0);
        json.workout.forEach(entry => {
          const mg = entry["Muscle-Group"] || "Unknown";
          if (muscleGroups.includes(mg)) {
            const reps = +entry.Reps || 0;
            const weight = parseFloat(entry.Weight) || 0;
            volumeMap[mg] += reps * weight;
          }
        });
        const monIdx = dt.getMonth();
        const off = (dt.getDate() - 1) * muscleGroups.length;
        muscleGroups.forEach((mg, i) => {
          yearData[year][monIdx][off + i].volume = volumeMap[mg];
        });
      }
    } catch (err) {
      // missing file => volume remains 0
    }
  }
  // For days beyond the end of the month, set volume to null
  for (let m = 0; m < 12; m++) {
    const dim = new Date(year, m + 1, 0).getDate();
    for (let d = dim + 1; d <= 31; d++) {
      const off = (d - 1) * muscleGroups.length;
      for (let i = 0; i < muscleGroups.length; i++) {
        yearData[year][m][off + i].volume = null;
      }
    }
  }
}

/***********************************************
 * 3) Draw Calendar Plot
 ***********************************************/
function drawMonthChart(year, monthIndex) {
  chartContainer.innerHTML = "";
  if (!yearData[year]) return;
  
  const arr = yearData[year][monthIndex];
  const maxVol = d3.max(arr, d => d.volume === null ? 0 : d.volume) || 0;

  const colorScale = d3.scaleLinear()
    .domain([1, maxVol])
    .range(["#c6e48b", "#196127"])
    .clamp(true);

  // Use dynamic margins
  const margin = getMargins();

  // Basic cell geometry
  const days = 31, rows = muscleGroups.length;
  const cellSize = 15;
  const cellGap = 4;
  
  // The total width needed for the squares themselves
  const squaresWidth = (cellSize + cellGap) * days;
  const squaresHeight = (cellSize + cellGap) * rows;
  
  // The overall chart dimensions
  const chartWidth = margin.left + margin.right + squaresWidth;
  const chartHeight = margin.top + margin.bottom + squaresHeight;

  // The container's width (to see if we need horizontal scroll)
  const containerWidth = chartContainer.clientWidth;
  const minWidth = chartWidth; 
  const finalWidth = Math.max(containerWidth, minWidth);

  // Create SVG with dynamic width & left‐aligned aspect ratio
  const svg = d3.select("#chartContainer")
    .append("svg")
    .attr("width", finalWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
    .attr("preserveAspectRatio", "xMinYMin meet");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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
        let dayI = Math.floor(i / muscleGroups.length);
        return dayI * (cellSize + cellGap);
      })
      .attr("y", (d, i) => {
        let mgI = i % muscleGroups.length;
        return mgI * (cellSize + cellGap);
      })
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("rx", Math.max(1, cellSize / 5))
      .attr("ry", Math.max(1, cellSize / 5))
      .attr("fill", fillColor)
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1);

  // x-axis with fixed font size
  const xScale = d3.scaleBand()
    .domain(d3.range(1, 32).map(String))
    .range([0, squaresWidth]);
  const tickSkip = 2;
  const xAxis = d3.axisTop(xScale)
    .tickValues(xScale.domain().filter((_, i) => i % tickSkip === 0))
    .tickSize(0);
  g.append("g")
    .call(xAxis)
    .attr("font-size", 11)
    .call(g => g.selectAll(".tick text").attr("dx", "-0.125em"))
    .call(g => g.select(".domain").remove());

  // y-axis with fixed font size
  const yScale = d3.scaleBand()
    .domain(muscleGroups)
    .range([0, squaresHeight]);
  const yAxis = d3.axisLeft(yScale)
    .tickSize(0)
    .tickPadding(50)
    .tickFormat(d => muscleDisplayNames[d] || d);
  g.append("g")
    .call(yAxis)
    .attr("font-size", 12)
    .call(g => {
      g.select(".domain").remove();
      g.selectAll(".tick text")
        .attr("text-anchor", "start");
    });
}

/***********************************************
 * 4) Timeline Logic
 ***********************************************/
function getVisibleCount() {
  return (window.innerWidth >= 768) ? 5 : 3;
}

function computeChunkStart(selected) {
  const visible = getVisibleCount();
  const half = Math.floor(visible / 2);
  let start = selected - half;
  if (start < 0) start = 0;
  const maxStart = 12 - visible;
  if (start > maxStart) start = maxStart;
  return start;
}

function renderTimeline() {
  chunkStartIndex = computeChunkStart(selectedMonthIndex);
  timelineMonthsDiv.innerHTML = "";
  const visible = getVisibleCount();
  const end = chunkStartIndex + visible;
  for (let i = chunkStartIndex; i < end; i++) {
    let btn = document.createElement("button");
    btn.textContent = monthNames[i];
    if (i === selectedMonthIndex) {
      btn.classList.add("selectedMonth");
    }
    btn.addEventListener("click", () => {
      selectedMonthIndex = i;
      drawMonthChart(currentYear, selectedMonthIndex);
      renderTimeline();
    });
    timelineMonthsDiv.appendChild(btn);
  }
  timelinePrevBtn.disabled = (selectedMonthIndex <= 0);
  timelineNextBtn.disabled = (selectedMonthIndex >= 11);
}

timelinePrevBtn.addEventListener("click", () => {
  if (selectedMonthIndex > 0) {
    selectedMonthIndex--;
    drawMonthChart(currentYear, selectedMonthIndex);
    renderTimeline();
  }
});

timelineNextBtn.addEventListener("click", () => {
  if (selectedMonthIndex < 11) {
    selectedMonthIndex++;
    drawMonthChart(currentYear, selectedMonthIndex);
    renderTimeline();
  }
});

/***********************************************
 * 5) Handle Resizing
 ***********************************************/
window.addEventListener("resize", () => {
  drawMonthChart(currentYear, selectedMonthIndex);
  renderTimeline();
});

/***********************************************
 * Init on Page Load
 ***********************************************/
(async function init() {
  if (!yearData[currentYear]) {
    await loadDataForYear(currentYear);
  }
  selectedMonthIndex = currentMonthIndex;
  drawMonthChart(currentYear, currentMonthIndex);
  renderTimeline();
  updateYearlyWorkoutCount(currentYear);
})();
