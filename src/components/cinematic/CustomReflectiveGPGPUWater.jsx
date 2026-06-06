import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Water } from "three/examples/jsm/objects/Water.js";
import { useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const WATER_NORMAL_URL =
  "https://threejs.org/examples/textures/waternormals.jpg";

const WATER_WIDTH = 18;
const WATER_DEPTH = 24;
const WATER_Z = -5.65;

function patchWaterRippleShader(material) {
  if (!material || material.userData.ripplePatched) return;

  material.uniforms.uRippleTime = { value: 0 };
  material.uniforms.uRippleCenter = {
    value: new THREE.Vector2(10000, 10000),
  };
  material.uniforms.uRippleStart = { value: -999 };
  material.uniforms.uRippleStrength = { value: 0.28 };
  material.uniforms.uRippleSpeed = { value: 2.1 };
  material.uniforms.uRippleFrequency = { value: 18.0 };
  material.uniforms.uRippleSharpness = { value: 7.0 };
  material.uniforms.uRippleDecay = { value: 1.85 };
  material.uniforms.uRippleDuration = { value: 2.6 };

  const rippleUniforms = /* glsl */ `
    uniform float uRippleTime;
    uniform vec2 uRippleCenter;
    uniform float uRippleStart;
    uniform float uRippleStrength;
    uniform float uRippleSpeed;
    uniform float uRippleFrequency;
    uniform float uRippleSharpness;
    uniform float uRippleDecay;
    uniform float uRippleDuration;
  `;

  material.fragmentShader = material.fragmentShader.replace(
    "uniform float time;",
    `uniform float time;\n${rippleUniforms}`
  );

  const targetLine =
    "vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );";

  const ripplePatch = /* glsl */ `
    vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

    float rippleAge = max(0.0, uRippleTime - uRippleStart);
    float rippleAlive = step(0.0, uRippleStart) * step(rippleAge, uRippleDuration);

    vec2 rippleVector = worldPosition.xz - uRippleCenter;
    float rippleDistance = length(rippleVector);

    vec2 rippleDirection = rippleDistance > 0.0001
      ? rippleVector / rippleDistance
      : vec2(0.0);

    float rippleTravel = rippleAge * uRippleSpeed;
    float rippleWave =
      sin((rippleDistance - rippleTravel) * uRippleFrequency);

    float rippleRing =
      exp(-abs(rippleDistance - rippleTravel) * uRippleSharpness);

    float rippleFade = exp(-rippleAge * uRippleDecay);

    float ripple =
      rippleWave *
      rippleRing *
      rippleFade *
      rippleAlive *
      uRippleStrength;

    surfaceNormal = normalize(
      surfaceNormal + vec3(rippleDirection.x, 0.0, rippleDirection.y) * ripple
    );
  `;

  if (material.fragmentShader.includes(targetLine)) {
    material.fragmentShader = material.fragmentShader.replace(
      targetLine,
      ripplePatch
    );
  } else {
    console.warn(
      "[Water.js Ripple] surfaceNormal satırı bulunamadı. Ripple patch uygulanamadı."
    );
  }

  material.userData.ripplePatched = true;
  material.needsUpdate = true;
}

export default function CustomReflectiveGPGPUWater() {
  const waterRef = useRef();
  const hitRef = useRef();

  const lastHoverRipple = useRef(0);

  const waterNormals = useTexture(WATER_NORMAL_URL);

  const {
    waterY,
    textureSize,

    waterColor,
    sunColor,

    distortionScale,
    waterSpeed,
    normalSize,
    normalRepeat,
    alpha,

    sunX,
    sunY,
    sunZ,

    rippleOnHover,
    rippleStrength,
    rippleClickBoost,
    rippleSpeed,
    rippleFrequency,
    rippleSharpness,
    rippleDecay,
    rippleDuration,
    hoverInterval,

    darkBase,
    darkBaseOpacity,
    darkBaseY,
    showHitArea,
  } = useControls("Final Water.js + Ripple", {
    waterY: {
      value: -0.285,
      min: -1,
      max: 0.2,
      step: 0.005,
    },

    textureSize: {
      value: 1024,
      options: [512, 1024, 2048],
    },

    waterColor: "#00100f",
    sunColor: "#1a4a44",

    distortionScale: {
      value: 4.42,
      min: 0,
      max: 10,
      step: 0.01,
    },

    waterSpeed: {
      value: 0.08,
      min: 0,
      max: 0.5,
      step: 0.005,
    },

    normalSize: {
      value: 1.0,
      min: 0.1,
      max: 8,
      step: 0.05,
    },

    normalRepeat: {
      value: 3.4,
      min: 0.5,
      max: 12,
      step: 0.1,
    },

    alpha: {
      value: 0.94,
      min: 0.1,
      max: 1,
      step: 0.01,
    },

    sunX: {
      value: -0.25,
      min: -1,
      max: 1,
      step: 0.01,
    },

    sunY: {
      value: 0.9,
      min: -1,
      max: 1,
      step: 0.01,
    },

    sunZ: {
      value: 0.35,
      min: -1,
      max: 1,
      step: 0.01,
    },

    rippleOnHover: true,

    rippleStrength: {
      value: 0.28,
      min: 0,
      max: 1.5,
      step: 0.01,
    },

    rippleClickBoost: {
      value: 1.9,
      min: 0.2,
      max: 5,
      step: 0.1,
    },

    rippleSpeed: {
      value: 2.1,
      min: 0.2,
      max: 8,
      step: 0.05,
    },

    rippleFrequency: {
      value: 18,
      min: 2,
      max: 60,
      step: 0.5,
    },

    rippleSharpness: {
      value: 7,
      min: 1,
      max: 24,
      step: 0.5,
    },

    rippleDecay: {
      value: 1.85,
      min: 0.2,
      max: 8,
      step: 0.05,
    },

    rippleDuration: {
      value: 2.6,
      min: 0.2,
      max: 8,
      step: 0.05,
    },

    hoverInterval: {
      value: 0.11,
      min: 0.03,
      max: 0.6,
      step: 0.01,
    },

    darkBase: true,

    darkBaseOpacity: {
      value: 0.36,
      min: 0,
      max: 1,
      step: 0.01,
    },

    darkBaseY: {
      value: -0.315,
      min: -1,
      max: 0.2,
      step: 0.005,
    },

    showHitArea: false,
  });

  useEffect(() => {
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;
  }, [waterNormals]);

  const waterObject = useMemo(() => {
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;
    waterNormals.repeat.set(3.4, 3.4);

    const geometry = new THREE.PlaneGeometry(WATER_WIDTH, WATER_DEPTH);

    const object = new Water(geometry, {
      textureWidth: textureSize,
      textureHeight: textureSize,
      waterNormals,
      sunDirection: new THREE.Vector3(-0.25, 0.9, 0.35).normalize(),
      sunColor: new THREE.Color("#1a4a44").getHex(),
      waterColor: new THREE.Color("#00100f").getHex(),
      distortionScale: 4.42,
      size: 1.0,
      alpha: 0.94,
      fog: true,
    });

    object.rotation.x = -Math.PI / 2;
    object.position.set(0, waterY, WATER_Z);
    object.receiveShadow = true;

    object.material.side = THREE.DoubleSide;
    object.material.transparent = true;

    patchWaterRippleShader(object.material);

    return object;
  }, [waterNormals, textureSize]);

  useEffect(() => {
    return () => {
      waterObject.geometry?.dispose?.();
      waterObject.material?.dispose?.();
    };
  }, [waterObject]);

  useFrame((state) => {
    if (!waterRef.current) return;

    const object = waterRef.current;
    const uniforms = object.material?.uniforms;

    object.position.y = waterY;

    waterNormals.repeat.set(normalRepeat, normalRepeat);

    if (!uniforms) return;

    if (uniforms.time) {
      uniforms.time.value = state.clock.elapsedTime * waterSpeed;
    }

    if (uniforms.uRippleTime) {
      uniforms.uRippleTime.value = state.clock.elapsedTime;
    }

    if (uniforms.waterColor) {
      uniforms.waterColor.value.set(waterColor);
    }

    if (uniforms.sunColor) {
      uniforms.sunColor.value.set(sunColor);
    }

    if (uniforms.sunDirection) {
      uniforms.sunDirection.value.set(sunX, sunY, sunZ).normalize();
    }

    if (uniforms.distortionScale) {
      uniforms.distortionScale.value = distortionScale;
    }

    if (uniforms.size) {
      uniforms.size.value = normalSize;
    }

    if (uniforms.alpha) {
      uniforms.alpha.value = alpha;
    }

    if (uniforms.uRippleStrength) {
      uniforms.uRippleStrength.value = rippleStrength;
    }

    if (uniforms.uRippleSpeed) {
      uniforms.uRippleSpeed.value = rippleSpeed;
    }

    if (uniforms.uRippleFrequency) {
      uniforms.uRippleFrequency.value = rippleFrequency;
    }

    if (uniforms.uRippleSharpness) {
      uniforms.uRippleSharpness.value = rippleSharpness;
    }

    if (uniforms.uRippleDecay) {
      uniforms.uRippleDecay.value = rippleDecay;
    }

    if (uniforms.uRippleDuration) {
      uniforms.uRippleDuration.value = rippleDuration;
    }
  });

  const triggerRipple = (event, boost = 1) => {
    event.stopPropagation();

    const object = waterRef.current;
    const uniforms = object?.material?.uniforms;

    if (!uniforms?.uRippleCenter || !uniforms?.uRippleStart) return;

    const point = event.point;

    uniforms.uRippleCenter.value.set(point.x, point.z);
    uniforms.uRippleStart.value = uniforms.uRippleTime.value;
    uniforms.uRippleStrength.value = rippleStrength * boost;
  };

  return (
    <group>
      {darkBase && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, darkBaseY, WATER_Z]}
          renderOrder={-10}
        >
          <planeGeometry args={[WATER_WIDTH, WATER_DEPTH]} />
          <meshBasicMaterial
            color="#000807"
            transparent
            opacity={darkBaseOpacity}
            depthWrite={false}
          />
        </mesh>
      )}

      <primitive ref={waterRef} object={waterObject} />

      <mesh
        ref={hitRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, waterY + 0.045, WATER_Z]}
        renderOrder={1000}
        onPointerMove={(event) => {
          if (!rippleOnHover) return;

          const now = event.nativeEvent.timeStamp / 1000;

          if (now - lastHoverRipple.current > hoverInterval) {
            lastHoverRipple.current = now;
            triggerRipple(event, 0.45);
          }
        }}
        onPointerDown={(event) => {
          triggerRipple(event, rippleClickBoost);
        }}
      >
        <planeGeometry args={[WATER_WIDTH, WATER_DEPTH]} />
        <meshBasicMaterial
          color="#9ffff4"
          transparent
          opacity={showHitArea ? 0.15 : 0}
          wireframe={showHitArea}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}