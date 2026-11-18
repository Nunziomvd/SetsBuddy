# SetsBuddy

A workout and habit tracker that installs on your iPhone like an app.

- **Routines**: pre-made workouts with target sets, reps, rest times and notes
- **Weekly plan**: a routine for each day, a daily pick, and streaks
- **Live logging**: previous numbers on every set, a rest timer, automatic PR detection
- **Progress**: estimated 1-rep max charts per exercise, and a 12-week training calendar
- **Trackers**: log anything daily (body weight, water, sleep…) with charts
- Works offline. All data stays on your device, with JSON backup and restore.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.

## Run locally

No build step is needed. Serve the folder with any static server, for example:

```bash
python -m http.server 8765
```

Then open http://localhost:8765.
