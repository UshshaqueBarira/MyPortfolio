# ORBITAL // APP DECK

A monochrome mission-control portfolio dashboard and Playwright keep-alive automation suite for Streamlit Community Cloud apps.

## Highlights
- **Monochrome Telemetry Aesthetic:** Deep void canvas, hairline borders, corner registration ticks, and live UTC clock.
- **Interactive Orbital Radar:** Clickable node constellation synced to your active apps.
- **Orbital Scatter Mode & Command Palette:** Toggle `ORBITAL VIEW` or press `Ctrl+K` / `Cmd+K` for instant app jumping.

## Local Run
```bash
pip install -r requirements.txt
playwright install chromium
python main.py
```

Preview locally:
```bash
python -m http.server 8000
```
Open `http://127.0.0.1:8000/`.
