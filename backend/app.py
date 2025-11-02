from flask import Flask, request, jsonify
from flask_cors import CORS
from fer.fer import FER

import numpy as np
import cv2
import base64

app = Flask(__name__)
CORS(app)

detector = FER(mtcnn=True)  # Pretrained CNN model

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if 'frame' not in data:
        return jsonify({"error": "no frame received"}), 400

    # Decode base64 image
    img_data = base64.b64decode(data['frame'])
    np_img = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    # Predict gesture (emotion)
    try:
        emotion, score = detector.top_emotion(frame)
    except Exception as e:
        return jsonify({"gesture": "none", "error": str(e)})

    gesture = "none"
    if emotion == "happy":
        gesture = "smile"
    elif emotion == "angry":
        gesture = "frown"
    elif emotion == "surprise":
        gesture = "eyebrow_raise"
    elif emotion == "neutral":
        gesture = "neutral"

    return jsonify({"gesture": gesture, "confidence": score})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(debug=True)
