# VioFlux
Epigenetic flux simulator for violacein biosynthesis — TurbioHacks 2025 project.

## How to run

We provide two ways to explore VioFlux:

### Option A — Full simulator (Python/Streamlit)
This is the functional backend with CSV-driven parameters, soft-min bottleneck math, and penalties.

```bash
git clone https://github.com/aalxi/VioFlux.git
cd VioFlux
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd epi-sim
streamlit run app.py

Got it — thanks for pasting both. Now it’s crystal clear:

### What’s happening

* **`script.js`**:

  * All the math (yield changes, bottleneck, sensitivities) is hard-coded *in the browser*.
  * It never calls `fetch(...)` or hits an API.
  * It just runs simulation rules in JavaScript on the client side.

* **`app.py`** (Streamlit):

  * Separate, Python-based backend+UI.
  * Real math (CSV-driven modules, soft-min, penalties, etc.).
  * Judges run this with `streamlit run app.py`.

👉 So: these are **two independent implementations** of the same idea.

* The **frontend (`index.html + script.js`) is a self-contained mock** — judges can open it instantly, no backend required.
* The **Streamlit app is the actual backend+functional simulator** — requires Python, gives rigorous results.

---

### What to tell judges / put in README

````markdown
## How to run

We provide two ways to explore VioFlux:

### Option A — Full simulator (Python/Streamlit)
This is the functional backend with CSV-driven parameters, soft-min bottleneck math, and penalties.

```bash
git clone https://github.com/aalxi/VioFlux.git
cd VioFlux
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd epi-sim
streamlit run app.py
````

This opens a browser window with the Violacein simulator, yield panel, bottleneck display, sensitivity bars, and grid search.


### Option B — Static web interface (HTML/JS mock)

This is a polished concept UI. The simulation rules are simplified and run directly in the browser via JavaScript.

```bash
git clone https://github.com/aalxi/VioFlux.git
cd VioFlux/web-interface
# then double-click index.html, or open it in your browser
```

This interface looks like a production webapp, but it does not connect to the Python backend. It’s meant to illustrate the UI/UX vision.

```
