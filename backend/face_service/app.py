from flask import Flask, request, jsonify
import cv2
import numpy as np
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.route("/detect_faces", methods=["POST"])
def detect_faces():
    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400
    f = request.files["file"]
    filename = secure_filename(f.filename)
    path = os.path.join(UPLOAD_DIR, filename)
    f.save(path)

    # read image
    img = cv2.imread(path)
    if img is None:
        return jsonify({"error": "invalid image"}), 400

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    boxes = []
    for (x, y, w, h) in faces:
        boxes.append({"x": int(x), "y": int(y), "w": int(w), "h": int(h)})
    return jsonify({"boxes": boxes, "count": len(boxes)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
