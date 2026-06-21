(function () {
  if (window.AFRAME) {
    AFRAME.registerComponent("native-image-tracker", {
      tick: function () {
        const sceneEl = this.el;
        const frame = sceneEl.frame;
        if (!frame || !frame.getImageTrackingResults || !sceneEl.renderer.xr) return;

        const session = sceneEl.renderer.xr.getSession();
        if (!session) return;

        const results = frame.getImageTrackingResults();
        const rig = document.getElementById("headsetRig");
        const status = document.getElementById("xrStatus");
        if (!results || !results.length || !rig) return;

        const result = results[0];
        const referenceSpace = sceneEl.renderer.xr.getReferenceSpace();
        const pose = frame.getPose(result.imageSpace, referenceSpace);
        if (!pose) return;

        rig.object3D.matrix.fromArray(pose.transform.matrix);
        rig.object3D.matrix.decompose(rig.object3D.position, rig.object3D.quaternion, rig.object3D.scale);
        rig.setAttribute("visible", "true");
        if (status) status.textContent = `Image tracking: ${result.trackingState}`;
      }
    });
  }

  const $ = (selector) => document.querySelector(selector);

  const els = {
    shell: $("#appShell"),
    appLoadedBadge: $(".app-loaded-badge"),
    landing: $("#landing"),
    scene: $("#scene"),
    imageAnchor: $("#imageAnchor"),
    mobileModel: $("#mobileModel"),
    headsetRig: $("#headsetRig"),
    headsetModel: $("#headsetModel"),
    startMobileAr: $("#startMobileAr"),
    startHeadsetMode: $("#startHeadsetMode"),
    openTarget: $("#openTarget"),
    closeTarget: $("#closeTarget"),
    printTarget: $("#printTarget"),
    targetSheet: $("#targetSheet"),
    statusText: $("#statusText"),
    statusDot: $("#statusDot"),
    controls: $("#controls"),
    stopAr: $("#stopAr"),
    exitHeadset: $("#exitHeadset"),
    scaleControl: $("#scaleControl"),
    rotateControl: $("#rotateControl"),
    targetWidthControl: $("#targetWidthControl"),
    resetPlacement: $("#resetPlacement"),
    xrStatus: $("#xrStatus")
  };

  const defaults = {
    mobileScale: 0.25,
    headsetScale: 0.35,
    rotationY: 0
  };

  let activeMode = "idle";
  let mindarSystem = null;
  let stopping = false;

  function setStatus(text, state) {
    els.statusText.textContent = text;
    els.statusDot.className = `status-dot ${state || "idle"}`;
  }

  function setControlsVisible(visible) {
    els.controls.hidden = !visible;
  }

  function setLandingVisible(visible) {
    els.landing.hidden = !visible;
    els.shell.classList.toggle("session-active", !visible);
    els.appLoadedBadge.classList.toggle("hidden", !visible);
  }

  function applyPlacement() {
    const scale = Number(els.scaleControl.value);
    const rotationY = Number(els.rotateControl.value);
    const model = activeMode === "headset" ? els.headsetModel : els.mobileModel;

    if (!model) return;

    model.setAttribute("scale", `${scale} ${scale} ${scale}`);
    model.setAttribute("rotation", `0 ${rotationY} 0`);
  }

  function resetPlacement() {
    const scale = activeMode === "headset" ? defaults.headsetScale : defaults.mobileScale;
    els.scaleControl.value = scale;
    els.rotateControl.value = defaults.rotationY;
    applyPlacement();
  }

  async function getMindarSystem() {
    if (mindarSystem) return mindarSystem;
    if (!els.scene.hasLoaded) {
      await new Promise((resolve) => els.scene.addEventListener("loaded", resolve, { once: true }));
    }
    mindarSystem = els.scene.systems["mindar-image-system"];
    return mindarSystem;
  }

  async function startMobileAr() {
    activeMode = "mobile";
    setLandingVisible(false);
    setControlsVisible(true);
    resetPlacement();
    setStatus("Starting camera...", "busy");

    try {
      const system = await getMindarSystem();
      if (!system) throw new Error("MindAR image system was not created.");
      await system.start();
      setStatus("Scanning for the cat target", "busy");
    } catch (error) {
      console.error(error);
      setStatus("Camera or MindAR failed to start", "error");
      setLandingVisible(true);
      setControlsVisible(false);
      activeMode = "idle";
    }
  }

  async function stopMobileAr() {
    const system = await getMindarSystem().catch(() => null);
    if (system) system.stop();
  }

  async function imageTrackingSupportHint() {
    if (!navigator.xr || !window.createImageBitmap || !window.XRSession) {
      return "WebXR image tracking is not exposed in this browser.";
    }

    const hasFrameApi = "XRFrame" in window && "getImageTrackingResults" in XRFrame.prototype;
    if (!hasFrameApi) {
      return "This browser does not expose native WebXR image tracking.";
    }

    return "Native image tracking API detected. If the headset accepts tracked images, the app will use it.";
  }

  async function configureTrackedImages() {
    if (!window.createImageBitmap || !els.scene.systems.webxr) return false;

    try {
      const response = await fetch("cat-print-target.png", { cache: "force-cache" });
      const blob = await response.blob();
      const image = await createImageBitmap(blob);
      const widthInMeters = Math.max(0.04, Number(els.targetWidthControl.value || 12) / 100);

      els.scene.systems.webxr.sessionConfiguration = {
        ...(els.scene.systems.webxr.sessionConfiguration || {}),
        optionalFeatures: ["local-floor", "bounded-floor", "hit-test", "dom-overlay", "image-tracking"],
        domOverlay: { root: els.xrStatus.closest("#xrOverlay") },
        trackedImages: [{ image, widthInMeters }]
      };
      return true;
    } catch (error) {
      console.warn("Could not prepare WebXR tracked image.", error);
      return false;
    }
  }

  async function startHeadsetMode() {
    activeMode = "headset";
    setLandingVisible(false);
    setControlsVisible(true);
    els.headsetRig.setAttribute("visible", "true");
    resetPlacement();

    const supportHint = await imageTrackingSupportHint();
    setStatus("Preparing headset mode", "busy");
    els.xrStatus.textContent = supportHint;
    await configureTrackedImages();

    try {
      if (navigator.xr) {
        const arSupported = await navigator.xr.isSessionSupported("immersive-ar").catch(() => false);
        if (arSupported && typeof els.scene.enterAR === "function") {
          await els.scene.enterAR();
          setStatus("Headset AR mode active", "found");
          return;
        }

        const vrSupported = await navigator.xr.isSessionSupported("immersive-vr").catch(() => false);
        if (vrSupported) {
          await els.scene.enterVR();
          setStatus("Headset VR mode active", "found");
          return;
        }
      }

      setStatus("Headset WebXR unavailable; showing desktop preview", "busy");
    } catch (error) {
      console.error(error);
      setStatus("Headset session could not start", "error");
    }
  }

  async function stopSession() {
    if (stopping) return;
    stopping = true;

    if (activeMode === "mobile") {
      await stopMobileAr();
    }

    if (els.scene.is("vr-mode")) {
      els.scene.exitVR();
    }

    activeMode = "idle";
    els.headsetRig.setAttribute("visible", "false");
    setLandingVisible(true);
    setControlsVisible(false);
    setStatus("Ready", "idle");
    stopping = false;
  }

  function wireTargetEvents() {
    els.imageAnchor.addEventListener("targetFound", () => {
      if (activeMode === "mobile") setStatus("Cat target found - model anchored", "found");
    });

    els.imageAnchor.addEventListener("targetLost", () => {
      if (activeMode === "mobile") setStatus("Target lost - point at the printed cat", "busy");
    });
  }

  function wireHeadsetPlacement() {
    const placeInFront = () => {
      if (activeMode !== "headset") return;
      const camera = els.scene.camera;
      if (!camera) return;

      const direction = new THREE.Vector3();
      const position = new THREE.Vector3();
      camera.getWorldDirection(direction);
      camera.getWorldPosition(position);
      direction.multiplyScalar(1.6);
      position.add(direction);
      position.y -= 0.25;

      els.headsetRig.object3D.position.copy(position);
      els.headsetRig.object3D.lookAt(camera.position);
      els.xrStatus.textContent = "Placed. Use controls to scale or rotate.";
    };

    ["leftHand", "rightHand"].forEach((id) => {
      const hand = document.getElementById(id);
      hand.addEventListener("triggerdown", placeInFront);
      hand.addEventListener("gripdown", placeInFront);
    });
  }

  function wireUi() {
    els.startMobileAr.addEventListener("click", startMobileAr);
    els.startHeadsetMode.addEventListener("click", startHeadsetMode);
    els.stopAr.addEventListener("click", stopSession);
    els.exitHeadset.addEventListener("click", stopSession);
    els.scaleControl.addEventListener("input", applyPlacement);
    els.rotateControl.addEventListener("input", applyPlacement);
    els.resetPlacement.addEventListener("click", resetPlacement);

    els.openTarget.addEventListener("click", () => {
      els.targetSheet.hidden = false;
    });

    els.closeTarget.addEventListener("click", () => {
      els.targetSheet.hidden = true;
    });

    els.printTarget.addEventListener("click", () => {
      window.print();
    });

    window.addEventListener("beforeunload", () => {
      if (mindarSystem && activeMode === "mobile") mindarSystem.stop();
    });

    els.scene.addEventListener("enter-vr", () => {
      document.body.classList.add("xr-active");
    });

    els.scene.addEventListener("exit-vr", () => {
      document.body.classList.remove("xr-active");
      if (activeMode === "headset") stopSession();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    els.scene.setAttribute("native-image-tracker", "");
    wireUi();
    wireTargetEvents();
    wireHeadsetPlacement();
    setStatus("Ready", "idle");
  });
})();
