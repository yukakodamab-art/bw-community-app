# -*- coding: utf-8 -*-
"""
BW Community Image Generator - prototype web app.

Flow:
  1. POST /api/upload   - upload a video, server extracts thumbnail frames via ffmpeg
  2. (frontend) user clicks frames from the gallery into slide slots
  3. POST /api/generate - server composites the chosen frames into 1080x1080 slides

Run locally:
  pip install -r requirements.txt
  python app.py
  -> open http://localhost:5000
"""
import os
import subprocess
import uuid
import shutil

from flask import Flask, request, jsonify, render_template, send_from_directory

from imgspec import build_slide

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
FRAMES_DIR = os.path.join(BASE_DIR, "static", "frames")
OUTPUT_DIR = os.path.join(BASE_DIR, "static", "output")

for d in (UPLOAD_DIR, FRAMES_DIR, OUTPUT_DIR):
    os.makedirs(d, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # 1GB videos ok


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/upload", methods=["POST"])
def upload():
    video = request.files.get("video")
    if not video:
        return jsonify({"error": "動画ファイルがありません"}), 400

    fps = request.form.get("fps", "2")  # frames per second to sample

    session_id = uuid.uuid4().hex[:12]
    session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
    session_frames_dir = os.path.join(FRAMES_DIR, session_id)
    os.makedirs(session_upload_dir, exist_ok=True)
    os.makedirs(session_frames_dir, exist_ok=True)

    ext = os.path.splitext(video.filename)[1] or ".mp4"
    video_path = os.path.join(session_upload_dir, f"video{ext}")
    video.save(video_path)

    # extract frames with ffmpeg
    out_pattern = os.path.join(session_frames_dir, "f_%04d.jpg")
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps={fps},scale=960:-1",
        "-qscale:v", "3",
        out_pattern,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=600)
    except subprocess.CalledProcessError as e:
        return jsonify({"error": "動画の解析に失敗しました", "detail": e.stderr.decode(errors="ignore")}), 500
    except FileNotFoundError:
        return jsonify({"error": "ffmpeg が見つかりません。サーバーに ffmpeg をインストールしてください。"}), 500

    frame_files = sorted(os.listdir(session_frames_dir))
    frames = [
        {"id": f"{session_id}/{fname}", "url": f"/static/frames/{session_id}/{fname}"}
        for fname in frame_files
    ]

    return jsonify({"session_id": session_id, "frames": frames})


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True)
    session_id = data.get("session_id")
    slides = data.get("slides", [])

    if not session_id or not slides:
        return jsonify({"error": "session_id と slides が必要です"}), 400

    session_output_dir = os.path.join(OUTPUT_DIR, session_id)
    os.makedirs(session_output_dir, exist_ok=True)

    results = []
    for idx, slide in enumerate(slides, start=1):
        frame1_id = slide.get("frame1")
        frame2_id = slide.get("frame2")
        if not frame1_id or not frame2_id:
            return jsonify({"error": f"スライド{idx}: 画像が2枚選ばれていません"}), 400

        frame1_path = os.path.join(FRAMES_DIR, frame1_id)
        frame2_path = os.path.join(FRAMES_DIR, frame2_id)
        if not (os.path.exists(frame1_path) and os.path.exists(frame2_path)):
            return jsonify({"error": f"スライド{idx}: 画像ファイルが見つかりません"}), 400

        title_h = 170 if slide.get("has_title") else 0
        kicker = slide.get("kicker", "") or ""
        headline = slide.get("headline", "") or ""

        img = build_slide(frame1_path, frame2_path, title_h=title_h, kicker=kicker, headline=headline)
        out_name = f"slide_{idx}.jpg"
        out_path = os.path.join(session_output_dir, out_name)
        img.save(out_path, quality=92)

        results.append({"url": f"/static/output/{session_id}/{out_name}"})

    return jsonify({"slides": results})


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory(os.path.join(BASE_DIR, "static"), path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
