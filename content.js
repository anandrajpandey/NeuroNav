if (window.neuroNavLoaded) {
  console.log(" NeuroNav already running");
} else {
  window.neuroNavLoaded = true;
  console.log(" NeuroNav starting...");

  // Prepare CSS (DO NOT inject into document.head)
  const styleEl = document.createElement("link");
  styleEl.rel = "stylesheet";
  styleEl.type = "text/css";
  styleEl.href = chrome.runtime.getURL("style.css");

  console.log(" Loaded CSS from:", styleEl.href);

  fetch(chrome.runtime.getURL("popup_page.html"))
    .then((r) => r.text())
    .then((html) => {
      const container = document.createElement("div");
      container.id = "neuronav-overlay";
      container.style = container.style = `
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0,0,0,0.85);
  overflow: auto;
  pointer-events: auto; /* ✅ IMPORTANT */
`;

      // ✅ IMPORTANT: attach CSS to overlay, NOT document.head
      container.appendChild(styleEl);

      // Inject HTML
      container.innerHTML += html;
      document.body.appendChild(container);
      const highlightStyle = document.createElement("style");
      highlightStyle.textContent = `
  .gaze-highlight {
    box-shadow: 0 0 0 3px cyan !important;
    border-radius: 4px;
  }
`;

      document.head.appendChild(highlightStyle);

      // Load main script
      const scriptEl = document.createElement("script");
      scriptEl.src = chrome.runtime.getURL("script.js");
      document.body.appendChild(scriptEl);

      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "stopNeuroNav") {
          container.remove();
          window.neuroNavLoaded = false;
          console.log(" NeuroNav stopped.");
        }
      });
    });
}
