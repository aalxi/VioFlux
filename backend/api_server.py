from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
from pathlib import Path
import math

# Add the project root to Python path so we can import from other directories
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from data_io import load_pathway, load_modules
from sim_core import simulate_yield

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Load data once at startup
pathway_df = load_pathway()
modules_df = load_modules()

GENES = pathway_df["gene"].tolist()
BASE_K = pathway_df["baseline_k"].to_numpy(float)
BURDEN_W = pathway_df["burden_w"].to_numpy(float)

MODULE_NAMES = modules_df.index.tolist()
MODULE_ROWS = {m: modules_df.loc[m].to_dict() for m in MODULE_NAMES}

def clean_json(obj):
    """Recursively replace NaN/inf values with None so JSON is valid."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_json(x) for x in obj]
    return obj

@app.route('/api/pathway', methods=['GET'])
def get_pathway():
    """Get pathway data (genes, baseline values, etc.)"""
    return jsonify({
        'genes': GENES,
        'pathway_data': pathway_df.to_dict('records'),
        'baseline_k': BASE_K.tolist(),
        'burden_w': BURDEN_W.tolist()
    })

@app.route('/api/modules', methods=['GET'])
def get_modules():
    """Get available epigenetic modules"""
    modules_list = []
    for module_name in MODULE_NAMES:
        module_data = MODULE_ROWS[module_name].copy()
        module_data['name'] = module_name
        modules_list.append(clean_json(module_data))  # clean before returning
    
    return jsonify({
        'modules': modules_list,
        'module_names': MODULE_NAMES
    })

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Run simulation with given gene configurations"""
    data = request.json
    
    # Extract parameters from request
    chosen_modules = data.get('modules', ['CRISPRa_Ec'] * len(GENES))
    levels = data.get('levels', [0.5] * len(GENES))
    supply_cap = float(data.get('supply_cap', 2.0))
    gamma_burden = float(data.get('gamma_burden', 0.05))
    p_softmin = float(data.get('p_softmin', 6.0))
    
    # Ensure we have the right number of modules and levels
    if len(chosen_modules) != len(GENES):
        chosen_modules = ['CRISPRa_Ec'] * len(GENES)
    if len(levels) != len(GENES):
        levels = [0.5] * len(GENES)
    
    # Run the simulation
    try:
        result = simulate_yield(
            genes=GENES,
            baseline_k=BASE_K,
            burden_w=BURDEN_W,
            module_rows=MODULE_ROWS,
            chosen_modules=chosen_modules,
            levels=levels,
            supply_cap=supply_cap,
            p_softmin=p_softmin,
            gamma_burden=gamma_burden
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/grid_search', methods=['POST'])
def grid_search():
    """Run a grid search with OFF/MED/ON levels"""
    data = request.json
    supply_cap = float(data.get('supply_cap', 2.0))
    gamma_burden = float(data.get('gamma_burden', 0.05))
    p_softmin = float(data.get('p_softmin', 6.0))
    
    levels = [0.05, 0.5, 1.0]  # OFF, MED, ON
    states = []
    
    # Use a default module (you can make this configurable)
    default_module = 'CRISPRa_Ec' if 'CRISPRa_Ec' in MODULE_NAMES else MODULE_NAMES[0]
    
    try:
        # Brute force small grid (3^5 = 243 combinations)
        for a in levels:
            for b in levels:
                for e in levels:
                    for d in levels:
                        for c in levels:
                            lvls = [a, b, e, d, c]
                            mods = [default_module] * 5
                            
                            res = simulate_yield(
                                GENES, BASE_K, BURDEN_W, MODULE_ROWS, 
                                mods, lvls, supply_cap, p_softmin, gamma_burden
                            )
                            
                            states.append({
                                "VioA": a, "VioB": b, "VioE": e, 
                                "VioD": d, "VioC": c,
                                "Yield": res["yield"],
                                "Bottleneck": res["flux"]["bottleneck_gene"],
                                "config": f"A:{a:.2f} B:{b:.2f} E:{e:.2f} D:{d:.2f} C:{c:.2f}"
                            })
        
        # Sort by yield (descending)
        states.sort(key=lambda x: x["Yield"], reverse=True)
        
        return jsonify({
            'results': states[:20],  # Return top 20 results
            'total_combinations': len(states)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'VioFlux API is running'})

if __name__ == '__main__':
    print("Starting VioFlux API server...")
    print(f"Loaded {len(GENES)} genes: {GENES}")
    print(f"Available modules: {MODULE_NAMES}")
    app.run(debug=True, port=5000, host='127.0.0.1')
