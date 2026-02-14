"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";
import {
  Loader2,
  MessageSquare,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/lib/i18n/context";
import { t as fmt } from "@/lib/i18n/utils";

interface Analytics {
  period: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalChats: number;
    totalMessages: number;
  };
}


export default function DashboardPage() {
  const { orgId } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    if (!orgId) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const { orpc } = await import("@/lib/orpc/client");
        const data = await orpc.analytics.get({ orgId });
        setAnalytics(data);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [orgId]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t.analytics.noData}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.analytics.title}</h1>
        <p className="text-muted-foreground mt-1">
          {t.analytics.subtitle}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-1 max-w-md">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.analytics.totalChats}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.metrics.totalChats}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fmt(t.analytics.messagesTotal, { count: analytics.metrics.totalMessages })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
