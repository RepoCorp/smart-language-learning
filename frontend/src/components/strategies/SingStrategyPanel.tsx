import type { SingSong } from "./useSingStrategy";
import DangerousButton from "../DangerousButton";
import LoopingAudioPlayer from "../LoopingAudioPlayer";

export default function SingStrategyPanel({ song, history, itemType, isCreatingLyrics, isCreatingSong, isGeneratingImage, isRetrying, error, onCreateLyrics, onCreateSong, onGenerateImage, onRetrySameSong }: {
  song: SingSong | null; isCreatingLyrics: boolean; isCreatingSong: boolean; isGeneratingImage: boolean; isRetrying: boolean; error: string;
  history: SingSong[];
  itemType: "word" | "phrase"; onCreateLyrics: () => void; onCreateSong: () => void; onGenerateImage: () => void; onRetrySameSong: () => void;
}): JSX.Element {
  return (
    <div className="word-strategies-placeholder-card">
      {song ? <>
        <p className="dialog-turn-target-text"><strong>{song.target}</strong></p>
        <p className="dialog-turn-source-text">{song.source}</p>
        {song.durationSeconds > 0 ? <p className="hint sing-strategy-duration">Generated duration: {song.durationSeconds.toFixed(1)}s</p> : null}
        {song.imageUrl ? <img className="sing-strategy-image" src={song.imageUrl} alt={song.target} /> : null}
      </> : <p className="hint">Create lyrics for a short catchy song about this {itemType}.</p>}
      {error ? <p className="error">{error}</p> : null}
      <div className="sing-strategy-controls">
        {song?.audioUrl ? <LoopingAudioPlayer src={song.audioUrl} /> : null}
        {song?.canRetry ? (
          <DangerousButton className="secondary-button dangerous-action-button" disabled={isRetrying} onConfirm={onRetrySameSong}>
            {isRetrying ? "Trying this version..." : "Try this version again"}
          </DangerousButton>
        ) : null}
        {song ? <>
          {song.canChangeLyrics ? <button className="secondary-button" type="button" disabled={isCreatingLyrics} onClick={onCreateLyrics}>
            {isCreatingLyrics ? "Creating new lyrics..." : "Try different lyrics"}
          </button> : null}
          <DangerousButton className="secondary-button dangerous-action-button" disabled={isCreatingSong} onConfirm={onCreateSong}>
            {isCreatingSong ? "Creating song..." : song.audioUrl ? "Create a new song" : "Create song"}
          </DangerousButton>
        </> : <button className="secondary-button" type="button" disabled={isCreatingLyrics} onClick={onCreateLyrics}>
          {isCreatingLyrics ? "Creating lyrics..." : "Create lyrics"}
        </button>}
      </div>
      {song?.audioUrl ? (
        <div className="sing-strategy-image-action">
          <DangerousButton className="secondary-button dangerous-action-button" disabled={isGeneratingImage} onConfirm={onGenerateImage}>
            {isGeneratingImage ? "Creating image..." : song.imageUrl ? "Create a new image" : "Create image"}
          </DangerousButton>
        </div>
      ) : null}
      {history.length ? (
        <details className="sing-strategy-history">
          <summary>Previous songs ({history.length})</summary>
          {history.slice().reverse().map((entry) => (
            <div className="sing-strategy-history-entry" key={entry.id}>
              <strong>{entry.target}</strong>
              <span>{entry.source}</span>
              <LoopingAudioPlayer src={entry.audioUrl} />
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}
