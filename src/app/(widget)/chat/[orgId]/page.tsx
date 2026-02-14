"use client";

import dynamic from 'next/dynamic';
import { use, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import "./[chatId]/widget-page.css";
import { CHAT_NOT_CREATED } from "@/lib/chat/constants";
import { getFromStorage } from "@/lib/utils/storage";
import type { WidgetCustomization } from "@/lib/widget/defaults";

const WebsiteWidget = dynamic(
  () => import('@/components/chat/website-widget').then(mod => mod.WebsiteWidget),
  {
    ssr: false,
    loading: () => null // Don't show anything while loading to prevent flashing
  }
);

interface PageProps {
  params: Promise<{ orgId: string }>;
}

const Page = ({ params }: PageProps) => {
  const { orgId } = use(params);
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get('embedded') === 'true';
  const [chatId, setChatId] = useState<string>(CHAT_NOT_CREATED);
  const [mounted, setMounted] = useState(false);

  // Parse settings from URL params (passed by widget.js)
  const initialSettings = useMemo<WidgetCustomization | undefined>(() => {
    const settingsParam = searchParams.get('settings');
    if (settingsParam) {
      try {
        return JSON.parse(decodeURIComponent(settingsParam));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingChatId = getFromStorage<string>(`widget-chat-${orgId}`);

      if (existingChatId) {
        setChatId(existingChatId);
      }

      setMounted(true);
    }
  }, [orgId]);

  // For embedded mode, render a full-height container
  if (isEmbedded) {
    if (!mounted) return null;

    return (
      <div className="w-full h-screen">
        <WebsiteWidget
          orgId={orgId}
          chatId={chatId}
          embedded={true}
          showResetButton={true}
          customization={initialSettings}
        />
      </div>
    );
  }

  // For non-embedded mode (direct URL access)
  if (!mounted) return null;

  return (
    <WebsiteWidget
      orgId={orgId}
      chatId={chatId}
      embedded={false}
      showResetButton={false}
      customization={initialSettings}
    />
  );
};

export default Page;
