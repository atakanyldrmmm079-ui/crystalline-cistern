import { useMemo } from "react";
import * as THREE from "three";

export function useCrystalGlassMaterial({
  color = "#7dfff2",
  glowColor = "#78fff0",
  opacity = 0.62,
  distortion = 0.08,
  fresnelPower = 1.7,
  timeRef,
} = {}) {
  return useMemo(() => {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uGlowColor: { value: new THREE.Color(glowColor) },
        uOpacity: { value: opacity },
        uDistortion: { value: distortion },
        uFresnelPower: { value: fresnelPower },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;

          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;

          vNormal = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uGlowColor;
        uniform float uOpacity;
        uniform float uDistortion;
        uniform float uFresnelPower;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          vec2 u = f * f * (3.0 - 2.0 * f);

          return mix(a, b, u.x) +
            (c - a) * u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
        }

        float fresnel(vec3 normal, vec3 viewDir, float power) {
          float d = dot(normalize(normal), normalize(viewDir));
          return 1.0 - pow(abs(d), power);
        }

        void main() {
          vec2 uv = vUv;

          float n1 = noise(uv * 18.0 + uTime * 0.08);
          float n2 = noise(uv * 42.0 - uTime * 0.05);
          float frost = n1 * 0.55 + n2 * 0.45;

          float f = fresnel(vNormal, vViewDir, uFresnelPower);

          float edgeX = smoothstep(0.0, 0.08, uv.x) * smoothstep(0.0, 0.08, 1.0 - uv.x);
          float edgeY = smoothstep(0.0, 0.08, uv.y) * smoothstep(0.0, 0.08, 1.0 - uv.y);
          float edge = 1.0 - edgeX * edgeY;

          vec3 base = mix(vec3(0.04, 0.11, 0.12), uColor, 0.34);
          base += frost * 0.12;
          base += uGlowColor * f * 0.48;
          base += uGlowColor * edge * 0.32;

          float alpha = uOpacity * (0.34 + f * 0.38 + edge * 0.25 + frost * 0.08);

          gl_FragColor = vec4(base, alpha);
        }
      `,
    });

    material.userData.updateGlass = (time, settings = {}) => {
      material.uniforms.uTime.value = time;

      if (settings.color) {
        material.uniforms.uColor.value.set(settings.color);
      }

      if (settings.glowColor) {
        material.uniforms.uGlowColor.value.set(settings.glowColor);
      }

      if (typeof settings.opacity === "number") {
        material.uniforms.uOpacity.value = settings.opacity;
      }

      if (typeof settings.distortion === "number") {
        material.uniforms.uDistortion.value = settings.distortion;
      }

      if (typeof settings.fresnelPower === "number") {
        material.uniforms.uFresnelPower.value = settings.fresnelPower;
      }
    };

    return material;
  }, []);
}