# Augmentiverse Cat AR

This webapp anchors `happy.glb` to a printed cat image on phones and tablets using MindAR image tracking. It also includes a WebXR headset mode for devices such as Quest 3S.

## What Works

- Phone and tablet browsers: camera-based image tracking with `targets.mind`.
- Quest/headset browsers: WebXR mode with controller placement.
- Experimental headset image tracking: the app prepares WebXR `trackedImages` when the browser exposes the API, but headset support varies by browser and firmware.

## Files

- `index.html` - app shell and A-Frame scene.
- `styles.css` - responsive interface and print target layout.
- `app.js` - AR session flow, MindAR events, controls, and WebXR setup.
- `happy.glb` - anchored 3D model.
- `cat-print-target.png` - physical image target to print.
- `targets.mind` - compiled MindAR target.
- `augmentiverse-manifest.json` - project metadata.
- `site.webmanifest` - installable web app manifest.

## Run Locally

From this folder:

```powershell
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

For phones and headsets, deploy to HTTPS. Camera, WebXR, and service-worker style features require a secure context on real devices.

## Use On A Phone

1. Print `cat-print-target.png`.
2. Open the deployed HTTPS URL in Chrome, Edge, Safari, or Samsung Internet.
3. Tap `Start Phone AR`.
4. Point the camera at the printed target.
5. Use the controls to scale or rotate the model.

## Use On Quest 3S

1. Open the deployed HTTPS URL in Meta Quest Browser.
2. Set the printed target width to match your print.
3. Tap `Enter Headset Mode`.
4. If the browser exposes native image tracking, the app attempts to use it.
5. If image tracking is unavailable, use trigger or grip to place the model in front of you, then adjust scale and rotation.

## Notes

- The original `index.html` referenced `cat-target.jpg`, but the project only includes `cat-print-target.png`.
- The original README had a broken code block and did not include deployment guidance.
- MindAR can track the image from the phone camera, but Quest browser passthrough camera frames are not available to normal web pages, so the phone and headset paths cannot be identical.
