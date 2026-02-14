"use client";

import { use, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Loader2 } from "lucide-react";

import { ChatSection } from "@/components/chat/chat-section";
import { Button } from "@/components/ui/button";

import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetCustomization,
} from "@/lib/widget/defaults";

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const router = useRouter();
  const { orgId } = useAuth();
  const [loadedCustomization, setLoadedCustomization] =
    useState<WidgetCustomization | null>(null);
  const [currentChatId, setCurrentChatId] = useState(chatId);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setCurrentChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    if (!orgId) return;

    const fetchCustomization = async () => {
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/widget-settings`,
        );
        if (response.ok) {
          const data = await response.json();
          setLoadedCustomization(data);
        }
      } catch (error) {
        console.error("Failed to load widget customization:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomization();
  }, [orgId]);

  const handleChatIdChange = (newChatId: string) => {
    setCurrentChatId(newChatId);
    router.push(`/dashboard/chats/${newChatId}`);
    window.dispatchEvent(
      new CustomEvent("chatCreated", { detail: { chatId: newChatId } }),
    );
  };

  const config: Required<WidgetCustomization> = {
    ...DEFAULT_WIDGET_CONFIG,
    ...loadedCustomization,
  };

  if (isLoading || !orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: config.backgroundColor }}
    >
      <div
        className="flex items-center justify-between p-4 border-b shrink-0"
        style={{
          backgroundColor: config.secondaryColor,
          borderColor: config.borderColor,
        }}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/chats")}
            style={{ color: config.textPrimaryColor }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1
            className="text-lg font-semibold"
            style={{ color: config.textPrimaryColor }}
          >
            AI Assistant
          </h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 pt-6 pb-4">
        <ChatSection
          chatId={currentChatId}
          orgId={orgId}
          config={config}
          onChatIdChange={handleChatIdChange}
          isInternalView
        />
      </div>
    </div>
  );
}

