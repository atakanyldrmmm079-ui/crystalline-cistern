import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function makeEnergyParticles(count = 1800, radius = 6, height = 5) {
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.72) * radius;

    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = -2.4 + Math.random() * height;
    positions[i * 3 + 2] = Math.sin(a) * r - 1.4;

    randoms[i * 4] = Math.random();
    randoms[i * 4 + 1] = Math.random();
    randoms[i * 4 + 2] = Math.random();
    randoms[i * 4 + 3] = Math.random();
  }

  return { positions, randoms };
}

export default function EnergyParticleField({
  scroll = 0,
  color = "#78fff0",
  secondaryColor = "#68ff9a",
  count = 2200,
  size = 0.018,
  opacity = 0.16,
  hover = false,
  visible = 1,
}) {
  const points = useRef();

  const { positions, randoms } = useMemo(
    () => makeEnergyParticles(count, 7.4, 5.8),
    [count]
  );

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uSecondaryColor: { value: new THREE.Color(secondaryColor) },
        uSize: { value: size },
        uOpacity: { value: opacity },
        uHover: { value: 0 },
        uVisible: { value: visible },
      },
      vertexShader: `
        attribute vec4 random;

        uniform float uTime;
        uniform float uScroll;
        uniform float uSize;
        uniform float uHover;
        uniform float uVisible;

        varying vec4 vRandom;
        varying float vAlpha;
        varying float vEnergy;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec3 p) {
          float n = sin(p.x * 1.7 + p.z * 2.4 + uTime * 0.35);
          n += sin(p.y * 2.1 - p.x * 1.3 + uTime * 0.22);
          n += sin(p.z * 1.5 + p.y * 1.9 - uTime * 0.28);
          return n / 3.0;
        }

        void main() {
          vRandom = random;

          vec3 pos = position;

          float swirl = uTime * (0.12 + random.x * 0.18) + uScroll * 3.0;
          float n = noise(pos * 0.35 + random.xyz);

          pos.x += cos(swirl + pos.y * 0.42) * 0.16 * random.y;
          pos.z += sin(swirl + pos.y * 0.38) * 0.16 * random.z;
          pos.y += n * 0.12;
          pos.y -= uScroll * 0.8 * random.w;

          float focus = smoothstep(0.18, 0.75, uScroll);
          float lift = pow(random.x, 9.0) * focus * 1.2;
          pos.y += lift;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

          float perspective = 900.0 / max(1.0, length(mvPosition.xyz));
          float pulse = 0.72 + sin(uTime * 2.4 + random.x * 20.0) * 0.28;
          float hoverBoost = mix(1.0, 1.65, uHover);

          gl_PointSize = uSize * perspective * pulse * hoverBoost * uVisible;
          gl_Position = projectionMatrix * mvPosition;

          vEnergy = pulse;
          vAlpha = smoothstep(10.0, 2.0, length(mvPosition.xyz));
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform vec3 uColor;
        uniform vec3 uSecondaryColor;
        uniform float uOpacity;
        uniform float uHover;
        uniform float uVisible;

        varying vec4 vRandom;
        varying float vAlpha;
        varying float vEnergy;

        void main() {
          vec2 uv = gl_PointCoord.xy - 0.5;
          float d = length(uv);

          float halo = 1.0 - smoothstep(0.12, 0.5, d);
          float core = 1.0 - smoothstep(0.0, 0.15, d);

          float alpha = (halo * 0.82 + core * 0.32) * uOpacity * vAlpha * uVisible;
          alpha *= mix(1.0, 1.55, uHover);

          if (alpha < 0.004) discard;

          vec3 color = mix(uColor, uSecondaryColor, vRandom.y * 0.38);
          color = mix(color, vec3(1.0), core * 0.34 + vEnergy * 0.08);

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    if (!points.current) return;

    const t = state.clock.elapsedTime;

    points.current.rotation.y = t * 0.018 + scroll * 0.85;
    points.current.rotation.x = Math.sin(t * 0.13) * 0.025;

    material.uniforms.uTime.value = t;
    material.uniforms.uScroll.value = scroll;
    material.uniforms.uColor.value.set(color);
    material.uniforms.uSecondaryColor.value.set(secondaryColor);
    material.uniforms.uSize.value = hover ? size * 1.35 : size;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uHover.value = hover ? 1 : 0;
    material.uniforms.uVisible.value = visible;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-random"
          array={randoms}
          count={randoms.length / 4}
          itemSize={4}
        />
      </bufferGeometry>

      <primitive object={material} attach="material" />
    </points>
  );
}