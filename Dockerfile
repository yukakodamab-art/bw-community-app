FROM python:3.11-slim

# ffmpeg for frame extraction, fonts-noto-cjk for the Japanese bold text overlay
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads static/frames static/output

ENV PORT=5000
EXPOSE 5000

# gunicorn = production server (Flask's own dev server used by app.py is only for local testing)
CMD ["sh", "-c", "gunicorn -w 2 -b 0.0.0.0:${PORT} --timeout 300 app:app"]
