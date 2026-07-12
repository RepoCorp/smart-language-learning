export type RealtimeResponseOutputPart = {
  type?: string;
  text?: string;
  transcript?: string;
};

export type RealtimeResponseOutputItem = {
  type?: string;
  content?: RealtimeResponseOutputPart[];
};

export type RealtimeServerEvent = {
  type?: string;
  delta?: string;
  text?: string;
  transcript?: string;
  response?: { output?: RealtimeResponseOutputItem[] };
  item?: { content?: RealtimeResponseOutputPart[] };
  error?: { message?: string };
  message?: string;
};

export function logRealtime(step: string, details?: Record<string, unknown>): void {
  console.info("[conversation-realtime]", step, details || {});
}

export function warnRealtime(step: string, details?: Record<string, unknown>): void {
  console.warn("[conversation-realtime]", step, details || {});
}

export function extractRealtimeText(event: RealtimeServerEvent): string {
  const eventText = typeof event.text === "string" ? event.text.trim() : "";
  if (eventText) {
    return eventText;
  }
  for (const item of event.response?.output || []) {
    for (const part of item.content || []) {
      const text = typeof part.text === "string" ? part.text.trim() : "";
      if (text) {
        return text;
      }
      const transcript = typeof part.transcript === "string" ? part.transcript.trim() : "";
      if (transcript) {
        return transcript;
      }
    }
  }
  return "";
}
