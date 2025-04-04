/***********************************************
 * script.js - Simplified version without text wrapping detection
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
  completedWeeks: [] // Added for tracking consecutive weeks
};

// Load saved streak data from localStorage
function loadStreakData() {
  try {
    const savedData = localStorage.getItem('workoutStreakData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Merge with defaults for any missing properties
      weeklyData = {
        currentWeekWorkouts: 0, // Always recalculate this
        weekStreakCount: parsedData.weekStreakCount || 0,
        lastCompletedWeek: parsedData.lastCompletedWeek || null,
        // Add tracking for consecutive weeks
        completedWeeks: parsedData.completedWeeks || []
      };
    } else {
      // Initialize with completedWeeks array if not present
      weeklyData.completedWeeks = [];
    }
  } catch (err) {
    console.error('Error loading streak data:', err);
    // Ensure completedWeeks exists even on error
    weeklyData.completedWeeks = weeklyData.completedWeeks || [];
  }
}

// Save streak data to localStorage
function saveStreakData() {
  try {
    localStorage.setItem('workoutStreakData', JSON.stringify(weeklyData));
  } catch (err) {
    console.error('Error saving streak data:', err);
  }
}

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

// ========== Update Yearly Workout Count ==========
function updateYearlyWorkoutCount(year) {
  const total = computeYearlyWorkoutCount(year);
  
  // Update the header text display
  const countElem = document.getElementById("yearlyWorkoutsCount");
  countElem.textContent = `You have logged ${total} workouts this year`;
  
  // Also update the count in the yearly-workouts-desktop box
  const workoutsCountElem = document.querySelector(".workouts-count");
  if (workoutsCountElem) {
    workoutsCountElem.textContent = total;
  }
}


// ========== Load Data for a Given Year ==========
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
          
          // Use an object to count sets per exercise instead of just collecting names
          let exerciseCounts = {};

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

            // 3) Count sets per exercise
            if (entry["Exercise"]) {
              const exerciseName = entry["Exercise"];
              exerciseCounts[exerciseName] = (exerciseCounts[exerciseName] || 0) + 1;
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

          // Convert exercise counts to array of objects with name and count
          const exercisesWithCounts = Object.entries(exerciseCounts).map(([name, count]) => ({
            name,
            count
          }));

          return {
            day: currentDate.getDate(),
            muscles: musclesList,
            // "volume" is the total sets. Just naming it "volume" for the tooltip
            volume: totalSets,
            // list of exercises with their set counts
            exercises: exercisesWithCounts,
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
  
  // Check if exercises are in the new format (objects with name and count)
  const isNewFormat = dayData.exercises[0] && typeof dayData.exercises[0] === 'object' && 'name' in dayData.exercises[0];
  
  // Format the list of exercises with set counts - with tighter bullet points
  let exerciseList;
  
  if (isNewFormat) {
    exerciseList = dayData.exercises
      .map(ex => `<div class="exercise-line"><span class="bullet">•</span><span class="exercise-name">${ex.name} (${ex.count})</span></div>`)
      .join("");
  } else {
    exerciseList = dayData.exercises
      .map(ex => `<div class="exercise-line"><span class="bullet">•</span><span class="exercise-name">${ex}</span></div>`)
      .join("");
  }
  
  // Add duration information if available - more compact for small tooltips
  let durationInfo = "";
  if (dayData.duration && dayData.duration !== "NaN") {
    durationInfo = dayData.duration;
  }
  
  // Always include the footer separator if we have duration info
  let footerContent = "";
  if (durationInfo) {
    footerContent = `<div class="tooltip-footer"><div class="duration-value">${durationInfo}</div></div>`;
  }
  
  return `
    <div class="tooltip-header"><strong>Volume:</strong> ${dayData.volume} Sets</div>
    <div class="tooltip-exercises">${exerciseList}</div>
    ${footerContent}
  `;
}

// ========== Tooltip Show/Hide ==========
function showTooltip(event, dayData) {
  const tooltipDiv = d3.select("#tooltip");

  
  
  // Build the HTML content
  tooltipDiv.html(buildTooltipHTML(dayData));

  // Get the muscle group color to use for the background
  let bgColor = "#6a6a6a"; // Default fallback color
  
  // If there are muscles, use the first one's color
  if (dayData.muscles && dayData.muscles.length > 0) {
    const firstMuscle = dayData.muscles[0];
    const baseColor = muscleColors[firstMuscle];
    bgColor = darkenColor(baseColor, 0.2);
  }
  
  // Apply the background color
  tooltipDiv.style("background-color", bgColor);
  
  // Adjust text color based on background brightness
  const textColor = isColorDark(bgColor) ? "#ffffff" : "#333333";
  tooltipDiv.style("color", textColor);
  
  // Get the chart container (to keep tooltip within its bounds)
  const chartContainerNode = document.getElementById("chartContainer");
  const chartContainerRect = chartContainerNode.getBoundingClientRect();
  
  // First make the tooltip visible with basic font size so we can measure it
  tooltipDiv
    .style("opacity", 1)
    .style("font-size", "0.85rem") // Reset font size to default
    .style("max-width", "250px"); // Default max width
  
  // Measure the tooltip
  const tooltipNode = tooltipDiv.node();
  let tooltipWidth = tooltipNode.offsetWidth;
  let tooltipHeight = tooltipNode.offsetHeight;
  
  // Keep track of whether we need to reduce font size
  let fontSize = 0.85; // Default font size
  let fontSizeReduced = false;
  const minFontSize = 0.65; // Minimum acceptable font size
  
  // If tooltip is too wide, reduce the max-width to fit the chart width
  if (tooltipWidth > chartContainerRect.width * 0.7) {
    const maxWidth = Math.max(160, Math.floor(chartContainerRect.width * 0.7));
    tooltipDiv.style("max-width", maxWidth + "px");
    tooltipWidth = maxWidth;
  }
  
  // If tooltip is still too large after adjusting width, reduce font size incrementally
  while ((tooltipWidth > chartContainerRect.width * 0.8 || tooltipHeight > chartContainerRect.height * 0.7) && 
         fontSize > minFontSize) {
    fontSize -= 0.05; // Reduce font size in small increments
    fontSizeReduced = true;
    tooltipDiv.style("font-size", fontSize + "rem");
    // Re-measure after font size change
    tooltipWidth = tooltipNode.offsetWidth;
    tooltipHeight = tooltipNode.offsetHeight;
  }
  
  // If font size was reduced, also reduce padding to make better use of space
  if (fontSizeReduced) {
    tooltipDiv.style("padding", "4px 6px");
  } else {
    // Reset padding to normal if not reduced
    tooltipDiv.style("padding", window.matchMedia('(pointer: coarse)').matches ? "14px 18px" : "6px 8px");
  }
  
  let posX, posY;
  
  // IMPROVED MOBILE AND DESKTOP POSITIONING THAT STAYS WITHIN CONTAINER
  if (window.matchMedia('(pointer: coarse)').matches) {
    const cell = event.currentTarget || event.target.closest('.cell-wrapper');
    if (!cell) return;
    
    const cellRect = cell.getBoundingClientRect();
    
    // Get viewport dimensions and scroll offsets
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate chart container boundaries accounting for scroll
    const containerLeft = chartContainerRect.left + scrollLeft;
    const containerRight = containerLeft + chartContainerRect.width;
    const containerTop = chartContainerRect.top + scrollTop;
    const containerBottom = containerTop + chartContainerRect.height;
    
    // Position tooltip centered above the cell by default
    posY = cellRect.top - tooltipHeight - 10 + scrollTop;
    
    // If not enough room above, position below
    if (posY < containerTop) {
      posY = cellRect.bottom + 10 + scrollTop;
    }
    
    // If still outside container vertically, place it at the top of the container with small margin
    if (posY < containerTop) {
      posY = containerTop + 5;
    }
    
    // If would go beyond bottom of container, reposition to stay within
    if (posY + tooltipHeight > containerBottom) {
      posY = containerBottom - tooltipHeight - 5;
    }
    
    // Center horizontally but ensure it's within chart container
    posX = cellRect.left + (cellRect.width / 2) - (tooltipWidth / 2) + scrollLeft;
    
    // Make sure tooltip is fully visible horizontally within chart container
    if (posX < containerLeft) {
      posX = containerLeft + 5;
    }
    if (posX + tooltipWidth > containerRight) {
      posX = containerRight - tooltipWidth - 5;
    }
  } else {
    // Desktop positioning - improved to stay within chart container
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate chart container boundaries with scroll offset
    const containerLeft = chartContainerRect.left + scrollLeft;
    const containerRight = containerLeft + chartContainerRect.width;
    const containerTop = chartContainerRect.top + scrollTop;
    const containerBottom = containerTop + chartContainerRect.height;
    
    // Initial position based on mouse cursor
    posX = event.pageX + 10;
    posY = event.pageY + 10;
    
    // Check right edge
    if (posX + tooltipWidth > containerRight) {
      posX = event.pageX - tooltipWidth - 10;
    }
    
    // If still outside left edge, align with left edge
    if (posX < containerLeft) {
      posX = containerLeft + 5;
    }
    
    // Check bottom edge
    if (posY + tooltipHeight > containerBottom) {
      posY = containerBottom - tooltipHeight - 5;
    }
    
    // Check top edge
    if (posY < containerTop) {
      posY = containerTop + 5;
    }
  }
  
  // Apply final positioning
  tooltipDiv
    .style("left", posX + "px")
    .style("top", posY + "px")
    .style("pointer-events", "auto");
}


function updateTooltipStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    /* Additional tooltip styles for better text handling */
    .tooltip-exercises {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .exercise-line {
      white-space: normal !important; /* Override the nowrap to allow wrapping */
      margin-bottom: 3px;
    }
    
    .exercise-name {
      word-break: break-word;
    }
  `;
  document.head.appendChild(styleElement);
}

// Call this function during initialization
document.addEventListener('DOMContentLoaded', updateTooltipStyles);

// Helper function to darken color
function darkenColor(hexColor, factor) {
  // Parse hex color
  let r = parseInt(hexColor.substring(1, 3), 16);
  let g = parseInt(hexColor.substring(3, 5), 16);
  let b = parseInt(hexColor.substring(5, 7), 16);
  
  // Darken each component
  r = Math.floor(r * (1 - factor));
  g = Math.floor(g * (1 - factor));
  b = Math.floor(b * (1 - factor));
  
  // Ensure values are within bounds
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  
  // Convert back to hex
  return `rgba(${r}, ${g}, ${b}, 0.95)`;
}

// Helper function to determine if a color is dark (for text contrast)
function isColorDark(color) {
  // Extract RGB values
  let rgb;
  
  // Handle rgba format
  if (color.startsWith('rgba')) {
    const values = color.match(/\d+/g);
    rgb = [parseInt(values[0]), parseInt(values[1]), parseInt(values[2])];
  } 
  // Handle hex format
  else if (color.startsWith('#')) {
    const r = parseInt(color.substring(1, 3), 16);
    const g = parseInt(color.substring(3, 5), 16);
    const b = parseInt(color.substring(5, 7), 16);
    rgb = [r, g, b];
  }
  
  // Calculate relative luminance
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  
  // Return true if color is dark (luminance < 0.5)
  return luminance < 0.5;
}

// Add a helper function to ensure all tooltips are closed
function hideAllTooltips() {
  d3.select("#tooltip").style("opacity", 0).style("pointer-events", "none");
  d3.selectAll(".active-tooltip-cell").classed("active-tooltip-cell", false);
  d3.selectAll("rect.cell-background").attr("stroke", "#ddd").attr("stroke-width", 1);
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
    
    // Return duration if available
    if (json && json.total_time) {
      // Also process exercise counts if workout data is available
      if (json && Array.isArray(json.workout) && json.workout.length > 0) {
        let exerciseCounts = {};
        
        // Count exercises
        json.workout.forEach(entry => {
          if (entry["Exercise"]) {
            const exerciseName = entry["Exercise"];
            exerciseCounts[exerciseName] = (exerciseCounts[exerciseName] || 0) + 1;
          }
        });
        
        // Convert to array of objects
        const exercisesWithCounts = Object.entries(exerciseCounts).map(([name, count]) => ({
          name,
          count
        }));
        
        return { 
          duration: json.total_time,
          exercises: exercisesWithCounts
        };
      }
      
      return { duration: json.total_time };
    }
  } catch (err) {
    console.error("Error fetching workout details:", err);
  }
  
  return { duration: null, exercises: [] };
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
  
  // Determine how many months should be visible
  let targetMonthsVisible;
  if (containerWidth < 480) {
    targetMonthsVisible = Math.min(2, monthBlocks.length);
  } else {
    targetMonthsVisible = Math.min(3, monthBlocks.length);
  }
  
  // Calculate ideal month width - ensure equal distribution
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
  
  // Get current month
  const now = new Date();
  let currentMonth = now.getMonth();
  
  // Width of a single month block including margin
  const monthBlockWidth = idealMonthWidth + 5;
  
  // If current month fits within the targetMonthsVisible from the beginning,
  // no need to scroll (January should be leftmost)
  if (currentMonth < targetMonthsVisible) {
    chartContainer.scrollLeft = 0;
  } else {
    // Current month should be the rightmost visible month
    // So the leftmost month would be (currentMonth - (targetMonthsVisible - 1))
    const firstVisibleMonth = currentMonth - (targetMonthsVisible - 1);
    chartContainer.scrollLeft = firstVisibleMonth * monthBlockWidth;
  }
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
  const margin = { top: 50, right: 20, bottom: 10, left: 20 };
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

// This is inside the touchstart event handler
function addTooltipBehavior(cellSelection, dayData) {
  const rect = cellSelection.select("rect.cell-background");

  // Check for a coarse pointer (likely a touch device)
  if (window.matchMedia('(pointer: coarse)').matches) {
    // Variables to track touch behavior
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTouchMoving = false;
    const MOVE_THRESHOLD = 10; // pixels of movement to consider it a scroll not a tap
    const TIME_THRESHOLD = 25; // milliseconds to wait before considering it a deliberate tap

    // Touch start handler
    cellSelection.on("touchstart", (event) => {
      // Don't prevent default here to allow scrolling
      
      // Record starting position and time
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isTouchMoving = false;
    });
    
    // Touch move handler
    cellSelection.on("touchmove", (event) => {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);
      
      // If movement exceeds threshold, consider it a scroll
      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        isTouchMoving = true;
      }
    });
    
    // Touch end handler
    cellSelection.on("touchend", async (event) => {
      const touchDuration = Date.now() - touchStartTime;
      
      // Only show tooltip if:
      // 1. Touch wasn't moving (not scrolling)
      // 2. Touch was long enough to be deliberate
      if (!isTouchMoving && touchDuration > TIME_THRESHOLD) {
        event.preventDefault();
        event.stopPropagation();
        
        // Get additional workout details including duration and exercise counts
        if (dayData.day) {
          try {
            const year = currentYear;
            const month = +cellSelection.attr("data-month") || 0;
            const details = await fetchWorkoutDetails(year, month, dayData.day);
            
            // Update duration if available
            if (details.duration) {
              dayData.duration = details.duration;
            }
            
            // Update exercises with counts if available
            if (details.exercises && details.exercises.length > 0) {
              // If exercises were in the old format (array of strings), 
              // or we don't have exercise data yet, use the fetched data
              const hasExerciseObjects = dayData.exercises && 
                                         dayData.exercises.length > 0 && 
                                         typeof dayData.exercises[0] === 'object' &&
                                         'count' in dayData.exercises[0];
              
              if (!hasExerciseObjects) {
                // Convert the existing exercises array to a set for easy lookup
                const exerciseNames = new Set(
                  Array.isArray(dayData.exercises) ? dayData.exercises : []
                );
                
                // If we had existing exercise names, filter to match them
                // Otherwise use all fetched exercises
                if (exerciseNames.size > 0) {
                  dayData.exercises = details.exercises.filter(ex => 
                    exerciseNames.has(ex.name)
                  );
                } else {
                  dayData.exercises = details.exercises;
                }
              }
            }
          } catch (err) {
            console.error("Error fetching workout details:", err);
          }
        }
        
        // Check if we're clicking on the same cell or a new one
        const isNewCell = !cellSelection.classed("active-tooltip-cell");
        
        // If there's already an active tooltip for another cell, update it for this cell
        if (d3.select("#tooltip").style("opacity") == 1 && isNewCell) {
          // Hide previous cell highlight
          d3.selectAll(".active-tooltip-cell").classed("active-tooltip-cell", false);
          d3.selectAll("rect.cell-background").attr("stroke", "#ddd").attr("stroke-width", 1);
          
          // Highlight the new cell
          rect.attr("stroke", "#333").attr("stroke-width", 2);
          cellSelection.classed("active-tooltip-cell", true);
          
          // Show the tooltip for this cell
          showTooltip(event, dayData);
          return;
        }
        
        // If tooltip is not showing yet or this is the same cell again
        if (isNewCell) {
          // Hide any existing tooltip first (in case another one is open)
          hideAllTooltips();
          
          // Highlight the selected cell
          rect.attr("stroke", "#333").attr("stroke-width", 2);
          
          // Mark this cell as active
          cellSelection.classed("active-tooltip-cell", true);
          
          // Show the tooltip
          showTooltip(event, dayData);
          
          // Add a semi-transparent overlay to make it clear the tooltip is modal
          const overlay = document.getElementById("tooltip-overlay");
          if (!overlay) {
            const newOverlay = document.createElement("div");
            newOverlay.id = "tooltip-overlay";
            newOverlay.style.position = "fixed";
            newOverlay.style.top = "0";
            newOverlay.style.left = "0";
            newOverlay.style.right = "0";
            newOverlay.style.bottom = "0";
            newOverlay.style.zIndex = "9000";
            newOverlay.style.background = "transparent";
            document.body.appendChild(newOverlay);
            
            // Listen for taps on the overlay to dismiss
            newOverlay.addEventListener("touchstart", handleOverlayTap);
          }
        }
      }
      
      function handleOverlayTap(e) {
        // Check if the tap is on another workout cell
        const targetIsCell = e.target.closest(".cell-wrapper") && 
                           e.target.closest(".cell-wrapper").querySelector("rect.cell-background").getAttribute("fill") !== "#ebedf0";
        
        // If tapped on a cell, don't prevent the event - let it bubble to the cell's event handler
        if (targetIsCell) {
          return;
        }
        
        // If not on a tooltip or cell, close the tooltip
        if (!e.target.closest("#tooltip") && !targetIsCell) {
          e.preventDefault();
          e.stopPropagation();
          
          // Clean up
          hideAllTooltips();
          
          // Remove the overlay
          const overlay = document.getElementById("tooltip-overlay");
          if (overlay) {
            overlay.removeEventListener("touchstart", handleOverlayTap);
            document.body.removeChild(overlay);
          }
        }
      }
    });
  } else {
    // Desktop and fine pointer devices
    cellSelection
      .on("pointerenter", async (event) => {
        rect.attr("stroke", "#333").attr("stroke-width", 2);
        
        // For desktop, we can also update exercise data before showing the tooltip
        if (dayData.day) {
          try {
            const year = currentYear;
            const month = +cellSelection.attr("data-month") || 0;
            const details = await fetchWorkoutDetails(year, month, dayData.day);
            
            // Update duration if available
            if (details.duration) {
              dayData.duration = details.duration;
            }
            
            // Update exercises with counts if available and if not already in the right format
            if (details.exercises && details.exercises.length > 0) {
              const hasExerciseObjects = dayData.exercises && 
                                        dayData.exercises.length > 0 && 
                                        typeof dayData.exercises[0] === 'object' &&
                                        'count' in dayData.exercises[0];
              
              if (!hasExerciseObjects) {
                const exerciseNames = new Set(
                  Array.isArray(dayData.exercises) ? dayData.exercises : []
                );
                
                if (exerciseNames.size > 0) {
                  dayData.exercises = details.exercises.filter(ex => 
                    exerciseNames.has(ex.name)
                  );
                } else {
                  dayData.exercises = details.exercises;
                }
              }
            }
          } catch (err) {
            console.error("Error fetching workout details:", err);
          }
        }
        
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

// Get formatted date range for current week
function getFormattedDateRange() {
  const { startDate, endDate } = getCurrentWeekDateRange();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  
  if (startMonth === endMonth) {
    const monthName = monthNames[startMonth];
    return `${monthName} ${startDate.getDate()} - ${endDate.getDate()}`;
  } else {
    const startMonthName = monthNames[startMonth];
    const endMonthName = monthNames[endMonth];
    return `${startMonthName} ${startDate.getDate()} - ${endMonthName} ${endDate.getDate()}`;
  }
}

function getCurrentWeekDateRange() {
  const now = new Date();
  const currentDay = now.getDay(); 
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - currentDay);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return { startDate, endDate };
}

function updateWeekDateRangeDisplay() {
  const dateRangeElem = document.getElementById('weekDateRange');
  if (!dateRangeElem) return;
  
  const dateRange = getFormattedDateRange();
  dateRangeElem.textContent = dateRange;
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
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Get the dates for the previous week
  const { startDate } = getCurrentWeekDateRange();
  
  const prevWeekEnd = new Date(startDate);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
  
  let count = 0;
  const prevWeekYear = prevWeekStart.getFullYear();
  
  // Ensure data exists for the year we're checking
  if (!yearData[prevWeekYear]) return false;
  
  for (let day = new Date(prevWeekStart); day <= prevWeekEnd; day.setDate(day.getDate() + 1)) {
    const dayYear = day.getFullYear();
    const month = day.getMonth();
    const dayOfMonth = day.getDate() - 1;
    
    // Skip if we don't have data for this day
    if (!yearData[dayYear] || !yearData[dayYear][month] || 
        !yearData[dayYear][month][dayOfMonth]) {
      continue;
    }
    
    // Count if there was a workout
    if (yearData[dayYear][month][dayOfMonth].muscles && 
        yearData[dayYear][month][dayOfMonth].muscles.length > 0) {
      count++;
    }
  }
  
  return count >= 4;
}

// Helper function to convert week key back to date
function getDateFromWeekKey(weekKey) {
  const [year, month, day] = weekKey.split('-').map(Number);
  return new Date(year, month, day);
}

// IMPROVED: Completely rewritten updateStreakCounter function
function updateStreakCounter() {
  const prevWeekCompleted = checkPreviousWeekCompleted();
  const currentWeekCount = countCurrentWeekWorkouts();
  const currentWeekCompleted = currentWeekCount >= 4;
  
  // Get week identifiers for current and previous week
  const { startDate } = getCurrentWeekDateRange();
  const currentWeekKey = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
  
  // Get previous week key
  const prevWeekEnd = new Date(startDate);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekEnd.getDate() - 6);
  const prevWeekKey = `${prevWeekStart.getFullYear()}-${prevWeekStart.getMonth()}-${prevWeekStart.getDate()}`;
  
  // Initialize completedWeeks array if it doesn't exist
  if (!Array.isArray(weeklyData.completedWeeks)) {
    weeklyData.completedWeeks = [];
  }
  
  // Handle current week completion
  if (currentWeekCompleted && !weeklyData.completedWeeks.includes(currentWeekKey)) {
    weeklyData.completedWeeks.push(currentWeekKey);
    weeklyData.lastCompletedWeek = currentWeekKey;
  }
  
  // Handle previous week tracking
  const hadPrevWeekCompleted = weeklyData.completedWeeks.includes(prevWeekKey);
  if (prevWeekCompleted && !hadPrevWeekCompleted) {
    // If we just detected that previous week was completed but wasn't in our records
    weeklyData.completedWeeks.push(prevWeekKey);
  }
  
  // Sort completed weeks chronologically
  weeklyData.completedWeeks.sort();
  
  // Calculate streak by checking for consecutive weeks
  let streak = 0;
  const sortedWeeks = [...weeklyData.completedWeeks].sort();
  
  if (sortedWeeks.length > 0) {
    // Start with at least 1 for the most recent completed week
    streak = 1;
    
    // Go backwards from the most recent week
    for (let i = sortedWeeks.length - 1; i > 0; i--) {
      const currentWeek = getDateFromWeekKey(sortedWeeks[i]);
      const previousWeek = getDateFromWeekKey(sortedWeeks[i-1]);
      
      // Check if these weeks are consecutive (7 days apart)
      const dayDiff = Math.round((currentWeek - previousWeek) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 7) {
        streak++;
      } else {
        // Break on first non-consecutive week
        break;
      }
    }
  }
  
  // Update the streak count
  weeklyData.weekStreakCount = streak;
  
  // Save updated streak data
  saveStreakData();
  
  // Update the streak display with proper pluralization
  const streakNumber = document.querySelector('.streak-number');
  const streakUnit = document.querySelector('.streak-unit');
  
  if (streakNumber && streakUnit) {
    streakNumber.textContent = weeklyData.weekStreakCount;
    streakUnit.textContent = weeklyData.weekStreakCount === 1 ? 'Week' : 'Weeks';
  }
}

function updateProgressBar(workoutCount) {
  const segments = document.querySelectorAll('.segment');
  const progressCount = document.querySelector('.progress-count');
  
  if (!segments.length) return;
  
  // Fill in segments based on workout count
  segments.forEach((segment, index) => {
    if (index < workoutCount) {
      segment.classList.add('filled');
    } else {
      segment.classList.remove('filled');
    }
  });
  
  // Update the count text
  if (progressCount) {
    progressCount.textContent = `${workoutCount}/4`;
    
    // Optional: Adjust color if all segments are filled
    if (workoutCount >= 4) {
      progressCount.style.color = '#fff'; // White text for better contrast
    } else {
      progressCount.style.color = '#5e5e5e'; // Blue text otherwise
    }
  }
  
  if (workoutCount >= 4) {
    updateStreakCounter();
  }
}

// Function to update weekly progress
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
    renderLegend(); // Make sure legend is properly rendered on resize
    
    const workoutCount = countCurrentWeekWorkouts();
    updateProgressBar(workoutCount);
    updateStreakCounter(); // Update streak display
    
    // Re-initialize all fitty elements
    initializeAllFitty();
  }, 200);
});

// ========== Vertical Alignment and Structure Helpers ==========

// Create or update the DOM structure for alignment
function updateProgressContainerStructure() {
  const progressContainer = document.getElementById('weeklyProgressContainer');
  const streakContainer = document.querySelector('.streak-container');
  
  if (!progressContainer || !streakContainer) return;
  
  // Skip if already updated
  if (progressContainer.querySelector('.progress-title-wrapper')) return;
  
  // --- Progress Container Structure ---
  
  // 1. Create title wrapper if needed
  const titleElement = progressContainer.querySelector('.progress-title');
  if (titleElement && !titleElement.parentNode.classList.contains('progress-title-wrapper')) {
    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'progress-title-wrapper';
    titleElement.parentNode.insertBefore(titleWrapper, titleElement);
    titleWrapper.appendChild(titleElement);
  }
  
  // 2. Create middle wrapper if needed
  const progressBarElement = progressContainer.querySelector('.progress-container');
  if (progressBarElement && !progressBarElement.parentNode.classList.contains('progress-middle-wrapper')) {
    const middleWrapper = document.createElement('div');
    middleWrapper.className = 'progress-middle-wrapper';
    progressBarElement.parentNode.insertBefore(middleWrapper, progressBarElement);
    middleWrapper.appendChild(progressBarElement);
  }
  
  // 3. Create bottom wrapper if needed
  const dateRangeElement = document.getElementById('weekDateRange');
  if (dateRangeElement && !dateRangeElement.parentNode.classList.contains('progress-bottom-wrapper')) {
    const bottomWrapper = document.createElement('div');
    bottomWrapper.className = 'progress-bottom-wrapper';
    dateRangeElement.parentNode.insertBefore(bottomWrapper, dateRangeElement);
    bottomWrapper.appendChild(dateRangeElement);
  }
  
  // --- Streak Container Structure ---
  // We don't want to change the streak container's HTML structure directly,
  // but we'll add a middle wrapper that will help with alignment
  
  const streakNumber = streakContainer.querySelector('.streak-number');
  if (streakNumber && !streakContainer.querySelector('.streak-middle-wrapper')) {
    const middleWrapper = document.createElement('div');
    middleWrapper.className = 'streak-middle-wrapper';
    streakNumber.parentNode.insertBefore(middleWrapper, streakNumber);
    middleWrapper.appendChild(streakNumber);
  }
}

// Initialize fitty for all text elements
function initializeAllFitty() {
  // Progress container
  fitty('.progress-title', {
    multiLine: false,
    minSize: 12,
    maxSize: 20
  });
  
  fitty('#weekDateRange', {
    multiLine: false,
    minSize: 10,
    maxSize: 16
  });
  
  // Streak container (already in your code)
  fitty('.streak-title', {
    multiLine: false,
    minSize: 12,
    maxSize: 20
  });
  
  fitty('.streak-subtitle', {
    multiLine: false,
    minSize: 10,
    maxSize: 16
  });
}

// Replace the original initializeStreakTitle function 
function initializeStreakTitle() {
  // First update DOM structure
  updateProgressContainerStructure();
  
  // Then initialize fitty for proper text scaling
  initializeAllFitty();
}

// ========== Init on Page Load ==========
document.addEventListener('DOMContentLoaded', function() {
  // Run structure updates
  updateProgressContainerStructure();
  
  // Initialize fitty for all text elements
  initializeAllFitty();
});

// ========== Init on Page Load ==========
(async function init() {
  // Load streak data first
  loadStreakData();
  
  if (!yearData[currentYear]) {
    await loadDataForYear(currentYear);
  }
  drawYearCalendar(currentYear);
  updateYearlyWorkoutCount(currentYear);
  renderLegend();
  adjustMonthDisplay();
  updateWeeklyProgress();

  // This now calls our enhanced version that handles both containers
  initializeStreakTitle();
  
  // Also load previous year data if needed for streak calculation
  const prevYear = currentYear - 1;
  if (!yearData[prevYear]) {
    await loadDataForYear(prevYear);
  }
})();