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

// For tracking browser zoom level
let currentZoomLevel = 1;
const baseZoomWidth = window.innerWidth;
let lastResizeWidth = window.innerWidth;

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
            // Add duration if available
            duration: json.total_time || null
          };
        }
        // If no workout or file not found => no data
        return { day: currentDate.getDate(), muscles: [], volume: 0, exercises: [], duration: null };
      })
      .catch(err => {
        // File not found or parse error => no data
        return { day: currentDate.getDate(), muscles: [], volume: 0, exercises: [], duration: null };
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
  
  // Format the list of exercises with no-wrap to prevent inconsistent line breaks
  const exerciseList = dayData.exercises
    .map(ex => `• <span class="exercise-name">${ex}</span>`)
    .join("<br>");
  
  // Add duration information if available
  let durationInfo = "";
  if (dayData.duration && dayData.duration !== "NaN") {
    durationInfo = dayData.duration;
  }
  
  // Always include the footer separator
  let footerContent = "";
  if (window.matchMedia('(pointer: coarse)').matches) {
    // For mobile, show duration only
    footerContent = durationInfo ? `<div class="duration-value">${durationInfo}</div>` : '';
  } else {
    // For desktop, only show duration if available
    footerContent = durationInfo ? `<div class="duration-value">${durationInfo}</div>` : '';
  }
  
  return `
    <strong>Volume:</strong> ${dayData.volume} Sets<br>
    ${exerciseList}
    <div class="tooltip-footer">${footerContent}</div>
  `;
}

// ========== Detect and Update Zoom Level ==========

function updateZoomLevel() {
  // Primary method: device pixel ratio
  let newZoomLevel = window.devicePixelRatio || 1;
  
  // Only update if zoom changed significantly (prevents minor fluctuations)
  if (Math.abs(newZoomLevel - currentZoomLevel) > 0.05) {
    // Store previous zoom level
    const oldZoomLevel = currentZoomLevel;
    currentZoomLevel = newZoomLevel;
    
    console.log(`Zoom level changed: ${oldZoomLevel.toFixed(2)} -> ${currentZoomLevel.toFixed(2)}`);
    
    // Update any visible tooltip
    const tooltip = document.getElementById("tooltip");
    if (tooltip && tooltip.style.opacity !== "0") {
      updateTooltipSize(tooltip);
    }
  }
}

// Size tooltip according to zoom level
function updateTooltipSize(tooltip) {
  if (!tooltip) return;
  
  // Base sizes (100% zoom)
  const baseFontSize = 0.85; // rem
  const baseMinWidth = 120; // px
  const baseMaxWidth = 200; // px
  const basePaddingH = 12; // px
  const basePaddingV = 8; // px
  
  // Only adjust if zoom is significantly different from 1.0
  if (Math.abs(currentZoomLevel - 1.0) > 0.1) {
    // Apply a more balanced adjustment factor
    // Use square root to make the adjustment more moderate
    let adjustedFactor;
    if (currentZoomLevel > 1.0) {
      // Zoomed in: make tooltip smaller, but not as much
      adjustedFactor = 1.0 / Math.sqrt(currentZoomLevel);
    } else {
      // Zoomed out: make tooltip larger, but not as much
      adjustedFactor = Math.sqrt(1.0 / currentZoomLevel);
    }
    
    // Apply with minimums to prevent too-small tooltips
    tooltip.style.fontSize = `${Math.max(0.7, baseFontSize * adjustedFactor)}rem`;
    tooltip.style.minWidth = `${Math.max(100, baseMinWidth * adjustedFactor)}px`;
    tooltip.style.maxWidth = `${Math.max(160, baseMaxWidth * adjustedFactor)}px`;
    tooltip.style.padding = `${Math.max(6, basePaddingV * adjustedFactor)}px ${Math.max(8, basePaddingH * adjustedFactor)}px`;
  } else {
    // Near normal zoom - use default values
    tooltip.style.fontSize = `${baseFontSize}rem`;
    tooltip.style.minWidth = `${baseMinWidth}px`;
    tooltip.style.maxWidth = `${baseMaxWidth}px`;
    tooltip.style.padding = `${basePaddingV}px ${basePaddingH}px`;
  }
}

// ========== Tooltip Show/Hide ==========
function showTooltip(event, dayData) {
  const tooltipDiv = d3.select("#tooltip");
  
  // Build the HTML content
  tooltipDiv.html(buildTooltipHTML(dayData));

  // Make the tooltip visible first so we can measure it
  tooltipDiv.style("opacity", 1);
  
  // Apply zoom-responsive sizing
  updateTooltipSize(tooltipDiv.node());
  
  // Measure the tooltip after zoom adjustments
  const tooltipNode = tooltipDiv.node();
  const tooltipWidth = tooltipNode.offsetWidth;
  const tooltipHeight = tooltipNode.offsetHeight;
  
  let posX, posY;
  
  // For mobile touchscreen devices
  if (window.matchMedia('(pointer: coarse)').matches) {
    // For touchend event, event.touches will be empty
    // In this case, we need to use the cell's position
    const cell = event.currentTarget || event.target.closest('.cell-wrapper');
    if (!cell) return;
    
    const cellRect = cell.getBoundingClientRect();
    
    // Position tooltip centered below the cell
    posX = cellRect.left + (cellRect.width / 2) - (tooltipWidth / 2);
    posY = cellRect.bottom + 10;
    
    // Add scroll offset to get page coordinates
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    posX += scrollLeft;
    posY += scrollTop;
    
    // Adjust for viewport boundaries
    const viewportWidth = window.innerWidth;
    if (posX < 0) posX = 10;
    if (posX + tooltipWidth > viewportWidth) posX = viewportWidth - tooltipWidth - 10;
  } else {
    // For desktop/mouse devices
    posX = event.pageX;
    posY = event.pageY;
    
    // Decide if we have enough space on the right, else place it on the left
    const spaceToRight = window.innerWidth - posX;
    if (spaceToRight < tooltipWidth + 20) {
      // Not enough space on the right; go left
      posX = posX - tooltipWidth - 10;
    } else {
      // Enough space, place to the right
      posX = posX + 10;
    }
    
    // Vertical positioning
    posY = posY + 10;
  }
  
  // Apply final positioning
  tooltipDiv
    .style("left", posX + "px")
    .style("top", posY + "px")
    .style("pointer-events", "auto"); // Make tooltip interactive on mobile
}

// Add a helper function to ensure all tooltips are closed
function hideAllTooltips() {
  d3.select("#tooltip").style("opacity", 0).style("pointer-events", "none");
  d3.selectAll(".active-tooltip-cell").classed("active-tooltip-cell", false);
  d3.selectAll("rect.cell-background").attr("stroke", "#ddd").attr("stroke-width", 1);
  
  // Remove any active overlay
  removeTooltipOverlay();
}

// Update the existing hideTooltip function
function hideTooltip() {
  hideAllTooltips();
}

// Add this function to fetch workout details including duration
async function fetchWorkoutDetails(year, month, day) {
  const dd = String(day).padStart(2, "0");
  const mm = String(month + 1).padStart(2, "0");
  const yyyy = year;
  const fileName = `data/${dd}-${mm}-${yyyy}.json`;
  
  try {
    const json = await d3.json(fileName);
    if (json && json.total_time) {
      return { duration: json.total_time };
    }
  } catch (err) {
    console.error("Error fetching workout details:", err);
  }
  
  return { duration: null };
}

// ========== Mobile Tooltip Overlay ==========
let isProcessingTouch = false;

// Create a transparent overlay that allows scrolling but captures taps
function createTooltipOverlay() {
  // Remove any existing overlay first
  removeTooltipOverlay();
  
  const overlay = document.createElement("div");
  overlay.id = "tooltip-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.zIndex = "9000";
  overlay.style.background = "transparent";
  
  // This is crucial - we need to handle touch events but allow scrolling
  overlay.style.touchAction = "auto"; 
  
  document.body.appendChild(overlay);
  
  // Listen for single taps on the overlay - use touchstart and touchend together
  // to distinguish taps from scrolls
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  
  // Track if this touch resulted in movement (scrolling)
  let isTouching = false;
  let isScrolling = false;
  
  // Touch start - record position but don't prevent default
  overlay.addEventListener("touchstart", function(e) {
    // Don't do anything if we're already processing a touch
    if (isProcessingTouch) return;
    
    if (e.touches.length === 1) {
      isTouching = true;
      isScrolling = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  });
  
  // Touch move - detect if the user is scrolling
  overlay.addEventListener("touchmove", function(e) {
    if (!isTouching) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    
    // If significant movement, it's a scroll
    if (deltaX > 10 || deltaY > 10) {
      isScrolling = true;
      
      // For horizontal scrolls, immediately remove overlay to allow smooth scrolling
      if (deltaX > deltaY && deltaX > 30) {
        // It's a deliberate horizontal swipe - remove overlay to allow scrolling
        // We're not preventing default to allow natural scrolling
        removeTooltipOverlay();
        hideAllTooltips();
      }
    }
  });
  
  // Touch end - check if it was a tap or a scroll
  overlay.addEventListener("touchend", function(e) {
    if (!isTouching) return;
    
    // Prevent multiple fast taps from causing issues
    isProcessingTouch = true;
    setTimeout(() => { isProcessingTouch = false; }, 100);
    
    // If this was a scroll, just cleanup
    if (isScrolling) {
      isTouching = false;
      return;
    }
    
    // This was a tap - check what was tapped
    const touchDuration = Date.now() - touchStartTime;
    
    // Only process quick taps (under 500ms)
    if (touchDuration < 500) {
      // Get the element that was tapped
      const element = document.elementFromPoint(touchStartX, touchStartY);
      
      // If tapped on a tooltip, do nothing
      if (element && element.closest("#tooltip")) {
        isTouching = false;
        return;
      }
      
      // If tapped on a workout cell, let it handle the tap
      if (element && isWorkoutCell(element)) {
        // Clear current tooltip
        hideAllTooltips();
        
        // Let the cell handle it (synthetic event)
        const cellElement = element.closest(".cell-wrapper");
        if (cellElement) {
          // Dispatch a simulated touch event to the cell
          setTimeout(() => {
            // Find the data for this cell
            const month = parseInt(cellElement.getAttribute("data-month"));
            const dayText = cellElement.querySelector(".dayLabel").textContent;
            const day = parseInt(dayText);
            
            if (yearData[currentYear] && 
                yearData[currentYear][month] && 
                yearData[currentYear][month][day-1]) {
              
              const cellData = yearData[currentYear][month][day-1];
              
              // Only proceed if this is actually a workout cell
              if (cellData.muscles && cellData.muscles.length > 0) {
                // Apply highlighting and create new tooltip
                const rect = d3.select(cellElement).select("rect.cell-background");
                rect.attr("stroke", "#333").attr("stroke-width", 2);
                d3.select(cellElement).classed("active-tooltip-cell", true);
                
                // Create a synthetic event object with required properties
                const syntheticEvent = {
                  currentTarget: cellElement,
                  pageX: touchStartX,
                  pageY: touchStartY
                };
                
                // Show tooltip for this cell
                showTooltip(syntheticEvent, cellData);
                
                // Create new overlay
                createTooltipOverlay();
              }
            }
          }, 50);
        }
      } else {
        // Tapped elsewhere - dismiss the tooltip
        hideAllTooltips();
      }
    }
    
    isTouching = false;
  });
  
  return overlay;
}

// Helper function to check if an element is a workout cell with data
function isWorkoutCell(element) {
  // Find the nearest cell wrapper
  const cellWrapper = element.closest(".cell-wrapper");
  if (!cellWrapper) return false;
  
  // Check if it has a background rect that's not an empty day
  const rect = cellWrapper.querySelector("rect.cell-background");
  return rect && rect.getAttribute("fill") !== "#ebedf0" && rect.getAttribute("fill") !== "none";
}

// Remove the overlay
function removeTooltipOverlay() {
  const overlay = document.getElementById("tooltip-overlay");
  if (overlay) {
    overlay.parentNode.removeChild(overlay);
  }
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
          : { day: dayNumber, muscles: [], volume: 0, exercises: [], duration: null };
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
        .attr("data-month", m)
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

// This function adds tooltip behavior to cells
function addTooltipBehavior(cellSelection, dayData) {
  const rect = cellSelection.select("rect.cell-background");

  // Check for a coarse pointer (likely a touch device)
  if (window.matchMedia('(pointer: coarse)').matches) {
    // Simplified touch handling for mobile
    cellSelection.on("touchend", async function(event) {
      // Prevent double-firing of events
      if (isProcessingTouch) return;
      isProcessingTouch = true;
      
      // Hide any existing tooltips first
      hideAllTooltips();
      
      // Highlight this cell
      rect.attr("stroke", "#333").attr("stroke-width", 2);
      cellSelection.classed("active-tooltip-cell", true);
      
      // Fetch workout details if needed
      if (!dayData.duration && dayData.day) {
        try {
          const year = currentYear;
          const month = +cellSelection.attr("data-month") || 0;
          const details = await fetchWorkoutDetails(year, month, dayData.day);
          dayData.duration = details.duration;
        } catch (err) {
          console.error("Error fetching workout details:", err);
        }
      }
      
      // Show the tooltip
      showTooltip(event, dayData);
      
      // Create overlay to handle taps outside
      createTooltipOverlay();
      
      // Reset processing flag after a short delay
      setTimeout(() => {
        isProcessingTouch = false;
      }, 100);
    });
  } else {
    // Desktop behavior
    cellSelection
      .on("pointerenter", (event) => {
        rect.attr("stroke", "#333").attr("stroke-width", 2);
        showTooltip(event, dayData);
        updateZoomLevel(); // Check zoom level on tooltip show
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

// ========== Window Resize and Zoom Handler ==========
window.addEventListener('resize', function() {
  if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
  this.resizeTimeout = setTimeout(function() {
    drawYearCalendar(currentYear);
    adjustMonthDisplay();
    updateWeekDateRangeDisplay();
    
    const workoutCount = countCurrentWeekWorkouts();
    updateProgressBar(workoutCount);
    updateZoomLevel();
  }, 200);
});

// Listen for zoom events
window.addEventListener('resize', updateZoomLevel);

// Add wheel event listener for desktop zoom detection
window.addEventListener('wheel', function(e) {
  // Only check if it's a zoom (Ctrl+wheel)
  if (e.ctrlKey) {
    setTimeout(updateZoomLevel, 100);
  }
}, { passive: true });

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
  
  // Set initial zoom level
  updateZoomLevel();
})();