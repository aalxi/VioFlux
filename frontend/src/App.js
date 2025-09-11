import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  // State variables
  const [pathwayData, setPathwayData] = useState([]);
  const [availableModules, setAvailableModules] = useState([]);
  const [geneStates, setGeneStates] = useState({});
  const [simulationData, setSimulationData] = useState({
    yield: 1.0,
    bottleneck: 'None',
    sensitivities: []
  });
  const [activeTab, setActiveTab] = useState('pathways');
  const [supplyCap, setSupplyCap] = useState(2.0);
  const [burdenSensitivity, setBurdenSensitivity] = useState(0.05);
  const [gridResults, setGridResults] = useState([]);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Module types mapping
  const moduleTypes = {
    'CRISPRa_Ec': {
      type: 'activator',
      className: 'vpr-activation',
      displayName: 'CRISPRa'
    },
    'CRISPRi_dCas9': {
      type: 'repressor',
      className: 'krab-repression',
      displayName: 'CRISPRi'
    },
    'Methylation': {
      type: 'binary',
      className: 'methylation-lock',
      displayName: 'Methylation'
    },
    'neutral': {
      type: 'neutral',
      className: 'neutral',
      displayName: 'Neutral'
    }
  };

  // API helper function
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const config = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  };

  // Load data from backend
  const loadData = async () => {
    try {
      const [pathwayResponse, modulesResponse] = await Promise.all([
        apiCall('/pathway'),
        apiCall('/modules')
      ]);
      
      setPathwayData(pathwayResponse.pathway_data);
      setAvailableModules(modulesResponse.modules);
      setIsBackendConnected(true);
      
      // Initialize gene states
      const initialStates = {};
      pathwayResponse.pathway_data.forEach(gene => {
        initialStates[gene.gene] = {
          module: modulesResponse.modules.length > 0 ? modulesResponse.modules[0].name : 'CRISPRa_Ec',
          level: 0.5
        };
      });
      setGeneStates(initialStates);
      
      console.log('Loaded pathway data:', pathwayResponse.pathway_data);
      console.log('Loaded module data:', modulesResponse.modules);
      
      return true;
    } catch (error) {
      console.error('Failed to load data from backend:', error);
      setIsBackendConnected(false);
      return false;
    }
  };

  // Run simulation
  const runSimulation = async () => {
    if (pathwayData.length === 0 || !isBackendConnected) {
      console.error('No pathway data available - cannot run simulation');
      return;
    }

    try {
      const modules = [];
      const levels = [];

      pathwayData.forEach(gene => {
        const state = geneStates[gene.gene];
        modules.push(state.module);
        levels.push(state.level);
      });

      const requestData = {
        modules: modules,
        levels: levels,
        supply_cap: supplyCap,
        gamma_burden: burdenSensitivity,
        p_softmin: 6.0
      };

      const result = await apiCall('/simulate', 'POST', requestData);

      if (result && !result.error) {
        setSimulationData({
          yield: result.yield,
          bottleneck: result.flux.bottleneck_gene,
          sensitivities: result.sensitivities
        });

        if (result.notes && result.notes.length > 0) {
          console.log('Simulation notes:', result.notes);
        }
      } else {
        console.error('Simulation error:', result ? result.error : 'No response');
      }

    } catch (error) {
      console.error('Simulation API call failed:', error);
      setSimulationData({
        yield: 0,
        bottleneck: 'Backend unavailable',
        sensitivities: []
      });
    }
  };

  // Grid search
  const runGridSearch = async () => {
    if (!isBackendConnected) return;

    try {
      const requestData = {
        supply_cap: supplyCap,
        gamma_burden: burdenSensitivity,
        p_softmin: 6.0
      };

      const result = await apiCall('/grid_search', 'POST', requestData);

      if (result && result.results) {
        setGridResults(result.results);
      } else {
        throw new Error('No results returned from grid search');
      }

    } catch (error) {
      console.error('Grid search API call failed:', error);
      setGridResults([]);
    }
  };

  // Gene control functions
  const setGeneModule = (geneName, moduleType) => {
    setGeneStates(prev => ({
      ...prev,
      [geneName]: {
        ...prev[geneName],
        module: moduleType
      }
    }));
  };

  const setGeneLevel = (geneName, level) => {
    setGeneStates(prev => ({
      ...prev,
      [geneName]: {
        ...prev[geneName],
        level: level
      }
    }));
  };

  const cycleGeneModule = (geneName) => {
    if (!geneStates[geneName]) return;

    const currentModule = geneStates[geneName].module;
    const moduleOptions = ['neutral'].concat(availableModules.map(m => m.name));
    const currentIndex = moduleOptions.indexOf(currentModule);
    const nextModule = moduleOptions[(currentIndex + 1) % moduleOptions.length];

    setGeneModule(geneName, nextModule);
  };

  const resetAll = () => {
    const defaultModule = availableModules.length > 0 ? availableModules[0].name : 'CRISPRa_Ec';
    
    const resetStates = {};
    pathwayData.forEach(gene => {
      resetStates[gene.gene] = {
        module: defaultModule,
        level: 0.5
      };
    });
    setGeneStates(resetStates);
  };

  // Helper functions
  const getActiveGeneCount = () => {
    return Object.values(geneStates).filter(state => state.module !== 'neutral').length;
  };

  const updateYieldDisplay = (multiplier) => {
    const percentage = Math.round((multiplier - 1) * 100);
    const sign = percentage >= 0 ? '+' : '';
    return {
      value: multiplier.toFixed(1) + 'x',
      change: sign + percentage + '%',
      color: percentage >= 0 ? '#27ae60' : '#e74c3c',
      barWidth: Math.max(5, multiplier * 100) + '%'
    };
  };

  // Effects
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (pathwayData.length > 0 && Object.keys(geneStates).length > 0) {
      runSimulation();
    }
  }, [geneStates, supplyCap, burdenSensitivity, pathwayData]);

  // Render functions
  const renderPathwayDiagram = () => {
    if (!isBackendConnected) {
      return <div className="error-message">Backend API not available<br/>Please start the Flask server</div>;
    }

    return (
      <div className="pathway-box">
        {pathwayData.map((gene, index) => (
          <React.Fragment key={gene.gene}>
            <div className="gene-node" onClick={() => cycleGeneModule(gene.gene)}>
              <div className={`gene-circle ${geneStates[gene.gene] ? moduleTypes[geneStates[gene.gene].module]?.className || 'neutral' : 'neutral'}`}>
                {gene.gene}
              </div>
              <div className="gene-label">{gene.gene}</div>
            </div>
            {index < pathwayData.length - 1 && (
              <div className="pathway-arrow">→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderGeneControls = () => {
    if (!isBackendConnected) {
      return <div className="error-message">Backend not connected</div>;
    }

    return pathwayData.map(gene => {
      const moduleOptions = ['neutral'].concat(availableModules.map(m => m.name));
      const currentState = geneStates[gene.gene] || { module: 'neutral', level: 0.5 };

      return (
        <div key={gene.gene} className="control-group">
          <label className="control-label">{gene.gene}</label>
          <div className="control-buttons">
            {moduleOptions.map(moduleName => {
              const moduleConfig = moduleTypes[moduleName];
              if (!moduleConfig) return null;

              return (
                <button
                  key={moduleName}
                  className={`control-btn ${currentState.module === moduleName ? 'active' : ''}`}
                  onClick={() => setGeneModule(gene.gene, moduleName)}
                >
                  {moduleConfig.displayName}
                </button>
              );
            })}
          </div>
          <input
            type="range"
            className="slider"
            min="0"
            max="1"
            step="0.05"
            value={currentState.level}
            onChange={(e) => setGeneLevel(gene.gene, parseFloat(e.target.value))}
          />
          <span>{currentState.level.toFixed(2)}</span>
        </div>
      );
    });
  };

  const renderSensitivityBars = () => {
    if (simulationData.sensitivities.length === 0) {
      return <div className="error-message">No sensitivity data - run simulation</div>;
    }

    return simulationData.sensitivities.map(([gene, value]) => (
      <div key={gene} className="sensitivity-item">
        <div className="sensitivity-label">{gene}</div>
        <div className="sensitivity-bar">
          <div className="sensitivity-fill" style={{ width: (value * 100) + '%' }}></div>
        </div>
        <div className="sensitivity-value">{value.toFixed(2)}</div>
      </div>
    ));
  };

  const renderDataTable = () => {
    if (!isBackendConnected) {
      return (
        <tr>
          <td colSpan={4}>
            <div className="error-message">Backend not connected - no data available</div>
          </td>
        </tr>
      );
    }

    return pathwayData.map(gene => (
      <tr key={gene.gene}>
        <td style={{ fontWeight: 'bold', color: '#3498db' }}>{gene.gene}</td>
        <td>{gene.step_order}</td>
        <td>{gene.baseline_k.toFixed(1)}</td>
        <td>{gene.burden_w.toFixed(1)}</td>
      </tr>
    ));
  };

  const renderGridResults = () => {
    if (gridResults.length === 0) {
      return <p style={{ color: '#3498db' }}>Click "Run Grid Search" to see results</p>;
    }

    return (
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {gridResults.map((result, index) => {
          const colorClass = index === 0 ? 'good' : index < 3 ? 'ok' : 'bad';
          return (
            <div key={index} className={`config-item ${colorClass}`}>
              <strong>{result.config}:</strong> {result.Yield.toFixed(1)}x yield<br/>
              <small>Bottleneck: {result.Bottleneck}</small>
            </div>
          );
        })}
      </div>
    );
  };

  const yieldDisplay = updateYieldDisplay(simulationData.yield);

  return (
    <div className="App">
      <nav className="navbar">
        <div className="logo">VioFlux</div>
        <div className="nav-links">
          <div 
            className={`nav-link ${activeTab === 'pathways' ? 'active' : ''}`}
            onClick={() => setActiveTab('pathways')}
          >
            Pathways
          </div>
          <div 
            className={`nav-link ${activeTab === 'experiments' ? 'active' : ''}`}
            onClick={() => setActiveTab('experiments')}
          >
            Experiments
          </div>
          <div 
            className={`nav-link ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data
          </div>
        </div>
      </nav>

      <div className="container">
        {/* Pathways Tab */}
        {activeTab === 'pathways' && (
          <div className="tab-content active">
            <div className="header">
              <h1 className="title">VioFlux Pathway Simulator</h1>
              <p className="subtitle">Violacein biosynthesis optimization tool</p>
            </div>

            <div className="main-content">
              <div className="left-panel">
                <div className="card">
                  <h3>Pathway Diagram</h3>
                  {renderPathwayDiagram()}
                  <div className="legend">
                    <div className="legend-item">
                      <div className="legend-dot green"></div>
                      CRISPRa Activation
                    </div>
                    <div className="legend-item">
                      <div className="legend-dot red"></div>
                      CRISPRi Repression
                    </div>
                    <div className="legend-item">
                      <div className="legend-dot purple"></div>
                      Methylation Lock
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>Gene Sensitivity</h3>
                  <div className="sensitivity-list">
                    {renderSensitivityBars()}
                  </div>
                </div>
              </div>

              <div className="right-panel">
                <div className="card yield-card">
                  <h3>Yield Results</h3>
                  <div className="yield-number">{isBackendConnected ? yieldDisplay.value : 'N/A'}</div>
                  <div className="yield-change" style={{ color: yieldDisplay.color }}>
                    {isBackendConnected ? yieldDisplay.change : '+0%'}
                  </div>
                  <div className="yield-bars">
                    <div className="bar-section">
                      <div className="bar-label">Baseline</div>
                      <div className="bar-container">
                        <div className="bar-fill baseline" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div className="bar-section">
                      <div className="bar-label">Current</div>
                      <div className="bar-container">
                        <div className="bar-fill current" style={{ width: yieldDisplay.barWidth }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="bottleneck-box">
                    <h4>Bottleneck Gene:</h4>
                    <p>{isBackendConnected ? simulationData.bottleneck : 'Backend unavailable'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Experiments Tab */}
        {activeTab === 'experiments' && (
          <div className="tab-content active">
            <div className="header">
              <h1 className="title">Experiment Results</h1>
              <p className="subtitle">Previous runs and optimization data</p>
            </div>
            <div className="experiments-grid">
              <div className="card">
                <h3>Quick Grid Search</h3>
                <p style={{ marginBottom: '20px' }}>Test all combinations of OFF/MED/ON for each gene</p>
                <button onClick={runGridSearch} className="run-button">Run Grid Search</button>
                <div className="results-box">
                  {renderGridResults()}
                </div>
              </div>

              <div className="card">
                <h3>Best Configurations</h3>
                <div className="config-list">
                  <div className="config-item good"><strong>Config A:</strong> VioE + VioA activation → 2.3x yield</div>
                  <div className="config-item ok"><strong>Config B:</strong> Balanced expression → 1.8x yield</div>
                  <div className="config-item bad"><strong>Config C:</strong> VioE repressed → 0.4x yield</div>
                </div>
              </div>

              <div className="card">
                <h3>Parameter Effects</h3>
                <p style={{ marginBottom: '20px' }}>How different settings affect the final yield</p>
                <div className="param-effects">
                  <div>Supply Cap: Higher = better (up to 2.5)</div>
                  <div>Burden: Lower = better performance</div>
                  <div>VioE critical: Don't repress below 0.3</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="tab-content active">
            <div className="header">
              <h1 className="title">Pathway Data</h1>
              <p className="subtitle">Gene information and current settings</p>
            </div>
            <div className="data-section">
              <div className="card">
                <h3>Gene Data</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Gene</th>
                      <th>Order</th>
                      <th>Baseline</th>
                      <th>Burden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderDataTable()}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3>Current Settings</h3>
                <div className="settings-grid">
                  <div className="setting-item">
                    <strong>Supply Cap:</strong> <span>{supplyCap}</span>
                  </div>
                  <div className="setting-item">
                    <strong>Burden Factor:</strong> <span>{burdenSensitivity}</span>
                  </div>
                  <div className="setting-item">
                    <strong>Active Genes:</strong> <span>{getActiveGeneCount()}/{pathwayData.length}</span>
                  </div>
                  <div className="setting-item">
                    <strong>Current Yield:</strong> <span>{yieldDisplay.value}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <div className="controls-panel">
        <h3>Gene Controls</h3>
        <div>
          {renderGeneControls()}
        </div>
        
        <div className="control-section">
          <label>Supply Cap</label>
          <input
            type="range"
            className="slider"
            min="0.5"
            max="3.0"
            step="0.1"
            value={supplyCap}
            onChange={(e) => setSupplyCap(parseFloat(e.target.value))}
          />
          <span>{supplyCap}</span>
        </div>
        
        <div className="control-section">
          <label>Burden Sensitivity</label>
          <input
            type="range"
            className="slider"
            min="0.0"
            max="0.15"
            step="0.01"
            value={burdenSensitivity}
            onChange={(e) => setBurdenSensitivity(parseFloat(e.target.value))}
          />
          <span>{burdenSensitivity}</span>
        </div>
        
        <button onClick={resetAll} className="reset-button">Reset All</button>
      </div>
    </div>
  );
}

export default App;