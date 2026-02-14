export function generateChatId(orgId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `chat_${timestamp}_${random}`;
}

export function parseChatId(chatId: string): {
  timestamp: number;
  random: string;
} | null {
  const parts = chatId.split("_");
  if (parts.length !== 3 || parts[0] !== "chat") {
    return null;
  }

  return {
    timestamp: parseInt(parts[1], 10),
    random: parts[2],
  };
}
