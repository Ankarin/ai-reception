"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { v4 as uuidv4 } from "uuid";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";

import { filterToolExecutionFromResponse } from "@/lib/chat/constants";
import { removeFromStorage, setToStorage } from "@/lib/utils/storage";
import type { WidgetCustomization } from "@/lib/widget/defaults";
import { QuickReplies } from "./quick-replies";

interface MessagePart {
  type: string;
  text?: string;
}

interface ChatSectionProps {
  chatId: string;
  orgId: string;
  config: Required<WidgetCustomization>;
  onChatIdChange?: (newChatId: string) => void;
  isInternalView?: boolean;
}

export function ChatSection({
  chatId,
  orgId,
  config,
  onChatIdChange,
  isInternalView = false,
}: ChatSectionProps) {
  const [input, setInput] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => {
          const jwt = typeof window !== 'undefined' && (window as any).ChatConfig?.jwt ? (window as any).ChatConfig.jwt : null;

          const headers: Record<string, string> = {};

          if (jwt) {
            headers['Authorization'] = `Bearer ${jwt}`;
          }

          return {
            body: {
              message: messages[messages.length - 1],
              id,
              orgId,
            },
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          };
        },
      }),
    [orgId],
  );

  const [actualChatId, setActualChatId] = useState(() => {
    if (chatId === "_") {
      const newId = uuidv4();
      if (onChatIdChange) {
        setTimeout(() => onChatIdChange(newId), 0);
      }
      return newId;
    }
    return chatId;
  });

  // Update actualChatId when chatId prop changes (e.g., on reset)
  useEffect(() => {
    if (chatId === "_") {
      const newId = uuidv4();
      setActualChatId(newId);
      onChatIdChange?.(newId);
    } else if (chatId !== actualChatId) {
      setActualChatId(chatId);
    }
  }, [chatId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: actualChatId,
    transport,
    onError: (error) => {
      console.error("❌ [Widget] Error:", error);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    setIsInitialized(false);
    setMessages([]);

    const initializeChat = async () => {
      if (!orgId || !chatId) {
        console.error("❌ [ChatSection] Missing orgId or chatId:", { orgId, chatId });
        setIsInitialized(true);
        return;
      }

      const fetchChatHistory = async (retryCount = 0, maxRetries = 3) => {
        try {
          const url = `/api/chat/${orgId}/${chatId}`;
          const response = await fetch(url);

          if (response.status === 404) {
            setIsInitialized(true);
            return;
          }

          if (response.ok) {
            const data = await response.json();
            const messagesCount = data.messages?.length || 0;

            if (data.updatedAt && !isInternalView) {
              const lastUpdateTime = new Date(data.updatedAt).getTime();
              const currentTime = Date.now();
              const thirtyMinutesInMs = 30 * 60 * 1000;

              if (currentTime - lastUpdateTime > thirtyMinutesInMs) {
                removeFromStorage(`widget-chat-${orgId}`);
                removeFromStorage(`widget-customer-info-${orgId}-${chatId}`);
                const newChatId = uuidv4();
                setToStorage(`widget-chat-${orgId}`, newChatId);
                onChatIdChange?.(newChatId);
                return;
              }
            }

            if (messagesCount === 0 && retryCount < maxRetries) {
              const delayMs = 2 ** retryCount * 500;
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              return fetchChatHistory(retryCount + 1, maxRetries);
            }

            if (messagesCount > 0) {
              setMessages(data.messages);
            } else if (config.initialMessage && !isInternalView) {
              setMessages([
                {
                  id: `initial-${Date.now()}`,
                  role: "assistant",
                  parts: [{ type: "text", text: config.initialMessage }],
                },
              ]);
            }

            return true;
          } else {
            if (response.status === 404 || response.status === 500) {
              const newChatId = uuidv4();
              setToStorage(`widget-chat-${orgId}`, newChatId);
              removeFromStorage(`widget-customer-info-${orgId}-${chatId}`);
              onChatIdChange?.(newChatId);
            }

            return false;
          }
        } catch (error) {
          console.error("Failed to fetch chat:", error);

          if (retryCount < maxRetries) {
            const delayMs = 2 ** retryCount * 500;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return fetchChatHistory(retryCount + 1, maxRetries);
          }

          const newChatId = uuidv4();
          setToStorage(`widget-chat-${orgId}`, newChatId);
          removeFromStorage(`widget-customer-info-${orgId}-${chatId}`);
          onChatIdChange?.(newChatId);

          return false;
        }
      };

      await fetchChatHistory();
      setIsInitialized(true);
    };

    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, chatId, isInternalView]);

  useEffect(() => {
    if (isInitialized) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isInitialized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prevStatus === "streaming" && status !== "streaming") {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [status]);

  const handleQuickReply = (reply: string) => {
    setShowQuickReplies(false);
    handleSubmit({ text: reply });
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    setShowQuickReplies(false);

    sendMessage({
      text: message.text || "Sent with attachments",
      files: message.files,
    });
    setInput("");
  };

  const renderConversationContent = () => {
    const lastMessage = messages[messages.length - 1];

    const isLastMessageEmpty =
      lastMessage?.role === "assistant" &&
      (!lastMessage.parts?.length ||
        lastMessage.parts.every(
          (part: MessagePart) =>
            part.type === "text" &&
            (!part.text || part.text.trim().length === 0),
        ));

    const shouldShowLoader =
      status === "submitted" ||
      (status === "streaming" &&
        (isLastMessageEmpty || lastMessage?.role !== "assistant"));

    return (
      <>
        {config.initialMessage && (
          <Message from="assistant">
            <MessageContent
              style={{
                backgroundColor: config.secondaryColor,
                color: config.textPrimaryColor,
              }}
            >
              <Response>{config.initialMessage}</Response>
            </MessageContent>
          </Message>
        )}
        {messages.map((message) => {
          const hasContent = message.parts?.some(
            (part: MessagePart) =>
              part.type === "text" && part.text && part.text.trim().length > 0,
          );

          if (
            message.role === "assistant" &&
            !hasContent &&
            status === "streaming"
          ) {
            return null;
          }

          return (
            <Message key={message.id} from={message.role}>
              {hasContent && (
                <MessageContent
                  style={{
                    backgroundColor:
                      message.role === "user"
                        ? config.primaryColor
                        : config.secondaryColor,
                    color:
                      message.role === "user"
                        ? config.textSecondaryColor
                        : config.textPrimaryColor,
                  }}
                >
                  {message.parts?.map((part: MessagePart, i: number) => {
                    switch (part.type) {
                      case "text":
                        return (
                          <Response key={`${message.id}-${i}`}>
                            {filterToolExecutionFromResponse(part.text || '')}
                          </Response>
                        );
                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              )}
            </Message>
          );
        })}
        {shouldShowLoader && <Loader />}
      </>
    );
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    );
  }

  const shouldShowQuickReplies =
    showQuickReplies &&
    messages.length <= 1 &&
    config.enableQuickReplies !== false &&
    config.quickReplies &&
    config.quickReplies.length > 0 &&
    status !== "submitted" &&
    status !== "streaming";

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent>
          {renderConversationContent()}
          <div ref={messagesEndRef} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {shouldShowQuickReplies && !isInternalView && (
        <div className="px-4 py-2">
          <QuickReplies
            replies={config.quickReplies}
            onSelect={handleQuickReply}
            primaryColor={config.primaryColor}
            textColor={config.textPrimaryColor}
            borderColor={config.borderColor}
          />
        </div>
      )}

      {!isInternalView && (
        <PromptInput
          onSubmit={handleSubmit}
          className="shrink-0 backdrop-blur-sm rounded-xl shadow-sm"
          style={{
            backgroundColor: config.backgroundColor,
            border: `1px solid ${config.borderColor}`,
          }}
          globalDrop
          multiple
        >
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
            <div className="flex items-center gap-2 px-2">
              <PromptInputTextarea
                ref={textareaRef}
                onChange={(e) => setInput(e.target.value)}
                value={input}
                className="flex-1 border-0 focus-visible:ring-0 bg-transparent resize-none"
                placeholder={config.inputPlaceholder}
                style={{ color: config.textPrimaryColor }}
                disabled={status === "submitted" || status === "streaming"}
              />
              <PromptInputSubmit
                disabled={
                  !input || status === "submitted" || status === "streaming"
                }
                status={status}
                size="default"
                className="h-10 w-10 shrink-0"
                style={{
                  backgroundColor: config.primaryColor,
                  color: config.textSecondaryColor,
                }}
              />
            </div>
          </PromptInputBody>
        </PromptInput>
      )}
    </>
  );
}

export default memo(ChatSection);
