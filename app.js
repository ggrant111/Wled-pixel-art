const state = {
  width: 17,
  height: 17,
  paletteSize: 8,
  serpentine: true,
  pixelColors: [],
  pixelPaletteIndexes: [],
  palette: [],
  exportCache: "",
  selectedColorKey: null,
  selectedColor: null,
  paintMode: false,
  paintColor: [255, 0, 0],
  paintPaletteIndex: 0,
  touchTimerId: null,
  touchLongPressTriggered: false
};

const dom = {
  matrixWidth: document.getElementById("matrixWidth"),
  matrixHeight: document.getElementById("matrixHeight"),
  colorCount: document.getElementById("colorCount"),
  colorCountValue: document.getElementById("colorCountValue"),
  serpentineToggle: document.getElementById("serpentineOrder"),
  resetGrid: document.getElementById("resetGrid"),
  imageInput: document.getElementById("imageInput"),
  jsonInput: document.getElementById("jsonInput"),
  loadJson: document.getElementById("loadJson"),
  sampleJson: document.getElementById("sampleJson"),
  previewGrid: document.getElementById("preview-grid"),
  resolutionLabel: document.getElementById("resolutionLabel"),
  paletteControls: document.getElementById("paletteControls"),
  paletteSummary: document.getElementById("paletteSummary"),
  selectionCount: document.getElementById("selectionCount"),
  selectionPrompt: document.getElementById("selectionPrompt"),
  selectionDetails: document.getElementById("selectionDetails"),
  selectionSwatch: document.getElementById("selectionSwatch"),
  selectionHex: document.getElementById("selectionHex"),
  selectionPixels: document.getElementById("selectionPixels"),
  paletteTarget: document.getElementById("paletteTarget"),
  applyPaletteReplace: document.getElementById("applyPaletteReplace"),
  customColor: document.getElementById("customColor"),
  applyCustomReplace: document.getElementById("applyCustomReplace"),
  paintPaletteTarget: document.getElementById("paintPaletteTarget"),
  paintCustomColor: document.getElementById("paintCustomColor"),
  setPaintCustom: document.getElementById("setPaintCustom"),
  togglePaintMode: document.getElementById("togglePaintMode"),
  paintSwatch: document.getElementById("paintSwatch"),
  paintHex: document.getElementById("paintHex"),
  statusArea: document.getElementById("statusArea"),
  generateJson: document.getElementById("generateJson"),
  downloadJson: document.getElementById("downloadJson"),
  exportOutput: document.getElementById("exportOutput"),
  workCanvas: document.getElementById("workCanvas")
};

const SAMPLE_PRESET = JSON.stringify(
  {
    name: "Sample 8-bit Heart",
    on: true,
    bri: 200,
    mainseg: 0,
    meta: {
      generator: "sample",
      matrix: { width: 17, height: 17, serpentine: true }
    },
    palette: [
      [8, 10, 22],
      [219, 39, 119],
      [244, 114, 182],
      [252, 231, 243]
    ],
    pixels: [
      0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,1,2,1,0,0,0,0,0,0,0,
      0,0,0,0,0,0,1,2,3,2,1,0,0,0,0,0,0,
      0,0,0,0,0,1,2,3,3,3,2,1,0,0,0,0,0,
      0,0,0,0,1,2,3,3,3,3,3,2,1,0,0,0,0,
      0,0,0,1,2,3,3,3,3,3,3,3,2,1,0,0,0,
      0,0,1,2,3,3,3,3,3,3,3,3,3,2,1,0,0,
      0,0,1,2,3,3,3,3,3,3,3,3,3,2,1,0,0,
      0,0,0,1,2,3,3,3,3,3,3,3,2,1,0,0,0,
      0,0,0,0,1,2,3,3,3,3,3,2,1,0,0,0,0,
      0,0,0,0,0,1,2,3,3,3,2,1,0,0,0,0,0,
      0,0,0,0,0,0,1,2,3,2,1,0,0,0,0,0,0,
      0,0,0,0,0,0,0,1,2,1,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
    ]
  },
  null,
  2
);

document.addEventListener("DOMContentLoaded", init);

function init() {
  initBlankGrid();
  wireEvents();
  renderAll();
  updateSelectionUi();
  updatePaintUi();
  setStatus("Ready. Adjust settings or import an image to get started.");
}

function initBlankGrid() {
  const total = state.width * state.height;
  state.pixelColors = Array.from({ length: total }, () => [2, 6, 16]);
  state.palette = [[2, 6, 16]];
  state.pixelPaletteIndexes = Array(total).fill(0);
  state.paintPaletteIndex = 0;
  state.paintColor = cloneColor(state.palette[0]);
  state.paintMode = false;
  clearSelection();
}

function wireEvents() {
  dom.matrixWidth.addEventListener("change", () => {
    const value = clamp(parseInt(dom.matrixWidth.value, 10) || 1, 1, 64);
    dom.matrixWidth.value = value;
    resizeMatrix(value, state.height);
  });

  dom.matrixHeight.addEventListener("change", () => {
    const value = clamp(parseInt(dom.matrixHeight.value, 10) || 1, 1, 64);
    dom.matrixHeight.value = value;
    resizeMatrix(state.width, value);
  });

  dom.colorCount.addEventListener("input", () => {
    const value = clamp(parseInt(dom.colorCount.value, 10) || 2, 2, 32);
    state.paletteSize = value;
    dom.colorCountValue.textContent = `${value} colors`;
    rebuildPaletteFromPixels();
    markExportDirty();
    renderAll();
  });

  dom.serpentineToggle.addEventListener("change", () => {
    state.serpentine = dom.serpentineToggle.checked;
    markExportDirty();
    renderGrid();
  });

  dom.resetGrid.addEventListener("click", () => {
    initBlankGrid();
    rebuildPaletteFromPixels();
    renderAll();
    setStatus("Grid reset to blank state.");
  });

  dom.imageInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImageFile(file);
    dom.imageInput.value = "";
  });

  dom.loadJson.addEventListener("click", () => {
    const raw = dom.jsonInput.value.trim();
    if (!raw) {
      setStatus("Paste a JSON payload before loading.", "warn");
      return;
    }
    loadPresetFromJson(raw);
  });

  dom.sampleJson.addEventListener("click", () => {
    dom.jsonInput.value = SAMPLE_PRESET;
    loadPresetFromJson(SAMPLE_PRESET);
  });

  dom.generateJson.addEventListener("click", () => {
    const json = buildWledPresetJson();
    dom.exportOutput.value = json;
    dom.downloadJson.disabled = false;
    setStatus("Preset JSON generated. Download or copy it into presets.json.");
  });

  dom.downloadJson.addEventListener("click", () => {
    if (!dom.exportOutput.value) return;
    downloadJson(dom.exportOutput.value);
  });

  dom.applyPaletteReplace.addEventListener("click", replaceColorWithPalette);
  dom.applyCustomReplace.addEventListener("click", replaceColorWithCustom);
  if (dom.paintPaletteTarget) {
    dom.paintPaletteTarget.addEventListener("change", () => {
      setPaintColorFromPalette(Number(dom.paintPaletteTarget.value));
    });
  }
  if (dom.setPaintCustom) {
    dom.setPaintCustom.addEventListener("click", () => {
      setPaintColorFromCustom(dom.paintCustomColor.value);
    });
  }
  if (dom.togglePaintMode) {
    dom.togglePaintMode.addEventListener("click", togglePaintMode);
  }
}

async function handleImageFile(file) {
  try {
    const imageSource = await decodeImageFile(file);
    const pixels = sampleImageToPixels(imageSource, state.width, state.height);
    if (typeof imageSource.close === "function") {
      imageSource.close();
    }
    applyPixels(pixels);
    setStatus(`Loaded ${file.name} and reduced to ${state.width}×${state.height}.`);
  } catch (error) {
    console.error(error);
    setStatus("Failed to decode image. Try a different file.", "error");
  }
}

function sampleImageToPixels(imageSource, targetWidth, targetHeight) {
  const canvas = dom.workCanvas;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);
  const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixels;
}

function applyPixels(pixels) {
  if (!pixels.length) return;
  clearSelection();
  state.pixelColors = pixels.map(cloneColor);
  rebuildPaletteFromPixels();
  markExportDirty();
  renderAll();
}

function rebuildPaletteFromPixels() {
  if (!state.pixelColors.length) return;
  const { palette, assignments } = quantizeColors(state.pixelColors, clamp(state.paletteSize, 2, 32));
  state.palette = palette;
  state.pixelPaletteIndexes = assignments.length
    ? assignments
    : new Array(state.pixelColors.length).fill(0);
  state.pixelColors = state.pixelPaletteIndexes.map((idx) => palette[idx] ?? [0, 0, 0]);
}

function quantizeColors(pixels, targetCount) {
  if (!pixels.length) {
    return { palette: [[0, 0, 0]], assignments: [] };
  }
  const deduped = uniqueColors(pixels);
  if (deduped.length <= targetCount) {
    const palette = deduped;
    const paletteMap = new Map(palette.map((color, idx) => [color.join(","), idx]));
    const assignments = pixels.map((pixel) => {
      const key = pixel.join(",");
      return paletteMap.has(key) ? paletteMap.get(key) : 0;
    });
    return { palette, assignments };
  }

  const centroids = initCentroids(pixels, targetCount);
  const assignments = new Array(pixels.length).fill(0);
  const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

  for (let iteration = 0; iteration < 12; iteration += 1) {
    let moved = 0;
    sums.forEach((sum) => {
      sum.r = 0;
      sum.g = 0;
      sum.b = 0;
      sum.count = 0;
    });

    for (let i = 0; i < pixels.length; i += 1) {
      const pixel = pixels[i];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const dist = colorDistance(pixel, centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        moved += 1;
      }
      const sum = sums[bestIdx];
      sum.r += pixel[0];
      sum.g += pixel[1];
      sum.b += pixel[2];
      sum.count += 1;
    }

    for (let c = 0; c < centroids.length; c += 1) {
      const sum = sums[c];
      if (sum.count === 0) {
        centroids[c] = [...pixels[Math.floor(Math.random() * pixels.length)]];
      } else {
        centroids[c] = [
          Math.round(sum.r / sum.count),
          Math.round(sum.g / sum.count),
          Math.round(sum.b / sum.count)
        ];
      }
    }

    if (moved === 0) break;
  }

  return { palette: centroids, assignments };
}

function uniqueColors(pixels) {
  const seen = new Map();
  const palette = [];
  pixels.forEach((pixel) => {
    const key = pixel.join(",");
    if (!seen.has(key)) {
      seen.set(key, true);
      palette.push(cloneColor(pixel));
    }
  });
  return palette;
}

function initCentroids(pixels, count) {
  const centroids = [];
  const taken = new Set();
  while (centroids.length < count) {
    const idx = Math.floor(Math.random() * pixels.length);
    if (taken.has(idx)) continue;
    taken.add(idx);
    centroids.push([...pixels[idx]]);
  }
  return centroids;
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function resizeMatrix(newWidth, newHeight) {
  if (newWidth === state.width && newHeight === state.height) return;
  clearSelection();
  const resized = resizePixelArray(state.pixelColors, state.width, state.height, newWidth, newHeight);
  state.width = newWidth;
  state.height = newHeight;
  state.pixelColors = resized;
  rebuildPaletteFromPixels();
  markExportDirty();
  renderAll();
}

function resizePixelArray(pixels, oldWidth, oldHeight, newWidth, newHeight) {
  const result = [];
  for (let y = 0; y < newHeight; y += 1) {
    for (let x = 0; x < newWidth; x += 1) {
      const srcX = Math.min(oldWidth - 1, Math.floor((x / newWidth) * oldWidth));
      const srcY = Math.min(oldHeight - 1, Math.floor((y / newHeight) * oldHeight));
      result.push([...pixels[srcY * oldWidth + srcX] || [0, 0, 0]]);
    }
  }
  return result;
}

function markExportDirty() {
  state.exportCache = "";
  dom.exportOutput.value = "";
  dom.downloadJson.disabled = true;
}

function renderAll() {
  dom.matrixWidth.value = state.width;
  dom.matrixHeight.value = state.height;
  syncPaletteSizeUi();
  dom.serpentineToggle.checked = state.serpentine;
  dom.resolutionLabel.textContent = `${state.width} × ${state.height}`;
  renderGrid();
  renderPaletteControls();
}

function renderGrid() {
  const total = state.width * state.height;
  const grid = dom.previewGrid;
  grid.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`;
  grid.innerHTML = "";
  for (let i = 0; i < total; i += 1) {
    const pixel = document.createElement("div");
    pixel.className = "pixel";
    const color = state.pixelColors[i] ?? [0, 0, 0];
    pixel.style.background = rgbToCss(color);
    if (state.selectedColorKey && rgbKey(color) === state.selectedColorKey) {
      pixel.classList.add("selected");
    }
    if (state.pixelPaletteIndexes[i] !== undefined) {
      const label = document.createElement("span");
      const labelValue = state.pixelPaletteIndexes[i];
      label.textContent = labelValue !== undefined ? labelValue + 1 : "";
      pixel.appendChild(label);
    }
    pixel.addEventListener("click", (event) => handlePixelClick(event, i));
    pixel.addEventListener("touchstart", (event) => handleTouchStart(event, i), {
      passive: false
    });
    pixel.addEventListener("touchend", (event) => handleTouchEnd(event, i), {
      passive: false
    });
    pixel.addEventListener("touchmove", clearTouchLongPress, { passive: true });
    pixel.addEventListener("touchcancel", clearTouchLongPress, { passive: true });
    grid.appendChild(pixel);
  }
}

function handlePixelClick(event, index) {
  performPixelAction(index, shouldPaint(event));
}

function shouldPaint(event) {
  return Boolean(
    state.paintMode ||
      event?.metaKey ||
      event?.ctrlKey ||
      event?.altKey ||
      event?.shiftKey
  );
}

function performPixelAction(index, paint) {
  if (paint) {
    paintPixel(index);
  } else {
    selectColorByIndex(index);
  }
}

function renderPaletteControls() {
  const usage = buildPaletteUsage();
  dom.paletteSummary.textContent = `${state.palette.length} colors`;
  dom.paletteControls.innerHTML = "";
  if (!state.palette.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No palette colors yet. Import an image or preset to begin.";
    dom.paletteControls.appendChild(empty);
    populatePaletteSelects();
    updateSelectionUi();
    updatePaintUi();
    return;
  }
  state.palette.forEach((color, idx) => {
    const chip = document.createElement("div");
    chip.className = "palette-chip";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = rgbToHex(color);
    colorInput.addEventListener("input", (event) => {
      const nextColor = hexToRgb(event.target.value);
      state.palette[idx] = nextColor;
      state.pixelColors = state.pixelPaletteIndexes.map((assignment) => state.palette[assignment] || [0, 0, 0]);
      markExportDirty();
      renderGrid();
      updatePaintUi();
    });

    const meta = document.createElement("div");
    meta.className = "palette-meta";
    const hex = rgbToHex(color);
    meta.innerHTML = `<strong>#${idx + 1} ${hex}</strong><span>${usage[idx] || 0} pixels</span>`;

    chip.append(colorInput, meta);
    dom.paletteControls.appendChild(chip);
  });
  populatePaletteSelects();
  updateSelectionUi();
  updatePaintUi();
}

function buildPaletteUsage() {
  return state.pixelPaletteIndexes.reduce((acc, idx) => {
    acc[idx] = (acc[idx] || 0) + 1;
    return acc;
  }, []);
}

function selectColorByIndex(index) {
  const color = state.pixelColors[index];
  if (!color) return;
  state.selectedColor = cloneColor(color);
  state.selectedColorKey = rgbKey(color);
  const count = countSelectedPixels();
  updateSelectionUi();
  renderGrid();
  setStatus(
    `Selected ${rgbToHex(color)} covering ${count} pixel${count === 1 ? "" : "s"}.`
  );
}

function updateSelectionUi() {
  if (!dom.selectionDetails) return;
  const hasSelection = Boolean(state.selectedColorKey && state.selectedColor);
  dom.selectionDetails.classList.toggle("is-hidden", !hasSelection);
  dom.selectionPrompt.classList.toggle("is-hidden", hasSelection);
  dom.applyCustomReplace.disabled = !hasSelection;
  dom.customColor.disabled = !hasSelection;
  const hasPalette = state.palette.length > 0;
  dom.paletteTarget.disabled = !hasPalette;
  dom.applyPaletteReplace.disabled = !hasSelection || !hasPalette;

  if (!hasSelection) {
    dom.selectionCount.textContent = "No pixels selected";
    dom.selectionPixels.textContent = "0 pixels";
    return;
  }

  const count = countSelectedPixels();
  dom.selectionCount.textContent = `${count} selected`;
  dom.selectionPixels.textContent = `${count} pixel${count === 1 ? "" : "s"}`;
  const color = state.selectedColor;
  dom.selectionSwatch.style.background = rgbToCss(color);
  dom.selectionHex.textContent = rgbToHex(color);
}

function populatePaletteSelects() {
  populatePaletteSelect(dom.paletteTarget);
  populatePaletteSelect(dom.paintPaletteTarget, state.paintPaletteIndex);
  if (state.palette.length && dom.paintPaletteTarget && dom.paintPaletteTarget.value !== "") {
    const idx = Number(dom.paintPaletteTarget.value);
    if (Number.isInteger(idx) && state.palette[idx]) {
      state.paintPaletteIndex = idx;
      state.paintColor = cloneColor(state.palette[idx]);
    }
  }
}

function populatePaletteSelect(selectElement, preferredValue) {
  if (!selectElement) return;
  const previousValue =
    preferredValue !== undefined && preferredValue !== null
      ? String(preferredValue)
      : selectElement.value;
  selectElement.innerHTML = "";

  if (!state.palette.length) {
    const option = document.createElement("option");
    option.textContent = "No palette colors available";
    option.value = "";
    option.disabled = true;
    option.selected = true;
    selectElement.appendChild(option);
    selectElement.disabled = true;
    return;
  }

  state.palette.forEach((color, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = `#${idx + 1} ${rgbToHex(color)}`;
    selectElement.appendChild(option);
  });

  if (state.palette[Number(previousValue)] !== undefined) {
    selectElement.value = String(previousValue);
  } else {
    selectElement.selectedIndex = 0;
  }
  selectElement.disabled = false;
}

function setPaintColorFromPalette(index) {
  if (!state.palette.length) {
    setStatus("No palette colors available yet.", "warn");
    return;
  }
  const safeIndex = Number.isInteger(index) && state.palette[index] ? index : 0;
  state.paintPaletteIndex = safeIndex;
  state.paintColor = cloneColor(state.palette[safeIndex]);
  if (dom.paintPaletteTarget) {
    dom.paintPaletteTarget.value = String(safeIndex);
  }
  updatePaintUi();
  setStatus(`Painting with palette color ${rgbToHex(state.paintColor)}.`);
}

function setPaintColorFromCustom(hex) {
  const color = hexToRgb(hex || "#ffffff");
  const paletteIndex = ensurePaletteColor(color);
  if (paletteIndex === -1) {
    setStatus("Palette is full (32 colors). Remove a color before adding more.", "warn");
    return;
  }
  state.paintPaletteIndex = paletteIndex;
  state.paintColor = cloneColor(state.palette[paletteIndex]);
  renderPaletteControls();
  setStatus(`Added ${rgbToHex(color)} for painting.`);
}

function togglePaintMode() {
  state.paintMode = !state.paintMode;
  updatePaintUi();
  setStatus(state.paintMode ? "Paint mode enabled." : "Paint mode disabled.");
}

function updatePaintUi() {
  if (!dom.paintSwatch || !dom.paintHex) return;
  if (!state.palette.length) {
    dom.paintSwatch.style.background = "#000000";
    dom.paintHex.textContent = "#000000";
    if (dom.togglePaintMode) {
      dom.togglePaintMode.disabled = true;
      dom.togglePaintMode.classList.remove("is-active");
      dom.togglePaintMode.textContent = "Paint mode off";
    }
    return;
  }
  const index =
    Number.isInteger(state.paintPaletteIndex) && state.palette[state.paintPaletteIndex]
      ? state.paintPaletteIndex
      : 0;
  state.paintPaletteIndex = index;
  state.paintColor = cloneColor(state.palette[index]);
  dom.paintSwatch.style.background = rgbToCss(state.paintColor);
  dom.paintHex.textContent = rgbToHex(state.paintColor);
  if (dom.paintPaletteTarget) {
    dom.paintPaletteTarget.value = String(index);
  }
  if (dom.togglePaintMode) {
    dom.togglePaintMode.disabled = false;
    dom.togglePaintMode.classList.toggle("is-active", state.paintMode);
    dom.togglePaintMode.textContent = state.paintMode ? "Paint mode on" : "Paint mode off";
  }
}

function countSelectedPixels() {
  if (!state.selectedColorKey) return 0;
  return state.pixelColors.reduce(
    (acc, color) => (rgbKey(color) === state.selectedColorKey ? acc + 1 : acc),
    0
  );
}

function replaceColorWithPalette() {
  if (!state.selectedColorKey) {
    setStatus("Select a color in the grid first.", "warn");
    return;
  }
  if (!state.palette.length) {
    setStatus("No palette colors available yet.", "warn");
    return;
  }
  const targetIndex = Number(dom.paletteTarget.value);
  if (!Number.isInteger(targetIndex) || !state.palette[targetIndex]) {
    setStatus("Choose a palette color to replace with.", "warn");
    return;
  }
  const replaced = applyColorReplacement(targetIndex, state.palette[targetIndex]);
  if (replaced === 0) {
    setStatus("No pixels found for the selected color.", "warn");
    return;
  }
  setStatus(
    `Replaced ${replaced} pixel${replaced === 1 ? "" : "s"} with palette color ${
      rgbToHex(state.palette[targetIndex])
    }.`
  );
}

function replaceColorWithCustom() {
  if (!state.selectedColorKey) {
    setStatus("Select a color in the grid first.", "warn");
    return;
  }
  const hex = dom.customColor.value || "#ffffff";
  const rgb = hexToRgb(hex);
  const paletteIndex = ensurePaletteColor(rgb);
  if (paletteIndex === -1) {
    setStatus("Palette is full (32 colors). Remove a color before adding more.", "warn");
    return;
  }
  const replaced = applyColorReplacement(paletteIndex, rgb);
  if (replaced === 0) {
    setStatus("No pixels found for the selected color.", "warn");
    return;
  }
  setStatus(
    `Replaced ${replaced} pixel${replaced === 1 ? "" : "s"} with ${rgbToHex(rgb)}.`
  );
}

function paintPixel(index) {
  const paletteIndex = ensurePaletteColor(state.paintColor);
  if (paletteIndex === -1) {
    setStatus("Palette is full (32 colors). Remove a color before adding more.", "warn");
    return;
  }
  state.paintPaletteIndex = paletteIndex;
  const color = cloneColor(state.palette[paletteIndex]);
  state.paintColor = cloneColor(color);
  if (!state.pixelPaletteIndexes?.length) {
    state.pixelPaletteIndexes = new Array(state.pixelColors.length).fill(0);
  }
  state.pixelPaletteIndexes[index] = paletteIndex;
  state.pixelColors[index] = cloneColor(color);
  markExportDirty();
  renderGrid();
  renderPaletteControls();
  setStatus(`Painted pixel ${index + 1} with ${rgbToHex(color)}.`);
}

function handleTouchStart(event, index) {
  if (event.touches.length > 1) return;
  clearTouchLongPress();
  state.touchLongPressTriggered = false;
  if (state.paintMode) {
    event.preventDefault();
  }
  state.touchTimerId = window.setTimeout(() => {
    state.touchTimerId = null;
    state.touchLongPressTriggered = true;
    paintPixel(index);
  }, 500);
}

function handleTouchEnd(event, index) {
  if (event.changedTouches.length > 1) return;
  if (state.touchTimerId) {
    clearTimeout(state.touchTimerId);
    state.touchTimerId = null;
  }
  if (state.touchLongPressTriggered) {
    state.touchLongPressTriggered = false;
    event.preventDefault();
    return;
  }
  event.preventDefault();
  performPixelAction(index, state.paintMode);
}

function clearTouchLongPress() {
  if (state.touchTimerId) {
    clearTimeout(state.touchTimerId);
    state.touchTimerId = null;
  }
  state.touchLongPressTriggered = false;
}

function ensurePaletteColor(color) {
  const key = rgbKey(color);
  const existingIndex = state.palette.findIndex((entry) => rgbKey(entry) === key);
  if (existingIndex !== -1) {
    return existingIndex;
  }
  if (state.palette.length >= 32) {
    return -1;
  }
  state.palette.push(cloneColor(color));
  state.paletteSize = Math.max(state.paletteSize, state.palette.length);
  syncPaletteSizeUi();
  return state.palette.length - 1;
}

function applyColorReplacement(paletteIndex, color) {
  if (!state.pixelPaletteIndexes?.length) {
    state.pixelPaletteIndexes = new Array(state.pixelColors.length).fill(0);
  }
  const nextColorKey = rgbKey(color);
  let replaced = 0;
  for (let i = 0; i < state.pixelColors.length; i += 1) {
    if (rgbKey(state.pixelColors[i]) !== state.selectedColorKey) continue;
    state.pixelPaletteIndexes[i] = paletteIndex;
    state.pixelColors[i] = cloneColor(color);
    replaced += 1;
  }
  if (replaced === 0) {
    return 0;
  }
  state.selectedColor = cloneColor(color);
  state.selectedColorKey = nextColorKey;
  markExportDirty();
  renderGrid();
  renderPaletteControls();
  return replaced;
}

function clearSelection() {
  state.selectedColorKey = null;
  state.selectedColor = null;
  if (dom.selectionDetails) {
    updateSelectionUi();
  }
}

function loadPresetFromJson(raw) {
  try {
    const parsed = JSON.parse(raw);
    const preset = normalizePreset(parsed);
    if (!preset) {
      setStatus("Unable to interpret JSON payload.", "error");
      return;
    }
    state.width = preset.width;
    state.height = preset.height;
    state.serpentine = preset.serpentine;
    const uniqueColors = new Set(preset.pixelColors.map((color) => color.join(",")));
    state.paletteSize = clamp(
      Math.max(state.paletteSize, uniqueColors.size || state.paletteSize),
      2,
      32
    );
    applyPixels(preset.pixelColors);
    renderAll();
    setStatus("Preset loaded. Adjust palette or export when ready.");
  } catch (error) {
    console.error(error);
    setStatus("Invalid JSON supplied.", "error");
  }
}

function normalizePreset(input) {
  const seg = Array.isArray(input.seg) ? input.seg[0] : undefined;
  const total =
    (seg ? (seg.stop ?? 0) - (seg.start ?? 0) : 0) ||
    (Array.isArray(input.pixels) ? input.pixels.length : 0) ||
    state.width * state.height;
  const metaMatrix = input.meta?.matrix;
  const width = clamp(parseInt(metaMatrix?.width, 10) || inferWidth(total) || state.width, 1, 64);
  const height = clamp(parseInt(metaMatrix?.height, 10) || inferHeight(total, width) || state.height, 1, 64);
  const serpentine = typeof metaMatrix?.serpentine === "boolean" ? metaMatrix.serpentine : state.serpentine;

  let pixels = [];
  const paletteArray = Array.isArray(input.palette)
    ? input.palette.map(coerceColor).filter(Boolean)
    : [];

  if (Array.isArray(input.pixels) && paletteArray.length) {
    if (typeof input.pixels[0] === "number") {
      pixels = input.pixels.map((paletteIndex) => paletteArray[paletteIndex] ?? [0, 0, 0]);
    } else if (Array.isArray(input.pixels[0])) {
      pixels = input.pixels.map((color) => coerceColor(color) ?? [0, 0, 0]);
    }
  } else if (Array.isArray(input.pixelColors)) {
    pixels = input.pixelColors.map((color) => coerceColor(color) ?? [0, 0, 0]);
  } else if (seg?.i) {
    const ledCount = Math.max(total || width * height, width * height);
    const ledColors = new Array(ledCount).fill([0, 0, 0]);
    const entries = seg.i;
    for (let i = 0; i < entries.length; i += 2) {
      const ledIndex = Number(entries[i]);
      const color = coerceColor(entries[i + 1]);
      if (!color) continue;
      if (ledIndex >= 0 && ledIndex < ledColors.length) {
        ledColors[ledIndex] = color;
      }
    }
    pixels = fromLedOrder(ledColors, width, height, serpentine);
  }

  if (!pixels.length) return null;
  const sourceWidth = width;
  const sourceHeight = Math.ceil(pixels.length / sourceWidth) || height;
  if (pixels.length !== width * height) {
    pixels = resizePixelArray(pixels, sourceWidth, sourceHeight, width, height);
  }
  return { width, height, serpentine, pixelColors: pixels };
}

function fromLedOrder(ledColors, width, height, serpentine) {
  const pixels = new Array(width * height).fill([0, 0, 0]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ledIndex = linearIndex(x, y, width, serpentine);
      pixels[y * width + x] = cloneColor(ledColors[ledIndex] ?? [0, 0, 0]);
    }
  }
  return pixels;
}

function linearIndex(x, y, width, serpentine) {
  if (serpentine && y % 2 === 1) {
    return y * width + (width - 1 - x);
  }
  return y * width + x;
}

function buildLedList() {
  const ledCount = state.width * state.height;
  const ledColors = new Array(ledCount).fill([0, 0, 0]);
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const matrixIndex = y * state.width + x;
      const ledIndex = linearIndex(x, y, state.width, state.serpentine);
      ledColors[ledIndex] = cloneColor(state.pixelColors[matrixIndex] ?? [0, 0, 0]);
    }
  }
  const iArray = [];
  ledColors.forEach((color, idx) => {
    iArray.push(idx, color.map((value) => clamp(Math.round(value), 0, 255)));
  });
  return iArray;
}

function buildWledPresetJson() {
  const ledCount = state.width * state.height;
  const payload = {
    name: `Matrix ${state.width}x${state.height}`,
    on: true,
    bri: 255,
    transition: 7,
    mainseg: 0,
    seg: [
      {
        id: 0,
        start: 0,
        stop: ledCount,
        grp: 1,
        of: 0,
        on: true,
        bri: 255,
        i: buildLedList()
      }
    ],
    palette: state.palette,
    pixels: state.pixelPaletteIndexes,
    meta: {
      generator: "wled-pixel-art-generator",
      generatedAt: new Date().toISOString(),
      matrix: {
        width: state.width,
        height: state.height,
        serpentine: state.serpentine
      }
    }
  };
  state.exportCache = JSON.stringify(payload, null, 2);
  return state.exportCache;
}

function downloadJson(content) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wled-pixel-art-${state.width}x${state.height}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus("JSON downloaded. Copy it into presets.json or upload via WLED UI.");
}

function decodeImageFile(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

function inferWidth(total) {
  if (!total) return state.width;
  const sqrt = Math.round(Math.sqrt(total));
  if (sqrt * sqrt === total) return sqrt;
  return Math.min(Math.max(1, total / state.height), 64);
}

function inferHeight(total, width) {
  if (!total) return state.height;
  return Math.min(64, Math.max(1, Math.round(total / width)));
}

function rgbToCss(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function rgbToHex(color) {
  return `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  let parsed = hex.replace("#", "");
  if (parsed.length === 3) {
    parsed = parsed
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return [
    parseInt(parsed.slice(0, 2), 16),
    parseInt(parsed.slice(2, 4), 16),
    parseInt(parsed.slice(4, 6), 16)
  ];
}

function rgbKey(color) {
  if (!color) return "";
  return `${color[0] ?? 0},${color[1] ?? 0},${color[2] ?? 0}`;
}

function cloneColor(color) {
  return [
    clamp(Math.round(color?.[0] ?? 0), 0, 255),
    clamp(Math.round(color?.[1] ?? 0), 0, 255),
    clamp(Math.round(color?.[2] ?? 0), 0, 255)
  ];
}

function coerceColor(input) {
  if (Array.isArray(input)) {
    return cloneColor(input);
  }
  if (typeof input === "string") {
    const trimmed = input.trim().replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
      return hexToRgb(`#${trimmed}`);
    }
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return [
      clamp((input >> 16) & 0xff, 0, 255),
      clamp((input >> 8) & 0xff, 0, 255),
      clamp(input & 0xff, 0, 255)
    ];
  }
  return null;
}

function setStatus(message, level = "info") {
  dom.statusArea.textContent = message;
  dom.statusArea.dataset.level = level;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function syncPaletteSizeUi() {
  dom.colorCount.value = state.paletteSize;
  dom.colorCountValue.textContent = `${state.paletteSize} colors`;
}
