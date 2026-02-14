'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';
import './widget-page.css';

const WebsiteWidget = dynamic(
    () => import('@/components/chat/website-widget').then(mod => mod.WebsiteWidget),
    { ssr: false }
);

export default function ChatPage({
    params,
}: {
    params: Promise<{ orgId: string; chatId: string }>;
}) {
    const { orgId, chatId } = use(params);

    return (
        <WebsiteWidget
            orgId={orgId}
            chatId={chatId}
        />
    );
}

