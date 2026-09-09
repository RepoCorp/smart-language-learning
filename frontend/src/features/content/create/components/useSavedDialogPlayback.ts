import { useEffect, useRef, useState } from "react";

export default function useSavedDialogPlayback(audioUrls: string[]) {
  const [playing, setPlaying] = useState<boolean>(false);
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const stop = (): void => {
    playbackRunRef.current += 1;
    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    setPlaying(false);
  };

  useEffect(() => () => {
    playbackRunRef.current += 1;
    activeAudioRef.current?.pause();
  }, []);

  const playAudio = (audioUrl: string, runId: number): Promise<void> => new Promise((resolve) => {
    if (runId !== playbackRunRef.current) {
      resolve();
      return;
    }
    const audio = new Audio(audioUrl);
    activeAudioRef.current = audio;
    const finish = (): void => {
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      if (activeAudioRef.current === audio) {
        activeAudioRef.current = null;
      }
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    void audio.play().catch(finish);
  });

  const play = async (): Promise<void> => {
    if (!audioUrls.length || playing) {
      return;
    }
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlaying(true);
    for (const audioUrl of audioUrls) {
      if (runId !== playbackRunRef.current) {
        break;
      }
      await playAudio(audioUrl, runId);
    }
    if (runId === playbackRunRef.current) {
      setPlaying(false);
    }
  };

  return { playing, play, stop };
}
