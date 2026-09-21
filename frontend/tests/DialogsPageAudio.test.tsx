import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DialogsPage from "../src/features/dialogs/DialogsPage";
import { fetchContentDialogs, fetchContentTopics, generateContentDialogTurnClearAudio, generateContentDialogTurnAudio } from "../src/api";
import type { ContentDialogRecord } from "../src/types";

vi.mock("../src/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/api")>(),
  fetchContentDialogs: vi.fn(),
  fetchContentTopics: vi.fn(),
  generateContentDialogTurnClearAudio: vi.fn(),
  generateContentDialogTurnAudio: vi.fn(),
}));

const dialog: ContentDialogRecord = {
  dialog_id: 12, topic: "Shopping", context: "At the shop", proficiency_level: "A1", created_at: "2026-09-20", audio_url: "",
  turns: [{ source_text: "Hola", target_text: "Hallo", phrase_audio_url: "https://example.com/natural.mp3", clear_audio_url: "" }],
};
let audioElements: HTMLAudioElement[];

beforeEach(() => {
  vi.clearAllMocks();
  audioElements = [];
  vi.stubGlobal("Audio", function (src: string) {
    const audio = document.createElement("audio");
    audio.src = src;
    audioElements.push(audio);
    return audio;
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(fetchContentDialogs).mockResolvedValue({ dialogs: [dialog], has_more: false, page: 1, page_size: 20, total: 1 });
  vi.mocked(fetchContentTopics).mockResolvedValue({ topics: [] });
  vi.mocked(generateContentDialogTurnClearAudio).mockResolvedValue("https://example.com/clear.mp3");
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("lets the user select OpenAI and a speed before playing all, then reuse that audio for one dialog", async () => {
  render(<DialogsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Play all dialogs" })).toBeEnabled());
  expect(screen.queryByRole("combobox", { name: "Playback speed" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Natural voices selected. Switch to OpenAI voice" }));
  expect(screen.queryByRole("option", { name: "0.6×" })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Playback speed" }), "0.75");
  expect(generateContentDialogTurnClearAudio).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Play all dialogs" }));
  await waitFor(() => expect(audioElements).toHaveLength(1));
  expect(audioElements[0].src).toBe("https://example.com/clear.mp3");
  expect(audioElements[0].playbackRate).toBe(0.75);
  const speedControls = screen.getAllByRole("combobox", { name: "Playback speed" });
  expect(speedControls).toHaveLength(2);
  await userEvent.selectOptions(speedControls[1], "0.9");
  expect(speedControls[0]).toHaveValue("0.9");
  expect(audioElements[0].playbackRate).toBe(0.9);
  act(() => audioElements[0].dispatchEvent(new Event("ended")));
  await waitFor(() => expect(screen.getByRole("button", { name: "Play dialog" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Play dialog" }));
  await waitFor(() => expect(audioElements).toHaveLength(2));
  expect(audioElements[1].src).toBe("https://example.com/clear.mp3");
  expect(generateContentDialogTurnClearAudio).toHaveBeenCalledOnce();
  expect(generateContentDialogTurnAudio).not.toHaveBeenCalled();
  await userEvent.click(screen.getAllByRole("button", { name: "OpenAI voice selected. Switch to natural voices" })[0]);
  expect(screen.queryByRole("combobox", { name: "Playback speed" })).not.toBeInTheDocument();
});
