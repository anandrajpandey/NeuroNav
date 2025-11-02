let detectionPaused = false; // global flag
let calibrationDone = false; // moved global
let lastScrollTime = 0;
let currentIrisPosition = null;
let gazeCursor = null;
let currentBlock = null; // currently focused clickable block
let scrollingEnabled = true; // ⬆ new flag for controlling scrolling
let lastIrisUpdateTime = Date.now();

/* ---------------- LOAD MEDIAPIPE LIBS ---------------- */
async function loadMediaPipe() {
  const libs = [
    "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
    "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils",
    "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils",
  ];
  for (const src of libs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  console.log("MediaPipe libraries loaded.");
  initNeuroNav();
}
/*test*/
function getClickableBlocks() {
  const selectors = "a, button, input, textarea, [onclick], img";
  const elements = Array.from(document.querySelectorAll(selectors)).filter(
    (el) => el.offsetWidth > 20 && el.offsetHeight > 20
  ); // ignore tiny ones

  return elements.map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      element: el,
      rect: rect,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  });
}
function findNearestBlock(gazeX, gazeY, blocks) {
  let nearest = null;
  let minDist = Infinity;
  for (const b of blocks) {
    const dx = gazeX - b.centerX;
    const dy = gazeY - b.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = b;
    }
  }
  return nearest;
}
function highlightBlock(el) {
  // If no valid element, just remove any previous highlight
  document
    .querySelectorAll(".gaze-highlight")
    .forEach((e) => e.classList.remove("gaze-highlight"));
  if (!el) return; // ✅ prevents crash

  el.classList.add("gaze-highlight");
}

/* ---------------- MAIN FUNCTION ---------------- */
function createGazeCursor() {
  if (document.getElementById("gaze-cursor")) return;
  gazeCursor = document.createElement("div");
  gazeCursor.id = "gaze-cursor";
  gazeCursor.style = `
    position: fixed;
    top: 0;
    left: 0;
    width: 20px;
    height: 20px;
    background: rgba(0,255,255,0.9);
    border: 2px solid white;
    border-radius: 50%;
    pointer-events: none;
    z-index: 999999999;
    transform: translate(-50%, -50%);
    transition: transform 0.05s linear;
  `;
  document.body.appendChild(gazeCursor);
  console.log("Gaze cursor created.");
}

function initNeuroNav() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const gestureDisplay = document.getElementById("gesture");
  const startCalibrationBtn = document.getElementById("start-calibration");
  const calibContainer = document.getElementById("calibration-container");

  let calibrationData = {};

  /* ---------------- WEBCAM ---------------- */
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
      console.log("✅ Webcam started.");
    })
    .catch((err) => console.error("[❌] Webcam access error:", err));

  /* ---------------- FACIAL GESTURE DETECTION ---------------- */
  async function captureFrame() {
    if (detectionPaused) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Frame = canvas.toDataURL("image/jpeg").split(",")[1];

    try {
      const res = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame: base64Frame }),
      });
      const data = await res.json();
      if (data.gesture) {
        gestureDisplay.innerText = data.gesture;
        console.log("[🤖] Gesture detected:", data.gesture);
      }
      if (
        data.gesture.toLowerCase() === "smile" &&
        calibrationDone &&
        currentBlock
      ) {
        currentBlock.element.click();
        console.log("🖱️ Clicked on block:", currentBlock.element);
      }
      // 🧠 Eyebrow gesture to toggle scrolling
      /*if (
        data.gesture &&
        data.gesture.toLowerCase().includes("eyebrow_raise")
      ) {
        scrollingEnabled = !scrollingEnabled;
        console.log(
          scrollingEnabled
            ? "[🟢] Scrolling resumed via eyebrow gesture."
            : "[⛔] Scrolling paused via eyebrow gesture."
        );

        // Optional: small visual feedback pulse
        if (gazeCursor) {
          gazeCursor.style.background = scrollingEnabled
            ? "rgba(0,255,255,0.9)"
            : "rgba(255,165,0,0.9)";
          setTimeout(
            () => (gazeCursor.style.background = "rgba(0,255,255,0.9)"),
            800
          );
        }
      }*/
    } catch (err) {
      console.error("[❌] Gesture detection error:", err);
    }
  }

  // Run continuously, independent of UI
  setInterval(captureFrame, 1500);
  let outOfBoundsSince = null;

  setInterval(() => {
    if (!gazeCursor || !document.body.contains(gazeCursor)) return;

    const rect = gazeCursor.getBoundingClientRect();
    const outOfBounds =
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight;

    if (outOfBounds) {
      // If cursor is out, start counting
      if (!outOfBoundsSince) outOfBoundsSince = Date.now();

      // If it's been more than 5 seconds → recenter
      if (Date.now() - outOfBoundsSince > 5000) {
        console.warn(
          "[⚠️] Cursor out of frame for 5s — recentring & recalibrating."
        );

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const prevPaused = detectionPaused;
        detectionPaused = true;

        if (!document.body.contains(gazeCursor)) {
          console.log("[👁️] Cursor missing — recreating...");
          createGazeCursor();
        }

        gazeCursor.style.transition = "transform 0.5s ease-out";
        gazeCursor.style.transform = `translate(${centerX}px, ${centerY}px)`;
        window.gazeSmooth = { x: centerX, y: centerY };

        // 🧭 Reset calibration baseline
        if (!window.lastValidIris)
          window.lastValidIris = { ...currentIrisPosition };
        calibrationData.center = { ...currentIrisPosition };
        calibrationData.lastReset = Date.now();

        // Reset smoothing drift
        window.gazeSmooth = { x: centerX, y: centerY };
        window.lastScrollTime = Date.now();

        setTimeout(() => {
          const target = document.elementFromPoint(centerX, centerY);
          if (target) {
            try {
              highlightBlock(target);
              console.log(
                "[✨] Highlighted block at new center:",
                target.tagName
              );
            } catch (e) {
              console.warn("[⚠️] highlightBlock failed:", e);
            }
          }

          gazeCursor.style.boxShadow = "0 0 20px cyan";
          setTimeout(() => (gazeCursor.style.boxShadow = ""), 1000);

          // 🕐 Resume tracking
          setTimeout(() => {
            detectionPaused = prevPaused;
            gazeCursor.style.transition = "transform 0.05s linear";
            console.log("[✅] Tracking resumed from recalibrated center.");
          }, 1500);
        }, 400);

        outOfBoundsSince = null; // reset timer
      }
    } else {
      // If cursor comes back, reset timer
      outOfBoundsSince = null;
    }
  }, 500);

  /* ---------------- IRIS TRACKING ---------------- */
  function averageIris(irisLandmarks) {
    let x = 0,
      y = 0;
    irisLandmarks.forEach((p) => {
      x += p.x;
      y += p.y;
    });
    return { x: x / irisLandmarks.length, y: y / irisLandmarks.length };
  }

  function handleIrisTracking(landmarks) {
    if (detectionPaused || !calibrationDone) return;

    const leftIris = landmarks.slice(468, 473);
    const rightIris = landmarks.slice(473, 478);
    const leftCenter = averageIris(leftIris);
    const rightCenter = averageIris(rightIris);
    const avgY = (leftCenter.y + rightCenter.y) / 2;
    const avgX = (leftCenter.x + rightCenter.x) / 2;

    lastIrisUpdateTime = Date.now();

    const { top, bottom, left, right } = calibrationData;
    const normY = (avgY - top.y) / (bottom.y - top.y);
    const normX = (avgX - left.x) / (right.x - left.x);

    const now = Date.now();
    if (scrollingEnabled && now - lastScrollTime > 150) {
      if (normY < 0.3) {
        console.log("[⬆️] Looking up — scroll up");
        window.scrollBy(0, -30);
      } else if (normY > 0.7) {
        console.log("[⬇️] Looking down — scroll down");
        window.scrollBy(0, 30);
      }
      lastScrollTime = now;
    }

    const screenX = normX * window.innerWidth;
    const screenY = normY * window.innerHeight;
    if (gazeCursor && calibrationDone) {
      // smooth motion
      if (!window.gazeSmooth) window.gazeSmooth = { x: screenX, y: screenY };
      gazeCursor.style.transform = `translate(${window.gazeSmooth.x}px, ${window.gazeSmooth.y}px)`;
      window.gazeSmooth.x = 0.15 * screenX + 0.85 * window.gazeSmooth.x;
      window.gazeSmooth.y = 0.15 * screenY + 0.85 * window.gazeSmooth.y;
    }
    const blocks = getClickableBlocks();
    const nearestBlock = findNearestBlock(screenX, screenY, blocks);

    if (nearestBlock && nearestBlock.element && nearestBlock !== currentBlock) {
      if (currentBlock && currentBlock.element) {
        currentBlock.element.classList.remove("gaze-highlight");
      }
      currentBlock = nearestBlock;
      highlightBlock(currentBlock.element);
    }
    /* ---------------- CHECK FOR LOST GAZE ---------------- */
    /* ---------------- CHECK FOR LOST GAZE ---------------- */
    setInterval(() => {
      const timeSinceLast = Date.now() - lastIrisUpdateTime;
      if (timeSinceLast > 5000 && gazeCursor && calibrationDone) {
        console.log("[🌀] Gaze lost — recentering cursor and block.");

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Smooth animation back to center
        gazeCursor.style.transition = "transform 0.6s ease-out";
        gazeCursor.style.transform = `translate(${centerX}px, ${centerY}px)`;

        // After recentering, highlight the block at center
        setTimeout(() => {
          const target = document.elementFromPoint(centerX, centerY);
          if (target) {
            highlightBlock(target);
          }
          gazeCursor.style.transition = "transform 0.05s linear";
        }, 650);
      }
    }, 1000);
  }

  /* ---------------- MEDIAPIPE INITIALIZATION ---------------- */
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      if (calibrationDone) handleIrisTracking(results.multiFaceLandmarks[0]);
      else handleIrisTrackingForCalibration(results.multiFaceLandmarks[0]);
    }
  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    },
    width: 640,
    height: 480,
  });
  camera.start();

  /* ---------------- CALIBRATION ---------------- */
  const dots = [
    { x: "50%", y: "50%", label: "center" },
    { x: "10%", y: "50%", label: "left" },
    { x: "90%", y: "50%", label: "right" },
    { x: "50%", y: "20%", label: "top" },
    { x: "50%", y: "80%", label: "bottom" },
  ];

  function showDot(index) {
    dots.forEach((dot, i) => {
      const el = document.getElementById(`dot${i + 1}`);
      if (el) {
        el.style.display = i === index ? "block" : "none";
        el.style.left = dots[i].x;
        el.style.top = dots[i].y;
      }
    });
  }

  async function startCalibration() {
    calibrationData = {};
    calibrationDone = false;
    calibContainer.style.display = "block";
    console.log("[⚙️] Starting calibration... Look at each dot.");

    for (let i = 0; i < dots.length; i++) {
      showDot(i);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (currentIrisPosition)
        calibrationData[dots[i].label] = { ...currentIrisPosition };
    }

    calibContainer.style.display = "none";
    calibrationDone = true;
    detectionPaused = false; // unpause after calibration
    console.log("[✅] Calibration complete!");
    transformUIAfterCalibration();
    createGazeCursor();
  }

  function handleIrisTrackingForCalibration(landmarks) {
    const leftIris = landmarks.slice(468, 473);
    const rightIris = landmarks.slice(473, 478);
    const leftCenter = averageIris(leftIris);
    const rightCenter = averageIris(rightIris);
    currentIrisPosition = {
      x: (leftCenter.x + rightCenter.x) / 2,
      y: (leftCenter.y + rightCenter.y) / 2,
    };
  }

  startCalibrationBtn.addEventListener("click", startCalibration);
}

/* ---------------- AFTER CALIBRATION: TRANSFORM UI ---------------- */
function transformUIAfterCalibration() {
  const startBtn = document.getElementById("start-calibration");
  if (startBtn) startBtn.remove();

  const controls = document.createElement("div");
  controls.id = "main-controls";
  controls.style = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 1000000;
  `;
  document.getElementById("neuronav-overlay").appendChild(controls);

  // Pause/Resume Button
  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "⏸️ Pause";
  pauseBtn.style = baseBtnStyle();
  controls.appendChild(pauseBtn);
  pauseBtn.onclick = () => {
    detectionPaused = !detectionPaused;
    pauseBtn.textContent = detectionPaused ? "▶️ Resume" : "⏸️ Pause";
    console.log(
      detectionPaused ? "[⏸️] Detection paused." : "[▶️] Detection resumed."
    );
  };

  // Kill Button
  const killBtn = document.createElement("button");
  killBtn.textContent = "✖ Stop";
  killBtn.style = baseBtnStyle();
  controls.appendChild(killBtn);
  killBtn.onclick = stopNeuroNav;

  // Minimize Button
  const minimizeBtn = document.createElement("button");
  minimizeBtn.textContent = "↘️ Minimize";
  minimizeBtn.style = baseBtnStyle();
  controls.appendChild(minimizeBtn);
  minimizeBtn.onclick = minimizeOverlay;

  console.log("[🎛️] UI transformed: added pause/resume, minimize, stop.");
}

/* ---------------- MINIMIZE / DRAG / STOP ---------------- */
let originalOverlayHTML = ""; // global backup

function minimizeOverlay() {
  const overlay = document.getElementById("neuronav-overlay");
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");

  if (!overlay) return;

  // ✅ Save original layout before minimizing
  if (!originalOverlayHTML) originalOverlayHTML = overlay.innerHTML;

  // ✅ Apply compact layout
  overlay.style.position = "fixed";
  overlay.style.top = "10px";
  overlay.style.right = "10px";
  overlay.style.width = "240px";
  overlay.style.height = "180px";
  overlay.style.background = "rgba(0,0,0,0.25)";
  overlay.style.borderRadius = "10px";
  overlay.style.boxShadow = "0 0 10px rgba(0,0,0,0.4)";
  overlay.style.overflow = "hidden";
  overlay.style.zIndex = "999999";
  overlay.innerHTML = ""; // clear existing content

  // ✅ Add webcam feed only
  if (video) {
    overlay.appendChild(video);
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.borderRadius = "10px";
  }

  // ✅ Make draggable
  makeDraggable(overlay);

  // --- Small floating controls ---
  const controls = document.createElement("div");
  controls.style = `
    position: absolute;
    bottom: 6px;
    left: 6px;
    display: flex;
    gap: 6px;
    z-index: 1000000;
  `;
  overlay.appendChild(controls);

  // Restore button
  const restoreBtn = document.createElement("button");
  restoreBtn.textContent = "⛶ Restore";
  restoreBtn.style = baseBtnStyle();
  restoreBtn.onclick = restoreOverlay;
  controls.appendChild(restoreBtn);

  // Pause button
  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = detectionPaused ? "▶️ Resume" : "⏸️ Pause";
  pauseBtn.style = baseBtnStyle();
  pauseBtn.onclick = () => {
    detectionPaused = !detectionPaused;
    pauseBtn.textContent = detectionPaused ? "▶️ Resume" : "⏸️ Pause";
    if (video)
      video.style.filter = detectionPaused
        ? "grayscale(100%) blur(2px)"
        : "none";
  };
  controls.appendChild(pauseBtn);

  // Kill button
  const killBtn = document.createElement("button");
  killBtn.textContent = "✖";
  killBtn.style = baseBtnStyle();
  killBtn.onclick = stopNeuroNav;
  controls.appendChild(killBtn);

  console.log("[🎥] Overlay minimized to corner with controls.");
}

function restoreOverlay() {
  const overlay = document.getElementById("neuronav-overlay");
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const gestureDisplay = document.getElementById("gesture");

  if (!overlay) return;

  console.log("[🔄] Restoring full overlay...");

  // Reset main overlay styles
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.borderRadius = "0";
  overlay.style.background = "rgba(0, 0, 0, 0.85)";
  overlay.style.boxShadow = "none";
  overlay.style.zIndex = "999999";
  overlay.innerHTML = ""; // clear minimized layout

  // ✅ Reattach video feed
  if (video) {
    overlay.appendChild(video);
    video.style.width = "640px";
    video.style.height = "480px";
    video.style.border = "2px solid cyan";
    video.style.borderRadius = "8px";
    video.style.display = "block";
    video.style.margin = "100px auto 20px auto";
    video.style.objectFit = "cover";
    video.style.filter = "none";
  }

  // ✅ Reattach canvas (hidden, used for tracking)
  if (canvas) {
    overlay.appendChild(canvas);
    canvas.style.display = "none";
  }

  // ✅ Reattach gesture display
  if (gestureDisplay) {
    overlay.appendChild(gestureDisplay);
    gestureDisplay.style.display = "block";
    gestureDisplay.style.textAlign = "center";
    gestureDisplay.style.fontSize = "20px";
    gestureDisplay.style.color = "white";
    gestureDisplay.style.fontFamily = "monospace";
  }

  // ✅ Add control buttons again
  const controls = document.createElement("div");
  controls.style = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
  `;
  overlay.appendChild(controls);

  // Pause/Resume Button
  const pauseBtn = document.createElement("button");
  if (detectionPaused) {
    if (video)
      video.style.filter = detectionPaused
        ? "grayscale(100%) blur(2px)"
        : "none";
  }
  pauseBtn.textContent = detectionPaused ? "▶️ Resume" : "⏸️ Pause";
  pauseBtn.style = baseBtnStyle();
  pauseBtn.onclick = () => {
    detectionPaused = !detectionPaused;
    pauseBtn.textContent = detectionPaused ? "▶️ Resume" : "⏸️ Pause";
    if (video)
      video.style.filter = detectionPaused
        ? "grayscale(100%) blur(2px)"
        : "none";
  };
  controls.appendChild(pauseBtn);

  // Stop/Kill Button
  const killBtn = document.createElement("button");
  killBtn.textContent = "✖ Stop";
  killBtn.style = baseBtnStyle();
  killBtn.onclick = stopNeuroNav;
  controls.appendChild(killBtn);

  // Minimize Button
  const minimizeBtn = document.createElement("button");
  minimizeBtn.textContent = "🔽 Minimize";
  minimizeBtn.style = baseBtnStyle();
  minimizeBtn.onclick = minimizeOverlay;
  controls.appendChild(minimizeBtn);

  console.log("[✅] Overlay restored to full calibration layout.");
}

function stopNeuroNav() {
  try {
    const overlay = document.getElementById("neuronav-overlay");
    const video = document.getElementById("video");
    if (video && video.srcObject)
      video.srcObject.getTracks().forEach((t) => t.stop());
    if (overlay) overlay.remove();
    detectionPaused = true;
    calibrationDone = false;
    console.log("[🧠] NeuroNav stopped and removed.");
  } catch (e) {
    console.error("Error stopping NeuroNav:", e);
  }
}

/* ---------------- HELPERS ---------------- */
function baseBtnStyle() {
  return `
    padding: 6px 10px;
    font-size: 13px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    background: rgba(255,255,255,0.9);
    color: #000;
  `;
}

function makeDraggable(el) {
  let offsetX = 0,
    offsetY = 0,
    isDown = false;
  el.addEventListener("mousedown", (e) => {
    isDown = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    el.style.cursor = "grabbing";
  });
  document.addEventListener("mouseup", () => {
    isDown = false;
    el.style.cursor = "move";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    el.style.left = e.clientX - offsetX + "px";
    el.style.top = e.clientY - offsetY + "px";
    el.style.right = "auto";
  });
}
/* ---------------- VOICE CONTROL INTEGRATION ---------------- */
/* ---------------- VOICE CONTROL (Click + Pause/Resume Scroll) ---------------- */
/* ---------------- VOICE CONTROL (Click + Pause/Resume Scroll) ---------------- */
function initVoiceControl() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("[🎙️] Speech recognition not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  let scrollPaused = false;

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .trim()
      .toLowerCase();
    console.log("[🎙️ Voice Command]:", transcript);

    // --- Voice "click"
    if (transcript.includes("click")) {
      if (gazeCursor) {
        const rect = gazeCursor.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + 10, rect.top + 10);
        if (target) {
          target.click();
          console.log("[🖱️] Voice clicked:", target);
          gazeCursor.style.transform += " scale(1.4)";
          setTimeout(() => {
            gazeCursor.style.transform = gazeCursor.style.transform.replace(
              " scale(1.4)",
              ""
            );
          }, 150);
        }
      }
    }

    // --- Voice "pause scrolling"
    else if (transcript.includes("pause")) {
      scrollPaused = true;
      console.log("[🛑] Scrolling paused — gaze navigation still active.");
    }

    // --- Voice "resume scrolling"
    else if (transcript.includes("resume")) {
      scrollPaused = false;
      console.log("[▶️] Scrolling resumed.");
    }
  };

  recognition.onerror = (e) =>
    console.error("[❌] Voice recognition error:", e);

  recognition.onend = () => {
    console.log("[🔁] Restarting voice recognition...");
    recognition.start();
  };

  recognition.start();
  console.log("[🎙️] Voice control initialized (click + scroll toggle)");

  // 🧭 Patch the scrolling function to respect scrollPaused
  const originalScroll = window.scrollBy;
  window.scrollBy = function (x, y) {
    if (scrollPaused) return; // ignore scroll commands while paused
    originalScroll.call(window, x, y);
  };
}

// Initialize after NeuroNav loads
loadMediaPipe();
initVoiceControl();
