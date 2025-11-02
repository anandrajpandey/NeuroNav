document.getElementById("start").addEventListener("click", () => {
  const btn = document.getElementById("start")
  btn.disabled = true
  btn.style.opacity = "0.6"
  btn.innerHTML = "<span>⏳</span> Activating..."

  window.chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    window.chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content.js"],
    })

    // Reset button after 1 second
    setTimeout(() => {
      btn.disabled = false
      btn.style.opacity = "1"
      btn.innerHTML = "<span>▶</span> Start Tracking"
    }, 1000)
  })
})

document.getElementById("stop").addEventListener("click", () => {
  window.chrome.runtime.sendMessage({ action: "stopNeuroNav" })
  const btn = document.getElementById("stop")
  btn.innerHTML = "<span>✓</span> Stopped"
  setTimeout(() => {
    btn.innerHTML = "<span>⏹</span> Stop"
  }, 1500)
})
