let allColumns = [];
let categoricalColumns = [];

// Handle File Selection and Upload
function handleFileSelect(event) {
    const fileInput = event.target;
    const fileName = fileInput.files[0].name;
    document.getElementById('file-name').value = fileName;
    document.getElementById('clear-button').style.display = 'inline';

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    fetch('/', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        allColumns = data.columns;
        categoricalColumns = data.categorical_columns;

        populateFilterDropdown(allColumns);
        showPlotForm('scatter'); // Default to scatter plot initially
    })
    .catch(error => console.error('Error:', error));
}

// Clear the Selected File and Reset UI
function clearFile() {
    // Reset the file input
    document.getElementById('file-input').value = '';

    // Clear the file name display
    document.getElementById('file-name').value = '';

    // Hide the clear button
    document.getElementById('clear-button').style.display = 'none';

    // Clear dropdowns and other UI elements
    document.getElementById('filter-dropdown').innerHTML = '';
    document.getElementById('filter-values-container').style.display = 'none';
    document.getElementById('apply-filter-button').style.display = 'none';
    document.getElementById('plot-form').innerHTML = '';
    document.getElementById('plot-image').src = '';

    // Reset internal state variables
    allColumns = [];
    categoricalColumns = [];

    // Reset filtered_df by making an API call or updating the global state
    fetch('/reset-filter', {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        console.log('Filters reset successfully');
    })
    .catch(error => console.error('Error resetting filters:', error));
}

// Populate the Filter Dropdown with Column Names
function populateFilterDropdown(columns) {
    const filterDropdown = document.getElementById('filter-dropdown');
    filterDropdown.innerHTML = '<option value="">None</option>';
    columns.forEach(column => {
        const option = document.createElement('option');
        option.value = column;
        option.text = column;
        filterDropdown.appendChild(option);
    });
}

// Handle Filter Dropdown Change to Display Unique Values
function onFilterChange() {
    const selectedColumn = document.getElementById('filter-dropdown').value;
    const filterValuesContainer = document.getElementById('filter-values-container');
    const applyFilterButton = document.querySelector('.apply-filter-button');

    if (selectedColumn) {
        fetch(`/get-unique-values?column=${encodeURIComponent(selectedColumn)}`)
            .then(response => response.json())
            .then(data => {
                filterValuesContainer.innerHTML = '';
                data.unique_values.forEach(value => {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = value;
                    checkbox.id = `filter-${value}`;

                    const label = document.createElement('label');
                    label.htmlFor = `filter-${value}`;
                    label.textContent = value;

                    const checkboxContainer = document.createElement('div');
                    checkboxContainer.appendChild(checkbox);
                    checkboxContainer.appendChild(label);

                    filterValuesContainer.appendChild(checkboxContainer);
                });

                filterValuesContainer.style.display = 'block';
                applyFilterButton.style.display = 'inline';
            })
            .catch(error => console.error('Error:', error));
    } else {
        filterValuesContainer.style.display = 'none';
        applyFilterButton.style.display = 'none';
    }
}

// Apply Selected Filters to the Data
function applyFilter() {
    const selectedColumn = document.getElementById('filter-dropdown').value;
    const selectedValues = Array.from(document.querySelectorAll('#filter-values-container input:checked')).map(checkbox => checkbox.value);

    fetch('/apply-filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filter_column: selectedColumn || "None", // Send "None" if no column is selected
            filter_values: selectedValues.length > 0 ? selectedValues : ["All"]
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Filter applied successfully');
        // Optionally trigger plot update or UI refresh here
    })
    .catch(error => console.error('Error:', error));
}

// Populate Dropdowns Based on Plot Type
function populateDropdowns(plotType) {
    const xDropdown = document.querySelector('select[name="x-dropdown"]');
    const yDropdown = document.querySelector('select[name="y-dropdown"]');
    const hueDropdown = document.querySelector('select[name="hue-dropdown"]');
    const wavelengthStartDropdown = document.querySelector('select[name="wavelength-start-dropdown"]');
    const wavelengthEndDropdown = document.querySelector('select[name="wavelength-end-dropdown"]');
    const plotIdDropdown = document.querySelector('select[name="plot-id-dropdown"]');

    if (plotType !== 'spectral') {
        populateDropdown(xDropdown, allColumns);
        if (yDropdown) populateDropdown(yDropdown, allColumns);

        hueDropdown.innerHTML = '<option value="">None</option>';
        populateDropdown(hueDropdown, categoricalColumns);
    } else {
        // For Spectral Plot
        populateDropdown(wavelengthStartDropdown, allColumns);
        populateDropdown(wavelengthEndDropdown, allColumns);
        plotIdDropdown.innerHTML = '<option value="">None</option>';
        populateDropdown(plotIdDropdown, categoricalColumns); // Assuming Plot ID is categorical
    }
}

// General Function to Populate a Given Dropdown with Columns
function populateDropdown(dropdown, columns) {
    dropdown.innerHTML = '<option value="">None</option>';
    columns.forEach(column => {
        const option = document.createElement('option');
        option.value = column;
        option.text = column;
        dropdown.appendChild(option);
    });
}

// Display the Appropriate Plot Form Based on Selected Plot Type
function showPlotForm(plotType) {
    const plotForm = document.getElementById('plot-form');
    plotForm.innerHTML = '';

    if (plotType === 'scatter' || plotType === 'line' || plotType === 'box' || plotType === 'bar') {
        plotForm.innerHTML = `
            <div class="dropdown-container">
                <span class="dropdown-label">X:</span>
                <select class="dropdown-select" name="x-dropdown"></select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">Y:</span>
                <select class="dropdown-select" name="y-dropdown"></select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">Hue:</span>
                <select class="dropdown-select" name="hue-dropdown">
                    <option value="">None</option>
                </select>
            </div>
            <button type="button" class="generate-button" onclick="updatePlot('${plotType}')">Generate ${capitalizeFirstLetter(plotType)} Plot</button>
            <button type="button" class="generate-button" onclick="savePlot('${plotType}')">Save Plot</button>
        `;
    } else if (plotType === 'hist') {
        plotForm.innerHTML = `
            <div class="dropdown-container">
                <span class="dropdown-label">X:</span>
                <select class="dropdown-select" name="x-dropdown"></select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">Hue:</span>
                <select class="dropdown-select" name="hue-dropdown">
                    <option value="">None</option>
                </select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">Multiple:</span>
                <select class="dropdown-select" name="multiple-dropdown">
                    <option value="">None</option>
                    <option value="layer">Layer</option>
                    <option value="dodge">Dodge</option>
                    <option value="stack">Stack</option>
                    <option value="fill">Fill</option>
                </select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">KDE:</span>
                <select class="dropdown-select kde-dropdown" name="kde-dropdown">
                    <option value="false">False</option>
                    <option value="true">True</option>
                </select>
            </div>
            <button type="button" class="generate-button" onclick="updatePlot('hist')">Generate Histogram</button>
            <button type="button" class="generate-button" onclick="savePlot('hist')">Save Plot</button>
        `;
    } else if (plotType === 'spectral') {
        plotForm.innerHTML = `
            <div class="dropdown-container">
                <span class="dropdown-label">Wavelength Start:</span>
                <select class="dropdown-select" name="wavelength-start-dropdown"></select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">Wavelength End:</span>
                <select class="dropdown-select" name="wavelength-end-dropdown"></select>
            </div>
            <div class="dropdown-container">
                <span class="dropdown-label">Plot ID:</span>
                <select class="dropdown-select" name="plot-id-dropdown">
                    <option value="">None</option>
                </select>
            </div>
            <button type="button" class="generate-button" onclick="updatePlot('spectral')">Generate Spectral Plot</button>
            <button type="button" class="generate-button" onclick="savePlot('spectral')">Save Spectral Plot</button>
        `;
    }

    populateDropdowns(plotType);
}

// Capitalize the First Letter of a String
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Update the Plot Based on User Selections
function updatePlot(plotType) {
    let url = `/get-plot-data?type=${encodeURIComponent(plotType)}`;

    if (plotType === 'scatter' || plotType === 'line' || plotType === 'box' || plotType === 'bar') {
        const xColumn = document.querySelector('select[name="x-dropdown"]').value;
        const yColumn = document.querySelector('select[name="y-dropdown"]').value;
        const hue = document.querySelector('select[name="hue-dropdown"]').value;

        url += `&x=${encodeURIComponent(xColumn)}`;
        if (yColumn) url += `&y=${encodeURIComponent(yColumn)}`;
        if (hue) url += `&hue=${encodeURIComponent(hue)}`;
    } else if (plotType === 'hist') {
        const xColumn = document.querySelector('select[name="x-dropdown"]').value;
        const hue = document.querySelector('select[name="hue-dropdown"]').value;
        const multiple = document.querySelector('select[name="multiple-dropdown"]').value;
        const kde = document.querySelector('select[name="kde-dropdown"]').value === 'true';

        url += `&x=${encodeURIComponent(xColumn)}`;
        if (hue) url += `&hue=${encodeURIComponent(hue)}`;
        if (multiple) url += `&multiple=${encodeURIComponent(multiple)}`;
        url += `&kde=${kde}`;
    } else if (plotType === 'spectral') {
        const wavelengthStart = document.querySelector('select[name="wavelength-start-dropdown"]').value;
        const wavelengthEnd = document.querySelector('select[name="wavelength-end-dropdown"]').value;
        const plotId = document.querySelector('select[name="plot-id-dropdown"]').value;

        url += `&wavelength_start=${encodeURIComponent(wavelengthStart)}`;
        url += `&wavelength_end=${encodeURIComponent(wavelengthEnd)}`;
        if (plotId) url += `&plot_id=${encodeURIComponent(plotId)}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const plotImage = document.getElementById('plot-image');
            plotImage.src = 'data:image/png;base64,' + data.plot;
        })
        .catch(error => console.error('Error:', error));
}

// Save the Current Plot as an Image
function savePlot(plotType) {
    let url = `/save-plot-data?type=${encodeURIComponent(plotType)}`;

    if (plotType === 'scatter' || plotType === 'line' || plotType === 'box' || plotType === 'bar') {
        const xColumn = document.querySelector('select[name="x-dropdown"]').value;
        const yColumn = document.querySelector('select[name="y-dropdown"]').value;
        const hue = document.querySelector('select[name="hue-dropdown"]').value;

        url += `&x=${encodeURIComponent(xColumn)}`;
        if (yColumn) url += `&y=${encodeURIComponent(yColumn)}`;
        if (hue) url += `&hue=${encodeURIComponent(hue)}`;
    } else if (plotType === 'hist') {
        const xColumn = document.querySelector('select[name="x-dropdown"]').value;
        const hue = document.querySelector('select[name="hue-dropdown"]').value;
        const multiple = document.querySelector('select[name="multiple-dropdown"]').value;
        const kde = document.querySelector('select[name="kde-dropdown"]').value === 'true';

        url += `&x=${encodeURIComponent(xColumn)}`;
        if (hue) url += `&hue=${encodeURIComponent(hue)}`;
        if (multiple) url += `&multiple=${encodeURIComponent(multiple)}`;
        url += `&kde=${kde}`;
    } else if (plotType === 'spectral') {
        const wavelengthStart = document.querySelector('select[name="wavelength-start-dropdown"]').value;
        const wavelengthEnd = document.querySelector('select[name="wavelength-end-dropdown"]').value;
        const plotId = document.querySelector('select[name="plot-id-dropdown"]').value;

        url += `&wavelength_start=${encodeURIComponent(wavelengthStart)}`;
        url += `&wavelength_end=${encodeURIComponent(wavelengthEnd)}`;
        if (plotId) url += `&plot_id=${encodeURIComponent(plotId)}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const downloadLink = document.createElement('a');
            downloadLink.href = 'data:image/png;base64,' + data.plot;
            const filename = plotType === 'spectral' ? `spectral_plot.${data.format}` : `plot.${data.format}`;
            downloadLink.download = filename;
            downloadLink.click();
        })
        .catch(error => console.error('Error:', error));
}
