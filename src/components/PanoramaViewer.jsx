import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function PanoramaViewer({
  src,
  initialFov = 98,
  minFov = 55,
  maxFov = 110,
  initialLon = 0,
  initialLat = 0,
}) {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const [status, setStatus] = useState("loading");

  const stateRef = useRef({
    isDown: false,
    lastX: 0,
    lastY: 0,
    lon: initialLon,
    lat: initialLat,
  });

  useEffect(() => {
    stateRef.current.lon = initialLon;
    stateRef.current.lat = initialLat;
  }, [initialLon, initialLat]);

  useEffect(() => {
    if (!mountRef.current || !src) {
      setStatus("missing");
      return;
    }

    const mount = mountRef.current;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);

    setStatus("loading");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(initialFov, width / height, 0.1, 1200);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 128, 80);
    geometry.scale(-1, 1, 1);

    let texture = null;
    let material = null;
    let sphere = null;
    let disposed = false;

    const loader = new THREE.TextureLoader();

    loader.load(
      src,
      (loadedTexture) => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }

        texture = loadedTexture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        material = new THREE.MeshBasicMaterial({ map: texture });
        sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
        setStatus("ready");
      },
      undefined,
      () => setStatus("error")
    );

    function updateCamera() {
      const state = stateRef.current;
      state.lat = Math.max(-82, Math.min(82, state.lat));

      const phi = THREE.MathUtils.degToRad(90 - state.lat);
      const theta = THREE.MathUtils.degToRad(state.lon);

      const x = 500 * Math.sin(phi) * Math.cos(theta);
      const y = 500 * Math.cos(phi);
      const z = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(x, y, z);
    }

    function animate() {
      updateCamera();
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    }

    animate();

    function onPointerDown(event) {
      stateRef.current.isDown = true;
      stateRef.current.lastX = event.clientX;
      stateRef.current.lastY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event) {
      const state = stateRef.current;
      if (!state.isDown) return;

      const deltaX = event.clientX - state.lastX;
      const deltaY = event.clientY - state.lastY;

      state.lon -= deltaX * 0.12;
      state.lat += deltaY * 0.08;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
    }

    function onPointerUp(event) {
      stateRef.current.isDown = false;
      renderer.domElement.releasePointerCapture?.(event.pointerId);
    }

    function onWheel(event) {
      event.preventDefault();
      camera.fov += event.deltaY * 0.025;
      camera.fov = THREE.MathUtils.clamp(camera.fov, minFov, maxFov);
      camera.updateProjectionMatrix();
    }

    function onResize() {
      const nextWidth = Math.max(1, mount.clientWidth);
      const nextHeight = Math.max(1, mount.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);

      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);

      if (sphere) scene.remove(sphere);
      if (texture) texture.dispose();
      if (material) material.dispose();
      geometry.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [src, initialFov, minFov, maxFov, initialLon, initialLat]);

  return (
    <div className="panoramaViewer" ref={mountRef}>
      {status === "loading" && <div className="panoramaFallback">LOADING 360 IMAGE</div>}
      {status === "missing" && <div className="panoramaFallback">360 IMAGE MISSING</div>}
      {status === "error" && <div className="panoramaFallback">360 IMAGE COULD NOT LOAD</div>}
    </div>
  );
}
