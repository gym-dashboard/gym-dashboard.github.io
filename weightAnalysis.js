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
        chartContainer.style.width = '100%';
        chartContainer.style.height = 'auto'; // Let it size based on content
        chartContainer.style.minHeight = '250px'; // Increased minimum height
        chartContainer.style.position = 'relative';
        chartContainer.style.margin = '10px 0 5px 0'; // Reduced margins all around
        chartContainer.style.boxSizing = 'border-box'; // Ensure padding is included in height
        secondChartArea.appendChild(chartContainer);
      }

      // Also optimize the range control container
      let rangeControlContainer = document.querySelector('.range-control-container');
      if (!rangeControlContainer) {
        rangeControlContainer = document.createElement('div');
        rangeControlContainer.className = 'range-control-container';
        rangeControlContainer.style.marginTop = '5px'; // Reduced from 15px
        rangeControlContainer.style.marginBottom = '5px';
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
    dropdownContainer.style.marginBottom = '0';
    
    const label = document.createElement('label');
    label.textContent = 'Track exercise: ';
    label.htmlFor = 'exercise-select';
    label.style.marginRight = '8px';
    label.style.fontWeight = '500';
    
    const select = document.createElement('select');
    select.id = 'exercise-select';
    select.className = 'form-select form-select-sm';
    select.style.display = 'inline-block';
    select.style.width = 'auto';
    select.style.maxWidth = '200px';
    
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
            <div style="text-align: center; padding: 20px;">
              <div style="width: 1.5rem; height: 1.5rem; border: 3px solid #f3f3f3; 
                  border-top: 3px solid #546bce; border-radius: 50%; display: inline-block; 
                  animation: spin 1s linear infinite;">
              </div>
              <div style="margin-top: 10px;">Loading data...</div>
            </div>
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
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
/**
 * Create range control buttons and slider with improved layout
 * This reworks the createRangeControls function to prevent overflow issues
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
  mainWrapper.style.display = 'flex';
  mainWrapper.style.flexDirection = isMobile ? 'column' : 'row';
  mainWrapper.style.justifyContent = 'space-between';
  mainWrapper.style.alignItems = 'center';
  mainWrapper.style.width = '100%';
  mainWrapper.style.gap = isMobile ? '8px' : '15px';
  mainWrapper.style.marginBottom = '5px';
  
  // Create controls wrapper
  const controlsWrapper = document.createElement('div');
  controlsWrapper.className = 'range-controls-wrapper';
  controlsWrapper.style.display = 'flex';
  controlsWrapper.style.alignItems = 'center';
  controlsWrapper.style.gap = '8px';
  controlsWrapper.style.marginBottom = isMobile ? '2px' : '0';
  controlsWrapper.style.flexShrink = '0';
  
  // Create label
  const label = document.createElement('div');
  label.textContent = 'Show:';
  label.style.fontWeight = '500';
  label.style.fontSize = isMobile ? '0.9rem' : '1rem';
  label.style.whiteSpace = 'nowrap';
  controlsWrapper.appendChild(label);
  
  // Create button group with more compact styling
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.style.display = 'flex';
  
  // Calculate available presets
  const totalWorkouts = allExerciseData.length;
  const presets = [];
  
  if (totalWorkouts >= 5) presets.push(5);
  if (totalWorkouts >= 10) presets.push(10);
  // Only add 15 preset on wider screens
  if (totalWorkouts >= 15 && containerWidth > 400) presets.push(15);
  
  // Create preset buttons with more compact styling
  presets.forEach((count, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm ' + (displayCount === count ? 'btn-primary' : 'btn-outline-secondary');
    button.textContent = `${count}`;  // Just the number to save space
    button.style.fontSize = isMobile ? '0.75rem' : '0.8rem';
    button.style.padding = isMobile ? '0.2rem 0.4rem' : '0.25rem 0.5rem';
    button.style.marginRight = '2px';
    button.style.minWidth = isMobile ? '30px' : '35px';
    
    // Adjust border radius
    if (index === 0) {
      button.style.borderRadius = '0.25rem 0 0 0.25rem';
    } else if (index === presets.length - 1) {
      button.style.borderRadius = '0 0.25rem 0.25rem 0';
    } else {
      button.style.borderRadius = '0';
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
  allButton.style.fontSize = isMobile ? '0.75rem' : '0.8rem';
  allButton.style.padding = isMobile ? '0.2rem 0.4rem' : '0.25rem 0.5rem';
  allButton.style.minWidth = isMobile ? '30px' : '35px';
  
  // Adjust border radius
  if (presets.length === 0) {
    allButton.style.borderRadius = '0.25rem';
  } else {
    allButton.style.borderRadius = '0 0.25rem 0.25rem 0';
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
    sliderContainer.style.flex = '1';
    sliderContainer.style.display = 'flex';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.marginLeft = '10px';
    sliderContainer.style.maxWidth = '120px';
    
    // Slider input
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'range-slider';
    slider.className = 'form-range';
    slider.min = Math.min(3, totalWorkouts);
    slider.max = totalWorkouts;
    slider.value = displayCount || totalWorkouts;
    slider.style.flex = '1';
    
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
  legendContainer.style.display = 'flex';
  legendContainer.style.alignItems = 'center';
  legendContainer.style.justifyContent = 'center';
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
  
  // Create more compact legend
  const legend = document.createElement('div');
  legend.style.display = 'flex';
  legend.style.alignItems = 'center';
  legend.style.justifyContent = 'center';
  legend.style.gap = isMobile ? '10px' : '15px';
  legend.style.flexShrink = '0';
  
  // Create line legend item
  const lineItem = document.createElement('div');
  lineItem.style.display = 'flex';
  lineItem.style.alignItems = 'center';
  lineItem.style.gap = '3px';
  
  const lineSwatch = document.createElement('span');
  lineSwatch.style.display = 'inline-block';
  lineSwatch.style.width = isMobile ? '12px' : '15px';
  lineSwatch.style.height = '2px';
  lineSwatch.style.backgroundColor = colors.primary;
  
  const lineLabel = document.createElement('span');
  lineLabel.textContent = 'Avg';
  lineLabel.style.fontSize = isMobile ? '0.7rem' : '0.8rem';
  lineLabel.style.color = '#666';
  
  lineItem.appendChild(lineSwatch);
  lineItem.appendChild(lineLabel);
  legend.appendChild(lineItem);
  
  // Create range legend item
  const rangeItem = document.createElement('div');
  rangeItem.style.display = 'flex';
  rangeItem.style.alignItems = 'center';
  rangeItem.style.gap = '3px';
  
  const rangeSwatch = document.createElement('span');
  rangeSwatch.style.display = 'inline-block';
  rangeSwatch.style.width = isMobile ? '12px' : '15px';
  rangeSwatch.style.height = isMobile ? '6px' : '8px';
  rangeSwatch.style.backgroundColor = colors.primaryLight;
  rangeSwatch.style.opacity = '0.3';
  
  const rangeLabel = document.createElement('span');
  rangeLabel.textContent = 'Range';
  rangeLabel.style.fontSize = isMobile ? '0.7rem' : '0.8rem';
  rangeLabel.style.color = '#666';
  
  rangeItem.appendChild(rangeSwatch);
  rangeItem.appendChild(rangeLabel);
  legend.appendChild(rangeItem);
  
  container.appendChild(legend);
}
  
  /**
   * Update range controls when data changes
   */
  function updateRangeControls() {
    const totalWorkouts = allExerciseData.length;
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
    const today = new Date(); // Don't go beyond today
    const endDate = end > today ? today : end;
    
    for (let dt = new Date(start); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const fileName = `data/${dd}-${mm}-${yyyy}.json`;
      
      try {
        const json = await d3.json(fileName);
        
        if (json && json.workout && Array.isArray(json.workout)) {
          json.workout.forEach(set => {
            if (set.Exercise) {
              exercises.add(set.Exercise);
            }
          });
        }
      } catch (error) {
        // File not found or other error, just continue
        continue;
      }
    }
    
    return Array.from(exercises).sort();
  }
  
  /**
   * Load exercise data for the specified exercise and year
   */
  async function loadExerciseData(exerciseName, year) {
    let exerciseData = [];
    
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const today = new Date();
    const endDate = end > today ? today : end;
    
    for (let dt = new Date(start); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const fileName = `data/${dd}-${mm}-${yyyy}.json`;
      
      try {
        const json = await d3.json(fileName);
        
        // Skip if no workout or the file wasn't found
        if (!json || !json.workout || !Array.isArray(json.workout)) {
          continue;
        }
        
        // Find all sets of the specified exercise
        const exerciseSets = json.workout.filter(set => set.Exercise === exerciseName);
        
        if (exerciseSets.length > 0) {
          // Parse and extract the data we need
          const parsedSets = exerciseSets.map(set => ({
            weight: parseWeight(set.Weight),
            reps: parseInt(set.Reps) || 0,
            effort: set.Effort || 'N/A',
            location: set.Location || 'N/A',
            muscleGroup: set["Muscle-Group"] || 'N/A'
          }));
          
          // Extract the date
          exerciseData.push({
            date: new Date(yyyy, mm - 1, dd),
            sets: parsedSets
          });
        }
      } catch (error) {
        // File not found or other error, just continue
        continue;
      }
    }
    
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
 * Optimized for better space utilization on mobile screens
 */
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
    chartContainer.style.width = '100%';
    chartContainer.style.position = 'relative';
    chartContainer.style.margin = '10px 0 0 0'; // Remove all horizontal margins
    chartContainer.style.boxSizing = 'border-box';
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
    .style("display", "block")
    .style("overflow", "visible");
  
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
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", colors.gridLines)
      .attr("stroke-opacity", 0.5));
  
  g.append("g")
    .attr("class", "grid-lines-y")
    .call(d3.axisLeft(y)
      .ticks(isMobile ? 4 : 5)
      .tickSize(-innerWidth)
      .tickFormat("")
    )
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", colors.gridLines)
      .attr("stroke-opacity", 0.5));
  
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
    .attr("dy", isMobile ? "0.1em" : "0.15em")
    .style("font-size", isMobile ? "8px" : "9px");
  
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
  yAxis.selectAll("text")
    .style("font-size", isMobile ? "8px" : "9px");
  
  // Create tooltip
  let tooltip = d3.select("body").select(".exercise-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "exercise-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(50, 50, 50, 0.9)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "6px")
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .style("z-index", 1000)
      .style("box-shadow", "0 4px 8px rgba(0,0,0,0.2)");
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
      .attr("fill", colors.primary)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
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
        
        // Build ultra-compact tooltip content for mobile
        let tooltipContent = `
          <div style="font-weight:bold; margin-bottom:2px; font-size:12px;">${displayExerciseName}</div>
          <div style="margin-bottom:1px; font-size:11px;">${dateStr}</div>
          <div style="font-size:11px; margin-bottom:2px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:1px;">
              <span>Avg:</span>
              <span style="font-weight:bold;">${dayData.weightedAvg.toFixed(1)}kg</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:1px;">
              <span>Range:</span>
              <span>${dayData.minWeight}-${dayData.maxWeight}kg</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
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
        .attr("r", minMaxPointRadius)
        .attr("fill", colors.primary)
        .attr("fill-opacity", 0.5)
        .attr("stroke", "white")
        .attr("stroke-width", 0.8);
    }
    
    if (dayData.maxWeight !== dayData.weightedAvg) {
      g.append("circle")
        .attr("class", "max-point")
        .attr("cx", x(dayData.date))
        .attr("cy", y(dayData.maxWeight))
        .attr("r", minMaxPointRadius)
        .attr("fill", colors.primary)
        .attr("fill-opacity", 0.5)
        .attr("stroke", "white")
        .attr("stroke-width", 0.8);
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
    .attr("font-size", isMobile ? "11px" : "13px")
    .attr("font-weight", "bold")
    .text(titleText);
  
  // Add to DOM
  chartContainer.appendChild(svg.node());
  
  // Don't add the legend here - will be added separately
}


/**
 * Add a compact legend optimized for mobile devices
 */
function addExerciseLegend(container, containerWidth) {
  const isMobile = containerWidth < 500;
  
  const legend = document.createElement('div');
  legend.style.marginTop = isMobile ? '2px' : '5px';
  legend.style.fontSize = isMobile ? '9px' : '11px';
  legend.style.color = '#666';
  legend.style.textAlign = 'center';
  
  // On mobile, use a more compact horizontal layout
  legend.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; gap: ${isMobile ? '8px' : '15px'};">
      <div style="display: flex; align-items: center;">
        <span style="display: inline-block; width: ${isMobile ? '15px' : '20px'}; height: 2px; background-color: ${colors.primary}; margin-right: 3px;"></span>
        <span>Weighted Avg</span>
      </div>
      <div style="display: flex; align-items: center;">
        <span style="display: inline-block; width: ${isMobile ? '15px' : '20px'}; height: ${isMobile ? '8px' : '12px'}; background-color: ${colors.primaryLight}; opacity: 0.3; margin-right: 3px;"></span>
        <span>Range</span>
      </div>
    </div>
  `;
  
  container.appendChild(legend);
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
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #666;">
          <div style="font-size: 16px; margin-bottom: 10px;">${message}</div>
          <div style="font-size: 14px;">Try selecting a different year</div>
        </div>
      `;
    } else {
      secondChartArea.innerHTML = `
        <div style="height: 250px; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #666;">
          <div style="font-size: 16px; margin-bottom: 10px;">${message}</div>
          <div style="font-size: 14px;">Try selecting a different year</div>
        </div>
      `;
    }
  }
  
  /**
   * Show a message when no data is available for a specific exercise
   */
  function showNoExerciseDataMessage(container, exerciseName) {
    container.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #666;">
        <div style="font-size: 16px; margin-bottom: 10px;">No data found for ${exerciseName || 'selected exercise'}</div>
        <div style="font-size: 14px;">Try selecting a different exercise</div>
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