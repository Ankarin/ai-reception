"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import { CHAT_NOT_CREATED } from "@/lib/chat/constants";
import { getFromStorage } from "@/lib/utils/storage";
import './chat-widget.css';

const WebsiteWidget = dynamic(
    () => import('@/components/chat/website-widget').then(mod => mod.WebsiteWidget),
    { ssr: false }
);

const Page = () => {
    const orgId = "org_379hCxkulXugPvKFFnPamhdtdjv";
    const [chatId, setChatId] = useState<string>(CHAT_NOT_CREATED);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const existingChatId = getFromStorage<string>(`widget-chat`);
            if (existingChatId) {
                setChatId(existingChatId);
            }
            setMounted(true);
        }
    }, []);

    if (!mounted) return null;

    return (
        <WebsiteWidget
            orgId={orgId}
            chatId={chatId}
        />
    );
};

export default Page;

