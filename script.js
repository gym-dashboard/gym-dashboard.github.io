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

// ADD THIS NEW GLOBAL VARIABLE
let yearlyWorkoutHours = {};  // Track hours worked out per year

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


// Function to parse workout time string into decimal hours
function parseWorkoutTime(timeString) {
  if (!timeString) return 0;
  
  let hours = 0;
  let minutes = 0;
  
  // Extract hours
  const hoursMatch = timeString.match(/(\d+)\s+hours?/);
  if (hoursMatch) {
    hours = parseInt(hoursMatch[1], 10);
  }
  
  // Extract minutes
  const minutesMatch = timeString.match(/(\d+)\s+minutes?/);
  if (minutesMatch) {
    minutes = parseInt(minutesMatch[1], 10);
  }
  
  // Convert minutes to decimal hours and add to hours
  return hours + (minutes / 60);
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
  yearSelect.blur();
  currentYear = +yearSelect.value;
  if (!yearData[currentYear]) {
    loadDataForYear(currentYear).then(() => {
      drawYearCalendar(currentYear);
      updateYearlyWorkoutCount(currentYear);
      updateYearlyActiveHours(currentYear);
      renderLegend();
      adjustMonthDisplay();
      updateWeeklyProgress(); 
      // Add font resize handler call here
      handleFittyResize();
    });
  } else {
    drawYearCalendar(currentYear);
    updateYearlyWorkoutCount(currentYear);
    updateYearlyActiveHours(currentYear);
    renderLegend();
    adjustMonthDisplay();
    updateWeeklyProgress();
    // Add font resize handler call here
    handleFittyResize();
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

// ========== Update Yearly Active Hours ==========
function updateYearlyActiveHours(year) {
  const totalHours = yearlyWorkoutHours[year] || 0;
  const formattedHours = totalHours.toFixed(1);
  
  const activeHoursElem = document.querySelector('.yearly-workouts-desktop .streak-number');
  if (activeHoursElem) {
    activeHoursElem.textContent = formattedHours;
  }
  
  // Update the subtitle to show the current year
  // const yearElem = document.querySelector('.yearly-workouts-desktop .streak-subtitle');
  // if (yearElem) {
  //   yearElem.textContent = year;
  // }
}


// ========== Load Data for a Given Year ==========
async function loadDataForYear(year) {
  yearData[year] = Array.from({ length: 12 }, () => []);
  workoutFiles[year] = [];
  yearlyWorkoutHours[year] = 0;
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
        // Consider the file as a valid workout day if:
        // 1) There is a non-empty workout array, or
        // 2) There is a total_time and a non-empty overall_muscle_group
        if (
          json &&
          (
            (Array.isArray(json.workout) && json.workout.length > 0) ||
            (json.total_time && Array.isArray(json.overall_muscle_group) && json.overall_muscle_group.length > 0)
          )
        ) {
          workoutFiles[year].push(fileName);

          // Track workout hours if total_time is available
          if (json.total_time) {
            yearlyWorkoutHours[year] += parseWorkoutTime(json.total_time);
          }

          // Process workout data: treat each exercise line as one set
          let totalSets = 0;
          let exerciseCounts = {};
          let volumeMap = {};
          muscleGroups.forEach(mg => volumeMap[mg] = 0);

          if (Array.isArray(json.workout) && json.workout.length > 0) {
            json.workout.forEach(entry => {
              totalSets += 1;

              // Gather muscle volume if available
              const mg = entry["Muscle-Group"] || "Unknown";
              if (muscleGroups.includes(mg)) {
                const reps = +entry.Reps || 0;
                const weight = parseFloat(entry.Weight) || 0;
                volumeMap[mg] += (reps * weight);
              }

              // Count sets per exercise
              if (entry["Exercise"]) {
                const exerciseName = entry["Exercise"];
                exerciseCounts[exerciseName] = (exerciseCounts[exerciseName] || 0) + 1;
              }
            });
          }

          // Decide which muscle(s) to color for that day.
          // Prefer overall_muscle_group if available, otherwise compute a fallback.
          let musclesList = [];
          if (Array.isArray(json.overall_muscle_group) && json.overall_muscle_group.length) {
            musclesList = json.overall_muscle_group.filter(mg => muscleGroups.includes(mg));
          } else {
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

          // Convert exercise counts to an array of objects with name and count
          const exercisesWithCounts = Object.entries(exerciseCounts).map(([name, count]) => ({
            name,
            count
          }));

          return {
            day: currentDate.getDate(),
            muscles: musclesList,
            volume: totalSets, // total number of sets
            exercises: exercisesWithCounts,
            duration: json.total_time || null
          };
        }
        // If the file does not meet the criteria, mark the day as inactive
        return { day: currentDate.getDate(), muscles: [], volume: 0, exercises: [], duration: null };
      })
      .catch(err => {
        // File not found or parse error: mark the day as inactive
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




// Height constraints
const TOOLTIP_MAX_HEIGHT_PERCENT = 0.8; // 60% of chart container height

// Font sizes
const TOOLTIP_MOBILE_FONT_SIZE = 0.85; // rem
const TOOLTIP_DESKTOP_INITIAL_FONT_SIZE = 0.7; // rem
const TOOLTIP_DESKTOP_MIN_FONT_SIZE = 0.55; // rem
const TOOLTIP_FONT_REDUCTION_STEP = 0.05; // rem

// Touch behavior
const TOUCH_AREA_PADDING = 5; // px
const TOUCH_MOVE_THRESHOLD = 20; // px
const TOUCH_TIME_THRESHOLD = 15; // ms
const TOUCH_LONG_PRESS_DURATION = 300; // ms

// Width constraints
const TOOLTIP_MOBILE_MAX_WIDTH = "85%";
const TOOLTIP_DESKTOP_MAX_WIDTH = "280px";

// Padding
const TOOLTIP_MOBILE_PADDING = "10px 12px";
const TOOLTIP_DESKTOP_PADDING = "6px 8px";


// ========== Tooltip Content Builder ==========
function handleOverlayTap(e) {
  // Prevent default behavior
  e.preventDefault();
  e.stopPropagation();
  
}

// ========== Tooltip Show/Hide ==========
// Replace your showTooltip function with this version

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
  
  // Reset all styles first
  tooltipDiv
    .style("max-height", null)
    .style("overflow-y", null)
    .style("font-size", null)
    .style("max-width", null)
    .style("padding", null)
    .style("opacity", 1);
  
  // Add tablet detection - consider devices with width >= 768px as tablets
  const isTablet = window.innerWidth >= 768;
  
  // Detect device type - but treat tablets as desktop
  const isMobile = window.matchMedia('(pointer: coarse)').matches && !isTablet;
  tooltipDiv.classed("mobile-tooltip", isMobile);
  
  // DIFFERENT APPROACHES FOR DESKTOP/TABLET VS PHONE
  if (isMobile) {
    // ===== PHONE APPROACH =====
    tooltipDiv
      .style("width", "auto")    
      .style("max-width", "85%") 
      .style("pointer-events", "auto")
      .style("z-index", "9999")
      .style("touch-action", "pan-x pan-y"); // Allow zooming and panning
    
    // Calculate target height (60% of chart container)
    const targetHeight = Math.floor(chartContainerRect.height * TOOLTIP_MAX_HEIGHT_PERCENT);
    
    // Measure tooltip
    const tooltipNode = tooltipDiv.node();
    let tooltipWidth = tooltipNode.offsetWidth;
    let tooltipHeight = tooltipNode.offsetHeight;
    
    // If tooltip exceeds target height, enable scrolling for exercises
    if (tooltipHeight > targetHeight) {
      // Get heights of header and footer (if any)
      const header = tooltipDiv.select(".tooltip-header").node();
      const footer = tooltipDiv.select(".tooltip-footer").node();
      
      const headerHeight = header ? header.offsetHeight : 0;
      const footerHeight = footer ? footer.offsetHeight : 0;
      
      // Available height for exercises section
      const availableHeight = targetHeight - headerHeight - footerHeight - 20; // 20px for padding/margin
      
      // Enable scrolling on exercises container
      tooltipDiv.select(".tooltip-exercises")
        .style("max-height", availableHeight + "px")
        .style("overflow-y", "auto");
      
      // Set overall tooltip height to target
      tooltipDiv.style("max-height", targetHeight + "px");
      tooltipHeight = targetHeight;
    }
    
    // Position in center of chart
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate chart container boundaries
    const containerLeft = chartContainerRect.left + scrollLeft;
    const containerRight = containerLeft + chartContainerRect.width;
    const containerTop = chartContainerRect.top + scrollTop;
    const containerBottom = containerTop + chartContainerRect.height;
    
    // Center the tooltip
    let posX = containerLeft + (chartContainerRect.width / 2) - (tooltipWidth / 2);
    let posY = containerTop + (chartContainerRect.height / 2) - (tooltipHeight / 2);
    
    // Ensure tooltip stays within container boundaries
    if (posX < containerLeft) posX = containerLeft + 5;
    if (posX + tooltipWidth > containerRight) posX = containerRight - tooltipWidth - 5;
    if (posY < containerTop) posY = containerTop + 5;
    if (posY + tooltipHeight > containerBottom) posY = containerBottom - tooltipHeight - 5;
    
    tooltipDiv
      .style("left", posX + "px")
      .style("top", posY + "px");
  } else {
    // ===== DESKTOP AND TABLET APPROACH =====
    // For desktop/tablet: no scrolling, shrink content to fit if possible
    tooltipDiv
      .style("pointer-events", "none") // No scrolling on desktop
      .style("max-width", TOOLTIP_DESKTOP_MAX_WIDTH)
      .style("padding", TOOLTIP_DESKTOP_PADDING);
    
    // Calculate target height (60% of chart container)
    const targetHeight = Math.floor(chartContainerRect.height * TOOLTIP_MAX_HEIGHT_PERCENT);
    
    // Start with initial font size
    let fontSize = TOOLTIP_DESKTOP_INITIAL_FONT_SIZE;
    tooltipDiv.style("font-size", fontSize + "rem");
    
    // Measure the tooltip
    const tooltipNode = tooltipDiv.node();
    let tooltipWidth = tooltipNode.offsetWidth;
    let tooltipHeight = tooltipNode.offsetHeight;
    
    // Try to reduce font size if tooltip exceeds target height
    const minFontSize = TOOLTIP_DESKTOP_MIN_FONT_SIZE;
    
    while (tooltipHeight > targetHeight && fontSize > minFontSize) {
      fontSize -= TOOLTIP_FONT_REDUCTION_STEP;
      tooltipDiv.style("font-size", fontSize + "rem");
      
      // Re-measure
      tooltipHeight = tooltipNode.offsetHeight;
    }
    
    // Desktop: Position near cursor
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate chart container boundaries
    const containerLeft = chartContainerRect.left + scrollLeft;
    const containerRight = containerLeft + chartContainerRect.width;
    const containerTop = chartContainerRect.top + scrollTop;
    const containerBottom = containerTop + chartContainerRect.height;
    
    // Position near cursor
    let posX = event.pageX + 15;
    let posY = event.pageY + 15;
    
    // Check right edge
    if (posX + tooltipWidth > containerRight) {
      posX = event.pageX - tooltipWidth - 15;
    }
    
    // If still outside left edge, align with left edge
    if (posX < containerLeft) {
      posX = containerLeft + 5;
    }
    
    // Check if tooltip would extend below bottom of chart
    if (posY + tooltipHeight > containerBottom) {
      // First try to position above cursor
      if (event.pageY - tooltipHeight - 15 >= containerTop) {
        posY = event.pageY - tooltipHeight - 15;
      } else {
        // If too tall to fit above or below, position at top of chart with small offset
        posY = containerTop + 5;
      }
    }
    
    // Check top edge
    if (posY < containerTop) {
      posY = containerTop + 5;
    }
    
    tooltipDiv
      .style("left", posX + "px")
      .style("top", posY + "px");
  }
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
  d3.selectAll("rect.cell-background[stroke-dasharray]").attr("stroke-dasharray", "4,2");
  
  // Remove the overlay to allow normal interaction again
  const overlay = document.getElementById("tooltip-overlay");
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

// Update the existing hideTooltip function
function hideTooltip() {
  hideAllTooltips();
}

// Add this function to fetch workout details including duration
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
  
  // Array to store overflow days from previous month
  let overflowDays = [];

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
    
    // Calculate if we have overflow days
    const totalCellsNeeded = firstDay + numDays;
    const hasOverflow = totalCellsNeeded > 35; // 5 rows × 7 columns
    
    // Calculate how many days overflow
    const overflowCount = hasOverflow ? totalCellsNeeded - 35 : 0;
    
    // Create cells array for this month
    let cells = [];
    let nextMonthOverflowDays = []; // Store overflow days for next month
    
    // Fill with overflow days from previous month if available
    const emptyStartCells = firstDay;
    let overflowIndex = 0;
    
    for (let i = 0; i < emptyStartCells; i++) {
      if (overflowDays.length > 0 && overflowIndex < overflowDays.length) {
        // Display overflow day from previous month
        cells.push({
          ...overflowDays[overflowIndex],
          isOverflow: true,
          fromPreviousMonth: true
        });
        overflowIndex++;
      } else {
        // No overflow days (or ran out), use empty cell
        cells.push(null);
      }
    }
    
    // Fill with current month days
    for (let dayNumber = 1; dayNumber <= numDays; dayNumber++) {
      // Check if this day would overflow
      const cellPosition = firstDay + dayNumber - 1;
      
      if (cellPosition < 35) {
        // Regular day within the 5×7 grid
        let dayData = (yearData[year] && yearData[year][m])
          ? yearData[year][m][dayNumber - 1]
          : { day: dayNumber, muscles: [], volume: 0, exercises: [], duration: null };
        
        cells.push({ ...dayData, day: dayNumber, month: m });
      } else {
        // This day overflows - save it for next month
        let dayData = (yearData[year] && yearData[year][m])
          ? yearData[year][m][dayNumber - 1]
          : { day: dayNumber, muscles: [], volume: 0, exercises: [], duration: null };
        
        nextMonthOverflowDays.push({ ...dayData, day: dayNumber, originalMonth: m });
      }
    }
    
    // Fill remaining cells with null (if needed)
    while (cells.length < 35) {
      cells.push(null);
    }
    
    // Save overflow days for next month
    overflowDays = nextMonthOverflowDays;
    
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
        .attr("data-month", d => d && d.isOverflow ? d.originalMonth : m)
        .attr("transform", (d, i) => {
          const x = (i % cols) * (cellSize + cellGap);
          const y = Math.floor(i / cols) * (cellSize + cellGap);
          return `translate(${x}, ${y})`;
        })
        .each(function(d) {
          if (!d) return;
          
          const cell = d3.select(this);
          
          // Determine if this is an overflow day from previous month
          const isOverflow = d.isOverflow && d.fromPreviousMonth;
          
          cell.append("rect")
            .attr("class", "cell-background")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", isOverflow ? "2,2" : null) // Dotted border for overflow days
            .attr("fill", () => {
              const cellDate = new Date(year, d.originalMonth || m, d.day);
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
            .attr("fill", isOverflow ? "#888" : "#333") // Lighter color for overflow days
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

// Update the fetchWorkoutDetails function to handle overflow days correctly
async function fetchWorkoutDetails(year, month, day, originalMonth) {
  // Use originalMonth if provided (for overflow days)
  const actualMonth = originalMonth !== undefined ? originalMonth : month;
  
  const dd = String(day).padStart(2, "0");
  const mm = String(actualMonth + 1).padStart(2, "0");
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



// This is inside the touchstart event handler
function addTooltipBehavior(cellSelection, dayData) {
  const rect = cellSelection.select("rect.cell-background");
  const cellSize = +rect.attr("width");

  // Add tablet detection - consider devices with width >= 768px as tablets
  const isTablet = window.innerWidth >= 768;
  
  // Check for a coarse pointer (touch device)
  if (window.matchMedia('(pointer: coarse)').matches && !isTablet) {
    // PHONE BEHAVIOR - Keep existing mobile behavior
    // Variables to track touch behavior
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTouchMoving = false;
    let longPressTimer = null;

    // Expand the touch target area
    cellSelection.append("rect")
      .attr("class", "touch-target")
      .attr("width", cellSize + (TOUCH_AREA_PADDING * 2))
      .attr("height", cellSize + (TOUCH_AREA_PADDING * 2))
      .attr("x", -TOUCH_AREA_PADDING)
      .attr("y", -TOUCH_AREA_PADDING)
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("cursor", "pointer");

    // Touch start handler
    cellSelection.on("touchstart", (event) => {
      // Record starting position and time
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      isTouchMoving = false;

      // Visual feedback on touch start
      rect.attr("stroke", "#333").attr("stroke-width", 2);
      
      // Set up long press timer
      longPressTimer = setTimeout(() => {
        if (!isTouchMoving) {
          // This is a long press - show tooltip
          showTooltipForMobileCell(event);
        }
      }, TOUCH_LONG_PRESS_DURATION);
    });
    
    // Touch move handler
    cellSelection.on("touchmove", (event) => {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const deltaY = Math.abs(touch.clientY - touchStartY);
      
      // If movement exceeds threshold, consider it a scroll
      if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
        isTouchMoving = true;
        clearTimeout(longPressTimer);
        
        // Restore cell appearance
        if (dayData.isOverflow) {
          rect.attr("stroke", "#ddd").attr("stroke-width", 1).attr("stroke-dasharray", "4,2");
        } else {
          rect.attr("stroke", "#ddd").attr("stroke-width", 1);
        }
      }
    });
    
    // Touch end handler
    cellSelection.on("touchend", async (event) => {
      clearTimeout(longPressTimer);
      const touchDuration = Date.now() - touchStartTime;
      
      // Only show tooltip if:
      // 1. Touch wasn't moving (not scrolling)
      // 2. Touch was long enough to be deliberate but not a long press
      if (!isTouchMoving && touchDuration > TOUCH_TIME_THRESHOLD && touchDuration < TOUCH_LONG_PRESS_DURATION) {
        await showTooltipForMobileCell(event);
      }
      
      // If this was a moving touch that ended, restore cell appearance
      if (isTouchMoving) {
        if (dayData.isOverflow) {
          rect.attr("stroke", "#ddd").attr("stroke-width", 1).attr("stroke-dasharray", "4,2");
        } else {
          rect.attr("stroke", "#ddd").attr("stroke-width", 1);
        }
      }
    });
    
    // Function to show tooltip for mobile devices with modified behavior
    async function showTooltipForMobileCell(event) {
      event.preventDefault();
      event.stopPropagation();
      
      // Fetch workout details (code remains the same)
      if (dayData.day) {
        try {
          const year = currentYear;
          const month = +cellSelection.attr("data-month") || 0;
          const originalMonth = dayData.originalMonth !== undefined ? dayData.originalMonth : month;
          const details = await fetchWorkoutDetails(year, month, dayData.day, originalMonth);
          
          // Update dayData with fetched details
          if (details.duration) {
            dayData.duration = details.duration;
          }
          
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
      
      // Check if we're clicking on the same cell or a new one
      const isNewCell = !cellSelection.classed("active-tooltip-cell");
      
      // If there's already an active tooltip for another cell, hide it
      if (d3.select("#tooltip").style("opacity") == 1 && isNewCell) {
        // Hide previous cell highlight
        d3.selectAll(".active-tooltip-cell").classed("active-tooltip-cell", false);
        d3.selectAll("rect.cell-background").attr("stroke", "#ddd").attr("stroke-width", 1);
        d3.selectAll("rect.cell-background[stroke-dasharray]").attr("stroke-dasharray", "4,2");
      }
      
      // Always apply highlighting to the tapped cell
      rect.attr("stroke", "#333").attr("stroke-width", 2);
      cellSelection.classed("active-tooltip-cell", true);
      
      // Show the tooltip with adaptive sizing
      const tooltipDiv = d3.select("#tooltip");
      tooltipDiv.html(buildTooltipHTML(dayData));
      
      // Get the muscle group color for background
      let bgColor = "#6a6a6a"; // Default fallback color
      
      // If there are muscles, use the first one's color
      if (dayData.muscles && dayData.muscles.length > 0) {
        const firstMuscle = dayData.muscles[0];
        const baseColor = muscleColors[firstMuscle];
        bgColor = darkenColor(baseColor, 0.2);
      }
      
      // Apply initial styles - COMPLETELY remove any width constraints
      tooltipDiv
        .style("background-color", bgColor)
        .style("color", isColorDark(bgColor) ? "#ffffff" : "#333333")
        .style("opacity", 1)
        .style("pointer-events", "auto")
        .style("width", "auto")
        .style("min-width", "auto")
        .style("max-width", "none")
        .style("height", "auto")
        .style("min-height", "auto")
        .style("max-height", "80vh")
        .classed("mobile-tooltip", true);
      
      // First, ensure all exercise lines have nowrap applied directly
      tooltipDiv.selectAll(".exercise-line").style("white-space", "nowrap");
      tooltipDiv.selectAll(".exercise-name").style("white-space", "nowrap");
      
      // Get the viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Render off-screen first to get full natural width
      tooltipDiv
        .style("position", "absolute")
        .style("left", "-9999px")
        .style("top", "-9999px");
      
      // Force browser to render before measuring
      void tooltipDiv.node().offsetWidth;
      
      // Now measure the tooltip
      const tooltipNode = tooltipDiv.node();
      
      // Find the widest exercise line
      let maxLineWidth = 0;
      tooltipDiv.selectAll(".exercise-line").each(function() {
        const lineWidth = this.scrollWidth;
        maxLineWidth = Math.max(maxLineWidth, lineWidth);
      });
      
      // Also measure header and footer
      const headerWidth = tooltipDiv.select(".tooltip-header").node().scrollWidth;
      const footerWidth = tooltipDiv.select(".tooltip-footer").node() ? 
                        tooltipDiv.select(".tooltip-footer").node().scrollWidth : 0;
      
      // Use the widest element plus padding
      const contentWidth = Math.max(maxLineWidth, headerWidth, footerWidth);
      const paddingTotal = 15 * 2; // Left and right padding (15px each side)
      
      // INCREASED safety margin (from 30px to 50px) to accommodate the close button
      let optimalWidth = contentWidth + paddingTotal + 50; 
      
      // Cap width at 95% of viewport width
      const maxAllowedWidth = viewportWidth * 0.95;
      const finalWidth = Math.min(optimalWidth, maxAllowedWidth);
      
      // Position back in the viewport
      tooltipDiv
        .style("position", "fixed")
        .style("left", "50%")
        .style("top", "50%")
        .style("transform", "translate(-50%, -50%)")
        .style("width", finalWidth + "px");
      
      // Recalculate height after width is set
      const updatedHeight = tooltipNode.offsetHeight;
      
      // Ensure the tooltip isn't too tall
      const maxAllowedHeight = viewportHeight * 0.8;
      if (updatedHeight > maxAllowedHeight) {
        // Enable scrolling on exercises container if needed
        tooltipDiv.select(".tooltip-exercises")
          .style("max-height", (maxAllowedHeight * 0.6) + "px")
          .style("overflow-y", "auto");
        
        tooltipDiv.style("height", maxAllowedHeight + "px");
      }
      
      // Add overlay for dismissal
      let overlay = document.getElementById("tooltip-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "tooltip-overlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.right = "0";
        overlay.style.bottom = "0";
        overlay.style.zIndex = "9000";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.touchAction = "manipulation";
        
        // Add a hint text
        const hint = document.createElement("div");
        hint.innerText = "Tap outside to close";
        hint.style.position = "fixed";
        hint.style.bottom = "20px";
        hint.style.left = "0";
        hint.style.right = "0";
        hint.style.textAlign = "center";
        hint.style.color = "white";
        hint.style.fontSize = "14px";
        hint.style.padding = "8px";
        hint.style.width = "150px";
        hint.style.margin = "0 auto";
        hint.style.backgroundColor = "rgba(0,0,0,0.5)";
        hint.style.borderRadius = "8px";
        hint.style.zIndex = "9001";
        hint.style.opacity = "0.8";
        overlay.appendChild(hint);
        
        document.body.appendChild(overlay);
        
        // Overlay click handling
        overlay.addEventListener("click", function(e) {
          if (e.target === overlay || e.target === hint) {
            hideAllTooltips();
          }
        });
        
        // Touch event handling
        overlay.addEventListener("touchstart", function(e) {
          if (e.target === overlay || e.target === hint) {
            e.stopPropagation();
          }
        }, { passive: true });
        
        overlay.addEventListener("touchmove", function(e) {
          // Don't prevent default to allow zooming
          e.stopPropagation();
        }, { passive: true });
      }
      
      // Touch handling for tooltip
      tooltipNode.style.touchAction = "manipulation";
      
      // Add touch handlers to tooltip
      tooltipNode.addEventListener("touchstart", function(e) {
        // Don't do anything to allow zoom gestures
      }, { passive: true });
      
      tooltipNode.addEventListener("touchmove", function(e) {
        // Don't do anything to allow zoom gestures
      }, { passive: true });
      
      // Add click handler for close button with a slightly longer delay to ensure DOM update
      setTimeout(() => {
        const closeBtn = document.querySelector('.tooltip-close-btn');
        if (closeBtn) {
          // Remove any existing listeners by cloning
          const newBtn = closeBtn.cloneNode(true);
          closeBtn.parentNode.replaceChild(newBtn, closeBtn);
          
          // Add new event listener
          newBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            hideAllTooltips();
          });
        }
      }, 100); // Increased from 50ms to 100ms
    }
  } else {
    // DESKTOP AND TABLET BEHAVIOR - use desktop behavior for both
    
    // Add special tablet touch handling if this is a tablet
    if (isTablet && window.matchMedia('(pointer: coarse)').matches) {
      // Make taps work like clicks for tablets
      cellSelection
        .on("touchstart", (event) => {
          rect.attr("stroke", "#333").attr("stroke-width", 2);
        })
        .on("touchend", async (event) => {
          // Convert touch event to a pointer-style event that works with showTooltip
          const touch = event.changedTouches[0];
          const newEvent = {
            pageX: touch.pageX,
            pageY: touch.pageY,
            clientX: touch.clientX,
            clientY: touch.clientY
          };
          
          // For tablets, update exercise data before showing the tooltip
          if (dayData.day) {
            try {
              const year = currentYear;
              const month = +cellSelection.attr("data-month") || 0;
              const originalMonth = dayData.originalMonth !== undefined ? dayData.originalMonth : month;
              const details = await fetchWorkoutDetails(year, month, dayData.day, originalMonth);
              
              if (details.duration) {
                dayData.duration = details.duration;
              }
              
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
          
          showTooltip(newEvent, dayData);
          
          // Don't hide the tooltip immediately on touchend for tablets
          // We'll rely on tapping elsewhere or explicitly hiding
          
          // Allow tapping elsewhere to dismiss
          document.addEventListener("touchstart", function onDocTouch(e) {
            const tooltipNode = d3.select("#tooltip").node();
            const cellNode = cellSelection.node();
            
            // If tap is outside the tooltip and current cell
            if (tooltipNode && cellNode && 
                !tooltipNode.contains(e.target) && 
                !cellNode.contains(e.target)) {
              hideTooltip();
              document.removeEventListener("touchstart", onDocTouch);
            }
          }, { once: false });
        });
    }
    
    // Standard desktop mouse behavior (works for desktop and as a fallback for tablet)
    cellSelection
      .on("pointerenter", async (event) => {
        rect.attr("stroke", "#333").attr("stroke-width", 2);
        
        // For desktop, update exercise data before showing the tooltip
        if (dayData.day) {
          try {
            const year = currentYear;
            const month = +cellSelection.attr("data-month") || 0;
            const originalMonth = dayData.originalMonth !== undefined ? dayData.originalMonth : month;
            const details = await fetchWorkoutDetails(year, month, dayData.day, originalMonth);
            
            if (details.duration) {
              dayData.duration = details.duration;
            }
            
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
        rect.attr("stroke", dayData.isOverflow ? "#ddd" : "#ddd").attr("stroke-width", 1);
        if (dayData.isOverflow) {
          rect.attr("stroke-dasharray", "4,2");
        }
        hideTooltip();
      });
  }
}

// Function for building tooltip HTML with more prominent close button
function buildTooltipHTML(dayData) {
  // Use the provided date if available; otherwise, default to the day number.
  const dateString = dayData.date ? dayData.date : ("Day " + dayData.day);

  // Build the exercise list area.
  // Instead of returning immediately when there are no exercises,
  // we set the exercise list content to display "No Workout Data".
  let exerciseList = "";
  if (!dayData.exercises || dayData.exercises.length === 0) {
    exerciseList = `<div class="exercise-line" style="white-space:nowrap !important; display:flex;">
                      <span>No Workout Data</span>
                    </div>`;
  } else {
    // Check if exercises are in the new format (objects with name and count)
    const isNewFormat =
      typeof dayData.exercises[0] === "object" &&
      dayData.exercises[0] !== null &&
      "name" in dayData.exercises[0];
    if (isNewFormat) {
      exerciseList = dayData.exercises
        .map(
          ex => `<div class="exercise-line" style="white-space:nowrap !important; display:flex;">
                  <span class="bullet" style="flex-shrink:0;">•</span>
                  <span class="exercise-name" style="white-space:nowrap !important;">${ex.name} (${ex.count})</span>
                </div>`
        )
        .join("");
    } else {
      exerciseList = dayData.exercises
        .map(
          ex => `<div class="exercise-line" style="white-space:nowrap !important; display:flex;">
                  <span class="bullet" style="flex-shrink:0;">•</span>
                  <span class="exercise-name" style="white-space:nowrap !important;">${ex}</span>
                </div>`
        )
        .join("");
    }
  }

  // Check for duration information; if valid, prepare footer text.
  let durationInfo = "";
  if (dayData.duration && dayData.duration !== "NaN") {
    durationInfo = dayData.duration;
  }

  // Detect device type: tablet vs. mobile
  const isTablet = window.innerWidth >= 768;
  const isMobile = window.matchMedia("(pointer: coarse)").matches && !isTablet;

  // Header: include date information and volume (sets) with inline styling.
  let headerContent = `<div class="tooltip-header" style="position:relative; margin-bottom:4px; white-space:nowrap !important; padding-right:25px;">
                          <div class="tooltip-volume" style="display:inline-block;">
                            <strong>Volume:</strong> ${dayData.volume} Sets
                          </div>
                        </div>`;

  // Create a close button for mobile devices.
  const closeButton = isMobile
    ? '<div class="tooltip-close-btn" style="position:absolute;top:-24px;right:-24px;width:32px;height:32px;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;font-weight:bold;box-shadow:0 3px 8px rgba(0,0,0,0.4);border:2px solid white;z-index:10000;">&times;</div>'
    : "";

  // Footer: include duration information if available.
  let footerContent = "";
  if (durationInfo) {
    footerContent = `<div class="tooltip-footer" style="margin-top:4px; white-space:nowrap !important;">
                        Duration: ${durationInfo}
                      </div>`;
  }

  // Combine header, close button, exercise list, and footer.
  return `
    <div style="position:relative;">
      ${closeButton}
      ${headerContent}
      <div class="tooltip-exercises">${exerciseList}</div>
      ${footerContent}
    </div>
  `;
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
  
  // Always include month for both start and end dates
  const startMonthName = monthNames[startMonth];
  const endMonthName = monthNames[endMonth];
  
  return `${startMonthName} ${startDate.getDate()} - ${endMonthName} ${endDate.getDate()}`;
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
  
  // IMPORTANT CHANGE: Only count a streak if the previous week was completed
  if (sortedWeeks.length > 0 && prevWeekCompleted) {
    // Start with 1 for the previous week that was just completed
    streak = 1;
    
    // Find the index of the previous week in our sorted array
    const prevWeekIndex = sortedWeeks.indexOf(prevWeekKey);
    
    // If we found the previous week in our completed weeks
    if (prevWeekIndex > 0) {
      // Check consecutive weeks working backwards from the previous week
      for (let i = prevWeekIndex; i > 0; i--) {
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
  }
  
  // Update the streak count
  weeklyData.weekStreakCount = streak;
  
  // Save updated streak data
  saveStreakData();
  
  // Update the streak display with proper pluralization
  const streakNumber = document.querySelector('.streak-number');
  const streakSubtitle = document.querySelector('.streak-subtitle');
  
  if (streakNumber) {
    streakNumber.textContent = weeklyData.weekStreakCount;
  }
  if (streakSubtitle) {
    streakSubtitle.textContent = weeklyData.weekStreakCount === 1 ? 'Week in a row' : 'Weeks in a row';
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

// ========== Font Resizing Functions ==========

// Create a debounced version of any function
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Function to handle fitty resizing
// Function to handle fitty resizing with improved mobile sizing
function handleFittyResize() {
  // Clear any existing fitty instances
  if (typeof fitty.destroy === 'function') {
    fitty.destroy();
  }
  
  // Get viewport width to determine if we're on mobile
  const viewportWidth = window.innerWidth;
  const isMobile = viewportWidth < 480;
  
  // Set smaller max sizes for mobile devices
  const titleMaxSize = isMobile ? 14 : 20;
  const subtitleMaxSize = isMobile ? 11 : 16;
  
  // Initialize fitty for streak and yearly-workouts titles with reduced max sizes
  const streakTitles = document.querySelectorAll('.streak-title');
  const streakSubtitles = document.querySelectorAll('.streak-subtitle');
  
  streakTitles.forEach(el => {
    fitty(el, {
      multiLine: false,
      minSize: 10,
      maxSize: titleMaxSize
    });
  });
  
  streakSubtitles.forEach(el => {
    fitty(el, {
      multiLine: false,
      minSize: 9,
      maxSize: subtitleMaxSize
    });
  });
  
  // Initialize fitty for streak numbers separately with higher max sizes
  const streakNumbers = document.querySelectorAll('.streak-number');
  streakNumbers.forEach(el => {
    fitty(el, {
      multiLine: false,
      minSize: 16,
      maxSize: isMobile ? 28 : 40 // Bigger max size for the numbers
    });
  });
  
  // After a short delay, sync progress elements with streak fonts
  setTimeout(syncProgressFontSizes, 50);
}

// Sync progress fonts with streak fonts
function syncProgressFontSizes() {
  // Get all streak titles and find the computed font size
  const streakTitles = document.querySelectorAll('.streak-title');
  const streakSubtitles = document.querySelectorAll('.streak-subtitle');
  let titleFontSize = null;
  let subtitleFontSize = null;
  
  // Get font sizes from the first streak title and subtitle
  if (streakTitles.length > 0) {
    titleFontSize = window.getComputedStyle(streakTitles[0]).fontSize;
  }
  
  if (streakSubtitles.length > 0) {
    subtitleFontSize = window.getComputedStyle(streakSubtitles[0]).fontSize;
  }
  
  // Apply font sizes to progress elements if available
  if (titleFontSize) {
    document.querySelectorAll('.progress-title-wrapper').forEach(el => {
      el.style.fontSize = titleFontSize;
    });
    
    // Also apply to the progress title directly
    document.querySelectorAll('.progress-title').forEach(el => {
      el.style.fontSize = titleFontSize;
    });
  }
  
  if (subtitleFontSize) {
    document.querySelectorAll('.progress-bottom-wrapper').forEach(el => {
      el.style.fontSize = subtitleFontSize;
    });
    
    // Apply to the weekDateRange directly
    const weekDateRange = document.getElementById('weekDateRange');
    if (weekDateRange) {
      weekDateRange.style.fontSize = subtitleFontSize;
    }
  }
  
  // Ensure progress count has appropriate size
  document.querySelectorAll('.progress-count').forEach(el => {
    const isMobile = window.innerWidth < 480;
    el.style.fontSize = isMobile ? '0.75rem' : '0.85rem';
  });
}

// Create a debounced version of handleFittyResize
const debouncedFittyResize = debounce(handleFittyResize, 150);

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
    
    // Use the new handler function for font resizing
    handleFittyResize();
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
  
  // --- Check Yearly Workout Container Structure ---
  const yearlyWorkoutsContainer = document.querySelector('.yearly-workouts-desktop');
  if (yearlyWorkoutsContainer) {
    const yearlyStreakNumber = yearlyWorkoutsContainer.querySelector('.streak-number');
    if (yearlyStreakNumber && !yearlyWorkoutsContainer.querySelector('.streak-middle-wrapper')) {
      const middleWrapper = document.createElement('div');
      middleWrapper.className = 'streak-middle-wrapper';
      yearlyStreakNumber.parentNode.insertBefore(middleWrapper, yearlyStreakNumber);
      middleWrapper.appendChild(yearlyStreakNumber);
    }
  }
}

// Initialize streak-related UI components
function initializeStreakTitle() {
  // First update DOM structure
  updateProgressContainerStructure();
  
  // Then initialize fitty for proper text scaling
  handleFittyResize();
}

// ========== ResizeObserver Setup ==========
function setupResizeObservers() {
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(debouncedFittyResize);
    
    // Observe the container and all three individual boxes
    const container = document.querySelector('.progress-streak-container');
    if (container) {
      resizeObserver.observe(container);
    }
    
    // Observe individual containers
    const containers = document.querySelectorAll('#weeklyProgressContainer, .streak-container, .yearly-workouts-desktop');
    containers.forEach(el => {
      if (el) resizeObserver.observe(el);
    });
  }
}


// Add dropdown arrow animation
document.addEventListener('DOMContentLoaded', function() {
  const selectWrapper = document.querySelector('.select-wrapper');
  const yearSelect = document.getElementById('yearSelect');
  
  if (selectWrapper && yearSelect) {
    yearSelect.addEventListener('click', function() {
      selectWrapper.classList.add('active');
    });
    
    yearSelect.addEventListener('blur', function() {
      selectWrapper.classList.remove('active');
    });
    
    // Also handle change events
    yearSelect.addEventListener('change', function() {
      setTimeout(() => {
        selectWrapper.classList.remove('active');
      }, 300);
    });
  }
});


// ========== Init on Page Load ==========
document.addEventListener('DOMContentLoaded', function() {
  // Run structure updates
  updateProgressContainerStructure();
  
  // Initialize fitty for all text elements
  handleFittyResize();
  
  // Set up resize observers for dynamic font resizing
  setupResizeObservers();
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
  updateYearlyActiveHours(currentYear);
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

  if (window.weightAnalysis && typeof window.weightAnalysis.init === 'function') {
    window.weightAnalysis.init();
  }
})();