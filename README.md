# VioFlux — Epigenetic Tuning Simulator (Violacein)

Interactive, self-contained web app that models epigenetic tuning on the **violacein** pathway (VioA–E).  


---

## Quickstart

### Clone and open
```bash
git clone https://github.com/aalxi/VioFlux.git
cd VioFlux/web-interface
````

Now open the UI:

* **macOS:** `open index.html`
* **Windows (CMD):** `start index.html`
* **Linux:** `xdg-open index.html`
* Or just **double-click** `index.html`.

> Everything runs locally in your browser. Internet is not required.

---

## What you can do

* **Toggle per-gene epigenetic modules** (buttons):

  * `VPR_Activation` (activator)
  * `KRAB_Repression` (repressor)
  * `Methylation_Lock` (binary switch)
  * `Neutral` (no effect)
* **Set module “level”** (slider 0.00–1.00) for each gene.
* **See outputs update live:**

  * **Yield** (× relative units) and % change vs baseline
  * **Bottleneck** gene (if detected by rules)
  * **Gene sensitivity bars** (relative influence)
  * **Data view**: active genes, current supply cap, burden sensitivity, current yield
* **Run a sample grid search** (pre-computed examples) in the “Grid” panel.
* **Reset** to the neutral starting state.

---

## Pathway & modules (current defaults)

### Pathway (linear order)

`VioA → VioB → VioE → VioD → VioC`
Each step has a baseline activity and a burden weight:

* `baseline_k = 1.0` for all steps
* `burden_w = 1.0` except `VioC = 1.2`

### Module types (front-end model)

* **VPR\_Activation** (`type: activator`) — adds to yield proportionally to level
* **KRAB\_Repression** (`type: repressor`) — multiplies yield by a factor < 1 as level increases
* **Methylation\_Lock** (`type: binary`) — ON (≥0.5) gives a fixed boost; OFF gives none
* **Neutral** — no change

---

## Credits:

Backend/Mathematical modeling - Alexei Manuel

Frontend/UI and some Backend - Taha Zuberi
