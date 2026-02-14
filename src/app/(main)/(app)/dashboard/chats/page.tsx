"use client";

import { useCallback, useEffect, useState, useMemo, Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@clerk/nextjs";
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    MessageCircle,
    MessageSquare,
    User,
    Clock,
    Mail,
    Phone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/lib/orpc/client";
import { useLocale, useT } from "@/lib/i18n/context";
import { t as fmt } from "@/lib/i18n/utils";

interface Chat {
    id: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    messageCount: number;
    messages: any[];
    createdAt: Date;
    updatedAt: Date;
}

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

function ChatsListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { orgId } = useAuth();
    const { locale } = useLocale();
    const t = useT();

    const [chats, setChats] = useState<Chat[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    const sortBy = (searchParams.get("sortBy") || "updatedAt") as "createdAt" | "updatedAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
    const search = searchParams.get("search") || "";
    const pageSize = Number(searchParams.get("pageSize")) || 20;

    useEffect(() => {
        setCurrentPage(1);
    }, [sortBy, sortOrder, search, pageSize]);

    const fetchChats = useCallback(async () => {
        if (!orgId) return;

        setIsLoading(true);
        try {
            const data = await orpc.chats.list({
                orgId,
                sortBy,
                sortOrder,
                search,
                page: currentPage,
                pageSize,
            });
            setChats(data.chats);
            setPagination(data.pagination);
        } catch (error) {
            console.error("Error fetching chats:", error);
        } finally {
            setIsLoading(false);
        }
    }, [orgId, sortBy, sortOrder, search, currentPage, pageSize]);

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    const getLatestMessages = (chat: Chat) => {
        if (!chat.messages || chat.messages.length === 0) {
            return [{ role: "", content: t.chats.noMessages }];
        }

        const extractContent = (message: any) => {
            if (typeof message.content === 'string') {
                return message.content;
            }
            if (Array.isArray(message.parts)) {
                return message.parts
                    .filter((part: any) => part.type === 'text' && part.text)
                    .map((part: any) => part.text)
                    .join(' ');
            }
            return "";
        };

        const lastTwo = chat.messages.slice(-2);
        return lastTwo.map(msg => ({
            role: msg.role || "unknown",
            content: extractContent(msg) || t.chats.noTextContent
        }));
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInHours = diffInMs / (1000 * 60 * 60);
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        if (diffInHours < 1) {
            const minutes = Math.floor(diffInMs / (1000 * 60));
            return minutes < 1 ? t.chats.justNow : fmt(t.chats.minutesAgo, { n: minutes });
        } else if (diffInHours < 24) {
            const hours = Math.floor(diffInHours);
            return fmt(t.chats.hoursAgo, { n: hours });
        } else if (diffInDays < 7) {
            const days = Math.floor(diffInDays);
            return fmt(t.chats.daysAgo, { n: days });
        } else {
            return date.toLocaleDateString(locale === "uk" ? "uk-UA" : "en-US", {
                month: "short",
                day: "numeric",
                year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
            });
        }
    };

    const paginationInfo = useMemo(() => {
        const start = (pagination.page - 1) * pagination.pageSize + 1;
        const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
        return { start, end };
    }, [pagination]);

    return (
        <div className="p-6 space-y-6">


            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : chats.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-1">{t.chats.noChats}</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            {search
                                ? fmt(t.chats.noChatsSearch, { search })
                                : t.chats.noConversations}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {chats.map((chat) => (
                            <Card
                                key={chat.id}
                                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 h-full"
                                onClick={() => router.push(`/dashboard/chats/${chat.id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
                                                <User className="h-6 w-6 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div>
                                                    <CardTitle className="text-lg truncate mb-1">
                                                        {chat.customerName || t.chats.anonymousUser}
                                                    </CardTitle>
                                                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                        {chat.customerPhone && (
                                                            <span className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {chat.customerPhone}
                                                            </span>
                                                        )}
                                                        {chat.customerEmail && (
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {chat.customerEmail}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div className="space-y-2">
                                                    {getLatestMessages(chat).map((msg, idx) => (
                                                        <div key={idx} className="space-y-0.5">
                                                            {msg.role && msg.role !== "" && (
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    {msg.role === "user" ? t.chats.customer : msg.role === "assistant" ? t.chats.agent : msg.role}:
                                                                </span>
                                                            )}
                                                            <p className="text-sm text-muted-foreground line-clamp-1">
                                                                {msg.content.length > 80 ? `${msg.content.substring(0, 80)}...` : msg.content}
                                                            </p>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                                        <MessageCircle className="h-3 w-3" />
                                                        <span>
                                                            {chat.messageCount === 1
                                                                ? fmt(t.chats.messageCount, { count: chat.messageCount })
                                                                : fmt(t.chats.messagesCount, { count: chat.messageCount })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDate(chat.updatedAt)}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>

                    {pagination.totalPages > 1 && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        {fmt(t.chats.showing, {
                                            start: paginationInfo.start,
                                            end: paginationInfo.end,
                                            total: pagination.total,
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            {t.common.previous}
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                                let pageNum: number;
                                                if (pagination.totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= pagination.totalPages - 2) {
                                                    pageNum = pagination.totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={currentPage === pageNum ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className="w-9 h-9"
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                                            disabled={currentPage === pagination.totalPages}
                                        >
                                            {t.common.next}
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}

export default function ChatsListPageWrapper() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
            <ChatsListPage />
        </Suspense>
    );
}
