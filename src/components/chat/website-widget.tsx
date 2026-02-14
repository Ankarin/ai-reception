"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";

import Image from "next/image";

import { MessageSquare, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CHAT_NOT_CREATED } from "@/lib/chat/constants";
import { removeFromStorage, setToStorage } from "@/lib/utils/storage";
import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetCustomization,
} from "@/lib/widget/defaults";
import ChatSection from "./chat-section";

interface WebsiteWidgetProps {
  orgId: string;
  chatId: string;
  customization?: WidgetCustomization;
  isLoading?: boolean;
  embedded?: boolean;
  showResetButton?: boolean;
}

export function WebsiteWidget({
  orgId,
  chatId,
  customization,
  isLoading = false,
  embedded = false,
  showResetButton = false,
}: WebsiteWidgetProps) {
  const chatRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(embedded);
  const [loadedCustomization, setLoadedCustomization] =
    useState<WidgetCustomization | null>(null);
  const [currentChatId, setCurrentChatId] = useState(chatId);
  const [hasTriggered, setHasTriggered] = useState({
    time: false,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrentChatId(chatId);
  }, [chatId]);

  const handleChatIdChange = (newChatId: string) => {
    if (!mountedRef.current) return;
    setCurrentChatId(newChatId);
    if (newChatId !== CHAT_NOT_CREATED) {
      setToStorage(`widget-chat-${orgId}`, newChatId);
    }
    window.dispatchEvent(
      new CustomEvent("chatCreated", { detail: { chatId: newChatId } }),
    );
  };

  const handleNewChat = () => {
    removeFromStorage(`widget-chat-${orgId}`);
    if (currentChatId !== CHAT_NOT_CREATED) {
      removeFromStorage(`widget-customer-info-${orgId}-${currentChatId}`);
    }
    handleChatIdChange(CHAT_NOT_CREATED);
  };

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: "widget-resize",
          isOpen,
        },
        "*",
      );
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'widget-config') {
        (window as any).ChatConfig = event.data.config;
        // If widget settings were passed from parent, use them directly
        if (event.data.config?.widgetSettings) {
          setLoadedCustomization(event.data.config.widgetSettings);
        }
        window.dispatchEvent(new CustomEvent('chatConfigUpdated', { detail: event.data.config }));
      }
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Skip fetch if customization prop is passed OR if we already have loaded customization (from postMessage)
    if (customization || loadedCustomization) {
      return;
    }

    const fetchCustomization = async () => {
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/widget-settings`,
        );
        if (response.ok) {
          const data = await response.json();
          // Only set if we still don't have customization (avoid race condition)
          setLoadedCustomization((prev) => prev || data);
        }
      } catch (error) {
        console.error("Failed to load widget customization:", error);
      }
    };
    fetchCustomization();
  }, [orgId, customization, loadedCustomization]);

  const activeCustomization = customization || loadedCustomization;

  const config: Required<WidgetCustomization> = useMemo(
    () => ({
      primaryColor:
        activeCustomization?.primaryColor || DEFAULT_WIDGET_CONFIG.primaryColor,
      backgroundColor:
        activeCustomization?.backgroundColor ||
        DEFAULT_WIDGET_CONFIG.backgroundColor,
      secondaryColor:
        activeCustomization?.secondaryColor ||
        DEFAULT_WIDGET_CONFIG.secondaryColor,
      textPrimaryColor:
        activeCustomization?.textPrimaryColor ||
        DEFAULT_WIDGET_CONFIG.textPrimaryColor,
      textSecondaryColor:
        activeCustomization?.textSecondaryColor ||
        DEFAULT_WIDGET_CONFIG.textSecondaryColor,
      borderColor:
        activeCustomization?.borderColor || DEFAULT_WIDGET_CONFIG.borderColor,
      logoUrl: activeCustomization?.logoUrl || DEFAULT_WIDGET_CONFIG.logoUrl,
      logoKey: activeCustomization?.logoKey || DEFAULT_WIDGET_CONFIG.logoKey,
      logoWidth: activeCustomization?.logoWidth || DEFAULT_WIDGET_CONFIG.logoWidth,
      logoHeight: activeCustomization?.logoHeight || DEFAULT_WIDGET_CONFIG.logoHeight,
      logoBorderRadius: activeCustomization?.logoBorderRadius ?? DEFAULT_WIDGET_CONFIG.logoBorderRadius,
      headerTitle:
        activeCustomization?.headerTitle || DEFAULT_WIDGET_CONFIG.headerTitle,
      inputPlaceholder:
        activeCustomization?.inputPlaceholder ||
        DEFAULT_WIDGET_CONFIG.inputPlaceholder,
      initialMessage:
        activeCustomization?.initialMessage ||
        DEFAULT_WIDGET_CONFIG.initialMessage,
      showBranding:
        activeCustomization?.showBranding !== undefined
          ? Boolean(activeCustomization.showBranding)
          : DEFAULT_WIDGET_CONFIG.showBranding,
      brandingText:
        activeCustomization?.brandingText || DEFAULT_WIDGET_CONFIG.brandingText,
      brandingLink:
        activeCustomization?.brandingLink || DEFAULT_WIDGET_CONFIG.brandingLink,
      enableQuickReplies:
        activeCustomization?.enableQuickReplies !== undefined
          ? Boolean(activeCustomization.enableQuickReplies)
          : DEFAULT_WIDGET_CONFIG.enableQuickReplies,
      quickReplies:
        activeCustomization?.quickReplies || DEFAULT_WIDGET_CONFIG.quickReplies,
      enableTimeTrigger:
        activeCustomization?.enableTimeTrigger !== undefined
          ? Boolean(activeCustomization.enableTimeTrigger)
          : DEFAULT_WIDGET_CONFIG.enableTimeTrigger,
      timeTriggerSeconds:
        activeCustomization?.timeTriggerSeconds ||
        DEFAULT_WIDGET_CONFIG.timeTriggerSeconds,
    }),
    [activeCustomization],
  );

  useEffect(() => {
    // Don't show proactive trigger on mobile devices
    const isMobile = window.innerWidth < 768;
    if (embedded || !config.enableTimeTrigger || hasTriggered.time || isOpen || isMobile)
      return;

    const timer = setTimeout(() => {
      setIsOpen(true);
      setHasTriggered((prev) => ({ ...prev, time: true }));
    }, config.timeTriggerSeconds * 1000);

    return () => clearTimeout(timer);
  }, [
    embedded,
    config.enableTimeTrigger,
    config.timeTriggerSeconds,
    hasTriggered.time,
    isOpen,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen && !embedded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, embedded]);

  if (embedded) {
    return (
      <div
        className="w-full h-full flex flex-col overflow-hidden"
        style={{
          backgroundColor: config.backgroundColor,
          color: config.textPrimaryColor,
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{
            backgroundColor: config.secondaryColor,
            borderBottom: `1px solid ${config.borderColor}`,
          }}
        >
          <div className="flex items-center gap-2.5">
            {config.logoUrl && (
              <Image
                src={config.logoUrl}
                alt="Company Logo"
                width={config.logoWidth}
                height={config.logoHeight}
                className="object-contain"
                style={{ borderRadius: `${config.logoBorderRadius}px` }}
              />
            )}
            <h3
              className="font-semibold text-lg"
              style={{ color: config.textPrimaryColor }}
            >
              {config.headerTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {showResetButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full hover:bg-black/5"
                onClick={handleNewChat}
                title="Start New Chat"
                style={{
                  color: config.textPrimaryColor,
                }}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-black/5"
              onClick={() => {
                if (window.parent !== window) {
                  window.parent.postMessage({ type: "widget-resize", isOpen: false }, "*");
                }
              }}
              title="Close"
              style={{
                color: config.textPrimaryColor,
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{
            backgroundColor: config.backgroundColor,
          }}
        >
          <ChatSection
            chatId={currentChatId}
            orgId={orgId}
            config={config}
            onChatIdChange={handleChatIdChange}
          />
        </div>
        {config.showBranding && (
          <div
            className="flex items-center justify-center px-4 text-xs"
            style={{
              backgroundColor: config.secondaryColor,
              color: config.textPrimaryColor,
              opacity: 0.7,
              padding: "0.5rem 1rem",
            }}
          >
            <a
              href={config.brandingLink || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100 transition-opacity"
              style={{ color: config.textPrimaryColor }}
            >
              {config.brandingText || "Powered by AI Receptionist"}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div
          ref={chatRef}
          className="fixed bottom-0 right-0 md:bottom-4 md:right-6 w-full h-full md:w-[420px] md:h-[650px] md:rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          style={{
            backgroundColor: config.backgroundColor,
            color: config.textPrimaryColor,
            maxWidth: "calc(100vw - 40px)",
            maxHeight: "calc(100vh - 40px)",
          }}
        >
          <div
            className="flex items-center justify-between p-4 md:rounded-t-2xl"
            style={{
              backgroundColor: config.secondaryColor,
              borderBottom: `1px solid ${config.borderColor}`,
              paddingTop: "max(1rem, env(safe-area-inset-top))",
            }}
          >
            <div className="flex items-center gap-2.5">
              {config.logoUrl && (
                <Image
                  src={config.logoUrl}
                  alt="Company Logo"
                  width={config.logoWidth}
                  height={config.logoHeight}
                  className="object-contain"
                  style={{ borderRadius: `${config.logoBorderRadius}px` }}
                />
              )}
              <h3
                className="font-semibold text-lg"
                style={{ color: config.textPrimaryColor }}
              >
                {config.headerTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {showResetButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-black/5"
                  onClick={handleNewChat}
                  title="Start New Chat"
                  style={{
                    color: config.textPrimaryColor,
                  }}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-black/5"
                onClick={() => setIsOpen(false)}
                style={{
                  color: config.textPrimaryColor,
                }}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>

          <div
            className="flex-1 overflow-hidden flex flex-col"
            style={{
              backgroundColor: config.backgroundColor,
            }}
          >
            <ChatSection
              chatId={currentChatId}
              orgId={orgId}
              config={config}
              onChatIdChange={handleChatIdChange}
            />
          </div>
          {config.showBranding && (
            <div
              className="flex items-center justify-center px-4 text-xs"
              style={{
                backgroundColor: config.secondaryColor,
                color: config.textPrimaryColor,
                opacity: 0.7,
                padding: "0.5rem 1rem",
              }}
            >
              <a
                href={config.brandingLink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-100 transition-opacity"
                style={{ color: config.textPrimaryColor }}
              >
                {config.brandingText || "Powered by AI Receptionist"}
              </a>
            </div>
          )}
        </div>
      )}

      {!isOpen && (
        <Button
          onClick={() => !isLoading && setIsOpen(!isOpen)}
          size="lg"
          disabled={isLoading}
          className="fixed bottom-4 right-4 rounded-full hover:scale-110 z-50 transition-all duration-300"
          style={{
            width: 80,
            height: 80,
            backgroundColor: config.primaryColor,
            color: config.textSecondaryColor,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-current border-t-transparent" />
          ) : (
            <MessageSquare style={{ width: 34, height: 34 }} />
          )}
        </Button>
      )}
    </>
  );
}

export default memo(WebsiteWidget);
