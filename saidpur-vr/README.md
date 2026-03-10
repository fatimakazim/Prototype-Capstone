# Saidpur — A Partition Memory
## WebXR Project Scaffold

An immersive VR micro-site exploring how Partition-era displacement and religious erasure
are embedded in Saidpur Village's architecture and landscape.

---

## Quick Start — Running Locally

### Prerequisites
- Node.js v16+ (no npm packages required for the dev server)
- A modern browser (Chrome / Firefox / Edge)
- Optional: Meta Quest 2 headset + Meta Quest Browser

### Steps

```bash
# 1. Clone or download the project folder
cd saidpur-vr

# 2. Start the local server (no npm install needed)
node server.js

# 3. Open in browser
# → http://localhost:3000
```

> ⚠️ **Do not open HTML files directly** with `file://`. A-Frame's GLB loader
> requires HTTP headers. Always use `node server.js`.

### VR Mode (Quest 2)
1. Connect Quest 2 to the same Wi-Fi network as your computer
2. Open Meta Quest Browser on the headset
3. Navigate to `http://YOUR_LOCAL_IP:3000` (find your IP with `ipconfig` or `ifconfig`)
4. Tap the VR headset icon in A-Frame to enter immersive mode

---

## Project Structure

```
saidpur-vr/
│
├── index.html                    ← Landing page
├── server.js                     ← Local dev server (run this)
│
├── scenes/
│   ├── briefing-scene.html       ← Historical context + A-Frame chamber
│   ├── map-table-scene.html      ← VR map room with teleport hotspots
│   ├── saidpur-village-scene.html← Village GLB exploration
│   └── reflection-scene.html     ← Quiet closing space
│
├── visualizations/
│   ├── migration-map.html        ← D3 animated migration arc map
│   ├── migration-map.js          ← D3 helper utilities
│   ├── timeline-visualization.html ← Interactive 1857–1950 timeline
│   └── timeline-visualization.js   ← Timeline helper utilities
│
├── components/                   ← Custom A-Frame components
│   ├── thumbstick-locomotion.js  ← Left stick walk (Quest 2)
│   ├── snap-turn.js              ← Right stick 45° snap-turn
│   ├── proximity-trigger.js      ← Audio testimony on approach
│   ├── narrative-hotspot.js      ← Floating info panels
│   ├── historical-overlay.js     ← Archival image on grip press
│   ├── partition-particles.js    ← 80k particle migration system
│   └── main-map-table.js         ← Map table scene controller
│
├── data/
│   ├── migration-data.json       ← Population flow data
│   ├── timeline-data.json        ← Historical events 1857–1950
│   └── testimony-data.json       ← Building metadata + testimony refs
│
├── assets/
│   ├── models/
│   │   └── Model.glb             ← ⚠️ ADD YOUR GLB HERE (case-sensitive!)
│   ├── images/
│   │   ├── placeholder-sky.jpg
│   │   ├── placeholder-archive-01.jpg
│   │   └── placeholder-archive-02.jpg
│   └── audio/
│       ├── testimony-ram-kund.mp3
│       ├── testimony-haveli.mp3
│       └── testimony-mosque.mp3
│
├── styles/
│   └── global.css
│
└── data-scripts/
    └── generate-placeholders.js  ← Generates placeholder images
```

---

## Replacing Placeholder Content

### 1. GLB Village Model
Place your model in `assets/models/` with the **exact** filename shown in the HTML:
```html
<a-asset-item id="village-model" src="../assets/models/Model.glb">
```
> ⚠️ GitHub Pages is Linux — **case sensitive**. `Model.glb` ≠ `model.glb`.
> Use `gltf-transform` to compress before deploying:
> ```bash
> npx @gltf-transform/cli optimize Model.glb Model.glb --texture-compress webp
> ```

### 2. Sky Texture (360° Photo)
Replace `assets/images/placeholder-sky.jpg` with a real equirectangular JPEG (2048×1024 minimum).
Then uncomment the sky line in `saidpur-village-scene.html`:
```html
<!-- Change from: -->
<a-sky color="#d4a870" ...>
<!-- To: -->
<a-sky src="#sky-tex" rotation="0 -110 0"></a-sky>
```

### 3. Audio Testimonies
Place `.mp3` files in `assets/audio/`:
```
assets/audio/testimony-ram-kund.mp3
assets/audio/testimony-haveli.mp3
assets/audio/testimony-mosque.mp3
```
> Source: The 1947 Partition Archive — www.1947partitionarchive.org
> Always get permission and credit sources.

### 4. Archival Photographs
Replace `assets/images/placeholder-archive-01.jpg` and `02.jpg` with real
CC-licensed historical images from Wikimedia Commons:
```
https://commons.wikimedia.org/wiki/Category:Partition_of_India
```

### 5. Historical Data
Edit the JSON files in `data/`:

**`migration-data.json`** — Update `svgX`/`svgY` coordinates to match real
geographic positions once you integrate a proper map projection.

**`timeline-data.json`** — Add `wikimediaImage` URLs by fetching from the
Wikimedia Commons API (see `components/` for API fetch examples).

**`testimony-data.json`** — Replace all `PLACEHOLDER` entries with verified
historical content. Add `speaker`, `credit`, and `audioFile` for each building.

### 6. Survivor Quotes (Reflection Scene)
Edit the `<a-text>` elements in `scenes/reflection-scene.html`:
```html
<a-text value="YOUR REAL SURVIVOR QUOTE HERE" ...>
```

---

## Adding Real Historical Data

### Wikimedia Commons API
```javascript
async function fetchArchivalImage(searchTerm) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srnamespace=6&format=json&origin=*&srlimit=5`;
  const data = await fetch(url).then(r => r.json());
  return data.query.search.map(item => ({
    title: item.title,
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(item.title.replace('File:',''))}?width=800`
  }));
}
// Usage:
fetchArchivalImage('1947 Partition Punjab refugees').then(console.log);
```

### The 1947 Partition Archive
Visit www.1947partitionarchive.org for oral history testimonies.
For educational projects, contact them directly for embed/licensing.

### David Rumsey Map Collection (historical maps)
```
https://www.davidrumsey.com/luna/servlet/iiif/RUMSEY~8~1~...
```
Use as a Mapbox GL JS raster source or as a canvas texture on an A-Frame plane.

---

## Deploying to GitHub Pages

```bash
# In your repo root:
git add .
git commit -m "add: Saidpur VR scaffold"
git push origin main
```

Then in GitHub → Settings → Pages → Source: `main` branch, `/` (root).

> ⚠️ **Case sensitivity reminder**: After deploying, test each asset URL directly:
> `https://yourusername.github.io/yourrepo/assets/models/Model.glb`
> If you get 404, check file capitalisation.

---

## Performance Tips

| Issue | Fix |
|---|---|
| GLB too large | Run `npx @gltf-transform/cli optimize` + Draco compression |
| Textures slow | Convert to WebP, max 1024×1024 for mobile VR |
| Low FPS on Quest | Set `foveationLevel: 3` in `<a-scene renderer="">` |
| Asset timeout | Increase `<a-assets timeout="30000">` |
| Particles laggy | Reduce `count` in `partition-particles` schema |

---

## Controller Map (Quest 2)

| Input | Action |
|---|---|
| Left thumbstick | Walk (thumbstick-locomotion) |
| Right thumbstick | Snap turn 45° |
| Left trigger | Laser pointer |
| Right trigger | Select / click |
| Right grip | Toggle historical photo overlay |
| Both grips (2s) | Return to map (implement in main-map-table.js) |

---

## License & Ethics

This project deals with real historical trauma. When replacing placeholders:
- **Verify** all historical claims against primary sources
- **Credit** oral history archives properly
- **Get permission** before using testimony recordings
- **Consult** with communities affected by Partition where possible
- Use only **CC-licensed** archival images

---

*Built with A-Frame 1.4.2, D3.js v7, Three.js, and care.*
