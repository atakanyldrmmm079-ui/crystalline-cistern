import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

function makePanelTextTexture(current) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(230,255,250,0.9)";
  ctx.font = "600 26px Inter, Arial, sans-serif";
  ctx.fillText(`NODE ${current?.number || "01"} / ${current?.role || "Origin Core"}`.toUpperCase(), 70, 82);

  ctx.strokeStyle = "rgba(140,255,240,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 112);
  ctx.lineTo(920, 112);
  ctx.stroke();

  ctx.fillStyle = "rgba(248,255,253,0.96)";
  ctx.font = "300 64px Inter, Arial, sans-serif";
  ctx.fillText((current?.fullName || "Basilica Cistern").toUpperCase(), 70, 202);

  ctx.fillStyle = "rgba(220,245,240,0.72)";
  ctx.font = "300 25px Inter, Arial, sans-serif";

  const text =
    current?.text ||
    "The first crystalline core awakens where water once stood still.";

  const words = text.split(" ");
  let line = "";
  let y = 276;

  for (const word of words) {
    const test = line + word + " ";

    if (ctx.measureText(test).width > 820) {
      ctx.fillText(line, 70, y);
      line = word + " ";
      y += 40;
    } else {
      line = test;
    }
  }

  ctx.fillText(line, 70, y);

  ctx.fillStyle = "rgba(135,255,242,0.64)";
  ctx.font = "500 22px Inter, Arial, sans-serif";
  ctx.fillText(
    `ENERGY ${current?.density || "92%"}   FLOW ${current?.flow || "High"}   STATUS ${
      current?.status || "Awake"
    }`.toUpperCase(),
    70,
    455
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return texture;
}

export default function FrostedGlassPanel({
  current,
  visible = 1,
  position = [2, -0.24, 1.22],
  rotation = [-0.06, -0.42, 0],
  scale = 0.92,
  width = 2.55,
  height = 1.62,
  thickness = 0.08,
  radius = 0.16,
  color = "#8fffee",
  opacity = 0.78,
  textOpacity = 0.92,
  edgeOpacity = 0.42,
  distortion = 0.035,
  fresnelPower = 1.65,
}) {
  const group = useRef();
  const edgeRef = useRef();

  const textTexture = useMemo(() => makePanelTextTexture(current), [current?.id]);

  const glassMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(color) },
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
        uniform float uOpacity;
        uniform vec3 uColor;
        uniform float uDistortion;
        uniform float uFresnelPower;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vViewDir;

        float hash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 74.7);
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

        float edgeMask(vec2 uv) {
          vec2 e = smoothstep(vec2(0.0), vec2(0.085), uv) *
                   smoothstep(vec2(0.0), vec2(0.085), 1.0 - uv);
          return 1.0 - e.x * e.y;
        }

        void main() {
          float f = pow(
            1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0),
            uFresnelPower
          );

          float frost =
            noise(vUv * 22.0 + uTime * 0.035) * 0.55 +
            noise(vUv * 70.0 - uTime * 0.018) * 0.45;

          float edge = edgeMask(vUv);

          vec3 deep = vec3(0.025, 0.06, 0.065);
          vec3 color = mix(deep, uColor, 0.28);
          color += frost * 0.16;
          color += uColor * f * 0.58;
          color += vec3(0.8, 1.0, 0.96) * edge * 0.24;

          float alpha = uOpacity * (0.28 + f * 0.38 + edge * 0.28 + frost * 0.08);

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (group.current) {
      group.current.visible = visible > 0.03;
      group.current.position.lerp(new THREE.Vector3(...position), 0.06);

      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, rotation[0], 0.06);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, rotation[1], 0.06);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, rotation[2], 0.06);

      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x, Math.max(0.001, visible) * scale, 0.06)
      );
    }

    glassMaterial.uniforms.uTime.value = t;
    glassMaterial.uniforms.uOpacity.value = opacity * visible;
    glassMaterial.uniforms.uColor.value.set(color);
    glassMaterial.uniforms.uDistortion.value = distortion;
    glassMaterial.uniforms.uFresnelPower.value = fresnelPower;

    if (edgeRef.current) {
      edgeRef.current.material.opacity =
        edgeOpacity * visible * (0.8 + Math.sin(t * 0.8) * 0.08);
    }
  });

  return (
    <group ref={group} visible={false}>
      <RoundedBox args={[width, height, thickness]} radius={radius} smoothness={18}>
        <primitive object={glassMaterial} attach="material" />
      </RoundedBox>

      <mesh ref={edgeRef} position={[0, 0, thickness * 0.72]}>
        <planeGeometry args={[width * 1.015, height * 1.015]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          wireframe
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh position={[0, 0, thickness * 0.94]}>
        <planeGeometry args={[width * 0.88, height * 0.72]} />
        <meshBasicMaterial
          map={textTexture}
          transparent
          opacity={visible * textOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}