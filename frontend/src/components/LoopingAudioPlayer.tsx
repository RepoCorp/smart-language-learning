import { useEffect, useRef, useState } from "react";

const BAR_DURATION_SECONDS = 2;

export default function LoopingAudioPlayer({ src }: { src: string }): JSX.Element {
  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const timerRef = useRef<number | null>(null);
  const playbackIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");

  const stop = () => {
    playbackIdRef.current += 1;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    sourceNodesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source may already have ended while the user presses Stop.
      }
    });
    sourceNodesRef.current = [];
    setIsPlaying(false);
  };

  useEffect(() => {
    bufferRef.current = null;
    return () => {
      playbackIdRef.current += 1;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      sourceNodesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch {
          // The node may have naturally completed before React cleans up.
        }
      });
      sourceNodesRef.current = [];
    };
  }, [src]);

  const play = async () => {
    setError("");
    setIsLoading(true);
    try {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      await context.resume();
      if (!bufferRef.current) {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Could not load song audio");
        bufferRef.current = await context.decodeAudioData(await response.arrayBuffer());
      }
      const buffer = bufferRef.current;
      // At 120 BPM in 4/4, a bar is two seconds. Shorten the repeated cycle only
      // by the fractional remainder so each repeat begins on the next full bar.
      const endFade = buffer.duration % BAR_DURATION_SECONDS;
      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;

      const scheduleCycle = (startAt: number, fadeIn: boolean) => {
        if (playbackIdRef.current !== playbackId) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.connect(gain).connect(context.destination);
        if (fadeIn) {
          gain.gain.setValueAtTime(0, startAt);
          gain.gain.linearRampToValueAtTime(1, startAt + endFade);
        } else {
          gain.gain.setValueAtTime(1, startAt);
        }
        gain.gain.setValueAtTime(1, startAt + buffer.duration - endFade);
        gain.gain.linearRampToValueAtTime(0, startAt + buffer.duration);
        source.start(startAt);
        source.stop(startAt + buffer.duration);
        sourceNodesRef.current = [...sourceNodesRef.current, source];
        source.onended = () => {
          sourceNodesRef.current = sourceNodesRef.current.filter((node) => node !== source);
        };
        const nextStart = startAt + buffer.duration - endFade;
        timerRef.current = window.setTimeout(
          () => scheduleCycle(nextStart, true),
          Math.max(0, (nextStart - context.currentTime - 0.05) * 1000),
        );
      };

      scheduleCycle(context.currentTime + 0.05, false);
      setIsPlaying(true);
    } catch (playbackError) {
      setError(playbackError instanceof Error ? playbackError.message : "Could not play song audio");
      stop();
    } finally {
      setIsLoading(false);
    }
  };

  return <div className="looping-audio-player">
    <button className="secondary-button" type="button" disabled={isLoading} onClick={isPlaying ? stop : play}>
      {isLoading ? "Loading song..." : isPlaying ? "Stop loop" : "Play loop"}
    </button>
    {error ? <span className="error">{error}</span> : <span className="hint">Normal start, beat-aligned repeats</span>}
  </div>;
}
