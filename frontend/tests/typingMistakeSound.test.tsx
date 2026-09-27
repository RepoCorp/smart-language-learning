import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WordReview from "../src/components/WordReview";
import { useTypingMistakeSound } from "../src/components/useTypingMistakeSound";
import type { SessionItem } from "../src/types";

function makeTone() {
  return {
    type: "", frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    onended: null as (() => void) | null,
  };
}
const tones: Array<ReturnType<typeof makeTone>> = [];
class TestAudioContext {
  static instances: TestAudioContext[] = [];
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => { this.state = "running"; });
  close = vi.fn(async () => { this.state = "closed"; });
  constructor() { TestAudioContext.instances.push(this); }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(),
    };
  }
  createOscillator() {
    const tone = makeTone();
    tones.push(tone);
    return tone;
  }
}

const item: SessionItem = {
  id: 1, item_type: "word", mode: "review", direction: "es_to_de",
  spanish_text: "mamá", german_text: "mamma", options: [],
};
const change = (value: string) => fireEvent.change(screen.getByTestId("word-input"), { target: { value } });

beforeEach(() => {
  TestAudioContext.instances = [];
  tones.length = 0;
  vi.stubGlobal("AudioContext", TestAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

describe("typing mistake feedback", () => {
  it("sounds only once per position, including when the same letter occurs again", () => {
    const onAnswered = vi.fn();
    render(<WordReview item={item} onAnswered={onAnswered} />);
    change("x");
    change("y");
    expect(tones).toHaveLength(1);
    expect(screen.getByTestId("word-input")).toHaveValue("");
    change("ma");
    expect(tones).toHaveLength(1);
    change("max");
    change("may");
    expect(tones).toHaveLength(2);
    change("");
    change("z");
    expect(tones).toHaveLength(2);
    expect(onAnswered).not.toHaveBeenCalled();
    expect(TestAudioContext.instances).toHaveLength(1);
    expect(tones[0].type).toBe("sine");
    expect(tones[0].stop).toHaveBeenCalledWith(0.15);
  });

  it("keeps retries quiet during rewrites but resets for a new item", () => {
    const onAnswered = vi.fn();
    const { rerender } = render(<WordReview item={item} onAnswered={onAnswered} />);
    change("x");
    rerender(<WordReview item={item} onAnswered={onAnswered} reviewComplete />);
    change("y");
    expect(tones).toHaveLength(1);
    change("ma");
    change("max");
    expect(tones).toHaveLength(2);
    rerender(<WordReview item={{ ...item, id: 2 }} onAnswered={onAnswered} />);
    expect(TestAudioContext.instances[0].close).toHaveBeenCalledOnce();
    change("x");
    expect(tones).toHaveLength(3);
  });

  it("does not sound for correct typing, backspace, or hints", () => {
    render(<WordReview item={item} onAnswered={vi.fn()} />);
    change("ma");
    change("m");
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(tones).toHaveLength(0);
    change("mx");
    expect(tones).toHaveLength(1);
  });

  it("does not sound for an accent in progress or provisional capitalization", () => {
    const { rerender } = render(<WordReview item={{ ...item, german_text: "über" }} onAnswered={vi.fn()} />);
    change("u");
    expect(tones).toHaveLength(0);
    change("ü");
    expect(tones).toHaveLength(0);
    rerender(<WordReview item={{ ...item, german_text: "Haus" }} onAnswered={vi.fn()} />);
    change("h");
    expect(tones).toHaveLength(0);
    change("x");
    change("z");
    expect(tones).toHaveLength(1);
  });

  it.each([undefined, "word_intro"] as const)("waits for composition to finish before sounding (%s)", async (repeatPracticeStep) => {
    render(<WordReview item={{ ...item, repeatPracticeStep }} onAnswered={vi.fn()} />);
    const input = screen.getByTestId("word-input");
    fireEvent.compositionStart(input);
    change("x");
    expect(tones).toHaveLength(0);
    fireEvent.compositionEnd(input);
    await waitFor(() => expect(tones).toHaveLength(1));
    change("y");
    expect(tones).toHaveLength(1);
  });

  it("also keeps warm-up typing retries quiet", () => {
    render(<WordReview item={{ ...item, repeatedAfterFailure: true, repeatPracticeStep: "word_intro" }} onAnswered={vi.fn()} />);
    change("x");
    change("xy");
    change("x");
    change("");
    expect(tones).toHaveLength(1);
    change("ma");
    change("max");
    change("may");
    expect(tones).toHaveLength(2);
  });

  it("leaves typing usable without Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    render(<WordReview item={item} onAnswered={vi.fn()} />);
    change("x");
    change("ma");
    expect(screen.getByTestId("word-input")).toHaveValue("ma");
    expect(tones).toHaveLength(0);
  });

  it("disconnects finished tones and closes audio on unmount", () => {
    const hook = renderHook(() => useTypingMistakeSound("item-1"));
    act(() => hook.result.current(0));
    tones[0].onended?.();
    expect(tones[0].disconnect).toHaveBeenCalledOnce();
    hook.unmount();
    expect(TestAudioContext.instances[0].close).toHaveBeenCalledOnce();
  });

  it("does not play a delayed sound after changing exercises", async () => {
    let resume!: () => void;
    vi.stubGlobal("AudioContext", class extends TestAudioContext {
      state = "suspended";
      resume = vi.fn(() => new Promise<void>((resolve) => {
        resume = () => { this.state = "running"; resolve(); };
      }));
    });
    const { result, rerender } = renderHook(({ key }) => useTypingMistakeSound(key), { initialProps: { key: "first" } });
    act(() => result.current(0));
    rerender({ key: "second" });
    await act(async () => resume());
    expect(tones).toHaveLength(0);
  });

  it("handles a blocked audio context without rejecting or repeating feedback", async () => {
    vi.stubGlobal("AudioContext", class extends TestAudioContext {
      state = "suspended";
      resume = vi.fn(async () => { throw new Error("Audio blocked"); });
    });
    const { result } = renderHook(() => useTypingMistakeSound("first"));
    await act(async () => result.current(0));
    await act(async () => result.current(0));
    expect(TestAudioContext.instances[0].resume).toHaveBeenCalledOnce();
    expect(tones).toHaveLength(0);
  });
});
