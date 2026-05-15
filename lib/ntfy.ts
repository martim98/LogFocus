import type { TimerSettings } from "@/lib/domain";

type NtfySettings = Pick<TimerSettings, "ntfyEnabled" | "ntfyServerUrl" | "ntfyTopic" | "ntfyPriority">;

export function resolveNtfyEndpoint(serverUrl: string, topic: string) {
  const trimmedTopic = topic.trim();
  if (!trimmedTopic) return null;
  if (/^https?:\/\//i.test(trimmedTopic)) return trimmedTopic;

  const baseUrl = (serverUrl.trim() || "https://ntfy.sh").replace(/\/+$/, "");
  return `${baseUrl}/${encodeURIComponent(trimmedTopic)}`;
}

export async function sendNtfyCoachNotification(
  settings: NtfySettings,
  params: {
    title: string;
    message: string;
    tags?: string;
  },
) {
  if (!settings.ntfyEnabled) return false;

  const endpoint = resolveNtfyEndpoint(settings.ntfyServerUrl, settings.ntfyTopic);
  if (!endpoint) return false;

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        Title: params.title,
        Priority: String(settings.ntfyPriority),
        Tags: params.tags ?? "stopwatch",
      },
      body: params.message,
    });
    return true;
  } catch {
    return false;
  }
}
