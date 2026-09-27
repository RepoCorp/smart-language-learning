import { useEffect, useRef } from "react";

export function useTypingMistakeSound(exerciseKey: string): (position: number) => void {
  const soundedPositions = useRef(new Set<number>());
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    soundedPositions.current.clear();
    return () => {
      const context = contextRef.current;
      contextRef.current = null;
      if (context) void context.close().catch(() => {});
    };
  }, [exerciseKey]);

  return (position: number): void => {
    if (soundedPositions.current.has(position)) return;
    soundedPositions.current.add(position);

    // Optional feedback must never interrupt typing or share the speech player.
    const play = async (): Promise<void> => {
      const AudioContextClass = window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = contextRef.current ?? new AudioContextClass();
      contextRef.current = context;
      if (context.state === "suspended") await context.resume();
      if (contextRef.current !== context || context.state !== "running") return;

      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.015);
      gain.gain.linearRampToValueAtTime(0, now + 0.14);
      gain.connect(context.destination);
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.setValueAtTime(330, now);
      tone.frequency.linearRampToValueAtTime(280, now + 0.14);
      tone.connect(gain);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(now);
      tone.stop(now + 0.15);
    };
    void play().catch(() => {});
  };
}
