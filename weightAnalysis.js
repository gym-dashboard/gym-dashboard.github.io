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
    tertiary: '#32a852',      // Third color for multi-select
    gridLines: '#e5e7eb'
  };

  // Create backdrop for mobile if not exists
  let backdrop = document.querySelector('.dropdown-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'dropdown-backdrop';
    // Ensure the backdrop is hidden initially
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
    document.body.appendChild(backdrop);
  } else {
    // Reset any existing backdrop to ensure it's hidden
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
  }

  // Global state variables
  let currentYear = new Date().getFullYear();
  window.currentYear = currentYear; // expose globally for enhanced dropdown usage
  let selectedExercises = [];  
  let dropdownCreated = false;   // Track if dropdown was created
  let allExerciseData = {};      // Store all loaded exercise data keyed by exercise name
  let displayCount = null;       // Number of workouts to display (null = all)
  let titleElements = null;      // Reference to title dropdown elements

  // Exercise colors for multi-select
  const exerciseColors = [
    '#546bce', // Primary blue
    '#ec512f'  // Orange
  ];

  /**
   * Create title dropdown with custom UI
   */
  function initializeTitleWithDropdown() {
    const titleElement = document.querySelector('#secondPlot .content-header h3.content-title');
    if (!titleElement) return null;

    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'title-dropdown-container';

    const visibleTitle = document.createElement('div');
    visibleTitle.className = 'visible-title';
    visibleTitle.innerHTML = `
      <span class="title-text">${selectedExercises.length === 1 ? selectedExercises[0] : 'Select Exercise'}</span>
      <span class="dropdown-arrow">▾</span>
    `;

    const select = document.createElement('select');
    select.id = 'exercise-select';
    select.className = 'form-select form-select-sm hidden-select';

    // Create custom dropdown menu container (populated by the enhanced dropdown later)
    const customDropdown = document.createElement('div');
    customDropdown.className = 'custom-dropdown-menu';
    customDropdown.style.display = 'none';

    // Mobile header for the dropdown
    const mobileHeader = document.createElement('div');
    mobileHeader.className = 'dropdown-mobile-header';
    mobileHeader.innerHTML = `
      <div class="dropdown-title">Select Exercise</div>
      <button class="dropdown-close" aria-label="Close selection">✕</button>
    `;
    customDropdown.appendChild(mobileHeader);

    // Assemble dropdown container
    dropdownContainer.appendChild(visibleTitle);
    dropdownContainer.appendChild(select);
    dropdownContainer.appendChild(customDropdown);

    // Replace the old title element with our dropdown container
    titleElement.parentNode.replaceChild(dropdownContainer, titleElement);

    return {
      container: dropdownContainer,
      title: visibleTitle.querySelector('.title-text'),
      dropdown: customDropdown
    };
  }

  /**
   * Populate the year selection control and attach listener
   */
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

    waYearSelect.addEventListener("change", () => {
      currentYear = +waYearSelect.value;
      window.currentYear = currentYear; // update global currentYear
      updateYear(currentYear);
    });
  }

  /**
   * Main initialization function
   */
  async function initExerciseTracker() {
    console.log('Exercise tracker initialization called');

    // Initialize title dropdown if not done already
    if (!titleElements) {
      titleElements = initializeTitleWithDropdown();
    }

    if (!secondChartArea) {
      console.error('secondChartArea not found');
      return;
    }
    secondChartArea.innerHTML = '';
    secondChartArea.classList.remove('chart-placeholder');

    try {
      // Get available exercises from the JSON data for the given year
      const exercises = await getAllExercises(currentYear);

      if (exercises.length === 0) {
        showNoDataMessage('No exercise data found for this year');
        return;
      }

      // Set default selection – if no user selection exists, choose Bench Press if available or the first exercise.
      if (selectedExercises.length === 0) {
        if (exercises.includes("Bench Press")) {
          selectedExercises = ["Bench Press"];
        } else {
          selectedExercises = [exercises[0]];
        }
      }

      window.selectedExercises = selectedExercises;

      // Immediately update title text
      if (titleElements && titleElements.title) {
        if (selectedExercises.length === 1) {
          titleElements.title.textContent = selectedExercises[0];
        } else if (selectedExercises.length > 1) {
          titleElements.title.textContent = `${selectedExercises[0]} + ${selectedExercises.length - 1} more`;
        } else {
          titleElements.title.textContent = "Select Exercise";
        }
      }

      // Create the basic exercise selector dropdown once
      if (!dropdownCreated) {
        const exerciseDropdown = createExerciseDropdown(exercises);
        secondChartArea.appendChild(exerciseDropdown);
        dropdownCreated = true;
        
        // Hide the default dropdown immediately after creating it
        hideDefaultExerciseDropdown();
      }

      // For basic select element, force the selected exercise to match the one chosen
      const selectElement = document.getElementById('exercise-select');
      if (selectElement) {
        // Ensure the previously chosen exercise is still valid; if not, choose the first one.
        if (!exercises.includes(selectedExercises[0])) {
          selectedExercises = [exercises[0]];
        }
        selectElement.value = selectedExercises[0];
      }

      // Create (or clear) chart container
      let chartContainer = document.querySelector('.exercise-chart-container');
      if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.className = 'exercise-chart-container';
        secondChartArea.appendChild(chartContainer);
      }

      // Create range control container if missing
      let rangeControlContainer = document.querySelector('.range-control-container');
      if (!rangeControlContainer) {
        rangeControlContainer = document.createElement('div');
        rangeControlContainer.className = 'range-control-container';
        secondChartArea.appendChild(rangeControlContainer);
      }

      // Load exercise data for the selected exercise(s)
      const loadPromises = selectedExercises.map(exercise => loadExerciseData(exercise, currentYear));
      Promise.all(loadPromises).then(datasets => {
        selectedExercises.forEach((exercise, index) => {
          allExerciseData[exercise] = datasets[index];
        });

        createRangeControls(rangeControlContainer);
        renderMultiExerciseChart(getFilteredExerciseData());
      });

    } catch (error) {
      console.error('Error initializing exercise tracker:', error);
      showNoDataMessage('Error loading exercise data');
    }

    // Resize listener to re-render chart on container dimension changes
    const handleResize = () => {
      if (Object.keys(allExerciseData).length > 0 && selectedExercises.length > 0) {
        renderMultiExerciseChart(getFilteredExerciseData());
        createRangeControls(document.querySelector('.range-control-container'));
      }
    };

    if (!window.exerciseTrackerResizeListenerAdded) {
      window.addEventListener('resize', debounce(handleResize, 250));
      window.exerciseTrackerResizeListenerAdded = true;
    }

    function debounce(func, wait) {
      let timeout;
      return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    }
  }

  /**
   * Update the visualization when the selected year changes
   */
  async function updateYear(year) {
    console.log('Exercise tracker updateYear called with:', year);
    currentYear = year;
    window.currentYear = currentYear;
    const chartContainer = document.querySelector('.exercise-chart-container');
    if (chartContainer) chartContainer.innerHTML = '';

    const exercises = await getAllExercises(currentYear);
    if (exercises.length === 0) {
      showNoDataMessage('No exercise data found for this year');
      return;
    }

    updateExerciseDropdown(exercises);

    // Filter current selections to only those available this year.
    selectedExercises = selectedExercises.filter(exercise => exercises.includes(exercise));
    if (selectedExercises.length === 0 && exercises.length > 0) {
      selectedExercises = [exercises[0]];
    }

    allExerciseData = {};

    const loadPromises = selectedExercises.map(exercise => loadExerciseData(exercise, currentYear));
    Promise.all(loadPromises).then(datasets => {
      selectedExercises.forEach((exercise, index) => {
        allExerciseData[exercise] = datasets[index];
      });
      updateRangeControls();
      updateTitleText();
      renderMultiExerciseChart(getFilteredExerciseData());
      
      // Make sure dropdown remains hidden after updates
      hideDefaultExerciseDropdown();
    }).catch(error => {
      console.error('Error updating exercise tracker:', error);
      showNoDataMessage('Error updating exercise data');
    });
  }

  /**
   * Create a basic exercise selector dropdown element
   */
  function createExerciseDropdown(exercises) {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'exercise-selector';

    const label = document.createElement('label');
    label.textContent = 'Track exercise: ';
    label.htmlFor = 'exercise-select';
    dropdownContainer.appendChild(label);

    const select = document.createElement('select');
    select.id = 'exercise-select';
    select.className = 'form-select form-select-sm';

    exercises.forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise;
      option.textContent = exercise;
      select.appendChild(option);
    });

    // Change event now forces the selection to exactly the chosen exercise.
    select.addEventListener('change', async () => {
      const selectedValue = select.value;
      selectedExercises = [selectedValue];
      window.selectedExercises = selectedExercises;

      const chartContainer = document.querySelector('.exercise-chart-container');
      if (chartContainer) {
        chartContainer.innerHTML = `
          <div class="loading-spinner-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading data...</div>
          </div>
        `;
      }

      // Load the data for the selected exercise
      try {
        const data = await loadExerciseData(selectedValue, currentYear);
        allExerciseData[selectedValue] = data;
        updateRangeControls();
        updateTitleText();
        renderMultiExerciseChart(getFilteredExerciseData());
      } catch (error) {
        console.error('Error updating chart:', error);
        showNoDataMessage(`Error loading data for ${selectedValue}`);
      }
    });

    dropdownContainer.appendChild(select);
    
    // Hide the dropdown immediately after creation
    dropdownContainer.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; height: 0; overflow: hidden;';
    
    return dropdownContainer;
  }

  /**
   * Update the dropdown options when exercise list changes
   */
  function updateExerciseDropdown(exercises) {
    const select = document.getElementById('exercise-select');
    if (!select) return;

    const currentSelection = select.value;
    select.innerHTML = '';

    exercises.forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise;
      option.textContent = exercise;
      select.appendChild(option);
    });

    if (exercises.includes(currentSelection)) {
      select.value = currentSelection;
    } else {
      select.selectedIndex = 0;
      if (selectedExercises.length === 0) {
        selectedExercises = [select.value];
      }
    }
    
    // Ensure the dropdown container remains hidden
    hideDefaultExerciseDropdown();
  }

  /**
   * Create range control buttons and slider for number of workouts shown
   */
  function createRangeControls(container) {
    container.innerHTML = '';
  
    const containerWidth = container.clientWidth || 300;
    const isMobile = window.innerWidth < 500;
  
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'range-controls-and-legend';
    if (isMobile) mainWrapper.classList.add('mobile');
  
    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'range-controls-wrapper';
  
    const label = document.createElement('div');
    label.textContent = 'Show:';
    label.className = 'range-label';
    if (isMobile) label.classList.add('mobile');
    controlsWrapper.appendChild(label);
  
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';
  
    let totalWorkouts = 0;
    Object.values(allExerciseData).forEach(data => {
      if (data && data.length > totalWorkouts) {
        totalWorkouts = data.length;
      }
    });
  
    const presets = [];
    if (totalWorkouts >= 5) presets.push(5);
    if (totalWorkouts >= 10) presets.push(10);
    if (totalWorkouts >= 15 && containerWidth > 400) presets.push(15);
  
    presets.forEach((count) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-sm ' + (displayCount === count ? 'btn-primary' : 'btn-outline-secondary');
      button.textContent = `${count}`;
      if (isMobile) button.classList.add('mobile');
  
      button.addEventListener('click', () => {
        displayCount = count;
        document.querySelectorAll('.button-group .btn').forEach(btn => {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-outline-secondary');
        });
        button.classList.remove('btn-outline-secondary');
        button.classList.add('btn-primary');
        const slider = document.getElementById('range-slider');
        if (slider) slider.value = count;
        renderMultiExerciseChart(getFilteredExerciseData());
        // Removed call to addExerciseLegend here
      });
      buttonGroup.appendChild(button);
    });
  
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'btn btn-sm ' + (displayCount === null ? 'btn-primary' : 'btn-outline-secondary');
    allButton.textContent = 'All';
    if (isMobile) allButton.classList.add('mobile');
  
    allButton.addEventListener('click', () => {
      displayCount = null;
      document.querySelectorAll('.button-group .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-secondary');
      });
      allButton.classList.remove('btn-outline-secondary');
      allButton.classList.add('btn-primary');
      const slider = document.getElementById('range-slider');
      if (slider) slider.value = slider.max;
      renderMultiExerciseChart(getFilteredExerciseData());
      // Removed call to addExerciseLegend here
    });
    buttonGroup.appendChild(allButton);
    controlsWrapper.appendChild(buttonGroup);
  
    if (containerWidth > 400 && totalWorkouts > 5) {
      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'slider-container';
  
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
        document.querySelectorAll('.button-group .btn').forEach(btn => {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-outline-secondary');
        });
        if (displayCount === 5 || displayCount === 10 || displayCount === 15) {
          const matchingButton = Array.from(document.querySelectorAll('.button-group .btn'))
            .find(btn => btn.textContent === `${displayCount}`);
          if (matchingButton) {
            matchingButton.classList.remove('btn-outline-secondary');
            matchingButton.classList.add('btn-primary');
          }
        } else if (displayCount === null) {
          const allButton = Array.from(document.querySelectorAll('.button-group .btn'))
            .find(btn => btn.textContent === 'All');
          if (allButton) {
            allButton.classList.remove('btn-outline-secondary');
            allButton.classList.add('btn-primary');
          }
        }
        renderMultiExerciseChart(getFilteredExerciseData());
        // Removed call to addExerciseLegend here
      });
      sliderContainer.appendChild(slider);
      controlsWrapper.appendChild(sliderContainer);
    }
  
    mainWrapper.appendChild(controlsWrapper);
  
    // We still create the legendContainer for layout purposes,
    // but we don't populate it with any content
    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend-container';
    mainWrapper.appendChild(legendContainer);
  
    container.appendChild(mainWrapper);
    // Removed call to addExerciseLegend here
  }
  /**
   * Add a legend for selected exercises
   */
  function addExerciseLegend(container, containerWidth) {
    container.innerHTML = '';
    const isMobile = window.innerWidth < 500;
    const legend = document.createElement('div');
    legend.className = 'exercise-legend';
    if (isMobile) legend.classList.add('mobile');
  
    selectedExercises.forEach((exerciseName, index) => {
      if (index >= 3) return;
      
      // Get the muscle group and corresponding color
      const muscleGroup = getExerciseMuscleGroup(exerciseName);
      const color = muscleGroup && muscleColors[muscleGroup] 
        ? muscleColors[muscleGroup] 
        : exerciseColors[index % exerciseColors.length];
      
      const lineItem = document.createElement('div');
      lineItem.className = 'legend-item';
  
      const lineSwatch = document.createElement('span');
      lineSwatch.className = 'legend-swatch line';
      if (isMobile) lineSwatch.classList.add('mobile');
  
      const lineLabel = document.createElement('span');
      lineLabel.className = 'legend-label';
      const displayName = exerciseName.length > 12 ? exerciseName.substring(0, 10) + '...' : exerciseName;
      lineLabel.textContent = displayName;
      if (isMobile) lineLabel.classList.add('mobile');
  
      lineItem.appendChild(lineSwatch);
      lineItem.appendChild(lineLabel);
      legend.appendChild(lineItem);
    });
    if (selectedExercises.length > 0) container.appendChild(legend);
  }

  /**
   * Update range controls when data has changed
   */
  function updateRangeControls() {
    const container = document.querySelector('.range-control-container');
    if (container) createRangeControls(container);
  }

  /**
   * Return filtered exercise data based on displayCount setting
   */
  function getFilteredExerciseData() {
    const filteredData = {};
    Object.keys(allExerciseData).forEach(exerciseName => {
      if (selectedExercises.includes(exerciseName)) {
        const exerciseData = allExerciseData[exerciseName];
        if (!exerciseData || exerciseData.length === 0) {
          filteredData[exerciseName] = [];
          return;
        }
        if (!displayCount || displayCount >= exerciseData.length) {
          filteredData[exerciseName] = [...exerciseData];
        } else {
          const sortedData = [...exerciseData].sort((a, b) => a.date - b.date);
          filteredData[exerciseName] = sortedData.slice(-displayCount);
        }
      }
    });
    return filteredData;
  }

  /**
   * Retrieve all unique exercises for the given year
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
   * Load exercise data for a given exercise and year.
   */
  async function loadExerciseData(exerciseName, year) {
    const exerciseData = [];
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const today = new Date();
    const endDate = end > today ? today : end;
    const promises = [];
    for (let dt = new Date(start); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      const fileName = `data/${dd}-${mm}-${yyyy}.json`;
      const dtCopy = new Date(dt);
      promises.push(
        d3.json(fileName)
          .then(json => ({ date: dtCopy, json }))
          .catch(() => ({ date: dtCopy, json: null }))
      );
    }
    const results = await Promise.all(promises);
    results.forEach(({ date, json }) => {
      if (json && json.workout && Array.isArray(json.workout)) {
        const exerciseSets = json.workout.filter(set => set.Exercise === exerciseName);
        if (exerciseSets.length > 0) {
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
    exerciseData.sort((a, b) => a.date - b.date);
    return exerciseData;
  }

  /**
   * Helper to extract numeric weight from string
   */
  function parseWeight(weightStr) {
    if (!weightStr) return 0;
    const match = weightStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return 0;
  }


  /**
 * Determine the muscle group for an exercise based on its data
 */
function getExerciseMuscleGroup(exerciseName) {
  if (!exerciseName) return null;
  
  // Check if we have already cached the muscle group
  if (window.exerciseMuscleGroups && window.exerciseMuscleGroups[exerciseName]) {
    return window.exerciseMuscleGroups[exerciseName];
  }
  
  // Initialize a new map if needed
  if (!window.exerciseMuscleGroups) {
    window.exerciseMuscleGroups = {};
  }
  
  // If we have the exercise data, analyze it
  if (window.allExerciseData && window.allExerciseData[exerciseName]) {
    const exerciseData = window.allExerciseData[exerciseName];
    const muscleGroupCounts = {};
    
    // Count occurrences of each muscle group
    exerciseData.forEach(day => {
      if (day.sets && day.sets.length > 0) {
        day.sets.forEach(set => {
          if (set.muscleGroup && set.muscleGroup !== 'N/A') {
            muscleGroupCounts[set.muscleGroup] = (muscleGroupCounts[set.muscleGroup] || 0) + 1;
          }
        });
      }
    });
    
    // Find the most common muscle group
    if (Object.keys(muscleGroupCounts).length > 0) {
      const dominantMuscleGroup = Object.keys(muscleGroupCounts).reduce((a, b) => 
        muscleGroupCounts[a] > muscleGroupCounts[b] ? a : b);
      
      // Cache for future use
      window.exerciseMuscleGroups[exerciseName] = dominantMuscleGroup;
      return dominantMuscleGroup;
    }
  }
  
  // Default to "Chest" if can't determine
  return "Chest";
}

/**
 * Define muscle-specific colors
 */
const muscleColors = {
  "Chest": "#546bce", // Blue
  "Back": "#32a852",  // Green
  "Shoulders": "#ec812f", // Orange 
  "Legs": "#9c27b0",  // Purple
  "Biceps": "#2196f3", // Light blue
  "Triceps": "#f44336" // Red
};

/**
 * Get a lighter shade of a color for area fills
 */
function getLighterShade(hexColor, opacity = 0.15) {
  try {
    // Handle RGBA or other color formats
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
      return `rgba(128, 128, 128, ${opacity})`;  // fallback gray
    }
    
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Return rgba with opacity
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  } catch (e) {
    console.error('Error getting lighter shade:', e);
    return `rgba(128, 128, 128, ${opacity})`;  // fallback gray
  }
}

  /**
   * Render the line chart with error bands for the exercise data
   */
  function renderMultiExerciseChart(exerciseDataMap) {
    let chartContainer = document.querySelector('.exercise-chart-container');
    if (!chartContainer) {
      chartContainer = document.createElement('div');
      chartContainer.className = 'exercise-chart-container';
      secondChartArea.appendChild(chartContainer);
    }
    chartContainer.innerHTML = '';
    if (Object.keys(exerciseDataMap).length === 0) {
      showNoDataMessage('No exercise data available');
      return;
    }
    const exerciseNames = Object.keys(exerciseDataMap);
    let hasData = false;
    exerciseNames.forEach(name => {
      if (exerciseDataMap[name] && exerciseDataMap[name].length > 0) {
        hasData = true;
      }
    });
    if (!hasData) {
      showNoDataMessage('No data found for selected exercises');
      return;
    }
    const containerWidth = chartContainer.clientWidth || secondChartArea.clientWidth || 300;
    const isMobile = window.innerWidth < 500;
    const isStacked = window.innerWidth < 992;
    let aspectRatio = isStacked ? (containerWidth < 400 ? 1.5 : 1.8) : (containerWidth < 400 ? 2.2 : 2.5);
    const width = containerWidth;
    let baseHeight = width / aspectRatio;
    const minHeight = isStacked ? 220 : 170;
    const maxHeight = isStacked ? 320 : 240;
    const height = Math.max(minHeight, Math.min(maxHeight, baseHeight));
    chartContainer.style.height = `${height + 5}px`;
    
    // Updated margins to accommodate more informative labels on mobile
    const dynamicMargin = {
      top: 20,
      right: isMobile ? 40 : 60,
      bottom: isMobile ? 40 : 40, // Increased bottom margin on mobile for longer labels
      left: isMobile ? 45 : 45    // Consistent left margin with enough space for kg units
    };
    
    const innerWidth = width - dynamicMargin.left - dynamicMargin.right;
    const innerHeight = height - dynamicMargin.top - dynamicMargin.bottom;
  
    const svg = d3.create("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class", "exercise-chart");
  
    const g = svg.append("g")
      .attr("transform", `translate(${dynamicMargin.left},${dynamicMargin.top})`);
  
    const allProcessedData = {};
    let allDates = [];
    let allWeights = [];
  
    exerciseNames.forEach((exerciseName, index) => {
      const exerciseData = exerciseDataMap[exerciseName];
      if (!exerciseData || exerciseData.length === 0) return;
      const processedData = exerciseData.map(workout => {
        const weights = workout.sets.map(set => set.weight);
        const maxWeight = Math.max(...weights);
        const minWeight = Math.min(...weights);
        const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
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
      allProcessedData[exerciseName] = processedData;
      processedData.forEach(day => {
        allDates.push(day.date);
        allWeights.push(day.maxWeight);
        allWeights.push(day.minWeight);
      });
    });
  
    const x = d3.scaleTime()
      .domain(d3.extent(allDates))
      .range([0, innerWidth])
      .nice();
    const minWeight = d3.min(allWeights) || 0;
    const maxWeight = d3.max(allWeights) || 10;
    const padding = (maxWeight - minWeight) * 0.1 || 5;
    const y = d3.scaleLinear()
      .domain([Math.max(0, minWeight - padding), maxWeight + padding])
      .range([innerHeight, 0])
      .nice();
  
    // Use consistent number of ticks for gridlines
    g.append("g")
      .attr("class", "grid-lines-x")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(6, d3.max(exerciseNames.map(name => allProcessedData[name] ? allProcessedData[name].length : 0))))
        .tickSize(-innerHeight)
        .tickFormat("")
      )
      .call(g => g.select(".domain").remove());
  
    g.append("g")
      .attr("class", "grid-lines-y")
      .call(d3.axisLeft(y)
        .ticks(5) // Consistent 5 ticks for both mobile and desktop
        .tickSize(-innerWidth)
        .tickFormat("")
      )
      .call(g => g.select(".domain").remove());
  
    // Updated x-axis with consistent formatting and presentation
    const xAxis = g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(6, d3.max(exerciseNames.map(name => allProcessedData[name] ? allProcessedData[name].length : 0))))
        .tickSizeOuter(0)
        .tickFormat(d => {
          // Always show month and day for consistent formatting
          const day = d.getDate();
          const month = d.getMonth();
          return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month]} ${day}`;
        })
      );
    xAxis.select(".domain").attr("stroke", "#ccc");
    xAxis.selectAll("text")
      .attr("transform", "rotate(-40)") // Consistent rotation angle
      .attr("text-anchor", "end")
      .attr("dx", "-0.5em")
      .attr("dy", "0.15em")
      .style("font-size", isMobile ? "10px" : "12px"); // Adjust font size for mobile
  
    // Updated y-axis with consistent formatting
    const yAxis = g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y)
        .ticks(5) // Consistent 5 ticks for both mobile and desktop
        .tickSizeOuter(0)
        .tickFormat(d => `${d}kg`) // Always include kg units
      );
    yAxis.select(".domain").attr("stroke", "#ccc");
    yAxis.selectAll("text")
      .style("font-size", isMobile ? "10px" : "12px"); // Adjust font size for mobile
  
    let tooltip = d3.select("body").select(".exercise-tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("class", "exercise-tooltip");
    }
  
    exerciseNames.forEach((exerciseName, index) => {
      if (!allProcessedData[exerciseName] || allProcessedData[exerciseName].length === 0) return;
      
      // Get the muscle group and corresponding color
      const muscleGroup = getExerciseMuscleGroup(exerciseName);
      const color = muscleGroup && muscleColors[muscleGroup] 
        ? muscleColors[muscleGroup] 
        : exerciseColors[index % exerciseColors.length];
      
      const processedData = allProcessedData[exerciseName];
      const areaGenerator = d3.area()
        .x(d => x(d.date))
        .y0(d => y(d.minWeight))
        .y1(d => y(d.maxWeight))
        .curve(d3.curveMonotoneX);
      g.append("path")
        .datum(processedData)
        .attr("fill", color) // Use muscle-specific color
        .attr("fill-opacity", 0.15)
        .attr("d", areaGenerator);
  
      const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.weightedAvg))
        .curve(d3.curveMonotoneX);
      g.append("path")
        .datum(processedData)
        .attr("fill", "none")
        .attr("stroke", color) // Use muscle-specific color
        .attr("stroke-width", isMobile ? 2 : 2.5)
        .attr("d", lineGenerator);
  
      const avgPointRadius = isMobile ? 3 : 4;
      processedData.forEach(dayData => {
        g.append("circle")
          .attr("class", "avg-point")
          .attr("cx", x(dayData.date))
          .attr("cy", y(dayData.weightedAvg))
          .attr("r", avgPointRadius)
          .style("fill", color) // Use muscle-specific color
          .attr("stroke", "white")
          .attr("stroke-width", 1.5)
          .on("mouseover", function(event) {
            d3.select(this)
              .attr("r", avgPointRadius + 1.5)
              .attr("stroke-width", 1.8);
            const dateStr = dayData.date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
            
            // Add muscle group to tooltip
            let tooltipContent = `
              <div class="tooltip-title">${exerciseName}</div>
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
                <div class="tooltip-stat-line">
                  <span>Group:</span>
                  <span>${muscleGroup || 'Unknown'}</span>
                </div>
              </div>
            `;
            tooltip
              .style("visibility", "visible")
              .html(tooltipContent);
          })
          .on("mousemove", function(event) {
            const tooltipWidth = 150;
            const windowWidth = window.innerWidth;
            let xPosition = event.pageX + 10;
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
      });
    });
  
    if (exerciseNames.length > 1) {
      const legendG = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${width - dynamicMargin.right + 10}, ${dynamicMargin.top})`);
      exerciseNames.forEach((name, index) => {
        if (!allProcessedData[name] || allProcessedData[name].length === 0) return;
        
        // Get muscle color for legend
        const muscleGroup = getExerciseMuscleGroup(name);
        const color = muscleGroup && muscleColors[muscleGroup] 
          ? muscleColors[muscleGroup] 
          : exerciseColors[index % exerciseColors.length];
        
        const displayName = name.length > 10 ? name.substring(0, 10) + '...' : name;
        const legendItem = legendG.append("g")
          .attr("transform", `translate(0, ${index * 20})`);
        legendItem.append("line")
          .attr("x1", 0)
          .attr("y1", 9)
          .attr("x2", 15)
          .attr("y2", 9)
          .attr("stroke", color) // Use muscle-specific color
          .attr("stroke-width", 2);
        legendItem.append("text")
          .attr("x", 20)
          .attr("y", 12)
          .attr("font-size", "10px")
          .attr("fill", "#666")
          .text(displayName);
      });
    }
  
    let titleText;
    if (exerciseNames.length === 1) {
      titleText = exerciseNames[0];
    } else {
      titleText = `${exerciseNames.length} Exercises Comparison`;
    }
    g.append("text")
      .attr("class", "chart-title")
      .attr("x", innerWidth / 2)
      .attr("y", -dynamicMargin.top / 2)
      .attr("text-anchor", "middle")
      .text(titleText);
  
    chartContainer.appendChild(svg.node());
  }
  /**
   * Display message when no exercise data is available
   */
  function showNoDataMessage(message) {
    if (!secondChartArea) return;
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
   * Show message when no data for a specific exercise is found
   */
  function showNoExerciseDataMessage(container, exerciseName) {
    container.innerHTML = `
      <div class="error-message">
        <div class="error-message-primary">No data found for ${exerciseName || 'selected exercise'}</div>
        <div class="error-message-secondary">Try selecting a different exercise</div>
      </div>
    `;
  }

  /**
   * Update the title text in the custom dropdown
   */
  function updateTitleText() {
    const titleElement = titleElements?.title;
    if (!titleElement) return;
    if (selectedExercises.length === 0) {
      titleElement.textContent = 'Select Exercise';
      return;
    }
    if (selectedExercises.length === 1) {
      titleElement.textContent = selectedExercises[0];
    } else {
      const firstExercise = selectedExercises[0];
      if (selectedExercises.length === 2) {
        const secondExercise = selectedExercises[1];
        titleElement.textContent = `${firstExercise} + ${secondExercise}`;
      } else {
        titleElement.textContent = `${firstExercise} + ${selectedExercises.length - 1} more`;
      }
    }
  }
  
  /**
   * Function to hide the default exercise dropdown
   */
  function hideDefaultExerciseDropdown() {
    const exerciseSelectorContainer = document.querySelector('.exercise-selector');
    if (exerciseSelectorContainer) {
      exerciseSelectorContainer.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; height: 0; overflow: hidden;';
      exerciseSelectorContainer.setAttribute('data-hidden', 'true');
    }
  }

  // Expose functions and data loading routine for external usage (including enhanced dropdown)
  window.weightAnalysis = {
    init: initExerciseTracker,
    updateYear: updateYear,
    renderMultiExerciseChart: renderMultiExerciseChart,
    getFilteredExerciseData: getFilteredExerciseData,
    loadExerciseData: loadExerciseData,
    hideDefaultExerciseDropdown: hideDefaultExerciseDropdown
  };

  // Also expose rendering functions globally
  window.renderMultiExerciseChart = renderMultiExerciseChart;
  window.getFilteredExerciseData = getFilteredExerciseData;

  /**
   * Check that DOM is ready before initializing
   */
  function checkAndInitialize() {
    console.log('checkAndInitialize called');
    document.addEventListener("DOMContentLoaded", () => {
      populateWAYearSelect();
      initExerciseTracker();
      // Hide dropdown after initialization
      setTimeout(hideDefaultExerciseDropdown, 100);
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      if (document.getElementById('secondChartArea')) {
        console.log('Exercise tracker: DOM is ready, initializing...');
        initExerciseTracker();
        // Hide dropdown after initialization
        setTimeout(hideDefaultExerciseDropdown, 100);
      } else {
        console.log('Exercise tracker: Chart area not found, will retry...');
        setTimeout(checkAndInitialize, 100);
      }
    } else {
      console.log('Exercise tracker: Waiting for DOM to be ready...');
      document.addEventListener('DOMContentLoaded', checkAndInitialize);
    }
  }

  // Start initialization
  checkAndInitialize();

  // Note: Do not call initializeTitleWithDropdown() again here to avoid duplicate initialization.
})();

function createEnhancedExerciseDropdown() {
  const muscleGroups = ["Chest", "Back", "Shoulders", "Legs", "Biceps", "Triceps"];
  const muscleDisplayNames = {
    "Chest": "Chest",
    "Back": "Back",
    "Shoulders": "Shoulders", 
    "Legs": "Legs",
    "Biceps": "Biceps",
    "Triceps": "Triceps"
  };
  
  // Define muscle-specific colors
  const muscleColors = {
    "Chest": "#546bce", // Blue
    "Back": "#32a852", // Green
    "Shoulders": "#ec812f", // Orange 
    "Legs": "#9c27b0", // Purple
    "Biceps": "#2196f3", // Light blue
    "Triceps": "#f44336" // Red
  };
  
  // Define background colors (lighter versions)
  const muscleBackgroundColors = {
    "Chest": "#e8eaf6",
    "Back": "#e5f1e6",
    "Shoulders": "#fff8e1", 
    "Legs": "#f3e5f5",
    "Biceps": "#e1f5fe",
    "Triceps": "#fbe9e7"
  };
  
  // Helper functions for different color states
  const getHoverColor = (muscleGroup) => {
    if (!muscleGroup || !muscleBackgroundColors[muscleGroup]) return 'rgba(0, 0, 0, 0.02)';
    
    // Convert the hex color to a more transparent version for hover
    const hexColor = muscleBackgroundColors[muscleGroup].replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, 0.25)`; // Reduced opacity for more faded hover
  };
  
  const getSelectionColor = (muscleGroup) => {
    if (!muscleGroup || !muscleBackgroundColors[muscleGroup]) return 'rgba(0, 0, 0, 0.1)';
    
    // Convert hex color to a more visible version for selection
    const hexColor = muscleBackgroundColors[muscleGroup].replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, 0.35)`; // Better opacity level for selection
  };
  
  // Get the border color from the muscle group
  const getBorderColor = (muscleGroup) => {
    return muscleGroup && muscleColors[muscleGroup] 
      ? muscleColors[muscleGroup] 
      : '#546bce'; // Default fallback color
  };

  let dropdownContainer = document.querySelector('.title-dropdown-container');
  const existingDropdown = document.getElementById('exercise-select');
  if (!existingDropdown) {
    console.error('Exercise dropdown not found');
    return;
  }
  
  if (!dropdownContainer) {
    const titleElement = document.querySelector('#secondPlot .content-header h3.content-title');
    if (!titleElement) return;
    const newDropdownContainer = document.createElement('div');
    newDropdownContainer.className = 'title-dropdown-container';
    
    // Create visible title with loading state
    const visibleTitle = document.createElement('div');
    visibleTitle.className = 'visible-title';
    visibleTitle.innerHTML = `
      <span class="title-text">Loading exercises...</span>
      <span class="dropdown-arrow">▾</span>
    `;
    
    const select = document.createElement('select');
    select.id = 'title-exercise-select';
    select.className = 'hidden-select';
    
    // Create custom dropdown menu container with loading state
    const customDropdown = document.createElement('div');
    customDropdown.className = 'custom-dropdown-menu';
    customDropdown.style.display = 'none';
    customDropdown.setAttribute('role', 'listbox');
    customDropdown.setAttribute('aria-label', 'Exercise Selection');
    
    // Add loading indicator initially
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'dropdown-loading';
    loadingIndicator.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <div class="loading-spinner" style="width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #546bce; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite;"></div>
        <div style="margin-top: 10px; color: #666;">Loading exercises...</div>
      </div>
    `;
    customDropdown.appendChild(loadingIndicator);
    
    // Mobile header for the dropdown
    const mobileHeader = document.createElement('div');
    mobileHeader.className = 'dropdown-mobile-header';
    mobileHeader.innerHTML = `
      <div class="dropdown-title">Select Exercise</div>
      <button class="dropdown-close" aria-label="Close selection">✕</button>
    `;
    customDropdown.appendChild(mobileHeader);
    
    // Assemble dropdown container
    newDropdownContainer.appendChild(visibleTitle);
    newDropdownContainer.appendChild(select);
    newDropdownContainer.appendChild(customDropdown);
    
    // Replace the old title element with our dropdown container
    titleElement.parentNode.replaceChild(newDropdownContainer, titleElement);
    dropdownContainer = newDropdownContainer;
    
    // Make the dropdown clickable immediately
    visibleTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      // Show the dropdown with loading state
      window.toggleDropdown && window.toggleDropdown(true);
    });
    
    // Add improved touch handling right away
    visibleTitle.addEventListener('touchstart', function() {
      this.dataset.touchActive = 'true';
    }, { passive: true });
    
    visibleTitle.addEventListener('touchend', function(e) {
      if (this.dataset.touchActive === 'true') {
        e.preventDefault();
        e.stopPropagation();
        this.dataset.touchActive = 'false';
        window.toggleDropdown && window.toggleDropdown(true);
      }
    }, { passive: false });
  }

  // Create backdrop for mobile if not exists - SINGLE BACKDROP INITIALIZATION
  let backdrop = document.querySelector('.dropdown-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'dropdown-backdrop';
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
    document.body.appendChild(backdrop);
  } else {
    backdrop.style.display = 'none';
    backdrop.style.opacity = '0';
    backdrop.style.pointerEvents = 'none';
  }

  // Define toggle function early so UI can be responsive
  window.toggleDropdown = (show) => {
    const customDropdown = dropdownContainer.querySelector('.custom-dropdown-menu');
    if (!customDropdown) return;
    
    if (show === undefined) show = customDropdown.style.display !== 'block';
    
    if (show) {
      const isMobile = window.innerWidth <= 576;
      
      // Position dropdown properly
      customDropdown.style.display = 'block';
      
      if (isMobile) {
        // Mobile centered positioning
        customDropdown.style.position = 'fixed';
        customDropdown.style.top = '50%';
        customDropdown.style.left = '50%';
        customDropdown.style.transform = 'translate(-50%, -50%)';
        customDropdown.style.maxHeight = '80vh';
        customDropdown.style.zIndex = '1051';
        customDropdown.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
        customDropdown.style.borderRadius = '8px';
        
        // Ensure backdrop is visible
        backdrop.style.display = 'block';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
        backdrop.style.zIndex = '1050';
        backdrop.style.pointerEvents = 'auto';
        
        // Prevent scrolling on the body
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
          backdrop.style.opacity = '1';
          backdrop.classList.add('active');
        }, 10);
      } else {
        // Desktop positioning
        customDropdown.style.position = 'absolute';
        customDropdown.style.top = 'calc(100% + 10px)';
        customDropdown.style.left = '0';
        customDropdown.style.transform = 'none';
        customDropdown.style.maxHeight = '450px';
        customDropdown.style.zIndex = '1020';
      }
      
      dropdownContainer.classList.add('active');
    } else {
      // Hide dropdown
      customDropdown.style.display = 'none';
      backdrop.classList.remove('active');
      backdrop.style.opacity = '0';
      backdrop.style.pointerEvents = 'none';
      
      // Re-enable scrolling
      document.body.style.overflow = '';
      
      setTimeout(() => {
        if (!dropdownContainer.classList.contains('active')) {
          backdrop.style.display = 'none';
        }
      }, 200);
      
      dropdownContainer.classList.remove('active');
    }
  };

  const visibleTitleText = dropdownContainer.querySelector('.title-text');
  const customDropdown = dropdownContainer.querySelector('.custom-dropdown-menu');
  const hiddenSelect = dropdownContainer.querySelector('.hidden-select');

  let enhancedSelectedExercises = window.selectedExercises || [];
  const exerciseOptions = Array.from(existingDropdown.options).map(option => ({
    value: option.value,
    text: option.text,
    muscleGroup: null
  }));

  // Updated hover effects with more faded hover colors
  function setupHoverEffects(item, muscleGroup) {
    item.addEventListener('mouseover', () => {
      if (!item.classList.contains('selected')) {
        item.style.backgroundColor = getHoverColor(muscleGroup);
      }
    });
    
    item.addEventListener('mouseout', () => {
      if (!item.classList.contains('selected')) {
        item.style.backgroundColor = '';
      }
    });
  }

  async function createDropdownWithMuscleGroups() {
    try {
      // Start with a loading indicator in the dropdown
      if (visibleTitleText) {
        visibleTitleText.textContent = 'Loading exercises...';
      }
      
      // Fetch exercise data in the background
      const exerciseToMuscleGroup = await fetchExerciseMuscleGroups();
      const workoutCounts = await fetchExerciseWorkoutCounts();
      
      // Update UI once data is loaded
      if (visibleTitleText) {
        // Update title to show default or selected exercise
        if (enhancedSelectedExercises.length === 1) {
          const selectedOption = exerciseOptions.find(o => o.value === enhancedSelectedExercises[0]);
          visibleTitleText.textContent = selectedOption ? selectedOption.text : 'Select Exercise';
        } else {
          visibleTitleText.textContent = 'Select Exercise';
        }
      }
      
      // Clear the dropdown content and rebuild it
      customDropdown.innerHTML = '';
      
      const mobileHeader = document.createElement('div');
      mobileHeader.className = 'dropdown-mobile-header';
      mobileHeader.innerHTML = `
        <div class="dropdown-title">Select Exercise</div>
        <button class="dropdown-close" aria-label="Close selection">✕</button>
      `;
      customDropdown.appendChild(mobileHeader);

      const muscleGroupsData = {};
      muscleGroups.forEach(group => {
        muscleGroupsData[group] = {
          name: muscleDisplayNames[group] || group,
          color: muscleColors[group] || "#546bce",
          backgroundColor: muscleBackgroundColors[group] || "#f5f5f5",
          exercises: []
        };
      });

      // Only include exercises with 2+ workouts
      const eligibleExercises = exerciseOptions.filter(exercise => 
        workoutCounts[exercise.text] && workoutCounts[exercise.text] >= 2
      );

      // Calculate width based on longest exercise name
      let maxLabelWidth = 0;
      eligibleExercises.forEach(exercise => {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.font = '0.9rem sans-serif';
        tempSpan.textContent = exercise.text;
        document.body.appendChild(tempSpan);
        const width = tempSpan.offsetWidth;
        if (width > maxLabelWidth) maxLabelWidth = width;
        document.body.removeChild(tempSpan);
      });
      
      // Add margin for left border and padding
      const calculatedWidth = Math.min(Math.max(maxLabelWidth + 50, 240), 320);
      customDropdown.style.width = `${calculatedWidth}px`;

      // Organize exercises by muscle group
      eligibleExercises.forEach(exercise => {
        const muscleGroup = exerciseToMuscleGroup[exercise.text] || null;
        exercise.muscleGroup = muscleGroup;
        if (muscleGroup && muscleGroupsData[muscleGroup]) {
          muscleGroupsData[muscleGroup].exercises.push(exercise);
        } else {
          muscleGroupsData[muscleGroups[0]].exercises.push(exercise);
        }
      });

      // Update hidden select element
      hiddenSelect.innerHTML = '';
      eligibleExercises.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.text;
        hiddenSelect.appendChild(optElement);
      });

      const groupList = document.createElement('div');
      groupList.className = 'muscle-group-list';

      // Check if we have a valid selection
      let hasValidSelection = enhancedSelectedExercises.length > 0 && 
                              eligibleExercises.some(ex => enhancedSelectedExercises.includes(ex.value));
      
      // Set default exercise if needed
      let defaultExercise = null;
      if (!hasValidSelection) {
        if (eligibleExercises.length > 0) {
          defaultExercise = eligibleExercises.find(ex => ex.text === "Bench Press") || eligibleExercises[0];
          enhancedSelectedExercises = [defaultExercise.value];
        } else {
          enhancedSelectedExercises = [];
        }
      }

      // Build the muscle group sections
      let visibleGroupCount = 0;
      muscleGroups.forEach(groupKey => {
        const group = muscleGroupsData[groupKey];
        if (group.exercises.length > 0) {
          // Add visual divider between groups
          if (visibleGroupCount > 0) {
            const divider = document.createElement('div');
            divider.className = 'muscle-group-divider';
            groupList.appendChild(divider);
          }
          visibleGroupCount++;
          
          const section = document.createElement('div');
          section.className = 'muscle-group-section';
          section.dataset.group = groupKey;
          
          const header = document.createElement('div');
          header.className = 'muscle-group-header';
          header.textContent = group.name;
          header.style.backgroundColor = group.backgroundColor;
          section.appendChild(header);
          
          const exerciseList = document.createElement('div');
          exerciseList.className = 'exercise-list';
          
          group.exercises.forEach(exercise => {
            const item = document.createElement('div');
            item.className = 'exercise-item';
            item.setAttribute('role', 'option');
            item.dataset.value = exercise.value;
            item.dataset.muscleGroup = exercise.muscleGroup || '';
            
            // Create label
            const label = document.createElement('span');
            label.className = 'exercise-label';
            label.textContent = exercise.text;
            item.appendChild(label);
            
            // Set up hover effects
            setupHoverEffects(item, exercise.muscleGroup);
            
            // Mark as selected if in current selection
            if (enhancedSelectedExercises.includes(exercise.value)) {
              item.classList.add('selected');
              item.setAttribute('aria-selected', 'true');
              item.style.backgroundColor = getSelectionColor(exercise.muscleGroup);
              item.style.borderLeftColor = getBorderColor(exercise.muscleGroup);
            } else {
              item.setAttribute('aria-selected', 'false');
            }
            
            exerciseList.appendChild(item);
          });
          
          section.appendChild(exerciseList);
          groupList.appendChild(section);
        }
      });
      
      customDropdown.appendChild(groupList);
      
      // Show message if no exercises found
      if (eligibleExercises.length === 0) {
        const noExercisesMsg = document.createElement('div');
        noExercisesMsg.className = 'no-exercises-message';
        noExercisesMsg.textContent = 'No exercises with 2+ workouts found.';
        customDropdown.appendChild(noExercisesMsg);
      }
      
      // Fix mobile click issues with improved handling
      fixMobileClickIssues(customDropdown, enhancedSelectedExercises);
      
      // Update title text
      updateTitleText();
      
      // Hide default dropdown
      if (window.weightAnalysis && window.weightAnalysis.hideDefaultExerciseDropdown) {
        window.weightAnalysis.hideDefaultExerciseDropdown();
      } else {
        const exerciseSelectorContainer = existingDropdown.closest('.exercise-selector');
        if (exerciseSelectorContainer) {
          exerciseSelectorContainer.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; height: 0; overflow: hidden;';
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error creating dropdown:', error);
      
      // Show error state in dropdown
      if (customDropdown) {
        customDropdown.innerHTML = `
          <div class="dropdown-mobile-header">
            <div class="dropdown-title">Select Exercise</div>
            <button class="dropdown-close" aria-label="Close selection">✕</button>
          </div>
          <div class="no-exercises-message" style="padding: 20px; text-align: center; color: #d32f2f;">
            Error loading exercises. Please try again.
          </div>
        `;
      }
      
      // Still make sure we have a working fix for mobile click issues
      fixMobileClickIssues(customDropdown, enhancedSelectedExercises);
      
      return false;
    }
  }

  // Async function to fetch exercise workout counts
  async function fetchExerciseWorkoutCounts() {
    let workoutCounts = {};
    const currentYear = window.currentYear || new Date().getFullYear();
    try {
      const start = new Date(currentYear, 0, 1);
      const end = new Date();
      
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yyyy = dt.getFullYear();
        const fileName = `data/${dd}-${mm}-${yyyy}.json`;
        
        try {
          const response = await fetch(fileName);
          if (!response.ok) continue;
          const json = await response.json();
          if (!json || !json.workout || !Array.isArray(json.workout)) continue;
          
          // Group by exercise
          const exercisesForDay = new Set();
          json.workout.forEach(set => {
            if (set.Exercise) {
              exercisesForDay.add(set.Exercise);
            }
          });
          
          // Count each exercise once per day
          exercisesForDay.forEach(exercise => {
            workoutCounts[exercise] = (workoutCounts[exercise] || 0) + 1;
          });
          
        } catch (error) {
          continue;
        }
      }
      
      return workoutCounts;
    } catch (error) {
      console.error('Error fetching exercise workout counts:', error);
      return {};
    }
  }

  // Async function to fetch exercise muscle groups
  async function fetchExerciseMuscleGroups() {
    let exerciseData = {};
    const currentYear = window.currentYear || new Date().getFullYear();
    try {
      const start = new Date(currentYear, 0, 1);
      const end = new Date();
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yyyy = dt.getFullYear();
        const fileName = `data/${dd}-${mm}-${yyyy}.json`;
        try {
          const response = await fetch(fileName);
          if (!response.ok) continue;
          const json = await response.json();
          if (!json || !json.workout || !Array.isArray(json.workout)) continue;
          json.workout.forEach(set => {
            if (set.Exercise && set['Muscle-Group']) {
              exerciseData[set.Exercise] = set['Muscle-Group'];
            }
          });
        } catch (error) {
          continue;
        }
      }
      return exerciseData;
    } catch (error) {
      console.error('Error fetching exercise muscle groups:', error);
      return {};
    }
  }

  // Function to fix mobile click issues with improved touch handling
  function fixMobileClickIssues(dropdownElement, selectedExercises) {
    // Set up enhanced mobile toggle function with loading state
    window.toggleDropdown = (show) => {
      if (show === undefined) show = dropdownElement.style.display !== 'block';
      
      // If opening the dropdown, show it immediately with loading state if needed
      if (show) {
        const isMobile = window.innerWidth <= 576;
        
        // Position dropdown properly
        dropdownElement.style.display = 'block';
        
        if (isMobile) {
          // Mobile centered positioning with proper z-index
          dropdownElement.style.position = 'fixed';
          dropdownElement.style.top = '50%';
          dropdownElement.style.left = '50%';
          dropdownElement.style.transform = 'translate(-50%, -50%)';
          dropdownElement.style.maxHeight = '80vh';
          dropdownElement.style.zIndex = '1051'; // Higher than backdrop
          dropdownElement.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
          dropdownElement.style.borderRadius = '8px';
          
          // Show backdrop immediately
          backdrop.style.display = 'block';
          backdrop.style.position = 'fixed';
          backdrop.style.top = '0';
          backdrop.style.left = '0';
          backdrop.style.width = '100%';
          backdrop.style.height = '100%';
          backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
          backdrop.style.zIndex = '1050';
          backdrop.style.pointerEvents = 'auto';
          
          // Prevent scrolling on the body when dropdown is open
          document.body.style.overflow = 'hidden';
          
          setTimeout(() => {
            backdrop.style.opacity = '1';
            backdrop.classList.add('active');
          }, 10);
        } else {
          // Desktop positioning
          dropdownElement.style.position = 'absolute';
          dropdownElement.style.top = 'calc(100% + 10px)';
          dropdownElement.style.left = '0';
          dropdownElement.style.transform = 'none';
          dropdownElement.style.maxHeight = '450px';
          dropdownElement.style.zIndex = '1020';
        }
        
        dropdownContainer.classList.add('active');
        
        // Scroll to selected exercise after a small delay
        setTimeout(() => {
          const selected = dropdownElement.querySelector('.exercise-item.selected');
          if (selected) {
            selected.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, 100);
      } else {
        // Closing the dropdown
        dropdownElement.style.display = 'none';
        backdrop.classList.remove('active');
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';
        
        // Re-enable scrolling
        document.body.style.overflow = '';
        
        setTimeout(() => {
          if (!dropdownContainer.classList.contains('active')) {
            backdrop.style.display = 'none';
          }
        }, 200);
        
        dropdownContainer.classList.remove('active');
      }
    };
  
    // Add direct click handler to each exercise item with improved touch handling
    const items = dropdownElement.querySelectorAll('.exercise-item');
    items.forEach(item => {
      // Remove all existing listeners by cloning the node
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);
      
      // Add hover effects again after cloning
      setupHoverEffects(newItem, newItem.dataset.muscleGroup);
      
      // Add the new click handler directly
      newItem.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // The exercise value we need to select
        const exerciseValue = this.dataset.value;
        const muscleGroup = this.dataset.muscleGroup;
        
        // Clear selection from all items
        const allItems = dropdownElement.querySelectorAll('.exercise-item');
        allItems.forEach(el => {
          el.classList.remove('selected');
          el.setAttribute('aria-selected', 'false');
          el.style.backgroundColor = '';
          el.style.borderLeftColor = '';
        });
        
        // Mark clicked item as selected
        this.classList.add('selected');
        this.setAttribute('aria-selected', 'true');
        
        // Apply selection color and border
        this.style.backgroundColor = getSelectionColor(muscleGroup);
        this.style.borderLeftColor = getBorderColor(muscleGroup);
        
        // Update selection state
        enhancedSelectedExercises = [exerciseValue];
        
        // Update UI and chart
        updateTitleText();
        updateExercisesChart();
        
        // Close dropdown
        toggleDropdown(false);
      });
      
      // Improved touch event handling - CRITICAL FIX
      newItem.addEventListener('touchstart', function() {
        // Mark this element as being touched
        this.dataset.touchActive = 'true';
      }, { passive: true });
      
      // Add touchmove handler to cancel the touch when scrolling - CRITICAL FIX
      newItem.addEventListener('touchmove', function() {
        // Cancel the active state as soon as any movement is detected
        this.dataset.touchActive = 'false';
      }, { passive: true });
      
      newItem.addEventListener('touchend', function(e) {
        // Only process if this element was the one that received touchstart
        // and no touchmove occurred (touchActive is still true)
        if (this.dataset.touchActive === 'true') {
          e.preventDefault();
          e.stopPropagation();
          
          // Remove the touch active flag
          this.dataset.touchActive = 'false';
          
          // Trigger the selection logic
          this.click();
        }
      }, { passive: false });
      
      // Handle touch cancel
      newItem.addEventListener('touchcancel', function() {
        this.dataset.touchActive = 'false';
      }, { passive: true });
    });
    
    // Fix the mobile header close button
    const closeBtn = dropdownElement.querySelector('.dropdown-close');
    if (closeBtn) {
      const newCloseBtn = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
      
      // Improved close button handling
      newCloseBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        toggleDropdown(false);
      });
      
      // Better touch handling for close button
      newCloseBtn.addEventListener('touchstart', function() {
        this.dataset.touchActive = 'true';
      }, { passive: true });
      
      // Add touchmove handler to cancel touch when moving - CRITICAL FIX
      newCloseBtn.addEventListener('touchmove', function() {
        this.dataset.touchActive = 'false';
      }, { passive: true });
      
      newCloseBtn.addEventListener('touchend', function(e) {
        if (this.dataset.touchActive === 'true') {
          e.preventDefault();
          e.stopPropagation();
          this.dataset.touchActive = 'false';
          toggleDropdown(false);
        }
      }, { passive: false });
    }
    
    // Improved backdrop interaction
    backdrop.addEventListener('click', function(e) {
      e.preventDefault();
      toggleDropdown(false);
    });
    
    // Add touchstart to immediately capture the touch
    backdrop.addEventListener('touchstart', function() {
      this.dataset.touchActive = 'true';
    }, { passive: true });
    
    // Add touchmove handler to cancel touch when moving - CRITICAL FIX
    backdrop.addEventListener('touchmove', function() {
      this.dataset.touchActive = 'false'; 
    }, { passive: true });
    
    // Improved touchend handling for backdrop
    backdrop.addEventListener('touchend', function(e) {
      if (this.dataset.touchActive === 'true') {
        e.preventDefault();
        e.stopPropagation();
        this.dataset.touchActive = 'false';
        toggleDropdown(false);
      }
    }, { passive: false });
    
    // Setup document click to close dropdown when clicking outside
    // But make sure it doesn't interfere with our touch events
    document.addEventListener('click', function(e) {
      // Don't close if we're clicking inside the dropdown or the title
      if (!e.target.closest('.title-dropdown-container') && 
          !e.target.closest('.custom-dropdown-menu')) {
        toggleDropdown(false);
      }
    });
    
    // Set up visible title click with improved feedback
    const visibleTitle = dropdownContainer.querySelector('.visible-title');
    if (visibleTitle) {
      const newVisibleTitle = visibleTitle.cloneNode(true);
      visibleTitle.parentNode.replaceChild(newVisibleTitle, visibleTitle);
      
      // Add a loading class initially to show it's getting ready
      newVisibleTitle.classList.add('loading-state');
      
      // Create a loading indicator
      const loadingIndicator = document.createElement('span');
      loadingIndicator.className = 'title-loading-indicator';
      loadingIndicator.style.display = 'none';
      loadingIndicator.style.width = '12px';
      loadingIndicator.style.height = '12px';
      loadingIndicator.style.borderRadius = '50%';
      loadingIndicator.style.border = '2px solid rgba(84, 107, 206, 0.3)';
      loadingIndicator.style.borderTopColor = '#546bce';
      loadingIndicator.style.animation = 'spin 1s linear infinite';
      loadingIndicator.style.marginLeft = '8px';
      newVisibleTitle.appendChild(loadingIndicator);
      
      // Remove loading state after a short delay
      setTimeout(() => {
        newVisibleTitle.classList.remove('loading-state');
        loadingIndicator.style.display = 'none';
      }, 500);
      
      // Improved click handling
      newVisibleTitle.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Show a small loading indicator
        loadingIndicator.style.display = 'inline-block';
        
        // Toggle the dropdown (open if closed, close if open)
        toggleDropdown();
        
        // Hide the loading indicator after a short delay
        setTimeout(() => {
          loadingIndicator.style.display = 'none';
        }, 300);
      });
      
      // Better touch handling for the title
      newVisibleTitle.addEventListener('touchstart', function() {
        this.dataset.touchActive = 'true';
      }, { passive: true });
      
      // Add touchmove handler to cancel touch when moving - CRITICAL FIX
      newVisibleTitle.addEventListener('touchmove', function() {
        this.dataset.touchActive = 'false';
      }, { passive: true });
      
      newVisibleTitle.addEventListener('touchend', function(e) {
        if (this.dataset.touchActive === 'true') {
          e.preventDefault();
          e.stopPropagation();
          
          // Remove touch active flag
          this.dataset.touchActive = 'false';
          
          // Show loading indicator
          loadingIndicator.style.display = 'inline-block';
          
          // Toggle dropdown without forcing it open
          toggleDropdown();
          
          // Hide loading after a delay
          setTimeout(() => {
            loadingIndicator.style.display = 'none';
          }, 300);
        }
      }, { passive: false });
    }
    
    // Make sure dropdown header is fixed
    const mobileHeader = dropdownElement.querySelector('.dropdown-mobile-header');
    if (mobileHeader) {
      mobileHeader.style.position = 'sticky';
      mobileHeader.style.top = '0';
      mobileHeader.style.zIndex = '5';
      mobileHeader.style.backgroundColor = 'white';
      mobileHeader.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    }
    
    // Add keyboard navigation
    dropdownElement.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggleDropdown(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(dropdownElement.querySelectorAll('.exercise-item'));
        const currentIndex = items.findIndex(item => item === document.activeElement);
        let newIndex;
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }
        items[newIndex].focus();
      }
      if (e.key === 'Enter' && document.activeElement.classList.contains('exercise-item')) {
        document.activeElement.click();
      }
    });
  }

  // Update title text based on selection
  function updateTitleText() {
    const titleElement = dropdownContainer.querySelector('.title-text');
    if (!titleElement) return;
    
    if (enhancedSelectedExercises.length === 0) {
      titleElement.textContent = 'Select Exercise';
    } else {
      const selectedValue = enhancedSelectedExercises[0];
      const exercise = exerciseOptions.find(opt => opt.value === selectedValue);
      titleElement.textContent = exercise ? exercise.text : 'Select Exercise';
      
      // Update the native select element
      if (existingDropdown && selectedValue) {
        existingDropdown.value = selectedValue;
        // Create and dispatch a change event
        const event = new Event('change', { bubbles: true });
        existingDropdown.dispatchEvent(event);
      }
    }
  }

  // Update the chart when selection changes
  function updateExercisesChart() {
    const chartContainer = document.querySelector('.exercise-chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="loading-spinner-container">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading data...</div>
        </div>
      `;
    }
    
    if (enhancedSelectedExercises.length === 0) {
      if (window.showNoDataMessage) {
        window.showNoDataMessage('No exercises selected');
      }
      return;
    }
    
    // Update global selectedExercises
    if (window.selectedExercises) {
      window.selectedExercises = enhancedSelectedExercises;
    }
    
    // Load data and update chart
    const loadPromises = enhancedSelectedExercises.map(exercise => {
      if (window.allExerciseData && window.allExerciseData[exercise]) {
        return Promise.resolve(window.allExerciseData[exercise]);
      } else if (window.weightAnalysis && window.weightAnalysis.loadExerciseData) {
        return window.weightAnalysis.loadExerciseData(exercise, window.currentYear);
      } else {
        return Promise.resolve([]);
      }
    });
    
    if (!window.allExerciseData) window.allExerciseData = {};
    
    Promise.all(loadPromises).then(datasets => {
      enhancedSelectedExercises.forEach((exercise, index) => {
        window.allExerciseData[exercise] = datasets[index];
      });
      
      if (window.renderMultiExerciseChart && window.getFilteredExerciseData) {
        window.renderMultiExerciseChart(window.getFilteredExerciseData());
      } else {
        const existingDropdown = document.getElementById('exercise-select');
        if (existingDropdown && enhancedSelectedExercises.length > 0) {
          existingDropdown.value = enhancedSelectedExercises[0];
          existingDropdown.dispatchEvent(new Event('change'));
        }
      }
      
      // Keep dropdown hidden
      if (window.weightAnalysis && window.weightAnalysis.hideDefaultExerciseDropdown) {
        window.weightAnalysis.hideDefaultExerciseDropdown();
      }
    });
  }

  // Start the process
  createDropdownWithMuscleGroups().catch(error => {
    console.error('Error creating dropdown:', error);
    // Create basic fallback
    if (customDropdown) {
      customDropdown.innerHTML = `
        <div class="dropdown-mobile-header">
          <div class="dropdown-title">Select Exercise</div>
          <button class="dropdown-close" aria-label="Close selection">✕</button>
        </div>
        <div class="no-exercises-message">
          Failed to load exercises. Please try again.
        </div>
      `;
      fixMobileClickIssues(customDropdown, enhancedSelectedExercises);
    }
  });
}

function initializeEnhancedDropdown() {
  if (document.getElementById('exercise-select')) {
    createEnhancedExerciseDropdown();
  } else {
    const observer = new MutationObserver(function(mutations) {
      if (document.getElementById('exercise-select')) {
        createEnhancedExerciseDropdown();
        observer.disconnect();
      }
    });
    const secondChartArea = document.getElementById('secondChartArea');
    if (secondChartArea) {
      observer.observe(secondChartArea.parentNode, { childList: true, subtree: true });
    }
  }
}

// Add CSS for new loading states
function addLoadingStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .title-dropdown-container .visible-title.loading-state {
      opacity: 0.7;
      pointer-events: none;
      cursor: default;
    }
    
    .title-loading-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid rgba(84, 107, 206, 0.3);
      border-top-color: #546bce;
      animation: spin 1s linear infinite;
      margin-left: 8px;
      vertical-align: middle;
    }
    
    .dropdown-loading {
      padding: 20px;
      text-align: center;
    }
    
    /* Fix for mobile touches */
    .exercise-item {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    
    /* Improved touch handling */
    .exercise-item[data-touch-active="true"] {
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    /* Larger touch targets on mobile */
    @media (max-width: 576px) {
      .exercise-item {
        min-height: 48px !important;
        padding: 12px 16px 12px 16px !important;
      }
      
      .dropdown-close {
        min-width: 44px !important;
        min-height: 44px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
  addLoadingStyles();
  initializeEnhancedDropdown();
});

// If the document is already loaded, add styles immediately
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  addLoadingStyles();
  setTimeout(initializeEnhancedDropdown, 100);
}