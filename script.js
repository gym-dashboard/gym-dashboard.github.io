/***********************************************
 * script.js
 **********************************************/

// ====== Calendar config ======
const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Biceps", "Triceps"];
const muscleDisplayNames = {
  "Chest": "Chest",
  "Back": "Back",
  "Legs": "Legs",
  "Shoulders": "SH.",
  "Biceps": "Biceps",
  "Triceps": "Triceps"
};

// Define colors for each muscle group
const muscleColors = {
  "Chest": "#bb595f",    // Vibrant Red
  "Back": "#577590",     // Steel Blue
  "Legs": "#43AA8B",     // Teal Green
  "Shoulders": "#F8961E", // Bright Orange
  "Biceps": "#90BE6D",   // Sage Green
  "Triceps": "#F9C74F"   // Golden Yellow
};

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let yearData = {};      // structure: { year: [ month0, month1, ... month11 ] }
let workoutFiles = {};  // track JSON files found for each year
let currentYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth();

// DOM elements
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");
const timelineMonthsDiv = document.getElementById("timelineMonths");

// Timeline state (updated for vertical sliding)
let selectedMonthIndex = 0;
let isDragging = false;  // track if user is in the middle of dragging
let startY = 0;          // initial y position on mousedown
let scrollTop = 0;       // initial scrollTop on mousedown
let movedDistance = 0;   // track drag distance to differentiate click vs. drag

// ========== Top Bar: update workout count ==========
function computeYearlyWorkoutCount(year) {
  return workoutFiles[year] ? workoutFiles[year].length : 0;
}

function updateYearlyWorkoutCount(year) {
  const total = computeYearlyWorkoutCount(year);
  const countElem = document.getElementById("yearlyWorkoutsCount");
  countElem.textContent = `${total} Logged Workouts in the last year`;
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
      renderLegend();
    });
  } else {
    drawMonthChart(currentYear, selectedMonthIndex);
    renderTimeline();
    updateYearlyWorkoutCount(currentYear);
    renderLegend();
  }
});

// ========== Load data for a given year (optimized with parallel requests) ==========
async function loadDataForYear(year) {
  yearData[year] = Array.from({ length: 12 }, () => []);
  workoutFiles[year] = [];
  let promises = [];
  let start = new Date(year, 0, 1);
  let end = new Date(year, 11, 31);
  
  // Loop through every day in the year and queue a fetch
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const currentDate = new Date(dt);
    const dd = String(currentDate.getDate()).padStart(2, "0");
    const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
    const yyyy = currentDate.getFullYear();
    const fileName = `data/${dd}-${mm}-${yyyy}.json`;
    
    let monthIndex = currentDate.getMonth();
    let promise = d3.json(fileName)
      .then(json => {
        if (json && json.workout) {
          workoutFiles[year].push(fileName);
          
          // Handle new format - overall_muscle_group as an array
          if (json.overall_muscle_group && Array.isArray(json.overall_muscle_group)) {
            // Filter to only include valid muscle groups from our list
            const musclesList = json.overall_muscle_group
              .filter(mg => muscleGroups.includes(mg));
            
            return { 
              day: currentDate.getDate(), 
              muscles: musclesList, 
              volume: musclesList.length 
            };
          } else {
            // Fallback to old format with volume calculations
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
            
            // Pick the muscle group with the highest volume
            let selectedMuscle = null;
            let maxVolume = 0;
            muscleGroups.forEach(mg => {
              if (volumeMap[mg] > maxVolume) {
                maxVolume = volumeMap[mg];
                selectedMuscle = mg;
              }
            });
            
            return { 
              day: currentDate.getDate(), 
              muscles: selectedMuscle ? [selectedMuscle] : [], 
              volume: maxVolume 
            };
          }
        } else {
          return { day: currentDate.getDate(), muscles: [], volume: 0 };
        }
      })
      .catch(err => {
        return { day: currentDate.getDate(), muscles: [], volume: 0 };
      })
      .then(result => ({ month: monthIndex, result }));
    promises.push(promise);
  }
  
  const results = await Promise.all(promises);
  results.forEach(({ month, result }) => {
    // Place the day's data at index (day-1) for that month
    yearData[year][month][result.day - 1] = result;
  });
}

// ========== Draw the "calendar" chart for a given month ==========
function drawMonthChart(year, monthIndex) {
  chartContainer.innerHTML = "";
  
  // Determine number of days and weekday offset for the month
  const numDays = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay(); // 0=Sun, 6=Sat
  
  // Build an array of 35 cells (7 columns x 5 rows)
  let cells = [];
  for (let i = 0; i < 35; i++) {
    let dayNumber = i - firstDay + 1;
    if (dayNumber >= 1 && dayNumber <= numDays) {
      let dayData = yearData[year][monthIndex][dayNumber - 1];
      cells.push({ ...dayData, day: dayNumber });
    } else {
      cells.push(null);
    }
  }
  
  // Define dimensions
  const cellSize = 20,
        cellGap = 4,
        cols = 7,
        rows = 5;
  const gridWidth = cols * (cellSize + cellGap) - cellGap;
  const gridHeight = rows * (cellSize + cellGap) - cellGap;
  // Increase top margin to allow space for weekday labels
  const margin = { top: 40, right: 20, bottom: 20, left: 20 };
  const chartWidth = gridWidth + margin.left + margin.right;
  const chartHeight = gridHeight + margin.top + margin.bottom;
  
  // Store the grid height in a data attribute for the timeline to reference
  chartContainer.dataset.gridHeight = gridHeight;
  
  const svg = d3.select("#chartContainer")
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`)
    .attr("preserveAspectRatio", "xMinYMin meet");
  
  // Create main group translated by the margins
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // ===== Weekday Labels =====
  g.selectAll("text.weekDay")
    .data(weekDays)
    .join("text")
      .attr("class", "weekDay")
      .attr("x", (d, i) => i * (cellSize + cellGap) + cellSize / 2)
      .attr("y", -10) // positioned above the grid
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .text(d => d);
  
  // Create a new group for the grid, shifting it downward to clear the weekday labels
  const cellsG = g.append("g")
    .attr("transform", "translate(0,0)")
    .attr("class", "grid-cells-group");
  
  // Ordinal color scale for muscle groups - using the defined muscle colors
  const colorScale = d3.scaleOrdinal()
    .domain(muscleGroups)
    .range(muscleGroups.map(muscle => muscleColors[muscle]));
    
  // Add gradient definitions to the SVG
  const defs = svg.append("defs");
    
  // Create gradients for multi-muscle cells
  cells.forEach((cell, i) => {
    if (cell && cell.muscles && cell.muscles.length > 1) {
      const uniqueMuscles = [...new Set(cell.muscles)].slice(0, 3); // Allow up to 3 muscles
      if (uniqueMuscles.length > 1) {
        const gradientId = `gradient-${year}-${monthIndex}-${cell.day}`;
        
        const gradient = defs.append("linearGradient")
          .attr("id", gradientId)
          .attr("x1", "0%")
          .attr("y1", "0%")
          .attr("x2", "0%")
          .attr("y2", "100%");
        
        // Handle either 2 or 3 muscle groups
        if (uniqueMuscles.length === 2) {
          // Two muscle gradient
          const color1 = colorScale(uniqueMuscles[0]);
          const color2 = colorScale(uniqueMuscles[1]);
          
          gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", color1);
            
          gradient.append("stop")
            .attr("offset", "40%")
            .attr("stop-color", color1);
            
          gradient.append("stop")
            .attr("offset", "60%")
            .attr("stop-color", color2);
            
          gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", color2);
        } else {
          // Three muscle gradient
          const color1 = colorScale(uniqueMuscles[0]);
          const color2 = colorScale(uniqueMuscles[1]);
          const color3 = colorScale(uniqueMuscles[2]);
          
          gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", color1);
            
          gradient.append("stop")
            .attr("offset", "30%")
            .attr("stop-color", color1);
            
          gradient.append("stop")
            .attr("offset", "35%")
            .attr("stop-color", color2);
            
          gradient.append("stop")
            .attr("offset", "65%")
            .attr("stop-color", color2);
            
          gradient.append("stop")
            .attr("offset", "70%")
            .attr("stop-color", color3);
            
          gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", color3);
        }
        
        // Store the gradient ID in the cell data for later use
        cell.gradientId = gradientId;
      }
    }
  });
  
  // Draw cell backgrounds and outlines
  const cellsWrapper = cellsG.selectAll("g.cell-wrapper")
    .data(cells)
    .join("g")
      .attr("class", "cell-wrapper")
      .attr("transform", (d, i) => {
        const x = (i % cols) * (cellSize + cellGap);
        const y = Math.floor(i / cols) * (cellSize + cellGap);
        return `translate(${x}, ${y})`;
      });
  
  // Add base rectangles for all cells
  cellsWrapper.append("rect")
    .attr("class", "cell-background")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("stroke", "#ddd")
    .attr("stroke-width", 1)
    .attr("fill", d => {
      if (!d || !d.muscles || d.muscles.length === 0) return "#ebedf0";
      if (d.muscles.length === 1) return colorScale(d.muscles[0]);
      if (d.gradientId) return `url(#${d.gradientId})`;
      return "#ebedf0"; // Fallback
    });
  
  // Add day number labels inside cells
  cellsWrapper.append("text")
    .attr("class", "dayLabel")
    .attr("x", 2)
    .attr("y", 12)
    .attr("font-size", "10px")
    .attr("fill", "#333")
    .text((d, i) => {
      let dayNumber = i - firstDay + 1;
      return (dayNumber >= 1 && dayNumber <= numDays) ? dayNumber : "";
    });
  
  // Add tooltip for each cell
  cellsWrapper.append("title")
    .text((d, i) => {
      let dayNumber = i - firstDay + 1;
      if (d && dayNumber >= 1 && dayNumber <= numDays) {
        if (d.muscles && d.muscles.length > 0) {
          // Show all muscle groups in the tooltip
          return `Day ${dayNumber}: ${d.muscles.join(", ")}`;
        } else {
          return `Day ${dayNumber}: No workout`;
        }
      }
      return "";
    });
  
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
    
    btn.addEventListener("click", (evt) => {
      if (Math.abs(movedDistance) > 5) return; // ignore drag clicks
      selectedMonthIndex = i;
      drawMonthChart(currentYear, selectedMonthIndex);
      centerMonthButton(btn);
      highlightSelectedMonth();
    });
    timelineMonthsDiv.appendChild(btn);
  }
  updateLayout();
  
  // Center the selected month button
  setTimeout(() => {
    const selectedBtn = timelineMonthsDiv.children[selectedMonthIndex];
    if (selectedBtn) centerMonthButton(selectedBtn, false);
  }, 0);
}

function centerMonthButton(buttonElem, smooth = true) {
  const btnRect = buttonElem.getBoundingClientRect();
  const containerRect = timelineMonthsDiv.getBoundingClientRect();
  const target = (btnRect.top - containerRect.top) - (containerRect.height / 2) + (btnRect.height / 2);
  timelineMonthsDiv.scrollTo({
    top: timelineMonthsDiv.scrollTop + target,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

function highlightSelectedMonth() {
  Array.from(timelineMonthsDiv.children).forEach((child, idx) => {
    if (idx === selectedMonthIndex) {
      child.classList.add("selectedMonth");
    } else {
      child.classList.remove("selectedMonth");
    }
  });
}

// ========== Drag-to-scroll for timeline (vertical version) ==========
function setupDragScroll() {
  timelineMonthsDiv.onmousedown = null;
  timelineMonthsDiv.onmousemove = null;
  timelineMonthsDiv.onmouseup = null;
  timelineMonthsDiv.onmouseleave = null;
  timelineMonthsDiv.ontouchstart = null;
  timelineMonthsDiv.ontouchmove = null;
  timelineMonthsDiv.ontouchend = null;

  timelineMonthsDiv.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.pageY - timelineMonthsDiv.offsetTop;
    scrollTop = timelineMonthsDiv.scrollTop;
    movedDistance = 0;
    timelineMonthsDiv.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  timelineMonthsDiv.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const y = e.pageY - timelineMonthsDiv.offsetTop;
    const walk = (y - startY) * 2;
    timelineMonthsDiv.scrollTop = scrollTop - walk;
    movedDistance = walk;
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
  
  timelineMonthsDiv.addEventListener('touchstart', (e) => {
    isDragging = true;
    startY = e.touches[0].pageY - timelineMonthsDiv.offsetTop;
    scrollTop = timelineMonthsDiv.scrollTop;
    movedDistance = 0;
  });
  
  timelineMonthsDiv.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const y = e.touches[0].pageY - timelineMonthsDiv.offsetTop;
    const walk = (y - startY) * 2;
    timelineMonthsDiv.scrollTop = scrollTop - walk;
    movedDistance = walk;
    e.preventDefault();
  });
  
  timelineMonthsDiv.addEventListener('touchend', () => {
    isDragging = false;
  });
}

function updateLayout() {
  // Get the grid height from the data attribute we set
  const gridHeight = parseInt(chartContainer.dataset.gridHeight || "0");
  
  if (gridHeight > 0) {
    // Make the timeline months container match the grid height exactly
    timelineMonthsDiv.style.height = `${gridHeight}px`;
    
    // Position the timeline vertically to align with the grid
    // First, get the SVG element and the grid group
    const svg = chartContainer.querySelector('svg');
    if (svg) {
      const gridGroup = svg.querySelector('.grid-cells-group');
      if (gridGroup) {
        // Get the transformation matrix to find the vertical offset
        const transform = gridGroup.getAttribute('transform');
        const match = transform ? transform.match(/translate\(\s*([^,)]+)(?:,\s*([^)]+))?\)/) : null;
        const translateY = match && match[2] ? parseFloat(match[2]) : 0;
        
        // Adjust the timeline container's margin-top to align with the grid
        const svgRect = svg.getBoundingClientRect();
        const gridRect = gridGroup.getBoundingClientRect();
        const topOffset = gridRect.top - svgRect.top;
        
        // Apply the offset to align with the grid
        document.getElementById('timelineContainer').style.marginTop = `${topOffset}px`;
      }
    }
  }
}

// ========== Legend: Render muscle group legend ==========
function renderLegend() {
  const legendDiv = document.getElementById("legend");
  legendDiv.innerHTML = "";
  
  // Use the muscle colors defined at the top
  const colorScale = d3.scaleOrdinal()
    .domain(muscleGroups)
    .range(muscleGroups.map(muscle => muscleColors[muscle]));
  
  muscleGroups.forEach(mg => {
    const item = document.createElement("div");
    item.classList.add("legend-item");
    const box = document.createElement("span");
    box.classList.add("colorBox");
    box.style.backgroundColor = colorScale(mg);
    const label = document.createElement("span");
    label.textContent = muscleDisplayNames[mg] || mg;
    item.appendChild(box);
    item.appendChild(label);
    legendDiv.appendChild(item);
  });
}

// ========== Redraw chart on window resize ==========
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
  renderLegend();
  updateLayout();
  setupDragScroll();
})();