// script.js
// This file fetches your data, processes it, and creates D3 charts.

Promise.all([
    d3.json("data/19-03-2025.json"),
    d3.json("data/20-03-2025.json"),
    d3.json("data/22-03-2025.json")
  ]).then(function(dataArray) {
    // Helper to parse "XX kg" as a float
    function parseWeight(str) {
      if (!str) return 0;
      return parseFloat(str.replace(" kg", ""));
    }
  
    // A date parser for "DD-MM-YYYY"
    const parseDate = d3.timeParse("%d-%m-%Y");
  
    // We’ll collect two sets of data:
    // 1) totalVolumePerDay for the bar chart
    // 2) muscleGroupVolume for the donut chart
    let totalVolumePerDay = [];
    let muscleGroupVolume = {};
  
    dataArray.forEach(dayData => {
      let dateObj = parseDate(dayData.date);
  
      let totalVolume = 0;
  
      dayData.workout.forEach(entry => {
        let w = parseWeight(entry.Weight);
        let r = +entry.Reps;
        let volume = w * r;
        totalVolume += volume;
  
        let mg = entry["Muscle-Group"] || "Unknown";
        muscleGroupVolume[mg] = (muscleGroupVolume[mg] || 0) + volume;
      });
  
      totalVolumePerDay.push({
        dateString: dayData.date,
        dateObj: dateObj,
        totalVolume: totalVolume
      });
    });
  
    // Sort by date
    totalVolumePerDay.sort((a, b) => a.dateObj - b.dateObj);
  
    // ---------------------------
    // BAR CHART of totalVolumePerDay
    // ---------------------------
    const barWidth = 400,
          barHeight = 300,
          margin = { top: 30, right: 20, bottom: 50, left: 50 };
  
    const svgBar = d3.select("#barChartSVG")
      .attr("width", barWidth)
      .attr("height", barHeight);
  
    const gBar = svgBar.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    const widthInner = barWidth - margin.left - margin.right;
    const heightInner = barHeight - margin.top - margin.bottom;
  
    // x scale (band scale since we only have a few days)
    const xScale = d3.scaleBand()
      .domain(totalVolumePerDay.map(d => d.dateString))
      .range([0, widthInner])
      .padding(0.2);
  
    // y scale
    const yMax = d3.max(totalVolumePerDay, d => d.totalVolume);
    const yScale = d3.scaleLinear()
      .domain([0, yMax])
      .range([heightInner, 0])
      .nice();
  
    // Bars
    gBar.selectAll(".bar")
      .data(totalVolumePerDay)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => xScale(d.dateString))
      .attr("y", d => yScale(d.totalVolume))
      .attr("width", xScale.bandwidth())
      .attr("height", d => heightInner - yScale(d.totalVolume))
      .attr("fill", "#69b3a2");
  
    // Axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
  
    gBar.append("g")
      .attr("transform", `translate(0, ${heightInner})`)
      .call(xAxis);
  
    gBar.append("g")
      .call(yAxis);
  
    // ---------------------------
    // DONUT CHART of muscleGroupVolume
    // ---------------------------
    const donutWidth = 400,
          donutHeight = 300,
          donutRadius = Math.min(donutWidth, donutHeight) / 2;
  
    const svgDonut = d3.select("#donutChartSVG")
      .attr("width", donutWidth)
      .attr("height", donutHeight);
  
    const gDonut = svgDonut.append("g")
      .attr("transform", `translate(${donutWidth / 2}, ${donutHeight / 2})`);
  
    // Convert muscleGroupVolume object => array
    const mgData = Object.keys(muscleGroupVolume).map(k => ({
      muscle: k,
      volume: muscleGroupVolume[k]
    }));
  
    // A color scale
    const color = d3.scaleOrdinal()
      .domain(mgData.map(d => d.muscle))
      .range(d3.schemeSet2);
  
    // Pie generator
    const pie = d3.pie()
      .sort(null)
      .value(d => d.volume);
  
    // Arc generator
    const arc = d3.arc()
      .innerRadius(donutRadius * 0.5)
      .outerRadius(donutRadius);
  
    gDonut.selectAll("path")
      .data(pie(mgData))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", d => color(d.data.muscle))
      .attr("stroke", "#fff")
      .style("stroke-width", "2px");
  
    // Optional label
    gDonut.selectAll("text")
      .data(pie(mgData))
      .enter()
      .append("text")
      .attr("transform", d => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text(d => d.data.muscle);
  
  }).catch(function(error) {
    console.error("Error loading data:", error);
  });
  