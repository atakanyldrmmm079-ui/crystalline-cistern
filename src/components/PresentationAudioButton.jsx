import React, { useEffect, useRef, useState } from "react";

const AUDIO_CONFIG = {
  ambientSrc: "/audio/ambient_loop.mp3",
  waterSrc: "/audio/water_loop.mp3",
  ambientVolume: 0.085,
  waterVolume: 0.028,
  waterStart: 0.18,
  waterEnd: 0.835,
  fadeSpeedAmbient: 0.035,
  fadeSpeedWater: 0.045,
};

function getScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

export default function PresentationAudioButton() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(true);
  const enabledRef = useRef(false);
  const ambientRef = useRef(null);
  const waterRef = useRef(null);
  const rafRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      [ambientRef.current, waterRef.current].forEach((audio) => {
        try {
          if (!audio) return;
          audio.pause();
          audio.src = "";
        } catch (error) {
          console.warn("Audio cleanup skipped safely:", error);
        }
      });
    };
  }, []);

  function ensureAudioElements() {
    if (!ambientRef.current) {
      const ambient = new Audio(AUDIO_CONFIG.ambientSrc);
      ambient.loop = true;
      ambient.preload = "auto";
      ambient.volume = 0;
      ambientRef.current = ambient;
    }

    if (!waterRef.current) {
      const water = new Audio(AUDIO_CONFIG.waterSrc);
      water.loop = true;
      water.preload = "auto";
      water.volume = 0;
      waterRef.current = water;
    }
  }

  function tickAudio() {
    try {
      const progress = getScrollProgress();
      const waterZone = progress >= AUDIO_CONFIG.waterStart && progress <= AUDIO_CONFIG.waterEnd;
      const ambientTarget = enabledRef.current ? AUDIO_CONFIG.ambientVolume : 0;
      const waterTarget = enabledRef.current && waterZone ? AUDIO_CONFIG.waterVolume : 0;

      if (ambientRef.current) {
        ambientRef.current.volume += (ambientTarget - ambientRef.current.volume) * AUDIO_CONFIG.fadeSpeedAmbient;
      }

      if (waterRef.current) {
        waterRef.current.volume += (waterTarget - waterRef.current.volume) * AUDIO_CONFIG.fadeSpeedWater;
      }
    } catch (error) {
      console.warn("Audio fade skipped safely:", error);
    }

    rafRef.current = requestAnimationFrame(tickAudio);
  }

  async function startAudio() {
    try {
      setReady(true);
      ensureAudioElements();

      if (!startedRef.current) {
        await Promise.all([ambientRef.current.play(), waterRef.current.play()]);
        startedRef.current = true;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tickAudio);
      }

      setEnabled(true);
    } catch (error) {
      console.warn("Audio could not start. Check public/audio files and browser autoplay rules:", error);
      setReady(false);
      setEnabled(false);
    }
  }

  function stopAudio() {
    setEnabled(false);
  }

  return (
    <button
      type="button"
      className={`soundToggle ${enabled ? "active" : ""} ${ready ? "" : "error"}`}
      onClick={() => {
        if (enabled) stopAudio();
        else startAudio();
      }}
      aria-label={enabled ? "Turn sound off" : "Turn sound on"}
      title={ready ? "Sound" : "Audio file not found or blocked"}
    >
      {ready ? (enabled ? "SOUND ON" : "SOUND OFF") : "AUDIO ERR"}
    </button>
  );
}
