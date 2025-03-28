/***********************************************
 * script.js
 **********************************************/

// ====== Calendar config ======
const muscleGroups = ["Chest", "Triceps", "Legs", "Shoulders", "Biceps", "Back"];
const muscleDisplayNames = {
  "Chest": "Chest",
  "Triceps": "Triceps",
  "Legs": "Legs",
  "Shoulders": "SH.",
  "Biceps": "Biceps",
  "Back": "Back",
};

const muscleColors = {
  "Chest": "#bb595f",
  "Triceps": "#F9C74F",
  "Legs": "#43AA8B",
  "Shoulders": "#F8961E",
  "Biceps": "#90BE6D",
  "Back": "#577590",
};

const monthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let yearData = {};      // structure: { year: [ month0, month1, ... month11 ] }
let workoutFiles = {};  // track JSON files found for each year
let currentYear = new Date().getFullYear();

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
      adjustMonthDisplay(); // Add adjustment after redrawing
    });
  } else {
    drawYearCalendar(currentYear);
    updateYearlyWorkoutCount(currentYear);
    renderLegend();
    adjustMonthDisplay(); // Add adjustment after redrawing
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
        if (json && json.workout) {
          workoutFiles[year].push(fileName);
          if (json.overall_muscle_group && Array.isArray(json.overall_muscle_group)) {
            const musclesList = json.overall_muscle_group.filter(mg => muscleGroups.includes(mg));
            return { day: currentDate.getDate(), muscles: musclesList, volume: musclesList.length };
          } else {
            let volumeMap = {};
            muscleGroups.forEach(mg => volumeMap[mg] = 0);
            json.workout.forEach(entry => {
              const mg = entry["Muscle-Group"] || "Unknown";
              if (muscleGroups.includes(mg)) {
                const reps = +entry.Reps || 0;
                const weight = parseFloat(entry.Weight) || 0;
                volumeMap[mg] += (reps * weight);
              }
            });
            let selectedMuscle = null;
            let maxVolume = 0;
            muscleGroups.forEach(mg => {
              if (volumeMap[mg] > maxVolume) {
                maxVolume = volumeMap[mg];
                selectedMuscle = mg;
              }
            });
            return { day: currentDate.getDate(), muscles: selectedMuscle ? [selectedMuscle] : [], volume: maxVolume };
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
    yearData[year][month][result.day - 1] = result;
  });
}

// ========== Responsive Functions ==========

// Determine appropriate cell size based on screen width
function calculateResponsiveCellSize() {
  const outerBoxWidth = document.getElementById('outerBox').clientWidth;
  
  // Calculate cell size based on available width
  // We need to fit at least 7 cells horizontally (for days of the week)
  // plus account for margins, padding and gaps
  const minCellSize = 16; // Minimum usable cell size
  const idealCellSize = 20; // Original designed cell size
  
  // Account for margins and padding (approx 40px from margins and padding)
  const availableWidth = outerBoxWidth - 40;
  const cellGap = 4;
  
  // Calculate how much space 7 cells would take with gaps
  const cellsWithGapsWidth = (7 * idealCellSize) + (6 * cellGap);
  
  // If we have enough space, use the ideal size
  if (availableWidth >= cellsWithGapsWidth) {
    return idealCellSize;
  } else {
    // Calculate a cell size that would fit
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
  
  // How many months do we want to show at once? (2-3)
  const targetMonthsVisible = Math.min(3, monthBlocks.length);
  
  // Calculate the ideal width for each month
  // Subtract margins between months (5px × (targetMonthsVisible-1))
  const idealMonthWidth = Math.floor((containerWidth - (5 * (targetMonthsVisible - 1))) / targetMonthsVisible);
  
  // Apply the calculated width to each month-block's SVG
  monthBlocks.forEach(block => {
    const svg = block.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', idealMonthWidth);
      // Need to maintain aspect ratio
      const viewBox = svg.getAttribute('viewBox').split(' ');
      const aspectRatio = parseFloat(viewBox[3]) / parseFloat(viewBox[2]);
      svg.setAttribute('height', Math.floor(idealMonthWidth * aspectRatio));
    }
  });
  
  // Update the scroll position to show current month
  const now = new Date();
  let currentMonth = now.getMonth();
  let updatedMonthBlockWidth = idealMonthWidth + 5; // Width + margin
  const desiredScroll = (currentMonth * updatedMonthBlockWidth) - 
                        (containerWidth - updatedMonthBlockWidth);
                        
  chartContainer.scrollLeft = Math.max(0, desiredScroll);
}

// ========== Draw Year Calendar: Render 12 Months Horizontally ==========
function drawYearCalendar(year) {
  chartContainer.innerHTML = "";
  
  // Define dimensions for each month based on screen size
  const cellSize = calculateResponsiveCellSize(),
        cellGap = 4,
        cols = 7,
        rows = 5;
  const gridWidth = cols * (cellSize + cellGap) - cellGap;
  const gridHeight = rows * (cellSize + cellGap) - cellGap;
  const margin = { top: 50, right: 20, bottom: 20, left: 20 };
  const monthChartWidth = gridWidth + margin.left + margin.right;
  const monthChartHeight = gridHeight + margin.top + margin.bottom;
  
  // Utility function to generate gradient IDs based on muscle groups
  const getGradientId = (muscles) => {
    return `gradient-${muscles.join('-')}`;
  };
  
  // Loop through all 12 months
  for (let m = 0; m < 12; m++) {
    const monthDiv = document.createElement("div");
    monthDiv.className = "month-block";
    
    const svg = d3.create("svg")
      .attr("width", monthChartWidth)
      .attr("height", monthChartHeight)
      .attr("viewBox", `0 0 ${monthChartWidth} ${monthChartHeight}`)
      .attr("preserveAspectRatio", "xMinYMin meet");

    // Create defs for gradients
    const defs = svg.append("defs");

    // Month label (3-letter code) above the weekday row
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

    // Determine number of days and starting weekday
    const numDays = new Date(year, m + 1, 0).getDate();
    const firstDay = new Date(year, m, 1).getDay();
    let cells = [];
    for (let i = 0; i < 35; i++) {
      let dayNumber = i - firstDay + 1;
      if (dayNumber >= 1 && dayNumber <= numDays) {
        let dayData = (yearData[year] && yearData[year][m]) ? yearData[year][m][dayNumber - 1] : { day: dayNumber, muscles: [] };
        cells.push({ ...dayData, day: dayNumber });
      } else {
        cells.push(null);
      }
    }
    
    // Create all needed gradients for this month
    const colorScale = d3.scaleOrdinal()
      .domain(muscleGroups)
      .range(muscleGroups.map(mg => muscleColors[mg]));
    
    // Find all unique muscle group combinations for this month
    const uniqueCombinations = new Set();
    cells.forEach(cell => {
      if (cell && cell.muscles && cell.muscles.length > 1) {
        uniqueCombinations.add(cell.muscles.join('-'));
      }
    });
    
    // Create gradient definitions for each unique combination
    uniqueCombinations.forEach(combo => {
      const muscles = combo.split('-');
      const gradientId = getGradientId(muscles);
      
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      
      // Add color stops based on number of muscles with custom transitions
      if (muscles.length === 2) {
        // First color solid from 0% to 45%
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", colorScale(muscles[0]));
        
        gradient.append("stop")
          .attr("offset", "45%")
          .attr("stop-color", colorScale(muscles[0]));
        
        // Smooth transition happens automatically between 45% and 55%
        
        // Second color solid from 55% to 100%
        gradient.append("stop")
          .attr("offset", "55%")
          .attr("stop-color", colorScale(muscles[1]));
        
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorScale(muscles[1]));
      } else if (muscles.length === 3) {
        // For 3 muscles, use a similar approach with three regions
        
        // First color solid from 0% to 30%
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", colorScale(muscles[0]));
        
        gradient.append("stop")
          .attr("offset", "30%")
          .attr("stop-color", colorScale(muscles[0]));
        
        // Smooth transition from 30% to 35%
        
        // Second color solid from 35% to 65%
        gradient.append("stop")
          .attr("offset", "35%")
          .attr("stop-color", colorScale(muscles[1]));
        
        gradient.append("stop")
          .attr("offset", "65%")
          .attr("stop-color", colorScale(muscles[1]));
        
        // Smooth transition from 65% to 70%
        
        // Third color solid from 70% to 100%
        gradient.append("stop")
          .attr("offset", "70%")
          .attr("stop-color", colorScale(muscles[2]));
        
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorScale(muscles[2]));
      } else if (muscles.length > 3) {
        // For more than 3 muscles, just use the first 3
        
        // First color solid from 0% to 30%
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", colorScale(muscles[0]));
        
        gradient.append("stop")
          .attr("offset", "30%")
          .attr("stop-color", colorScale(muscles[0]));
        
        // Smooth transition from 30% to 35%
        
        // Second color solid from 35% to 65%
        gradient.append("stop")
          .attr("offset", "35%")
          .attr("stop-color", colorScale(muscles[1]));
        
        gradient.append("stop")
          .attr("offset", "65%")
          .attr("stop-color", colorScale(muscles[1]));
        
        // Smooth transition from 65% to 70%
        
        // Third color solid from 70% to 100%
        gradient.append("stop")
          .attr("offset", "70%")
          .attr("stop-color", colorScale(muscles[2]));
        
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorScale(muscles[2]));
      }
    });
    
    const cellsGroup = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
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
          const cell = d3.select(this);
          
          // Add background rectangle
          cell.append("rect")
            .attr("class", "cell-background")
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("fill", function(d) {
              if (d && d.day) {
                const cellDate = new Date(year, m, d.day);
                const now = new Date();
                // Future dates: no fill, only outline
                if (cellDate > now) return "none";
                // No workout
                if (!d.muscles || d.muscles.length === 0) return "#ebedf0";
                // Single muscle group
                if (d.muscles.length === 1) return colorScale(d.muscles[0]);
                // Multiple muscle groups - use gradient
                return `url(#${getGradientId(d.muscles)})`;
              }
              return "none";
            });
          
          // Add day number text
          cell.append("text")
            .attr("class", "dayLabel")
            .attr("x", 2)
            .attr("y", 12)
            .attr("font-size", "10px")
            .attr("fill", "#333")
            .text(d => d && d.day ? d.day : "");
        });
    
    monthDiv.appendChild(svg.node());
    chartContainer.appendChild(monthDiv);
  }
}

// ========== Render Legend ==========
function renderLegend() {
  const legendDiv = document.getElementById("legend");
  legendDiv.innerHTML = "";
  const colorScale = d3.scaleOrdinal()
    .domain(muscleGroups)
    .range(muscleGroups.map(mg => muscleColors[mg]));
  
  // Add single muscle group items
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

// ========== Window Resize Handler ==========
window.addEventListener('resize', function() {
  // Add a small delay to avoid too many redraws during resizing
  if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
  this.resizeTimeout = setTimeout(function() {
    drawYearCalendar(currentYear);
    adjustMonthDisplay(); // Add adjustment after redrawing
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
  adjustMonthDisplay(); // Add adjustment after drawing
})();