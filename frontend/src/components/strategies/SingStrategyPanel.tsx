import type { SingSong } from "./useSingStrategy";
import { useState } from "react";
import DangerousButton from "../DangerousButton";
import LoopingAudioPlayer from "../LoopingAudioPlayer";
import { useI18n } from "../../i18n";

export default function SingStrategyPanel({ song, history, itemType, isCreatingLyrics, isCreatingSong, isGeneratingImage, error, onCreateLyrics, onCreateSong, onGenerateImage }: {
  song: SingSong | null; isCreatingLyrics: boolean; isCreatingSong: boolean; isGeneratingImage: boolean; error: string;
  history: SingSong[];
  itemType: "word" | "phrase"; onCreateLyrics: (longerFunnyLyrics: boolean) => void; onCreateSong: () => void; onGenerateImage: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const [longerFunnyLyrics, setLongerFunnyLyrics] = useState(false);
  const lyricButton = (label: string): JSX.Element => (
    <button className="secondary-button" type="button" disabled={isCreatingLyrics} onClick={() => onCreateLyrics(longerFunnyLyrics)}>
      {isCreatingLyrics ? t("sing.creatingLyrics") : label}
    </button>
  );
  return (
    <div className="word-strategies-placeholder-card">
      {song ? <>
        <p className="dialog-turn-target-text"><strong>{song.target}</strong></p>
        <p className="dialog-turn-source-text">{song.source}</p>
        {song.imageUrl ? <img className="sing-strategy-image" src={song.imageUrl} alt={song.target} /> : null}
      </> : <p className="hint">{t(itemType === "word" ? "sing.emptyWord" : "sing.emptyPhrase")}</p>}
      {error ? <p className="error">{error}</p> : null}
      <div className="sing-strategy-controls">
        {song?.audioUrl ? <LoopingAudioPlayer src={song.audioUrl} /> : null}
        {song ? <>
          {song.canChangeLyrics ? (
            <div className="sing-strategy-lyric-actions">
              <label className="sing-strategy-lyric-option">
                <input type="checkbox" checked={longerFunnyLyrics} onChange={(event) => setLongerFunnyLyrics(event.target.checked)} />
                <span>{t("sing.longerLyrics")}</span>
              </label>
              {lyricButton(t("sing.differentLyrics"))}
            </div>
          ) : null}
          <DangerousButton className="secondary-button dangerous-action-button" disabled={isCreatingSong} onConfirm={onCreateSong}>
            {t(isCreatingSong ? "sing.creatingSong" : song.audioUrl ? "sing.newSong" : "sing.createSong")}
          </DangerousButton>
        </> : (
          <div className="sing-strategy-lyric-actions">
            <label className="sing-strategy-lyric-option">
              <input type="checkbox" checked={longerFunnyLyrics} onChange={(event) => setLongerFunnyLyrics(event.target.checked)} />
              <span>{t("sing.longerLyrics")}</span>
            </label>
            {lyricButton(t("sing.createLyrics"))}
          </div>
        )}
      </div>
      {song?.audioUrl ? (
        <div className="sing-strategy-image-action">
          <DangerousButton className="secondary-button dangerous-action-button" disabled={isGeneratingImage} onConfirm={onGenerateImage}>
            {t(isGeneratingImage ? "sing.creatingImage" : song.imageUrl ? "sing.newImage" : "sing.createImage")}
          </DangerousButton>
        </div>
      ) : null}
      {history.length ? (
        <details className="sing-strategy-history">
          <summary>{t("sing.history", { count: history.length })}</summary>
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
