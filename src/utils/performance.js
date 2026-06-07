import * as THREE from "three";

export function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getAdaptiveDpr(maxDesktop = 1.25, maxMobile = 0.95) {
  const device = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(device, isMobileDevice() ? maxMobile : maxDesktop);
}

export function getCanvasPerformanceProps() {
  const mobile = isMobileDevice();
  return {
    dpr: [0.75, getAdaptiveDpr()],
    gl: {
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: "high-performance",
      precision: mobile ? "lowp" : "mediump",
    },
    performance: { min: mobile ? 0.42 : 0.55 },
  };
}

export function prepareRenderer(gl, exposure = 1) {
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = exposure;
}
