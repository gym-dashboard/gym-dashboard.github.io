/***********************************************
 * script.js
 **********************************************/

// ====== Calendar config ======
const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Bicep", "Tricep"];
const muscleDisplayNames = {
  "Chest": "Chest",
  "Back": "Back",
  "Legs": "Legs",
  "Shoulders": "SH.",
  "Bicep": "Biceps",
  "Tricep": "Triceps"
};
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"];

let yearData = {};
let workoutFiles = {};   // track JSON files found for each year
let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth();

// DOM elements
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");
const timelineMonthsDiv = document.getElementById("timelineMonths");

// Timeline state
let selectedMonthIndex = 0;
let isDragging = false;  // track if user is in the middle of dragging
let startX = 0;          // initial x position on mousedown
let scrollLeft = 0;      // initial scrollLeft on mousedown
let movedDistance = 0;   // how far user has dragged; used to differentiate click vs. drag

// ========== For the top bar text: number of loaded JSON files ==========

function computeYearlyWorkoutCount(year) {
  return workoutFiles[year] ? workoutFiles[year].length : 0;
}

function updateYearlyWorkoutCount(year) {
  const total = computeYearlyWorkoutCount(year);
  const countElem = document.getElementById("yearlyWorkoutsCount");
  countElem.textContent = `${total} Logged Workouts in the last year`;
}

// ========== Helper to set margins based on screen width ==========

function getMargins() {
  // Tweak as you wish
  if (window.innerWidth < 768) {
    return { top: 25, right: 5, bottom: 0, left: 50 };
  } else {
    return { top: 20, right: 20, bottom: 0, left: 70 };
  }
}

// ========== Populate the Year <select> dropdown ==========

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
    drawMonthChart(currentYear, selectedMonthIndex);
    renderTimeline();
    updateYearlyWorkoutCount(currentYear);
  }
});

// ========== Load data for a given year ==========

async function loadDataForYear(year) {
  yearData[year] = new Array(12).fill(null).map(() => []);
  workoutFiles[year] = [];

  // Initialize placeholders for each day/muscle
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= 31; d++) {
      muscleGroups.forEach(mg => {
        yearData[year][m].push({ day: d, muscle: mg, volume: 0 });
      });
    }
  }

  // Attempt to load data files day-by-day
  let start = new Date(year, 0, 1);
  let end = new Date(year, 11, 31);
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const fileName = `data/${dd}-${mm}-${yyyy}.json`; // example path
    
    try {
      const json = await d3.json(fileName);
      if (json && json.workout) {
        // Found a valid workout file => track it
        workoutFiles[year].push(fileName);
        
        // Sum volume by muscle group
        let volumeMap = {};
        muscleGroups.forEach(mg => (volumeMap[mg] = 0));
        json.workout.forEach(entry => {
          const mg = entry["Muscle-Group"] || "Unknown";
          if (muscleGroups.includes(mg)) {
            const reps = +entry.Reps || 0;
            const weight = parseFloat(entry.Weight) || 0;
            volumeMap[mg] += (reps * weight);
          }
        });

        const monIdx = dt.getMonth();
        const off = (dt.getDate() - 1) * muscleGroups.length;
        muscleGroups.forEach((mg, i) => {
          yearData[year][monIdx][off + i].volume = volumeMap[mg];
        });
      }
    } catch (err) {
      // no file => keep volume=0
    }
  }

  // Mark days beyond each month-end as null volume
  for (let m = 0; m < 12; m++) {
    const dim = new Date(year, m + 1, 0).getDate(); // days in month
    for (let d = dim + 1; d <= 31; d++) {
      const off = (d - 1) * muscleGroups.length;
      for (let i = 0; i < muscleGroups.length; i++) {
        yearData[year][m][off + i].volume = null;
      }
    }
  }
}

// ========== Align timeline with the squares of the calendar ==========

function updateLayout() {
  // Get the dimensions of the squares section of the chart
  const svg = document.querySelector('#chartContainer svg');
  if (!svg) return;
  
  // Calculate the left offset of the actual squares (not including axis labels)
  const margin = getMargins();
  const squaresLeftOffset = margin.left;
  
  // Set the timeline container to match the width and position of the squares
  const timelineContainer = document.getElementById('timelineContainer');
  timelineContainer.style.width = 'auto'; // Reset any previous width
  timelineContainer.style.marginLeft = `${squaresLeftOffset}px`;
  timelineContainer.style.marginRight = `${margin.right}px`;
  
  // Adjust the timeline itself to align with the squares
  const timelineMonths = document.getElementById('timelineMonths');
  
  // Calculate the width of the squares portion (excluding the y-axis labels)
  const days = 31;
  const cellSize = 15, cellGap = 4;
  const squaresWidth = (cellSize + cellGap) * days;
  
  // Set the width of the timeline to match the squares portion
  timelineMonths.style.width = `${squaresWidth}px`;
  
  // Make sure the container shows scrollbars when needed
  timelineMonths.style.overflowX = 'auto';
}

// ========== Draw the "calendar" chart for a given month ==========

function drawMonthChart(year, monthIndex) {
  chartContainer.innerHTML = "";
  if (!yearData[year]) return;

  const arr = yearData[year][monthIndex];
  const maxVol = d3.max(arr, d => (d.volume === null ? 0 : d.volume)) || 0;

  const colorScale = d3.scaleLinear()
    .domain([1, maxVol])
    .range(["#c6e48b", "#196127"])
    .clamp(true);

  const margin = getMargins();
  const days = 31, rows = muscleGroups.length;
  const cellSize = 15, cellGap = 4;

  // total area needed for squares alone
  const squaresWidth = (cellSize + cellGap) * days;
  const squaresHeight = (cellSize + cellGap) * rows;
  
  // overall svg dimensions
  const chartWidth = margin.left + margin.right + squaresWidth;
  const chartHeight = margin.top + margin.bottom + squaresHeight;
  
  // ensure the SVG is not smaller than container
  const containerWidth = chartContainer.clientWidth;
  const finalWidth = Math.max(containerWidth, chartWidth);

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

  // draw squares
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

  // x-axis at top
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

  // y-axis on left
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
    
  // Call updateLayout after chart is drawn to align timeline
  updateLayout();
}

// ========== Timeline: create months + handle drag/scroll + click ==========

function renderTimeline() {
  timelineMonthsDiv.innerHTML = "";

  for (let i = 0; i < 12; i++) {
    const btn = document.createElement("button");
    btn.textContent = monthNames[i];
    if (i === selectedMonthIndex) {
      btn.classList.add("selectedMonth");
    }
    
    // We use mousedown->drag->mouseup logic in the container.
    // So to ensure a "true click", we only act if the user hasn't dragged.
    btn.addEventListener("click", (evt) => {
      // If user dragged more than a small threshold, ignore click
      if (Math.abs(movedDistance) > 5) {
        // This was actually a drag, not a deliberate click
        return;
      }
      // If it was a real click, update chart
      selectedMonthIndex = i;
      drawMonthChart(currentYear, selectedMonthIndex);
      centerMonthButton(btn);
      highlightSelectedMonth();
    });

    timelineMonthsDiv.appendChild(btn);
  }

  // Update layout to align with squares
  updateLayout();

  // Immediately center the selected month button
  setTimeout(() => {
    const selectedBtn = timelineMonthsDiv.children[selectedMonthIndex];
    if (selectedBtn) {
      centerMonthButton(selectedBtn, false);
    }
  }, 0);

  setupDragScroll();
}

// Center a month button in the scroll container
function centerMonthButton(buttonElem, smooth = true) {
  const btnRect = buttonElem.getBoundingClientRect();
  const containerRect = timelineMonthsDiv.getBoundingClientRect();
  const target = (btnRect.left - containerRect.left)
               - (containerRect.width / 2)
               + (btnRect.width / 2);
  
  timelineMonthsDiv.scrollTo({
    left: timelineMonthsDiv.scrollLeft + target,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

// Visually highlight the currently selected month button
function highlightSelectedMonth() {
  Array.from(timelineMonthsDiv.children).forEach((child, idx) => {
    if (idx === selectedMonthIndex) {
      child.classList.add("selectedMonth");
    } else {
      child.classList.remove("selectedMonth");
    }
  });
}

// ========== Set up drag-to-scroll logic ==========

function setupDragScroll() {
  // clear any old event handlers
  timelineMonthsDiv.onmousedown = null;
  timelineMonthsDiv.onmousemove = null;
  timelineMonthsDiv.onmouseup = null;
  timelineMonthsDiv.onmouseleave = null;
  timelineMonthsDiv.ontouchstart = null;
  timelineMonthsDiv.ontouchmove = null;
  timelineMonthsDiv.ontouchend = null;

  // Mouse events
  timelineMonthsDiv.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.pageX - timelineMonthsDiv.offsetLeft;
    scrollLeft = timelineMonthsDiv.scrollLeft;
    movedDistance = 0; // reset for click detection
    timelineMonthsDiv.style.cursor = 'grabbing';
    e.preventDefault();
  });

  timelineMonthsDiv.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.pageX - timelineMonthsDiv.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed multiplier
    timelineMonthsDiv.scrollLeft = scrollLeft - walk;
    movedDistance = walk; // track how much we've moved
  });

  timelineMonthsDiv.addEventListener('mouseup', () => {
    isDragging = false;
    timelineMonthsDiv.style.cursor = 'grab';
  });

  timelineMonthsDiv.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      timelineMonthsDiv.style.cursor = 'grab';
    }
  });

  // Touch events (mobile)
  timelineMonthsDiv.addEventListener('touchstart', (e) => {
    isDragging = true;
    startX = e.touches[0].pageX - timelineMonthsDiv.offsetLeft;
    scrollLeft = timelineMonthsDiv.scrollLeft;
    movedDistance = 0;
  });

  timelineMonthsDiv.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - timelineMonthsDiv.offsetLeft;
    const walk = (x - startX) * 2;
    timelineMonthsDiv.scrollLeft = scrollLeft - walk;
    movedDistance = walk;
    e.preventDefault();
  });

  timelineMonthsDiv.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// ========== Redraw chart on resize ==========

window.addEventListener("resize", () => {
  drawMonthChart(currentYear, selectedMonthIndex);
  renderTimeline();
  updateLayout();
});

// ========== Init on Page Load ==========

(async function init() {
  if (!yearData[currentYear]) {
    await loadDataForYear(currentYear);
  }
  selectedMonthIndex = currentMonthIndex;
  drawMonthChart(currentYear, selectedMonthIndex);
  renderTimeline();
  updateYearlyWorkoutCount(currentYear);
  updateLayout();
})();