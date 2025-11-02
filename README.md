# NeuroNav: AI-Powered Hands-Free Web Navigation
> Control your browser with just your eyes, gestures, and voice.

NeuroNav is an intelligent, camera-based web navigation system that lets users interact with webpages **without using a mouse or keyboard**.  
It combines **MediaPipe FaceMesh**, **Iris Tracking**, **Facial Gesture Recognition**, and **Voice Commands** to create a smooth, accessible, and futuristic browsing experience.

---

##  Features

###  Eye Tracking & Scrolling
- Uses **MediaPipe FaceMesh** to track iris movement in real time.
- Automatically scrolls the page up/down based on gaze direction.

###  Gaze-Based Cursor Control
- Displays a floating on-screen cursor following your gaze.
- Highlights clickable elements dynamically for intuitive selection.

### Gesture Interaction
- **Smile** — performs a click on the focused element.
- **Raise eyebrows** — toggles pause/resume for eye-based scrolling.

###  Voice Commands (Web Speech API)
Use your voice to control actions:
| Command | Action |
|----------|---------|
| `click` | Click the currently focused element |
| `pause scrolling` | Pause automatic scrolling for reading/navigation |
| `resume scrolling` | Resume gaze-based scrolling |

### 🪟 Adaptive Overlay UI
- Start/Stop and Pause/Resume controls built directly into the overlay.
- Draggable and minimizable webcam preview window.
- One-click “Kill” button to stop all tracking instantly.

###  Smart Focus Blocks
- Automatically divides the webpage into **interactive blocks** (buttons, links, images).
- Gaze cursor intelligently jumps between visible elements for easy interaction.

###  Auto Recalibration
- If your gaze cursor goes out of screen for more than **5 seconds**, NeuroNav **recenters** and **recalibrates** automatically.

---

##  Tech Stack

**Frontend**
- HTML, CSS, JavaScript, React, TypeScript  
- MediaPipe FaceMesh  
- Web Speech API (Voice Control)  
- WebRTC (Camera Streaming)

**Backend**
- Python (Flask)  
- OpenCV  
- Deep Learning model for gesture detection

---

## ⚙️ How It Works

1. **Start Calibration**
   - Follow the on-screen dots to map eye positions to screen coordinates.

2. **Begin Navigation**
   - Move your eyes to scroll through the page.
   - Gaze cursor highlights interactive blocks.

3. **Interact**
   - Smile to click, or use voice commands (`click`, `pause`, `resume`).

4. **Pause & Resume**
   - Raise eyebrows or use voice commands to control scrolling.

5. **Auto Centering**
   - If you move out of frame for too long, NeuroNav repositions and recalibrates automatically.

---


## 🧑‍💻 Installation & Setup

### 1️⃣ Backend Setup (Python)
```bash
git clone https://github.com/anandrajpandey/NeuroNav.git
cd NeuroNav/backend
pip install -r requirements.txt
python app.py
