export interface Organization {
  id: string;
  name: string;
  settings: {
    brandColor?: string;
    welcomeMessage?: string;
  };
  createdAt: Date;
}

export interface Chat {
  id: string;
  orgId: string;
  visitorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    intent?: string;
    orderId?: string;
  };
  createdAt: Date;
}
