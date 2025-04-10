/**
 * weightAnalysis.js - Exercise Progress Tracker with Range Controls
 * 
 * Visualizes progress for specific exercises with error bands and range controls
 */

(function() {
  console.log('Exercise tracker script loaded');
  
  // References to DOM elements
  const secondChartArea = document.getElementById('secondChartArea');
  
  // Configuration values
  const margin = { top: 30, right: 20, bottom: 50, left: 50 };
  const colors = {
    primary: '#546bce',       // Main line color
    primaryLight: '#8c9fe0',  // Lighter shade for the error band
    secondary: '#ec512f',     // Accent color
    gridLines: '#e5e7eb'
  };


  function populateWAYearSelect() {
    const waYearSelect = document.getElementById("waYearSelect");
    const years = [2023, 2024, 2025, 2026];
    years.forEach(yr => {
      const option = document.createElement("option");
      option.value = yr;
      option.textContent = yr;
      waYearSelect.appendChild(option);
    });
    // Set the default value to currentYear
    waYearSelect.value = currentYear;
  
    // Attach an event listener so that when the year changes, the chart updates
    waYearSelect.addEventListener("change", () => {
      currentYear = +waYearSelect.value;
      updateYear(currentYear);
    });
  }

  
  // State tracking
  let currentYear = new Date().getFullYear(); // Year for syncing with calendar
  let selectedExercise = null;  // Currently selected exercise
  let dropdownCreated = false;  // Track if dropdown was created
  let allExerciseData = [];     // Store all loaded exercise data
  let displayCount = null;      // Number of workouts to display (null = all)
  
  /**
   * Main initialization function
   */
  async function initExerciseTracker() {
    console.log('Exercise tracker initialization called');
    
    // Clear the chart area
    if (!secondChartArea) {
      console.error('secondChartArea not found');
      return;
    }
    
    secondChartArea.innerHTML = '';
    secondChartArea.classList.remove('chart-placeholder');
    
    try {
      // Get all exercises from the JSON files
      const exercises = await getAllExercises(currentYear);
      
      if (exercises.length === 0) {
        showNoDataMessage('No exercise data found for this year');
        return;
      }
      
      // Create the exercise selector dropdown (only if not already created)
      if (!dropdownCreated) {
        const exerciseDropdown = createExerciseDropdown(exercises);
        secondChartArea.appendChild(exerciseDropdown);
        dropdownCreated = true;
      }
      
      // Select the first exercise by default or use previously selected
      const defaultExercise = selectedExercise || exercises[0];
      const selectElement = document.getElementById('exercise-select');
      if (selectElement) {
        // Make sure the option exists
        if ([...selectElement.options].some(opt => opt.value === defaultExercise)) {
          selectElement.value = defaultExercise;
          selectedExercise = defaultExercise;  // Make sure selectedExercise is set
        } else {
          selectElement.selectedIndex = 0;
          selectedExercise = selectElement.value;
        }        
      }
      
      // Create chart container if it doesn't exist
      let chartContainer = document.querySelector('.exercise-chart-container');
      if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.className = 'exercise-chart-container';
        secondChartArea.appendChild(chartContainer);
      }

      // Also optimize the range control container
      let rangeControlContainer = document.querySelector('.range-control-container');
      if (!rangeControlContainer) {
        rangeControlContainer = document.createElement('div');
        rangeControlContainer.className = 'range-control-container';
        secondChartArea.appendChild(rangeControlContainer);
      }
      
      // Load and render the data for the selected exercise
      allExerciseData = await loadExerciseData(selectedExercise || exercises[0], currentYear);
      
      // Create range controls
      createRangeControls(rangeControlContainer);
      
      // Initial render with all data
      renderExerciseChart(allExerciseData, selectedExercise || exercises[0]);
    } catch (error) {
      console.error('Error initializing exercise tracker:', error);
      showNoDataMessage('Error loading exercise data');
    }


    // Add resize observer to redraw chart when container size changes
    const handleResize = () => {
      if (allExerciseData.length > 0 && selectedExercise) {
        // Re-render with current data when window resizes
        const dataToRender = getFilteredData();
        
        // Update chart
        renderExerciseChart(dataToRender, selectedExercise);
        
        // Update controls and legend
        createRangeControls(rangeControlContainer);
      }
    };

    // Add resize listener if not already added
    if (!window.exerciseTrackerResizeListenerAdded) {
      window.addEventListener('resize', debounce(handleResize, 250));
      window.exerciseTrackerResizeListenerAdded = true;
    }

    // Simple debounce function to limit resize handling
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
  }
  
  /**
   * Update the visualization when the year changes
   */
  async function updateYear(year) {
    console.log('Exercise tracker updateYear called with:', year);
    currentYear = year;
    
    try {
      // Clear the previous chart but keep the dropdown
      const chartContainer = document.querySelector('.exercise-chart-container');
      if (chartContainer) {
        chartContainer.innerHTML = '';
      }
      
      // Get all exercises for the new year
      const exercises = await getAllExercises(currentYear);
      
      if (exercises.length === 0) {
        showNoDataMessage('No exercise data found for this year');
        return;
      }
      
      // Update the dropdown options
      updateExerciseDropdown(exercises);
      
      // Load and render the data for the currently selected exercise
      const selectElement = document.getElementById('exercise-select');
      if (selectElement) {
        selectedExercise = selectElement.value;
      }
      
      // Load exercise data for the selected exercise
      allExerciseData = await loadExerciseData(selectedExercise, currentYear);
      
      // Update range controls
      updateRangeControls();
      
      // Render with the current display count
      const dataToRender = getFilteredData();
      renderExerciseChart(dataToRender, selectedExercise);
    } catch (error) {
      console.error('Error updating exercise tracker:', error);
      showNoDataMessage('Error updating exercise data');
    }
  }
  
  /**
   * Create the exercise selector dropdown
   */
  function createExerciseDropdown(exercises) {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'exercise-selector';
    
    const label = document.createElement('label');
    label.textContent = 'Track exercise: ';
    label.htmlFor = 'exercise-select';
    
    const select = document.createElement('select');
    select.id = 'exercise-select';
    select.className = 'form-select form-select-sm';
    
    // Add options for each exercise
    exercises.forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise;
      option.textContent = exercise;
      select.appendChild(option);
    });
    
    // Add event listener to update the chart when selection changes
    select.addEventListener('change', async () => {
      selectedExercise = select.value;
      console.log('Exercise changed to:', selectedExercise);
      
      try {
        const chartContainer = document.querySelector('.exercise-chart-container');
        if (chartContainer) {
          chartContainer.innerHTML = `
            <div class="loading-spinner-container">
              <div class="loading-spinner"></div>
              <div class="loading-text">Loading data...</div>
            </div>
          `;
        }
        
        // Load exercise data for the selected exercise
        allExerciseData = await loadExerciseData(selectedExercise, currentYear);
        
        // Update range controls for the new data
        updateRangeControls();
        
        // Get filtered data
        const dataToRender = getFilteredData();
        
        // Render the chart
        renderExerciseChart(dataToRender, selectedExercise);
      } catch (error) {
        console.error('Error updating chart:', error);
        showNoDataMessage(`Error loading data for ${selectedExercise}`);
      }
    });
    
    dropdownContainer.appendChild(label);
    dropdownContainer.appendChild(select);
    
    return dropdownContainer;
  }
  
  /**
   * Update the dropdown options with new exercises
   */
  function updateExerciseDropdown(exercises) {
    const select = document.getElementById('exercise-select');
    if (!select) return;
    
    // Store the current selection to try to restore it
    const currentSelection = select.value;
    
    // Clear the existing options
    select.innerHTML = '';
    
    // Add options for each exercise
    exercises.forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise;
      option.textContent = exercise;
      select.appendChild(option);
    });
    
    // Try to restore the previous selection if available in the new list
    if (exercises.includes(currentSelection)) {
      select.value = currentSelection;
    } else {
      // Otherwise select the first option
      select.selectedIndex = 0;
      selectedExercise = select.value;
    }
  }
  
  /**
   * Create range control buttons and slider
   */
function createRangeControls(container) {
  // Clear container
  container.innerHTML = '';
  
  // Get dimensions
  const containerWidth = container.clientWidth || 300;
  const isMobile = window.innerWidth < 500;
  
  // Create main wrapper
  const mainWrapper = document.createElement('div');
  mainWrapper.className = 'range-controls-and-legend';
  if (isMobile) {
    mainWrapper.classList.add('mobile');
  }
  
  // Create controls wrapper
  const controlsWrapper = document.createElement('div');
  controlsWrapper.className = 'range-controls-wrapper';
  
  // Create label
  const label = document.createElement('div');
  label.textContent = 'Show:';
  label.className = 'range-label';
  if (isMobile) {
    label.classList.add('mobile');
  }
  controlsWrapper.appendChild(label);
  
  // Create button group
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  
  // Calculate available presets
  const totalWorkouts = allExerciseData.length;
  const presets = [];
  
  if (totalWorkouts >= 5) presets.push(5);
  if (totalWorkouts >= 10) presets.push(10);
  // Only add 15 preset on wider screens
  if (totalWorkouts >= 15 && containerWidth > 400) presets.push(15);
  
  // Create preset buttons
  presets.forEach((count, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm ' + (displayCount === count ? 'btn-primary' : 'btn-outline-secondary');
    button.textContent = `${count}`;  // Just the number to save space
    
    if (isMobile) {
      button.classList.add('mobile');
    }
    
    button.addEventListener('click', () => {
      displayCount = count;
      
      // Update button styles
      document.querySelectorAll('.button-group .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-secondary');
      });
      button.classList.remove('btn-outline-secondary');
      button.classList.add('btn-primary');
      
      // Update range slider if it exists
      const slider = document.getElementById('range-slider');
      if (slider) {
        slider.value = count;
      }
      
      // Re-render chart with filtered data
      const dataToRender = getFilteredData();
      renderExerciseChart(dataToRender, selectedExercise);
      
      // Update legend separately
      addExerciseLegend(document.querySelector('.legend-container'), containerWidth);
    });
    
    buttonGroup.appendChild(button);
  });
  
  // Create "All" button
  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'btn btn-sm ' + (displayCount === null ? 'btn-primary' : 'btn-outline-secondary');
  allButton.textContent = 'All';
  
  if (isMobile) {
    allButton.classList.add('mobile');
  }
  
  allButton.addEventListener('click', () => {
    displayCount = null;
    
    // Update button styles
    document.querySelectorAll('.button-group .btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-secondary');
    });
    allButton.classList.remove('btn-outline-secondary');
    allButton.classList.add('btn-primary');
    
    // Update range slider
    const slider = document.getElementById('range-slider');
    if (slider) {
      slider.value = slider.max;
    }
    
    // Re-render chart with all data
    renderExerciseChart(allExerciseData, selectedExercise);
    
    // Update legend separately
    addExerciseLegend(document.querySelector('.legend-container'), containerWidth);
  });
  
  buttonGroup.appendChild(allButton);
  controlsWrapper.appendChild(buttonGroup);
  
  // Add slider only on wider screens with enough workouts
  if (containerWidth > 400 && totalWorkouts > 5) {
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    // Slider input
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'range-slider';
    slider.className = 'form-range';
    slider.min = Math.min(3, totalWorkouts);
    slider.max = totalWorkouts;
    slider.value = displayCount || totalWorkouts;
    
    slider.addEventListener('input', (event) => {
      const count = parseInt(event.target.value);
      displayCount = count < totalWorkouts ? count : null;
      
      // Update button styles
      document.querySelectorAll('.button-group .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-secondary');
      });
      
      // Highlight matching button
      if (displayCount === 5 || displayCount === 10 || displayCount === 15) {
        const matchingButton = Array.from(document.querySelectorAll('.button-group .btn'))
          .find(btn => btn.textContent === `${displayCount}`);
        if (matchingButton) {
          matchingButton.classList.remove('btn-outline-secondary');
          matchingButton.classList.add('btn-primary');
        }
      } else if (displayCount === null) {
        // Highlight "All" button
        const allButton = Array.from(document.querySelectorAll('.button-group .btn'))
          .find(btn => btn.textContent === 'All');
        if (allButton) {
          allButton.classList.remove('btn-outline-secondary');
          allButton.classList.add('btn-primary');
        }
      }
      
      // Re-render chart with filtered data
      const dataToRender = getFilteredData();
      renderExerciseChart(dataToRender, selectedExercise);
      
      // Update legend separately
      addExerciseLegend(document.querySelector('.legend-container'), containerWidth);
    });
    
    sliderContainer.appendChild(slider);
    controlsWrapper.appendChild(sliderContainer);
  }
  
  // Add controls to main wrapper
  mainWrapper.appendChild(controlsWrapper);
  
  // Create legend container
  const legendContainer = document.createElement('div');
  legendContainer.className = 'legend-container';
  mainWrapper.appendChild(legendContainer);
  
  // Add main wrapper to container
  container.appendChild(mainWrapper);
  
  // Add the legend
  addExerciseLegend(legendContainer, containerWidth);
}

/**
 * Add a compact legend that won't overflow
 */
function addExerciseLegend(container, containerWidth) {
  // Clear container first
  container.innerHTML = '';
  
  const isMobile = window.innerWidth < 500;
  
  // Create legend
  const legend = document.createElement('div');
  legend.className = 'exercise-legend';
  if (isMobile) {
    legend.classList.add('mobile');
  }
  
  // Create line legend item
  const lineItem = document.createElement('div');
  lineItem.className = 'legend-item';
  
  const lineSwatch = document.createElement('span');
  lineSwatch.className = 'legend-swatch line';
  if (isMobile) {
    lineSwatch.classList.add('mobile');
  }
  
  const lineLabel = document.createElement('span');
  lineLabel.className = 'legend-label';
  lineLabel.textContent = 'Avg';
  if (isMobile) {
    lineLabel.classList.add('mobile');
  }
  
  lineItem.appendChild(lineSwatch);
  lineItem.appendChild(lineLabel);
  legend.appendChild(lineItem);
  
  // Create range legend item
  const rangeItem = document.createElement('div');
  rangeItem.className = 'legend-item';
  
  const rangeSwatch = document.createElement('span');
  rangeSwatch.className = 'legend-swatch range';
  if (isMobile) {
    rangeSwatch.classList.add('mobile');
  }
  
  const rangeLabel = document.createElement('span');
  rangeLabel.className = 'legend-label';
  rangeLabel.textContent = 'Range';
  if (isMobile) {
    rangeLabel.classList.add('mobile');
  }
  
  rangeItem.appendChild(rangeSwatch);
  rangeItem.appendChild(rangeLabel);
  legend.appendChild(rangeItem);
  
  container.appendChild(legend);
}
  
  /**
   * Update range controls when data changes
   */
  function updateRangeControls() {
    const container = document.querySelector('.range-control-container');
    
    if (container) {
      createRangeControls(container);
    }
  }
  
  /**
   * Get filtered data based on displayCount
   */
  function getFilteredData() {
    if (!displayCount || displayCount >= allExerciseData.length) {
      return [...allExerciseData];
    }
    
    // Sort by date and take the last N workouts
    const sortedData = [...allExerciseData].sort((a, b) => a.date - b.date);
    return sortedData.slice(-displayCount);
  }
  
  /**
   * Get all unique exercises from all workout files for the given year
   */
  async function getAllExercises(year) {
    const exercises = new Set();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const today = new Date();
    const endDate = end > today ? today : end;
    
    let promises = [];
    for (let dt = new Date(start); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const fileName = `data/${dd}-${mm}-${yyyy}.json`;
      
      promises.push(
        d3.json(fileName).catch(() => null)
      );
    }
    
    const results = await Promise.all(promises);
    
    results.forEach(json => {
      if (json && json.workout && Array.isArray(json.workout)) {
        json.workout.forEach(set => {
          if (set.Exercise) exercises.add(set.Exercise);
        });
      }
    });
    
    return Array.from(exercises).sort();
  }
  
  
  /**
   * Load exercise data for the specified exercise and year
   */
  async function loadExerciseData(exerciseName, year) {
    const exerciseData = [];
  
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const today = new Date();
    // Use today's date if the year is current
    const endDate = end > today ? today : end;
  
    // Create an array to store promises along with the associated date
    const promises = [];
    
    // Loop through every day in the year (or until today)
    for (let dt = new Date(start); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const fileName = `data/${dd}-${mm}-${yyyy}.json`;
      // Make a copy of the current date to attach later since dt is mutated
      const dtCopy = new Date(dt);
      
      // Push the promise into the array and catch errors by returning null
      promises.push(
        d3.json(fileName)
          .then(json => ({ date: dtCopy, json }))
          .catch(() => ({ date: dtCopy, json: null }))
      );
    }
    
    // Wait for all file requests to complete
    const results = await Promise.all(promises);
    
    // Process the results array
    results.forEach(({ date, json }) => {
      if (json && json.workout && Array.isArray(json.workout)) {
        // Filter out the sets that match the specified exercise
        const exerciseSets = json.workout.filter(set => set.Exercise === exerciseName);
        if (exerciseSets.length > 0) {
          // Parse and extract the necessary data for each set
          const parsedSets = exerciseSets.map(set => ({
            weight: parseWeight(set.Weight),
            reps: parseInt(set.Reps) || 0,
            effort: set.Effort || 'N/A',
            location: set.Location || 'N/A',
            muscleGroup: set["Muscle-Group"] || 'N/A'
          }));
          
          exerciseData.push({
            date: date,
            sets: parsedSets
          });
        }
      }
    });
    
    // Optional: sort the exercise data by date in ascending order
    exerciseData.sort((a, b) => a.date - b.date);
    
    return exerciseData;
  }
  
  
  /**
   * Parse weight string to extract the numeric value
   */
  function parseWeight(weightStr) {
    if (!weightStr) return 0;
    
    // Extract the number from a string like "25 kg" or "27.5 kg"
    const match = weightStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    
    return 0;
  }

/**
 * Render the exercise progression chart with error bands
 * Fully responsive solution with layout detection
 */
function renderExerciseChart(exerciseData, exerciseName) {
  // Get the container for the visualization
  let chartContainer = document.querySelector('.exercise-chart-container');
  if (!chartContainer) {
    chartContainer = document.createElement('div');
    chartContainer.className = 'exercise-chart-container';
    secondChartArea.appendChild(chartContainer);
  }
  
  // Clear the container
  chartContainer.innerHTML = '';
  
  if (!exerciseData || exerciseData.length === 0) {
    showNoExerciseDataMessage(chartContainer, exerciseName);
    return;
  }
  
  // Sort data by date
  exerciseData.sort((a, b) => a.date - b.date);
  
  // Get container dimensions
  const containerWidth = chartContainer.clientWidth || secondChartArea.clientWidth || 300;
  const isMobile = window.innerWidth < 500;
  
  // Detect layout mode (side-by-side vs stacked)
  const isStacked = window.innerWidth < 992; // Bootstrap's lg breakpoint
  
  // Calculate dynamic aspect ratio based on layout
  let aspectRatio;
  if (isStacked) {
    // Stacked layout - can be taller
    aspectRatio = containerWidth < 400 ? 1.5 : 1.8;
  } else {
    // Side-by-side layout - must be shorter
    aspectRatio = containerWidth < 400 ? 2.2 : 2.5;
  }
  
  // Calculate dimensions
  const width = containerWidth; // Use 100% of container width
  
  // Calculate height with layout-aware constraints
  let baseHeight = width / aspectRatio;
  
  // Adjust min/max height based on layout
  const minHeight = isStacked ? 220 : 170;
  const maxHeight = isStacked ? 320 : 240;
  const height = Math.max(minHeight, Math.min(maxHeight, baseHeight));
  
  // Apply the height to the container
  chartContainer.style.height = `${height + 5}px`;
  
  // Optimized margins for maximum chart space
  const dynamicMargin = {
    top: 20,
    right: isMobile ? 5 : 15,
    bottom: isMobile ? 30 : 40,
    left: isMobile ? 35 : 45
  };
  
  const innerWidth = width - dynamicMargin.left - dynamicMargin.right;
  const innerHeight = height - dynamicMargin.top - dynamicMargin.bottom;
  
  // Create responsive SVG
  const svg = d3.create("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "exercise-chart");
  
  const g = svg.append("g")
    .attr("transform", `translate(${dynamicMargin.left},${dynamicMargin.top})`);
  
  // Create scales
  const x = d3.scaleTime()
    .domain(d3.extent(exerciseData, d => d.date))
    .range([0, innerWidth])
    .nice();
  
  // Process data
  const processedData = exerciseData.map(workout => {
    const weights = workout.sets.map(set => set.weight);
    
    // Calculate statistics
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    
    // For weighted average, consider reps as a factor
    const totalWeight = workout.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
    const totalReps = workout.sets.reduce((sum, set) => sum + set.reps, 0);
    const weightedAvg = totalWeight / totalReps;
    
    return {
      date: workout.date,
      sets: workout.sets,
      maxWeight,
      minWeight,
      avgWeight,
      weightedAvg,
      range: maxWeight - minWeight
    };
  });
  
  // Find the overall min/max for y-axis
  const allWeights = [];
  processedData.forEach(day => {
    allWeights.push(day.maxWeight);
    allWeights.push(day.minWeight);
  });
  
  const minWeight = d3.min(allWeights) || 0;
  const maxWeight = d3.max(allWeights) || 10;
  const padding = (maxWeight - minWeight) * 0.1 || 5;
  
  const y = d3.scaleLinear()
    .domain([Math.max(0, minWeight - padding), maxWeight + padding])
    .range([innerHeight, 0])
    .nice();
  
  // Add grid lines - fewer on mobile
  g.append("g")
    .attr("class", "grid-lines-x")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x)
      .ticks(Math.min(isMobile ? 4 : 6, exerciseData.length))
      .tickSize(-innerHeight)
      .tickFormat("")
    )
    .call(g => g.select(".domain").remove());
  
  g.append("g")
    .attr("class", "grid-lines-y")
    .call(d3.axisLeft(y)
      .ticks(isMobile ? 4 : 5)
      .tickSize(-innerWidth)
      .tickFormat("")
    )
    .call(g => g.select(".domain").remove());
  
  // Add x-axis with ultra-compact formatting for mobile
  const xAxis = g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x)
      .ticks(Math.min(isMobile ? 4 : 6, exerciseData.length))
      .tickSizeOuter(0)
      .tickFormat(d => {
        const day = d.getDate();
        // Super compact for mobile
        if (isMobile) {
          return `${day}`;  // Just day number
        }
        const month = d.getMonth();
        return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month]} ${day}`;
      })
    );
  
  // Style x-axis
  xAxis.select(".domain").attr("stroke", "#ccc");
  
  // Optimize x-axis labels
  xAxis.selectAll("text")
    .attr("transform", isMobile ? "rotate(-30)" : "rotate(-40)")
    .attr("text-anchor", "end")
    .attr("dx", isMobile ? "-0.2em" : "-0.5em")
    .attr("dy", isMobile ? "0.1em" : "0.15em");
  
  // Add y-axis
  const yAxis = g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y)
      .ticks(isMobile ? 4 : 5)
      .tickSizeOuter(0)
      .tickFormat(d => isMobile ? `${d}` : `${d}kg`)
    );
  
  // Style y-axis
  yAxis.select(".domain").attr("stroke", "#ccc");
  
  // Create tooltip if it doesn't exist
  let tooltip = d3.select("body").select(".exercise-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "exercise-tooltip");
  }
  
  // Define area generator for the error band
  const areaGenerator = d3.area()
    .x(d => x(d.date))
    .y0(d => y(d.minWeight))
    .y1(d => y(d.maxWeight))
    .curve(d3.curveMonotoneX);
  
  // Add the error band area
  g.append("path")
    .datum(processedData)
    .attr("fill", colors.primaryLight)
    .attr("fill-opacity", 0.3)
    .attr("d", areaGenerator);
  
  // Define line generator for the middle line
  const lineGenerator = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.weightedAvg))
    .curve(d3.curveMonotoneX);
  
  // Add the middle line
  g.append("path")
    .datum(processedData)
    .attr("fill", "none")
    .attr("stroke", colors.primary)
    .attr("stroke-width", isMobile ? 2 : 2.5)
    .attr("d", lineGenerator);
  
  // Smaller points on mobile
  const avgPointRadius = isMobile ? 3.5 : 4.5;
  const minMaxPointRadius = isMobile ? 2 : 3;
  
  // Add data points
  processedData.forEach(dayData => {
    // Add weighted average point
    g.append("circle")
      .attr("class", "avg-point")
      .attr("cx", x(dayData.date))
      .attr("cy", y(dayData.weightedAvg))
      .attr("r", avgPointRadius)
      .on("mouseover", function(event) {
        d3.select(this)
          .attr("r", avgPointRadius + 1.5)
          .attr("stroke-width", 1.8);
        
        // Format date for display
        const dateStr = dayData.date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        
        // Get the proper exercise name
        const displayExerciseName = selectedExercise || exerciseName || "Exercise";
        
        // Build tooltip content
        let tooltipContent = `
          <div class="tooltip-title">${displayExerciseName}</div>
          <div class="tooltip-date">${dateStr}</div>
          <div class="tooltip-stats">
            <div class="tooltip-stat-line">
              <span>Avg:</span>
              <span class="tooltip-stat-value">${dayData.weightedAvg.toFixed(1)}kg</span>
            </div>
            <div class="tooltip-stat-line">
              <span>Range:</span>
              <span>${dayData.minWeight}-${dayData.maxWeight}kg</span>
            </div>
            <div class="tooltip-stat-line">
              <span>Sets:</span>
              <span>${dayData.sets.length}</span>
            </div>
          </div>
        `;
        
        tooltip
          .style("visibility", "visible")
          .html(tooltipContent);
      })
      .on("mousemove", function(event) {
        // Smart tooltip positioning
        const tooltipWidth = 150;
        const windowWidth = window.innerWidth;
        let xPosition = event.pageX + 10;
        
        // Check if tooltip would go off the right edge
        if (xPosition + tooltipWidth > windowWidth) {
          xPosition = event.pageX - tooltipWidth - 10;
        }
        
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", xPosition + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("r", avgPointRadius)
          .attr("stroke-width", 1.5);
        
        tooltip.style("visibility", "hidden");
      });
      
    // Add min and max points (smaller and semi-transparent)
    if (dayData.minWeight !== dayData.weightedAvg) {
      g.append("circle")
        .attr("class", "min-point")
        .attr("cx", x(dayData.date))
        .attr("cy", y(dayData.minWeight))
        .attr("r", minMaxPointRadius);
    }
    
    if (dayData.maxWeight !== dayData.weightedAvg) {
      g.append("circle")
        .attr("class", "max-point")
        .attr("cx", x(dayData.date))
        .attr("cy", y(dayData.maxWeight))
        .attr("r", minMaxPointRadius);
    }
  });
  
  // Compact title
  const titleText = displayCount ? 
    `${exerciseName || selectedExercise} - Last ${displayCount}` : 
    `${exerciseName || selectedExercise} - All (${exerciseData.length})`;
  
  g.append("text")
    .attr("class", "chart-title")
    .attr("x", innerWidth / 2)
    .attr("y", -dynamicMargin.top / 2)
    .attr("text-anchor", "middle")
    .text(titleText);
  
  // Add to DOM
  chartContainer.appendChild(svg.node());
}
  
  /**
   * Show a message when no data is available
   */
  function showNoDataMessage(message) {
    if (!secondChartArea) return;
    
    // Remove any existing chart but keep the dropdown
    const chartContainer = document.querySelector('.exercise-chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="error-message">
          <div class="error-message-primary">${message}</div>
          <div class="error-message-secondary">Try selecting a different year</div>
        </div>
      `;
    } else {
      secondChartArea.innerHTML = `
        <div class="error-message">
          <div class="error-message-primary">${message}</div>
          <div class="error-message-secondary">Try selecting a different year</div>
        </div>
      `;
    }
  }
  
  /**
   * Show a message when no data is available for a specific exercise
   */
  function showNoExerciseDataMessage(container, exerciseName) {
    container.innerHTML = `
      <div class="error-message">
        <div class="error-message-primary">No data found for ${exerciseName || 'selected exercise'}</div>
        <div class="error-message-secondary">Try selecting a different exercise</div>
      </div>
    `;
  }
  
  // Export functions that need to be called from script.js
  window.weightAnalysis = {
    init: initExerciseTracker,
    updateYear: updateYear
  };
  
  // Define a function to check if the DOM is ready and the chart area exists
  function checkAndInitialize() {
    console.log('checkAndInitialize called');

    // Call this function during initialization:
    document.addEventListener("DOMContentLoaded", () => {
      populateWAYearSelect();
      initExerciseTracker(); // or whatever your main initialization function is
    });
        
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // Check if the chart area exists
      if (document.getElementById('secondChartArea')) {
        console.log('Exercise tracker: DOM is ready, initializing...');
        initExerciseTracker();
      } else {
        console.log('Exercise tracker: Chart area not found, will retry...');
        // Try again in 100ms
        setTimeout(checkAndInitialize, 100);
      }
    } else {
      // If DOM is not ready, wait for it
      console.log('Exercise tracker: Waiting for DOM to be ready...');
      document.addEventListener('DOMContentLoaded', checkAndInitialize);
    }
  }
  
  // Start the initialization process
  checkAndInitialize();
})();



/**
 * Enhanced exercise dropdown organized in a single column layout
 * with color-coded muscle groups and clear dividers
 */
function createSingleColumnExerciseDropdown() {
  // Your defined muscle groups
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

  // Find necessary elements
  const titleElement = document.querySelector('#secondPlot .content-header h3.content-title');
  const existingDropdown = document.getElementById('exercise-select');
  
  // Exit if elements not found
  if (!titleElement || !existingDropdown) {
    console.error('Required elements not found for enhanced dropdown');
    return;
  }
  
  // Get current exercise options from the existing dropdown
  const exerciseOptions = Array.from(existingDropdown.options).map(option => ({
    value: option.value,
    text: option.text,
    muscleGroup: null // Will be populated later
  }));
  
  // Get currently selected exercise
  const selectedExercise = existingDropdown.value;
  const selectedText = existingDropdown.options[existingDropdown.selectedIndex].text;
  
  // Function to fetch the muscle group for an exercise from the workout JSON
  async function fetchExerciseMuscleGroups() {
    // This will store all fetched exercise data
    let exerciseData = {};
    
    // Get current year - for file path construction
    const currentYear = new Date().getFullYear();
    
    try {
      // Iterate through all days of the current year
      const start = new Date(currentYear, 0, 1);
      const end = new Date(); // Today
      
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yyyy = dt.getFullYear();
        const fileName = `data/${dd}-${mm}-${yyyy}.json`;
        
        try {
          // Fetch the workout data for this day
          const response = await fetch(fileName);
          
          // Skip days with no data
          if (!response.ok) continue;
          
          const json = await response.json();
          
          // Skip if no workout or invalid format
          if (!json || !json.workout || !Array.isArray(json.workout)) {
            continue;
          }
          
          // Process each exercise in the workout
          json.workout.forEach(set => {
            if (set.Exercise && set['Muscle-Group']) {
              const exerciseName = set.Exercise;
              const muscleGroup = set['Muscle-Group'];
              
              // Store the relationship
              exerciseData[exerciseName] = muscleGroup;
            }
          });
          
        } catch (error) {
          // Just skip any files that don't exist or can't be parsed
          continue;
        }
      }
      
      return exerciseData;
    } catch (error) {
      console.error('Error fetching exercise muscle groups:', error);
      return {};
    }
  }
  
  // Function to handle dropdown creation after we have the muscle group data
  function createDropdownWithMuscleGroups(exerciseToMuscleGroup) {
    // Map muscle groups to exercises
    const muscleGroupsData = {};
    muscleGroups.forEach(group => {
      muscleGroupsData[group] = {
        name: muscleDisplayNames[group] || group,
        color: muscleColors[group] || "#f8f9fa",
        exercises: []
      };
    });
    
    // Organize exercises by muscle group
    exerciseOptions.forEach(exercise => {
      // Get muscle group from our fetched data
      const muscleGroup = exerciseToMuscleGroup[exercise.text] || null;
      exercise.muscleGroup = muscleGroup;
      
      // Add to the correct muscle group, or "Chest" as default if unknown
      if (muscleGroup && muscleGroupsData[muscleGroup]) {
        muscleGroupsData[muscleGroup].exercises.push(exercise);
      } else {
        // If no matching muscle group, add to default group
        muscleGroupsData[muscleGroups[0]].exercises.push(exercise);
      }
    });
    
    // Create a new select element that will be hidden but functional
    const select = document.createElement('select');
    select.id = 'title-exercise-select';
    select.className = 'hidden-select';
    
    // Add exercise options to the new select
    exerciseOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if (option.value === selectedExercise) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
    
    // Create the dropdown container
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'title-dropdown-container';
    
    // Create the visible title with arrow
    const visibleTitle = document.createElement('div');
    visibleTitle.className = 'visible-title';
    visibleTitle.innerHTML = `
      <span class="title-text">${selectedText}</span>
      <span class="dropdown-arrow">▾</span>
    `;
    
    // Create the custom dropdown menu (initially hidden)
    const customDropdown = document.createElement('div');
    customDropdown.className = 'custom-dropdown-menu';
    customDropdown.style.display = 'none';
    
    // Create the single column layout
    let dropdownHTML = '<div class="muscle-group-list">';
    
    // Add each muscle group section
    muscleGroups.forEach(groupKey => {
      const group = muscleGroupsData[groupKey];
      
      // Only add groups that have exercises
      if (group.exercises.length > 0) {
        dropdownHTML += `
          <div class="muscle-group-section">
            <div class="muscle-group-header" style="background-color: ${group.color};">
              ${group.name}
            </div>
            <div class="exercise-list" style="background-color: ${group.color}20;">
        `;
        
        // Add exercises for this muscle group
        group.exercises.forEach(exercise => {
          const isSelected = exercise.value === selectedExercise;
          dropdownHTML += `
            <div class="exercise-item ${isSelected ? 'selected' : ''}" data-value="${exercise.value}">
              ${exercise.text}
            </div>
          `;
        });
        
        dropdownHTML += `
            </div>
          </div>
        `;
      }
    });
    
    dropdownHTML += '</div>';
    customDropdown.innerHTML = dropdownHTML;
    
    // Function to toggle dropdown visibility
    const toggleDropdown = () => {
      const isVisible = customDropdown.style.display === 'block';
      customDropdown.style.display = isVisible ? 'none' : 'block';
      
      // Toggle active class for styling
      if (isVisible) {
        dropdownContainer.classList.remove('active');
      } else {
        dropdownContainer.classList.add('active');
      }
    };
    
    // Handle click on the visible title
    visibleTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
    
    // Handle click on exercise items in custom dropdown
    customDropdown.addEventListener('click', (e) => {
      const exerciseItem = e.target.closest('.exercise-item');
      if (exerciseItem) {
        const value = exerciseItem.dataset.value;
        
        // Find the text for this value
        const option = exerciseOptions.find(opt => opt.value === value);
        if (option) {
          // Update visible title
          visibleTitle.querySelector('.title-text').textContent = option.text;
          
          // Update hidden select
          select.value = value;
          
          // Sync with the original exercise dropdown and trigger change
          existingDropdown.value = value;
          existingDropdown.dispatchEvent(new Event('change'));
          
          // Update selected state in dropdown
          customDropdown.querySelectorAll('.exercise-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.value === value);
          });
          
          // Hide dropdown
          toggleDropdown();
        }
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      if (customDropdown.style.display === 'block') {
        customDropdown.style.display = 'none';
        dropdownContainer.classList.remove('active');
      }
    });
    
    // Prevent closing when clicking inside the dropdown
    customDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Add elements to the container
    dropdownContainer.appendChild(visibleTitle);
    dropdownContainer.appendChild(select);
    dropdownContainer.appendChild(customDropdown);
    
    // Replace the original title with our dropdown container
    titleElement.parentNode.replaceChild(dropdownContainer, titleElement);
    
    // Hide the original exercise selector since it's now in the title
    const exerciseSelectorContainer = existingDropdown.closest('.exercise-selector');
    if (exerciseSelectorContainer) {
      exerciseSelectorContainer.style.display = 'none';
    }
  }
  
  // First, fetch the muscle group data for each exercise
  fetchExerciseMuscleGroups().then(exerciseToMuscleGroup => {
    // Now create the dropdown with the correct muscle group mapping
    createDropdownWithMuscleGroups(exerciseToMuscleGroup);
  }).catch(error => {
    console.error('Error creating dropdown:', error);
    // Fallback: create dropdown with empty mappings
    createDropdownWithMuscleGroups({});
  });
}

// Create a MutationObserver to watch for the creation of the exercise dropdown
const observer = new MutationObserver(function(mutations) {
  // Check each mutation
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if the exercise-select has been created
      if (document.getElementById('exercise-select')) {
        // Exercise dropdown exists, convert the title
        createSingleColumnExerciseDropdown();
        // Stop observing once we've made the conversion
        observer.disconnect();
        break;
      }
    }
  }
});

// Define a function that starts observing when the DOM is ready
function startObserving() {
  const secondChartArea = document.getElementById('secondChartArea');
  if (secondChartArea) {
    observer.observe(secondChartArea.parentNode, { childList: true, subtree: true });
    console.log('Observing for exercise dropdown creation');
    
    // Also check immediately in case it already exists
    if (document.getElementById('exercise-select')) {
      createSingleColumnExerciseDropdown();
      observer.disconnect();
    }
  } else {
    // Try again in a moment if secondChartArea isn't available yet
    setTimeout(startObserving, 100);
  }
}

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', startObserving);

// Also attempt to run immediately if the page might already be loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(startObserving, 100);
}