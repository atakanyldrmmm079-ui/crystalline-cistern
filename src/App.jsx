import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Environment, useGLTF, RoundedBox, MeshTransmissionMaterial, Html, useProgress } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useControls, folder } from "leva";
import * as THREE from "three";
import "./App.css";
import MapLibreCrystalMap from "./components/MapLibreCrystalMap";
import CisternSceneLab from "./components/cinematic/CisternSceneLab";
import PresentationAudioButton from "./components/PresentationAudioButton";

/*
  GEREKLİ DOSYALAR:

  public/model/cistern_environment.glb
  public/model/ground.glb
  public/model/hero_crystal.glb
  public/model/node_crystal.glb

  NOT: UI panel artık PNG kullanmıyor. Buz/cam panel App.css içindeki stillerle üretiliyor.
*/

const CISTERNS = [
  {
    id: "basilica",
    number: "01",
    name: "Basilica",
    fullName: "Basilica Cistern",
    role: "Origin Core",
    color: "#74fff4",
    position: [-0.13, -1.77, 0.77],
    ui: [50, 42],
    density: "92%",
    flow: "High",
    status: "Awake",
    text:
      "The first crystalline core awakens where water once stood still. Energy is not produced here; it is revealed through mineral memory.",
  },
  {
    id: "binbirdirek",
    number: "02",
    name: "Binbirdirek",
    fullName: "Binbirdirek Cistern",
    role: "Distribution Core",
    color: "#4aa8ff",
    position: [2.35, -1.58, -0.55],
    ui: [68, 52],
    density: "74%",
    flow: "Medium",
    status: "Routing",
    text:
      "Binbirdirek distributes the revealed energy through underground routes and root-like crystalline filaments.",
  },
  {
    id: "gulhane",
    number: "03",
    name: "Gülhane",
    fullName: "Gülhane Cistern",
    role: "Stabilization Core",
    color: "#68ff9a",
    position: [-2.25, -1.6, -0.58],
    ui: [34, 56],
    density: "63%",
    flow: "Soft",
    status: "Balanced",
    text:
      "Gülhane stabilizes the pressure between water memory, mineral surfaces and the living underground network.",
  },
  {
    id: "serefiye",
    number: "04",
    name: "Şerefiye",
    fullName: "Şerefiye Cistern",
    role: "Storage Core",
    color: "#b277ff",
    position: [1.35, -1.86, 0.05],
    ui: [61, 74],
    density: "81%",
    flow: "Stored",
    status: "Charging",
    text:
      "Şerefiye stores concentrated energy before it is released into the broader crystalline infrastructure.",
  },
  {
    id: "fildami",
    number: "05",
    name: "Fildamı",
    fullName: "Fildamı Cistern",
    role: "Release Core",
    color: "#fff1c7",
    position: [-1.35, -1.9, 0.08],
    ui: [42, 82],
    density: "57%",
    flow: "Release",
    status: "Open",
    text:
      "Fildamı marks the final release stage, where underground energy begins to spread toward the urban surface.",
  },
];

const CONNECTIONS = [
  ["basilica", "binbirdirek"],
  ["basilica", "gulhane"],
  ["basilica", "serefiye"],
  ["gulhane", "fildami"],
  ["serefiye", "fildami"],
  ["binbirdirek", "serefiye"],
];


const STORY_ACTS = [
  {
    id: "01",
    slug: "drought",
    kicker: "YEAR 2556 / ISTANBUL",
    title: "The Drought",
    lead: "Istanbul's surface water has almost disappeared.",
    body:
      "Rivers, reservoirs and rain can no longer sustain the city. The search turns downward, toward the forgotten infrastructure beneath the streets.",
    micro: "SURFACE WATER INDEX / 0.7% · SIGNAL / PENDING",
  },
  {
    id: "02",
    slug: "signal",
    kicker: "UNDERGROUND SIGNAL",
    title: "The First Response",
    lead: "Something beneath the city begins to answer.",
    body:
      "A fractured crystalline signal appears below the surface. It is not a map yet; it is the first trace of a forgotten infrastructure waking up.",
    micro: "SIGNAL STATUS / DETECTED",
  },
  {
    id: "03",
    slug: "descent",
    kicker: "DESCENT SEQUENCE",
    title: "Descend Below",
    lead: "The signal pulls the search beneath the streets.",
    body:
      "The fragments collapse into a path downward, guiding the city toward the cistern chambers where water memory has crystallized.",
    micro: "DESCENT ROUTE / OPEN",
  },
  {
    id: "04",
    slug: "functions",
    kicker: "NEW INFRASTRUCTURE",
    title: "New Functions",
    lead: "The cisterns are no longer reservoirs.",
    body:
      "Each chamber evolves into a specific organ of the underground system: origin, connection, stabilization, storage and release.",
    micro: "CISTERN ROLES / 05 ONLINE",
  },
  {
    id: "05",
    slug: "roots",
    kicker: "LIVING DISTRIBUTION",
    title: "The Root Network",
    lead: "Crystal filaments spread beneath Istanbul.",
    body:
      "Root-like structures connect one cistern to another, carrying energy through a living infrastructure below the urban surface.",
    micro: "UNDERGROUND FLOW / ACTIVE",
  },
  {
    id: "06",
    slug: "reactivation",
    kicker: "CITY REACTIVATION",
    title: "Return to the Surface",
    lead: "The old water system becomes a new energy spine.",
    body:
      "What once stored water now powers the city. The underground network prepares to reconnect with Istanbul above.",
    micro: "SURFACE LINK / OPENING",
  },
  {
    id: "07",
    slug: "map",
    kicker: "FINAL REVEAL",
    title: "Istanbul Crystal Map",
    lead: "Five cisterns. Five new functions. One living system.",
    body:
      "The map reveals the complete crystalline network and shows how Istanbul survives through the transformed purpose of its ancient cisterns.",
    micro: "NETWORK VIEW / UNLOCKED",
  },
];

function getStoryIndex(scroll) {
  return Math.min(STORY_ACTS.length - 1, Math.floor(clamp01(scroll) * STORY_ACTS.length));
}

function getStoryProgress(scroll) {
  const scaled = clamp01(scroll) * STORY_ACTS.length;
  return clamp01(scaled - Math.floor(scaled));
}

function getNode(id) {
  return CISTERNS.find((node) => node.id === id) || CISTERNS[0];
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function range(value, start, end) {
  return clamp01((value - start) / (end - start));
}

function smooth01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function smoother01(value) {
  return smooth01(smooth01(value));
}

function eachMaterial(material, callback) {
  if (Array.isArray(material)) material.forEach(callback);
  else if (material) callback(material);
}

function useScrollProgress() {
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);

    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScroll(max > 0 ? clamp01(window.scrollY / max) : 0);
    }

    update();
    window.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return scroll;
}

function attachColumnColorShader(mat, design) {
  if (!mat || mat.userData?.columnTintInstalled) return;

  mat.userData.columnTintInstalled = true;
  mat.userData.columnShader = null;
  mat.userData.columnDesign = design;

  if ("emissive" in mat) mat.emissive = new THREE.Color(design.columnGlowColorB);
  if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0.04;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uReveal = { value: 0 };
    shader.uniforms.uMapFade = { value: 1 };
    shader.uniforms.uGlowA = { value: new THREE.Color(design.columnGlowColorA) };
    shader.uniforms.uGlowB = { value: new THREE.Color(design.columnGlowColorB) };
    shader.uniforms.uShadowTint = { value: new THREE.Color(design.columnShadowTint) };
    shader.uniforms.uTintStrength = { value: design.columnTintStrength };
    shader.uniforms.uPulseSpeed = { value: design.columnPulseSpeed };
    shader.uniforms.uNoise = { value: design.columnColorNoise };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
      #include <common>
      varying vec3 vColumnWorldPos;
      varying vec2 vColumnUv;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      vColumnWorldPos = worldPosition.xyz;
      vColumnUv = uv;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
      #include <common>
      uniform float uTime;
      uniform float uReveal;
      uniform float uMapFade;
      uniform vec3 uGlowA;
      uniform vec3 uGlowB;
      uniform vec3 uShadowTint;
      uniform float uTintStrength;
      uniform float uPulseSpeed;
      uniform float uNoise;
      varying vec3 vColumnWorldPos;
      varying vec2 vColumnUv;

      float columnHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 74.7);
        return fract(p.x * p.y);
      }

      float columnBand(float y, float center, float width) {
        return 1.0 - smoothstep(0.0, width, abs(y - center));
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>

      float uvBand =
        columnBand(vColumnUv.y, 0.18, 0.24) * 0.26 +
        columnBand(vColumnUv.y, 0.52, 0.34) * 0.42 +
        columnBand(vColumnUv.y, 0.86, 0.22) * 0.22;

      float verticalEnergy = smoothstep(-2.4, 0.8, vColumnWorldPos.y) *
        (1.0 - smoothstep(1.6, 4.4, vColumnWorldPos.y));

      float organicNoise = columnHash(vColumnUv * 20.0 + uTime * 0.035) * uNoise;
      float pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed + vColumnWorldPos.y * 2.1 + vColumnWorldPos.x * 0.6);
      float glowMask = clamp((uvBand + verticalEnergy * 0.3 + organicNoise * 0.22) * uReveal * uMapFade, 0.0, 1.0);
      vec3 glowColor = mix(uGlowB, uGlowA, pulse);
      vec3 coldStone = mix(diffuseColor.rgb, uShadowTint, 0.42);

      diffuseColor.rgb = mix(coldStone, glowColor, glowMask * uTintStrength);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `
      #include <emissivemap_fragment>
      totalEmissiveRadiance += mix(uGlowB, uGlowA, 0.5 + 0.5 * sin(uTime * uPulseSpeed)) * glowMask * 0.32;
      `
    );

    mat.userData.columnShader = shader;
  };

  mat.customProgramCacheKey = () => "crystal-column-tint-v4";
  mat.needsUpdate = true;
}

function AutoGLBModel({
  url,
  position,
  rotation,
  targetSize,
  tint,
  opacity = 1,
  roughness = 0.8,
  metalness = 0.02,
  reactiveColumns = false,
  design,
  scroll = 0,
}) {
  const gltf = useGLTF(url);
  const materialsRef = useRef([]);

  const { clone, center, scale } = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const columnMaterials = [];

    cloned.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => mat.clone());
      } else {
        child.material = child.material.clone();
      }

      eachMaterial(child.material, (mat) => {
        if (tint && "color" in mat) mat.color = new THREE.Color(tint);

        if ("roughness" in mat) mat.roughness = roughness;
        if ("metalness" in mat) mat.metalness = metalness;

        mat.transparent = opacity < 1;
        mat.opacity = opacity;
        mat.depthWrite = opacity >= 0.72;
        mat.side = THREE.DoubleSide;

        if (reactiveColumns && design) {
          attachColumnColorShader(mat, design);
          columnMaterials.push(mat);
        }

        mat.needsUpdate = true;
      });
    });

    materialsRef.current = columnMaterials;

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    return {
      clone: cloned,
      center,
      scale: targetSize / maxDim,
    };
  }, [gltf.scene, targetSize, tint, opacity, roughness, metalness, reactiveColumns, design]);

  useFrame((state) => {
    if (!reactiveColumns || !design) return;

    const sceneReveal = range(scroll, design.sceneRevealStart, design.sceneRevealEnd);
    const mapFade = 1 - range(scroll, design.mapStart, design.mapEnd);

    materialsRef.current.forEach((mat) => {
      const shader = mat.userData?.columnShader;
      if (!shader) return;

      shader.uniforms.uTime.value = state.clock.elapsedTime;
      shader.uniforms.uReveal.value = sceneReveal;
      shader.uniforms.uMapFade.value = mapFade;
      shader.uniforms.uGlowA.value.set(design.columnGlowColorA);
      shader.uniforms.uGlowB.value.set(design.columnGlowColorB);
      shader.uniforms.uShadowTint.value.set(design.columnShadowTint);
      shader.uniforms.uTintStrength.value = design.columnTintStrength;
      shader.uniforms.uPulseSpeed.value = design.columnPulseSpeed;
      shader.uniforms.uNoise.value = design.columnColorNoise;
    });
  });

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={clone} position={[-center.x, -center.y, -center.z]} />
    </group>
  );
}

function CameraRig({ scroll, selected, design }) {
  const { camera, pointer } = useThree();

  useFrame(() => {
    const sceneReveal = smooth01(range(scroll, design.sceneRevealStart, design.sceneRevealEnd));
    const networkProgress = smooth01(range(scroll, design.networkStart, design.networkEnd));
    const descendProgress = smooth01(range(scroll, design.descendStart, design.descendEnd));
    const chamberProgress = smooth01(range(scroll, design.chamberStart, design.chamberEnd));
    const mapProgress = smooth01(range(scroll, design.mapStart, design.mapEnd));

    const selectedNode = getNode(selected);
    const mapX = selectedNode ? (selectedNode.ui[0] - 50) * 0.01 : 0;
    const mapY = selectedNode ? (50 - selectedNode.ui[1]) * 0.006 : 0;

    const upperFade = 1 - descendProgress;

    const targetX =
      design.cameraX * sceneReveal * upperFade +
      pointer.x * design.cameraMouseX * sceneReveal * upperFade +
      mapX * mapProgress;

    const targetY =
      design.cameraY * sceneReveal +
      pointer.y * design.cameraMouseY * sceneReveal * upperFade +
      networkProgress * 0.08 * upperFade -
      descendProgress * design.descendCameraDrop -
      chamberProgress * design.chamberCameraDrop +
      mapY * mapProgress;

    const targetZ =
      THREE.MathUtils.lerp(design.introCameraZ, design.cameraZ, sceneReveal) -
      networkProgress * design.networkCameraPull * upperFade -
      descendProgress * design.descendCameraPush +
      chamberProgress * design.chamberCameraPush +
      mapProgress * design.mapCameraPush;

    const targetFov =
      design.cameraFov +
      descendProgress * design.descendFovBoost -
      chamberProgress * design.chamberFovTighten +
      mapProgress * 8;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.045);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.045);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.045);

    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.045);
    camera.updateProjectionMatrix();

    const lookX = design.lookAtX;
    const lookY =
      design.lookAtY +
      networkProgress * 0.08 * upperFade -
      descendProgress * design.descendLookAtDrop -
      chamberProgress * design.chamberLookAtDrop +
      mapProgress * 0.5;
    const lookZ =
      design.lookAtZ -
      networkProgress * 0.16 * upperFade -
      descendProgress * 0.35 -
      chamberProgress * 0.8;

    camera.lookAt(lookX, lookY, lookZ);
  });

  return null;
}

function SceneEnvironment({ scroll, design }) {
  const group = useRef();
  const waterRef = useRef();
  const maskRef = useRef();
  const glowRef = useRef();

  useFrame(() => {
    if (!group.current) return;

    const sceneReveal = range(
      scroll,
      design.sceneRevealStart + 0.04,
      design.sceneRevealEnd + 0.08
    );

    const networkProgress = range(scroll, design.networkStart, design.networkEnd);
    const mapProgress = range(scroll, design.mapStart, design.mapEnd);

    group.current.visible = sceneReveal > 0.015;

    const targetScale =
      sceneReveal > 0.01
        ? 0.92 + sceneReveal * 0.08 - mapProgress * 0.12 + networkProgress * 0.03
        : 0.92;

    group.current.scale.setScalar(
      THREE.MathUtils.lerp(group.current.scale.x, targetScale, 0.055)
    );

    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      -0.18 * (1 - sceneReveal) - mapProgress * 0.55,
      0.055
    );

    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      -1.4 * (1 - sceneReveal) - mapProgress * 0.75,
      0.055
    );

    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      mapProgress * 0.04,
      0.04
    );

    const groundReveal = range(
      scroll,
      design.sceneRevealStart + 0.08,
      design.sceneRevealEnd + 0.14
    );

    if (waterRef.current) {
      waterRef.current.visible = groundReveal > 0.02;
      waterRef.current.material.opacity = design.waterOpacity * groundReveal;
    }

    if (maskRef.current) {
      maskRef.current.visible = groundReveal > 0.02;
      maskRef.current.material.opacity = design.maskOpacity * groundReveal;
    }

    if (glowRef.current) {
      glowRef.current.visible = groundReveal > 0.02;
      glowRef.current.material.opacity = design.glowOpacity * groundReveal;
    }
  });

  return (
    <group ref={group}>
      <AutoGLBModel
        url="/model/cistern_environment.glb"
        position={[design.envX, design.envY, design.envZ]}
        rotation={[design.envRotX, design.envRotY, design.envRotZ]}
        targetSize={design.envSize}
        tint={design.envTint}
        opacity={design.envOpacity}
        roughness={design.envRoughness}
        metalness={0.01}
        reactiveColumns
        design={design}
        scroll={scroll}
      />

      <AutoGLBModel
        url="/model/ground.glb"
        position={[design.groundX, design.groundY, design.groundZ]}
        rotation={[design.groundRotX, design.groundRotY, design.groundRotZ]}
        targetSize={design.groundSize}
        tint={design.groundTint}
        opacity={design.groundOpacity}
        roughness={design.groundRoughness}
        metalness={design.groundMetalness}
      />

      <mesh
        ref={waterRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[design.waterX, design.waterY, design.waterZ]}
      >
        <planeGeometry args={[design.waterSize, design.waterSize, 120, 120]} />
        <meshStandardMaterial
          color={design.waterColor}
          roughness={design.waterRoughness}
          metalness={design.waterMetalness}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={maskRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[design.maskX, design.maskY, design.maskZ]}
      >
        <ringGeometry args={[design.maskInner, design.maskOuter, 160]} />
        <meshBasicMaterial
          color="#020607"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={glowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[design.glowX, design.glowY, design.glowZ]}
      >
        <circleGeometry args={[design.glowSize, 160]} />
        <meshBasicMaterial
          color={design.glowColor}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function IntroCrystalGrid({ scroll, design }) {
  const group = useRef();
  const [hoveredSignal, setHoveredSignal] = useState(null);

  const signals = useMemo(() => {
    return [
      {
        id: "core-signal",
        type: "core",
        position: [1.58, -0.12, -1.82],
        scale: 1.42,
        opacity: 0.72,
        delay: 0.0,
        rotation: [0.24, -0.42, 0.16],
      },
      {
        id: "answer-a",
        type: "response",
        position: [2.95, 0.84, -2.65],
        scale: 0.82,
        opacity: 0.44,
        delay: 0.8,
        rotation: [-0.28, 0.52, -0.2],
      },
      {
        id: "answer-b",
        type: "response",
        position: [3.15, -1.1, -2.35],
        scale: 0.74,
        opacity: 0.42,
        delay: 1.35,
        rotation: [0.18, 0.72, 0.48],
      },
      {
        id: "answer-c",
        type: "response",
        position: [0.42, 0.76, -2.5],
        scale: 0.62,
        opacity: 0.34,
        delay: 1.8,
        rotation: [0.44, 0.14, -0.32],
      },
      {
        id: "answer-d",
        type: "response",
        position: [0.58, -1.48, -2.9],
        scale: 0.54,
        opacity: 0.3,
        delay: 2.2,
        rotation: [-0.16, -0.64, 0.24],
      },
      {
        id: "ghost-a",
        type: "ghost",
        position: [-0.85, 1.18, -3.45],
        scale: 0.42,
        opacity: 0.18,
        delay: 2.6,
        rotation: [0.18, 0.32, 0.42],
      },
      {
        id: "ghost-b",
        type: "ghost",
        position: [3.96, 0.08, -3.3],
        scale: 0.36,
        opacity: 0.16,
        delay: 2.95,
        rotation: [0.32, -0.22, -0.18],
      },
      {
        id: "ghost-c",
        type: "ghost",
        position: [1.92, -2.05, -3.65],
        scale: 0.34,
        opacity: 0.14,
        delay: 3.25,
        rotation: [-0.2, 0.34, 0.28],
      },
      {
        id: "ghost-d",
        type: "ghost",
        position: [-1.35, -0.72, -3.85],
        scale: 0.28,
        opacity: 0.11,
        delay: 3.55,
        rotation: [0.46, -0.18, 0.08],
      },
    ];
  }, []);

  const trails = useMemo(() => {
    const getSignal = (id) => signals.find((item) => item.id === id);
    const pairs = [
      ["core-signal", "answer-a"],
      ["core-signal", "answer-b"],
      ["core-signal", "answer-c"],
      ["answer-b", "answer-d"],
      ["answer-c", "ghost-a"],
      ["answer-a", "ghost-b"],
    ];

    return pairs.map(([from, to], index) => {
      const a = new THREE.Vector3(...getSignal(from).position);
      const b = new THREE.Vector3(...getSignal(to).position);
      const mid = a.clone().lerp(b, 0.5);
      mid.x += Math.sin(index * 1.7) * 0.16;
      mid.y += 0.16 + Math.cos(index * 1.1) * 0.08;
      mid.z -= 0.22 + index * 0.035;

      return {
        id: `${from}-${to}`,
        curve: new THREE.CatmullRomCurve3([a, mid, b]),
        delay: index * 0.42,
      };
    });
  }, [signals]);

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;
    const introFade = 1 - range(scroll, design.introFadeStart, design.introFadeEnd);
    const descentPull = smooth01(range(scroll, 0.035, design.introFadeEnd));

    group.current.visible = introFade > 0.01;

    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      design.introSignalX + state.pointer.x * 0.08,
      0.06
    );

    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      design.introSignalY - descentPull * design.introSignalPullDown,
      0.06
    );

    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      design.introSignalZ - scroll * 2.6,
      0.06
    );

    group.current.scale.setScalar(
      THREE.MathUtils.lerp(
        group.current.scale.x,
        design.introSignalScale * introFade,
        0.06
      )
    );

    group.current.rotation.y = Math.sin(t * 0.12) * 0.055 + state.pointer.x * 0.055;
    group.current.rotation.x = Math.sin(t * 0.09) * 0.028 - state.pointer.y * 0.035;

    group.current.children.forEach((child) => {
      if (child.userData?.kind === "signal") {
        const delay = child.userData.delay || 0;
        const baseScale = child.userData.baseScale || 1;
        const baseOpacity = child.userData.baseOpacity || 0.2;
        const type = child.userData.type;
        const isHovered = hoveredSignal === child.userData.id;
        const pulse = 0.5 + 0.5 * Math.sin(t * design.introSignalWaveSpeed - delay * 1.25);
        const slowWake = 0.68 + pulse * 0.32;
        const boost = isHovered ? design.introSignalHoverPower : 0;
        const ghostMultiplier = type === "ghost" ? design.introSignalGhostOpacity : 1;
        const coreMultiplier = type === "core" ? design.introSignalCoreIntensity : 1;

        child.position.y = child.userData.basePosition[1] + Math.sin(t * 0.34 + delay) * design.introSignalDrift;
        child.position.x = child.userData.basePosition[0] + Math.sin(t * 0.21 + delay * 1.7) * design.introSignalDrift * 0.45;
        child.rotation.x += 0.002 + boost * 0.0012;
        child.rotation.y += 0.003 + (type === "core" ? 0.0016 : 0.0008);
        child.rotation.z += 0.0012;
        child.scale.setScalar(baseScale * (1 + pulse * 0.06 + boost * 0.18));

        child.children.forEach((mesh, index) => {
          if (!mesh.material) return;

          const targetOpacity =
            baseOpacity * slowWake * introFade * ghostMultiplier * coreMultiplier +
            boost * (index === 0 ? 0.22 : 0.12);

          mesh.material.opacity = THREE.MathUtils.lerp(
            mesh.material.opacity,
            targetOpacity,
            0.12
          );

          const targetColor = isHovered
            ? new THREE.Color("#ffffff")
            : type === "core"
            ? new THREE.Color(design.introSignalCoreColor)
            : type === "ghost"
            ? new THREE.Color(design.introSignalGhostColor)
            : new THREE.Color(design.introSignalColor);

          mesh.material.color.lerp(targetColor, 0.08);
        });
      }

      if (child.userData?.kind === "trail") {
        const delay = child.userData.delay || 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.72 - delay * 1.4);
        child.material.opacity = introFade * design.introSignalTrailOpacity * (0.42 + pulse * 0.58);
      }
    });
  });

  const handleMove = (event, id) => {
    event.stopPropagation();
    setHoveredSignal(id);
    document.body.classList.add("crystal-hover");
  };

  const handleOut = (event) => {
    event.stopPropagation();
    setHoveredSignal(null);
    document.body.classList.remove("crystal-hover");
  };

  return (
    <group ref={group}>
      {trails.map((trail) => (
        <mesh key={trail.id} userData={{ kind: "trail", delay: trail.delay }}>
          <tubeGeometry args={[trail.curve, 48, 0.0025, 5, false]} />
          <meshBasicMaterial
            color={design.introSignalColor}
            transparent
            opacity={0.02}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {signals.map((signal) => {
        const size =
          signal.type === "core"
            ? design.introSignalCoreSize
            : signal.type === "ghost"
            ? design.introSignalGhostSize
            : design.introSignalResponseSize;

        const color =
          signal.type === "core"
            ? design.introSignalCoreColor
            : signal.type === "ghost"
            ? design.introSignalGhostColor
            : design.introSignalColor;

        return (
          <group
            key={signal.id}
            position={signal.position}
            rotation={signal.rotation}
            scale={signal.scale * size}
            userData={{
              id: signal.id,
              type: signal.type,
              kind: "signal",
              delay: signal.delay,
              baseScale: signal.scale * size,
              baseOpacity: signal.opacity,
              basePosition: signal.position,
            }}
          >
            <mesh
              onPointerMove={(event) => handleMove(event, signal.id)}
              onPointerOut={handleOut}
            >
              <octahedronGeometry args={[0.2, 0]} />
              <meshBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={0.01}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            <mesh
              rotation={[0, 0, Math.PI / 4]}
              onPointerMove={(event) => handleMove(event, signal.id)}
              onPointerOut={handleOut}
            >
              <boxGeometry args={[0.29, 0.29, 0.29]} />
              <meshBasicMaterial
                color="#ffffff"
                wireframe
                transparent
                opacity={0.01}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {signal.type === "core" && (
              <mesh scale={0.1}>
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshBasicMaterial
                  color={design.introSignalCoreColor}
                  transparent
                  opacity={0.34}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}


function CrystalNode({
  node,
  scroll,
  hovered,
  selected,
  activatedNodes,
  setHovered,
  setSelected,
  setActivatedNodes,
  design,
}) {
  const isHero = node.id === "basilica";
  const url = isHero ? "/model/hero_crystal.glb" : "/model/node_crystal.glb";

  const gltf = useGLTF(url);
  const clone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const group = useRef();
  const pulse = useRef(0);

  const isHovered = hovered === node.id;
  const isSelected = selected === node.id;
  const isActivated = activatedNodes.includes(node.id);
  const isActive = isHovered || isSelected || isActivated;

  useEffect(() => {
    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => mat.clone());
      } else {
        child.material = child.material.clone();
      }

      eachMaterial(child.material, (mat) => {
        if ("color" in mat) {
          mat.color = new THREE.Color(isHero ? design.crystalColor : "#e8fffc");
        }

        if ("emissive" in mat) {
          mat.emissive = new THREE.Color(
            isHero ? design.crystalGlowColor : node.color
          );
        }

        if ("emissiveIntensity" in mat) {
          mat.emissiveIntensity = isHero ? design.crystalGlow : 0.18;
        }

        if ("roughness" in mat) mat.roughness = isHero ? design.crystalRoughness : 0.16;
        if ("metalness" in mat) mat.metalness = 0.03;

        mat.transparent = true;
        mat.opacity = isHero ? design.crystalOpacity : 0.84;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      });
    });
  }, [
    clone,
    isHero,
    node.color,
    design.crystalColor,
    design.crystalGlowColor,
    design.crystalGlow,
    design.crystalOpacity,
    design.crystalRoughness,
  ]);

  function activate() {
    setSelected(node.id);
    setActivatedNodes((prev) =>
      prev.includes(node.id) ? prev : [...prev, node.id]
    );
    pulse.current = 1;
  }

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;

    const sceneReveal = range(
      scroll,
      design.sceneRevealStart + 0.035,
      design.sceneRevealEnd + 0.08
    );

    const networkProgress = range(scroll, design.networkStart, design.networkEnd);
    const mapProgress = range(scroll, design.mapStart, design.mapEnd);

    group.current.visible = isHero ? sceneReveal > 0.01 : networkProgress > 0.05;

    const baseScale = isHero ? design.crystalScale : design.nodeCrystalScale;
    const revealScale = isHero ? sceneReveal : networkProgress;
    const mapFadeScale = isHero ? 1 - mapProgress * 0.45 : 1 - mapProgress * 0.75;
    const activeBoost = isActive ? 1.08 : 1;
    const pulseBoost = 1 + pulse.current * 0.08;

    group.current.scale.setScalar(
      THREE.MathUtils.lerp(
        group.current.scale.x,
        baseScale *
          Math.max(0.001, revealScale) *
          Math.max(0.001, mapFadeScale) *
          activeBoost *
          pulseBoost,
        0.075
      )
    );

    const basePosition = isHero
      ? [design.crystalX, design.crystalY, design.crystalZ]
      : node.position;

    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      basePosition[0] * (1 - mapProgress * 0.16),
      0.055
    );

    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      basePosition[1] +
        Math.sin(t * 1.08 + basePosition[0]) *
          (isHero ? design.crystalFloat : 0.026) -
        mapProgress * 0.42,
      0.055
    );

    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      basePosition[2] -
        networkProgress * (isHero ? 0.08 : 0.2) -
        mapProgress * 1.05,
      0.055
    );

    group.current.rotation.y += isHero ? design.crystalRotateSpeed : 0.006;

    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      state.pointer.y * (isHovered ? 0.14 : 0.04) * (1 - mapProgress),
      0.055
    );

    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      -state.pointer.x * (isHovered ? 0.13 : 0.035) * (1 - mapProgress),
      0.055
    );

    pulse.current = THREE.MathUtils.lerp(pulse.current, 0, 0.075);

    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      eachMaterial(child.material, (mat) => {
        if (!("emissiveIntensity" in mat)) return;

        const normalGlow = isHero
          ? design.crystalGlow + networkProgress * 0.14
          : 0.18 + networkProgress * 0.3;

        const targetGlow = isSelected
          ? isHero
            ? 0.28
            : 1.2
          : isHovered
          ? isHero
            ? 0.22
            : 0.9
          : isActivated
          ? isHero
            ? 0.18
            : 0.7
          : normalGlow;

        mat.emissiveIntensity = THREE.MathUtils.lerp(
          mat.emissiveIntensity,
          targetGlow + pulse.current * (isHero ? 0.22 : 0.8),
          0.08
        );

        mat.opacity = THREE.MathUtils.lerp(
          mat.opacity,
          (isHero ? design.crystalOpacity : 0.84) *
            (1 - mapProgress * (isHero ? 0.65 : 0.9)),
          0.08
        );
      });
    });
  });

  return (
    <group
      ref={group}
      position={node.position}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(node.id);
        document.body.classList.add("crystal-hover");
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHovered(null);
        document.body.classList.remove("crystal-hover");
      }}
      onClick={(event) => {
        event.stopPropagation();
        activate();
      }}
    >
      <primitive object={clone} />

      <pointLight
        color={isHero ? design.crystalGlowColor : node.color}
        intensity={
          isHero
            ? design.crystalLight *
              range(
                scroll,
                design.sceneRevealStart + 0.035,
                design.sceneRevealEnd + 0.08
              ) *
              (1 - range(scroll, design.mapStart, 1) * 0.75)
            : isActive
            ? 1.85
            : 0.45
        }
        distance={isHero ? design.crystalLightDistance : 3}
        position={[0, 0.35, 0.7]}
      />

      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.64, 0]}>
          <ringGeometry args={[0.5, 0.57, 128]} />
          <meshBasicMaterial
            color={node.color}
            transparent
            opacity={isHero ? 0.11 : 0.24}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

function RootCurve({ a, b, active, scroll, color, design }) {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);

    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.max(start.y, end.y) + 0.16,
      (start.z + end.z) / 2 - 0.28
    );

    return new THREE.CatmullRomCurve3([start, mid, end]);
  }, [a, b]);

  const reveal = range(scroll, design.networkStart, design.networkEnd);
  const mapFade = 1 - range(scroll, design.mapStart + 0.04, 0.9);

  return (
    <mesh visible={reveal > 0.01 && mapFade > 0.01}>
      <tubeGeometry args={[curve, 64, active ? 0.012 : 0.006, 8, false]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={(active ? 0.36 : 0.075) * reveal * mapFade}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function RootNetwork({ scroll, selected, activatedNodes, design }) {
  return (
    <group>
      {CONNECTIONS.map(([from, to]) => {
        const a = getNode(from);
        const b = getNode(to);

        const active =
          selected === from ||
          selected === to ||
          (activatedNodes.includes(from) && activatedNodes.includes(to));

        return (
          <RootCurve
            key={`${from}-${to}`}
            a={a.position}
            b={b.position}
            active={active}
            color={active ? a.color : "#7bfff1"}
            scroll={scroll}
            design={design}
          />
        );
      })}
    </group>
  );
}

function makeParticles(count, radius, height, zOffset) {
  const array = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.68) * radius;

    array[i * 3] = Math.cos(angle) * r;
    array[i * 3 + 1] = -2.8 + Math.random() * height;
    array[i * 3 + 2] = Math.sin(angle) * r + zOffset;
  }

  return array;
}

function ParticleLayer({ positions, color, size, opacity }) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uSize: { value: size },
        uOpacity: { value: opacity },
      },
      vertexShader: `
        uniform float uSize;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float perspectiveScale = clamp(1.0 / max(0.001, -mvPosition.z), 0.12, 2.6);
          gl_PointSize = uSize * 1080.0 * perspectiveScale;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;

        void main() {
          vec2 uv = gl_PointCoord.xy - 0.5;
          float dist = length(uv);

          float softCircle = 1.0 - smoothstep(0.12, 0.5, dist);
          float core = 1.0 - smoothstep(0.0, 0.18, dist);
          float alpha = (softCircle * 0.9 + core * 0.18) * uOpacity;

          if (alpha < 0.006) discard;

          vec3 finalColor = mix(uColor, vec3(1.0), core * 0.28);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });
  }, []);

  useFrame(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uSize.value = size;
    material.uniforms.uOpacity.value = opacity;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>

      <primitive object={material} attach="material" />
    </points>
  );
}

function ParticleField({ scroll, hovered, selected, design }) {
  const group = useRef();
  const front = useRef();
  const { pointer } = useThree();

  const main = useMemo(() => makeParticles(2900, 7.6, 5.8, -1.65), []);
  const green = useMemo(() => makeParticles(850, 6.7, 5.2, -0.85), []);
  const dust = useMemo(() => makeParticles(900, 8.2, 5.9, -2.05), []);

  const hasFocus = hovered || selected;
  const sceneReveal = range(scroll, design.sceneRevealStart, design.sceneRevealEnd);
  const networkProgress = range(scroll, design.networkStart, design.networkEnd);
  const mapProgress = range(scroll, design.mapStart, design.mapEnd);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (group.current) {
      group.current.rotation.y =
        t * (0.012 + networkProgress * 0.012) +
        pointer.x * 0.11 +
        scroll * 0.75;

      group.current.rotation.x = pointer.y * 0.032;

      group.current.position.x = THREE.MathUtils.lerp(
        group.current.position.x,
        pointer.x * 0.45 * sceneReveal * (1 - mapProgress * 0.35),
        0.04
      );

      group.current.position.y = THREE.MathUtils.lerp(
        group.current.position.y,
        pointer.y * 0.16 * sceneReveal - scroll * 0.5,
        0.04
      );

      group.current.children.forEach((child) => {
        child.material.opacity =
          (hasFocus ? design.particleHoverOpacity : design.particleOpacity) *
          (0.35 + sceneReveal * 0.65) *
          (1 + networkProgress * 0.45) *
          (1 - mapProgress * 0.4);

        child.material.size = hasFocus
          ? design.particleHoverSize
          : design.particleSize;
      });
    }

    if (front.current) {
      front.current.rotation.y = -t * 0.018 + pointer.x * 0.14;

      front.current.position.x = THREE.MathUtils.lerp(
        front.current.position.x,
        pointer.x * -0.55,
        0.035
      );
    }
  });

  return (
    <>
      <group ref={group}>
        <ParticleLayer
          positions={main}
          color={design.particleColor}
          size={design.particleSize}
          opacity={design.particleOpacity}
        />

        <ParticleLayer
          positions={green}
          color="#7cff68"
          size={0.013}
          opacity={0.085}
        />
      </group>

      <group ref={front}>
        <ParticleLayer
          positions={dust}
          color="#ffffff"
          size={0.008}
          opacity={0.055}
        />
      </group>
    </>
  );
}

function Atmosphere({ scroll, hovered, fullNetwork, design }) {
  const { pointer } = useThree();
  const mouseLight = useRef();
  const coreLight = useRef();
  const topLight = useRef();

  const sceneReveal = range(scroll, design.sceneRevealStart, design.sceneRevealEnd);
  const mapProgress = range(scroll, design.mapStart, design.mapEnd);
  const networkProgress = range(scroll, design.networkStart, design.networkEnd);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (mouseLight.current) {
      mouseLight.current.position.x = pointer.x * 3.4;
      mouseLight.current.position.y = pointer.y * 1.5;
      mouseLight.current.intensity =
        (hovered ? design.mouseLightHover : design.mouseLight) * sceneReveal;
    }

    if (coreLight.current) {
      coreLight.current.intensity =
        (design.coreLightIntensity +
          Math.sin(t * 1.2) * 0.12 +
          networkProgress * 0.35 +
          (fullNetwork ? 0.65 : 0) -
          mapProgress * 0.7) *
        sceneReveal;
    }

    if (topLight.current) {
      topLight.current.intensity =
        (design.topLightIntensity + Math.sin(t * 0.8) * 0.1 - mapProgress * 0.8) *
        sceneReveal;
    }
  });

  return (
    <>
      <ambientLight
        intensity={design.ambientLight + sceneReveal * 0.16 + mapProgress * 0.05}
      />

      <pointLight
        ref={coreLight}
        position={[design.coreLightX, design.coreLightY, design.coreLightZ]}
        color={design.coreLightColor}
        distance={design.coreLightDistance}
      />

      <pointLight
        ref={mouseLight}
        position={[0, 0.2, 2]}
        color="#68ff9a"
        distance={7}
      />

      <spotLight
        ref={topLight}
        position={[design.topLightX, design.topLightY, design.topLightZ]}
        angle={design.topLightAngle}
        penumbra={1}
        color={design.topLightColor}
        distance={12}
      />

      <spotLight
        position={[-3.2, 2.4, 1.4]}
        angle={0.55}
        penumbra={1}
        intensity={0.9 * sceneReveal}
        color="#76fff0"
        distance={8}
      />
    </>
  );
}

function ColumnGlowLights({ scroll, design }) {
  const group = useRef();

  const lights = useMemo(
    () => [
      { position: [-2.6, -0.9, -2.8], base: 0.32, distance: 3.35, phase: 0.1 },
      { position: [2.35, -0.95, -2.6], base: 0.29, distance: 3.25, phase: 1.2 },
      { position: [-1.25, -1.1, -3.7], base: 0.22, distance: 2.95, phase: 2.1 },
      { position: [1.15, -1.05, -3.9], base: 0.2, distance: 2.85, phase: 2.8 },
      { position: [0, -0.75, -4.35], base: 0.15, distance: 2.55, phase: 3.6 },
    ],
    []
  );

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;
    const sceneReveal = range(scroll, design.sceneRevealStart, design.sceneRevealEnd);
    const mapFade = 1 - range(scroll, design.mapStart, design.mapEnd);
    const colorA = new THREE.Color(design.columnGlowColorA);
    const colorB = new THREE.Color(design.columnGlowColorB);
    const shadow = new THREE.Color(design.columnShadowTint);

    group.current.children.forEach((light, i) => {
      const pulse = 0.82 + Math.sin(t * (0.85 + i * 0.13) + lights[i].phase) * 0.18;
      const colorMix = 0.5 + Math.sin(t * design.columnPulseSpeed + lights[i].phase) * 0.5;
      const tintedColor = colorB.clone().lerp(colorA, colorMix).lerp(shadow, 0.12);

      light.color.lerp(tintedColor, 0.08);
      light.intensity =
        lights[i].base * pulse * sceneReveal * mapFade * design.columnGlowStrength;
    });
  });

  return (
    <group ref={group}>
      {lights.map((item, i) => (
        <pointLight
          key={i}
          position={item.position}
          color={i % 2 === 0 ? design.columnGlowColorA : design.columnGlowColorB}
          intensity={0}
          distance={item.distance}
          decay={2}
        />
      ))}
    </group>
  );
}


function CableTube({ points, color = "#7bfff1", radius = 0.018, opacity = 0.34 }) {
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  }, [points]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 96, radius, 8, false]} />
      <meshStandardMaterial
        color={color}
        roughness={0.72}
        metalness={0.18}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={0.03}
      />
    </mesh>
  );
}

function ChamberSplineParticles({ scroll, design }) {
  const geometry = useRef();

  const curves = useMemo(() => {
    return [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.48, 0.9, 0.04),
        new THREE.Vector3(-0.18, 0.35, -0.08),
        new THREE.Vector3(0.16, -0.08, 0.02),
        new THREE.Vector3(0.44, -0.55, 0.12),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.42, 0.82, -0.1),
        new THREE.Vector3(0.22, 0.25, 0.1),
        new THREE.Vector3(-0.04, -0.18, 0.02),
        new THREE.Vector3(-0.35, -0.58, -0.08),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.05, 1.05, 0.15),
        new THREE.Vector3(0.22, 0.52, -0.05),
        new THREE.Vector3(0.0, 0.0, 0.08),
        new THREE.Vector3(0.12, -0.62, -0.02),
      ]),
    ];
  }, []);

  const { positions, meta } = useMemo(() => {
    const count = 460;
    const positions = new Float32Array(count * 3);
    const meta = Array.from({ length: count }, (_, i) => ({
      curve: i % curves.length,
      offset: Math.random(),
      speed: 0.035 + Math.random() * 0.065,
      spread: 0.025 + Math.random() * 0.09,
      phase: Math.random() * Math.PI * 2,
    }));
    return { positions, meta };
  }, [curves.length]);

  useFrame((state) => {
    if (!geometry.current) return;

    const chamberReveal = smooth01(range(scroll, design.chamberStart, design.chamberEnd));
    const mapFade = 1 - smooth01(range(scroll, design.mapStart - 0.05, design.mapStart + 0.08));
    const t = state.clock.elapsedTime;

    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      const p = curves[m.curve].getPoint((m.offset + t * m.speed) % 1);
      const swirl = t * 1.3 + m.phase;
      positions[i * 3] = p.x + Math.cos(swirl) * m.spread;
      positions[i * 3 + 1] = p.y + Math.sin(swirl * 0.72) * m.spread;
      positions[i * 3 + 2] = p.z + Math.sin(swirl) * m.spread;
    }

    geometry.current.attributes.position.needsUpdate = true;
    geometry.current.computeBoundingSphere();
  });

  const opacity = design.chamberParticleOpacity;

  return (
    <points>
      <bufferGeometry ref={geometry}>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={design.chamberParticleColor}
        size={design.chamberParticleSize}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}


function ActiveSplineParticles({ scroll, design }) {
  const geometry = useRef();
  const material = useRef();

  const curves = useMemo(() => {
    return [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.42, 1.15, -0.03),
        new THREE.Vector3(-0.18, 0.62, 0.12),
        new THREE.Vector3(0.08, 0.08, -0.05),
        new THREE.Vector3(0.32, -0.55, 0.08),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.34, 1.04, 0.1),
        new THREE.Vector3(0.12, 0.55, -0.12),
        new THREE.Vector3(-0.12, -0.02, 0.08),
        new THREE.Vector3(-0.34, -0.58, -0.04),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 1.24, 0.0),
        new THREE.Vector3(0.24, 0.55, 0.02),
        new THREE.Vector3(-0.18, 0.05, -0.08),
        new THREE.Vector3(0.02, -0.7, 0.08),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.55, 0.42, -0.2),
        new THREE.Vector3(-0.2, 0.28, 0.12),
        new THREE.Vector3(0.18, 0.14, -0.12),
        new THREE.Vector3(0.56, -0.08, 0.18),
      ]),
    ];
  }, []);

  const { positions, seeds } = useMemo(() => {
    const count = 760;
    const positions = new Float32Array(count * 3);
    const seeds = Array.from({ length: count }, (_, i) => ({
      curve: i % curves.length,
      offset: Math.random(),
      speed: 0.028 + Math.random() * 0.055,
      spread: 0.018 + Math.random() * 0.075,
      phase: Math.random() * Math.PI * 2,
      vertical: Math.random() * 0.05,
    }));
    return { positions, seeds };
  }, [curves.length]);

  const shader = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(design.chamberParticleColor) },
        uOpacity: { value: 0 },
        uSize: { value: design.chamberParticleSize },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uSize;
        varying float vDepth;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = smoothstep(4.0, 0.0, -mvPosition.z);
          gl_PointSize = uSize * 950.0 / max(0.85, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vDepth;
        void main() {
          vec2 uv = gl_PointCoord.xy - 0.5;
          float d = length(uv);
          float halo = 1.0 - smoothstep(0.14, 0.5, d);
          float core = 1.0 - smoothstep(0.0, 0.13, d);
          float a = (halo * 0.85 + core * 0.35) * uOpacity;
          if (a < 0.004) discard;
          vec3 color = mix(uColor, vec3(1.0), core * 0.42);
          gl_FragColor = vec4(color, a);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    if (!geometry.current) return;
    const reveal = smooth01(range(scroll, design.chamberStart, design.chamberEnd));
    const mapFade = 1 - smooth01(range(scroll, design.mapStart - 0.05, design.mapStart + 0.08));
    const finalReveal = reveal * mapFade;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const u = (seed.offset + t * seed.speed) % 1;
      const p = curves[seed.curve].getPoint(u);
      const swirl = t * 1.45 + seed.phase + u * Math.PI * 6.0;
      positions[i * 3] = p.x + Math.cos(swirl) * seed.spread;
      positions[i * 3 + 1] = p.y + Math.sin(swirl * 0.74) * seed.spread + Math.sin(t + seed.phase) * seed.vertical;
      positions[i * 3 + 2] = p.z + Math.sin(swirl) * seed.spread;
    }

    geometry.current.attributes.position.needsUpdate = true;
    geometry.current.computeBoundingSphere();
    shader.uniforms.uColor.value.set(design.chamberParticleColor);
    shader.uniforms.uOpacity.value = design.chamberParticleOpacity * finalReveal;
    shader.uniforms.uSize.value = design.chamberParticleSize;
    shader.uniforms.uTime.value = t;
  });

  return (
    <points>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <primitive ref={material} object={shader} attach="material" />
    </points>
  );
}

function ReferenceChamber({ scroll, design }) {
  const group = useRef();
  const coreLight = useRef();
  const rimLight = useRef();
  const floorGlow = useRef();

  const supports = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return {
        x: Math.cos(a) * 1.22,
        z: Math.sin(a) * 1.22,
        y: 0.47,
        h: 1.58 + Math.sin(i * 0.83) * 0.12,
      };
    });
  }, []);

  const cables = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const a = (i / 18) * Math.PI * 2;
      const start = [Math.cos(a) * (2.0 + Math.random() * 1.0), 1.65 + Math.random() * 0.5, Math.sin(a) * (0.9 + Math.random() * 0.6) - 0.25];
      const mid1 = [start[0] * 0.62, 1.0 + Math.random() * 0.45, start[2] * 0.72];
      const mid2 = [side * (0.25 + Math.random() * 0.35), 0.35 + Math.random() * 0.35, -0.08 + Math.random() * 0.22];
      const end = [side * (0.08 + Math.random() * 0.24), -0.24 + Math.random() * 0.22, Math.random() * 0.18 - 0.08];
      arr.push([start, mid1, mid2, end]);
    }
    return arr;
  }, []);

  useFrame((state) => {
    const reveal = smooth01(range(scroll, design.chamberStart, design.chamberEnd));
    const mapFade = 1 - smooth01(range(scroll, design.mapStart - 0.05, design.mapStart + 0.08));
    const finalReveal = reveal * mapFade;
    const t = state.clock.elapsedTime;

    if (group.current) {
      group.current.visible = finalReveal > 0.015;
      group.current.position.set(design.chamberX, design.chamberY - (1 - reveal) * 0.85, design.chamberZ);
      group.current.scale.setScalar(design.chamberScale * (0.92 + finalReveal * 0.08));
      group.current.rotation.y = Math.sin(t * 0.12) * 0.018;

      group.current.traverse((child) => {
        if (child.material && "opacity" in child.material) {
          child.material.opacity = (child.userData.baseOpacity ?? 1) * finalReveal;
        }
      });
    }

    if (coreLight.current) coreLight.current.intensity = design.chamberLightIntensity * finalReveal * (0.85 + Math.sin(t * 1.2) * 0.12);
    if (rimLight.current) rimLight.current.intensity = design.chamberLightIntensity * 0.34 * finalReveal;
    if (floorGlow.current) floorGlow.current.material.opacity = 0.2 * finalReveal * (0.88 + Math.sin(t * 0.9) * 0.12);
  });

  return (
    <group ref={group} visible={false}>
      <pointLight ref={coreLight} color={design.chamberParticleColor} position={[0, 0.1, 0.18]} distance={5.2} decay={2} />
      <pointLight ref={rimLight} color="#d7fff7" position={[0.85, 1.45, 1.0]} distance={4.2} decay={2} />

      {/* Dark containment room, not a crystal model. */}
      <mesh position={[0, -0.92, -0.15]} rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.34 }}>
        <circleGeometry args={[2.65, 128]} />
        <meshStandardMaterial color="#101918" roughness={0.75} metalness={0.15} transparent opacity={0.34} />
      </mesh>

      <mesh ref={floorGlow} position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.2 }}>
        <circleGeometry args={[1.6, 128]} />
        <meshBasicMaterial color={design.chamberParticleColor} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.46 }}>
        <torusGeometry args={[1.28, 0.032, 16, 192]} />
        <meshStandardMaterial color="#8fa6a2" roughness={0.42} metalness={0.75} transparent opacity={0.46} />
      </mesh>

      <mesh position={[0, 1.28, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.34 }}>
        <torusGeometry args={[1.34, 0.042, 18, 192]} />
        <meshStandardMaterial color="#9bb5ae" roughness={0.35} metalness={0.78} transparent opacity={0.34} />
      </mesh>

      <mesh position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.1 }}>
        <cylinderGeometry args={[0.62, 0.62, 1.45, 64, 1, true]} />
        <meshBasicMaterial color={design.chamberParticleColor} transparent opacity={0.1} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {supports.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} userData={{ baseOpacity: 0.28 }}>
          <cylinderGeometry args={[0.014, 0.024, s.h, 10]} />
          <meshStandardMaterial color="#778884" roughness={0.48} metalness={0.72} transparent opacity={0.28} />
        </mesh>
      ))}

      {cables.map((points, i) => (
        <CableTube
          key={i}
          points={points}
          color={i % 3 === 0 ? design.chamberParticleColor : design.chamberCableColor}
          radius={i % 3 === 0 ? 0.012 : 0.008}
          opacity={i % 3 === 0 ? 0.28 : 0.18}
        />
      ))}

      <ActiveSplineParticles scroll={scroll} design={design} />
    </group>
  );
}

function Scene({
  scroll,
  hovered,
  selected,
  activatedNodes,
  setHovered,
  setSelected,
  setActivatedNodes,
  design,
  mapPanelOpen,
}) {
  const fullNetwork = activatedNodes.length === CISTERNS.length;
  const mapProgress = range(scroll, design.mapStart, design.mapEnd);

  return (
    <>
      <color attach="background" args={[design.background]} />

      <fog
        attach="fog"
        args={[
          design.fogColor,
          design.fogNear - mapProgress * 0.8,
          design.fogFar - mapProgress * 2.8,
        ]}
      />

      <CameraRig selected={selected} scroll={scroll} design={design} />

      <Atmosphere
        scroll={scroll}
        hovered={hovered}
        fullNetwork={fullNetwork}
        design={design}
      />

      <ColumnGlowLights scroll={scroll} design={design} />

      <Environment preset="night" />

      <ParticleField
        scroll={scroll}
        hovered={hovered}
        selected={selected}
        design={design}
      />

      <IntroCrystalGrid scroll={scroll} design={design} />

      {/* The large 3D frosted panel competed with the story UI and caused
          visual overlap during the narrative acts. Keep it disabled for the
          story flow; the MapLibre detail panel handles node details in the final map. */}
      {false && (
        <FrostedInfoPanel3D
          scroll={scroll}
          current={getNode(hovered || selected || "basilica")}
          design={design}
          mapPanelOpen={mapPanelOpen}
        />
      )}

      <Suspense fallback={null}>
        <ReferenceChamber scroll={scroll} design={design} />

        <SceneEnvironment scroll={scroll} design={design} />

        <RootNetwork
          scroll={scroll}
          selected={selected}
          activatedNodes={activatedNodes}
          design={design}
        />

        {CISTERNS.map((node) => (
          <CrystalNode
            key={node.id}
            node={node}
            scroll={scroll}
            hovered={hovered}
            selected={selected}
            activatedNodes={activatedNodes}
            setHovered={setHovered}
            setSelected={setSelected}
            setActivatedNodes={setActivatedNodes}
            design={design}
          />
        ))}
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={
            design.bloomIntensity +
            range(scroll, design.networkStart, design.networkEnd) * 0.12
          }
          luminanceThreshold={design.bloomThreshold}
          luminanceSmoothing={design.bloomSmoothing}
        />

        <Vignette
          offset={design.vignetteOffset}
          darkness={design.vignetteDarkness + mapProgress * 0.12}
        />
      </EffectComposer>
    </>
  );
}

function EnergyMap({
  scroll,
  hovered,
  selected,
  activatedNodes,
  setHovered,
  setSelected,
  setActivatedNodes,
  design,
  setMapPanelOpen,
}) {
  const visibleProgress = range(scroll, design.mapStart, design.mapEnd);
  const fullNetwork = activatedNodes.length === CISTERNS.length;
  const activeId = hovered || selected || "basilica";

  function activateNode(id) {
    setSelected(id);
    setActivatedNodes((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setMapPanelOpen(true);
  }

  return (
    <svg
      className={`energyMap ${visibleProgress > 0.03 ? "visible" : ""} ${
        fullNetwork ? "fullNetwork" : ""
      }`}
      style={{
        opacity: visibleProgress,
        transform: `translateY(${(1 - visibleProgress) * 70}px) scale(${
          0.92 + visibleProgress * 0.08
        })`,
        filter: `blur(${(1 - visibleProgress) * 12}px)`,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="svgGlow">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="mapCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(120,255,240,0.22)" />
          <stop offset="100%" stopColor="rgba(120,255,240,0)" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="100" height="100" fill="url(#mapCoreGlow)" />

      <path
        className="istanbulOutline"
        d="M 17 40 C 28 31, 41 31, 53 35 C 64 39, 74 35, 85 41 C 78 50, 64 52, 52 49 C 39 46, 30 52, 17 46 Z"
      />

      <path
        className="istanbulWater"
        d="M 10 61 C 27 55, 43 58, 58 55 C 73 52, 85 56, 93 51"
      />

      {CONNECTIONS.map(([from, to]) => {
        const a = getNode(from);
        const b = getNode(to);

        const selectedConnection = activeId === from || activeId === to;
        const activatedConnection =
          activatedNodes.includes(from) && activatedNodes.includes(to);
        const active = selectedConnection || activatedConnection || fullNetwork;

        const d = `M ${a.ui[0]} ${a.ui[1]} C ${(a.ui[0] + b.ui[0]) / 2} ${
          a.ui[1] - 12
        }, ${(a.ui[0] + b.ui[0]) / 2} ${b.ui[1] + 12}, ${b.ui[0]} ${b.ui[1]}`;

        return (
          <g key={`${from}-${to}`}>
            <path className={`mapLine ${active ? "active" : ""}`} d={d} />

            {active && visibleProgress > 0.6 && (
              <circle className="flowDot" r="0.5">
                <animateMotion dur="2.7s" repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        );
      })}

      {CISTERNS.map((node) => {
        const active =
          activeId === node.id || activatedNodes.includes(node.id) || fullNetwork;

        return (
          <g
            key={node.id}
            className={`mapNode ${active ? "active" : ""}`}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => activateNode(node.id)}
          >
            <circle cx={node.ui[0]} cy={node.ui[1]} r={active ? 1.32 : 0.82} />
            <circle
              className="mapNodeHalo"
              cx={node.ui[0]}
              cy={node.ui[1]}
              r="3.2"
            />
            <text x={node.ui[0] + 2.1} y={node.ui[1] - 1.2}>
              {node.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function InfoPanel({
  scroll,
  current,
  activatedNodes,
  setSelected,
  setActivatedNodes,
  design,
}) {
  const sceneReveal = range(scroll, design.panelRevealStart, design.panelRevealEnd);
  const mapProgress = range(scroll, design.mapStart, design.mapEnd);

  function activateCurrent() {
    setSelected(current.id);
    setActivatedNodes((prev) =>
      prev.includes(current.id) ? prev : [...prev, current.id]
    );
  }

  return (
    <aside
      className={`readout iceReadout ${mapProgress > 0.62 ? "mapMode" : ""}`}
      style={{
        "--accent": current.color,
        "--iceOpacity": design.icePanelOpacity,
        "--iceBlur": `${design.icePanelBlur}px`,
        "--iceFrost": design.icePanelFrost,
        "--iceEdgeGlow": design.icePanelEdgeGlow,
        "--iceCrackOpacity": design.icePanelCrackOpacity,
        "--iceNoiseOpacity": design.icePanelNoiseOpacity,
        opacity: sceneReveal,
        width: `${design.panelWidth}px`,
        right: `${design.panelRight}px`,
        transform: `translateY(-50%) perspective(1000px) rotateY(${design.panelRotateY}deg) rotateX(${design.panelRotateX}deg) translateX(${
          (1 - sceneReveal) * 42
        }px) scale(${design.panelScale})`,
        pointerEvents: sceneReveal > 0.4 ? "auto" : "none",
      }}
    >
      <div className="icePanelSkin" />
      <div className="icePanelShine" />
      <div className="icePanelCracks" />
      <div className="icePanelNoise" />

      <div className="glassPreview icePreview">
        <div className="glassCore" />
        <i />
        <span>{current.number} / 05</span>
      </div>

      <div className="readoutTop">
        <span>NODE {current.number}</span>
        <b>{mapProgress > 0.62 ? "MAP NODE" : current.role}</b>
      </div>

      <h2>{current.fullName}</h2>

      <p>{current.text}</p>

      <div className="stats">
        <div>
          <span>ENERGY DENSITY</span>
          <b>{current.density}</b>
        </div>

        <div>
          <span>FLOW RATE</span>
          <b>{current.flow}</b>
        </div>

        <div>
          <span>STATUS</span>
          <b>{activatedNodes.includes(current.id) ? "ACTIVE" : current.status}</b>
        </div>

        <div>
          <span>NODES ONLINE</span>
          <b>
            {activatedNodes.length} / {CISTERNS.length}
          </b>
        </div>
      </div>

      <button onClick={activateCurrent}>
        {mapProgress > 0.62 ? "ACTIVATE MAP NODE" : "FOCUS NODE"}
      </button>
    </aside>
  );
}



function useActiveGlassTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const grd = ctx.createLinearGradient(0, 0, size, size);
    grd.addColorStop(0, "rgba(215,255,248,0.25)");
    grd.addColorStop(0.35, "rgba(16,38,42,0.42)");
    grd.addColorStop(0.72, "rgba(3,8,10,0.72)");
    grd.addColorStop(1, "rgba(130,255,230,0.18)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 4200; i++) {
      const v = 180 + Math.random() * 75;
      ctx.fillStyle = `rgba(${v},${v},${v},${0.012 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }

    for (let i = 0; i < 58; i++) {
      ctx.strokeStyle = `rgba(210,255,250,${0.02 + Math.random() * 0.04})`;
      ctx.lineWidth = Math.random() * 1.1;
      ctx.beginPath();
      const x = Math.random() * size;
      ctx.moveTo(x, Math.random() * size);
      ctx.lineTo(x + 80 + Math.random() * 220, Math.random() * size);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function usePanelTextTexture(current) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(225,255,250,0.88)";
    ctx.font = "600 28px Inter, Arial, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText(`NODE ${current.number} / ${current.role}`.toUpperCase(), 68, 82);

    ctx.strokeStyle = "rgba(130,255,240,0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(68, 112);
    ctx.lineTo(910, 112);
    ctx.stroke();

    ctx.fillStyle = "rgba(246,255,253,0.96)";
    ctx.font = "300 68px Inter, Arial, sans-serif";
    ctx.fillText(current.fullName.toUpperCase(), 68, 202);

    ctx.fillStyle = "rgba(220,245,240,0.72)";
    ctx.font = "300 26px Inter, Arial, sans-serif";
    const words = current.text.split(" ");
    let line = "";
    let y = 276;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > 790) {
        ctx.fillText(line, 68, y);
        line = word + " ";
        y += 42;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, 68, y);

    ctx.fillStyle = "rgba(135,255,242,0.62)";
    ctx.font = "500 22px Inter, Arial, sans-serif";
    ctx.fillText(`ENERGY ${current.density}   FLOW ${current.flow}   STATUS ${current.status}`.toUpperCase(), 68, 455);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [current.id, current.number, current.role, current.fullName, current.text, current.density, current.flow, current.status]);
}

function FrostedInfoPanel3D({ scroll, current, design, mapPanelOpen }) {
  const group = useRef();
  const glassMaterial = useRef();
  const edgeRef = useRef();
  const refractionTexture = useActiveGlassTexture();
  const textTexture = usePanelTextTexture(current);

  const sceneReveal = smooth01(range(scroll, design.panelRevealStart, design.panelRevealEnd));
  const descendFade = 1 - smooth01(range(scroll, design.descendStart - 0.04, design.descendStart + 0.06));
  const mapProgress = smooth01(range(scroll, design.mapStart, design.mapEnd));
  const mapNodeReveal = mapPanelOpen ? mapProgress * design.panel3DMapVisibility : 0;
  const reveal = design.panel3DAlwaysVisible ? 1 : Math.max(sceneReveal * descendFade, mapNodeReveal);
  const visible = design.show3DPanel && reveal > 0.03;

  const shader = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        tRefraction: { value: refractionTexture },
        tEnv: { value: refractionTexture },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uDistortStrength: { value: design.panel3DDistortion },
        uFresnelPow: { value: 1.8 },
        uRefractionRatio: { value: 1.05 },
        uTint: { value: new THREE.Color(design.panel3DColor) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D tRefraction;
        uniform sampler2D tEnv;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uDistortStrength;
        uniform float uFresnelPow;
        uniform float uRefractionRatio;
        uniform vec3 uTint;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        float edge(vec2 uv) {
          vec2 e = smoothstep(vec2(0.0), vec2(0.08), uv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - uv);
          return 1.0 - e.x * e.y;
        }

        void main() {
          float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), uFresnelPow);
          vec2 distortion = vec2(
            sin(vUv.y * 18.0 + uTime * 0.55),
            cos(vUv.x * 16.0 - uTime * 0.42)
          ) * 0.018 * uDistortStrength;
          vec3 refracted = texture2D(tRefraction, vUv * uRefractionRatio + distortion).rgb;
          vec3 env = texture2D(tEnv, vUv + distortion * 0.45).rgb;
          float border = edge(vUv);
          vec3 color = mix(refracted * 0.55, uTint, 0.34);
          color += env * 0.18;
          color += vec3(0.72, 1.0, 0.94) * fresnel * 0.48;
          color += vec3(0.38, 1.0, 0.9) * border * 0.22;
          float alpha = uOpacity * (0.28 + fresnel * 0.36 + border * 0.26);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, [refractionTexture]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (glassMaterial.current) {
      glassMaterial.current.uniforms.uTime.value = t;
      glassMaterial.current.uniforms.uOpacity.value = reveal * design.panel3DGlassOpacity;
      glassMaterial.current.uniforms.uDistortStrength.value = design.panel3DDistortion;
      glassMaterial.current.uniforms.uFresnelPow.value = design.panel3DFresnelPow;
      glassMaterial.current.uniforms.uRefractionRatio.value = design.panel3DRefractionRatio;
      glassMaterial.current.uniforms.uTint.value.set(design.panel3DColor);
    }

    if (edgeRef.current) {
      edgeRef.current.material.opacity = design.panel3DEdgeOpacity * reveal * (0.75 + Math.sin(t * 0.9) * 0.08);
    }

    if (!group.current) return;
    group.current.visible = visible;
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, design.panel3DX, 0.06);
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, design.panel3DY, 0.06);
    group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, design.panel3DZ, 0.06);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, design.panel3DRotX, 0.06);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, design.panel3DRotY, 0.06);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, design.panel3DRotZ, 0.06);
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, Math.max(0.001, reveal) * design.panel3DScale, 0.06));
  });

  return (
    <group ref={group} visible={false}>
      <RoundedBox args={[design.panel3DWidth, design.panel3DHeight, design.panel3DThickness]} radius={design.panel3DRadius} smoothness={18}>
        <primitive ref={glassMaterial} object={shader} attach="material" />
      </RoundedBox>

      <mesh ref={edgeRef} position={[0, 0, design.panel3DThickness * 0.72]}>
        <planeGeometry args={[design.panel3DWidth * 1.015, design.panel3DHeight * 1.015]} />
        <meshBasicMaterial color={design.panel3DColor} transparent opacity={0} wireframe depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh position={[0, 0, design.panel3DThickness * 0.92]}>
        <planeGeometry args={[design.panel3DWidth * 0.88, design.panel3DHeight * 0.72]} />
        <meshBasicMaterial map={textTexture} transparent opacity={reveal * design.panel3DTextOpacity} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}



/* -------------------------------------------------------------------------- */
/*                   CINEMATIC LOADING + SCROLL STORY LAYER                   */
/* -------------------------------------------------------------------------- */

function lerpNumber(a, b, t) {
  return a + (b - a) * t;
}

function RichStoryLine({ tokens = [] }) {
  return (
    <span className="cinematicStoryLineText">
      {tokens.map((token, index) => {
        if (typeof token === "string") {
          return <span key={index}>{token}</span>;
        }

        return (
          <span
            key={index}
            className={`${token.strong ? "is-strong" : ""} ${token.muted ? "is-muted" : ""}`}
          >
            {token.text}
          </span>
        );
      })}
    </span>
  );
}

function getCinematicStoryBeats(design) {
  return [
    {
      id: "istanbul-2556",
      start: design.storyDescentStart,
      end: design.storyDescentEnd,
      align: "left",
      eyebrow: "ISTANBUL / 2556",
      lines: [
        ["The city has ", { text: "run out of water", strong: true }, "."],
        ["Beneath the surface,"],
        ["the old ", { text: "cisterns", strong: true }, " have begun to ", { text: "produce light", strong: true }, "."],
      ],
    },
    {
      id: "underground-reaction",
      start: design.storyReactionStart,
      end: design.storyReactionEnd,
      align: "left",
      eyebrow: "ACT 01 / UNDERGROUND REACTION",
      lines: [
        ["As water disappeared,"],
        [{ text: "minerals", strong: true }, ", pressure and darkness"],
        ["triggered a new ", { text: "crystalline phase", strong: true }, "."],
      ],
    },
    {
      id: "energy-core",
      start: design.storyCoreStart,
      end: design.storyCoreEnd,
      align: "right",
      eyebrow: "ACT 02 / ENERGY CORE",
      lines: [
        ["The crystal does not produce water."],
        ["It converts the cistern reaction"],
        ["into ", { text: "electrical light", strong: true }, "."],
      ],
    },
    {
      id: "transmission",
      start: design.storyPortalStart,
      end: design.storyPortalEnd,
      align: "left",
      eyebrow: "ACT 03 / TRANSMISSION",
      lines: [
        ["The crystal opens a ", { text: "passage", strong: true }, "."],
        ["Energy leaves the cistern"],
        ["and enters the ", { text: "underground grid", strong: true }, "."],
      ],
    },
    {
      id: "network-map",
      start: design.storyMapStart,
      end: design.storyMapEnd,
      align: "left",
      eyebrow: "ACT 04 / CRYSTALLINE NETWORK",
      lines: [
        [{ text: "Five cisterns", strong: true }, " awaken beneath Istanbul."],
        ["Together, they form"],
        ["the city's hidden ", { text: "power system", strong: true }, "."],
      ],
    },
  ];
}

function getBeatVisibility(scroll, beat, fadeSize) {
  const span = Math.max(beat.end - beat.start, 0.001);
  const fade = Math.min(Math.max(fadeSize, 0.006), span * 0.45);
  const enter = smooth01(range(scroll, beat.start, beat.start + fade));
  const exit = 1 - smooth01(range(scroll, beat.end - fade, beat.end));
  return clamp01(enter * exit);
}

function getBeatPlainText(beat) {
  return beat.lines
    .map((line) =>
      line
        .map((part) => (typeof part === "string" ? part : part.text))
        .join("")
        .trim()
    )
    .join(" ");
}


function splitStoryTextToChars(text) {
  const words = String(text || "").split(/(\s+)/);
  let charKey = 0;

  return words.map((word, wordIndex) => {
    if (/^\s+$/.test(word)) {
      return <span key={`space-${wordIndex}`} className="storySpace">{word}</span>;
    }

    return (
      <span key={`word-${wordIndex}`} className="storyWord">
        {word.split("").map((char) => (
          <span key={`char-${charKey++}`} className="storyChar">
            {char}
          </span>
        ))}
      </span>
    );
  });
}

function getActiveGsapStoryBeat(scroll, design) {
  const beats = getCinematicStoryBeats(design).filter((beat) => beat.id !== "istanbul-2556");
  const fade = Math.max(0.060, Number(design.storyFadeSize ?? 0.082));

  const candidates = beats
    .map((beat) => {
      const start = Number(beat.start ?? 0);
      const end = Number(beat.end ?? start + 0.13);
      const enter = smoother01(range(scroll, start - fade * 0.72, start + fade * 0.88));
      const exit = 1 - smoother01(range(scroll, end - fade * 0.88, end + fade * 0.72));
      const opacity = clamp01(enter * exit);

      return {
        beat,
        opacity,
        entering: 1 - enter,
        leaving: 1 - exit,
        score: opacity,
      };
    })
    .filter((item) => item.opacity > 0.018)
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
}

function CinematicStoryLayer({ scroll, design, current, fullNetwork }) {
  const active = useMemo(() => getActiveGsapStoryBeat(scroll, design), [scroll, design]);
  const panelRef = useRef(null);

  useGSAP(
    () => {
      if (!panelRef.current || !active?.beat) return;

      const chars = panelRef.current.querySelectorAll(".storyChar");
      const lines = panelRef.current.querySelectorAll(".cinematicStoryLine, .cinematicStoryKicker");

      gsap.killTweensOf(panelRef.current);
      gsap.killTweensOf(chars);
      gsap.killTweensOf(lines);

      gsap.fromTo(
        panelRef.current,
        { autoAlpha: 0, y: 18, x: active.beat.align === "right" ? 18 : -18, filter: "blur(8px)" },
        { autoAlpha: 1, y: 0, x: 0, filter: "blur(0px)", duration: 0.58, ease: "power3.out" }
      );

      gsap.fromTo(
        chars,
        { yPercent: 78, autoAlpha: 0, filter: "blur(7px)" },
        {
          yPercent: 0,
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: 0.62,
          ease: "power3.out",
          stagger: {
            each: 0.009,
            from: active.beat.align === "right" ? "end" : "start",
          },
        }
      );

      gsap.fromTo(
        lines,
        { y: 14, autoAlpha: 0, filter: "blur(4px)" },
        { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.44, ease: "power2.out", stagger: 0.045, delay: 0.05 }
      );

      return () => {
        gsap.killTweensOf(panelRef.current);
        gsap.killTweensOf(chars);
        gsap.killTweensOf(lines);
      };
    },
    { dependencies: [active?.beat?.id], scope: panelRef }
  );

  if (!active) return null;

  const { beat, opacity, entering, leaving } = active;
  const finalOpacity = clamp01(opacity * (design.storyOpacity || 0.94));
  const y = entering * 9 - leaving * 8;
  const x = beat.align === "right" ? entering * 8 - leaving * 6 : -entering * 8 + leaving * 6;
  const blur = (entering + leaving) * 1.6;
  const titleText = beat.lines
    .map((line) => line.map((part) => (typeof part === "string" ? part : part.text)).join("").trim())
    .join(" ");

  return (
    <div
      className={`cinematicStoryLayer gsapSafeStory ${beat.align === "right" ? "right" : "left"}`}
      style={{
        "--storyX": `${design.storyX || 4.2}vw`,
        "--storyY": `${design.storyY || 34}vh`,
        "--storyMaxWidth": `${design.storyMaxWidth || 880}px`,
        "--storyAccent": design.storyAccent || "#9ffff3",
        "--storyColor": design.storyColor || "rgba(226, 242, 238, 0.82)",
        "--storyTitleSize": `${Number(design.storyTitleSize || 40)}px`,
        "--storyKickerSize": `${design.storyKickerSize || 10}px`,
        opacity: finalOpacity,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        filter: `blur(${blur}px)`,
        pointerEvents: "none",
      }}
    >
      <aside ref={panelRef} className="cinematicStoryCard gsapSafeStoryCard">
        <div className="cinematicStoryKicker">{beat.eyebrow}</div>

        <div className="cinematicStoryText cinematicStoryTitle">
          {splitStoryTextToChars(titleText)}
        </div>

        <div className="cinematicStoryLines">
          {beat.lines.map((line, lineIndex) => (
            <p className="cinematicStoryLine" key={`${beat.id}-${lineIndex}`}>
              {line.map((part, partIndex) => {
                if (typeof part === "string") return <span key={partIndex}>{part}</span>;
                return <strong key={partIndex}>{part.text}</strong>;
              })}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}


function CinematicPreloader({ design, onDone }) {
  const { progress } = useProgress();
  const [visualProgress, setVisualProgress] = useState(0);
  const [phase, setPhase] = useState("loading");
  const doneRef = useRef(false);
  const startedRef = useRef(performance.now());
  const progressRef = useRef(progress);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!design.loadingEnabled) {
      onDoneRef.current?.();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - startedRef.current;
      const minDuration = design.loadingMinDurationMs;
      const realProgress = progressRef.current;
      const realReady = realProgress >= 99.5;
      const fakeRamp = clamp01(elapsed / Math.max(minDuration, 1)) * 72;
      let target = Math.max(fakeRamp, realProgress * 0.88);

      if (!realReady || elapsed < minDuration) {
        target = Math.min(target, 92);
      } else {
        target = 100;
      }

      setVisualProgress((current) => {
        const next = lerpNumber(current, target, 0.075);

        if (!doneRef.current && next > 99.3 && realReady && elapsed >= minDuration) {
          doneRef.current = true;
          setPhase("detected");

          window.setTimeout(() => setPhase("exit"), design.loadingDetectedHoldMs);
          window.setTimeout(() => {
            document.body.style.overflow = previousOverflow;
            onDoneRef.current?.();
          }, design.loadingDetectedHoldMs + design.loadingExitMs);
        }

        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
    };
  }, [design.loadingEnabled, design.loadingMinDurationMs, design.loadingDetectedHoldMs, design.loadingExitMs]);

  if (!design.loadingEnabled) return null;

  return (
    <div
      className={`cinematicLoader ${phase}`}
      style={{
        "--loaderProgress": `${visualProgress}%`,
        "--loaderAccent": design.loadingAccent,
        "--loaderText": design.loadingText,
        "--loaderBg": design.loadingBackground,
        "--loaderLineOpacity": design.loadingLineOpacity,
      }}
    >
      <div className="cinematicLoaderTopline">
        <span>CRYSTALLINE NETWORK</span>
        <span>ISTANBUL / 2556</span>
      </div>

      <div className="cinematicLoaderCenter">
        <div className="loaderGlyph" aria-hidden="true">
          <span />
          <i />
        </div>

        <div className="loaderCopy">
          <div className="loaderStatusText">
            {phase === "detected" ? "UNDERGROUND ENERGY SIGNAL DETECTED" : "INITIALIZING CRYSTALLINE NETWORK"}
          </div>
          <div className="loaderSubText">
            {phase === "detected" ? "reaction path stabilized" : "booting cistern energy sequence"}
          </div>
        </div>
      </div>

      <div className="cinematicLoaderRail" aria-hidden="true">
        <div className="cinematicLoaderFill" />
        <div className="cinematicLoaderScan" />
      </div>
    </div>
  );
}

function IntroMinimalInterface({ introOpacity }) {
  return (
    <section
      className="interface introOnlyInterface cinematicIntroMinimal"
      style={{
        opacity: introOpacity,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <nav className="nav cinematicIntroNav">
        <span>CRYSTALLINE NETWORK</span>
        <div className="navPill">
          <span>ISTANBUL / 2556</span>
        </div>
      </nav>

      <div className="introOpeningTitle">
        <span>ISTANBUL / YEAR 2556</span>
        <b>THE CITY HAS RUN OUT OF WATER.</b>
        <small>Reservoirs have fallen silent. Beneath the streets, forgotten cisterns begin to react — not as water stores, but as a buried crystalline network waking under pressure.</small>
      </div>

      <div className="cinematicScrollHint">
        <span />
        <b>SCROLL TO DESCEND</b>
      </div>
    </section>
  );
}

function CisternRoleStrip({ visible }) {
  function enterFocus(node) {
    document.body.classList.add("story-focus-mode");
    document.body.style.setProperty("--focus-color", node.color);
  }

  function leaveFocus() {
    document.body.classList.remove("story-focus-mode");
    document.body.style.removeProperty("--focus-color");
  }

  return (
    <div className={`storyRoles ${visible ? "show" : ""}`}>
      {CISTERNS.map((node) => (
        <button
          key={node.id}
          type="button"
          className="storyRole"
          style={{ "--role-color": node.color }}
          onMouseEnter={() => enterFocus(node)}
          onMouseLeave={leaveFocus}
          onFocus={() => enterFocus(node)}
          onBlur={leaveFocus}
        >
          <span>{node.number}</span>
          <b>{node.name}</b>
          <i>{node.role}</i>
        </button>
      ))}
    </div>
  );
}

function StoryProgress({ activeIndex }) {
  return (
    <div className="storyProgress" aria-hidden="true">
      {STORY_ACTS.map((act, index) => (
        <span key={act.id} className={index <= activeIndex ? "on" : ""}>
          {act.id}
        </span>
      ))}
    </div>
  );
}

function StoryOverlay({ scroll, current, fullNetwork }) {
  const activeIndex = getStoryIndex(scroll);
  const act = STORY_ACTS[activeIndex];
  const local = getStoryProgress(scroll);
  const nextAct = STORY_ACTS[Math.min(activeIndex + 1, STORY_ACTS.length - 1)];
  const panelRef = useRef(null);

  // Keep narrative panels readable while the user scrolls.
  // The active act stays crisp; GSAP only performs a quick entrance animation
  // when the act changes, so panels never remain half-blurred.
  const showRoles = activeIndex === 3;
  const panelOpacity = activeIndex === STORY_ACTS.length - 1 && fullNetwork ? 0.92 : 1;

  useGSAP(
    () => {
      if (!panelRef.current) return;

      const title = panelRef.current.querySelector(".storyTitle");
      const content = panelRef.current.querySelectorAll(
        ".storyLead, .storyBody, .storyDataLine, .storyMeta, .storyMeta span, .storyMeta i"
      );

      gsap.killTweensOf(panelRef.current);
      gsap.killTweensOf(title);
      gsap.killTweensOf(content);

      gsap.fromTo(
        panelRef.current,
        { autoAlpha: 0, x: -18, y: 10, filter: "blur(6px)" },
        { autoAlpha: panelOpacity, x: 0, y: 0, filter: "blur(0px)", duration: 0.48, ease: "power3.out" }
      );

      if (title) {
        gsap.fromTo(
          title,
          { autoAlpha: 0, y: 12, filter: "blur(5px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.52, ease: "power3.out", delay: 0.04 }
        );
      }

      gsap.fromTo(
        content,
        { autoAlpha: 0, y: 10, filter: "blur(3px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.36, ease: "power2.out", stagger: 0.035, delay: 0.08 }
      );

      return () => {
        gsap.killTweensOf(panelRef.current);
        gsap.killTweensOf(title);
        gsap.killTweensOf(content);
      };
    },
    { dependencies: [act.id, panelOpacity], scope: panelRef }
  );

  return (
    <div className={`storyOverlay story-${act.slug}`}>
      <aside
        ref={panelRef}
        className="storyPanel"
        key={act.id}
        style={{
          opacity: panelOpacity,
        }}
      >
        <div className="storyMeta">
          <span>ACT {act.id}</span>
          <i>{act.kicker}</i>
        </div>

        <h1 className="storyTitle">{act.title}</h1>
        <p className="storyLead">{act.lead}</p>
        <p className="storyBody">{act.body}</p>

        <div className="storyDataLine">
          <span>{act.micro}</span>
          <b>{activeIndex === STORY_ACTS.length - 1 && fullNetwork ? "COMPLETE" : current.role}</b>
        </div>
      </aside>

      <div className="storyNextHint">
        <span>NEXT</span>
        <b>{nextAct.title}</b>
      </div>

      <CisternRoleStrip visible={showRoles} />
      <StoryProgress activeIndex={activeIndex} />
    </div>
  );
}

function StoryScrollSpace() {
  return (
    <section className="scroll-space storyScrollSpace" aria-hidden="true">
      {STORY_ACTS.map((act) => (
        <div key={act.id} className="storySnapPoint" />
      ))}
    </section>
  );
}

function RainGlassLayer({ scroll, design }) {
  const streaks = useMemo(() => {
    return Array.from({ length: design.rainStreakCount }).map((_, index) => ({
      id: index,
      left: Math.random() * 100,
      delay: Math.random() * -8,
      duration: design.rainStreakSpeed + Math.random() * 1.8,
      height: 70 + Math.random() * 150,
      opacity: 0.1 + Math.random() * 0.42,
      blur: Math.random() > 0.7 ? 1.1 : 0.15,
    }));
  }, [design.rainStreakCount, design.rainStreakSpeed]);

  const droplets = useMemo(() => {
    return Array.from({ length: design.dropletCount }).map((_, index) => ({
      id: index,
      left: 4 + Math.random() * 92,
      top: -20 - Math.random() * 90,
      size:
        design.dropletMinSize +
        Math.random() * (design.dropletMaxSize - design.dropletMinSize),
      delay: Math.random() * -12,
      duration: design.dropletSpeed + Math.random() * 5.5,
      drift: -18 + Math.random() * 36,
      trail: 70 + Math.random() * design.dropletTrailLength,
      opacity: 0.14 + Math.random() * 0.26,
    }));
  }, [
    design.dropletCount,
    design.dropletMinSize,
    design.dropletMaxSize,
    design.dropletSpeed,
    design.dropletTrailLength,
  ]);

  const sceneReveal = range(
    scroll,
    design.sceneRevealStart - 0.04,
    design.sceneRevealEnd
  );

  const mapFade = 1 - range(scroll, 0.76, 1);

  return (
    <div
      className="rainGlass"
      style={{
        "--rainOpacity":
          design.rainOpacity * (0.42 + sceneReveal * 0.58) * mapFade,
        "--dropletBlur": `${design.dropletBlur}px`,
        "--dropletTrailOpacity": design.dropletTrailOpacity,
      }}
    >
      <div className="rainStreaks">
        {streaks.map((drop) => (
          <span
            key={drop.id}
            style={{
              left: `${drop.left}%`,
              height: `${drop.height}px`,
              animationDelay: `${drop.delay}s`,
              animationDuration: `${drop.duration}s`,
              opacity: drop.opacity,
              filter: `blur(${drop.blur}px)`,
            }}
          />
        ))}
      </div>

      <div className="slidingDroplets">
        {droplets.map((drop) => (
          <span
            key={drop.id}
            className="wetDrop"
            style={{
              left: `${drop.left}%`,
              top: `${drop.top}%`,
              "--s": drop.size,
              "--speed": `${drop.duration}s`,
              "--delay": `${drop.delay}s`,
              "--drift": `${drop.drift}px`,
              "--trail": `${drop.trail}px`,
              "--dropOpacity": drop.opacity,
            }}
          />
        ))}
      </div>
    </div>
  );
}




function IntroCameraRig({ design }) {
  const { camera, pointer } = useThree();

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.18, 0.045);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, design.cameraY + pointer.y * 0.08, 0.045);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, design.introCameraZ, 0.045);
    camera.fov = THREE.MathUtils.lerp(camera.fov, design.cameraFov, 0.045);
    camera.updateProjectionMatrix();
    camera.lookAt(0.85 + pointer.x * 0.12, -0.08 + pointer.y * 0.06, -2.55);
  });

  return null;
}

function IntroOnlyScene({ scroll, design, hovered, selected }) {
  const introParticleDesign = useMemo(
    () => ({
      ...design,
      particleOpacity: Math.max(design.particleOpacity, 0.14),
      particleHoverOpacity: Math.max(design.particleHoverOpacity, 0.28),
      particleSize: Math.max(design.particleSize, 0.012),
      particleHoverSize: Math.max(design.particleHoverSize, 0.025),
    }),
    [design]
  );

  const particleScroll = Math.max(scroll, design.sceneRevealEnd);

  return (
    <>
      <color attach="background" args={[design.background]} />
      <fog attach="fog" args={[design.fogColor, design.fogNear, design.fogFar]} />

      <IntroCameraRig design={design} />
      <ambientLight intensity={0.35} />
      <pointLight color="#7ffff1" intensity={1.1} distance={9} position={[1.1, 0.6, 1.8]} />
      <pointLight color="#68ff9a" intensity={0.35} distance={7} position={[-2.4, -0.2, 1.4]} />
      <Environment preset="night" />

      <ParticleField
        scroll={particleScroll}
        hovered={hovered || "core-signal"}
        selected={selected || "basilica"}
        design={introParticleDesign}
      />

      <IntroCrystalGrid scroll={scroll} design={design} />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={design.bloomIntensity * 0.85}
          luminanceThreshold={design.bloomThreshold}
          luminanceSmoothing={design.bloomSmoothing}
        />
        <Vignette offset={design.vignetteOffset} darkness={design.vignetteDarkness} />
      </EffectComposer>
    </>
  );
}

export default function App() {
  const scroll = useScrollProgress();
  const siteRef = useRef(null);

  const designMode = false;
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState("basilica");
  const [activatedNodes, setActivatedNodes] = useState(["basilica"]);
  const [mapPanelOpen, setMapPanelOpen] = useState(false);
  const [trails, setTrails] = useState([]);
  const [preloaderDone, setPreloaderDone] = useState(false);

  const lastTrail = useRef(0);

  const design = useControls({
    "00_SCROLL_TIMING": folder({
      introFadeStart: { value: 0.04, min: 0, max: 0.4, step: 0.005 },
      introFadeEnd: { value: 0.18, min: 0.02, max: 0.6, step: 0.005 },
      sceneRevealStart: { value: 0.18, min: 0, max: 0.6, step: 0.005 },
      sceneRevealEnd: { value: 0.36, min: 0.05, max: 0.8, step: 0.005 },
      networkStart: { value: 0.38, min: 0, max: 0.8, step: 0.005 },
      networkEnd: { value: 0.54, min: 0.1, max: 1, step: 0.005 },
      descendStart: { value: 0.56, min: 0.1, max: 1, step: 0.005 },
      descendEnd: { value: 0.68, min: 0.1, max: 1, step: 0.005 },
      chamberStart: { value: 0.68, min: 0.1, max: 1, step: 0.005 },
      chamberEnd: { value: 0.84, min: 0.1, max: 1, step: 0.005 },
      // Map timing is now earlier and smoother so the portal section does not create dead scroll.
      mapStart: { value: 0.86, min: 0.1, max: 1, step: 0.005 },
      mapEnd: { value: 0.955, min: 0.2, max: 1, step: 0.005 },
    }),

    "01_CAMERA": folder({
      cameraX: { value: 0, min: -4, max: 4, step: 0.01 },
      cameraY: { value: 0.05, min: -3, max: 3, step: 0.01 },
      cameraZ: { value: 6.35, min: 1, max: 12, step: 0.01 },
      introCameraZ: { value: 7.2, min: 1, max: 14, step: 0.01 },
      cameraFov: { value: 38, min: 20, max: 80, step: 1 },
      lookAtX: { value: 0, min: -4, max: 4, step: 0.01 },
      lookAtY: { value: -1.22, min: -4, max: 2, step: 0.01 },
      lookAtZ: { value: -0.55, min: -6, max: 4, step: 0.01 },
      cameraMouseX: { value: 0.12, min: 0, max: 0.6, step: 0.01 },
      cameraMouseY: { value: 0.05, min: 0, max: 0.4, step: 0.01 },
      networkCameraPull: { value: 0.45, min: 0, max: 2, step: 0.01 },
      mapCameraPush: { value: 0.9, min: 0, max: 3, step: 0.01 },
      descendCameraDrop: { value: 1.55, min: 0, max: 5, step: 0.01 },
      descendCameraPush: { value: 1.15, min: -3, max: 5, step: 0.01 },
      descendLookAtDrop: { value: 1.1, min: 0, max: 5, step: 0.01 },
      descendFovBoost: { value: 5, min: 0, max: 20, step: 0.1 },
      chamberCameraDrop: { value: 1.05, min: 0, max: 6, step: 0.01 },
      chamberCameraPush: { value: -0.55, min: -5, max: 5, step: 0.01 },
      chamberLookAtDrop: { value: 1.7, min: 0, max: 6, step: 0.01 },
      chamberFovTighten: { value: 5.5, min: 0, max: 20, step: 0.1 },
    }),

    "02_FIRST_SIGNAL": folder({
      introSignalX: { value: 0.35, min: -4, max: 4, step: 0.01 },
      introSignalY: { value: -0.16, min: -3, max: 3, step: 0.01 },
      introSignalZ: { value: 0.08, min: -5, max: 3, step: 0.01 },
      introSignalScale: { value: 1.24, min: 0.2, max: 3, step: 0.01 },
      introSignalColor: "#7ffff1",
      introSignalCoreColor: "#dffffb",
      introSignalGhostColor: "#4fb9b0",
      introSignalCoreSize: { value: 1.42, min: 0.2, max: 3.5, step: 0.01 },
      introSignalResponseSize: { value: 0.95, min: 0.2, max: 2.5, step: 0.01 },
      introSignalGhostSize: { value: 0.72, min: 0.1, max: 2, step: 0.01 },
      introSignalCoreIntensity: { value: 1.15, min: 0, max: 2.5, step: 0.01 },
      introSignalGhostOpacity: { value: 0.54, min: 0, max: 1, step: 0.01 },
      introSignalTrailOpacity: { value: 0.075, min: 0, max: 0.3, step: 0.005 },
      introSignalHoverPower: { value: 1.25, min: 0, max: 3, step: 0.01 },
      introSignalWaveSpeed: { value: 1.15, min: 0.1, max: 6, step: 0.01 },
      introSignalDrift: { value: 0.038, min: 0, max: 0.2, step: 0.001 },
      introSignalPullDown: { value: 0.035, min: 0, max: 2, step: 0.01 },
    }),

    "07_INTRO_PARTICLES": folder({
      particleColor: "#78fff0",
      particleSize: { value: 0.019, min: 0.001, max: 0.08, step: 0.001 },
      particleHoverSize: { value: 0.03, min: 0.001, max: 0.1, step: 0.001 },
      particleOpacity: { value: 0.145, min: 0, max: 1, step: 0.005 },
      particleHoverOpacity: { value: 0.255, min: 0, max: 1, step: 0.005 },
    }),

    "11_RAIN_DROPLETS": folder({
      rainOpacity: { value: 0.24, min: 0, max: 1, step: 0.01 },
      rainStreakCount: { value: 28, min: 0, max: 280, step: 1 },
      rainStreakSpeed: { value: 4.4, min: 0.8, max: 10, step: 0.1 },
      dropletCount: { value: 8, min: 0, max: 70, step: 1 },
      dropletMinSize: { value: 0.55, min: 0.1, max: 2, step: 0.01 },
      dropletMaxSize: { value: 1.35, min: 0.2, max: 4, step: 0.01 },
      dropletSpeed: { value: 8.5, min: 2, max: 24, step: 0.1 },
      dropletBlur: { value: 6, min: 0, max: 18, step: 0.5 },
      dropletTrailLength: { value: 180, min: 20, max: 500, step: 1 },
      dropletTrailOpacity: { value: 0.22, min: 0, max: 1, step: 0.01 },
    }),

    "STORY / TEXT + LOADING": folder({
      loadingEnabled: true,
      loadingMinDurationMs: { value: 3100, min: 600, max: 9000, step: 100 },
      loadingDetectedHoldMs: { value: 850, min: 120, max: 2600, step: 50 },
      loadingExitMs: { value: 900, min: 120, max: 2600, step: 50 },
      loadingAccent: "#9ffff3",
      loadingText: "#f4fffc",
      loadingBackground: "#020b0b",
      loadingLineOpacity: { value: 0.88, min: 0, max: 1, step: 0.01 },

      storyEnabled: true,
      storyX: { value: 4.2, min: 0, max: 30, step: 0.1 },
      storyY: { value: 34, min: 5, max: 80, step: 0.5 },
      storyMaxWidth: { value: 980, min: 360, max: 1400, step: 10 },
      storyOpacity: { value: 1, min: 0, max: 1, step: 0.01 },
      storyTitleSize: { value: 40, min: 30, max: 52, step: 1 },
      storyKickerSize: { value: 11, min: 7, max: 18, step: 1 },
      storyFadeSize: { value: 0.052, min: 0.008, max: 0.12, step: 0.002 },
      storyDrift: { value: 20, min: 0, max: 80, step: 1 },
      storyGlow: { value: 0.3, min: 0, max: 1.2, step: 0.01 },
      storyBlur: { value: 0.0, min: 0, max: 8, step: 0.1 },
      storyGlitch: { value: 0.06, min: 0, max: 1.2, step: 0.01 },
      storyHoverGlitch: { value: 0.2, min: 0, max: 2.4, step: 0.01 },
      storyAccent: "#9ffff3",
      storyColor: "#f4fffc",
      storyMutedColor: "rgba(244,255,252,0.36)",

      storyDescentStart: { value: 0.165, min: 0.02, max: 0.42, step: 0.005 },
      storyDescentEnd: { value: 0.205, min: 0.06, max: 0.55, step: 0.005 },
      storyReactionStart: { value: 0.235, min: 0.1, max: 0.6, step: 0.005 },
      storyReactionEnd: { value: 0.39, min: 0.16, max: 0.72, step: 0.005 },
      storyCoreStart: { value: 0.41, min: 0.22, max: 0.76, step: 0.005 },
      storyCoreEnd: { value: 0.565, min: 0.28, max: 0.84, step: 0.005 },
      storyPortalStart: { value: 0.59, min: 0.36, max: 0.9, step: 0.005 },
      storyPortalEnd: { value: 0.745, min: 0.44, max: 0.95, step: 0.005 },
      storyMapStart: { value: 0.85, min: 0.5, max: 0.99, step: 0.005 },
      storyMapEnd: { value: 0.95, min: 0.58, max: 1.0, step: 0.005 },
    }),

    "APP_FLOW": folder({
      // Total page height. Lower value = less empty wheel travel and faster cinematic movement.
      scrollHeightVh: { value: 760, min: 520, max: 1200, step: 10 },
      cisternEnterStart: { value: 0.115, min: 0.02, max: 0.5, step: 0.005 },
      cisternEnterEnd: { value: 0.205, min: 0.08, max: 0.65, step: 0.005 },
      // Camera motion starts as soon as the CisternSceneLab is visible.
      // Tighten this range if you still feel dead scroll.
      labMotionStart: { value: 0.205, min: 0.06, max: 0.75, step: 0.005 },
      labMotionEnd: { value: 0.59, min: 0.25, max: 0.92, step: 0.005 },
      portalStart: { value: 0.585, min: 0.3, max: 0.95, step: 0.005 },
      portalEnd: { value: 0.84, min: 0.4, max: 0.99, step: 0.005 },
      // Dedicated crossfade controls. These remove the half-map / half-cistern stuck frame.
      mapVisualStart: { value: 0.865, min: 0.5, max: 0.98, step: 0.005 },
      mapVisualEnd: { value: 0.915, min: 0.55, max: 1.0, step: 0.005 },
      cisternFadeLead: { value: 0.012, min: 0, max: 0.08, step: 0.002 },
      mapMountLead: { value: 0.018, min: 0, max: 0.08, step: 0.002 },
      progressSmoothing: { value: 0.38, min: 0, max: 1, step: 0.01 },
    }),

    "06_LIGHT_FOG_BLOOM": folder({
      background: "#020607",
      fogColor: "#020607",
      fogNear: { value: 5.1, min: 0.1, max: 15, step: 0.1 },
      fogFar: { value: 15.3, min: 1, max: 30, step: 0.1 },
      bloomIntensity: { value: 0.53, min: 0, max: 3, step: 0.01 },
      bloomThreshold: { value: 0.44, min: 0, max: 1, step: 0.01 },
      bloomSmoothing: { value: 0.76, min: 0, max: 1, step: 0.01 },
      vignetteOffset: { value: 0.18, min: 0, max: 1, step: 0.01 },
      vignetteDarkness: { value: 0.62, min: 0, max: 2, step: 0.01 },
    }),
  });

  useEffect(() => {
    window.__CRYSTAL_DESIGN__ = design;
  }, [design]);

  // Keep the real CisternSceneLab mounted/preloaded from the first frame.
  // This prevents column/cable/pedestal textures from popping in late when the user scrolls to the main scene.
  useEffect(() => {
    const preloadUrls = [
      "/model/hero_crystal.glb",
      "/model/portal_arch.glb",
      "/textures/columns/column_diffuse.jpg",
      "/textures/columns/column_normal.jpg",
      "/textures/pedestal/pedestal_diffuse.jpg",
      "/textures/pedestal/pedestal_normal.jpg",
      "/textures/rocks/rock_diffuse.jpg",
      "/textures/rocks/rock_normal.jpg",
      "/textures/cables/cable_diffuse.jpg",
      "/textures/cables/cable_normal.jpg",
    ];

    preloadUrls.forEach((url) => {
      if (/\.(jpg|jpeg|png|webp)$/i.test(url)) {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      }
    });
  }, []);



  function handleMouseMove(event) {
    if (siteRef.current) {
      siteRef.current.style.setProperty("--mx", `${(event.clientX / window.innerWidth) * 100}%`);
      siteRef.current.style.setProperty("--my", `${(event.clientY / window.innerHeight) * 100}%`);
    }

    const now = performance.now();
    if (now - lastTrail.current < 38) return;

    lastTrail.current = now;
    const id = now;

    setTrails((prev) => [...prev.slice(-16), { id, x: event.clientX, y: event.clientY }]);

    setTimeout(() => {
      setTrails((prev) => prev.filter((trail) => trail.id !== id));
    }, 1050);
  }

  useEffect(() => {
    if (scroll < design.mapStart - 0.04) {
      setMapPanelOpen(false);
    }
  }, [scroll, design.mapStart]);

  const activeStory = STORY_ACTS[getStoryIndex(scroll)];
  const current = getNode(selected);
  const fullNetwork = activatedNodes.length === CISTERNS.length;

  const introOpacity = 1 - smooth01(range(scroll, design.introFadeStart, design.introFadeEnd + 0.045));
  const mapVisualStart = design.mapVisualStart ?? design.mapStart;
  const mapVisualEnd = Math.max(mapVisualStart + 0.01, design.mapVisualEnd ?? design.mapEnd);
  const cisternFadeStart = Math.max(0, mapVisualStart - (design.cisternFadeLead ?? 0.012));
  const mapVisibilityProgress = smooth01(range(scroll, mapVisualStart, mapVisualEnd));
  const cisternMapFade = smooth01(range(scroll, cisternFadeStart, mapVisualEnd));
  const cisternOpacity = smooth01(range(scroll, design.cisternEnterStart, design.cisternEnterEnd)) *
    (1 - cisternMapFade);
  const labRawProgress = range(scroll, design.labMotionStart, design.labMotionEnd);
  const portalRawProgress = range(scroll, design.portalStart, design.portalEnd);
  const mapRawProgress = range(scroll, design.mapStart, design.mapEnd);
  // Avoid double-smoothing dead zones: keep progress mostly linear, with optional soft easing.
  const labScrollProgress = THREE.MathUtils.lerp(labRawProgress, smooth01(labRawProgress), design.progressSmoothing);
  const portalProgress = THREE.MathUtils.lerp(portalRawProgress, smooth01(portalRawProgress), design.progressSmoothing);
  const mapProgress = mapVisibilityProgress;
  // No fullscreen cyan wash: the portal must stay as a real object, not a blue screen overlay.
  const portalWashProgress = 0;
  const portalWashOpacity = 0;
  const shouldMountMap = scroll >= mapVisualStart - (design.mapMountLead ?? 0.018);
  const showIntroInterface = introOpacity > 0.04 && scroll < design.introFadeEnd + 0.03 && cisternOpacity < 0.18 && mapProgress < 0.02;
  const shouldRenderStory = preloaderDone && scroll >= design.storyReactionStart - 0.035 && introOpacity < 0.14;

  // HARD POINTER OWNERSHIP
  // Intro canvas is completely unmounted once CisternSceneLab starts becoming visible.
  // This prevents the intro canvas / App overlays from stealing R3F raycaster events.
  const shouldRenderIntro = introOpacity > 0.012 && cisternOpacity < 0.08 && mapProgress < 0.02;
  const introInteractive = shouldRenderIntro;
  const cisternInteractive = mapProgress < 0.72;
  const mapInteractive = mapProgress > 0.88;

  return (
    <main
      ref={siteRef}
      className={`site storySite act-${activeStory.slug} ${fullNetwork ? "networkComplete" : ""}`}
      onMouseMove={showIntroInterface ? handleMouseMove : undefined}
      style={{ minHeight: `${design.scrollHeightVh}vh`, pointerEvents: "auto" }}
    >

      {!preloaderDone && (
        <CinematicPreloader
          design={design}
          onDone={() => {
            window.scrollTo(0, 0);
            setPreloaderDone(true);
          }}
        />
      )}

      <PresentationAudioButton />

      <section className="viewport" style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "auto" }}>
        {shouldRenderIntro && (
          <div
            className="introSceneLayer"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 6,
              opacity: introOpacity,
              pointerEvents: introInteractive ? "auto" : "none",
              transition: "opacity 70ms linear",
            }}
          >
            <Canvas
              camera={{ position: [0, design.cameraY, design.introCameraZ], fov: design.cameraFov }}
              dpr={[1, 1.15]}
              gl={{ antialias: false, stencil: false, alpha: false, powerPreference: "high-performance" }}
              performance={{ min: 0.65 }}
            >
              <IntroOnlyScene scroll={scroll} design={design} hovered={hovered} selected={selected} />
            </Canvas>
          </div>
        )}

        <div
          className="cisternSceneHost cisternPointerOwner"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            opacity: cisternOpacity,
            pointerEvents: cisternInteractive ? "auto" : "none",
            touchAction: "none",
            transition: "opacity 140ms linear",
          }}
        >
          <CisternSceneLab
            scrollProgress={labScrollProgress}
            visibleProgress={1}
            portalProgress={portalProgress}
            mapProgress={mapProgress}
            designMode={false}
            showStory={true}
            showLabel={false}
            showLeva={false}
          />
        </div>

        <div
          className="portalTransitionWash"
          style={{
            opacity: portalWashOpacity,
            pointerEvents: "none",
          }}
        />

        {shouldMountMap && (
          <div
            className={`mapRevealLayer ${mapProgress > 0.05 ? "visible" : ""}`}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 12,
              opacity: mapProgress,
              pointerEvents: mapInteractive ? "auto" : "none",
              transition: "opacity 70ms linear",
              background: "#020607",
            }}
          >
            <MapLibreCrystalMap
              visible={true}
              selected={selected}
              setSelected={setSelected}
              activatedNodes={activatedNodes}
              setActivatedNodes={setActivatedNodes}
            />
          </div>
        )}

        <RainGlassLayer scroll={scroll} design={design} />

        <div className="mouseTrail" style={{ zIndex: 30, pointerEvents: "none" }}>
          {trails.map((trail) => (
            <span key={trail.id} style={{ left: trail.x, top: trail.y }} />
          ))}
        </div>

        <div className="noise" style={{ pointerEvents: "none", opacity: introOpacity * 0.045, zIndex: 6 }} />
        <div className="shade" style={{ pointerEvents: "none", opacity: showIntroInterface ? introOpacity : 0, zIndex: 6 }} />

        {showIntroInterface && <IntroMinimalInterface introOpacity={introOpacity} />}

        {shouldRenderStory && <CinematicStoryLayer scroll={scroll} design={design} />}
      </section>

      <section className="scroll-space storyScrollSpace" aria-hidden="true" style={{ height: `${design.scrollHeightVh}vh` }}>
        {STORY_ACTS.map((act) => (
          <div key={act.id} className="storySnapPoint" style={{ height: "100vh" }} />
        ))}
      </section>
    </main>
  );
}

useGLTF.preload("/model/cistern_environment.glb");
useGLTF.preload("/model/ground.glb");
useGLTF.preload("/model/hero_crystal.glb");
useGLTF.preload("/model/node_crystal.glb");
