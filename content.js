if (window.neuroNavLoaded) {
  console.log("[ℹ️] NeuroNav already running");
} else {
  window.neuroNavLoaded = true;
  console.log("[🧠] NeuroNav starting...");

  // Inject CSS
  const styleEl = document.createElement("link");
  styleEl.rel = "stylesheet";
  styleEl.type = "text/css";
  styleEl.href = chrome.runtime.getURL("style.css");
  document.head.appendChild(styleEl);

  console.log("[🎨] Loaded CSS from:", styleEl.href);
  document.head.appendChild(styleEl);

  // Inject HTML directly into current page
  console.log(chrome.runtime.getURL("popup_page.html"));

  fetch(chrome.runtime.getURL("popup_page.html"))
    .then((r) => r.text())
    .then((html) => {
      const container = document.createElement("div");
      container.id = "neuronav-overlay";
      container.style =
        "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:rgba(0,0,0,0.85);overflow:auto;";
      container.innerHTML = html;
      document.body.appendChild(container);

      // Load main script (your working script.js)
      const scriptEl = document.createElement("script");
      scriptEl.src = chrome.runtime.getURL("script.js");
      document.body.appendChild(scriptEl);

      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "stopNeuroNav") {
          container.remove();
          window.neuroNavLoaded = false;
          console.log("[🧠] NeuroNav stopped.");
        }
      });
    });
}
