export const CHAT_NOT_CREATED = "_" as const;

export const CHAT_CONFIG = {
  DEFAULT_MODEL: "gemini-2.5-flash",
  MAX_STEPS: 10,
  MESSAGE_ID_PREFIX: "msg",
  MESSAGE_ID_SIZE: 16,
  REQUEST_TIMEOUT: 60000,
} as const;

export function filterToolExecutionFromResponse(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let filteredText = text;

  filteredText = filteredText.replace(/tool_code\s+print\([^)]+\)/g, "");

  filteredText = filteredText.replace(/thought\s+[^.!?]+[.!?]/g, "");

  // Clean up excessive spaces within lines, but preserve newlines for markdown
  filteredText = filteredText.replace(/[^\S\n]+/g, " ").trim();

  return filteredText;
}
