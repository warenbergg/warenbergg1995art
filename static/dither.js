/* =========================
   DARK MODE
========================= */
const toggle = document.getElementById("darkModeToggle");

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  toggle.textContent = "☀️";
}

toggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  toggle.textContent = isDark ? "☀️" : "🌙";
});

/* =========================
   GLOBAL STATE
========================= */
let originalImage = null;
let currentStyle = "atkinson";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const fileInput = document.getElementById("fileInput");
const thresholdSlider = document.getElementById("thresholdSlider");
const thresholdValue = document.getElementById("thresholdValue");
const bitDepthSelect = document.getElementById("bitDepth");
const saveBtn = document.getElementById("saveBtn");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");

const styleButtons = document.querySelectorAll(".style-btn");

/* =========================
   FIXED CANVAS (UI STABLE)
========================= */
const CANVAS_SIZE = 512;
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

/* =========================
   HELPERS
========================= */
const clamp = (v) => Math.max(0, Math.min(255, v));

function quantize(value, levels) {
  const step = 255 / (levels - 1);
  return Math.round(value / step) * step;
}

/* =========================
   STYLE BUTTONS
========================= */
styleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    styleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStyle = btn.dataset.style;
    processImage();
  });
});

/* =========================
   DITHER ALGORITHMS
========================= */
function atkinsonDither(img, threshold, levels) {
  const { data, width, height } = img;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const oldPixel = data[i];
      const q = quantize(oldPixel < threshold ? 0 : 255, levels);
      const error = oldPixel - q;

      data[i] = data[i + 1] = data[i + 2] = q;

      const spread = error / 8;

      const diffuse = (dx, dy) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          data[ni]     = clamp(data[ni]     + spread);
          data[ni + 1] = clamp(data[ni + 1] + spread);
          data[ni + 2] = clamp(data[ni + 2] + spread);
        }
      };

      diffuse(1, 0);
      diffuse(2, 0);
      diffuse(-1, 1);
      diffuse(0, 1);
      diffuse(1, 1);
      diffuse(0, 2);
    }
  }
  return img;
}

function floydSteinbergDither(img, threshold, levels) {
  const { data, width, height } = img;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const oldPixel = data[i];
      const q = quantize(oldPixel < threshold ? 0 : 255, levels);
      const error = oldPixel - q;

      data[i] = data[i + 1] = data[i + 2] = q;

      const diffuse = (dx, dy, factor) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          const val = error * factor;
          data[ni]     = clamp(data[ni]     + val);
          data[ni + 1] = clamp(data[ni + 1] + val);
          data[ni + 2] = clamp(data[ni + 2] + val);
        }
      };

      diffuse(1, 0, 7 / 16);
      diffuse(-1, 1, 3 / 16);
      diffuse(0, 1, 5 / 16);
      diffuse(1, 1, 1 / 16);
    }
  }
  return img;
}

function orderedDither(img, threshold, levels) {
  const { data, width, height } = img;

  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const b = bayer[y % 4][x % 4];
      const t = threshold + (b - 7.5) * 8;
      const q = quantize(data[i] < t ? 0 : 255, levels);
      data[i] = data[i + 1] = data[i + 2] = q;
    }
  }
  return img;
}

function randomDither(img, threshold, levels) {
  const { data } = img;

  for (let i = 0; i < data.length; i += 4) {
    const rand = threshold + (Math.random() - 0.5) * 50;
    const q = quantize(data[i] < rand ? 0 : 255, levels);
    data[i] = data[i + 1] = data[i + 2] = q;
  }
  return img;
}

/* =========================
   PROCESS PIPELINE
========================= */
function processImage() {
  if (!originalImage) return;

  const threshold = parseInt(thresholdSlider.value);
  const levels = Math.pow(2, parseInt(bitDepthSelect.value));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(
    canvas.width / originalImage.width,
    canvas.height / originalImage.height
  );

  const w = originalImage.width * scale;
  const h = originalImage.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;

  ctx.drawImage(originalImage, x, y, w, h);

  let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  // grayscale
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = g;
  }

  switch (currentStyle) {
    case "atkinson": img = atkinsonDither(img, threshold, levels); break;
    case "floyd":    img = floydSteinbergDither(img, threshold, levels); break;
    case "ordered":  img = orderedDither(img, threshold, levels); break;
    case "random":   img = randomDither(img, threshold, levels); break;
  }

  ctx.putImageData(img, 0, 0);
}

/* =========================
   SNAP TO VALUE
========================= */
const SNAP_VALUES = [64, 128, 192];
const SNAP_DISTANCE = 12;

function snapThreshold(v) {
  return SNAP_VALUES.reduce((a, b) =>
    Math.abs(b - v) < Math.abs(a - v) ? b : a
  );
}

["mouseup", "touchend"].forEach(evt => {
  thresholdSlider.addEventListener(evt, () => {
    const snapped = snapThreshold(parseInt(thresholdSlider.value));
    thresholdSlider.value = snapped;
    thresholdValue.textContent = snapped;
    processImage();
  });
});

/* =========================
   EVENTS
========================= */
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      uploadPlaceholder.classList.add("hidden");
      canvas.classList.add("active");
      saveBtn.disabled = false;
      processImage();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

thresholdSlider.addEventListener("input", () => {
  thresholdValue.textContent = thresholdSlider.value;
  processImage();
});

bitDepthSelect.addEventListener("change", processImage);

saveBtn.addEventListener("click", () => {
  renderStill();
  stillModal.classList.remove("hidden");
});

document.getElementById("exportStill").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = `still-${currentStyle}-${bitDepthSelect.value}bit.png`;
  a.href = stillCanvas.toDataURL("image/png");
  a.click();
});

document.getElementById("closeStill").addEventListener("click", () => {
  stillModal.classList.add("hidden");
});


/* =========================
   STILL CANVAS (EXPORT ONLY)
========================= */
const stillModal = document.getElementById("stillModal");
const stillCanvas = document.getElementById("stillCanvas");
const stillCtx = stillCanvas.getContext("2d");

const STILL_WIDTH = 800;
const STILL_HEIGHT = 1000;

stillCanvas.width = STILL_WIDTH;
stillCanvas.height = STILL_HEIGHT;

function renderStill() {
  const isDark = document.body.classList.contains("dark-mode");

  // background
  stillCtx.fillStyle = isDark ? "#0a0a0a" : "#ffffff";
  stillCtx.fillRect(0, 0, STILL_WIDTH, STILL_HEIGHT);

  // image
  const imgSize = 512;
  const imgX = (STILL_WIDTH - imgSize) / 2;
  const imgY = 220;

  stillCtx.drawImage(canvas, imgX, imgY, imgSize, imgSize);

  // text color
  stillCtx.fillStyle = isDark ? "#ffffff" : "#000000";

  // header
  stillCtx.font = "600 18px Poppins";
  stillCtx.fillText("WarenBergg / Classic dithering images into retro", 40, 60);

  // info
  stillCtx.font = "400 14px Poppins";
  stillCtx.fillText(`Algorithm: ${currentStyle}`, 40, 110);
  stillCtx.fillText(`Bit Depth: ${bitDepthSelect.value}-bit`, 40, 132);
  stillCtx.fillText(`Threshold: ${thresholdSlider.value}`, 40, 154);
  stillCtx.fillText(`Resolution: ${canvas.width} × ${canvas.height}`, 40, 176);

  // footer
  stillCtx.font = "500 12px Poppins";
  stillCtx.fillText("© 2025 warenbergg1995", 40, STILL_HEIGHT - 40);
}
