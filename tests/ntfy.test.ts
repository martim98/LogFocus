import test from "node:test";
import assert from "node:assert/strict";
import { resolveNtfyEndpoint, sendNtfyCoachNotification } from "../lib/ntfy.ts";

test("resolveNtfyEndpoint builds ntfy topic URLs", () => {
  assert.equal(resolveNtfyEndpoint("https://ntfy.sh", "focus-coach"), "https://ntfy.sh/focus-coach");
  assert.equal(resolveNtfyEndpoint("https://ntfy.example.com/", "focus coach"), "https://ntfy.example.com/focus%20coach");
  assert.equal(resolveNtfyEndpoint("https://ntfy.sh", "https://ntfy.sh/existing-topic"), "https://ntfy.sh/existing-topic");
  assert.equal(resolveNtfyEndpoint("https://ntfy.sh", "   "), null);
});

test("sendNtfyCoachNotification posts coach messages when enabled", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response("ok");
  };

  try {
    const sent = await sendNtfyCoachNotification(
      {
        ntfyEnabled: true,
        ntfyServerUrl: "https://ntfy.sh",
        ntfyTopic: "focus-coach",
        ntfyPriority: 4,
      },
      {
        title: "LogFocus Coach · Resume",
        message: "Resume work. Focus remains and your pace is slipping.",
        tags: "warning",
      },
    );

    assert.equal(sent, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://ntfy.sh/focus-coach");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(calls[0].init?.headers, {
      Title: "LogFocus Coach · Resume",
      Priority: "4",
      Tags: "warning",
    });
    assert.equal(calls[0].init?.body, "Resume work. Focus remains and your pace is slipping.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendNtfyCoachNotification skips disabled or empty topics", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("ok");
  };

  try {
    const disabled = await sendNtfyCoachNotification(
      { ntfyEnabled: false, ntfyServerUrl: "https://ntfy.sh", ntfyTopic: "focus-coach", ntfyPriority: 3 },
      { title: "LogFocus Coach", message: "Keep working." },
    );
    const emptyTopic = await sendNtfyCoachNotification(
      { ntfyEnabled: true, ntfyServerUrl: "https://ntfy.sh", ntfyTopic: "", ntfyPriority: 3 },
      { title: "LogFocus Coach", message: "Keep working." },
    );

    assert.equal(disabled, false);
    assert.equal(emptyTopic, false);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
