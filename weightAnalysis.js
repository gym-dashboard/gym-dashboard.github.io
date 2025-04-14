/**
 * weightAnalysis.js - Exercise Progress Tracker with Range Controls and Location Support
 *
 * Enhanced version that tracks exercises by both name and location (equipment type)
 */

(function() {
  console.log('Enhanced exercise tracker with location support loaded');

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

  // Add these window-level functions for tooltips
  window.hideExerciseTooltip = hideExerciseTooltip;
  window.showExerciseTooltipMobile = showExerciseTooltipMobile;

  // Add global function references for tooltips
  window.hideExerciseTooltip = function() {
    const tooltip = d3.select(".exercise-tooltip");
    tooltip
      .style("opacity", 0)
      .style("visibility", "hidden")
      .style("pointer-events", "none")
      .classed("mobile-tooltip", false);
    
    // Hide the overlay
    d3.select("#exercise-tooltip-overlay")
      .style("display", "none")
      .style("pointer-events", "none");
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
   * Format exercise name with location
   * @param {string} exercise - Exercise name
   * @param {string} location - Location name (Bar, Machine, etc.)
   * @returns {string} - Formatted exercise name with location
   */
  function formatExerciseWithLocation(exercise, location) {
    if (!location || location === 'N/A' || location === 'null') {
      return `${exercise} (Bodyweight)`;
    }
    return `${exercise} (${location})`;
  }

  /**
   * Parse a formatted exercise+location string back to its components
   * @param {string} formattedString - The formatted string like "Bench Press (Bar)"
   * @returns {Object} - Object with exercise and location properties
   */
  function parseExerciseAndLocation(formattedString) {
    const match = formattedString.match(/(.+) \((.+)\)$/);
    if (match) {
      return {
        exercise: match[1],
        location: match[2] === 'Bodyweight' ? null : match[2]
      };
    }
    // Fallback for old format or unexpected format
    return {
      exercise: formattedString,
      location: null
    };
  }

  // Helper function to apply the clickable effect if more than one option exists
  function addClickableEffect(dropdownContainer) {
    const options = dropdownContainer.querySelectorAll('option');
    if (options.length > 1) {
      // Add a class to indicate clickable state
      dropdownContainer.classList.add('clickable');
      // Attach click events to each option
      options.forEach(option => {
        option.style.cursor = 'pointer';
        option.addEventListener('click', handleVariantClick);
      });
    } else {
      dropdownContainer.classList.remove('clickable');
    }
  }

  // Click handler for exercise variant options
  function handleVariantClick(event) {
    const selectedVariant = event.currentTarget.textContent;
    console.log("Variant clicked:", selectedVariant);
    // Place your logic here to update the view or re-render the chart
  }

  // Helper function to collapse any expanded custom dropdown menus
  function collapseAllExpandedMenus() {
    document.querySelectorAll('.custom-dropdown-menu.expanded').forEach(menu => {
      menu.classList.remove('expanded');
      menu.style.display = 'none';
    });
  }



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
      // Now using combined exercise/location approach
      const exercises = await getAllExercises(currentYear);

      if (exercises.length === 0) {
        showNoDataMessage('No exercise data found for this year');
        return;
      }

      // Set default selection – if no user selection exists, choose Bench Press (Bar) if available or the first exercise.
      if (selectedExercises.length === 0) {
        const benchPressBar = exercises.find(ex => ex.includes("Bench Press (Bar)"));
        if (benchPressBar) {
          selectedExercises = [benchPressBar];
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

    addClickableEffect(dropdownContainer);
    
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
   * Enhanced to include location in the exercise names
   */
  async function getAllExercises(year) {
    const exercisesWithLocation = new Set();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const today = new Date();
    const endDate = end > today ? today : end;
    
    // Track workout counts for each exercise+location combination
    const workoutCounts = {};
    
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
        // Track exercises found on this day to count each only once per day
        const exercisesForThisDay = new Set();
        
        json.workout.forEach(set => {
          if (set.Exercise) {
            const formattedName = formatExerciseWithLocation(set.Exercise, set.Location);
            exercisesWithLocation.add(formattedName);
            exercisesForThisDay.add(formattedName);
          }
        });
        
        // Count each unique exercise-location only once per day
        exercisesForThisDay.forEach(ex => {
          workoutCounts[ex] = (workoutCounts[ex] || 0) + 1;
        });
      }
    });
    
    // Filter to only include exercises with 3+ workouts
    const filteredExercises = Array.from(exercisesWithLocation).filter(
      exercise => workoutCounts[exercise] >= 3
    );
    
    return filteredExercises.sort();
  }

  /**
   * Load exercise data for a given exercise and year.
   * Enhanced to handle combined exercise+location format
   */
  async function loadExerciseData(formattedExercise, year) {
    const { exercise, location } = parseExerciseAndLocation(formattedExercise);
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
        // Filter sets by both exercise name AND location
        const exerciseSets = json.workout.filter(set => 
          set.Exercise === exercise && 
          (
            (location === null && (!set.Location || set.Location === 'null' || set.Location === 'N/A')) || 
            (location !== null && set.Location === location)
          )
        );
        
        if (exerciseSets.length > 0) {
          const parsedSets = exerciseSets.map(set => ({
            weight: parseWeight(set.Weight),
            reps: parseInt(set.Reps) || 0,
            effort: set.Effort || 'N/A',
            location: set.Location || 'Bodyweight',
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
   * Function to determine the muscle group for an exercise based on its data
   */
  function getExerciseMuscleGroup(exerciseName) {
    if (!exerciseName) return null;
    
    // Parse the exercise name to get the actual exercise without location
    const { exercise } = parseExerciseAndLocation(exerciseName);
    
    // Check if we have already cached the muscle group
    if (window.exerciseMuscleGroups && window.exerciseMuscleGroups[exercise]) {
      return window.exerciseMuscleGroups[exercise];
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
        
        // Cache for future use - use base exercise name without location
        window.exerciseMuscleGroups[exercise] = dominantMuscleGroup;
        return dominantMuscleGroup;
      }
    }
    
    // Default to "Chest" if can't determine
    return "Chest";
  }

  /**
   * Define muscle-specific colors - updated to be consistent with calendar colors
   * but darkened for better visibility in line charts
   */
  const muscleColors = {
    // Darkened versions of the calendar colors for better visibility in charts
    "Chest": "#546bce",     // Darker blue (from #c8ceee)
    "Triceps": "#ff8eba",   // Darker red (from #f9c5c7)
    "Legs": "#ffd112",      // Darker amber (fromrgb(192, 183, 247))
    "Shoulders": "#e67e22", // Darker orange (fromrgb(255, 244, 34))
    "Back": "#64832f",      // Darker green (from #cbd3ad)
    "Biceps": "#3498db"     // Darker blue (from #c6e2e7)
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

    const calendarMuscleColors = {
      "Chest": "#c8ceee",
      "Triceps": "#f9c5c7", 
      "Legs": "#f7e5b7",
      "Shoulders": "#ffc697",
      "Back": "#cbd3ad",
      "Biceps": "#c6e2e7",
    };


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
  
    // Initialize tooltip
    let tooltip = d3.select("body").select(".exercise-tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("class", "exercise-tooltip")
        .style("opacity", 0)
        .style("visibility", "hidden");
    }
  
    // Initialize tooltip overlay for mobile
    let tooltipOverlay = d3.select("body").select("#exercise-tooltip-overlay");
    if (tooltipOverlay.empty()) {
      tooltipOverlay = d3.select("body").append("div")
        .attr("id", "exercise-tooltip-overlay")
        .style("display", "none")
        .style("position", "fixed")
        .style("top", "0")
        .style("left", "0")
        .style("right", "0")
        .style("bottom", "0")
        .style("background-color", "rgba(0, 0, 0, 0.5)")
        .style("z-index", "9900")
        .style("touch-action", "manipulation");
      
      // Add hint text
      tooltipOverlay.append("div")
        .attr("class", "tooltip-hint")
        .style("position", "fixed")
        .style("bottom", "20px")
        .style("left", "0")
        .style("right", "0")
        .style("text-align", "center")
        .style("color", "white")
        .style("font-size", "14px")
        .style("padding", "8px")
        .style("width", "150px")
        .style("margin", "0 auto")
        .style("background-color", "rgba(0,0,0,0.5)")
        .style("border-radius", "8px")
        .style("opacity", "0.8")
        .text("Tap outside to close");
    }
  
    // Add click handler to overlay to close tooltip
    tooltipOverlay.on("click", function() {
      hideExerciseTooltip();
    });
  
    // Add touch handlers to overlay
    tooltipOverlay.on("touchstart", function(event) {
      event.stopPropagation();
    });
  
    // Function to show tooltip for mobile
    function showExerciseTooltipMobile(event, dayData, exerciseName, muscleGroup) {
      // Hide any existing tooltips
      hideExerciseTooltip();
      
      // Add CSS classes for mobile tooltip
      tooltip.classed("mobile-tooltip", true);
      
      // Get color for background
      let bgColor = "#363636"; // Default color
      if (muscleGroup && calendarMuscleColors[muscleGroup]) {
        const baseColor = calendarMuscleColors[muscleGroup];
        bgColor = darkenColor(baseColor, 0.2); // Same darkening as calendar script
      } else if (color) {
        // Fallback to the current color if muscle group not found
        bgColor = darkenColor(color, 0.3);
      }
      
      // Format date for display
      const dateStr = dayData.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      // Calculate total volume (weight × reps summed across all sets)
      const totalVolume = dayData.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
      
      // Extract location information from the first set
      const location = dayData.sets[0]?.location || 'Bodyweight';
      
      // Parse the exercise name to get just the base name without location
      const { exercise } = parseExerciseAndLocation(exerciseName);
      
      // Build tooltip content with enhanced structure
      let tooltipContent = `
        <div style="position:relative;">
          <div class="tooltip-close-btn">&times;</div>
          <div class="tooltip-header">
            <div class="tooltip-title">${exercise}</div>
            <div class="tooltip-date">${dateStr}</div>
          </div>
          <div class="tooltip-summary">
            <div class="tooltip-section-title">Summary</div>
            <div class="tooltip-stat-line">
              <span>Average:</span>
              <span class="tooltip-stat-value">${dayData.weightedAvg.toFixed(1)}kg</span>
            </div>
            <div class="tooltip-stat-line">
              <span>Volume:</span>
              <span class="tooltip-stat-value">${totalVolume.toLocaleString()}kg</span>
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
              <span>Location:</span>
              <span>${location}</span>
            </div>
            <div class="tooltip-stat-line">
              <span>Group:</span>
              <span>${muscleGroup || 'Unknown'}</span>
            </div>
          </div>
          <div class="tooltip-divider"></div>
          <div class="tooltip-sets">
            <div class="tooltip-section-title">Set Details</div>
            <div class="tooltip-sets-grid">
              ${dayData.sets.map((set, idx) => `
                <div class="tooltip-set-item">
                  <span class="set-number">Set ${idx + 1}:</span>
                  <span class="set-weight">${set.weight}kg</span>
                  <span class="set-reps">× ${set.reps}</span>
                  ${set.effort !== 'N/A' ? `<span class="set-effort">(${set.effort})</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      
      tooltip.html(tooltipContent);
      
      // Apply styles for mobile
      tooltip
        .style("position", "fixed")
        .style("top", "50%")
        .style("left", "50%")
        .style("transform", "translate(-50%, -50%)")
        .style("width", "auto")
        .style("max-width", "90%")
        .style("background-color", bgColor)
        .style("color", "#ffffff")
        .style("border-radius", "12px")
        .style("padding", "15px")
        .style("box-shadow", "0 4px 20px rgba(0, 0, 0, 0.4)")
        .style("z-index", "9999")
        .style("opacity", 1)
        .style("visibility", "visible")
        .style("pointer-events", "auto");
      
      // Show the overlay
      tooltipOverlay
        .style("display", "block")
        .style("opacity", 1)
        .style("pointer-events", "auto");
      
      // Add click handler for close button
      setTimeout(() => {
        const closeBtn = document.querySelector('.exercise-tooltip .tooltip-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            hideExerciseTooltip();
          });
        }
      }, 10);
    }
  
    // Function to hide exercise tooltip
    function hideExerciseTooltip() {
      tooltip
        .style("opacity", 0)
        .style("visibility", "hidden")
        .style("pointer-events", "none")
        .classed("mobile-tooltip", false);
      
      // Hide the overlay
      tooltipOverlay
        .style("display", "none")
        .style("pointer-events", "none");
    }
  
    // Function to darken color for tooltip background
    function darkenColor(hexColor, factor) {
      // For rgba colors
      if (hexColor.startsWith('rgba')) {
        const matches = hexColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/);
        if (matches) {
          let r = parseInt(matches[1]);
          let g = parseInt(matches[2]);
          let b = parseInt(matches[3]);
          let a = parseFloat(matches[4]);
          
          r = Math.floor(r * (1 - factor));
          g = Math.floor(g * (1 - factor));
          b = Math.floor(b * (1 - factor));
          
          return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
      }
      
      // For hex colors
      if (hexColor.startsWith('#')) {
        let r = parseInt(hexColor.slice(1, 3), 16);
        let g = parseInt(hexColor.slice(3, 5), 16);
        let b = parseInt(hexColor.slice(5, 7), 16);
        
        r = Math.floor(r * (1 - factor));
        g = Math.floor(g * (1 - factor));
        b = Math.floor(b * (1 - factor));
        
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        
        return `rgba(${r}, ${g}, ${b}, 0.95)`;
      }
      
      return hexColor; // Return unchanged if not rgba or hex
    }
  
    // Add window function references for external access
    window.hideExerciseTooltip = hideExerciseTooltip;
  
    // Check if we're on a tablet
    const isTablet = window.innerWidth >= 768;
    
    // Determine if this is a mobile device with touch (but not tablet)
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches && !isTablet;
  
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
        // Create the data point
        const point = g.append("circle")
          .attr("class", "avg-point")
          .attr("cx", x(dayData.date))
          .attr("cy", y(dayData.weightedAvg))
          .attr("r", avgPointRadius)
          .style("fill", color) // Use muscle-specific color
          .attr("stroke", "white")
          .attr("stroke-width", 1.5);
        
        // Different event handling for mobile vs desktop
        if (isTouchDevice) {
          // Mobile/touch behavior
          g.append("circle")
          .attr("class", "touch-target")
          .attr("cx", x(dayData.date))
          .attr("cy", y(dayData.weightedAvg))
          .attr("r", 15) // Much larger radius for touch (3-4x visual size)
          .attr("fill", "transparent")
          .attr("stroke", "transparent")
          .attr("pointer-events", "all") // Make it capture events
          .style("cursor", "pointer")
          .on("click", function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            // Highlight the visible point
            point
              .attr("r", avgPointRadius + 1.5)
              .attr("stroke-width", 1.8);
            
            // Show mobile-style tooltip
            showExerciseTooltipMobile(event, dayData, exerciseName, muscleGroup);
            
            // Return point to normal size after a delay
            setTimeout(() => {
              point
                .attr("r", avgPointRadius)
                .attr("stroke-width", 1.5);
            }, 300);
          });

          point
            .style("cursor", "pointer")
            .on("click", function(event) {
              event.preventDefault();
              event.stopPropagation();
              // Highlight the point
              d3.select(this)
                .attr("r", avgPointRadius + 1.5)
                .attr("stroke-width", 1.8);
              
              // Show mobile-style tooltip
              showExerciseTooltipMobile(event, dayData, exerciseName, muscleGroup);
              
              // Return point to normal size after a delay
              setTimeout(() => {
                d3.select(this)
                  .attr("r", avgPointRadius)
                  .attr("stroke-width", 1.5);
              }, 300);
            })
            .on("touchstart", function(event) {
              d3.select(this)
                .attr("r", avgPointRadius + 1.5)
                .attr("stroke-width", 1.8);
            })
            .on("touchend", function(event) {
              // Return to normal size but leave tooltip management to click handler
              setTimeout(() => {
                d3.select(this)
                  .attr("r", avgPointRadius)
                  .attr("stroke-width", 1.5);
              }, 300);
            });
        } else {
          // Desktop behavior with mouseover
          point
            .on("mouseover", function(event) {
              d3.select(this)
                .attr("r", avgPointRadius + 1.5)
                .attr("stroke-width", 1.8);
              
              // Format date for tooltip
              const dateStr = dayData.date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });

              // Calculate total volume
              const totalVolume = dayData.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);

              // Get color for background based on muscle group
              let bgColor = "#363636"; // Default color
              if (muscleGroup && calendarMuscleColors[muscleGroup]) {
                const baseColor = calendarMuscleColors[muscleGroup];
                bgColor = darkenColor(baseColor, 0.2); // Same darkening as used for mobile
              }
              
              // Get exercise base name without location
              const { exercise } = parseExerciseAndLocation(exerciseName);
              // Extract location information from the first set
              const location = dayData.sets[0]?.location || 'Bodyweight';
              
              // Build tooltip content with enhanced structure
              let tooltipContent = `
                <div class="tooltip-header">
                  <div class="tooltip-title">${exercise}</div>
                  <div class="tooltip-date">${dateStr}</div>
                </div>
                <div class="tooltip-summary">
                  <div class="tooltip-section-title">Summary</div>
                  <div class="tooltip-stat-line">
                    <span>Average:</span>
                    <span class="tooltip-stat-value">${dayData.weightedAvg.toFixed(1)}kg</span>
                  </div>
                  <div class="tooltip-stat-line">
                    <span>Volume:</span>
                    <span class="tooltip-stat-value">${totalVolume.toLocaleString()}kg</span>
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
                    <span>Location:</span>
                    <span>${location}</span>
                  </div>
                </div>
                <div class="tooltip-divider"></div>
                <div class="tooltip-sets">
                  <div class="tooltip-section-title">Set Details</div>
                  <div class="tooltip-sets-grid">
                    ${dayData.sets.map((set, idx) => `
                      <div class="tooltip-set-item">
                        <span class="set-number">Set ${idx + 1}:</span>
                        <span class="set-weight">${set.weight}kg</span>
                        <span class="set-reps">× ${set.reps}</span>
                        ${set.effort !== 'N/A' ? `<span class="set-effort">(${set.effort})</span>` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
              
              // Position and display tooltip
              tooltip
                .html(tooltipContent)
                .style("visibility", "visible")
                .style("opacity", 1)
                .style("pointer-events", "none")
                .style("background-color", bgColor);
            })
            .on("mousemove", function(event) {
              // Position tooltip near cursor
              const tooltipWidth = 220;
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
        }
      });
    });
  
    // Add document click handler to close tooltips when clicking outside
    document.addEventListener('click', function(e) {
      const tooltip = document.querySelector('.exercise-tooltip');
      const overlay = document.getElementById('exercise-tooltip-overlay');
      
      // If clicking outside the tooltip and it's visible
      if (tooltip && 
          tooltip.style.visibility === 'visible' &&
          !tooltip.contains(e.target) && 
          !e.target.closest('.avg-point')) {
        hideExerciseTooltip();
      }
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
        
        // Format the legend label - show only exercise name without location if too long
        const { exercise } = parseExerciseAndLocation(name);
        const displayName = name.length > 15 ? exercise : name;
        
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
    hideDefaultExerciseDropdown: hideDefaultExerciseDropdown,
    formatExerciseWithLocation: formatExerciseWithLocation,
    parseExerciseAndLocation: parseExerciseAndLocation
  };

  // Also expose rendering functions globally
  window.renderMultiExerciseChart = renderMultiExerciseChart;
  window.getFilteredExerciseData = getFilteredExerciseData;

  /**
   * Check that DOM is ready before initializing
   */
  // Add document click handler to close tooltips when clicking outside
  document.addEventListener('click', function(e) {
    const tooltip = document.querySelector('.exercise-tooltip');
    const overlay = document.getElementById('exercise-tooltip-overlay');
    
    // If clicking outside the tooltip and it's visible
    if (tooltip && 
        tooltip.style.visibility === 'visible' &&
        !tooltip.contains(e.target) && 
        !e.target.closest('.avg-point')) {
      window.hideExerciseTooltip();
    }
  });


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

// Function to show exercise tooltip for mobile devices
function showExerciseTooltipMobile(event, dayData) {
  // Hide any existing tooltips
  hideExerciseTooltip();
  
  const tooltipDiv = d3.select(".exercise-tooltip");
  
  // Add CSS classes for mobile tooltip
  tooltipDiv.classed("mobile-tooltip", true);
  
  // Get the muscle group color for background
  let bgColor = "#546bce"; // Default color
  
  // Format date for display
  const dateStr = dayData.date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  
  // Calculate total volume (weight × reps summed across all sets)
  const totalVolume = dayData.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
  
  // Extract location from set data
  const location = dayData.sets[0]?.location || 'Bodyweight';
  
  // Build enhanced tooltip content
  let tooltipContent = `
    <div style="position:relative;">
      <div class="tooltip-close-btn">&times;</div>
      <div class="tooltip-header">
        <div class="tooltip-title">${dayData.exerciseName || 'Workout'}</div>
        <div class="tooltip-date">${dateStr}</div>
      </div>
      <div class="tooltip-summary">
        <div class="tooltip-section-title">Summary</div>
        <div class="tooltip-stat-line">
          <span>Average:</span>
          <span class="tooltip-stat-value">${dayData.weightedAvg.toFixed(1)}kg</span>
        </div>
        <div class="tooltip-stat-line">
          <span>Volume:</span>
          <span class="tooltip-stat-value">${totalVolume.toLocaleString()}kg</span>
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
          <span>Location:</span>
          <span>${location}</span>
        </div>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-sets">
        <div class="tooltip-section-title">Set Details</div>
        <div class="tooltip-sets-grid">
          ${dayData.sets.map((set, idx) => `
            <div class="tooltip-set-item">
              <span class="set-number">Set ${idx + 1}:</span>
              <span class="set-weight">${set.weight}kg</span>
              <span class="set-reps">× ${set.reps}</span>
              ${set.effort !== 'N/A' ? `<span class="set-effort">(${set.effort})</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  tooltipDiv.html(tooltipContent);
  
  // Apply styles for mobile
  tooltipDiv
    .style("position", "fixed")
    .style("top", "50%")
    .style("left", "50%")
    .style("transform", "translate(-50%, -50%)")
    .style("width", "auto")
    .style("max-width", "90%")
    .style("background-color", bgColor)
    .style("color", "#ffffff")
    .style("border-radius", "12px")
    .style("padding", "15px")
    .style("box-shadow", "0 4px 20px rgba(0, 0, 0, 0.4)")
    .style("z-index", "9999")
    .style("opacity", 1)
    .style("visibility", "visible")
    .style("pointer-events", "auto");
  
  // Show the overlay
  d3.select("#exercise-tooltip-overlay")
    .style("display", "block")
    .style("opacity", 1)
    .style("pointer-events", "auto");
  
  // Add click handler for close button
  setTimeout(() => {
    const closeBtn = document.querySelector('.exercise-tooltip .tooltip-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        hideExerciseTooltip();
      });
    }
  }, 10);
}

// Function to hide exercise tooltip
function hideExerciseTooltip() {
  const tooltip = d3.select(".exercise-tooltip");
  tooltip
    .style("opacity", 0)
    .style("visibility", "hidden")
    .style("pointer-events", "none")
    .classed("mobile-tooltip", false);
  
  // Hide the overlay
  d3.select("#exercise-tooltip-overlay")
    .style("display", "none")
    .style("pointer-events", "none");
}

function createNestedExerciseDropdown() {
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
    "Legs": "#ffdb53", 
    "Biceps": "#2196f3", // Light blue
    "Triceps": "#f44336" // Red
  };
  
  // Define background colors (lighter versions)
  const muscleBackgroundColors = {
    "Chest": "#e8eaf6",     // Light blue
    "Triceps": "#ffeef5",   // Light pink
    "Legs": "#fbebb4",      // Light yellow
    "Shoulders": "#f6d8bb", // Light orange
    "Back": "#f1f3e8",      // Light green
    "Biceps": "#e1f5fe"     // Light blue
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

  // Create backdrop for mobile if not exists
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

  let enhancedSelectedExercises = window.selectedExercises || [];
  const exerciseOptions = Array.from(existingDropdown.options).map(option => ({
    value: option.value,
    text: option.text,
    muscleGroup: null
  }));

  const visibleTitleText = dropdownContainer.querySelector('.title-text');
  const customDropdown = dropdownContainer.querySelector('.custom-dropdown-menu');
  const hiddenSelect = dropdownContainer.querySelector('.hidden-select');

  // Define toggle function early so UI can be responsive
  window.toggleDropdown = (show) => {
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

  async function createNestedDropdownWithMuscleGroups() {
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

      // Only include exercises with 3+ workouts
      const eligibleExercises = exerciseOptions.filter(exercise => 
        workoutCounts[exercise.text] && workoutCounts[exercise.text] >= 3
      );

      // Group exercises by base name (without location)
      const exerciseGroups = {};
      eligibleExercises.forEach(exercise => {
        const { exercise: baseName, location } = window.weightAnalysis.parseExerciseAndLocation(exercise.text);
        
        // Get muscle group for the base exercise
        const muscleGroup = exerciseToMuscleGroup[baseName] || null;
        exercise.muscleGroup = muscleGroup;
        
        // Initialize the group if it doesn't exist
        if (!exerciseGroups[baseName]) {
          exerciseGroups[baseName] = {
            baseName: baseName,
            muscleGroup: muscleGroup,
            variants: []
          };
        }
        
        // Add this variant to the group
        exerciseGroups[baseName].variants.push({
          fullName: exercise.text,
          location: location || 'Bodyweight',
          value: exercise.value,
          muscleGroup: muscleGroup
        });
      });

      // Calculate width based on longest exercise name
      let maxLabelWidth = 0;
      Object.keys(exerciseGroups).forEach(baseName => {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.font = '0.9rem sans-serif';
        tempSpan.textContent = baseName;
        document.body.appendChild(tempSpan);
        const width = tempSpan.offsetWidth;
        if (width > maxLabelWidth) maxLabelWidth = width;
        document.body.removeChild(tempSpan);
      });
      
      // Add margin for left border, padding, and expand arrow
      const calculatedWidth = Math.min(Math.max(maxLabelWidth + 70, 240), 320);
      customDropdown.style.width = `${calculatedWidth}px`;

      // Organize exercise groups by muscle group
      Object.values(exerciseGroups).forEach(group => {
        if (group.muscleGroup && muscleGroupsData[group.muscleGroup]) {
          muscleGroupsData[group.muscleGroup].exercises.push(group);
        } else {
          // Default to chest if no muscle group is found
          muscleGroupsData[muscleGroups[0]].exercises.push(group);
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
      if (!hasValidSelection && eligibleExercises.length > 0) {
        // Look for Bench Press (Bar) first
        const defaultExercise = eligibleExercises.find(ex => ex.text.includes("Bench Press (Bar)")) || eligibleExercises[0];
        enhancedSelectedExercises = [defaultExercise.value];
      }

      // Find the currently selected exercise to expand its group
      const selectedExerciseFullName = hasValidSelection && enhancedSelectedExercises.length > 0 ? 
        eligibleExercises.find(ex => ex.value === enhancedSelectedExercises[0])?.text : null;
      
      let selectedBaseName = null;
      if (selectedExerciseFullName) {
        const { exercise: baseName } = window.weightAnalysis.parseExerciseAndLocation(selectedExerciseFullName);
        selectedBaseName = baseName;
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
          
          // Sort exercises alphabetically within group
          group.exercises.sort((a, b) => a.baseName.localeCompare(b.baseName));
          
          group.exercises.forEach(exerciseGroup => {
            // Check if this exercise has multiple variants
            const hasMultipleVariants = exerciseGroup.variants.length > 1;
            
            // Create parent item (base exercise name)
            const parentItem = document.createElement('div');
            parentItem.className = 'exercise-parent-item';
            parentItem.dataset.baseName = exerciseGroup.baseName;
            parentItem.dataset.muscleGroup = exerciseGroup.muscleGroup || '';
            
            // Only add expandable class and expanded state if multiple variants
            if (hasMultipleVariants) {
              // Add expandable class for styling
              parentItem.classList.add('expandable');
              
              // Check if this group should be expanded (if it contains the selected exercise)
              const isExpanded = exerciseGroup.baseName === selectedBaseName;
              parentItem.classList.toggle('expanded', isExpanded);
            } else {
              // Add non-expandable class for styling
              parentItem.classList.add('non-expandable');
              
              // For single variants, store the variant value directly on the parent
              if (exerciseGroup.variants.length === 1) {
                parentItem.dataset.variantValue = exerciseGroup.variants[0].value;
              }
            }
            
            // Create label with base exercise name and indicator
            const parentLabel = document.createElement('div');
            parentLabel.className = 'parent-exercise-label';
            
            // Create main exercise name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'base-exercise-name';
            nameSpan.textContent = exerciseGroup.baseName;
            parentLabel.appendChild(nameSpan);
            
            // Only add variant count and expand icons for multi-variant exercises
            if (hasMultipleVariants) {
              // Create variant count badge
              const variantCount = document.createElement('span');
              variantCount.className = 'variant-count';
              variantCount.textContent = `(${exerciseGroup.variants.length})`;
              parentLabel.appendChild(variantCount);
              
              // Create expand/collapse indicator
              const expandIcon = document.createElement('span');
              expandIcon.className = 'expand-icon';
              expandIcon.innerHTML = parentItem.classList.contains('expanded') ? '&#9650;' : '&#9660;'; // Up/down triangle
              parentLabel.appendChild(expandIcon);
            } else if (exerciseGroup.variants.length === 1) {
              // For single variants, show the location in the parent
              const locationBadge = document.createElement('span');
              locationBadge.className = 'location-badge';
              locationBadge.textContent = `(${exerciseGroup.variants[0].location})`;
              locationBadge.style.color = '#666';
              locationBadge.style.fontSize = '0.85em';
              locationBadge.style.marginLeft = '6px';
              parentLabel.appendChild(locationBadge);
            }
            
            parentItem.appendChild(parentLabel);
            
            // Set up hover effects
            setupHoverEffects(parentItem, exerciseGroup.muscleGroup);
            
            // Check if currently selected
            const isSingleAndSelected = exerciseGroup.variants.length === 1 && 
                enhancedSelectedExercises.includes(exerciseGroup.variants[0].value);
            
            if (isSingleAndSelected) {
              // Apply selection styling to parent for single variants
              parentItem.classList.add('selected-parent');
              parentItem.style.backgroundColor = getSelectionColor(exerciseGroup.muscleGroup);
              parentItem.style.borderLeftColor = getBorderColor(exerciseGroup.muscleGroup);
            }
            
            // Setup different behavior based on variant count
            if (hasMultipleVariants) {
              // For multiple variants: Setup expand/collapse behavior
              parentItem.addEventListener('click', function(e) {
                e.stopPropagation();
                const isCurrentlyExpanded = this.classList.contains('expanded');
                
                // Toggle expanded state
                this.classList.toggle('expanded', !isCurrentlyExpanded);
                
                // Update the icon
                const icon = this.querySelector('.expand-icon');
                if (icon) {
                  icon.innerHTML = !isCurrentlyExpanded ? '&#9650;' : '&#9660;';
                }
                
                // Show/hide the variants container
                const variantsContainer = this.nextElementSibling;
                if (variantsContainer && variantsContainer.classList.contains('exercise-variants')) {
                  variantsContainer.style.display = !isCurrentlyExpanded ? 'block' : 'none';
                }
              });
            } else {
              // For single variant: Direct selection behavior
              parentItem.addEventListener('click', function(e) {
                e.stopPropagation();
                
                if (exerciseGroup.variants.length === 0) return; // Skip if no variants
                
                // Get the single variant
                const singleVariant = exerciseGroup.variants[0];
                const exerciseValue = singleVariant.value;
                const muscleGroup = singleVariant.muscleGroup;
                
                // Clear selection from all items (both variant items and parent items)
                const allVariantItems = customDropdown.querySelectorAll('.exercise-variant-item');
                allVariantItems.forEach(el => {
                  el.classList.remove('selected');
                  el.setAttribute('aria-selected', 'false');
                  el.style.backgroundColor = '';
                  el.style.borderLeftColor = '';
                });
                
                const allParentItems = customDropdown.querySelectorAll('.exercise-parent-item');
                allParentItems.forEach(el => {
                  el.classList.remove('selected-parent');
                  if (!el.classList.contains('expandable')) {
                    el.style.backgroundColor = '';
                    el.style.borderLeftColor = '';
                  }
                });
                
                // Mark this parent as selected
                this.classList.add('selected-parent');
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
            }
            
            exerciseList.appendChild(parentItem);
            
            // Create container for variants (only needed for multi-variant)
            if (hasMultipleVariants) {
              const variantsContainer = document.createElement('div');
              variantsContainer.className = 'exercise-variants';
              variantsContainer.style.display = parentItem.classList.contains('expanded') ? 'block' : 'none';
              
              // Sort variants by location name
              exerciseGroup.variants.sort((a, b) => a.location.localeCompare(b.location));
              
              // Add each variant as a child item
              exerciseGroup.variants.forEach(variant => {
                const variantItem = document.createElement('div');
                variantItem.className = 'exercise-variant-item';
                variantItem.setAttribute('role', 'option');
                variantItem.dataset.value = variant.value;
                variantItem.dataset.muscleGroup = variant.muscleGroup || '';
                
                // Create variant label
                const variantLabel = document.createElement('span');
                variantLabel.className = 'variant-label';
                
                // Show only the location part
                variantLabel.textContent = variant.location;
                
                variantItem.appendChild(variantLabel);
                
                // Set up hover effects
                setupHoverEffects(variantItem, variant.muscleGroup);
                
                // Mark as selected if in current selection
                if (enhancedSelectedExercises.includes(variant.value)) {
                  variantItem.classList.add('selected');
                  variantItem.setAttribute('aria-selected', 'true');
                  variantItem.style.backgroundColor = getSelectionColor(variant.muscleGroup);
                  variantItem.style.borderLeftColor = getBorderColor(variant.muscleGroup);
                } else {
                  variantItem.setAttribute('aria-selected', 'false');
                }
                
                // Handle selection
                variantItem.addEventListener('click', function(e) {
                  e.stopPropagation(); // Prevent event bubbling to parent
                  
                  // The exercise value we need to select
                  const exerciseValue = this.dataset.value;
                  const muscleGroup = this.dataset.muscleGroup;
                  
                  // Clear selection from all items
                  const allVariantItems = customDropdown.querySelectorAll('.exercise-variant-item');
                  allVariantItems.forEach(el => {
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
                
                variantsContainer.appendChild(variantItem);
              });
              
              exerciseList.appendChild(variantsContainer);
            }
          });
          
          section.appendChild(exerciseList);
          groupList.appendChild(section);
        }
      });

      customDropdown.appendChild(groupList);

      // Show message if no exercises found
      if (Object.keys(exerciseGroups).length === 0) {
        const noExercisesMsg = document.createElement('div');
        noExercisesMsg.className = 'no-exercises-message';
        noExercisesMsg.textContent = 'No exercises with 3+ workouts found.';
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
      console.error('Error creating nested dropdown:', error);

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
          
          // Group by exercise and location together
          const exercisesForDay = new Set();
          json.workout.forEach(set => {
            if (set.Exercise) {
              // Use the combined exercise+location format
              const formattedExercise = window.weightAnalysis?.formatExerciseWithLocation 
                ? window.weightAnalysis.formatExerciseWithLocation(set.Exercise, set.Location)
                : set.Exercise;
              exercisesForDay.add(formattedExercise);
            }
          });
          
          // Count each exercise-location once per day
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
              // Use the base exercise name without location for muscle group mapping
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
    // Add touch handling for parent items
    const parentItems = dropdownElement.querySelectorAll('.exercise-parent-item');
    parentItems.forEach(item => {
      // Remove existing listeners by cloning
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);
      
      // Set up hover effects again
      setupHoverEffects(newItem, newItem.dataset.muscleGroup);
      
      // Check if this is an expandable item
      const isExpandable = newItem.classList.contains('expandable');
      
      // Add different click handlers based on expandable status
      if (isExpandable) {
        // For expandable items: expand/collapse functionality
        newItem.addEventListener('click', function(e) {
          e.stopPropagation();
          const isCurrentlyExpanded = this.classList.contains('expanded');
          
          // Toggle expanded state
          this.classList.toggle('expanded', !isCurrentlyExpanded);
          
          // Update the icon
          const icon = this.querySelector('.expand-icon');
          if (icon) {
            icon.innerHTML = !isCurrentlyExpanded ? '&#9650;' : '&#9660;';
          }
          
          // Show/hide the variants container
          const variantsContainer = this.nextElementSibling;
          if (variantsContainer && variantsContainer.classList.contains('exercise-variants')) {
            variantsContainer.style.display = !isCurrentlyExpanded ? 'block' : 'none';
          }
        });
      } else {
        // For non-expandable items: direct selection
        newItem.addEventListener('click', function(e) {
          e.stopPropagation();
          
          // Get the variant value from the dataset
          const exerciseValue = this.dataset.variantValue;
          if (!exerciseValue) return; // Skip if no variant value
          
          const muscleGroup = this.dataset.muscleGroup;
          
          // Clear selection from all variant items
          const allVariantItems = dropdownElement.querySelectorAll('.exercise-variant-item');
          allVariantItems.forEach(el => {
            el.classList.remove('selected');
            el.setAttribute('aria-selected', 'false');
            el.style.backgroundColor = '';
            el.style.borderLeftColor = '';
          });
          
          // Clear selection from all non-expandable parent items
          const allParentItems = dropdownElement.querySelectorAll('.exercise-parent-item.non-expandable');
          allParentItems.forEach(el => {
            el.classList.remove('selected-parent');
            el.style.backgroundColor = '';
            el.style.borderLeftColor = '';
          });
          
          // Mark this parent as selected
          this.classList.add('selected-parent');
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
      }
      
      // Improved touch handling for all parent items
      newItem.addEventListener('touchstart', function() {
        this.dataset.touchActive = 'true';
        
        // Visual feedback for touch
        if (!isExpandable) {
          this.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }
      }, { passive: true });
      
      newItem.addEventListener('touchmove', function() {
        this.dataset.touchActive = 'false';
        
        // Remove touch feedback if user is scrolling
        if (!isExpandable && !this.classList.contains('selected-parent')) {
          this.style.backgroundColor = '';
        }
      }, { passive: true });
      
      newItem.addEventListener('touchend', function(e) {
        if (this.dataset.touchActive === 'true') {
          e.preventDefault();
          e.stopPropagation();
          this.dataset.touchActive = 'false';
          
          // Remove touch feedback unless selected
          if (!isExpandable && !this.classList.contains('selected-parent')) {
            this.style.backgroundColor = '';
          }
          
          // Trigger the click event
          this.click();
        }
      }, { passive: false });
    });
    
    // Add touch handling for variant items
    const variantItems = dropdownElement.querySelectorAll('.exercise-variant-item');
    variantItems.forEach(item => {
      // Remove existing listeners by cloning
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);
      
      // Set up hover effects again
      setupHoverEffects(newItem, newItem.dataset.muscleGroup);
      
      // Add click handler for variant selection
      newItem.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // The exercise value we need to select
        const exerciseValue = this.dataset.value;
        const muscleGroup = this.dataset.muscleGroup;
        
        // Clear selection from all variant items
        const allVariantItems = dropdownElement.querySelectorAll('.exercise-variant-item');
        allVariantItems.forEach(el => {
          el.classList.remove('selected');
          el.setAttribute('aria-selected', 'false');
          el.style.backgroundColor = '';
          el.style.borderLeftColor = '';
        });
        
        // Clear selection from all non-expandable parent items
        const allParentItems = dropdownElement.querySelectorAll('.exercise-parent-item.non-expandable');
        allParentItems.forEach(el => {
          el.classList.remove('selected-parent');
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
      
      // Improved touch handling for variants
      newItem.addEventListener('touchstart', function() {
        this.dataset.touchActive = 'true';
        // Visual feedback for touch
        if (!this.classList.contains('selected')) {
          this.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }
      }, { passive: true });
      
      newItem.addEventListener('touchmove', function() {
        this.dataset.touchActive = 'false';
        // Remove visual feedback if scrolling
        if (!this.classList.contains('selected')) {
          this.style.backgroundColor = '';
        }
      }, { passive: true });
      
      newItem.addEventListener('touchend', function(e) {
        if (this.dataset.touchActive === 'true') {
          e.preventDefault();
          e.stopPropagation();
          this.dataset.touchActive = 'false';
          
          // Remove touch feedback unless selected
          if (!this.classList.contains('selected')) {
            this.style.backgroundColor = '';
          }
          
          // Trigger the click event
          this.click();
        }
      }, { passive: false });
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
        this.style.opacity = '0.7';
      }, { passive: true });
      
      newCloseBtn.addEventListener('touchmove', function() {
        this.dataset.touchActive = 'false';
        this.style.opacity = '1';
      }, { passive: true });
      
      newCloseBtn.addEventListener('touchend', function(e) {
        if (this.dataset.touchActive === 'true') {
          e.preventDefault();
          e.stopPropagation();
          this.dataset.touchActive = 'false';
          this.style.opacity = '1';
          toggleDropdown(false);
        }
      }, { passive: false });
    }
    
    // Improved backdrop interaction
    backdrop.addEventListener('click', function(e) {
      e.preventDefault();
      toggleDropdown(false);
    });
    
    backdrop.addEventListener('touchstart', function() {
      this.dataset.touchActive = 'true';
    }, { passive: true });
    
    backdrop.addEventListener('touchmove', function() {
      this.dataset.touchActive = 'false'; 
    }, { passive: true });
    
    backdrop.addEventListener('touchend', function(e) {
      if (this.dataset.touchActive === 'true') {
        e.preventDefault();
        e.stopPropagation();
        this.dataset.touchActive = 'false';
        toggleDropdown(false);
      }
    }, { passive: false });
    
    // Setup document click to close dropdown when clicking outside
    document.addEventListener('click', function(e) {
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
        
        // Toggle the dropdown
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
          
          // Toggle dropdown
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
        
        // Get all focusable items (parent items and visible variant items)
        const parentItems = Array.from(dropdownElement.querySelectorAll('.exercise-parent-item'));
        const visibleVariantItems = Array.from(dropdownElement.querySelectorAll('.exercise-variants[style*="display: block"] .exercise-variant-item'));
        const allItems = [...parentItems, ...visibleVariantItems];
        
        const currentIndex = allItems.findIndex(item => item === document.activeElement);
        let newIndex;
        
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < allItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : allItems.length - 1;
        }
        
        allItems[newIndex].focus();
      }
      
      if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        if (activeElement.classList.contains('exercise-parent-item')) {
          // Either expand/collapse or select based on if expandable
          activeElement.click();
        } else if (activeElement.classList.contains('exercise-variant-item')) {
          // Select variant
          activeElement.click();
        }
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
      
      if (exercise) {
        const { exercise: baseName } = window.weightAnalysis.parseExerciseAndLocation(exercise.text);
        // Show only the base name without location
        titleElement.textContent = baseName;
      } else {
        titleElement.textContent = 'Select Exercise';
      }
      
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

  // Add CSS for nested dropdown styling
  function addNestedDropdownStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Base dropdown styling */
      .title-dropdown-container .visible-title {
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 6px 10px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      
      .title-dropdown-container .visible-title:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      .title-dropdown-container .visible-title .title-text {
        flex: 1;
        margin-right: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .title-dropdown-container .visible-title .dropdown-arrow {
        font-size: 0.8em;
        opacity: 0.7;
      }
      
      /* Muscle group sections */
      .muscle-group-section {
        margin-bottom: 8px;
      }
      
      .muscle-group-header {
        padding: 8px 12px;
        font-weight: 600;
        font-size: 0.9rem;
        border-radius: 0px;
      }
      
      .muscle-group-divider {
        height: 1px;
        background-color: #eee;
        margin: 8px 0;
      }
      
      /* Parent exercise items - base styles */
      .exercise-parent-item {
        position: relative;
        padding: 10px 12px;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: background-color 0.2s, border-left-color 0.2s;
        display: flex;
        align-items: center;
        user-select: none;
      }
      
      .parent-exercise-label {
        display: flex;
        align-items: center;
        width: 100%;
      }
      
      .base-exercise-name {
        flex: 1;
        font-weight: 500;
      }
      
      /* Variant count badge (for expandable items) */
      .variant-count {
        margin-left: 6px;
        font-size: 0.85em;
        color: #666;
        opacity: 0.8;
      }
      
      /* Location badge (for non-expandable items) */
      .location-badge {
        margin-left: 6px;
        font-size: 0.85em;
        color: #666;
        opacity: 0.8;
      }
  
      /* Different styles for expandable vs non-expandable items */
      .exercise-parent-item.expandable {
        /* Specific styles for expandable items */
        cursor: pointer;
      }
      
      .exercise-parent-item.non-expandable {
        /* Specific styles for non-expandable items */
        padding-left: 15px;  /* Adjust padding since there's no arrow */
        border-radius: 0;
        transition: all 0.15s ease-in-out;
      }
      
      .exercise-parent-item.non-expandable:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      /* Visual styling for selected non-expandable parent */
      .exercise-parent-item.selected-parent {
        font-weight: 500;
      }
      
      /* Visual feedback for direct selection */
      @keyframes select-pulse {
        0% { background-color: rgba(0, 0, 0, 0); }
        50% { background-color: rgba(0, 0, 0, 0.1); }
        100% { background-color: rgba(0, 0, 0, 0); }
      }
      
      .selected-parent {
        animation: select-pulse 0.3s ease;
      }
      
      /* Expand icon (for expandable items) */
      .expand-icon {
        margin-left: auto;
        font-size: 0.7em;
        opacity: 0.6;
        padding: 4px;
      }
      
      /* Variant items */
      .exercise-variants {
        margin-left: 12px;
        border-left: 1px solid #eaeaea;
      }
      
      .exercise-variant-item {
        padding: 8px 12px 8px 16px;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: background-color 0.2s;
        font-size: 0.9rem;
      }
      
      .exercise-variant-item.selected {
        font-weight: 500;
      }
      
      .variant-label {
        display: block;
      }
      
      /* Loading state */
      .title-dropdown-container .visible-title.loading-state {
        opacity: 0.7;
        pointer-events: none;
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
      }
      
      /* Mobile optimizations */
      @media (max-width: 576px) {
        .exercise-parent-item {
          min-height: 44px;
          padding: 12px 16px;
        }
        
        .exercise-parent-item.non-expandable {
          padding-left: 16px;
        }
        
        .exercise-variant-item {
          min-height: 40px;
          padding: 10px 12px 10px 16px;
        }
        
        .dropdown-close {
          min-width: 44px;
          min-height: 44px;
        }
      }
  
      /* Fix for mobile touches */
      .exercise-item, .exercise-parent-item, .exercise-variant-item {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      
      /* Improved touch handling */
      .exercise-item[data-touch-active="true"],
      .exercise-parent-item[data-touch-active="true"],
      .exercise-variant-item[data-touch-active="true"] {
        background-color: rgba(0, 0, 0, 0.05);
      }
    `;
    document.head.appendChild(style);
  }

  // Start the process
  addNestedDropdownStyles();
  createNestedDropdownWithMuscleGroups().catch(error => {
    console.error('Error creating nested dropdown:', error);
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

function initializeNestedDropdown() {
  if (document.getElementById('exercise-select')) {
    createNestedExerciseDropdown();
  } else {
    const observer = new MutationObserver(function(mutations) {
      if (document.getElementById('exercise-select')) {
        createNestedExerciseDropdown();
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
    
    /* Base dropdown styling */
    .title-dropdown-container .visible-title {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .title-dropdown-container .visible-title:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .title-dropdown-container .visible-title .title-text {
      flex: 1;
      margin-right: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .title-dropdown-container .visible-title .dropdown-arrow {
      font-size: 0.8em;
      opacity: 0.7;
    }
    
    /* Muscle group sections */
    .muscle-group-section {
      margin-bottom: 8px;
    }
    
    .muscle-group-header {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 0.9rem;
      border-radius: 4px;
    }
    
    .muscle-group-divider {
      height: 1px;
      background-color: #eee;
      margin: 8px 0;
    }
    
    /* Parent exercise items */
    .exercise-parent-item {
      position: relative;
      padding: 10px 12px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      user-select: none;
    }
    
    .parent-exercise-label {
      display: flex;
      align-items: center;
      width: 100%;
    }
    
    .base-exercise-name {
      flex: 1;
      font-weight: 500;
    }
    
    .variant-count {
      margin-left: 6px;
      font-size: 0.85em;
      color: #666;
      opacity: 0.8;
    }
    
    .expand-icon {
      margin-left: auto;
      font-size: 0.7em;
      opacity: 0.6;
      padding: 4px;
    }
    
    /* Variant items */
    .exercise-variants {
      margin-left: 12px;
      border-left: 1px solid #eaeaea;
    }
    
    .exercise-variant-item {
      padding: 8px 12px 8px 16px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background-color 0.2s;
      font-size: 0.9rem;
    }
    
    .exercise-variant-item.selected {
      font-weight: 500;
    }
    
    .variant-label {
      display: block;
    }
    
    /* Loading state */
    .title-dropdown-container .visible-title.loading-state {
      opacity: 0.7;
      pointer-events: none;
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
    }
    
    /* Mobile optimizations */
    @media (max-width: 576px) {
      .exercise-parent-item {
        min-height: 44px;
        padding: 12px 16px;
      }
      
      .exercise-variant-item {
        min-height: 40px;
        padding: 10px 12px 10px 16px;
      }
      
      .dropdown-close {
        min-width: 44px;
        min-height: 44px;
      }
    }
    
    /* Fix for mobile touches */
    .exercise-item, .exercise-parent-item, .exercise-variant-item {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    
    /* Improved touch handling */
    .exercise-item[data-touch-active="true"],
    .exercise-parent-item[data-touch-active="true"],
    .exercise-variant-item[data-touch-active="true"] {
      background-color: rgba(0, 0, 0, 0.05);
    }
  `;
  document.head.appendChild(style);
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
  addLoadingStyles();
  initializeNestedDropdown();
});

// If the document is already loaded, add styles immediately
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  addLoadingStyles();
  setTimeout(initializeNestedDropdown, 100);
}


document.addEventListener('click', function(event) {
  // Check if the click was outside a container that should keep its dropdown open
  if (!event.target.closest('.title-dropdown-container')) {
    collapseAllExpandedMenus();
  }
});





