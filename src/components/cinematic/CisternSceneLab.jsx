import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  Sparkles,
  useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Effect, BlendFunction } from "postprocessing";
import { Leva, useControls, folder } from "leva";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import CustomReflectiveGPGPUWater from "./CustomReflectiveGPGPUWater";

const MODEL_BASE = "/model";
const PORTAL_ARCH_PATH = `${MODEL_BASE}/portal_arch.glb`;
const COLUMN_Y_OFFSET = -0.22;

// FINAL REVISION: tuned halo, hitbox, camera particle pass, portal transition and analyze hint timing.
// V77 BALANCED QUALITY: visual quality restored without pushing DPR too high.

const TEXTURE_PATHS = {
  columns: {
    diffuse: "/textures/columns/column_diffuse.jpg",
    normal: "/textures/columns/column_normal.jpg",
  },
  pedestal: {
    diffuse: "/textures/pedestal/pedestal_diffuse.jpg",
    normal: "/textures/pedestal/pedestal_normal.jpg",
  },
  rocks: {
    diffuse: "/textures/rocks/rock_diffuse.jpg",
    normal: "/textures/rocks/rock_normal.jpg",
  },
  cables: {
    diffuse: "/textures/cables/cable_diffuse.jpg",
    normal: "/textures/cables/cable_normal.jpg",
  },
};

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function range01(value, start, end) {
  if (Math.abs(end - start) < 0.00001) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
}

function smooth01(value) {
  const v = clamp01(value);
  return v * v * (3.0 - 2.0 * v);
}

function smoother01(value) {
  return smooth01(smooth01(value));
}


function portalPhases(scrollProgress = 0, portalProgress = 0) {
  const s = clamp01(scrollProgress);
  const p = clamp01(portalProgress);

  return {
    // Camera first reads the cistern, then moves through the crystal/particle column.
    particleApproach: smooth01(range01(s, 0.02, 0.28)),
    particlePass: smooth01(range01(s, 0.24, 0.52)),

    // Fog starts after the camera has passed the crystal/particle column.
    fogEnter: smooth01(range01(s, 0.48, 0.72)),
    // Portal appears late inside the fog, not during the crystal stage.
    portalReveal: smooth01(range01(p, 0.10, 0.46)),
    portalEnter: smooth01(range01(p, 0.52, 1.0)),
  };
}

const CRYSTAL_MODES = [
  {
    id: "basilica",
    number: "01",
    modelPath: `${MODEL_BASE}/hero_crystal.glb`,
    label: "BASILICA CISTERN",
    role: "ORIGIN CORE",
    tag: "ENERGY / REVEALED",
    color: "#ffb24a",
    emissive: "#ffd58a",
    particleA: "#ffe0a3",
    particleB: "#7fffee",
    particleC: "#ff8d3a",
    title: "The first reaction becomes light.",
    body:
      "After the drought of 2556, the Basilica Cistern becomes the first active core. Mineral pressure and residual humidity form a crystal that converts the underground reaction into electrical light.",
  },
  {
    id: "binbirdirek",
    number: "02",
    modelPath: `${MODEL_BASE}/crystal_01.glb`,
    label: "BINBIRDIREK CISTERN",
    role: "CONNECTIVE NETWORK",
    tag: "FILAMENTS / DISTRIBUTION",
    color: "#63fff0",
    emissive: "#63fff0",
    particleA: "#63fff0",
    particleB: "#dffffa",
    particleC: "#68ff9a",
    title: "The signal begins to travel.",
    body:
      "Binbirdirek acts as the distribution core. It routes crystal energy through hidden passages, turning separate cistern chambers into one connected power network.",
  },
  {
    id: "gulhane",
    number: "03",
    modelPath: `${MODEL_BASE}/crystal_02.glb`,
    label: "GÜLHANE CISTERN",
    role: "STABILIZATION LAYER",
    tag: "DIFFUSION / BALANCE",
    color: "#68ff9a",
    emissive: "#9dffb7",
    particleA: "#68ff9a",
    particleB: "#dfffe8",
    particleC: "#7cff68",
    title: "The unstable current is balanced.",
    body:
      "Gülhane stabilizes the new energy flow. It softens pressure spikes, diffuses excess charge and keeps the crystalline network from collapsing under its own output.",
  },
  {
    id: "serefiye",
    number: "04",
    modelPath: `${MODEL_BASE}/crystal_03.glb`,
    label: "ŞEREFİYE CISTERN",
    role: "STORAGE CORE",
    tag: "ACCUMULATION / RESERVE",
    color: "#b277ff",
    emissive: "#c49aff",
    particleA: "#b277ff",
    particleB: "#f2e2ff",
    particleC: "#7fffee",
    title: "Energy is stored before release.",
    body:
      "Şerefiye works as a charged reserve. Dense crystal formations hold the generated electricity in an active state until the city network is ready to receive it.",
  },
  {
    id: "fildami",
    number: "05",
    modelPath: `${MODEL_BASE}/crystal_04.glb`,
    label: "FİLDAMI CISTERN",
    role: "RELEASE CORE",
    tag: "SURFACE / INTEGRATION",
    color: "#fff1c7",
    emissive: "#fff1c7",
    particleA: "#4aa8ff",
    particleB: "#d7f7ff",
    particleC: "#7fffee",
    title: "The city receives the underground light.",
    body:
      "Fildamı is the release core. It transfers stored crystal energy from the underground system toward the urban surface, completing the city-scale power route.",
  },
];

/* -------------------------------------------------------------------------- */
/*                            SAFE TEXTURE LOADING                            */
/* -------------------------------------------------------------------------- */

function useOptionalTexturePair(paths) {
  const [textures, setTextures] = useState({
    map: null,
    normalMap: null,
  });

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    const setupTexture = (texture, isColor) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      texture.colorSpace = isColor
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace;
      texture.needsUpdate = true;
      return texture;
    };

    const loadTexture = (url, isColor = false) => {
      return new Promise((resolve) => {
        if (!url) {
          resolve(null);
          return;
        }

        loader.load(
          url,
          (texture) => resolve(setupTexture(texture, isColor)),
          undefined,
          () => {
            console.warn(`[Texture] Could not load: ${url}`);
            resolve(null);
          }
        );
      });
    };

    Promise.all([
      loadTexture(paths.diffuse, true),
      loadTexture(paths.normal, false),
    ]).then(([map, normalMap]) => {
      if (cancelled) return;

      setTextures({
        map,
        normalMap,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [paths.diffuse, paths.normal]);

  return textures;
}

function cloneTextureForMaterial(texture, repeatX, repeatY, isColor) {
  if (!texture) return null;

  const cloned = texture.clone();

  cloned.wrapS = THREE.RepeatWrapping;
  cloned.wrapT = THREE.RepeatWrapping;
  cloned.repeat.set(repeatX, repeatY);
  cloned.anisotropy = 8;
  cloned.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  cloned.needsUpdate = true;

  return cloned;
}

function useTexturedMaterial(
  textureSet,
  {
    repeatX = 1,
    repeatY = 1,
    color = "#ffffff",
    normal = 1,
    roughness = 0.95,
    metalness = 0.02,
    envMapIntensity = 0.25,
    flatShading = false,
  } = {}
) {
  const material = useMemo(() => {
    const map = cloneTextureForMaterial(textureSet.map, repeatX, repeatY, true);
    const normalMap = cloneTextureForMaterial(
      textureSet.normalMap,
      repeatX,
      repeatY,
      false
    );

    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(normal, normal),
      color: new THREE.Color(color),
      roughness,
      metalness,
      envMapIntensity,
      flatShading,
    });
  }, [
    textureSet.map,
    textureSet.normalMap,
    repeatX,
    repeatY,
    color,
    normal,
    roughness,
    metalness,
    envMapIntensity,
    flatShading,
  ]);

  useEffect(() => {
    return () => {
      material.map?.dispose?.();
      material.normalMap?.dispose?.();
      material.dispose();
    };
  }, [material]);

  return material;
}

/* -------------------------------------------------------------------------- */
/*                           BOX PROJECTED UV FOR ROCKS                       */
/* -------------------------------------------------------------------------- */

function applyBoxProjectedUV(geometry, scale = 1) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();

  geo.computeVertexNormals();

  const position = geo.attributes.position;
  const normal = geo.attributes.normal;
  const uvs = [];

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);

    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    let u;
    let v;

    if (nx >= ny && nx >= nz) {
      u = z * scale;
      v = y * scale;
    } else if (ny >= nx && ny >= nz) {
      u = x * scale;
      v = z * scale;
    } else {
      u = x * scale;
      v = y * scale;
    }

    uvs.push(u + 0.5, v + 0.5);
  }

  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  return geo;
}

function useRockGeometry() {
  return useMemo(() => {
    return applyBoxProjectedUV(new THREE.DodecahedronGeometry(1, 0), 0.85);
  }, []);
}

/* -------------------------------------------------------------------------- */
/*                                  STORY UI                                  */
/* -------------------------------------------------------------------------- */

function StoryOverlay({ activeMode = CRYSTAL_MODES[0], modePulseKey = 0, onAnalyze }) {
  return (
    <div
      key={`${activeMode.id}-${modePulseKey}`}
      style={{
        position: "absolute",
        left: 24,
        bottom: 24,
        zIndex: 20,
        width: 420,
        pointerEvents: "auto",
        padding: "18px 20px",
        borderRadius: 18,
        border: `1px solid ${activeMode.color}44`,
        background:
          "linear-gradient(135deg, rgba(2,10,10,0.82), rgba(4,22,24,0.44))",
        backdropFilter: "blur(16px)",
        boxShadow: `0 22px 80px rgba(0,0,0,0.48), 0 0 36px ${activeMode.color}22`,
        color: "#dffffb",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        animation: "crystalStoryIn 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <style>{`
        @keyframes crystalStoryIn {
          from { opacity: 0; transform: translateY(14px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: activeMode.color,
          }}
        >
          {activeMode.number} / {activeMode.role}
        </div>

        <button
          type="button"
          style={{
            padding: "5px 8px",
            borderRadius: 999,
            border: `1px solid ${activeMode.color}55`,
            color: "rgba(243,255,252,0.9)",
            background: "rgba(2,18,20,0.28)",
            fontSize: 8,
            letterSpacing: "0.18em",
            fontFamily: "inherit",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onAnalyze?.();
          }}
        >
          CLICK TO ANALYZE
        </button>
      </div>

      <div
        style={{
          fontSize: 13,
          letterSpacing: "0.16em",
          color: "rgba(223,255,251,0.66)",
          marginBottom: 8,
        }}
      >
        {activeMode.label}
      </div>

      <div
        style={{
          fontSize: 24,
          lineHeight: 1.08,
          fontWeight: 700,
          marginBottom: 10,
          color: "rgba(245,255,252,0.96)",
        }}
      >
        {activeMode.title}
      </div>

      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.6,
          color: "rgba(223,255,251,0.82)",
        }}
      >
        {activeMode.body}
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(180,255,246,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "rgba(200,255,248,0.52)",
          }}
        >
          {activeMode.tag}
        </span>

        <div style={{ display: "flex", gap: 6 }}>
          {CRYSTAL_MODES.map((mode) => (
            <i
              key={mode.id}
              style={{
                width: mode.id === activeMode.id ? 22 : 7,
                height: 7,
                borderRadius: 999,
                background:
                  mode.id === activeMode.id
                    ? mode.color
                    : "rgba(220,255,250,0.22)",
                boxShadow:
                  mode.id === activeMode.id ? `0 0 14px ${mode.color}` : "none",
                transition: "220ms ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  SETTINGS                                  */
/* -------------------------------------------------------------------------- */

function RendererSettings({ exposure }) {
  const { gl } = useThree();

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);

  return null;
}

function SceneWarmup({ enabled = true }) {
  const { gl, scene, camera } = useThree();
  const warmedRef = useRef(false);

  useEffect(() => {
    if (!enabled || warmedRef.current) return;
    warmedRef.current = true;

    const oldPosition = camera.position.clone();
    const oldRotation = camera.rotation.clone();
    const state = [];

    scene.traverse((object) => {
      state.push({ object, visible: object.visible, frustumCulled: object.frustumCulled });
      const name = (object.name || "").toLowerCase();
      const skip = name.includes("hitbox") || name.includes("hover") || name.includes("helper");

      if (!skip && (object.isMesh || object.isLight || object.material)) {
        object.visible = true;
        object.frustumCulled = false;
      }
    });

    camera.position.set(0, 8, 28);
    camera.lookAt(0, 0.4, -6);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    requestAnimationFrame(() => {
      try {
        gl.render(scene, camera);
      } catch (error) {
        console.warn("[CisternSceneLab] Warmup render failed:", error);
      }

      camera.position.copy(oldPosition);
      camera.rotation.copy(oldRotation);
      state.forEach(({ object, visible, frustumCulled }) => {
        object.visible = visible;
        object.frustumCulled = frustumCulled;
      });
    });
  }, [enabled, gl, scene, camera]);

  return null;
}


function CinematicCamera({ enabled, scrollProgress = 0, portalProgress = 0 }) {
  const { camera, pointer } = useThree();
  const smoothLookRef = useRef(new THREE.Vector3(0, 0.62, -5.75));

  const cameraPath = useControls('CISTERN CAMERA / SCROLL PATH', {
    // Initial view: pulled closer so the cistern scene starts with less empty distance.
    idleX: { value: -0.22, min: -2.5, max: 2.5, step: 0.01 },
    idleY: { value: 0.86, min: 0.1, max: 2.4, step: 0.01 },
    idleZ: { value: 3.78, min: 1.2, max: 6.5, step: 0.01 },
    idleFov: { value: 42, min: 24, max: 70, step: 0.1 },

    // Scroll phase ranges inside scrollProgress. Tighten these to remove dead scroll.
    approachStart: { value: 0.00, min: 0, max: 0.8, step: 0.005 },
    approachEnd: { value: 0.18, min: 0.02, max: 0.9, step: 0.005 },
    passStart: { value: 0.17, min: 0, max: 0.9, step: 0.005 },
    passEnd: { value: 0.44, min: 0.02, max: 1, step: 0.005 },
    fogStart: { value: 0.36, min: 0, max: 0.95, step: 0.005 },
    fogEnd: { value: 0.58, min: 0.05, max: 1, step: 0.005 },

    nearCrystalZ: { value: 1.72, min: 0.5, max: 4.5, step: 0.01 },
    particlePassY: { value: 1.08, min: 0.2, max: 2.4, step: 0.01 },
    particlePassZ: { value: -1.42, min: -4, max: 1, step: 0.01 },
    fogTunnelY: { value: 1.16, min: 0.2, max: 2.8, step: 0.01 },
    fogTunnelZ: { value: -4.45, min: -8, max: -1, step: 0.01 },

    // Portal camera phases are based on portalProgress.
    portalRevealStart: { value: 0.06, min: 0, max: 0.9, step: 0.005 },
    portalRevealEnd: { value: 0.34, min: 0.02, max: 1, step: 0.005 },
    portalEnterStart: { value: 0.34, min: 0, max: 0.95, step: 0.005 },
    portalEnterEnd: { value: 1.0, min: 0.05, max: 1, step: 0.005 },
    portalFrontY: { value: 1.28, min: 0.2, max: 3.2, step: 0.01 },
    portalFrontZ: { value: -6.72, min: -10, max: -3, step: 0.01 },
    portalInsideY: { value: 1.28, min: 0.2, max: 3.2, step: 0.01 },
    portalInsideZ: { value: -8.82, min: -12, max: -4, step: 0.01 },
    lookStartY: { value: 0.62, min: -1, max: 2.5, step: 0.01 },
    lookStartZ: { value: -5.75, min: -10, max: 1, step: 0.01 },
    lookFogY: { value: 1.04, min: 0.1, max: 3, step: 0.01 },
    lookFogZ: { value: -7.35, min: -12, max: -2, step: 0.01 },
    lookPortalY: { value: 1.32, min: 0.2, max: 3.2, step: 0.01 },
    lookPortalZ: { value: -9.45, min: -13, max: -4, step: 0.01 },

    // Smooth focus shift: avoids the hard snap from crystal focus to particle focus.
    focusShiftStart: { value: 0.20, min: 0, max: 0.8, step: 0.005 },
    focusShiftEnd: { value: 0.48, min: 0.02, max: 0.9, step: 0.005 },
    particleLookY: { value: 1.04, min: 0.1, max: 3.0, step: 0.01 },
    particleLookZ: { value: -5.92, min: -10, max: 0, step: 0.01 },
    lookFollow: { value: 0.074, min: 0.01, max: 0.22, step: 0.002 },

    followBase: { value: 0.075, min: 0.02, max: 0.18, step: 0.002 },
    enterFollow: { value: 0.178, min: 0.02, max: 0.22, step: 0.002 },
    fovFogBoost: { value: 1.8, min: 0, max: 12, step: 0.1 },
    fovPortalBoost: { value: 2.2, min: 0, max: 12, step: 0.1 },
    enterFovBoost: { value: 5.2, min: 0, max: 12, step: 0.1 },
  });

  useFrame((state) => {
    if (!enabled) return;

    const t = state.clock.elapsedTime;
    const s = clamp01(scrollProgress);
    const p = clamp01(portalProgress);
    // Camera phases are now fully controllable in Design Mode.
    // This fixes "dead scroll" by letting the motion begin immediately after the scene fade-in.
    const particleApproach = smoother01(range01(s, cameraPath.approachStart, cameraPath.approachEnd));
    const particlePass = smoother01(range01(s, cameraPath.passStart, cameraPath.passEnd));
    const fogEnter = smoother01(range01(s, cameraPath.fogStart, cameraPath.fogEnd));
    const portalReveal = smoother01(range01(p, cameraPath.portalRevealStart, cameraPath.portalRevealEnd));
    const portalEnter = smoother01(range01(p, cameraPath.portalEnterStart, cameraPath.portalEnterEnd));
    const focusShift = smoother01(range01(s, cameraPath.focusShiftStart, cameraPath.focusShiftEnd));

    // FINAL CAMERA PATH
    // 1) wide cistern
    // 2) approach crystal
    // 3) pass through particles
    // 4) crystal is now behind the camera
    // 5) reveal the portal as a real object
    // 6) enter the blue center by moving the camera, not by scaling the portal to fullscreen
    const idle = new THREE.Vector3(cameraPath.idleX, cameraPath.idleY, cameraPath.idleZ);
    const nearCrystal = new THREE.Vector3(-0.06, 0.84, cameraPath.nearCrystalZ);
    const throughParticles = new THREE.Vector3(0.0, cameraPath.particlePassY, cameraPath.particlePassZ);
    const fogTunnel = new THREE.Vector3(0.0, cameraPath.fogTunnelY, cameraPath.fogTunnelZ);
    const portalFront = new THREE.Vector3(0.0, cameraPath.portalFrontY, cameraPath.portalFrontZ);
    // Do NOT push the camera all the way into the disk inside the R3F scene.
    // The final "entry" is completed by the map fade. If this goes past -7,
    // the portal fills the whole screen and looks like a cyan wall.
    const portalInside = new THREE.Vector3(0.0, cameraPath.portalInsideY, cameraPath.portalInsideZ);

    const target = idle.clone();
    target.lerp(nearCrystal, particleApproach);
    target.lerp(throughParticles, particlePass);
    target.lerp(fogTunnel, fogEnter);
    target.lerp(portalFront, portalReveal);
    target.lerp(portalInside, portalEnter);

    const mouseDamping = 1.0 - portalEnter * 0.96;
    target.x += Math.sin(t * 0.14) * 0.026 * mouseDamping + pointer.x * 0.024 * mouseDamping;
    target.y += Math.sin(t * 0.11) * 0.009 * mouseDamping + pointer.y * 0.012 * mouseDamping;
    target.z += Math.sin(t * 0.09) * 0.015 * mouseDamping;

    const follow = THREE.MathUtils.lerp(cameraPath.followBase, cameraPath.enterFollow, portalEnter);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, target.x, follow);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, target.y, follow);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, target.z, follow);

    // Keep FOV controlled. The portal grows because the camera moves into it, not because it becomes a blue overlay.
    const fovTarget = cameraPath.idleFov + fogEnter * cameraPath.fovFogBoost + portalReveal * cameraPath.fovPortalBoost + portalEnter * cameraPath.enterFovBoost;
    camera.fov = THREE.MathUtils.lerp(camera.fov, fovTarget, 0.058);
    camera.updateProjectionMatrix();

    const look = new THREE.Vector3(0, cameraPath.lookStartY, cameraPath.lookStartZ);
    look.lerp(new THREE.Vector3(0, cameraPath.particleLookY, cameraPath.particleLookZ), focusShift);
    look.lerp(new THREE.Vector3(0, cameraPath.lookFogY, cameraPath.lookFogZ), fogEnter);
    look.lerp(new THREE.Vector3(0, cameraPath.lookPortalY, cameraPath.lookPortalZ), portalReveal);
    look.lerp(new THREE.Vector3(0, cameraPath.lookPortalY, cameraPath.lookPortalZ - 0.85), portalEnter);

    // Smooth the look target separately from camera position. This removes the harsh focus jump.
    smoothLookRef.current.lerp(look, cameraPath.lookFollow);
    camera.lookAt(smoothLookRef.current);
  });

  return null;
}

/* -------------------------------------------------------------------------- */
/*                                  CRYSTAL                                   */
/* -------------------------------------------------------------------------- */


function CrystalShapeCluster({
  activeMode = CRYSTAL_MODES[0],
  visible = false,
  shardCount = 0,
  shardScale = 1,
  shardOpacity = 0.78,
  shardRadius = 1,
  shardHeight = 1,
  shardSpinSpeed = 1,
}) {
  const group = useRef();
  const id = activeMode?.id || "basilica";
  const modeColor = activeMode?.color || "#63fff0";
  const modeEmissive = activeMode?.emissive || modeColor;

  const shards = useMemo(() => {
    const seedBase = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (n) => {
      const v = Math.sin((seedBase + n) * 91.137) * 43758.5453;
      return v - Math.floor(v);
    };

    const count = Math.max(0, Math.floor(Number(shardCount || 0)));

    return Array.from({ length: count }, (_, index) => {
      const a = (index / count) * Math.PI * 2 + (random(index + 1) - 0.5) * 0.45;
      const radius = (0.18 + random(index + 3) * 0.36) * shardRadius;
      const tall = id === "serefiye" ? 1.35 : id === "gulhane" ? 0.72 : 1;
      return {
        position: [
          Math.cos(a) * radius,
          (0.04 + random(index + 4) * 0.46) * shardHeight,
          Math.sin(a) * radius,
        ],
        scale: [
          0.035 + random(index + 5) * 0.075,
          (0.12 + random(index + 6) * 0.24) * tall * shardHeight,
          0.035 + random(index + 7) * 0.075,
        ],
        rotation: [
          (random(index + 8) - 0.5) * 0.8,
          a + random(index + 9),
          (random(index + 10) - 0.5) * 0.75,
        ],
      };
    });
  }, [id, shardCount, shardRadius, shardHeight]);

  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(modeColor),
      emissive: new THREE.Color(modeEmissive),
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.02,
      transmission: 0.08,
      thickness: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      transparent: true,
      opacity: shardOpacity,
      envMapIntensity: 0.85,
      flatShading: true,
    });
  }, [modeColor, modeEmissive, shardOpacity]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.045;
    group.current.children.forEach((child, index) => {
      child.rotation.y += (0.0015 + index * 0.00008) * shardSpinSpeed;
    });
  });

  if (!visible) return null;

  return (
    <group ref={group} scale={shardScale}>
      {shards.map((shard, index) => (
        <mesh
          key={`${id}-shape-shard-${index}`}
          position={shard.position}
          rotation={shard.rotation}
          scale={shard.scale}
          material={material}
          castShadow={false}
          receiveShadow={false}
        >
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}


// Preload all crystal models so changing the crystal does not suspend the Canvas.
// This removes the short black flashes that can happen while GLB assets are fetched.
CRYSTAL_MODES.forEach((mode) => {
  if (mode?.modelPath) useGLTF.preload(mode.modelPath);
});
useGLTF.preload(`${MODEL_BASE}/hero_crystal.glb`);
useGLTF.preload(PORTAL_ARCH_PATH);

function CrystalCore({ activeMode = CRYSTAL_MODES[0], onModeChange }) {
  const group = useRef();
  const coreLight = useRef();
  const bottomLight = useRef();
  const auraRef = useRef();
  const auraRingRef = useRef();
  const pulseRef = useRef(0);
  const crystalPointerDownRef = useRef(null);

  const modelPath = activeMode?.modelPath || `${MODEL_BASE}/hero_crystal.glb`;
  const { scene } = useGLTF(modelPath);
  const { scene: heroReferenceScene } = useGLTF(`${MODEL_BASE}/hero_crystal.glb`);

  const {
    crystalEmissive,
    crystalLight,
    crystalBottomLight,
    crystalVioletLight,
    crystalScale,
    crystalY,
    crystalTransmission,
    crystalRoughness,
    crystalThickness,
    crystalIOR,
    crystalOpacity,
    auraEnabled,
    auraOpacity,
    auraRadius,
    auraPulseOpacity,
    auraPulseScale,
    auraDepthTest,
    auraRingEnabled,
    auraRingOpacity,
    auraRingInner,
    auraRingOuter,
    auraRingPulseOpacity,
    auraRingSpinSpeed,
    crystalChangePulseScale,
    crystalChangePulseLight,
    modelAutoRecolor,
    modelMaterialGlow,
    autoFitModels,
    heroReferenceMultiplier,
    centerModelOnPedestal,
    showProceduralShards,
    proceduralShardCount,
    proceduralShardScale,
    proceduralShardOpacity,
    proceduralShardRadius,
    proceduralShardHeight,
    proceduralShardSpinSpeed,
    lightPulse,
  } = useControls("Crystal", {
    crystalEmissive: { value: 1.85, min: 0, max: 6, step: 0.05 },
    crystalLight: { value: 8.2, min: 0, max: 20, step: 0.1 },
    crystalBottomLight: { value: 3.2, min: 0, max: 14, step: 0.1 },
    crystalVioletLight: { value: 0.85, min: 0, max: 8, step: 0.05 },

    crystalScale: { value: 1.22, min: 0.3, max: 3, step: 0.01 },
    crystalY: { value: -0.05, min: -0.4, max: 0.4, step: 0.005 },

    crystalTransmission: { value: 0.08, min: 0, max: 0.6, step: 0.01 },
    crystalRoughness: { value: 0.48, min: 0, max: 0.9, step: 0.005 },
    crystalThickness: { value: 6.2, min: 0, max: 10, step: 0.05 },
    crystalIOR: { value: 1.44, min: 1, max: 2.3, step: 0.01 },
    crystalOpacity: { value: 1.0, min: 0.72, max: 1, step: 0.01 },

    auraEnabled: true,
    auraOpacity: { value: 0.010, min: 0, max: 0.22, step: 0.002 },
    auraRadius: { value: 0.44, min: 0.15, max: 2.2, step: 0.01 },
    auraPulseOpacity: { value: 0.002, min: 0, max: 0.16, step: 0.002 },
    auraPulseScale: { value: 0.003, min: 0, max: 0.28, step: 0.002 },
    auraDepthTest: true,
    auraRingEnabled: true,
    auraRingOpacity: { value: 0.004, min: 0, max: 0.18, step: 0.002 },
    auraRingInner: { value: 0.31, min: 0.05, max: 2.0, step: 0.01 },
    auraRingOuter: { value: 0.49, min: 0.06, max: 2.6, step: 0.01 },
    auraRingPulseOpacity: { value: 0.0015, min: 0, max: 0.14, step: 0.002 },
    auraRingSpinSpeed: { value: 0.18, min: 0, max: 2.0, step: 0.01 },
    crystalChangePulseScale: { value: 0.004, min: 0, max: 0.16, step: 0.002 },
    crystalChangePulseLight: { value: 0.26, min: 0, max: 5, step: 0.05 },

    modelAutoRecolor: false,
    modelMaterialGlow: { value: 0.05, min: 0, max: 2.5, step: 0.01 },

    autoFitModels: true,
    heroReferenceMultiplier: { value: 1.0, min: 0.1, max: 4.0, step: 0.01 },
    centerModelOnPedestal: true,

    showProceduralShards: false,
    proceduralShardCount: { value: 0, min: 0, max: 24, step: 1 },
    proceduralShardScale: { value: 1.0, min: 0.05, max: 4, step: 0.01 },
    proceduralShardOpacity: { value: 0.48, min: 0, max: 1, step: 0.01 },
    proceduralShardRadius: { value: 1.0, min: 0.1, max: 4, step: 0.01 },
    proceduralShardHeight: { value: 1.0, min: 0.1, max: 4, step: 0.01 },
    proceduralShardSpinSpeed: { value: 1.0, min: 0, max: 5, step: 0.01 },

    lightPulse: true,
  });

  const modelFitControls = useControls("Crystal Model Fit / Per Cistern", {
    "01 Basilica": folder({
      basilicaScale: { value: 1.0, min: 0.02, max: 8, step: 0.01 },
      basilicaX: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      basilicaY: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      basilicaZ: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      basilicaRotX: { value: 0, min: -180, max: 180, step: 1 },
      basilicaRotY: { value: 0, min: -180, max: 180, step: 1 },
      basilicaRotZ: { value: 0, min: -180, max: 180, step: 1 },
      basilicaHitbox: { value: 0.62, min: 0.05, max: 4, step: 0.01 },
    }),
    "02 Binbirdirek": folder({
      binbirdirekScale: { value: 1.0, min: 0.02, max: 8, step: 0.01 },
      binbirdirekX: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      binbirdirekY: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      binbirdirekZ: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      binbirdirekRotX: { value: 0, min: -180, max: 180, step: 1 },
      binbirdirekRotY: { value: 0, min: -180, max: 180, step: 1 },
      binbirdirekRotZ: { value: 0, min: -180, max: 180, step: 1 },
      binbirdirekHitbox: { value: 0.62, min: 0.05, max: 4, step: 0.01 },
    }),
    "03 Gülhane": folder({
      gulhaneScale: { value: 1.0, min: 0.02, max: 8, step: 0.01 },
      gulhaneX: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      gulhaneY: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      gulhaneZ: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      gulhaneRotX: { value: 0, min: -180, max: 180, step: 1 },
      gulhaneRotY: { value: 0, min: -180, max: 180, step: 1 },
      gulhaneRotZ: { value: 0, min: -180, max: 180, step: 1 },
      gulhaneHitbox: { value: 0.62, min: 0.05, max: 4, step: 0.01 },
    }),
    "04 Şerefiye": folder({
      serefiyeScale: { value: 1.0, min: 0.02, max: 8, step: 0.01 },
      serefiyeX: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      serefiyeY: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      serefiyeZ: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      serefiyeRotX: { value: 0, min: -180, max: 180, step: 1 },
      serefiyeRotY: { value: 0, min: -180, max: 180, step: 1 },
      serefiyeRotZ: { value: 0, min: -180, max: 180, step: 1 },
      serefiyeHitbox: { value: 0.62, min: 0.05, max: 4, step: 0.01 },
    }),
    "05 Fildamı": folder({
      fildamiScale: { value: 1.0, min: 0.02, max: 8, step: 0.01 },
      fildamiX: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      fildamiY: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      fildamiZ: { value: 0, min: -2.5, max: 2.5, step: 0.01 },
      fildamiRotX: { value: 0, min: -180, max: 180, step: 1 },
      fildamiRotY: { value: 0, min: -180, max: 180, step: 1 },
      fildamiRotZ: { value: 0, min: -180, max: 180, step: 1 },
      fildamiHitbox: { value: 0.62, min: 0.05, max: 4, step: 0.01 },
    }),
  });

  const modelFitKey = activeMode?.id || "basilica";
  const activeModelFit = {
    scale: modelFitControls[`${modelFitKey}Scale`] ?? 1,
    x: modelFitControls[`${modelFitKey}X`] ?? 0,
    y: modelFitControls[`${modelFitKey}Y`] ?? 0,
    z: modelFitControls[`${modelFitKey}Z`] ?? 0,
    rotX: THREE.MathUtils.degToRad(modelFitControls[`${modelFitKey}RotX`] ?? 0),
    rotY: THREE.MathUtils.degToRad(modelFitControls[`${modelFitKey}RotY`] ?? 0),
    rotZ: THREE.MathUtils.degToRad(modelFitControls[`${modelFitKey}RotZ`] ?? 0),
    hitbox: modelFitControls[`${modelFitKey}Hitbox`] ?? 0.82,
  };

  const modeColor = activeMode?.color || "#bafff7";
  const modeEmissive = activeMode?.emissive || activeMode?.color || "#63fff0";

  const crystal = useMemo(() => {
    const copy = scene.clone(true);

    copy.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      if (modelAutoRecolor) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(modeColor),
          emissive: new THREE.Color(modeEmissive),
          emissiveIntensity: crystalEmissive,

          roughness: crystalRoughness,
          metalness: 0.01,

          transmission: crystalTransmission,
          thickness: crystalThickness,
          ior: crystalIOR,

          attenuationColor: new THREE.Color(modeColor),
          attenuationDistance: 0.32,

          transparent: crystalOpacity < 0.999,
          opacity: crystalOpacity,
          depthWrite: true,
          depthTest: true,

          clearcoat: 1,
          clearcoatRoughness: 0.32,
          reflectivity: 0.78,

          side: THREE.FrontSide,
          envMapIntensity: 1.1,
        });
      } else {
        const cloneMaterial = (material) => {
          const cloned = material?.clone?.() || new THREE.MeshStandardMaterial({ color: "#ffffff" });

          if ("emissive" in cloned && cloned.emissive) {
            cloned.emissive = new THREE.Color(modeEmissive);
            cloned.emissiveIntensity = modelMaterialGlow;
          }

          if ("envMapIntensity" in cloned) {
            cloned.envMapIntensity = Math.max(cloned.envMapIntensity || 0, 0.75);
          }

          cloned.transparent = cloned.transparent || crystalOpacity < 0.999;
          cloned.opacity = Math.min(cloned.opacity ?? 1, crystalOpacity);
          cloned.depthWrite = true;
          cloned.depthTest = true;
          cloned.needsUpdate = true;

          return cloned;
        };

        child.material = Array.isArray(child.material)
          ? child.material.map(cloneMaterial)
          : cloneMaterial(child.material);
      }
    });

    return copy;
  }, [
    scene,
    modeColor,
    modeEmissive,
    crystalEmissive,
    crystalRoughness,
    crystalTransmission,
    crystalThickness,
    crystalIOR,
    crystalOpacity,
    modelAutoRecolor,
    modelMaterialGlow,
  ]);



  const fittedModel = useMemo(() => {
    const box = new THREE.Box3().setFromObject(crystal);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const heroBox = new THREE.Box3().setFromObject(heroReferenceScene);
    const heroSize = new THREE.Vector3();
    const heroCenter = new THREE.Vector3();

    heroBox.getSize(heroSize);
    heroBox.getCenter(heroCenter);

    const safeHeight = Math.max(size.y || 0, 0.0001);
    const heroHeight = Math.max(heroSize.y || safeHeight, 0.0001);
    const referenceMultiplier = Math.max(0.001, Number(heroReferenceMultiplier || 1));

    // Every imported GLB is normalized to the original hero_crystal.glb height.
    // This means crystal_01, crystal_02, crystal_03 and crystal_04 inherit the
    // same visual size language as the original hero crystal instead of each file
    // bringing its own random scale.
    const fitScale = autoFitModels
      ? Math.min(30, Math.max(0.001, (heroHeight * referenceMultiplier) / safeHeight))
      : 1;

    // Align the active model to the original hero crystal's visual position:
    // X/Z center follows the hero crystal center, and the model bottom sits on the
    // same local baseline. For hero_crystal itself this returns zero offset.
    const offset = centerModelOnPedestal
      ? new THREE.Vector3(
          heroCenter.x / fitScale - center.x,
          heroBox.min.y / fitScale - box.min.y,
          heroCenter.z / fitScale - center.z
        )
      : new THREE.Vector3(0, 0, 0);

    return { fitScale, offset, heroHeight, currentHeight: safeHeight };
  }, [
    crystal,
    heroReferenceScene,
    autoFitModels,
    heroReferenceMultiplier,
    centerModelOnPedestal,
  ]);

  useEffect(() => {
    pulseRef.current = 1;
  }, [activeMode?.id]);

  const getClientPoint = (event) => {
    const source = event?.nativeEvent || event;
    return {
      x: source?.clientX ?? 0,
      y: source?.clientY ?? 0,
    };
  };

  const handleCrystalPointerDown = (event) => {
    event.stopPropagation();
    crystalPointerDownRef.current = getClientPoint(event);
  };

  const handleCrystalPointerUp = (event) => {
    event.stopPropagation();
    const start = crystalPointerDownRef.current;
    crystalPointerDownRef.current = null;
    const end = getClientPoint(event);

    // Click/drag guard: dragging through the cinematic scene should not accidentally change crystal mode.
    if (start && Math.hypot(end.x - start.x, end.y - start.y) > 6) return;

    pulseRef.current = 1;
    onModeChange?.();
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = pulseRef.current;

    pulseRef.current = THREE.MathUtils.lerp(pulseRef.current, 0, 0.075);

    if (group.current) {
      group.current.position.set(
        activeModelFit.x,
        crystalY + activeModelFit.y,
        -5.75 + activeModelFit.z
      );
      group.current.rotation.x = activeModelFit.rotX;
      group.current.rotation.y = activeModelFit.rotY + Math.sin(t * 0.18) * 0.035 + pulse * 0.05;
      group.current.rotation.z = activeModelFit.rotZ;
      group.current.scale.setScalar(crystalScale * activeModelFit.scale * (1 + pulse * crystalChangePulseScale));
    }

    if (auraRef.current) {
      auraRef.current.visible = auraEnabled;
      auraRef.current.material.color.set(modeColor);
      auraRef.current.material.depthTest = auraDepthTest;
      auraRef.current.material.opacity = auraEnabled
        ? auraOpacity + Math.sin(t * 1.4) * auraOpacity * 0.12 + pulse * auraPulseOpacity
        : 0;
      auraRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.012 + pulse * auraPulseScale);
    }

    if (auraRingRef.current) {
      auraRingRef.current.visible = auraRingEnabled;
      auraRingRef.current.material.color.set(activeMode?.particleC || "#8b62ff");
      auraRingRef.current.material.depthTest = auraDepthTest;
      auraRingRef.current.material.opacity = auraRingEnabled
        ? auraRingOpacity + Math.sin(t * 1.8 + 0.6) * auraRingOpacity * 0.12 + pulse * auraRingPulseOpacity
        : 0;
      auraRingRef.current.rotation.z = t * auraRingSpinSpeed + pulse * 0.04;
    }

    const pulseBoost = lightPulse ? Math.sin(t * 1.25) * 0.07 : 0;

    if (coreLight.current) {
      coreLight.current.color.set(modeEmissive);
      coreLight.current.intensity = crystalLight * (1 + pulseBoost) + pulse * crystalChangePulseLight;
    }

    if (bottomLight.current) {
      bottomLight.current.color.set(modeColor);
      bottomLight.current.intensity =
        crystalBottomLight * (1 + Math.sin(t * 1.05 + 1.4) * 0.08) + pulse * crystalChangePulseLight * 0.55;
    }
  });

  return (
    <group ref={group} position={[activeModelFit.x, crystalY + activeModelFit.y, -5.75 + activeModelFit.z]} rotation={[activeModelFit.rotX, activeModelFit.rotY, activeModelFit.rotZ]} scale={crystalScale * activeModelFit.scale}>
      <mesh
        ref={auraRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.25, 0]}
      >
        <circleGeometry args={[auraRadius, 96]} />
        <meshBasicMaterial
          color={modeColor}
          transparent
          opacity={auraEnabled ? auraOpacity : 0}
          depthWrite={false}
          depthTest={auraDepthTest}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        ref={auraRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.235, 0]}
      >
        <ringGeometry args={[auraRingInner, auraRingOuter, 96]} />
        <meshBasicMaterial
          color={activeMode?.particleC || "#8b62ff"}
          transparent
          opacity={auraRingEnabled ? auraRingOpacity : 0}
          depthWrite={false}
          depthTest={auraDepthTest}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group scale={fittedModel.fitScale}>
        <primitive object={crystal} position={fittedModel.offset} />
      </group>

      <CrystalShapeCluster
        activeMode={activeMode}
        visible={showProceduralShards}
        shardCount={proceduralShardCount}
        shardScale={proceduralShardScale}
        shardOpacity={proceduralShardOpacity}
        shardRadius={proceduralShardRadius}
        shardHeight={proceduralShardHeight}
        shardSpinSpeed={proceduralShardSpinSpeed}
      />

      <mesh
        position={[0, 0.08, 0]}
        scale={[
          Math.max(0.22, activeModelFit.hitbox * 0.92),
          Math.max(0.18, activeModelFit.hitbox * 0.62),
          Math.max(0.22, activeModelFit.hitbox * 0.92),
        ]}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.classList.add("crystal-hover");
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          document.body.classList.remove("crystal-hover");
        }}
        onPointerDown={handleCrystalPointerDown}
        onPointerUp={handleCrystalPointerUp}
      >
        <sphereGeometry args={[1, 32, 18]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      <pointLight
        ref={coreLight}
        color={modeEmissive}
        intensity={crystalLight}
        distance={9}
        decay={2}
        position={[0, 0.8, 0]}
      />

      <pointLight
        ref={bottomLight}
        color={modeColor}
        intensity={crystalBottomLight}
        distance={5.4}
        decay={2}
        position={[0, -0.42, 0]}
      />

      <pointLight
        color={activeMode?.particleC || "#8b62ff"}
        intensity={crystalVioletLight}
        distance={4.8}
        decay={2}
        position={[0.7, 0.35, 0.35]}
      />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  PEDESTAL                                  */
/* -------------------------------------------------------------------------- */

function CrystalPedestal() {
  const pedestalTextures = useOptionalTexturePair(TEXTURE_PATHS.pedestal);
  const rockTextures = useOptionalTexturePair(TEXTURE_PATHS.rocks);
  const rockGeometry = useRockGeometry();

  const pedestalBaseMaterial = useTexturedMaterial(pedestalTextures, {
    repeatX: 3.2,
    repeatY: 0.85,
    color: "#66746e",
    normal: 0.85,
    roughness: 0.98,
    metalness: 0.01,
    envMapIntensity: 0.14,
  });

  const pedestalTopMaterial = useTexturedMaterial(pedestalTextures, {
    repeatX: 2.8,
    repeatY: 0.65,
    color: "#708079",
    normal: 0.7,
    roughness: 0.98,
    metalness: 0.01,
    envMapIntensity: 0.14,
  });

  const pedestalRockMaterial = useTexturedMaterial(rockTextures, {
    repeatX: 1.35,
    repeatY: 1.35,
    color: "#5b6861",
    normal: 0.95,
    roughness: 0.98,
    metalness: 0.01,
    envMapIntensity: 0.14,
    flatShading: true,
  });

  const stones = useMemo(() => {
    const seeded = (n) => {
      const v = Math.sin((n + 17) * 91.137) * 43758.5453;
      return v - Math.floor(v);
    };

    return Array.from({ length: 22 }, (_, index) => ({
      position: [
        (seeded(index * 11 + 1) - 0.5) * 2.35,
        -0.17 + seeded(index * 11 + 2) * 0.055,
        -5.75 + (seeded(index * 11 + 3) - 0.5) * 1.65,
      ],
      scale: [
        0.16 + seeded(index * 11 + 4) * 0.3,
        0.07 + seeded(index * 11 + 5) * 0.16,
        0.15 + seeded(index * 11 + 6) * 0.26,
      ],
      rotation: [
        seeded(index * 11 + 7) * 0.55,
        seeded(index * 11 + 8) * Math.PI,
        seeded(index * 11 + 9) * 0.55,
      ],
    }));
  }, []);

  const shards = useMemo(() => {
    const seeded = (n) => {
      const v = Math.sin((n + 131) * 73.193) * 24634.6345;
      return v - Math.floor(v);
    };

    return Array.from({ length: 9 }, (_, index) => ({
      position: [
        (seeded(index * 9 + 1) - 0.5) * 1.65,
        -0.08 + seeded(index * 9 + 2) * 0.055,
        -5.75 + (seeded(index * 9 + 3) - 0.5) * 1.05,
      ],
      scale: 0.055 + seeded(index * 9 + 4) * 0.08,
      rotation: [
        seeded(index * 9 + 5) * 0.35,
        seeded(index * 9 + 6) * Math.PI,
        seeded(index * 9 + 7) * 0.35,
      ],
      color: index % 3 === 0 ? "#8b62ff" : "#7fffee",
    }));
  }, []);

  return (
    <group>
      <mesh
        position={[0, -0.205, -5.75]}
        material={pedestalBaseMaterial}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[1.05, 1.35, 0.22, 32]} />
      </mesh>

      <mesh
        position={[0, -0.102, -5.75]}
        material={pedestalTopMaterial}
        receiveShadow
        castShadow
      >
        <cylinderGeometry args={[0.84, 1.04, 0.08, 32]} />
      </mesh>

      {stones.map((stone, index) => (
        <mesh
          key={index}
          geometry={rockGeometry}
          material={pedestalRockMaterial}
          position={stone.position}
          rotation={stone.rotation}
          scale={stone.scale}
          castShadow
          receiveShadow
        />
      ))}

      {shards.map((shard, index) => (
        <mesh
          key={`pedestal-shard-${index}`}
          position={shard.position}
          rotation={shard.rotation}
          scale={shard.scale}
          castShadow
        >
          <octahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial
            color={shard.color}
            emissive={shard.color}
            emissiveIntensity={0.34}
            roughness={0.08}
            metalness={0}
            transmission={0.2}
            thickness={1}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.82}
            envMapIntensity={1.4}
          />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  COLUMNS                                   */
/* -------------------------------------------------------------------------- */

function Column({ x, z, materials }) {
  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 1.65, 0]}
        material={materials.body}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.28, 0.38, 3.3, 32]} />
      </mesh>

      <mesh
        position={[0, -0.08, 0]}
        material={materials.base}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.5, 0.58, 0.24, 32]} />
      </mesh>

      <mesh
        position={[0, 3.38, 0]}
        material={materials.cap}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.16, 0.25, 1.16]} />
      </mesh>
    </group>
  );
}

function ColumnHall() {
  const columnTextures = useOptionalTexturePair(TEXTURE_PATHS.columns);

  const bodyMaterial = useTexturedMaterial(columnTextures, {
    repeatX: 2.2,
    repeatY: 5.8,
    color: "#5a6b64",
    normal: 0.82,
    roughness: 0.98,
    metalness: 0.01,
    envMapIntensity: 0.12,
  });

  const baseMaterial = useTexturedMaterial(columnTextures, {
    repeatX: 2.6,
    repeatY: 0.85,
    color: "#505f5a",
    normal: 0.72,
    roughness: 0.98,
    metalness: 0.01,
    envMapIntensity: 0.11,
  });

  const capMaterial = useTexturedMaterial(columnTextures, {
    repeatX: 1.5,
    repeatY: 1.5,
    color: "#46534e",
    normal: 0.62,
    roughness: 0.98,
    metalness: 0.01,
    envMapIntensity: 0.1,
  });

  const materials = useMemo(
    () => ({
      body: bodyMaterial,
      base: baseMaterial,
      cap: capMaterial,
    }),
    [bodyMaterial, baseMaterial, capMaterial]
  );

  const columns = [];
  const xs = [-5.45, -3.25, 3.25, 5.45];
  const zs = [-1.9, -3.8, -5.7, -7.6, -9.5, -11.4];

  xs.forEach((x) => {
    zs.forEach((z) => {
      columns.push({ x, z });
    });
  });

  return (
    <group position={[0, COLUMN_Y_OFFSET, 0]}>
      {columns.map((column, index) => (
        <Column
          key={index}
          x={column.x}
          z={column.z}
          materials={materials}
        />
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  CEILING                                   */
/* -------------------------------------------------------------------------- */

function Ceiling() {
  return (
    <group>
      <mesh position={[0, 3.82, -6.7]} receiveShadow>
        <boxGeometry args={[13.4, 0.18, 12.8]} />
        <meshStandardMaterial color="#040b09" roughness={0.99} metalness={0} />
      </mesh>

      {[-4.3, -2.15, 0, 2.15, 4.3].map((x) => (
        <mesh key={`beam-x-${x}`} position={[x, 3.58, -6.7]}>
          <boxGeometry args={[0.13, 0.28, 12.6]} />
          <meshStandardMaterial color="#0b1c19" roughness={0.98} />
        </mesh>
      ))}

      {[-3.3, -5.5, -7.7, -9.9].map((z) => (
        <mesh key={`beam-z-${z}`} position={[0, 3.52, z]}>
          <boxGeometry args={[12.9, 0.13, 0.13]} />
          <meshStandardMaterial color="#0a1714" roughness={0.99} />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  WATER FX                                  */
/* -------------------------------------------------------------------------- */

function WaterEdgeDarkness() {
  const { frontOpacity, sideOpacity, backOpacity } = useControls(
    "Water Masks",
    {
      frontOpacity: { value: 0.72, min: 0, max: 1, step: 0.01 },
      sideOpacity: { value: 0.68, min: 0, max: 1, step: 0.01 },
      backOpacity: { value: 0.75, min: 0, max: 1, step: 0.01 },
    }
  );

  return (
    <group>
      <mesh position={[0, -0.22, 2.4]}>
        <boxGeometry args={[22, 0.1, 3.2]} />
        <meshBasicMaterial color="#010504" transparent opacity={frontOpacity} />
      </mesh>

      <mesh position={[-7.8, -0.21, -4.8]}>
        <boxGeometry args={[2.8, 0.1, 24]} />
        <meshBasicMaterial color="#010504" transparent opacity={sideOpacity} />
      </mesh>

      <mesh position={[7.8, -0.21, -4.8]}>
        <boxGeometry args={[2.8, 0.1, 24]} />
        <meshBasicMaterial color="#010504" transparent opacity={sideOpacity} />
      </mesh>

      <mesh position={[0, -0.21, -13]}>
        <boxGeometry args={[22, 0.1, 3]} />
        <meshBasicMaterial color="#010504" transparent opacity={backOpacity} />
      </mesh>
    </group>
  );
}

function CrystalWaterGlow({ activeMode = CRYSTAL_MODES[0] }) {
  const glowRef = useRef();
  const rimRef = useRef();

  const { glowEnabled, glowOpacity, rimOpacity, glowRadius } = useControls(
    "Water Glow",
    {
      glowEnabled: true,
      glowOpacity: { value: 0.024, min: 0, max: 0.25, step: 0.005 },
      rimOpacity: { value: 0.014, min: 0, max: 0.15, step: 0.005 },
      glowRadius: { value: 1.55, min: 0.3, max: 5, step: 0.05 },
    }
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (glowRef.current) {
      glowRef.current.material.opacity =
        glowOpacity + Math.sin(t * 1.1) * glowOpacity * 0.28;
    }

    if (rimRef.current) {
      rimRef.current.material.opacity =
        rimOpacity + Math.sin(t * 0.8 + 1) * rimOpacity * 0.28;
    }
  });

  if (!glowEnabled) return null;

  return (
    <group>
      <mesh
        ref={glowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.244, -5.65]}
      >
        <circleGeometry args={[glowRadius, 128]} />
        <meshBasicMaterial
          color={activeMode?.color || "#7fffee"}
          transparent
          opacity={glowOpacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        ref={rimRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[1.15, -0.242, -5.95]}
      >
        <circleGeometry args={[0.75, 64]} />
        <meshBasicMaterial
          color={activeMode?.particleC || "#8b62ff"}
          transparent
          opacity={rimOpacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}


/* -------------------------------------------------------------------------- */
/*                              CRYSTAL BACK FOG                              */
/* -------------------------------------------------------------------------- */

function CrystalBackFog({ portalProgress = 0, activeMode = CRYSTAL_MODES[0] }) {
  const fogRef = useRef();

  const {
    backFogEnabled,
    backFogOpacity,
    backFogWidth,
    backFogHeight,
    backFogY,
    backFogZ,
    backFogDrift,
    backFogNoiseScale,
    backFogContrast,
    backFogCenterGlow,
    backFogSoftness,
    backFogDarkness,
    backFogCyan,
    backFogColorA,
    backFogColorB,
  } = useControls("Back Fog", {
    backFogEnabled: true,
    backFogOpacity: { value: 0.18, min: 0, max: 0.75, step: 0.01 },
    backFogWidth: { value: 10.8, min: 3, max: 18, step: 0.1 },
    backFogHeight: { value: 6.4, min: 2, max: 12, step: 0.1 },
    backFogY: { value: 2.05, min: -0.5, max: 5.5, step: 0.05 },
    backFogZ: { value: -7.25, min: -12, max: -4.5, step: 0.05 },
    backFogDrift: { value: 0.04, min: 0, max: 0.25, step: 0.005 },
    backFogNoiseScale: { value: 2.15, min: 0.3, max: 6, step: 0.05 },
    backFogContrast: { value: 0.58, min: 0, max: 1.5, step: 0.01 },
    backFogCenterGlow: { value: 0.2, min: 0, max: 1, step: 0.01 },
    backFogSoftness: { value: 0.74, min: 0.2, max: 1.4, step: 0.01 },
    backFogDarkness: { value: 0.62, min: 0, max: 1, step: 0.01 },
    backFogCyan: { value: 0.35, min: 0, max: 1, step: 0.01 },
    backFogColorA: "#061413",
    backFogColorB: "#6ffff0",
  });

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: backFogOpacity },
        uDrift: { value: backFogDrift },
        uNoiseScale: { value: backFogNoiseScale },
        uContrast: { value: backFogContrast },
        uCenterGlow: { value: backFogCenterGlow },
        uSoftness: { value: backFogSoftness },
        uDarkness: { value: backFogDarkness },
        uCyan: { value: backFogCyan },
        uColorA: { value: new THREE.Color(backFogColorA) },
        uColorB: { value: new THREE.Color(backFogColorB) },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uDrift;
        uniform float uNoiseScale;
        uniform float uContrast;
        uniform float uCenterGlow;
        uniform float uSoftness;
        uniform float uDarkness;
        uniform float uCyan;
        uniform vec3 uColorA;
        uniform vec3 uColorB;

        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;

          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }

          return value;
        }

        void main() {
          vec2 uv = vUv;

          float edgeX = smoothstep(0.0, 0.22 * uSoftness, uv.x) *
                        (1.0 - smoothstep(1.0 - 0.22 * uSoftness, 1.0, uv.x));
          float edgeY = smoothstep(0.0, 0.18 * uSoftness, uv.y) *
                        (1.0 - smoothstep(1.0 - 0.12 * uSoftness, 1.0, uv.y));
          float edgeFade = edgeX * edgeY;

          vec2 movingUv = uv * vec2(2.0, 1.25) * uNoiseScale;
          movingUv.y += uTime * uDrift;
          movingUv.x += sin(uTime * 0.12 + uv.y * 5.0) * 0.08;

          float mist = fbm(movingUv);
          float contrastMist = smoothstep(0.18, 1.0 - uContrast * 0.22, mist);

          float center = 1.0 - distance(uv, vec2(0.5, 0.43)) * 1.48;
          center = clamp(center, 0.0, 1.0);
          center = pow(center, 2.25);

          vec3 fogColor = mix(uColorA, uColorB, center * uCyan);
          fogColor *= mix(uDarkness, 1.0, center * 0.8);

          float alpha = contrastMist * edgeFade * uOpacity;
          alpha += center * edgeFade * uCenterGlow * uOpacity * 0.55;

          gl_FragColor = vec4(fogColor, alpha);
        }
      `,
    });
  }, []);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    if (!fogRef.current) return;

    const t = state.clock.elapsedTime;

    material.uniforms.uTime.value = t;
    const portalGlow = THREE.MathUtils.clamp(portalProgress, 0, 1);

    material.uniforms.uOpacity.value = backFogOpacity + portalGlow * 0.08;
    material.uniforms.uDrift.value = backFogDrift + portalGlow * 0.035;
    material.uniforms.uNoiseScale.value = backFogNoiseScale + portalGlow * 0.22;
    material.uniforms.uContrast.value = backFogContrast + portalGlow * 0.18;
    material.uniforms.uCenterGlow.value = backFogCenterGlow + portalGlow * 0.18;
    material.uniforms.uSoftness.value = backFogSoftness;
    material.uniforms.uDarkness.value = Math.max(0.38, backFogDarkness - portalGlow * 0.12);
    material.uniforms.uCyan.value = Math.min(0.62, backFogCyan + portalGlow * 0.12);
    material.uniforms.uColorA.value.set(backFogColorA);
    material.uniforms.uColorB.value.set(activeMode?.color || backFogColorB);
  });

  if (!backFogEnabled) return null;

  return (
    <mesh
      ref={fogRef}
      position={[0, backFogY, backFogZ]}
      material={material}
      frustumCulled={false}
      renderOrder={-1}
    >
      <planeGeometry args={[backFogWidth, backFogHeight, 1, 1]} />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  PARTICLES                                 */
/* -------------------------------------------------------------------------- */



function CrystalParticleCloud({ activeMode = CRYSTAL_MODES[0], modePulseKey = 0 }) {
  const mobile = (typeof window !== "undefined" && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")));
  const points = useRef();
  const interactionMeshRef = useRef();
  const hoverStrengthRef = useRef(0);
  const burstRef = useRef(0);
  const pointerTargetRef = useRef(new THREE.Vector2(0, 0));
  const pointerUniformRef = useRef(new THREE.Vector2(0, 0));

  const defaultCount = mobile ? 200 : 360;

  const {
    particleEnabled,
    particleCount,
    particleOpacity,
    particleSize,
    particleSpeed,
    particleHeight,
    particleRadius,
    particleBaseY,
    particleBaseZ,
    particleTwist,
    particleSpread,
    particleTurbulence,
    particleVerticalBias,
    particleColorMix,
    particlePulse,
    particleFadeTop,
    particleFadeBottom,
    particleColorA,
    particleColorB,
    particleColorC,
    particleInteractionEnabled,
    particlePointerStrength,
    particlePointerRadius,
    particlePointerLift,
    particleClickBurst,
    particleBurstDecay,
  } = useControls("Scattering Particles", {
    particleEnabled: true,
    particleCount: { value: defaultCount, min: 90, max: 1000, step: 40 },
    particleOpacity: { value: mobile ? 0.32 : 0.40, min: 0, max: 1, step: 0.01 },
    particleSize: { value: 0.058, min: 0.01, max: 0.22, step: 0.001 },
    particleSpeed: { value: 0.28, min: 0, max: 1.4, step: 0.01 },
    particleHeight: { value: 2.95, min: 0.6, max: 7.5, step: 0.05 },
    particleRadius: { value: 0.82, min: 0.12, max: 2.2, step: 0.02 },
    particleBaseY: { value: 0.06, min: -0.6, max: 1.6, step: 0.01 },
    particleBaseZ: { value: -5.75, min: -7.2, max: -4.6, step: 0.01 },
    particleTwist: { value: 4.4, min: 0, max: 14, step: 0.05 },
    particleSpread: { value: 1.35, min: 0.2, max: 3.5, step: 0.05 },
    particleTurbulence: { value: 0.11, min: 0, max: 0.6, step: 0.005 },
    particleVerticalBias: { value: 0.72, min: 0.25, max: 2.5, step: 0.01 },
    particleColorMix: { value: 0.38, min: 0, max: 1, step: 0.01 },
    particlePulse: { value: 0.22, min: 0, max: 1, step: 0.01 },
    particleFadeBottom: { value: 0.12, min: 0.01, max: 0.5, step: 0.01 },
    particleFadeTop: { value: 0.78, min: 0.25, max: 1.0, step: 0.01 },
    particleColorA: "#73fff1",
    particleColorB: "#dffffa",
    particleColorC: "#8b62ff",
    particleInteractionEnabled: true,
    particlePointerStrength: { value: 0.78, min: 0, max: 2.5, step: 0.01 },
    particlePointerRadius: { value: 1.05, min: 0.2, max: 3.0, step: 0.01 },
    particlePointerLift: { value: 0.62, min: 0, max: 2.0, step: 0.01 },
    particleClickBurst: { value: mobile ? 0.45 : 0.65, min: 0, max: 2.5, step: 0.01 },
    particleBurstDecay: { value: 0.06, min: 0.01, max: 0.2, step: 0.005 },
  });

  const particleModeColors = useControls("Particle Colors / Per Cistern", {
    "01 Basilica": folder({
      basilicaParticleA: activeMode?.particleA || "#ffe0a3",
      basilicaParticleB: "#7fffee",
      basilicaParticleC: "#ff8d3a",
    }),
    "02 Binbirdirek": folder({
      binbirdirekParticleA: "#63fff0",
      binbirdirekParticleB: "#dffffa",
      binbirdirekParticleC: "#68ff9a",
    }),
    "03 Gülhane": folder({
      gulhaneParticleA: "#57c9ff",
      gulhaneParticleB: "#d7f7ff",
      gulhaneParticleC: "#7fffee",
    }),
    "04 Şerefiye": folder({
      serefiyeParticleA: "#b277ff",
      serefiyeParticleB: "#f2e2ff",
      serefiyeParticleC: "#7fffee",
    }),
    "05 Fildamı": folder({
      fildamiParticleA: "#fff1c7",
      fildamiParticleB: "#ffffff",
      fildamiParticleC: "#68ff9a",
    }),
  });

  const particleModeKey = activeMode?.id || "basilica";
  const activeParticleA = particleModeColors[`${particleModeKey}ParticleA`] || activeMode?.particleA || particleColorA;
  const activeParticleB = particleModeColors[`${particleModeKey}ParticleB`] || activeMode?.particleB || particleColorB;
  const activeParticleC = particleModeColors[`${particleModeKey}ParticleC`] || activeMode?.particleC || particleColorC;

  useEffect(() => {
    burstRef.current = Math.max(burstRef.current, particleClickBurst * 1.15);
    hoverStrengthRef.current = 1;
  }, [modePulseKey, activeMode?.id, particleClickBurst]);

  const geometry = useMemo(() => {
    const count = Math.floor(particleCount);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const i4 = i * 4;

      positions[i3 + 0] = 0;
      positions[i3 + 1] = Math.random();
      positions[i3 + 2] = 0;

      seeds[i4 + 0] = Math.random() * Math.PI * 2;
      seeds[i4 + 1] = 0.35 + Math.random() * 0.9;
      seeds[i4 + 2] = 0.55 + Math.random() * 0.7;
      seeds[i4 + 3] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));

    return geo;
  }, [particleCount]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: particleOpacity },
        uSize: { value: particleSize },
        uSpeed: { value: particleSpeed },
        uHeight: { value: particleHeight },
        uRadius: { value: particleRadius },
        uTwist: { value: particleTwist },
        uSpread: { value: particleSpread },
        uTurbulence: { value: particleTurbulence },
        uVerticalBias: { value: particleVerticalBias },
        uColorMix: { value: particleColorMix },
        uPulse: { value: particlePulse },
        uFadeBottom: { value: particleFadeBottom },
        uFadeTop: { value: particleFadeTop },
        uColorA: { value: new THREE.Color(activeParticleA) },
        uColorB: { value: new THREE.Color(activeParticleB) },
        uColorC: { value: new THREE.Color(activeParticleC) },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uInteraction: { value: 0 },
        uPointerStrength: { value: particlePointerStrength },
        uPointerRadius: { value: particlePointerRadius },
        uPointerLift: { value: particlePointerLift },
        uBurst: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform float uSpeed;
        uniform float uHeight;
        uniform float uRadius;
        uniform float uTwist;
        uniform float uSpread;
        uniform float uTurbulence;
        uniform float uVerticalBias;
        uniform float uPulse;
        uniform float uFadeBottom;
        uniform float uFadeTop;
        uniform vec2 uPointer;
        uniform float uInteraction;
        uniform float uPointerStrength;
        uniform float uPointerRadius;
        uniform float uPointerLift;
        uniform float uBurst;

        attribute vec4 aSeed;

        varying float vLife;
        varying float vAlpha;
        varying float vPulse;
        varying float vColorSeed;

        float hash(float n) {
          return fract(sin(n) * 43758.5453123);
        }

        void main() {
          float life = fract(position.y + aSeed.w + uTime * 0.055 * uSpeed * aSeed.z);
          float shapedLife = pow(life, uVerticalBias);

          float fadeIn = smoothstep(0.0, uFadeBottom, life);
          float fadeOut = 1.0 - smoothstep(uFadeTop, 1.0, life);
          vAlpha = fadeIn * fadeOut;

          float angle = aSeed.x + shapedLife * uTwist + uTime * (0.28 + aSeed.z * 0.35) * uSpeed;
          float radiusGrowth = pow(shapedLife, uSpread);
          float radius = mix(0.045, uRadius, radiusGrowth) * aSeed.y;

          float wobbleA = sin(uTime * 0.85 + aSeed.x * 3.7 + life * 9.0);
          float wobbleB = cos(uTime * 0.62 + aSeed.x * 2.4 + life * 7.5);
          radius += wobbleA * uTurbulence * 0.18;

          vec3 p = vec3(
            cos(angle) * radius + wobbleB * uTurbulence * 0.08,
            shapedLife * uHeight,
            sin(angle) * radius + wobbleA * uTurbulence * 0.08
          );

          float pointerX = uPointer.x * uRadius * 1.35;
          float pointerY = ((uPointer.y * 0.5) + 0.5) * uHeight;
          vec2 toPointer = vec2(p.x - pointerX, p.y - pointerY);
          float pointerDistance = length(toPointer);
          float pointerInfluence = (1.0 - smoothstep(uPointerRadius * 0.18, uPointerRadius, pointerDistance)) * uInteraction;
          vec2 safeDir = normalize(toPointer + vec2(0.0001, 0.0001));

          p.x += safeDir.x * pointerInfluence * uPointerStrength * 0.32;
          p.z += uPointer.x * pointerInfluence * uPointerStrength * 0.14;
          p.y += pointerInfluence * uPointerLift * 0.16;
          radius += pointerInfluence * uPointerStrength * 0.08;

          p.y += uBurst * (0.08 + shapedLife * 0.22);
          p.x += cos(angle * 1.5) * uBurst * 0.04;
          p.z += sin(angle * 1.35) * uBurst * 0.04;

          vLife = life;
          vColorSeed = hash(aSeed.x * 19.17 + aSeed.w * 31.31);
          vPulse = 1.0 + sin(uTime * 3.0 + aSeed.x * 8.0) * 0.18 * uPulse + uBurst * 0.28 + pointerInfluence * 0.12;
          vAlpha *= 1.0 + uBurst * 0.15;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * vPulse * (420.0 / max(-mvPosition.z, 0.001));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uColorMix;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;

        varying float vLife;
        varying float vAlpha;
        varying float vPulse;
        varying float vColorSeed;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);

          float softDot = smoothstep(0.5, 0.05, d);
          float core = smoothstep(0.18, 0.0, d);

          vec3 color = mix(uColorA, uColorB, smoothstep(0.12, 0.72, vLife) * uColorMix);
          color = mix(color, uColorC, step(0.86, vColorSeed) * 0.45);

          float alpha = softDot * vAlpha * uOpacity;
          alpha += core * vAlpha * uOpacity * 0.35;
          alpha *= vPulse;

          if (alpha < 0.01) discard;

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    if (!points.current) return;

    const t = state.clock.elapsedTime;

    burstRef.current = THREE.MathUtils.lerp(
      burstRef.current,
      0,
      particleBurstDecay
    );

    pointerUniformRef.current.lerp(pointerTargetRef.current, 0.12);
    hoverStrengthRef.current = THREE.MathUtils.lerp(
      hoverStrengthRef.current,
      particleInteractionEnabled && (Math.abs(pointerTargetRef.current.x) > 0.001 || Math.abs(pointerTargetRef.current.y) > 0.001 || hoverStrengthRef.current > 0.5) ? 1 : 0,
      0.08
    );

    material.uniforms.uTime.value = t;
    material.uniforms.uOpacity.value = particleOpacity;
    material.uniforms.uSize.value = particleSize;
    material.uniforms.uSpeed.value = particleSpeed;
    material.uniforms.uHeight.value = particleHeight;
    material.uniforms.uRadius.value = particleRadius;
    material.uniforms.uTwist.value = particleTwist;
    material.uniforms.uSpread.value = particleSpread;
    material.uniforms.uTurbulence.value = particleTurbulence;
    material.uniforms.uVerticalBias.value = particleVerticalBias;
    material.uniforms.uColorMix.value = particleColorMix;
    material.uniforms.uPulse.value = particlePulse;
    material.uniforms.uFadeBottom.value = particleFadeBottom;
    material.uniforms.uFadeTop.value = particleFadeTop;
    material.uniforms.uColorA.value.set(activeParticleA);
    material.uniforms.uColorB.value.set(activeParticleB);
    material.uniforms.uColorC.value.set(activeParticleC);
    material.uniforms.uPointer.value.copy(pointerUniformRef.current);
    material.uniforms.uInteraction.value = particleInteractionEnabled
      ? hoverStrengthRef.current
      : 0;
    material.uniforms.uPointerStrength.value = particlePointerStrength;
    material.uniforms.uPointerRadius.value = particlePointerRadius;
    material.uniforms.uPointerLift.value = particlePointerLift;
    material.uniforms.uBurst.value = burstRef.current;

    points.current.position.y = particleBaseY;
    points.current.position.z = particleBaseZ;
    points.current.rotation.z = Math.sin(t * 0.22) * 0.018;
  });

  if (!particleEnabled) return null;

  return (
    <group>
      <points
        ref={points}
        geometry={geometry}
        material={material}
        position={[0, particleBaseY, particleBaseZ]}
        frustumCulled={false}
        renderOrder={4}
      />

      <mesh
        ref={interactionMeshRef}
        position={[0, particleBaseY + particleHeight * 0.52, particleBaseZ]}
        onPointerOver={() => {
          hoverStrengthRef.current = 1;
        }}
        onPointerOut={() => {
          hoverStrengthRef.current = 0;
          pointerTargetRef.current.set(0, 0);
        }}
        onPointerMove={(event) => {
          if (!particleInteractionEnabled) return;

          hoverStrengthRef.current = 1;

          const localX = THREE.MathUtils.clamp(
            event.point.x / Math.max(particleRadius * 1.45, 0.001),
            -1,
            1
          );

          const centerY = particleBaseY + particleHeight * 0.52;
          const localY = THREE.MathUtils.clamp(
            ((event.point.y - centerY) / Math.max(particleHeight * 0.62, 0.001)) * 1.2,
            -1,
            1
          );

          pointerTargetRef.current.set(localX, localY);
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          if (!particleInteractionEnabled) return;
          burstRef.current = Math.max(burstRef.current, particleClickBurst);
          hoverStrengthRef.current = 1;
          event.stopPropagation();
        }}
      >
        <cylinderGeometry
          args={[
            Math.max(particleRadius * 1.1, 0.4),
            Math.max(particleRadius * 0.62, 0.18),
            particleHeight + 0.95,
            20,
            1,
            true,
          ]}
        />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}


function EnergyCracks() {
  const cracks = useMemo(() => {
    const result = [];

    for (let i = 0; i < 12; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const startRadius = 0.42 + Math.random() * 0.25;
      const endRadius = 0.95 + Math.random() * 0.85;

      const start = new THREE.Vector3(
        Math.cos(angle) * startRadius,
        -0.11,
        -5.75 + Math.sin(angle) * startRadius
      );

      const mid = new THREE.Vector3(
        Math.cos(angle + (Math.random() - 0.5) * 0.35) *
          ((startRadius + endRadius) / 2),
        -0.105,
        -5.75 +
          Math.sin(angle + (Math.random() - 0.5) * 0.35) *
            ((startRadius + endRadius) / 2)
      );

      const end = new THREE.Vector3(
        Math.cos(angle + (Math.random() - 0.5) * 0.5) * endRadius,
        -0.1,
        -5.75 + Math.sin(angle + (Math.random() - 0.5) * 0.5) * endRadius
      );

      result.push(new THREE.CatmullRomCurve3([start, mid, end]));
    }

    return result;
  }, []);

  const group = useRef();

  const { crackOpacity, crackThickness } = useControls("Energy Cracks", {
    crackOpacity: { value: 0.03, min: 0, max: 0.2, step: 0.002 },
    crackThickness: { value: 0.003, min: 0.001, max: 0.03, step: 0.001 },
  });

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;

    group.current.children.forEach((child, index) => {
      if (!child.material) return;

      child.material.opacity =
        crackOpacity + Math.sin(t * 1.1 + index) * crackOpacity * 0.35;
    });
  });

  return (
    <group ref={group}>
      {cracks.map((curve, index) => (
        <mesh key={index}>
          <tubeGeometry args={[curve, 14, crackThickness, 5, false]} />
          <meshBasicMaterial
            color={index % 5 === 0 ? "#8b62ff" : "#7fffee"}
            transparent
            opacity={crackOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                            NON-TEXTURED FOREGROUND ROCKS                   */
/* -------------------------------------------------------------------------- */

function BrokenForegroundStones() {
  const {
    foregroundStonesEnabled,
    foregroundStonesX,
    foregroundStonesY,
    foregroundStonesZ,
    foregroundStonesScale,
    foregroundStonesSpreadX,
    foregroundStonesDepthZ,
    foregroundStonesSize,
    foregroundStonesColor,
  } = useControls("Foreground Stones", {
    foregroundStonesEnabled: true,
    foregroundStonesX: { value: 0, min: -10, max: 10, step: 0.05 },
    foregroundStonesY: { value: 0, min: -2, max: 2, step: 0.01 },
    // Negative Z pushes the foreground stones deeper into the cistern so they do not sit in front of the camera.
    foregroundStonesZ: { value: -1.85, min: -10, max: 6, step: 0.05 },
    foregroundStonesScale: { value: 0.72, min: 0, max: 3, step: 0.05 },
    foregroundStonesSpreadX: { value: 4.4, min: 1, max: 9, step: 0.05 },
    foregroundStonesDepthZ: { value: 5.0, min: 1, max: 10, step: 0.05 },
    foregroundStonesSize: { value: 0.82, min: 0.1, max: 2.5, step: 0.01 },
    foregroundStonesColor: "#111817",
  });

  const stones = useMemo(() => {
    const seeded = (n) => {
      const v = Math.sin((n + 907) * 51.731) * 34123.123;
      return v - Math.floor(v);
    };

    return Array.from({ length: 14 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;

      return {
        position: [
          side * (3.2 + seeded(i * 10 + 1) * 3.0),
          -0.08,
          -0.9 - seeded(i * 10 + 2) * 3.8,
        ],
        scale: [
          0.22 + seeded(i * 10 + 3) * 0.34,
          0.055 + seeded(i * 10 + 4) * 0.1,
          0.2 + seeded(i * 10 + 5) * 0.38,
        ],
        rotation: [
          seeded(i * 10 + 6) * 0.25,
          seeded(i * 10 + 7) * Math.PI,
          seeded(i * 10 + 8) * 0.22,
        ],
      };
    });
  }, []);

  if (!foregroundStonesEnabled) return null;

  return (
    <group
      position={[foregroundStonesX, foregroundStonesY, foregroundStonesZ]}
      scale={foregroundStonesScale}
    >
      {stones.map((stone, index) => (
        <mesh
          key={index}
          position={[
            stone.position[0] * (foregroundStonesSpreadX / 4.4),
            stone.position[1],
            stone.position[2] * (foregroundStonesDepthZ / 5.0),
          ]}
          scale={[
            stone.scale[0] * foregroundStonesSize,
            stone.scale[1] * foregroundStonesSize,
            stone.scale[2] * foregroundStonesSize,
          ]}
          rotation={stone.rotation}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={foregroundStonesColor}
            roughness={0.96}
            metalness={0.02}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  CABLES                                    */
/* -------------------------------------------------------------------------- */


function SuspendedCables() {
  const group = useRef();
  const cableTextures = useOptionalTexturePair(TEXTURE_PATHS.cables);

  const {
    cableEnabled,
    cableCount,
    cableThickness,
    cableSegments,
    cableSag,
    cableSpread,
    cableDepth,
    cableStartHeight,
    cableOrganic,
    cableSwing,
    cableTextureRepeatY,
    cableTextureRepeatX,
    cableNormalStrength,
    cableRoughness,
    cableMetalness,
    cableColor,
    cableAccentColor,
    cableAccentEvery,
    cableSecondaryChance,
  } = useControls("Cables", {
    cableEnabled: true,
    cableCount: { value: 8, min: 0, max: 24, step: 1 },
    cableThickness: { value: 0.013, min: 0.005, max: 0.04, step: 0.001 },
    cableSegments: { value: 44, min: 16, max: 128, step: 2 },
    cableSag: { value: 0.72, min: 0.1, max: 1.8, step: 0.02 },
    cableSpread: { value: 5.4, min: 2.5, max: 9.0, step: 0.1 },
    cableDepth: { value: 8.1, min: 3.0, max: 13.0, step: 0.1 },
    cableStartHeight: { value: 3.54, min: 2.8, max: 4.2, step: 0.02 },
    cableOrganic: { value: 0.62, min: 0, max: 1.8, step: 0.02 },
    cableSwing: { value: 0.012, min: 0, max: 0.08, step: 0.002 },
    cableTextureRepeatY: { value: 8.5, min: 1, max: 24, step: 0.1 },
    cableTextureRepeatX: { value: 1.0, min: 0.5, max: 4, step: 0.1 },
    cableNormalStrength: { value: 0.65, min: 0, max: 2, step: 0.01 },
    cableRoughness: { value: 0.84, min: 0, max: 1, step: 0.01 },
    cableMetalness: { value: 0.18, min: 0, max: 1, step: 0.01 },
    cableColor: "#0d1513",
    cableAccentColor: "#16211f",
    cableAccentEvery: { value: 4, min: 2, max: 10, step: 1 },
    cableSecondaryChance: { value: 0.35, min: 0, max: 1, step: 0.01 },
  });

  const cableMaterial = useTexturedMaterial(cableTextures, {
    repeatX: cableTextureRepeatX,
    repeatY: cableTextureRepeatY,
    color: cableColor,
    normal: cableNormalStrength,
    roughness: cableRoughness,
    metalness: cableMetalness,
    envMapIntensity: 0.16,
  });

  const cableAccentMaterial = useTexturedMaterial(cableTextures, {
    repeatX: cableTextureRepeatX,
    repeatY: cableTextureRepeatY,
    color: cableAccentColor,
    normal: cableNormalStrength * 1.08,
    roughness: Math.max(cableRoughness - 0.06, 0),
    metalness: Math.min(cableMetalness + 0.08, 1),
    envMapIntensity: 0.22,
  });

  const cables = useMemo(() => {
    const seededRandom = (seed) => {
      const x = Math.sin(seed * 913.713) * 43758.5453;
      return x - Math.floor(x);
    };

    const result = [];

    for (let i = 0; i < cableCount; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const r1 = seededRandom(i + 1.17);
      const r2 = seededRandom(i + 3.49);
      const r3 = seededRandom(i + 6.88);
      const r4 = seededRandom(i + 11.36);
      const r5 = seededRandom(i + 14.62);

      const startX = side * (cableSpread + 0.9 + r1 * 2.8);
      const endX = -side * (cableSpread * 0.55 + r2 * 2.7);

      const startZ = -1.35 - r2 * cableDepth;
      const endZ = -2.4 - r3 * cableDepth;

      const startY = cableStartHeight - r4 * 0.22;
      const sagY = startY - cableSag * (0.45 + r2 * 0.85);
      const endY = startY + (r5 - 0.5) * 0.09;

      const organicA = (r3 - 0.5) * cableOrganic;
      const organicB = (r5 - 0.5) * cableOrganic * 0.8;

      const points = [
        new THREE.Vector3(startX, startY, startZ),
        new THREE.Vector3(startX * 0.58 + organicA, sagY, startZ - 0.65),
        new THREE.Vector3((startX + endX) * 0.14 + organicB, sagY - 0.08, (startZ + endZ) * 0.5 - 0.55),
        new THREE.Vector3(endX * 0.55 - organicA * 0.65, sagY + 0.08, endZ + 0.38),
        new THREE.Vector3(endX, endY, endZ),
      ];

      const curve = new THREE.CatmullRomCurve3(points);
      curve.curveType = "centripetal";

      const secondary = [];
      if (r5 < cableSecondaryChance) {
        const offset = 0.08 + r1 * 0.07;
        const secondaryPoints = points.map((p, idx) =>
          p.clone().add(
            new THREE.Vector3(
              (idx % 2 === 0 ? 1 : -1) * offset,
              idx === 2 ? -offset * 0.35 : offset * 0.12,
              offset * 0.25
            )
          )
        );
        const secondaryCurve = new THREE.CatmullRomCurve3(secondaryPoints);
        secondaryCurve.curveType = "centripetal";
        secondary.push(secondaryCurve);
      }

      result.push({
        curve,
        secondary,
        accent: i % cableAccentEvery === 0,
        phase: r1 * Math.PI * 2,
      });
    }

    return result;
  }, [
    cableCount,
    cableSpread,
    cableDepth,
    cableStartHeight,
    cableSag,
    cableOrganic,
    cableAccentEvery,
    cableSecondaryChance,
  ]);

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;

    group.current.children.forEach((child) => {
      const phase = child.userData?.phase ?? 0;
      child.rotation.z = Math.sin(t * 0.16 + phase) * cableSwing;
      child.rotation.x = Math.sin(t * 0.11 + phase * 0.7) * cableSwing * 0.28;
    });
  });

  if (!cableEnabled) return null;

  return (
    <group ref={group}>
      {cables.map((cable, index) => (
        <group key={`cable-${index}`} userData={{ phase: cable.phase }}>
          <mesh
            material={cable.accent ? cableAccentMaterial : cableMaterial}
            castShadow
            receiveShadow
          >
            <tubeGeometry args={[cable.curve, cableSegments, cableThickness, 8, false]} />
          </mesh>

          {cable.secondary.map((secondaryCurve, secondaryIndex) => (
            <mesh
              key={`cable-secondary-${index}-${secondaryIndex}`}
              material={cableMaterial}
              castShadow
              receiveShadow
            >
              <tubeGeometry
                args={[
                  secondaryCurve,
                  Math.max(Math.floor(cableSegments * 0.8), 24),
                  cableThickness * 0.52,
                  6,
                  false,
                ]}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}


/* -------------------------------------------------------------------------- */
/*                                  LIGHTING                                  */
/* -------------------------------------------------------------------------- */

function Lighting() {
  const spotRef = useRef();
  const spotTargetRef = useRef();

  const {
    ambient,
    hemi,
    directional,
    spot,
    crystalArea,
    leftFill,
    rightFill,
    backRim,
    purpleAccent,
    frontWater,
    overheadMist,
    warmStone,
  } = useControls("Lighting", {
    ambient: { value: 0.085, min: 0, max: 1, step: 0.005 },
    hemi: { value: 0.22, min: 0, max: 2, step: 0.01 },
    directional: { value: 0.3, min: 0, max: 3, step: 0.01 },
    spot: { value: 5.8, min: 0, max: 14, step: 0.1 },

    crystalArea: { value: 3.45, min: 0, max: 10, step: 0.05 },

    leftFill: { value: 1.25, min: 0, max: 6, step: 0.05 },
    rightFill: { value: 0.72, min: 0, max: 6, step: 0.05 },
    backRim: { value: 1.05, min: 0, max: 6, step: 0.05 },
    purpleAccent: { value: 0.72, min: 0, max: 5, step: 0.05 },
    frontWater: { value: 0.72, min: 0, max: 5, step: 0.05 },

    overheadMist: { value: 0.42, min: 0, max: 4, step: 0.05 },
    warmStone: { value: 0.18, min: 0, max: 2, step: 0.01 },
  });

  useEffect(() => {
    if (!spotRef.current || !spotTargetRef.current) return;

    spotRef.current.target = spotTargetRef.current;
    spotRef.current.target.updateMatrixWorld();
  }, []);

  return (
    <>
      <object3D ref={spotTargetRef} position={[0, 0.05, -5.75]} />

      <ambientLight intensity={ambient} color="#bffff7" />

      <hemisphereLight
        intensity={hemi}
        color="#7fffee"
        groundColor="#06100f"
      />

      <directionalLight
        color="#c8fff8"
        intensity={directional}
        position={[-4.5, 7, 5]}
      />

      <spotLight
        ref={spotRef}
        color="#cffff8"
        intensity={spot}
        distance={23}
        angle={0.3}
        penumbra={0.94}
        position={[0, 7.2, -3.7]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      <pointLight
        color="#7fffee"
        intensity={crystalArea}
        distance={7.2}
        position={[0, 0.75, -5.75]}
      />

      <pointLight
        color="#34ffe1"
        intensity={leftFill}
        distance={9}
        position={[-4.4, 1.15, -3.8]}
      />

      <pointLight
        color="#3de6ff"
        intensity={rightFill}
        distance={8}
        position={[4.2, 1.2, -4.4]}
      />

      <pointLight
        color="#2affdc"
        intensity={backRim}
        distance={11}
        position={[0, 1.6, -10.2]}
      />

      <pointLight
        color="#8b62ff"
        intensity={purpleAccent}
        distance={7.6}
        position={[3.6, 1.15, -5.1]}
      />

      <pointLight
        color="#0d3f38"
        intensity={frontWater}
        distance={12}
        position={[0, 1.15, 1.8]}
      />

      <pointLight
        color="#bffff7"
        intensity={overheadMist}
        distance={11}
        position={[0, 3.1, -5.6]}
      />

      <pointLight
        color="#ffd8a6"
        intensity={warmStone}
        distance={4.5}
        position={[-1.15, 0.38, -5.1]}
      />
    </>
  );
}



/* -------------------------------------------------------------------------- */
/*                         GLB ARCH PORTAL / MODEL VERSION                     */
/* -------------------------------------------------------------------------- */

function ArchPortalEnergyMaterial({ activeMode = CRYSTAL_MODES[0], opacityBoost = 1, edgeBoost = 1, coreDarkness = 0.72, portalColor = '#63fff0', portalDeepColor = '#041f24', portalHighlightColor = '#a9fff8' }) {
  return useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uEnter: { value: 0 },
        uOpacityBoost: { value: opacityBoost },
        uEdgeBoost: { value: edgeBoost },
        uCoreDarkness: { value: coreDarkness },
        uColorA: { value: new THREE.Color(portalColor) },
        uColorB: { value: new THREE.Color(portalDeepColor) },
        uColorC: { value: new THREE.Color(portalHighlightColor) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uReveal;
        uniform float uEnter;
        uniform float uOpacityBoost;
        uniform float uEdgeBoost;
        uniform float uCoreDarkness;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.04;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv;
          vec2 c = uv - 0.5;

          // Tall arched/oval mask that fits inside a real stone arch.
          float oval = length(vec2(c.x * 1.08, c.y * 0.64));
          float body = 1.0 - smoothstep(0.39, 0.535, oval);
          float rim = smoothstep(0.37, 0.455, oval) * (1.0 - smoothstep(0.49, 0.56, oval));
          float inner = 1.0 - smoothstep(0.02, 0.50, oval);

          float verticalFade = smoothstep(0.015, 0.12, uv.y) * (1.0 - smoothstep(0.93, 1.0, uv.y));
          float sideFade = smoothstep(0.02, 0.12, uv.x) * (1.0 - smoothstep(0.88, 0.98, uv.x));
          float mask = body * verticalFade * sideFade;

          vec2 flowUv = c;
          flowUv.x += sin(uTime * 0.13 + c.y * 5.0) * 0.028;
          flowUv.y += cos(uTime * 0.10 + c.x * 4.8) * 0.018;

          float mist = fbm(flowUv * vec2(4.8, 8.0) + vec2(uTime * 0.045, -uTime * 0.085));
          float fine = fbm(flowUv * vec2(15.0, 22.0) + vec2(-uTime * 0.12, uTime * 0.065));
          float verticalWave = 0.5 + 0.5 * sin(c.y * 28.0 - uTime * 2.0 + mist * 4.5);
          float depth = 1.0 - smoothstep(0.04, 0.57, oval);

          vec3 deep = mix(uColorB, vec3(0.0, 0.045, 0.05), uCoreDarkness);
          vec3 cyan = mix(uColorA, uColorC, 0.34);

          vec3 color = mix(deep, cyan, mist * 0.34 + fine * 0.13 + depth * 0.18);
          color += cyan * rim * (0.56 + verticalWave * 0.48) * uEdgeBoost;
          color += vec3(0.0, 0.24, 0.28) * depth * (0.16 + uEnter * 0.13);

          // As the camera enters, make the center deeper rather than turning into a flat blue screen.
          color = mix(color, deep, uEnter * depth * 0.20);

          float alpha = mask * (0.28 + mist * 0.30 + fine * 0.12 + depth * 0.08);
          alpha += rim * (0.46 + verticalWave * 0.22) * uEdgeBoost;
          alpha *= smoothstep(0.01, 0.52, uReveal);
          alpha *= (1.0 + uEnter * 0.08) * uOpacityBoost;
          alpha = clamp(alpha, 0.0, 0.78);

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);
}

function PortalEnergySurface({
  reveal = 0,
  enter = 0,
  activeMode = CRYSTAL_MODES[0],
  x = 0,
  width = 1.1,
  height = 1.76,
  y = 1.16,
  z = 0.045,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  opacityBoost = 1,
  edgeBoost = 1,
  coreDarkness = 0.72,
  portalColor = '#63fff0',
  portalDeepColor = '#041f24',
  portalHighlightColor = '#a9fff8',
}) {
  const mesh = useRef();
  const material = ArchPortalEnergyMaterial({ activeMode, opacityBoost, edgeBoost, coreDarkness, portalColor, portalDeepColor, portalHighlightColor });

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    material.uniforms.uReveal.value = reveal;
    material.uniforms.uEnter.value = enter;
    material.uniforms.uOpacityBoost.value = opacityBoost;
    material.uniforms.uEdgeBoost.value = edgeBoost;
    material.uniforms.uCoreDarkness.value = coreDarkness;
    material.uniforms.uColorA.value.set(portalColor);
    material.uniforms.uColorB.value.set(portalDeepColor);
    material.uniforms.uColorC.value.set(portalHighlightColor);

    if (mesh.current) {
      mesh.current.visible = reveal > 0.012;
      mesh.current.position.set(x, y, z);
      mesh.current.scale.set(width * (1 + reveal * 0.008), height * (1 + reveal * 0.008), 1);
      mesh.current.rotation.set(rotX, rotY, rotZ + Math.sin(t * 0.16) * 0.003);
    }
  });

  return (
    <mesh ref={mesh} renderOrder={52} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1, 96, 140]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function PortalInnerMist({
  reveal = 0,
  enter = 0,
  activeMode = CRYSTAL_MODES[0],
  x = 0,
  width = 0.82,
  height = 1.38,
  y = 1.16,
  z = 0.06,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  opacity = 0.36,
  mistColor = '#7fffee',
}) {
  const points = useRef();

  const geometry = useMemo(() => {
    const count = 560;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      positions[i3 + 0] = Math.cos(a) * r * 0.42;
      positions[i3 + 1] = (Math.random() - 0.5) * 1.28;
      positions[i3 + 2] = (Math.random() - 0.5) * 0.10;
      seeds[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uEnter: { value: 0 },
        uOpacity: { value: opacity },
        uColor: { value: new THREE.Color(mistColor) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uReveal;
        uniform float uEnter;
        attribute float aSeed;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * (0.16 + aSeed * 0.23) + aSeed * 16.0) * 0.045;
          p.x += sin(uTime * (0.22 + aSeed * 0.12) + p.y * 4.0) * 0.018;
          p.z += uEnter * (0.08 + aSeed * 0.11);
          float vertical = 1.0 - smoothstep(0.48, 0.78, abs(p.y));
          vAlpha = vertical * uReveal * (0.20 + aSeed * 0.44);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.4 + aSeed * 3.4) * uReveal * (250.0 / max(-mvPosition.z, 0.001));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float dotShape = smoothstep(0.5, 0.05, d);
          float alpha = dotShape * vAlpha * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uReveal.value = reveal;
    material.uniforms.uEnter.value = enter;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uColor.value.set(mistColor);

    if (points.current) {
      points.current.visible = reveal > 0.03;
      points.current.position.set(x, y, z);
      points.current.scale.set(width, height, 1);
      points.current.rotation.set(rotX, rotY, rotZ + Math.sin(state.clock.elapsedTime * 0.13) * 0.03);
    }
  });

  return <points ref={points} geometry={geometry} material={material} renderOrder={53} frustumCulled={false} visible={false} />;
}

function PortalArchModel({ progress = 0, activeMode = CRYSTAL_MODES[0] }) {
  const group = useRef();
  const archObject = useRef();
  const archLight = useRef();
  const coreLight = useRef();

  // IMPORTANT: keep useControls before useGLTF and never call it conditionally.
  // useGLTF may suspend while the model is loading; putting all Leva hooks first
  // prevents React Fast Refresh / Suspense hook-order mismatches.
  const portalControls = useControls('GLB PORTAL / MODEL + TRANSITION', {
    enabled: true,
    // Whole portal placement in the cistern world.
    modelX: { value: 0, min: -4, max: 4, step: 0.01 },
    modelY: { value: -0.18, min: -2, max: 4, step: 0.01 },
    modelZ: { value: -8.35, min: -14, max: -4, step: 0.01 },

    // Only the GLB arch rotates/scales here. The blue portal surface has separate controls below.
    modelScale: { value: 1.0, min: 0.05, max: 4, step: 0.01 },
    modelScaleX: { value: 1.0, min: 0.1, max: 3, step: 0.01 },
    modelScaleY: { value: 1.0, min: 0.1, max: 3, step: 0.01 },
    modelScaleZ: { value: 1.0, min: 0.1, max: 3, step: 0.01 },
    modelOffsetX: { value: 0, min: -3, max: 3, step: 0.01 },
    modelOffsetY: { value: 0, min: -3, max: 3, step: 0.01 },
    modelOffsetZ: { value: 0, min: -3, max: 3, step: 0.01 },
    modelRotX: { value: 0, min: -3.1416, max: 3.1416, step: 0.005 },
    modelRotY: { value: 1.5708, min: -3.1416, max: 3.1416, step: 0.005 },
    modelRotZ: { value: 0, min: -3.1416, max: 3.1416, step: 0.005 },

    // Portal timing inside portalProgress.
    revealStart: { value: 0.16, min: 0, max: 0.85, step: 0.005 },
    revealEnd: { value: 0.50, min: 0.05, max: 1, step: 0.005 },
    enterStart: { value: 0.64, min: 0, max: 0.95, step: 0.005 },
    enterEnd: { value: 1.0, min: 0.05, max: 1, step: 0.005 },

    archDarken: { value: 0.58, min: 0.15, max: 1.4, step: 0.01 },
    archOpacity: { value: 1, min: 0, max: 1, step: 0.01 },

    // Blue portal surface placement, independent of the model.
    surfaceX: { value: 0, min: -2, max: 2, step: 0.01 },
    surfaceY: { value: 1.32, min: -1, max: 4, step: 0.01 },
    surfaceZ: { value: 0.035, min: -1.5, max: 1.5, step: 0.005 },
    surfaceRotX: { value: 0, min: -3.1416, max: 3.1416, step: 0.005 },
    surfaceRotY: { value: 0, min: -3.1416, max: 3.1416, step: 0.005 },
    surfaceRotZ: { value: 0, min: -3.1416, max: 3.1416, step: 0.005 },
    surfaceWidth: { value: 0.92, min: 0.1, max: 4, step: 0.01 },
    surfaceHeight: { value: 1.62, min: 0.1, max: 5, step: 0.01 },

    portalColor: '#63fff0',
    portalDeepColor: '#031d22',
    portalHighlightColor: '#b8fff8',
    surfaceOpacity: { value: 0.62, min: 0, max: 2, step: 0.01 },
    edgeBoost: { value: 0.42, min: 0, max: 3, step: 0.01 },
    coreDarkness: { value: 0.72, min: 0, max: 1, step: 0.01 },
    mistOpacity: { value: 0.12, min: 0, max: 1.5, step: 0.01 },
    portalLight: { value: 0.72, min: 0, max: 8, step: 0.05 },
    archLight: { value: 0.38, min: 0, max: 6, step: 0.05 },
  });

  const { scene } = useGLTF(PORTAL_ARCH_PATH);

  const reveal = portalControls.enabled
    ? smooth01(range01(progress, portalControls.revealStart, portalControls.revealEnd))
    : 0;
  const enter = portalControls.enabled
    ? smooth01(range01(progress, portalControls.enterStart, portalControls.enterEnd))
    : 0;

  const arch = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const original = Array.isArray(child.material) ? child.material[0] : child.material;
      const baseColor = original?.color?.isColor
        ? original.color.clone()
        : new THREE.Color('#b8b3aa');

      child.userData.__portalBaseColor = baseColor.clone();
      child.material = new THREE.MeshStandardMaterial({
        map: original?.map || null,
        normalMap: original?.normalMap || null,
        roughness: 0.86,
        metalness: 0.02,
        color: baseColor.clone(),
        envMapIntensity: 0.16,
        transparent: true,
        opacity: 0,
      });
    });
    // Normalize unpredictable downloaded GLB dimensions: center it on X/Z and set bottom to Y=0.
    // The model is then controlled by the Design Mode sliders above.
    copy.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(copy);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const fit = size.y > 0.0001 ? 2.65 / size.y : 1;
    copy.scale.setScalar(fit);
    copy.position.set(-center.x * fit, -box.min.y * fit, -center.z * fit);

    return copy;
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;

    group.current.visible = portalControls.enabled && reveal > 0.012;
    // The parent group is the portal center. Keep it stable; do not use it for model orientation.
    group.current.position.set(portalControls.modelX, portalControls.modelY, portalControls.modelZ);
    group.current.rotation.set(0, 0, 0);
    group.current.scale.setScalar(1);

    if (archObject.current) {
      archObject.current.position.set(portalControls.modelOffsetX, portalControls.modelOffsetY, portalControls.modelOffsetZ);
      archObject.current.rotation.set(
        portalControls.modelRotX + Math.sin(t * 0.07) * 0.002 * (1 - enter),
        portalControls.modelRotY + Math.sin(t * 0.08) * 0.004 * (1 - enter),
        portalControls.modelRotZ
      );
      archObject.current.scale.set(
        portalControls.modelScale * portalControls.modelScaleX,
        portalControls.modelScale * portalControls.modelScaleY,
        portalControls.modelScale * portalControls.modelScaleZ
      );
    }

    group.current.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (!material) return;

      material.transparent = true;
      material.opacity = reveal * portalControls.archOpacity;

      if (material.color?.isColor) {
        if (!child.userData.__portalBaseColor) {
          child.userData.__portalBaseColor = material.color.clone();
        }

        material.color
          .copy(child.userData.__portalBaseColor)
          .multiplyScalar(portalControls.archDarken);
      }
    });

    if (archLight.current) {
      archLight.current.color.set(portalControls.portalColor);
      archLight.current.intensity = reveal * portalControls.archLight;
    }

    if (coreLight.current) {
      coreLight.current.color.set(portalControls.portalColor);
      coreLight.current.intensity = reveal * portalControls.portalLight + enter * portalControls.portalLight * 0.35;
    }
  });

  return (
    <group ref={group} visible={false} renderOrder={50}>
      <group ref={archObject}>
        <primitive object={arch} />
      </group>
      <PortalEnergySurface
        reveal={reveal}
        enter={enter}
        activeMode={activeMode}
        x={portalControls.surfaceX}
        width={portalControls.surfaceWidth}
        height={portalControls.surfaceHeight}
        y={portalControls.surfaceY}
        z={portalControls.surfaceZ}
        rotX={portalControls.surfaceRotX}
        rotY={portalControls.surfaceRotY}
        rotZ={portalControls.surfaceRotZ}
        opacityBoost={portalControls.surfaceOpacity}
        edgeBoost={portalControls.edgeBoost}
        coreDarkness={portalControls.coreDarkness}
        portalColor={portalControls.portalColor}
        portalDeepColor={portalControls.portalDeepColor}
        portalHighlightColor={portalControls.portalHighlightColor}
      />
      <PortalInnerMist
        reveal={reveal}
        enter={enter}
        activeMode={activeMode}
        x={portalControls.surfaceX}
        width={portalControls.surfaceWidth * 0.78}
        height={portalControls.surfaceHeight * 0.82}
        y={portalControls.surfaceY}
        z={portalControls.surfaceZ + 0.04}
        rotX={portalControls.surfaceRotX}
        rotY={portalControls.surfaceRotY}
        rotZ={portalControls.surfaceRotZ}
        opacity={portalControls.mistOpacity}
        mistColor={portalControls.portalHighlightColor}
      />
      <pointLight ref={archLight} position={[0, portalControls.surfaceY, 0.45]} color="#63fff0" intensity={0} distance={4.4} decay={2} />
      <pointLight ref={coreLight} position={[0, portalControls.surfaceY, -0.15]} color="#63fff0" intensity={0} distance={5.4} decay={2} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/*                         WEBGL PORTAL DISTORTION PASS                        */
/* -------------------------------------------------------------------------- */


function PortalDistortion({ portalProgress = 0, mapProgress = 0 }) {
  const { pointer } = useThree();
  const lastPointer = useRef(new THREE.Vector2(0, 0));
  const velocity = useRef(0);

  const effect = useMemo(() => {
    const uniforms = new Map([
      ['uTime', { value: 0 }],
      ['uProgress', { value: 0 }],
      ['uReveal', { value: 0 }],
      ['uEnter', { value: 0 }],
      ['uMouse', { value: new THREE.Vector2(0.5, 0.5) }],
      ['uMouseStrength', { value: 0 }],
    ]);

    return new Effect(
      'PortalDistortion',
      `
      uniform float uTime;
      uniform float uProgress;
      uniform float uReveal;
      uniform float uEnter;
      uniform vec2 uMouse;
      uniform float uMouseStrength;

      void mainUv(inout vec2 uv) {
        vec2 center = uv - vec2(0.5);
        float d = length(center);
        float portal = smoothstep(0.02, 1.0, uProgress);
        float ring = 1.0 - smoothstep(0.0, 0.42, abs(d - mix(0.30, 0.12, uEnter)));
        float swirl = sin(d * mix(18.0, 34.0, uEnter) - uTime * 1.55 + atan(center.y, center.x) * 3.5);
        vec2 tangent = vec2(-center.y, center.x);
        vec2 mouseDelta = uv - uMouse;
        float mouseField = (1.0 - smoothstep(0.0, 0.38, length(mouseDelta))) * uMouseStrength;

        // Mild lens pull only. No blue fullscreen wash.
        uv += normalize(center + 0.0001) * swirl * (0.0025 + uEnter * 0.008) * portal * (0.18 + ring * 0.55);
        uv += tangent * (0.002 + uEnter * 0.006) * portal * ring;
        uv += normalize(mouseDelta + 0.0001) * mouseField * (0.004 + uReveal * 0.004);
      }

      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 center = uv - vec2(0.5);
        float d = length(center);
        float revealGlow = (1.0 - smoothstep(0.12, 0.72, d)) * uReveal;
        vec3 color = inputColor.rgb;
        color += vec3(0.0, 0.04, 0.045) * revealGlow;
        outputColor = vec4(color, inputColor.a);
      }
      `,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms,
      }
    );
  }, []);

  useEffect(() => {
    return () => effect.dispose?.();
  }, [effect]);

  useFrame((state) => {
    const p = clamp01(portalProgress);
    const reveal = smooth01(range01(p, 0.06, 0.34));
    const enter = smooth01(range01(p, 0.42, 1.0));

    const current = new THREE.Vector2((pointer.x + 1) * 0.5, (pointer.y + 1) * 0.5);
    const delta = current.distanceTo(lastPointer.current);
    velocity.current = THREE.MathUtils.lerp(velocity.current, delta * 7.0, 0.14);
    lastPointer.current.copy(current);

    effect.uniforms.get('uTime').value = state.clock.elapsedTime;
    effect.uniforms.get('uProgress').value = p * (1.0 - clamp01(mapProgress) * 0.7);
    effect.uniforms.get('uReveal').value = reveal;
    effect.uniforms.get('uEnter').value = enter;
    effect.uniforms.get('uMouse').value.copy(current);
    effect.uniforms.get('uMouseStrength').value = Math.min(0.7, velocity.current) * (0.15 + reveal * 0.25) * (1.0 - enter * 0.75);
  });

  return <primitive object={effect} />;
}

/* -------------------------------------------------------------------------- */
/*                         CLICK WATER RIPPLE FROM CRYSTAL                     */
/* -------------------------------------------------------------------------- */

function CrystalClickWaterRipple({
  activeMode = CRYSTAL_MODES[0],
  modePulseKey = 0,
}) {
  const softDisc = useRef();
  const ringA = useRef();
  const ringB = useRef();
  const ringC = useRef();
  const startTimeRef = useRef(-999);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (modePulseKey <= 0) return;
    pendingRef.current = true;
  }, [modePulseKey]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (pendingRef.current) {
      pendingRef.current = false;
      startTimeRef.current = t;
    }

    const age = t - startTimeRef.current;
    const duration = 2.35;
    const alive = age >= 0 && age < duration;
    const baseColor = activeMode?.color || "#7fffee";
    const accentColor = activeMode?.particleB || "#dffffa";

    const updateRing = (mesh, delay, startScale, endScale, opacity, color, spin = 0) => {
      if (!mesh) return;
      const localAge = age - delay;
      const visible = alive && localAge >= 0;
      const progress = THREE.MathUtils.clamp(localAge / 1.85, 0, 1);
      const eased = 1.0 - Math.pow(1.0 - progress, 2.3);
      const fade = Math.pow(1.0 - progress, 1.8);
      mesh.visible = visible;
      mesh.scale.setScalar(THREE.MathUtils.lerp(startScale, endScale, eased));
      mesh.material.color.set(color);
      mesh.material.opacity = visible ? opacity * fade : 0;
      mesh.rotation.z = spin === 0 ? 0 : t * spin;
    };

    updateRing(ringA.current, 0.0, 0.72, 2.95, 0.20, baseColor, 0.05);
    updateRing(ringB.current, 0.16, 0.62, 3.55, 0.12, accentColor, -0.045);
    updateRing(ringC.current, 0.34, 0.54, 4.15, 0.08, baseColor, 0.025);

    if (softDisc.current) {
      const progress = THREE.MathUtils.clamp(age / 1.45, 0, 1);
      const eased = 1.0 - Math.pow(1.0 - progress, 2.0);
      const fade = alive ? Math.pow(1.0 - progress, 1.95) : 0;
      softDisc.current.visible = alive;
      softDisc.current.material.color.set(baseColor);
      softDisc.current.material.opacity = 0.055 * fade;
      softDisc.current.scale.setScalar(THREE.MathUtils.lerp(0.75, 2.35, eased));
    }
  });

  return (
    <group position={[0, -0.238, -5.65]} renderOrder={1200}>
      <mesh ref={softDisc} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[1.0, 128]} />
        <meshBasicMaterial
          color={activeMode?.color || "#7fffee"}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={ringA} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.58, 0.602, 160]} />
        <meshBasicMaterial
          color={activeMode?.color || "#7fffee"}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={ringB} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.46, 0.478, 160]} />
        <meshBasicMaterial
          color={activeMode?.particleB || "#dffffa"}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={ringC} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.34, 0.352, 160]} />
        <meshBasicMaterial
          color={activeMode?.color || "#7fffee"}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}



function PortalFogTunnel({ scrollProgress = 0, portalProgress = 0, activeMode = CRYSTAL_MODES[0] }) {
  const mesh = useRef();
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uFog: { value: 0 },
        uPortal: { value: 0 },
        uColor: { value: new THREE.Color(activeMode?.color || '#7fffee') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uFog;
        uniform float uPortal;
        uniform vec3 uColor;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i); float b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0)); float d = hash(i + vec2(1.0,1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for(int i=0;i<4;i++){ v += a*noise(p); p*=2.0; a*=0.5; }
          return v;
        }
        void main() {
          vec2 uv = vUv;
          float d = distance(uv, vec2(0.5));
          float n = fbm(uv * 5.0 + vec2(uTime * 0.028, -uTime * 0.04));
          float tunnel = 1.0 - smoothstep(0.06, 0.70, d);
          float edge = smoothstep(0.0, 0.22, uv.x) * (1.0 - smoothstep(0.78, 1.0, uv.x));
          edge *= smoothstep(0.0, 0.20, uv.y) * (1.0 - smoothstep(0.80, 1.0, uv.y));
          vec3 col = mix(vec3(0.004, 0.017, 0.018), uColor, tunnel * 0.035 + uPortal * 0.018);
          float alpha = (n * 0.075 + tunnel * 0.045) * uFog * edge;
          alpha += tunnel * uPortal * 0.003;
          alpha = clamp(alpha, 0.0, 0.075);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const { fogEnter } = portalPhases(scrollProgress, portalProgress);
    const enter = smooth01(range01(portalProgress, 0.42, 1.0));
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uFog.value = fogEnter * 0.46;
    material.uniforms.uPortal.value = enter;
    material.uniforms.uColor.value.set(activeMode?.color || '#7fffee');

    if (mesh.current) {
      mesh.current.visible = fogEnter > 0.02 || portalProgress > 0.04;
      mesh.current.scale.setScalar(1.0 + enter * 0.04);
    }
  });

  return (
    <mesh ref={mesh} position={[0, 1.08, -6.05]} renderOrder={22} frustumCulled={false} visible={false}>
      <planeGeometry args={[7.2, 4.2, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  SCENE                                     */
/* -------------------------------------------------------------------------- */

function SceneContent({
  fogNear,
  fogFar,
  activeMode,
  onCrystalModeChange,
  modePulseKey,
  scrollProgress,
  portalProgress,
  mapProgress,
  perf,
}) {
  return (
    <>
      <color attach="background" args={["#020b0a"]} />
      <fog attach="fog" args={["#020b0a", fogNear, fogFar]} />

      <Lighting />

      <CustomReflectiveGPGPUWater />
      <CrystalClickWaterRipple activeMode={activeMode} modePulseKey={modePulseKey} />
      <WaterEdgeDarkness />
      <CrystalWaterGlow activeMode={activeMode} />

      <ColumnHall />
      <Ceiling />
      <SuspendedCables />
      <BrokenForegroundStones />
      <CrystalBackFog portalProgress={portalProgress} activeMode={activeMode} />
      <PortalFogTunnel scrollProgress={scrollProgress} portalProgress={portalProgress} activeMode={activeMode} />

      <PortalArchModel progress={portalProgress} activeMode={activeMode} />

      <CrystalPedestal />

      {perf?.contactShadows && (
        <ContactShadows
          position={[0, -0.19, -5.75]}
          opacity={0.28}
          scale={3.4}
          blur={2.4}
          far={2.2}
          resolution={512}
          color="#000000"
        />
      )}

      <EnergyCracks />
      <CrystalCore activeMode={activeMode} onModeChange={onCrystalModeChange} />
      <CrystalParticleCloud activeMode={activeMode} modePulseKey={modePulseKey} />

      {perf?.sparkles && (
        <Sparkles
          count={perf?.sparkleCount ?? 48}
          scale={[12, 5.4, 12]}
          size={0.34}
          speed={0.045}
          color={activeMode?.color || "#9ffff4"}
          opacity={0.09}
          position={[0, 2.2, -5.4]}
        />
      )}

      <Environment preset="night" />
    </>
  );
}

export default function CisternSceneLab({
  scrollProgress = 0,
  visibleProgress = 1,
  portalProgress = 0,
  mapProgress = 0,
  designMode = false,
  showStory = true,
  showLabel = true,
  showLeva = false,
} = {}) {
  const mobile = (typeof window !== "undefined" && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")));

  const { autoCamera, exposure, bloom, vignette, fogNear, fogFar, dprMax } =
    useControls("Scene", {
      autoCamera: true,
      exposure: { value: 1.18, min: 0.1, max: 2.4, step: 0.01 },
      bloom: { value: mobile ? 0.22 : 0.27, min: 0, max: 2, step: 0.01 },
      vignette: { value: 0.48, min: 0, max: 1, step: 0.01 },
      fogNear: { value: 8.4, min: 0, max: 25, step: 0.1 },
      fogFar: { value: 38, min: 5, max: 90, step: 0.5 },
      dprMax: { value: mobile ? 0.88 : 1.05, min: 0.65, max: 1.3, step: 0.05 },
    });

  const storyControls = useControls("Story", {
    showStoryControl: true,
  });

  const perf = useControls("CISTERN / PERFORMANCE", {
    postprocessing: { value: true },
    portalDistortion: { value: false },
    contactShadows: { value: false },
    sparkles: { value: true },
    sparkleCount: { value: mobile ? 1 : 4, min: 0, max: 32, step: 1 },
    frameloopAlways: { value: true },
    lowPowerDpr: { value: mobile ? 0.72 : 0.84, min: 0.60, max: 1.0, step: 0.05 },
  });

  const [activeModeIndex, setActiveModeIndex] = useState(0);
  const [modePulseKey, setModePulseKey] = useState(0);
  const [storyPanelOpen, setStoryPanelOpen] = useState(false);

  const activeMode = CRYSTAL_MODES[activeModeIndex] || CRYSTAL_MODES[0];

  const handleCrystalModeChange = () => {
    setActiveModeIndex((prev) => (prev + 1) % CRYSTAL_MODES.length);
    setModePulseKey((prev) => prev + 1);
    setStoryPanelOpen(true);
  };

  // Panel now opens from the crystal click itself.
  // This avoids depending on App.jsx showStory flags while keeping Leva control.
  const storyVisible = storyControls.showStoryControl && storyPanelOpen && mapProgress < 0.52;
  const labOpacity = THREE.MathUtils.clamp(visibleProgress, 0, 1);
  const rootRef = useRef(null);

  return (
    <div
      ref={rootRef}
      className="cisternSceneLab"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#020b0a",
        opacity: labOpacity,
        pointerEvents: mapProgress < 0.52 ? "auto" : "none",
        isolation: "isolate",
        touchAction: "none",
        zIndex: 1,
      }}
    >
      <Leva hidden={!(designMode && showLeva)} collapsed oneLineLabels={false} />

      <Canvas
        shadows={perf.contactShadows}
        dpr={[0.62, Math.min(dprMax, perf.lowPowerDpr, mobile ? 0.72 : 0.84)]}
        eventSource={rootRef}
        eventPrefix="client"
        onCreated={(state) => {
          state.events.connect(rootRef.current || state.gl.domElement);
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
          touchAction: "none",
        }}
        camera={{
          position: [-0.3, 0.88, 4.6],
          fov: 44,
          near: 0.1,
          far: 80,
        }}
        frameloop={labOpacity > 0.025 && mapProgress < 0.55 ? "always" : "demand"}
        performance={{ min: mobile ? 0.26 : 0.36 }}
        gl={{
          antialias: false,
          stencil: false,
          depth: true,
          alpha: false,
          powerPreference: "high-performance",
          precision: "mediump",
        }}
      >
        <Suspense fallback={<color attach="background" args={["#020b0a"]} />}>
          <RendererSettings exposure={exposure} />
          <SceneWarmup enabled={visibleProgress > 0.02} />

          <SceneContent
            fogNear={fogNear}
            fogFar={fogFar}
            activeMode={activeMode}
            onCrystalModeChange={handleCrystalModeChange}
            modePulseKey={modePulseKey}
            scrollProgress={scrollProgress}
            portalProgress={portalProgress}
            mapProgress={mapProgress}
            perf={perf}
          />

          <CinematicCamera enabled={autoCamera} scrollProgress={scrollProgress} portalProgress={portalProgress} />

          <OrbitControls
            enabled={!autoCamera && labOpacity > 0.2}
            enablePan={false}
            enableZoom
            enableRotate
            minDistance={2.8}
            maxDistance={9}
            target={[0, 0.55, -5.75]}
          />

          {perf.postprocessing && (
            <EffectComposer multisampling={0}>
              {perf.portalDistortion && <PortalDistortion portalProgress={portalProgress} mapProgress={mapProgress} />}
              <Bloom
                intensity={bloom}
                luminanceThreshold={0.42}
                luminanceSmoothing={0.78}
                mipmapBlur
              />
              <Vignette eskil={false} offset={0.32} darkness={vignette} />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>

      {storyVisible && <StoryOverlay activeMode={activeMode} modePulseKey={modePulseKey} onAnalyze={handleCrystalModeChange} />}

      {scrollProgress > 0.035 && scrollProgress < 0.70 && mapProgress < 0.22 && (
        <div
          className="crystalAnalyzePrompt"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "9vh",
            transform: "translateX(-50%)",
            zIndex: 24,
            pointerEvents: "auto",
            padding: "10px 16px",
            borderRadius: 999,
            border: "1px solid rgba(127,255,238,0.32)",
            background: "linear-gradient(90deg, rgba(4,18,18,0.18), rgba(8,34,34,0.72), rgba(4,18,18,0.18))",
            color: "rgba(230,255,252,0.92)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 11,
            letterSpacing: "0.22em",
            textShadow: "0 0 18px rgba(127,255,238,0.55)",
            boxShadow: "0 0 32px rgba(99,255,240,0.16)",
            cursor: "pointer",
            userSelect: "none",
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            handleCrystalModeChange();
          }}
        >
          <i />CLICK THE CRYSTAL TO ANALYZE
        </div>
      )}

      {showLabel && (
      <div
        className="cisternLabLabel"
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          textAlign: "right",
          zIndex: 21,
          pointerEvents: "none",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          color: "#dffffb",
          textShadow: "0 2px 18px rgba(0,0,0,0.8)",
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: 12,
            letterSpacing: "0.38em",
            color: "#7fffee",
            marginBottom: 8,
          }}
        >
          CRYSTALLINE NETWORK
        </span>
        <b
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            color: "rgba(223,255,251,0.72)",
          }}
        >
          {activeMode.label} / {activeMode.role}
        </b>
      </div>
      )}
    </div>
  );
}

useGLTF.preload(`${MODEL_BASE}/hero_crystal.glb`);
useGLTF.preload(PORTAL_ARCH_PATH);
