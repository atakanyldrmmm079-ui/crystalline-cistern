import * as THREE from "three";

export function getAdaptiveDpr(maxDesktop = 1.35, maxMobile = 1.15) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const device = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(device, isMobile ? maxMobile : maxDesktop);
}

export function getCanvasPerformanceProps() {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  return {
    dpr: [1, getAdaptiveDpr()],
    gl: {
      antialias: !isMobile,
      alpha: false,
      powerPreference: "high-performance",
      precision: "mediump",
    },
  };
}

export function prepareRenderer(gl, exposure = 1) {
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = exposure;
}
