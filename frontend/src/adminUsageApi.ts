import { API_BASE, apiFetch } from "./apiCore";
import type { AuthUser } from "./authApi";

export type AdminAIUsageUser = AuthUser & {
  is_blocked: boolean;
  weekly_generation_credits: number;
  weekly_elevenlabs_characters: number;
  weekly_elevenlabs_music_seconds: number;
  weekly_realtime_minutes: number;
  week_generation_credits: number;
  week_elevenlabs_characters: number;
  week_elevenlabs_music_seconds: number;
  week_realtime_minutes: number;
};

type AdminAIUsageResponse = {
  week_start: string;
  defaults: {
    weekly_generation_credits: number;
    weekly_elevenlabs_characters: number;
    weekly_elevenlabs_music_seconds: number;
    weekly_realtime_minutes: number;
  };
  users: AdminAIUsageUser[];
};

export async function fetchAdminAIUsage(): Promise<AdminAIUsageResponse> {
  const response = await apiFetch(`${API_BASE}/auth/ai-usage`);
  if (!response.ok) {
    throw new Error("Failed to load AI usage");
  }
  return (await response.json()) as AdminAIUsageResponse;
}

export async function updateAdminAIUsageLimit(user: AdminAIUsageUser): Promise<void> {
  const response = await apiFetch(`${API_BASE}/auth/ai-usage/limit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user.id,
      is_blocked: user.is_blocked,
      weekly_generation_credits: user.weekly_generation_credits,
      weekly_elevenlabs_characters: user.weekly_elevenlabs_characters,
      weekly_elevenlabs_music_seconds: user.weekly_elevenlabs_music_seconds,
      weekly_realtime_minutes: user.weekly_realtime_minutes,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to update AI usage limit");
  }
}
