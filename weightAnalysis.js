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
    document.body.appendChild(backdrop);
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
        addExerciseLegend(document.querySelector('.legend-container'), containerWidth);
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
      addExerciseLegend(document.querySelector('.legend-container'), containerWidth);
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
        addExerciseLegend(document.querySelector('.legend-container'), containerWidth);
      });
      sliderContainer.appendChild(slider);
      controlsWrapper.appendChild(sliderContainer);
    }

    mainWrapper.appendChild(controlsWrapper);

    const legendContainer = document.createElement('div');
    legendContainer.className = 'legend-container';
    mainWrapper.appendChild(legendContainer);

    container.appendChild(mainWrapper);
    addExerciseLegend(legendContainer, containerWidth);
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
      const color = exerciseColors[index];
      const lineItem = document.createElement('div');
      lineItem.className = 'legend-item';

      const lineSwatch = document.createElement('span');
      lineSwatch.className = 'legend-swatch line';
      lineSwatch.style.backgroundColor = color;
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
    const dynamicMargin = {
      top: 20,
      right: isMobile ? 40 : 60,
      bottom: isMobile ? 30 : 40,
      left: isMobile ? 35 : 45
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

    g.append("g")
      .attr("class", "grid-lines-x")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(isMobile ? 4 : 6, d3.max(exerciseNames.map(name => allProcessedData[name] ? allProcessedData[name].length : 0))))
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

    const xAxis = g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x)
        .ticks(Math.min(isMobile ? 4 : 6, d3.max(exerciseNames.map(name => allProcessedData[name] ? allProcessedData[name].length : 0))))
        .tickSizeOuter(0)
        .tickFormat(d => {
          const day = d.getDate();
          if (isMobile) return `${day}`;
          const month = d.getMonth();
          return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month]} ${day}`;
        })
      );
    xAxis.select(".domain").attr("stroke", "#ccc");
    xAxis.selectAll("text")
      .attr("transform", isMobile ? "rotate(-30)" : "rotate(-40)")
      .attr("text-anchor", "end")
      .attr("dx", isMobile ? "-0.2em" : "-0.5em")
      .attr("dy", isMobile ? "0.1em" : "0.15em");

    const yAxis = g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y)
        .ticks(isMobile ? 4 : 5)
        .tickSizeOuter(0)
        .tickFormat(d => isMobile ? `${d}` : `${d}kg`)
      );
    yAxis.select(".domain").attr("stroke", "#ccc");

    let tooltip = d3.select("body").select(".exercise-tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div")
        .attr("class", "exercise-tooltip");
    }

    exerciseNames.forEach((exerciseName, index) => {
      if (!allProcessedData[exerciseName] || allProcessedData[exerciseName].length === 0) return;
      const color = exerciseColors[index % exerciseColors.length];
      const processedData = allProcessedData[exerciseName];
      const areaGenerator = d3.area()
        .x(d => x(d.date))
        .y0(d => y(d.minWeight))
        .y1(d => y(d.maxWeight))
        .curve(d3.curveMonotoneX);
      g.append("path")
        .datum(processedData)
        .attr("fill", color)
        .attr("fill-opacity", 0.15)
        .attr("d", areaGenerator);

      const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.weightedAvg))
        .curve(d3.curveMonotoneX);
      g.append("path")
        .datum(processedData)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", isMobile ? 2 : 2.5)
        .attr("d", lineGenerator);

      const avgPointRadius = isMobile ? 3 : 4;
      processedData.forEach(dayData => {
        g.append("circle")
          .attr("class", "avg-point")
          .attr("cx", x(dayData.date))
          .attr("cy", y(dayData.weightedAvg))
          .attr("r", avgPointRadius)
          .attr("fill", color)
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
        const color = exerciseColors[index % exerciseColors.length];
        const displayName = name.length > 10 ? name.substring(0, 10) + '...' : name;
        const legendItem = legendG.append("g")
          .attr("transform", `translate(0, ${index * 20})`);
        legendItem.append("line")
          .attr("x1", 0)
          .attr("y1", 9)
          .attr("x2", 15)
          .attr("y2", 9)
          .attr("stroke", color)
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

  // Expose functions and data loading routine for external usage (including enhanced dropdown)
  window.weightAnalysis = {
    init: initExerciseTracker,
    updateYear: updateYear,
    renderMultiExerciseChart: renderMultiExerciseChart,
    getFilteredExerciseData: getFilteredExerciseData,
    loadExerciseData: loadExerciseData
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
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      if (document.getElementById('secondChartArea')) {
        console.log('Exercise tracker: DOM is ready, initializing...');
        initExerciseTracker();
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
    if (!muscleGroup || !muscleBackgroundColors[muscleGroup]) return 'rgba(0, 0, 0, 0.03)';
    
    // Convert the hex color to a more transparent version for hover
    const hexColor = muscleBackgroundColors[muscleGroup].replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, 0.5)`; // 50% opacity for hover
  };
  
  const getSelectionColor = (muscleGroup) => {
    if (!muscleGroup || !muscleBackgroundColors[muscleGroup]) return 'rgba(0, 0, 0, 0.05)';
    
    // Convert hex color to a slightly more solid version for selection
    const hexColor = muscleBackgroundColors[muscleGroup].replace('#', '');
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, 0.7)`; // 70% opacity for selection
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
    const visibleTitle = document.createElement('div');
    visibleTitle.className = 'visible-title';
    visibleTitle.innerHTML = `
      <span class="title-text">Bench Press</span>
      <span class="dropdown-arrow">▾</span>
    `;
    const select = document.createElement('select');
    select.id = 'title-exercise-select';
    select.className = 'hidden-select';
    const customDropdown = document.createElement('div');
    customDropdown.className = 'custom-dropdown-menu';
    customDropdown.style.display = 'none';
    customDropdown.setAttribute('role', 'listbox');
    customDropdown.setAttribute('aria-label', 'Exercise Selection');
    const mobileHeader = document.createElement('div');
    mobileHeader.className = 'dropdown-mobile-header';
    mobileHeader.innerHTML = `
      <div class="dropdown-title">Select Exercise</div>
      <button class="dropdown-close" aria-label="Close selection">✕</button>
    `;
    customDropdown.appendChild(mobileHeader);
    newDropdownContainer.appendChild(visibleTitle);
    newDropdownContainer.appendChild(select);
    newDropdownContainer.appendChild(customDropdown);
    titleElement.parentNode.replaceChild(newDropdownContainer, titleElement);
    dropdownContainer = newDropdownContainer;
  }

  let backdrop = document.querySelector('.dropdown-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'dropdown-backdrop';
    document.body.appendChild(backdrop);
  }

  const visibleTitleText = dropdownContainer.querySelector('.title-text');
  const customDropdown = dropdownContainer.querySelector('.custom-dropdown-menu');
  const hiddenSelect = dropdownContainer.querySelector('.hidden-select');

  let enhancedSelectedExercises = window.selectedExercises || [];
  const exerciseOptions = Array.from(existingDropdown.options).map(option => ({
    value: option.value,
    text: option.text,
    muscleGroup: null
  }));

  // Find the longest exercise name to set width
  let maxExerciseNameLength = 0;
  exerciseOptions.forEach(option => {
    if (option.text.length > maxExerciseNameLength) {
      maxExerciseNameLength = option.text.length;
    }
  });

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

  // Updated hover effects with distinct hover/selection colors
  function setupHoverEffects(item, muscleGroup) {
    // When the mouse is over the item, use a transparent version of the muscle color
    item.addEventListener('mouseover', () => {
      if (!item.classList.contains('selected')) {
        item.style.backgroundColor = getHoverColor(muscleGroup);
      }
    });
    
    // When the mouse leaves, remove the hover background if not selected
    item.addEventListener('mouseout', () => {
      if (!item.classList.contains('selected')) {
        item.style.backgroundColor = '';
      }
    });
  }

  function createDropdownWithMuscleGroups(exerciseToMuscleGroup) {
    customDropdown.innerHTML = '';
    
    // Set dropdown width based on longest exercise name
    const charWidth = 8; // Approximate width of a character in pixels
    const padding = 80; // Extra padding for icons, margins, etc.
    const estimatedWidth = Math.min(
      Math.max((maxExerciseNameLength * charWidth) + padding, 240), // Min width of 240px
      400 // Max width of 400px
    );
    customDropdown.style.width = `${estimatedWidth}px`;
    
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

    exerciseOptions.forEach(exercise => {
      const muscleGroup = exerciseToMuscleGroup[exercise.text] || null;
      exercise.muscleGroup = muscleGroup;
      if (muscleGroup && muscleGroupsData[muscleGroup]) {
        muscleGroupsData[muscleGroup].exercises.push(exercise);
      } else {
        muscleGroupsData[muscleGroups[0]].exercises.push(exercise);
      }
    });

    hiddenSelect.innerHTML = '';
    exerciseOptions.forEach(option => {
      const optElement = document.createElement('option');
      optElement.value = option.value;
      optElement.textContent = option.text;
      hiddenSelect.appendChild(optElement);
    });

    const groupList = document.createElement('div');
    groupList.className = 'muscle-group-list';

    muscleGroups.forEach(groupKey => {
      const group = muscleGroupsData[groupKey];
      if (group.exercises.length > 0) {
        const section = document.createElement('div');
        section.className = 'muscle-group-section';
        
        // Centered muscle group header
        const header = document.createElement('div');
        header.className = 'muscle-group-header';
        header.style.backgroundColor = group.backgroundColor;
        header.textContent = group.name;
        section.appendChild(header);
        
        const exerciseList = document.createElement('div');
        exerciseList.className = 'exercise-list';
        
        group.exercises.forEach(exercise => {
          const item = document.createElement('div');
          item.className = 'exercise-item';
          item.dataset.value = exercise.value;
          item.dataset.muscleGroup = exercise.muscleGroup || '';
          
          // Create a simple label
          const label = document.createElement('span');
          label.className = 'exercise-label';
          label.textContent = exercise.text;
          item.appendChild(label);
          
          // Use updated hover effects
          setupHoverEffects(item, exercise.muscleGroup);
          
          // Updated selection handling with color-coordinated selection indicator
          item.addEventListener('click', () => {
            // Clear selection from all items
            const allItems = customDropdown.querySelectorAll('.exercise-item');
            allItems.forEach(el => {
              el.classList.remove('selected');
              el.setAttribute('aria-selected', 'false');
              el.style.backgroundColor = '';
              el.style.borderLeftColor = '';
            });
            
            // Mark clicked item as selected
            item.classList.add('selected');
            item.setAttribute('aria-selected', 'true');
            
            // Apply distinct selection color and border color
            item.style.backgroundColor = getSelectionColor(exercise.muscleGroup);
            
            // Set the border color based on muscle group
            const borderColor = getBorderColor(exercise.muscleGroup);
            item.style.borderLeftColor = borderColor;
            
            // Update selection state
            enhancedSelectedExercises = [exercise.value];
            
            // Update UI and chart
            updateTitleText();
            updateExercisesChart();
            
            // Close dropdown
            toggleDropdown(false);
          });
          
          // Mark as selected if it's in the current selection
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
    setupEventListeners();
    
    const exerciseSelectorContainer = existingDropdown.closest('.exercise-selector');
    if (exerciseSelectorContainer) {
      exerciseSelectorContainer.style.display = 'none';
    }
  }

  function setupEventListeners() {
    window.toggleDropdown = (show) => {
      if (show === undefined) show = customDropdown.style.display !== 'block';
      if (show) {
        const isMobile = window.innerWidth <= 576;
        customDropdown.style.display = 'block';
        if (isMobile) {
          backdrop.style.display = 'block';
          setTimeout(() => backdrop.classList.add('active'), 10);
        }
        dropdownContainer.classList.add('active');
        setTimeout(() => {
          const selected = customDropdown.querySelector('.exercise-item.selected');
          if (selected) {
            selected.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, 100);
      } else {
        customDropdown.style.display = 'none';
        backdrop.classList.remove('active');
        setTimeout(() => {
          if (!dropdownContainer.classList.contains('active')) {
            backdrop.style.display = 'none';
          }
        }, 200);
        dropdownContainer.classList.remove('active');
      }
    };

    const visibleTitle = dropdownContainer.querySelector('.visible-title');
    if (visibleTitle) {
      const newVisibleTitle = visibleTitle.cloneNode(true);
      visibleTitle.parentNode.replaceChild(newVisibleTitle, visibleTitle);
      newVisibleTitle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });
    }

    customDropdown.addEventListener('click', (e) => {
      // Handle close button
      if (e.target.closest('.dropdown-close')) {
        toggleDropdown(false);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.title-dropdown-container') &&
          !e.target.closest('.custom-dropdown-menu')) {
        toggleDropdown(false);
      }
    });
    
    backdrop.addEventListener('click', () => {
      toggleDropdown(false);
    });
    
    customDropdown.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggleDropdown(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(customDropdown.querySelectorAll('.exercise-item'));
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
      existingDropdown.value = selectedValue;
      existingDropdown.dispatchEvent(new Event('change'));
    }
  }

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
      if (window.renderMultiExerciseChart) {
        window.renderMultiExerciseChart(window.getFilteredExerciseData());
      } else {
        const existingDropdown = document.getElementById('exercise-select');
        if (existingDropdown && enhancedSelectedExercises.length > 0) {
          existingDropdown.value = enhancedSelectedExercises[0];
          existingDropdown.dispatchEvent(new Event('change'));
        }
      }
    });
  }

  fetchExerciseMuscleGroups().then(exerciseToMuscleGroup => {
    createDropdownWithMuscleGroups(exerciseToMuscleGroup);
  }).catch(error => {
    console.error('Error creating dropdown:', error);
    createDropdownWithMuscleGroups({});
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

document.addEventListener('DOMContentLoaded', initializeEnhancedDropdown);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(initializeEnhancedDropdown, 100);
}