import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDialogTurnPlayback, { type DialogTurnAudioMode } from "../src/features/dialogs/components/useDialogTurnPlayback";
import { generateContentDialogTurnAudio, generateContentDialogTurnClearAudio } from "../src/api";
import type { ContentDialogRecord } from "../src/types";

vi.mock("../src/api", () => ({
  generateContentDialogTurnAudio: vi.fn(),
  generateContentDialogTurnClearAudio: vi.fn(),
}));

class TestAudio extends EventTarget {
  static instances: TestAudio[] = [];
  paused = true;
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = false;
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  constructor(public src: string) { super(); TestAudio.instances.push(this); }
  end() { this.paused = true; this.dispatchEvent(new Event("ended")); }
}

const dialog: ContentDialogRecord = {
  dialog_id: 1, topic: "Shopping", context: "", proficiency_level: "A1", audio_url: "", created_at: "",
  turns: [
    { target_text: "Guten Tag!", source_text: "¡Buenos días!", phrase_audio_url: "natural-1.mp3", clear_audio_url: "clear-1.mp3" },
    { target_text: "Hallo!", source_text: "¡Hola!", phrase_audio_url: "natural-2.mp3", clear_audio_url: "clear-2.mp3" },
  ],
};

function setup(initialDialog = dialog, initialMode: DialogTurnAudioMode = "natural", initialRate = 1) {
  const setError = vi.fn();
  const focusDialogTurn = vi.fn();
  const hook = renderHook(() => {
    const [dialogs, setDialogs] = useState([initialDialog]);
    const [audioMode, setAudioMode] = useState(initialMode);
    const [clearPlaybackRate, setClearPlaybackRate] = useState(initialRate);
    const playback = useDialogTurnPlayback({
      audioMode, clearPlaybackRate,
      dialogs, setDialogs, sourceLanguage: "spanish", targetLanguage: "german", loadError: "Audio failed", setError,
      ensureDialogDetail: async (id) => dialogs.find((entry) => entry.dialog_id === id) || null,
      upsertVisibleDialog: vi.fn(), fetchAllFilteredDialogs: async () => dialogs,
      focusDialogTurn, setExpandedDialogId: vi.fn(),
    });
    return { ...playback, dialogs, setAudioMode, setClearPlaybackRate };
  });
  return { ...hook, setError, focusDialogTurn };
}

describe("dialog playback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestAudio.instances = [];
    vi.stubGlobal("Audio", TestAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("does not generate on mount and plays cached natural sentences in order", async () => {
    const { result, focusDialogTurn } = setup();
    expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
    expect(generateContentDialogTurnClearAudio).not.toHaveBeenCalled();
    let playing!: Promise<void>;
    act(() => { playing = result.current.playSingleDialog(dialog); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    expect(TestAudio.instances[0].src).toBe("natural-1.mp3");
    expect(focusDialogTurn).toHaveBeenCalledWith(1, 0, expect.any(Function));
    act(() => TestAudio.instances[0].end());
    await waitFor(() => expect(TestAudio.instances).toHaveLength(2));
    expect(TestAudio.instances[1].src).toBe("natural-2.mp3");
    await act(async () => { TestAudio.instances[1].end(); await playing; });
    expect(result.current.playingDialogId).toBeNull();
    expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
  });

  it("pauses and resumes the same audio at its current position", async () => {
    const { result } = setup();
    act(() => { void result.current.playSingleDialog(dialog); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    const audio = TestAudio.instances[0];
    audio.currentTime = 2;
    act(() => result.current.togglePlaybackPause());
    expect(audio.paused).toBe(true);
    expect(result.current.isPlaybackPaused).toBe(true);
    act(() => result.current.togglePlaybackPause());
    expect(audio.currentTime).toBe(2);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(result.current.isPlaybackPaused).toBe(false);
  });

  it("generates missing natural audio only after Play", async () => {
    const uncached = { ...dialog, turns: [{ ...dialog.turns[0], phrase_audio_url: "" }] };
    vi.mocked(generateContentDialogTurnAudio).mockResolvedValue("generated.mp3");
    const { result } = setup(uncached);
    expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
    act(() => { void result.current.playSingleDialog(uncached); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    expect(generateContentDialogTurnAudio).toHaveBeenCalledWith(1, 0, "spanish", "german");
    expect(result.current.dialogs[0].turns[0].phrase_audio_url).toBe("generated.mp3");
  });

  it("plays the entire dialog in the OpenAI voice and applies speed changes immediately", async () => {
    const { result, focusDialogTurn } = setup(dialog, "clear", 0.75);
    let playing!: Promise<void>;
    act(() => { playing = result.current.playSingleDialog(dialog); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    expect(TestAudio.instances[0].src).toBe("clear-1.mp3");
    expect(TestAudio.instances[0].playbackRate).toBe(0.75);
    expect(TestAudio.instances[0].preservesPitch).toBe(true);
    TestAudio.instances[0].currentTime = 2;
    act(() => result.current.setClearPlaybackRate(0.9));
    expect(TestAudio.instances[0].playbackRate).toBe(0.9);
    expect(TestAudio.instances[0].currentTime).toBe(2);
    act(() => TestAudio.instances[0].end());
    await waitFor(() => expect(TestAudio.instances).toHaveLength(2));
    expect(TestAudio.instances[1].src).toBe("clear-2.mp3");
    expect(TestAudio.instances[1].playbackRate).toBe(0.9);
    expect(focusDialogTurn).toHaveBeenCalledWith(1, 1, expect.any(Function));
    await act(async () => { TestAudio.instances[1].end(); await playing; });
    expect(generateContentDialogTurnClearAudio).not.toHaveBeenCalled();
    expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
  });

  it("generates OpenAI audio on demand and reuses it for whole and individual playback", async () => {
    const uncached = { ...dialog, turns: [{ ...dialog.turns[0], clear_audio_url: "" }] };
    const { result } = setup(uncached);
    act(() => result.current.setAudioMode("clear"));
    act(() => result.current.setClearPlaybackRate(0.75));
    expect(generateContentDialogTurnClearAudio).not.toHaveBeenCalled();
    vi.mocked(generateContentDialogTurnClearAudio).mockResolvedValue("generated-clear.mp3");
    let playing!: Promise<void>;
    act(() => { playing = result.current.playSingleDialog(uncached); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    expect(generateContentDialogTurnClearAudio).toHaveBeenCalledWith(1, 0, "spanish", "german");
    expect(result.current.dialogs[0].turns[0].clear_audio_url).toBe("generated-clear.mp3");
    expect(result.current.dialogs[0].turns[0].phrase_audio_url).toBe("natural-1.mp3");
    await act(async () => { TestAudio.instances[0].end(); await playing; });
    act(() => { void result.current.playSingleDialog(result.current.dialogs[0]); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(2));
    act(() => result.current.stopCurrentPlayback());
    act(() => { void result.current.playTurn(1, 0, result.current.dialogs[0].turns[0].clear_audio_url!, "clear"); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(3));
    expect(TestAudio.instances[2].playbackRate).toBe(0.75);
    expect(generateContentDialogTurnClearAudio).toHaveBeenCalledOnce();
    expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
  });

  it("uses the selected OpenAI voice and speed for Play all", async () => {
    const { result } = setup(dialog, "clear", 0.9);
    let playing!: Promise<void>;
    act(() => { playing = result.current.playAllDialogs(); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    expect(result.current.playingAll).toBe(true);
    expect(TestAudio.instances[0].src).toBe("clear-1.mp3");
    act(() => TestAudio.instances[0].end());
    await waitFor(() => expect(TestAudio.instances).toHaveLength(2));
    expect(TestAudio.instances[1].playbackRate).toBe(0.9);
    await act(async () => { TestAudio.instances[1].end(); await playing; });
    expect(result.current.playingAll).toBe(false);
  });

  it("keeps natural playback at normal speed", async () => {
    const { result } = setup(dialog, "natural", 0.9);
    act(() => { void result.current.playSingleDialog(dialog); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    act(() => result.current.setClearPlaybackRate(0.75));
    expect(TestAudio.instances[0].playbackRate).toBe(1);
  });

  it("can pause while OpenAI audio is being generated", async () => {
    let resolveAudio!: (url: string) => void;
    vi.mocked(generateContentDialogTurnClearAudio).mockReturnValue(new Promise((resolve) => { resolveAudio = resolve; }));
    const uncached = { ...dialog, turns: [{ ...dialog.turns[0], clear_audio_url: "" }] };
    const { result } = setup(uncached, "clear");
    act(() => { void result.current.playSingleDialog(uncached); });
    await waitFor(() => expect(result.current.loadingTurnAudioKey).toBe("clear:1:0"));
    act(() => result.current.togglePlaybackPause());
    await act(async () => resolveAudio("generated-clear.mp3"));
    expect(TestAudio.instances[0].play).not.toHaveBeenCalled();
    expect(result.current.isPlaybackPaused).toBe(true);
    act(() => result.current.togglePlaybackPause());
    expect(TestAudio.instances[0].play).toHaveBeenCalledOnce();
  });

  it.each(["stop", "mode change", "unmount"])("ignores pending generation after %s", async (action) => {
    let resolveAudio!: (url: string) => void;
    vi.mocked(generateContentDialogTurnClearAudio).mockReturnValue(new Promise((resolve) => { resolveAudio = resolve; }));
    const uncached = { ...dialog, turns: [{ ...dialog.turns[0], clear_audio_url: "" }] };
    const { result, unmount } = setup(uncached, "clear");
    let playing!: Promise<void>;
    act(() => { playing = result.current.playTurn(1, 0, "", "clear"); });
    await waitFor(() => expect(generateContentDialogTurnClearAudio).toHaveBeenCalledOnce());
    if (action === "unmount") unmount();
    else act(() => action === "stop" ? result.current.stopCurrentPlayback() : result.current.setAudioMode("natural"));
    await act(async () => { resolveAudio("late.mp3"); await playing; });
    expect(TestAudio.instances).toHaveLength(0);
  });

  it("stops on generation failure without skipping or substituting natural audio", async () => {
    vi.mocked(generateContentDialogTurnClearAudio).mockRejectedValue(new Error("Quota exceeded"));
    const uncached = { ...dialog, turns: dialog.turns.map((turn) => ({ ...turn, clear_audio_url: "" })) };
    const { result, setError } = setup(uncached, "clear");
    await act(async () => result.current.playSingleDialog(uncached));
    expect(setError).toHaveBeenLastCalledWith("Audio failed");
    expect(generateContentDialogTurnClearAudio).toHaveBeenCalledOnce();
    expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
    expect(TestAudio.instances).toHaveLength(0);
    expect(result.current.playingDialogId).toBeNull();
  });

  it("stops the sequence when a saved audio file fails to play", async () => {
    const { result, setError } = setup(dialog, "clear");
    let playing!: Promise<void>;
    act(() => { playing = result.current.playSingleDialog(dialog); });
    await waitFor(() => expect(TestAudio.instances).toHaveLength(1));
    await act(async () => { TestAudio.instances[0].dispatchEvent(new Event("error")); await playing; });
    expect(setError).toHaveBeenLastCalledWith("Audio failed");
    expect(result.current.playingDialogId).toBeNull();
    expect(TestAudio.instances).toHaveLength(1);
  });
});
