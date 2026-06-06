import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function FlowingRootTubes({
  connections = [],
  getNode,
  activeIds = [],
  scroll = 0,
  color = "#7bfff1",
  inactiveColor = "#315d58",
  opacity = 0.32,
  radius = 0.012,
  visible = 1,
}) {
  const group = useRef();

  const items = useMemo(() => {
    return connections
      .map(([from, to]) => {
        const a = getNode(from);
        const b = getNode(to);

        if (!a || !b) return null;

        const start = new THREE.Vector3(...a.position);
        const end = new THREE.Vector3(...b.position);

        const midA = new THREE.Vector3(
          start.x * 0.68 + end.x * 0.32,
          Math.max(start.y, end.y) + 0.22,
          start.z * 0.62 + end.z * 0.38 - 0.32
        );

        const midB = new THREE.Vector3(
          start.x * 0.32 + end.x * 0.68,
          Math.max(start.y, end.y) + 0.1,
          start.z * 0.38 + end.z * 0.62 - 0.2
        );

        const curve = new THREE.CatmullRomCurve3([start, midA, midB, end]);

        return {
          id: `${from}-${to}`,
          from,
          to,
          curve,
          geometry: new THREE.TubeGeometry(curve, 96, radius, 8, false),
        };
      })
      .filter(Boolean);
  }, [connections, getNode, radius]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uInactiveColor: { value: new THREE.Color(inactiveColor) },
        uOpacity: { value: opacity },
        uActive: { value: 0 },
        uReveal: { value: 0 },
        uVisible: { value: visible },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        precision highp float;

        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uInactiveColor;
        uniform float uOpacity;
        uniform float uActive;
        uniform float uReveal;
        uniform float uVisible;

        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          float flow = fract(vUv.x * 3.0 - uTime * mix(0.25, 0.72, uActive));
          float pulse = smoothstep(0.72, 1.0, flow);
          float vein = smoothstep(0.02, 0.0, abs(vUv.y - 0.5));

          vec3 base = mix(uInactiveColor, uColor, uActive);
          vec3 color = base + uColor * pulse * mix(0.18, 0.75, uActive);

          float alpha = uOpacity * uReveal * uVisible;
          alpha *= mix(0.28, 1.0, uActive);
          alpha *= 0.45 + vein * 0.55 + pulse * 0.38;

          if (alpha < 0.004) discard;

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;
    const reveal = THREE.MathUtils.clamp((scroll - 0.36) / 0.18, 0, 1);
    const mapFade = 1 - THREE.MathUtils.clamp((scroll - 0.86) / 0.12, 0, 1);

    group.current.children.forEach((child) => {
      const isActive =
        activeIds.includes(child.userData.from) ||
        activeIds.includes(child.userData.to);

      const mat = child.material;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uColor.value.set(color);
      mat.uniforms.uInactiveColor.value.set(inactiveColor);
      mat.uniforms.uOpacity.value = opacity;
      mat.uniforms.uActive.value = isActive ? 1 : 0;
      mat.uniforms.uReveal.value = reveal * mapFade;
      mat.uniforms.uVisible.value = visible;
    });
  });

  return (
    <group ref={group}>
      {items.map((item) => (
        <mesh
          key={item.id}
          geometry={item.geometry}
          userData={{ from: item.from, to: item.to }}
        >
          <primitive object={material.clone()} attach="material" />
        </mesh>
      ))}
    </group>
  );
}