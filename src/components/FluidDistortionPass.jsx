import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export default function FluidDistortionPass({ enabled = true }) {
  const ref = useRef();

  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    const canvas = texture.image;
    const ctx = canvas.getContext("2d");

    function loop() {
      ctx.fillStyle = "rgba(0,0,0,0.055)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const t = performance.now() * 0.001;

      for (let i = 0; i < 4; i++) {
        const x = canvas.width * (0.5 + Math.sin(t * 0.7 + i * 1.3) * 0.32);
        const y = canvas.height * (0.5 + Math.cos(t * 0.5 + i * 1.8) * 0.32);

        const g = ctx.createRadialGradient(x, y, 0, x, y, 70);
        g.addColorStop(0, "rgba(120,255,240,0.30)");
        g.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 70, 0, Math.PI * 2);
        ctx.fill();
      }

      texture.needsUpdate = true;
      raf = requestAnimationFrame(loop);
    }

    loop();

    return () => cancelAnimationFrame(raf);
  }, [enabled, texture]);

  ref.current = texture;

  return null;
}