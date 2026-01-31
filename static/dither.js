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
// Helper clamp yang efisien
// const clamp = (v) => v < 0 ? 0 : (v > 255 ? 255 : v);

function atkinsonDither(img, threshold, levels) {
  const { data, width, height } = img;
  // Pre-calculate untuk performa
  const is1Bit = levels === 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      
      //ambil pixel asli
      const oldPixel = data[i];
      
      let q ;
      if (is1Bit) {
        // Mode 1-bit: Gunakan Threshold Slider
        q = oldPixel < threshold ? 0 : 255;
      } else {
        // Mode Multi-bit: Gunakan Quantize (abaikan threshold slider)
        q = quantize(oldPixel, levels);
      }
      
      const error = oldPixel - q;

      // Set pixel saat ini
      data[i] = data[i + 1] = data[i + 2] = q;

      // Spread error (Atkinson factor = 1/8)
      const spread = error >> 3; // Bitwise shift untuk bagi 8 (lebih cepat dikit)

      if (spread === 0) continue; // Skip jika tidak ada error berarti

      const diffuse = (dx, dy) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          const val = data[ni] + spread;
          data[ni] = data[ni + 1] = data[ni + 2] = clamp(val);
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

      //ambil pixel asli
      const oldPixel = data[i];
      
      let q ;
      // jika bit depth  = 1 (level = 2), gunakan Threshold slider
      if (levels === 2){
        q = oldPixel < threshold ? 0 : 255;
      }else{
        //jika multibit , abaikan threshold slider, gunakan quatize langsung pada pixel asli
        q = quantize(oldPixel, levels)
      }
      const error = oldPixel - q;

      data[i] = data[i + 1] = data[i + 2] = q;

      // Floyd-Steinberg Factors: 7, 3, 5, 1 (/16)
      const diffuse = (dx, dy, factor) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          const val = data[ni] + (error * factor);
          data[ni] = data[ni + 1] = data[ni + 2] = clamp(val);
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
  const is1Bit = levels === 2;

  // Matriks Bayer 4x4
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  // Hitung seberapa besar "jarak" antar warna
  // Misal 4-bit (16 level), jaraknya sekitar 17 poin.
  // Pola dither harus mengisi jarak ini agar gradasi terlihat halus.
  const step = 255 / (levels - 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldPixel = data[i];

      // Ambil nilai dari map Bayer (0 s/d 15)
      const b = bayer[y % 4][x % 4];
      
      let q;

      if (is1Bit) {
        // --- LOGIKA 1-BIT (Hitam Putih Murni) ---
        // Menggunakan Threshold Slider + Pola Bayer
        // (b - 7.5) membuat nilai berkisar antara -7.5 sampai 7.5
        // Dikali 8 agar spread-nya cukup lebar
        const t = threshold + (b - 7.5) * 8;
        q = oldPixel < t ? 0 : 255;

      } else {
        // --- LOGIKA MULTI-BIT (2-bit / 4-bit) ---
        // Kita harus menambahkan pola Bayer ke pixel ASLI sebelum di-quantize.
        
        // Normalisasi nilai bayer menjadi range -0.5 sampai 0.5
        const mapValue = (b / 16.0) - 0.5;
        
        // Kalikan dengan 'step' agar noise sesuai dengan kedalaman bit
        const ditherValue = mapValue * step;
        
        // Tambahkan noise ke pixel asli, lalu quantize
        q = quantize(clamp(oldPixel + ditherValue), levels);
      }

      data[i] = data[i + 1] = data[i + 2] = q;
    }
  }
  return img;
}

function randomDither(img, threshold, levels) {
  const { data } = img;
  const is1Bit = levels === 2;

  for (let i = 0; i < data.length; i += 4) {
    const oldPixel = data[i];
    let q;

    if (is1Bit) {
      // Noise ditambahkan ke threshold
      const noise = (Math.random() - 0.5) * 50; 
      q = oldPixel < (threshold + noise) ? 0 : 255;
    } else {
      // Noise ditambahkan ke pixel sebelum dikuantisasi
      const noise = (Math.random() - 0.5) * 20; 
      q = quantize(clamp(oldPixel + noise), levels);
    }

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

/* =========================
   KNOWLEDGE BASE (Data Jurnal)
========================= */
const algoInfo = {
  atkinson: {
    title: "Atkinson Dither",
    year: "1984",
    author: "Bill Atkinson (Apple Macintosh Team)",
    desc: "Ditemukan oleh Bill Atkinson untuk komputer Apple Macintosh orisinal (MacPaint). Algoritma ini hanya menyebarkan 3/4 dari error kuantisasi ke piksel tetangga. Sisa error 'dibuang', yang mencegah pola lumpur (muddy patterns) dan menghasilkan gambar dengan kontras tinggi yang sangat bersih di area terang.",
  },
  floyd: {
    title: "Floyd-Steinberg",
    year: "1976",
    author: "Robert Floyd & Louis Steinberg",
    desc: "Standar emas dalam 'Error Diffusion' yang dipublikasikan dalam jurnal SID. Algoritma ini menyebarkan 100% error ke empat piksel tetangga (7/16, 3/16, 5/16, 1/16). Hasilnya adalah gradasi yang paling halus dan akurat secara matematis, namun sering terlihat lebih 'bising' (grainy) dibanding Atkinson.",
  },
  ordered: {
    title: "Ordered Dither (Bayer)",
    year: "1973",
    author: "Bryce Bayer (Kodak)",
    desc: "Dikembangkan oleh penemu yang sama dengan Filter Bayer pada kamera modern. Teknik ini tidak menyebarkan error, melainkan menggunakan pola matriks ambang batas (threshold map) yang tetap (4x4). Hasilnya adalah pola silang (crosshatch) yang sangat teratur, cepat dikomputasi, dan stabil untuk animasi.",
  },
  random: {
    title: "Random Dither (Noise)",
    year: "N/A",
    author: "Konsep Matematika Dasar",
    desc: "Bentuk paling primitif dari dithering. Algoritma ini menambahkan 'white noise' acak ke setiap piksel sebelum dikuantisasi. Meskipun hasilnya kasar dan tidak rapi, teknik ini sering digunakan untuk efek artistik 'film grain' atau tekstur berpasir yang estetik.",
  },
  grid: {
    title: "Grid Art (Mosaic)",
    year: "Retro Era",
    author: "Pixelation Technique",
    desc: "Teknik stilisasi yang membagi gambar menjadi blok-blok besar (grid). Setiap blok dianalisis rata-rata kecerahannya dan diisi dengan warna solid. Menciptakan estetika 'Pixel Art', 'Lego', atau kerajinan kristik (cross-stitch) yang minimalis.",
  },
};

// Fungsi Update Info
function updateInfoCard(styleKey) {
  const data = algoInfo[styleKey];
  if (!data) return;

  document.getElementById("infoTitle").textContent = data.title;
  document.getElementById("infoYear").textContent = data.year;
  document.getElementById("infoAuthor").textContent = data.author;
  document.getElementById("infoDesc").textContent = data.desc;
}

/* =========================
   UPDATE EVENT LISTENER
========================= */
// Cari bagian "STYLE BUTTONS" yang lama, dan tambahkan pemanggilan updateInfoCard
styleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    styleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStyle = btn.dataset.style;
    
    // --> TAMBAHAN BARU DI SINI
    updateInfoCard(currentStyle); 
    
    processImage();
  });
});

// Panggil sekali saat load agar default (Atkinson) muncul
updateInfoCard("atkinson");

/* =========================
   GLOBAL STATE & SELECTORS
========================= */
// ... (variabel lama Anda) ...
const gridControls = document.getElementById("gridControls");
const gridColorInput = document.getElementById("gridColor");
const blockSizeSlider = document.getElementById("blockSizeSlider");
const blockSizeValue = document.getElementById("blockSizeValue");

/* =========================
   STYLE BUTTONS LISTENER (UPDATE)
========================= */
styleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    styleButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStyle = btn.dataset.style;

    // Update Info Card (jika Anda pakai fitur info card)
    if (typeof updateInfoCard === "function") updateInfoCard(currentStyle);

    // Tampilkan kontrol khusus jika mode Grid dipilih
    if (currentStyle === "grid") {
      gridControls.classList.remove("hidden");
      // Sembunyikan bit depth karena tidak dipakai di mode ini
      document.querySelector('.bit-group').classList.add('hidden'); 
    } else {
      gridControls.classList.add("hidden");
      document.querySelector('.bit-group').classList.remove('hidden');
    }

    processImage();
  });
});

/* =========================
   EVENT LISTENERS BARU
========================= */
gridColorInput.addEventListener("input", processImage);
blockSizeSlider.addEventListener("input", () => {
  blockSizeValue.textContent = blockSizeSlider.value;
  processImage();
});

/* =========================
   NEW ALGORITHM: GRID ART
========================= */
function gridArtRender(img, threshold, blockSize, colorHex) {
  const { data, width, height } = img;
  
  // Konversi Hex Color ke RGB
  const rT = parseInt(colorHex.slice(1, 3), 16);
  const gT = parseInt(colorHex.slice(3, 5), 16);
  const bT = parseInt(colorHex.slice(5, 7), 16);

  // Loop per BLOCK (bukan per pixel)
  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      
      // 1. Hitung rata-rata kecerahan dalam blok ini
      let totalBrightness = 0;
      let count = 0;

      for (let by = 0; by < blockSize; by++) {
        for (let bx = 0; bx < blockSize; bx++) {
          const px = x + bx;
          const py = y + by;
          if (px < width && py < height) {
            const i = (py * width + px) * 4;
            // Rumus luminance sederhana
            const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
            totalBrightness += brightness;
            count++;
          }
        }
      }
      
      const avg = totalBrightness / count;

      // 2. Tentukan warna blok berdasarkan Threshold
      // Jika rata-rata pixel LEBIH GELAP dari threshold -> Warnai
      // Jika lebih terang -> Putih/Transparan
      
      const isSolid = avg < threshold; 

      // 3. Warnai seluruh blok
      for (let by = 0; by < blockSize; by++) {
        for (let bx = 0; bx < blockSize; bx++) {
          const px = x + bx;
          const py = y + by;
          
          // Efek 'Gap' kecil (opsional) agar terlihat seperti kotak terpisah
          // Hapus 'if' di bawah jika ingin kotak menyatu penuh
          if (bx === blockSize - 1 || by === blockSize - 1) continue; 

          if (px < width && py < height) {
            const i = (py * width + px) * 4;
            
            if (isSolid) {
              data[i] = rT;
              data[i+1] = gT;
              data[i+2] = bT;
              data[i+3] = 255; // Alpha penuh
            } else {
              // Background (Putih atau Transparan)
              // Sesuaikan dengan CSS dark mode Anda jika mau
              data[i] = 240; 
              data[i+1] = 240;
              data[i+2] = 240;
              data[i+3] = 0; // 0 = Transparan (biar background web kelihatan)
            }
          }
        }
      }
    }
  }
  return img;
}

/* =========================
   PROCESS PIPELINE (UPDATE)
========================= */
function processImage() {
  if (!originalImage) return;

  const threshold = parseInt(thresholdSlider.value);
  // Ambil nilai Block Size slider
  const blockSize = parseInt(blockSizeSlider.value); 
  // Ambil warna
  const color = gridColorInput.value;
  
  const levels = Math.pow(2, parseInt(bitDepthSelect.value));

  // ... (Kode setup canvas width/height yang lama tetap sama) ...
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / originalImage.width, canvas.height / originalImage.height);
  const w = originalImage.width * scale;
  const h = originalImage.height * scale;
  const x = (canvas.width - w) / 2;
  const y = (canvas.height - h) / 2;
  ctx.drawImage(originalImage, x, y, w, h);
  let img = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // --- SWITCH CASE UPDATE ---
  switch (currentStyle) {
    case "atkinson": img = atkinsonDither(img, threshold, levels); break;
    case "floyd":    img = floydSteinbergDither(img, threshold, levels); break;
    case "ordered":  img = orderedDither(img, threshold, levels); break;
    case "random":   img = randomDither(img, threshold, levels); break;
    // TAMBAHAN:
    case "grid":     img = gridArtRender(img, threshold, blockSize, color); break;
  }

  ctx.putImageData(img, 0, 0);
}
