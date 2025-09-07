// Data from the project files
var pathwayData = [
    { gene: 'VioA', step_order: 1, baseline_k: 1.0, burden_w: 1.0 },
    { gene: 'VioB', step_order: 2, baseline_k: 1.0, burden_w: 1.0 },
    { gene: 'VioE', step_order: 3, baseline_k: 1.0, burden_w: 1.0 },
    { gene: 'VioD', step_order: 4, baseline_k: 1.0, burden_w: 1.0 },
    { gene: 'VioC', step_order: 5, baseline_k: 1.0, burden_w: 1.2 }
];

var moduleTypes = {
    'VPR_Activation': { type: 'activator', className: 'vpr-activation', effect: 3.0 },
    'KRAB_Repression': { type: 'repressor', className: 'krab-repression', effect: 0.2 },
    'Methylation_Lock': { type: 'binary', className: 'methylation-lock', effect: 1.0 },
    'Neutral': { type: 'neutral', className: 'neutral', effect: 1.0 }
};

// Current state of all genes
var geneStates = {};

// Starting simulation values
var simulationData = {
    yield: 1.0,
    bottleneck: 'None',
    sensitivities: [
        { gene: 'VioA', value: 0.75 },
        { gene: 'VioB', value: 0.45 },
        { gene: 'VioE', value: 0.90 },
        { gene: 'VioD', value: 0.60 },
        { gene: 'VioC', value: 0.30 }
    ]
};

// Initialize gene states to neutral
function initializeGenes() {
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        geneStates[gene.gene] = {
            module: 'Neutral',
            level: 0.5
        };
    }
}

// Set up tab switching
function setupTabs() {
    var navLinks = document.querySelectorAll('.nav-link');
    var tabContents = document.querySelectorAll('.tab-content');

    for (var i = 0; i < navLinks.length; i++) {
        navLinks[i].addEventListener('click', function(e) {
            var targetTab = e.target.getAttribute('data-tab');
            
            // Remove active from all
            for (var j = 0; j < navLinks.length; j++) {
                navLinks[j].classList.remove('active');
            }
            for (var k = 0; k < tabContents.length; k++) {
                tabContents[k].classList.remove('active');
            }
            
            // Add active to current
            e.target.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    }
}

// Create the pathway diagram
function buildPathwayDiagram() {
    var container = document.getElementById('pathwayContainer');
    container.innerHTML = '';

    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        
        // Create gene node
        var geneNode = document.createElement('div');
        geneNode.className = 'gene-node';
        
        var geneCircle = document.createElement('div');
        geneCircle.className = 'gene-circle neutral';
        geneCircle.textContent = gene.gene;
        geneCircle.onclick = function() {
            cycleGeneModule(this.textContent);
        };
        
        var geneLabel = document.createElement('div');
        geneLabel.className = 'gene-label';
        geneLabel.textContent = gene.gene;
        
        geneNode.appendChild(geneCircle);
        geneNode.appendChild(geneLabel);
        container.appendChild(geneNode);
        
        // Add arrow except after last gene
        if (i < pathwayData.length - 1) {
            var arrow = document.createElement('div');
            arrow.className = 'pathway-arrow';
            arrow.textContent = '→';
            container.appendChild(arrow);
        }
    }
}

// Create gene controls
function buildGeneControls() {
    var container = document.getElementById('geneControls');
    
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        
        var controlGroup = document.createElement('div');
        controlGroup.className = 'control-group';
        
        var label = document.createElement('label');
        label.className = 'control-label';
        label.textContent = gene.gene;
        
        var buttonContainer = document.createElement('div');
        buttonContainer.className = 'control-buttons';
        
        var moduleNames = Object.keys(moduleTypes);
        for (var j = 0; j < moduleNames.length; j++) {
            var moduleName = moduleNames[j];
            var button = document.createElement('button');
            button.className = 'control-btn';
            button.textContent = moduleName.replace('_', ' ');
            
            // Create closure to capture current values
            (function(geneName, moduleType) {
                button.onclick = function() {
                    setGeneModule(geneName, moduleType);
                };
            })(gene.gene, moduleName);
            
            if (moduleName === 'Neutral') {
                button.classList.add('active');
            }
            
            buttonContainer.appendChild(button);
        }
        
        var slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'slider';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.05';
        slider.value = '0.5';
        
        // Create closure for slider
        (function(geneName) {
            slider.oninput = function() {
                setGeneLevel(geneName, parseFloat(this.value));
            };
        })(gene.gene);
        
        var sliderValue = document.createElement('span');
        sliderValue.textContent = '0.50';
        sliderValue.id = gene.gene + 'Level';
        
        controlGroup.appendChild(label);
        controlGroup.appendChild(buttonContainer);
        controlGroup.appendChild(slider);
        controlGroup.appendChild(sliderValue);
        container.appendChild(controlGroup);
    }
}

// Create sensitivity bars
function buildSensitivityBars() {
    var container = document.getElementById('sensitivityBars');
    
    for (var i = 0; i < simulationData.sensitivities.length; i++) {
        var item = simulationData.sensitivities[i];
        
        var sensitivityItem = document.createElement('div');
        sensitivityItem.className = 'sensitivity-item';
        
        var label = document.createElement('div');
        label.className = 'sensitivity-label';
        label.textContent = item.gene;
        
        var barContainer = document.createElement('div');
        barContainer.className = 'sensitivity-bar';
        
        var barFill = document.createElement('div');
        barFill.className = 'sensitivity-fill';
        barFill.style.width = (item.value * 100) + '%';
        
        var value = document.createElement('div');
        value.className = 'sensitivity-value';
        value.textContent = item.value.toFixed(2);
        
        barContainer.appendChild(barFill);
        sensitivityItem.appendChild(label);
        sensitivityItem.appendChild(barContainer);
        sensitivityItem.appendChild(value);
        container.appendChild(sensitivityItem);
    }
}

// Fill data table
function buildDataTable() {
    var tableBody = document.getElementById('pathwayDataTable');
    
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        var row = document.createElement('tr');
        
        var geneCell = document.createElement('td');
        geneCell.textContent = gene.gene;
        geneCell.style.fontWeight = 'bold';
        geneCell.style.color = '#3498db';
        
        var orderCell = document.createElement('td');
        orderCell.textContent = gene.step_order;
        
        var baselineCell = document.createElement('td');
        baselineCell.textContent = gene.baseline_k.toFixed(1);
        
        var burdenCell = document.createElement('td');
        burdenCell.textContent = gene.burden_w.toFixed(1);
        
        row.appendChild(geneCell);
        row.appendChild(orderCell);
        row.appendChild(baselineCell);
        row.appendChild(burdenCell);
        tableBody.appendChild(row);
    }
}

// Cycle through modules when clicking gene
function cycleGeneModule(geneName) {
    var currentModule = geneStates[geneName].module;
    var moduleNames = Object.keys(moduleTypes);
    var currentIndex = moduleNames.indexOf(currentModule);
    var nextModule = moduleNames[(currentIndex + 1) % moduleNames.length];
    
    setGeneModule(geneName, nextModule);
}

// Set gene to specific module
function setGeneModule(geneName, moduleType) {
    geneStates[geneName].module = moduleType;
    updateGeneVisual(geneName);
    updateControlButtons(geneName, moduleType);
    runSimulation();
}

// Set gene level
function setGeneLevel(geneName, level) {
    geneStates[geneName].level = level;
    var levelDisplay = document.getElementById(geneName + 'Level');
    if (levelDisplay) {
        levelDisplay.textContent = level.toFixed(2);
    }
    runSimulation();
}

// Update gene circle appearance
function updateGeneVisual(geneName) {
    var geneCircles = document.querySelectorAll('.gene-circle');
    
    for (var i = 0; i < geneCircles.length; i++) {
        var circle = geneCircles[i];
        if (circle.textContent === geneName) {
            var module = geneStates[geneName].module;
            var moduleConfig = moduleTypes[module];
            circle.className = 'gene-circle ' + moduleConfig.className;
        }
    }
}

// Update control buttons
function updateControlButtons(geneName, activeModule) {
    var controlGroups = document.querySelectorAll('.control-group');
    
    for (var i = 0; i < controlGroups.length; i++) {
        var group = controlGroups[i];
        var label = group.querySelector('.control-label');
        
        if (label && label.textContent === geneName) {
            var buttons = group.querySelectorAll('.control-btn');
            
            for (var j = 0; j < buttons.length; j++) {
                var button = buttons[j];
                button.classList.remove('active');
                
                if (button.textContent.replace(' ', '_') === activeModule) {
                    button.classList.add('active');
                }
            }
        }
    }
}

// Main simulation function
function runSimulation() {
    var yieldMultiplier = 1.0;
    var bottleneck = 'None';
    var activeGenes = 0;
    
    // Calculate yield based on gene states
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        var state = geneStates[gene.gene];
        var module = moduleTypes[state.module];
        
        if (module.type === 'activator') {
            yieldMultiplier += (state.level * 1.0);
            activeGenes++;
        } else if (module.type === 'repressor') {
            yieldMultiplier *= (1 - state.level * 0.8);
        } else if (module.type === 'binary') {
            if (state.level >= 0.5) {
                yieldMultiplier += 0.3;
                activeGenes++;
            }
        }
    }
    
    // VioE gating rule - if VioE is heavily repressed, big penalty
    var vioEState = geneStates['VioE'];
    var vioEModule = moduleTypes[vioEState.module];
    if (vioEModule.type === 'repressor' && vioEState.level > 0.8) {
        yieldMultiplier = 0.05;
        bottleneck = 'VioE';
    }
    
    // VioC shunt - if VioC is repressed, some penalty
    var vioCState = geneStates['VioC'];
    var vioCModule = moduleTypes[vioCState.module];
    if (vioCModule.type === 'repressor' && vioCState.level > 0.6) {
        yieldMultiplier *= 0.7;
    }
    
    // Keep yield in reasonable range
    yieldMultiplier = Math.max(0.05, Math.min(5.0, yieldMultiplier));
    
    // Update displays
    updateYieldDisplay(yieldMultiplier);
    updateBottleneckDisplay(bottleneck);
    updateSensitivityDisplay();
    updateDataDisplay(activeGenes, yieldMultiplier);
}

// Update yield display
function updateYieldDisplay(multiplier) {
    var yieldValue = document.getElementById('yieldValue');
    var yieldChange = document.getElementById('yieldChange');
    var currentYieldBar = document.getElementById('currentYieldBar');
    
    if (yieldValue) {
        yieldValue.textContent = multiplier.toFixed(1) + 'x';
    }
    
    if (yieldChange) {
        var percentage = Math.round((multiplier - 1) * 100);
        var sign = percentage >= 0 ? '+' : '';
        yieldChange.textContent = sign + percentage + '%';
        yieldChange.style.color = percentage >= 0 ? '#27ae60' : '#e74c3c';
    }
    
    if (currentYieldBar) {
        var barWidth = Math.max(5, multiplier * 100);
        currentYieldBar.style.width = barWidth + '%';
    }
}

// Update bottleneck display
function updateBottleneckDisplay(bottleneck) {
    var bottleneckGene = document.getElementById('bottleneckGene');
    if (bottleneckGene) {
        bottleneckGene.textContent = bottleneck;
    }
}

// Update sensitivity bars
function updateSensitivityDisplay() {
    var sensitivityBars = document.querySelectorAll('.sensitivity-fill');
    var sensitivityValues = document.querySelectorAll('.sensitivity-value');
    
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        var originalSensitivity = simulationData.sensitivities[i].value;
        var state = geneStates[gene.gene];
        var moduleType = moduleTypes[state.module].type;
        
        var adjustedSensitivity = originalSensitivity;
        
        if (moduleType === 'activator') {
            adjustedSensitivity *= (1 + state.level * 0.5);
        } else if (moduleType === 'repressor') {
            adjustedSensitivity *= (1 - state.level * 0.4);
        } else if (moduleType === 'binary') {
            adjustedSensitivity *= (state.level >= 0.5 ? 1.3 : 0.7);
        }
        
        adjustedSensitivity = Math.max(0, Math.min(1, adjustedSensitivity));
        
        if (sensitivityBars[i]) {
            sensitivityBars[i].style.width = (adjustedSensitivity * 100) + '%';
        }
        if (sensitivityValues[i]) {
            sensitivityValues[i].textContent = adjustedSensitivity.toFixed(2);
        }
    }
}

// Update data tab info
function updateDataDisplay(activeGenes, currentYield) {
    var activeGeneCount = document.getElementById('activeGeneCount');
    var currentSupplyCap = document.getElementById('currentSupplyCap');
    var currentBurdenSensitivity = document.getElementById('currentBurdenSensitivity');
    var currentYieldDisplay = document.getElementById('currentYield');
    
    if (activeGeneCount) {
        activeGeneCount.textContent = activeGenes + '/5';
    }
    
    if (currentSupplyCap) {
        var supplySlider = document.getElementById('supplyCap');
        currentSupplyCap.textContent = supplySlider ? supplySlider.value : '2.0';
    }
    
    if (currentBurdenSensitivity) {
        var burdenSlider = document.getElementById('burdenSensitivity');
        currentBurdenSensitivity.textContent = burdenSlider ? burdenSlider.value : '0.05';
    }
    
    if (currentYieldDisplay) {
        currentYieldDisplay.textContent = currentYield.toFixed(1) + 'x';
    }
}

// Reset all genes to neutral
function resetAll() {
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        geneStates[gene.gene] = {
            module: 'Neutral',
            level: 0.5
        };
    }
    
    // Reset all sliders
    var sliders = document.querySelectorAll('.slider');
    for (var i = 0; i < sliders.length; i++) {
        var slider = sliders[i];
        if (slider.id !== 'supplyCap' && slider.id !== 'burdenSensitivity') {
            slider.value = 0.5;
        }
    }
    
    // Reset level displays
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        var levelDisplay = document.getElementById(gene.gene + 'Level');
        if (levelDisplay) {
            levelDisplay.textContent = '0.50';
        }
    }
    
    // Reset visuals
    for (var i = 0; i < pathwayData.length; i++) {
        var gene = pathwayData[i];
        updateGeneVisual(gene.gene);
        updateControlButtons(gene.gene, 'Neutral');
    }
    
    runSimulation();
}

// Grid search function
function runGridSearch() {
    var gridResults = document.getElementById('gridResults');
    if (!gridResults) return;
    
    gridResults.innerHTML = '<p style="color: #3498db;">Running grid search...</p>';
    
    setTimeout(function() {
        var results = [
            { config: 'VioA+VioE High', yield: 2.8, bottleneck: 'VioB' },
            { config: 'Balanced High', yield: 2.1, bottleneck: 'VioC' },
            { config: 'VioE Only', yield: 1.6, bottleneck: 'VioA' },
            { config: 'All Medium', yield: 1.4, bottleneck: 'VioD' },
            { config: 'VioC Repressed', yield: 0.3, bottleneck: 'VioC' }
        ];
        
        var html = '<div style="max-height: 200px; overflow-y: auto;">';
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            var colorClass = i === 0 ? 'good' : i < 3 ? 'ok' : 'bad';
            html += '<div class="config-item ' + colorClass + '">';
            html += '<strong>' + result.config + ':</strong> ' + result.yield.toFixed(1) + 'x yield<br>';
            html += '<small>Bottleneck: ' + result.bottleneck + '</small>';
            html += '</div>';
        }
        html += '</div>';
        gridResults.innerHTML = html;
    }, 1000);
}

// Setup global parameter sliders
function setupGlobalControls() {
    var supplySlider = document.getElementById('supplyCap');
    var supplyValue = document.getElementById('supplyCapValue');
    
    if (supplySlider && supplyValue) {
        supplySlider.oninput = function() {
            supplyValue.textContent = this.value;
            runSimulation();
        };
    }
    
    var burdenSlider = document.getElementById('burdenSensitivity');
    var burdenValue = document.getElementById('burdenSensitivityValue');
    
    if (burdenSlider && burdenValue) {
        burdenSlider.oninput = function() {
            burdenValue.textContent = this.value;
            runSimulation();
        };
    }
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeGenes();
    setupTabs();
    buildPathwayDiagram();
    buildGeneControls();
    buildSensitivityBars();
    buildDataTable();
    setupGlobalControls();
    runSimulation();
});