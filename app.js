const state = {
  width: 17,
  height: 17,
  colorCount: 8,
  grid: [],
  brushColor: '#ff006e',
  sourcePixels: null, // scaled pixels from last image upload
};

const elements = {};

function init() {
  cacheElements();
  elements.colorCountValue.textContent = `${state.colorCount} colors`;
  bindEvents();
  seedGrid();
  renderGrid();
  updateJsonOutput();
}

document.addEventListener('DOMContentLoaded', init);

function cacheElements() {
  elements.widthInput = document.getElementById('widthInput');
  elements.heightInput = document.getElementById('heightInput');
  elements.colorCountInput = document.getElementById('colorCountInput');
  elements.colorCountValue = document.getElementById('colorCountValue');
  elements.uploadTrigger = document.getElementById('uploadTrigger');
  elements.imageInput = document.getElementById('imageInput');
  elements.jsonInput = document.getElementById('jsonInput');
  elements.importJsonBtn = document.getElementById('importJsonBtn');
  elements.brushColor = document.getElementById('brushColor');
  elements.fillAllBtn = document.getElementById('fillAllBtn');
  elements.clearGridBtn = document.getElementById('clearGridBtn');
  elements.matrixGrid = document.getElementById('matrixGrid');
  elements.paletteSwatches = document.getElementById('paletteSwatches');
  elements.jsonOutput = document.getElementById('jsonOutput');
  elements.exportJsonBtn = document.getElementById('exportJsonBtn');
  elements.copyJsonBtn = document.getElementById('copyJsonBtn');
  elements.statusMessage = document.getElementById('statusMessage');
}

function bindEvents() {
  elements.widthInput.addEventListener('change', () => handleResize());
  elements.heightInput.addEventListener('change', () => handleResize());
  elements.colorCountInput.addEventListener('input', handleColorCountChange);
  elements.uploadTrigger.addEventListener('click', () => elements.imageInput.click());
  elements.imageInput.addEventListener('change', handleImageUpload);
  elements.importJsonBtn.addEventListener('click', handleJsonImport);
  elements.brushColor.addEventListener('input', (e) => {
    state.brushColor = normalizeHex(e.target.value);
  });
  elements.fillAllBtn.addEventListener('click', fillEntireGrid);
  elements.clearGridBtn.addEventListener('click', clearGrid);
  elements.exportJsonBtn.addEventListener('click', exportJsonFile);
  elements.copyJsonBtn.addEventListener('click', copyJsonToClipboard);

  let painting = false;
  elements.matrixGrid.addEventListener('pointerdown', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell) return;
    painting = true;
    paintCellFromElement(cell);
    event.preventDefault();
  });
  elements.matrixGrid.addEventListener('pointerenter', (event) => {
    if (!painting) return;
    const cell = event.target.closest('.cell');
    if (cell) paintCellFromElement(cell);
  });
  window.addEventListener('pointerup', () => {
    painting = false;
  });
}

function seedGrid() {
  state.grid = Array.from({ length: state.height }, () =>
    Array.from({ length: state.width }, () => '#000000')
  );
}

function handleResize() {
  const newWidth = clamp(Number(elements.widthInput.value) || 1, 1, 128);
  const newHeight = clamp(Number(elements.heightInput.value) || 1, 1, 128);

  if (newWidth === state.width && newHeight === state.height) return;

  const newGrid = Array.from({ length: newHeight }, (_, y) =>
    Array.from({ length: newWidth }, (_, x) => state.grid[y]?.[x] ?? '#000000')
  );

  state.width = newWidth;
  state.height = newHeight;
  state.grid = newGrid;
  state.sourcePixels = null; // invalidate previous image sample

  renderGrid();
  showStatus(`Matrix resized to ${state.width}×${state.height}.`, 'success');
}

function handleColorCountChange(event) {
  state.colorCount = Number(event.target.value);
  elements.colorCountValue.textContent = `${state.colorCount} colors`;

  if (state.sourcePixels && state.sourcePixels.length === state.width * state.height) {
    applyPaletteToGrid(state.sourcePixels, state.colorCount);
    showStatus(`Re-quantized to ${state.colorCount} colors.`, 'success');
  }
}

function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      resizeGridToCurrentInputs();
      const sampled = sampleImageToPixels(img, state.width, state.height);
      state.sourcePixels = sampled;
      applyPaletteToGrid(sampled, state.colorCount);
      showStatus(`Loaded image (${file.name}) into ${state.width}×${state.height} grid.`, 'success');
      elements.imageInput.value = '';
    };
    img.onerror = () => showStatus('Failed to read the selected image.', 'error');
    img.src = reader.result;
  };
  reader.onerror = () => showStatus('Could not read the file.', 'error');
  reader.readAsDataURL(file);
}

function resizeGridToCurrentInputs() {
  const width = clamp(Number(elements.widthInput.value) || state.width, 1, 256);
  const height = clamp(Number(elements.heightInput.value) || state.height, 1, 256);
  elements.widthInput.value = width;
  elements.heightInput.value = height;

  if (width !== state.width || height !== state.height) {
    state.width = width;
    state.height = height;
    seedGrid();
    renderGrid();
  }
}

function sampleImageToPixels(image, targetWidth, targetHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) {
      pixels.push({ r: 0, g: 0, b: 0 });
    } else {
      pixels.push({ r, g, b });
    }
  }
  return pixels;
}

function applyPaletteToGrid(pixels, colorCount) {
  const palette = quantizeColors(pixels, colorCount);
  const assignments = assignPalette(pixels, palette);

  state.grid = Array.from({ length: state.height }, (_, y) =>
    Array.from({ length: state.width }, (_, x) =>
      rgbToHex(assignments[y * state.width + x])
    )
  );

  renderGrid();
  renderPalette(palette.filter(Boolean).map(rgbToHex));
}

function quantizeColors(pixels, colorCount) {
  const maxIterations = 12;
  const centers = initializeCenters(pixels, colorCount);
  const assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;

    for (let i = 0; i < pixels.length; i++) {
      const nearest = findNearestCenter(pixels[i], centers);
      if (assignments[i] !== nearest) {
        assignments[i] = nearest;
        moved = true;
      }
    }

    if (!moved) break;

    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (let i = 0; i < pixels.length; i++) {
      const idx = assignments[i];
      const px = pixels[i];
      sums[idx].r += px.r;
      sums[idx].g += px.g;
      sums[idx].b += px.b;
      sums[idx].count += 1;
    }

    for (let i = 0; i < centers.length; i++) {
      if (sums[i].count === 0) continue;
      centers[i] = {
        r: Math.round(sums[i].r / sums[i].count),
        g: Math.round(sums[i].g / sums[i].count),
        b: Math.round(sums[i].b / sums[i].count),
      };
    }
  }

  return centers;
}

function initializeCenters(pixels, colorCount) {
  const unique = [...new Set(pixels.map((p) => `${p.r}_${p.g}_${p.b}`))];
  if (unique.length <= colorCount) {
    return unique.map((key) => {
      const [r, g, b] = key.split('_').map(Number);
      return { r, g, b };
    });
  }

  const centers = [];
  const taken = new Set();
  while (centers.length < colorCount) {
    const idx = Math.floor(Math.random() * pixels.length);
    if (taken.has(idx)) continue;
    centers.push({ ...pixels[idx] });
    taken.add(idx);
  }
  return centers;
}

function findNearestCenter(pixel, centers) {
  let minDistance = Infinity;
  let chosen = 0;
  centers.forEach((center, index) => {
    const distance =
      (pixel.r - center.r) ** 2 +
      (pixel.g - center.g) ** 2 +
      (pixel.b - center.b) ** 2;
    if (distance < minDistance) {
      minDistance = distance;
      chosen = index;
    }
  });
  return chosen;
}

function assignPalette(pixels, palette) {
  return pixels.map((pixel) => palette[findNearestCenter(pixel, palette)]);
}

function renderGrid() {
  elements.matrixGrid.style.setProperty('--columns', state.width);
  elements.matrixGrid.innerHTML = '';

  const fragment = document.createDocumentFragment();
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = state.grid[y][x];
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      if (color) {
        cell.dataset.color = color;
        cell.style.setProperty('--cell-color', color);
        cell.title = `(${x}, ${y}) ${color}`;
      } else {
        cell.title = `(${x}, ${y}) empty`;
      }
      fragment.appendChild(cell);
    }
  }
  elements.matrixGrid.appendChild(fragment);

  renderPaletteFromGrid();
  updateJsonOutput();
}

function paintCellFromElement(cell) {
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const color = state.brushColor;
  state.grid[y][x] = color;
  cell.dataset.color = color;
  cell.style.setProperty('--cell-color', color);
  cell.title = `(${x}, ${y}) ${color}`;
  updateJsonOutput();
  renderPaletteFromGrid();
}

function fillEntireGrid() {
  state.grid = state.grid.map((row) => row.map(() => state.brushColor));
  renderGrid();
  showStatus('Filled the matrix with the active brush color.', 'success');
}

function clearGrid() {
  state.grid = state.grid.map((row) => row.map(() => '#000000'));
  renderGrid();
  showStatus('Cleared the matrix.', 'success');
}

function handleJsonImport() {
  const raw = elements.jsonInput.value.trim();
  if (!raw) {
    showStatus('Paste a JSON preset first.', 'error');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const segment = Array.isArray(parsed.seg) ? parsed.seg[0] : null;
    if (!segment) throw new Error('Preset is missing a "seg" array.');

    const matrixMeta = segment.o?.matrix;
    const width = Number(matrixMeta?.width) || state.width;
    const height = Number(matrixMeta?.height) || state.height;

    state.width = width;
    state.height = height;
    elements.widthInput.value = width;
    elements.heightInput.value = height;

    if (matrixMeta?.pixels) {
      state.grid = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) =>
          normalizeHex(matrixMeta.pixels?.[y]?.[x] ?? '#000000')
        )
      );
    } else if (Array.isArray(segment.i)) {
      seedGrid();
      for (let i = 0; i < segment.i.length; i += 2) {
        const ledIndex = Number(segment.i[i]);
        const color = normalizeHex(segment.i[i + 1] || '#000000');
        const { x, y } = indexToXY(ledIndex, state.width);
        if (y < state.height) {
          state.grid[y][x] = color;
        }
      }
    } else {
      throw new Error('Preset is missing both matrix pixels and per-LED colors.');
    }

    renderGrid();
    showStatus('Preset imported successfully.', 'success');
  } catch (error) {
    showStatus(`Import failed: ${error.message}`, 'error');
  }
}

function updateJsonOutput() {
  const preset = buildPreset();
  elements.jsonOutput.value = JSON.stringify(preset, null, 2);
}

function buildPreset() {
  const totalPixels = state.width * state.height;
  const ledPairs = [];
  const pixels = [];

  for (let y = 0; y < state.height; y++) {
    const row = [];
    for (let x = 0; x < state.width; x++) {
      const color = normalizeHex(state.grid[y][x] || '#000000');
      row.push(color);
      const index = xyToIndex(x, y, state.width);
      ledPairs.push(index, color);
    }
    pixels.push(row);
  }

  return {
    generator: 'WLED Pixel Art Generator',
    generatedAt: new Date().toISOString(),
    on: true,
    bri: 255,
    seg: [
      {
        start: 0,
        stop: totalPixels,
        grp: 1,
        spc: 0,
        of: 0,
        on: true,
        sel: true,
        fx: 0,
        sx: 128,
        ix: 128,
        pal: 0,
        i: ledPairs,
        o: {
          matrix: {
            width: state.width,
            height: state.height,
            order: 'row-major-top-left',
            pixels,
          },
        },
      },
    ],
  };
}

function exportJsonFile() {
  const blob = new Blob([elements.jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `wled-pixel-art-${state.width}x${state.height}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  showStatus('Preset downloaded.', 'success');
}

async function copyJsonToClipboard() {
  try {
    await navigator.clipboard.writeText(elements.jsonOutput.value);
    showStatus('JSON copied to clipboard.', 'success');
  } catch (error) {
    showStatus('Clipboard access was denied.', 'error');
  }
}

function renderPalette(hexColors = []) {
  elements.paletteSwatches.innerHTML = '';
  hexColors.filter(Boolean).forEach((color) => {
    const swatch = document.createElement('span');
    swatch.textContent = color;
    swatch.style.setProperty('--swatch-color', color);
    elements.paletteSwatches.appendChild(swatch);
  });
}

function renderPaletteFromGrid() {
  const colors = new Map();
  state.grid.flat().forEach((color) => {
    const hex = normalizeHex(color);
    colors.set(hex, (colors.get(hex) || 0) + 1);
  });
  const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]);
  renderPalette(sorted.slice(0, 16).map(([color]) => color));
}

function showStatus(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = type;
}

function normalizeHex(hex) {
  if (!hex) return '#000000';
  const value = hex.toString().trim();
  if (value.startsWith('#') && value.length === 7) return value.toUpperCase();
  const stripped = value.replace('#', '');
  if (stripped.length === 6) {
    return `#${stripped.toUpperCase()}`;
  }
  return '#000000';
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function xyToIndex(x, y, width) {
  return y * width + x;
}

function indexToXY(index, width) {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
