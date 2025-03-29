/***********************************************
 * script.js
 **********************************************/

// ====== Calendar config ======
const muscleGroups = ["Chest", "Triceps", "Legs", "Shoulders", "Back", "Biceps"];
const muscleDisplayNames = {
  "Chest": "Chest",
  "Triceps": "Triceps",
  "Legs": "Legs",
  "Shoulders": "Shoulders",
  "Back": "Back",
  "Biceps": "Biceps",
};

const muscleColors = {
  "Chest": "#c8ceee",
  "Triceps": "#f9c5c7",
  "Legs": "#f7e5b7",
  "Shoulders": "#ffc697",
  "Back": "#cbd3ad",
  "Biceps": "#c6e2e7",
};

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let yearData = {};      // structure: { year: [ month0, month1, ... month11 ] }
let workoutFiles = {};  // track JSON files found for each year
let currentYear = new Date().getFullYear();

// Weekly progress tracking
let weeklyData = {
  currentWeekWorkouts: 0,
  weekStreakCount: 0,
  lastCompletedWeek: null,
};

// DOM elements
const yearSelect = document.getElementById("yearSelect");
const chartContainer = document.getElementById("chartContainer");

// ========== Populate Year Select ==========
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
      drawYearCalendar(currentYear);
      updateYearlyWorkoutCount(currentYear);
      renderLegend();
      adjustMonthDisplay();
      updateWeeklyProgress(); 
    });
  } else {
    drawYearCalendar(currentYear);
    updateYearlyWorkoutCount(currentYear);
    renderLegend();
    adjustMonthDisplay();
    updateWeeklyProgress();
  }
});

// ========== Update Yearly Workout Count ==========
function computeYearlyWorkoutCount(year) {
  return workoutFiles[year] ? workoutFiles[year].length : 0;
}

function updateYearlyWorkoutCount(year) {
  const total = computeYearlyWorkoutCount(year);
  const countElem = document.getElementById("yearlyWorkoutsCount");
  countElem.textContent = `${total} Logged Workouts in the last year`;
}

// ========== Load Data for a Given Year ==========
// We'll collect not just muscle info but also a "volume" (set count) and a list of unique exercises.
async function loadDataForYear(year) {
  yearData[year] = Array.from({ length: 12 }, () => []);
  workoutFiles[year] = [];
  let promises = [];
  let start = new Date(year, 0, 1);
  let end = new Date(year, 11, 31);

  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const currentDate = new Date(dt);
    const dd = String(currentDate.getDate()).padStart(2, "0");
    const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
    const yyyy = currentDate.getFullYear();
    const fileName = `data/${dd}-${mm}-${yyyy}.json`;

    let monthIndex = currentDate.getMonth();
    let promise = d3.json(fileName)
      .then(json => {
        // Check if this file actually has a 'workout' array
        if (json && Array.isArray(json.workout) && json.workout.length > 0) {
          workoutFiles[year].push(fileName);

          // We'll treat each exercise line as "1 set"
          let totalSets = 0;
          let exerciseSet = new Set();

          // We'll also still track muscle volume if you need it
          let volumeMap = {};
          muscleGroups.forEach(mg => volumeMap[mg] = 0);

          json.workout.forEach(entry => {
            // 1) Treat each line as one set
            totalSets += 1;

            // 2) Gather muscle volume
            const mg = entry["Muscle-Group"] || "Unknown";
            if (muscleGroups.includes(mg)) {
              const reps = +entry.Reps || 0;
              const weight = parseFloat(entry.Weight) || 0;
              volumeMap[mg] += (reps * weight);
            }

            // 3) Save the exercise name from "Exercise"
            if (entry["Exercise"]) {
              exerciseSet.add(entry["Exercise"]);
            }
          });

          // Now decide which muscle(s) to color for that day
          let musclesList = [];
          if (Array.isArray(json.overall_muscle_group) && json.overall_muscle_group.length) {
            musclesList = json.overall_muscle_group.filter(mg => muscleGroups.includes(mg));
          } else {
            // fallback: pick single muscle with max volume
            let selectedMuscle = null;
            let maxVol = 0;
            muscleGroups.forEach(mg => {
              if (volumeMap[mg] > maxVol) {
                maxVol = volumeMap[mg];
                selectedMuscle = mg;
              }
            });
            if (selectedMuscle) musclesList.push(selectedMuscle);
          }

          return {
            day: currentDate.getDate(),
            muscles: musclesList,
            // "volume" is the total sets. Just naming it "volume" for the tooltip
            volume: totalSets,
            // list of unique exercises from "Exercise" field
            exercises: Array.from(exerciseSet),
          };
        }
        // If no workout or file not found => no data
        return { day: currentDate.getDate(), muscles: [], volume: 0, exercises: [] };
      })
      .catch(err => {
        // File not found or parse error => no data
        return { day: currentDate.getDate(), muscles: [], volume: 0, exercises: [] };
      })
      .then(result => ({ month: monthIndex, result }));

    promises.push(promise);
  }

  const results = await Promise.all(promises);
  results.forEach(({ month, result }) => {
    yearData[year][month][result.day - 1] = result;
  });
}


// ========== Tooltip Content Builder ==========
function buildTooltipHTML(dayData) {
  if (!dayData || !dayData.exercises || dayData.exercises.length === 0) {
    return "No workout data";
  }
  // Format the list of exercises
  const exerciseList = dayData.exercises
    .map(ex => `• ${ex}`)
    .join("<br>");
  
  return `
    <strong>Volume:</strong> ${dayData.volume} Sets<br>
    ${exerciseList}
  `;
}

// ========== Tooltip Show/Hide ==========
function showTooltip(event, dayData) {
  const tooltipDiv = d3.select("#tooltip");
  
  // Build tooltip content
  tooltipDiv.html(buildTooltipHTML(dayData));
  const tooltipNode = tooltipDiv.node();
  const tooltipWidth = tooltipNode.offsetWidth;
  
  // Use clientX/Y adjusted with page offsets to account for zoom and scroll
  const mouseX = event.clientX + window.pageXOffset;
  const mouseY = event.clientY + window.pageYOffset;
  
  // Use document's client width for positioning calculations
  const viewportWidth = document.documentElement.clientWidth;
  
  let newLeft;
  if (viewportWidth - event.clientX < tooltipWidth + 20) {
    // Not enough space on the right; position tooltip on the left
    newLeft = (mouseX - tooltipWidth - 10) + "px";
  } else {
    // Enough space; position tooltip to the right
    newLeft = (mouseX + 10) + "px";
  }
  
  const newTop = (mouseY + 10) + "px";
  
  tooltipDiv
    .style("left", newLeft)
    .style("top", newTop)
    .style("opacity", 1);
}


function hideTooltip() {
  d3.select("#tooltip").style("opacity", 0);
}

// ========== Responsive Functions ==========

// Determine appropriate cell size based on screen width
function calculateResponsiveCellSize() {
  const outerBoxWidth = document.getElementById('outerBox').clientWidth;
  const minCellSize = 16;
  const idealCellSize = 20;
  const cellGap = 4;
  
  // Account for margins/padding
  const availableWidth = outerBoxWidth - 40;
  const cellsWithGapsWidth = (7 * idealCellSize) + (6 * cellGap);
  
  if (availableWidth >= cellsWithGapsWidth) {
    return idealCellSize;
  } else {
    const calculatedSize = Math.floor((availableWidth - (6 * cellGap)) / 7);
    return Math.max(calculatedSize, minCellSize);
  }
}

// Adjust month blocks to show exactly the desired number of months
function adjustMonthDisplay() {
  const chartContainer = document.getElementById('chartContainer');
  const containerWidth = chartContainer.clientWidth;
  const monthBlocks = document.querySelectorAll('.month-block');
  
  if (monthBlocks.length === 0) return;
  
  let targetMonthsVisible;
  if (containerWidth < 480) {
    targetMonthsVisible = Math.min(2, monthBlocks.length);
  } else {
    targetMonthsVisible = Math.min(3, monthBlocks.length);
  }
  
  const idealMonthWidth = Math.floor((containerWidth - (5 * (targetMonthsVisible - 1))) / targetMonthsVisible);
  monthBlocks.forEach(block => {
    const svg = block.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', idealMonthWidth);
      const viewBox = svg.getAttribute('viewBox').split(' ');
      const aspectRatio = parseFloat(viewBox[3]) / parseFloat(viewBox[2]);
      svg.setAttribute('height', Math.floor(idealMonthWidth * aspectRatio));
    }
  });
  
  const now = new Date();
  let currentMonth = now.getMonth();
  let updatedMonthBlockWidth = idealMonthWidth + 5;
  const desiredScroll = (currentMonth * updatedMonthBlockWidth)
                      - (containerWidth - updatedMonthBlockWidth);
  chartContainer.scrollLeft = Math.max(0, desiredScroll);
}

// ========== Draw Year Calendar ==========
function drawYearCalendar(year) {
  chartContainer.innerHTML = "";
  
  const cellSize = calculateResponsiveCellSize(),
        cellGap = 4,
        cols = 7,
        rows = 5;
  const gridWidth = cols * (cellSize + cellGap) - cellGap;
  const gridHeight = rows * (cellSize + cellGap) - cellGap;
  const margin = { top: 50, right: 20, bottom: 20, left: 20 };
  const monthChartWidth = gridWidth + margin.left + margin.right;
  const monthChartHeight = gridHeight + margin.top + margin.bottom;
  
  const getGradientId = (muscles) => `gradient-${muscles.join('-')}`;

  for (let m = 0; m < 12; m++) {
    const monthDiv = document.createElement("div");
    monthDiv.className = "month-block";
    
    const svg = d3.create("svg")
      .attr("width", monthChartWidth)
      .attr("height", monthChartHeight)
      .attr("viewBox", `0 0 ${monthChartWidth} ${monthChartHeight}`)
      .attr("preserveAspectRatio", "xMinYMin meet");

    const defs = svg.append("defs");

    // Month label
    svg.append("text")
      .attr("x", margin.left + gridWidth/2)
      .attr("y", margin.top - 25)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(monthNames[m]);

    // Weekday labels
    svg.selectAll("text.weekDay")
      .data(weekDays)
      .join("text")
        .attr("class", "weekDay")
        .attr("x", (d, i) => margin.left + i * (cellSize + cellGap) + cellSize/2)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "#333")
        .text(d => d);

    const numDays = new Date(year, m + 1, 0).getDate();
    const firstDay = new Date(year, m, 1).getDay();
    let cells = [];
    for (let i = 0; i < 35; i++) {
      let dayNumber = i - firstDay + 1;
      if (dayNumber >= 1 && dayNumber <= numDays) {
        let dayData = (yearData[year] && yearData[year][m])
          ? yearData[year][m][dayNumber - 1]
          : { day: dayNumber, muscles: [], volume: 0, exercises: [] };
        cells.push({ ...dayData, day: dayNumber });
      } else {
        cells.push(null);
      }
    }
    
    // Create color gradients for multi-muscle squares
    const colorScale = d3.scaleOrdinal()
      .domain(muscleGroups)
      .range(muscleGroups.map(mg => muscleColors[mg]));
    
    const uniqueCombinations = new Set();
    cells.forEach(cell => {
      if (cell && cell.muscles && cell.muscles.length > 1) {
        uniqueCombinations.add(cell.muscles.join('-'));
      }
    });
    uniqueCombinations.forEach(combo => {
      const muscles = combo.split('-');
      const gradientId = getGradientId(muscles);
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      
      // We only handle up to 3 distinct muscles for the gradient
      if (muscles.length === 2) {
        gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(muscles[0]));
        gradient.append("stop").attr("offset", "45%").attr("stop-color", colorScale(muscles[0]));
        gradient.append("stop").attr("offset", "55%").attr("stop-color", colorScale(muscles[1]));
        gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(muscles[1]));
      } else if (muscles.length === 3) {
        gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(muscles[0]));
        gradient.append("stop").attr("offset", "30%").attr("stop-color", colorScale(muscles[0]));
        gradient.append("stop").attr("offset", "35%").attr("stop-color", colorScale(muscles[1]));
        gradient.append("stop").attr("offset", "65%").attr("stop-color", colorScale(muscles[1]));
        gradient.append("stop").attr("offset", "70%").attr("stop-color", colorScale(muscles[2]));
        gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(muscles[2]));
      } else if (muscles.length > 3) {
        // just use the first 3
        gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(muscles[0]));
        gradient.append("stop").attr("offset", "30%").attr("stop-color", colorScale(muscles[0]));
        gradient.append("stop").attr("offset", "35%").attr("stop-color", colorScale(muscles[1]));
        gradient.append("stop").attr("offset", "65%").attr("stop-color", colorScale(muscles[1]));
        gradient.append("stop").attr("offset", "70%").attr("stop-color", colorScale(muscles[2]));
        gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(muscles[2]));
      }
    });
    
    const cellsGroup = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Draw each day cell
    cellsGroup.selectAll("g.cell-wrapper")
      .data(cells)
      .join("g")
        .attr("class", "cell-wrapper")
        .attr("transform", (d, i) => {
          const x = (i % cols) * (cellSize + cellGap);
          const y = Math.floor(i / cols) * (cellSize + cellGap);
          return `translate(${x}, ${y})`;
        })
        .each(function(d) {
          if (!d) return;
          
          const cell = d3.select(this);
          cell.append("rect")
            .attr("class", "cell-background")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("fill", () => {
              const cellDate = new Date(year, m, d.day);
              const now = new Date();
              if (cellDate > now) return "none"; // future date
              if (!d.muscles || d.muscles.length === 0) return "#ebedf0"; // no workout
              if (d.muscles.length === 1) {
                return colorScale(d.muscles[0]);
              }
              return `url(#${getGradientId(d.muscles)})`;
            });
          
          // Day label
          cell.append("text")
            .attr("class", "dayLabel")
            .attr("x", 2)
            .attr("y", 12)
            .attr("font-size", "10px")
            .attr("fill", "#333")
            .text(d.day);

          // Add pointer events for all devices (pointerenter/move/leave)
          if (d.muscles && d.muscles.length > 0) {
            addTooltipBehavior(cell, d);
          }
        });
    
    monthDiv.appendChild(svg.node());
    chartContainer.appendChild(monthDiv);
  }
}

function addTooltipBehavior(cellSelection, dayData) {
  const rect = cellSelection.select("rect.cell-background");

  // Check for a coarse pointer (likely a touch device)
  if (window.matchMedia('(pointer: coarse)').matches) {
    cellSelection.on("touchstart", (event) => {
      // Prevent the touchstart from propagating to avoid immediate dismissal.
      event.stopPropagation();
      rect.attr("stroke", "#333").attr("stroke-width", 2);
      showTooltip(event, dayData);

      // Attach a one-time listener to hide the tooltip when tapping outside.
      document.addEventListener("touchstart", function hideOnOutsideTouch(e) {
        // If the touch is outside the cell and tooltip, hide the tooltip.
        if (!e.target.closest(".cell-wrapper") && !e.target.closest("#tooltip")) {
          rect.attr("stroke", "#ddd").attr("stroke-width", 1);
          hideTooltip();
          document.removeEventListener("touchstart", hideOnOutsideTouch);
        }
      });
    });
  } else {
    // Desktop and fine pointer devices
    cellSelection
      .on("pointerenter", (event) => {
        rect.attr("stroke", "#333").attr("stroke-width", 2);
        showTooltip(event, dayData);
      })
      .on("pointermove", (event) => {
        showTooltip(event, dayData);
      })
      .on("pointerleave", () => {
        rect.attr("stroke", "#ddd").attr("stroke-width", 1);
        hideTooltip();
      });
  }
}


// ========== Render Legend ==========
function renderLegend() {
  const legendDiv = document.getElementById("legend");
  legendDiv.innerHTML = "";
  const colorScale = d3.scaleOrdinal()
    .domain(muscleGroups)
    .range(muscleGroups.map(mg => muscleColors[mg]));
  
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

// ========== Weekly Progress Bar Functions ==========

function getCurrentWeekDateRange() {
  const now = new Date();
  const currentDay = now.getDay(); 
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - currentDay);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return { startDate, endDate };
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function updateWeekDateRangeDisplay() {
  const { startDate, endDate } = getCurrentWeekDateRange();
  const dateRangeElem = document.getElementById('weekDateRange');
  const titlePrefix = document.querySelector('.weekly-title-prefix');
  
  if (!dateRangeElem) return;
  
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  const isSameMonth = startMonth === endMonth;

  if (window.innerWidth <= 767) {
    titlePrefix.textContent = "";
    if (isSameMonth) {
      const monthName = monthNames[startMonth];
      dateRangeElem.textContent = `${monthName} ${startDate.getDate()}-${endDate.getDate()}`;
    } else {
      const startMonthName = monthNames[startMonth];
      const endMonthName = monthNames[endMonth];
      dateRangeElem.textContent = `${startMonthName} ${startDate.getDate()}-${endMonthName} ${endDate.getDate()}`;
    }
  } else {
    titlePrefix.textContent = "Current Week:";
    if (isSameMonth) {
      const monthName = monthNames[startMonth];
      dateRangeElem.textContent = `${monthName} ${startDate.getDate()} - ${endDate.getDate()}`;
    } else {
      const startMonthName = monthNames[startMonth];
      const endMonthName = monthNames[endMonth];
      dateRangeElem.textContent = `${startMonthName} ${startDate.getDate()} - ${endMonthName} ${endDate.getDate()}`;
    }
  }
}

function getFormattedDateRangeForMobile() {
  const { startDate, endDate } = getCurrentWeekDateRange();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  const isSameMonth = startMonth === endMonth;
  
  if (isSameMonth) {
    const monthName = monthNames[startMonth];
    return `${monthName} ${startDate.getDate()}-${endDate.getDate()}`;
  } else {
    const startMonthName = monthNames[startMonth];
    const endMonthName = monthNames[endMonth];
    return `${startMonthName} ${startDate.getDate()}-${endMonthName} ${endDate.getDate()}`;
  }
}

function countCurrentWeekWorkouts() {
  const { startDate, endDate } = getCurrentWeekDateRange();
  let count = 0;
  
  if (!yearData[currentYear]) return 0;
  
  for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
    const month = day.getMonth();
    const dayOfMonth = day.getDate() - 1;
    if (yearData[currentYear][month] &&
        yearData[currentYear][month][dayOfMonth] &&
        yearData[currentYear][month][dayOfMonth].muscles &&
        yearData[currentYear][month][dayOfMonth].muscles.length > 0) {
      count++;
    }
  }
  
  return count;
}

function checkPreviousWeekCompleted() {
  const { startDate } = getCurrentWeekDateRange();
  
  const prevWeekEnd = new Date(startDate);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
  
  let count = 0;
  if (!yearData[currentYear]) return false;
  
  for (let day = new Date(prevWeekStart); day <= prevWeekEnd; day.setDate(day.getDate() + 1)) {
    const month = day.getMonth();
    const dayOfMonth = day.getDate() - 1;
    if (yearData[currentYear][month] &&
        yearData[currentYear][month][dayOfMonth] &&
        yearData[currentYear][month][dayOfMonth].muscles &&
        yearData[currentYear][month][dayOfMonth].muscles.length > 0) {
      count++;
    }
  }
  
  return count >= 4;
}

function updateStreakCounter() {
  const startDate = getCurrentWeekDateRange().startDate;
  const weekKey = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
  
  if (weeklyData.lastCompletedWeek === weekKey) {
    return;
  }
  
  const prevWeekCompleted = checkPreviousWeekCompleted();
  if (!prevWeekCompleted) {
    weeklyData.weekStreakCount = 0;
  }
  
  const currentWeekCompleted = weeklyData.currentWeekWorkouts >= 4;
  if (currentWeekCompleted) {
    weeklyData.weekStreakCount++;
    weeklyData.lastCompletedWeek = weekKey;
  }
  
  const streakIndicator = document.getElementById('streakIndicator');
  if (streakIndicator) {
    streakIndicator.textContent = `${weeklyData.weekStreakCount} Week Streak`;
    streakIndicator.classList.add('active');
    if (weeklyData.weekStreakCount > 1) {
      streakIndicator.textContent += 's';
    }
  }
}

function updateProgressBar(workoutCount) {
  const segments = document.querySelectorAll('.segment');
  const progressText = document.getElementById('progressText');
  
  if (!segments.length || !progressText) return;
  
  segments.forEach((segment, index) => {
    if (index < workoutCount) {
      segment.classList.add('filled');
    } else {
      segment.classList.remove('filled');
    }
  });
  
  if (window.innerWidth <= 767) {
    const dateRange = getFormattedDateRangeForMobile();
    progressText.textContent = `${workoutCount}/4 workouts (${dateRange})`;
  } else {
    progressText.textContent = `${workoutCount}/4 Workouts This Week`;
  }
  
  if (workoutCount >= 4) {
    updateStreakCounter();
  }
}

function updateWeeklyProgress() {
  updateWeekDateRangeDisplay();
  const workoutCount = countCurrentWeekWorkouts();
  weeklyData.currentWeekWorkouts = workoutCount;
  updateProgressBar(workoutCount);
  updateStreakCounter();
}

// ========== Window Resize Handler ==========
window.addEventListener('resize', function() {
  if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
  this.resizeTimeout = setTimeout(function() {
    drawYearCalendar(currentYear);
    adjustMonthDisplay();
    updateWeekDateRangeDisplay();
    
    const workoutCount = countCurrentWeekWorkouts();
    updateProgressBar(workoutCount);
  }, 200);
});

// ========== Init on Page Load ==========
(async function init() {
  if (!yearData[currentYear]) {
    await loadDataForYear(currentYear);
  }
  drawYearCalendar(currentYear);
  updateYearlyWorkoutCount(currentYear);
  renderLegend();
  adjustMonthDisplay();
  updateWeeklyProgress();
})();
