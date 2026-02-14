"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

import { WidgetCustomizer } from "@/components/chat/widget-customizer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/context";

interface Organization {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Chat {
  id: string;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function DashboardPage() {
  const router = useRouter();
  const { orgId, isLoaded } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [latestChat, setLatestChat] = useState<Chat | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState("prompt");
  const t = useT();

  useEffect(() => {
    if (!isLoaded) return;

    if (!orgId) {
      router.replace("/sign-in");
      return;
    }

    fetchOrganization(orgId);
    fetchLatestChat(orgId);
  }, [orgId, isLoaded, router]);

  const fetchOrganization = async (id: string) => {
    try {
      const { orpc } = await import("@/lib/orpc/client");
      const data = await orpc.organizations.get({ orgId: id });
      setOrganization(data);
    } catch (error) {
      // Error handled silently
    } finally {
      setIsFetching(false);
    }
  };

  const fetchLatestChat = async (id: string) => {
    try {
      const { orpc } = await import("@/lib/orpc/client");
      const result = await orpc.chats.list({ orgId: id });
      if (result.chats.length > 0) {
        setLatestChat(result.chats[0]);
      }
    } catch (error) {
      // Error handled silently
    }
  };

  if (isFetching || !isLoaded || !orgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t.dashboard.orgNotFound}</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t.dashboard.title}</h1>
        <p className="text-muted-foreground mt-1">
          {t.dashboard.subtitle}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="prompt">{t.dashboard.tabs.prompt}</TabsTrigger>
          <TabsTrigger value="colors">{t.dashboard.tabs.colors}</TabsTrigger>
          <TabsTrigger value="logo">{t.dashboard.tabs.logo}</TabsTrigger>
          <TabsTrigger value="texts">{t.dashboard.tabs.texts}</TabsTrigger>
          <TabsTrigger value="quick-replies">{t.dashboard.tabs.quickReplies}</TabsTrigger>
          <TabsTrigger value="proactive">{t.dashboard.tabs.proactive}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6">
        <WidgetCustomizer
          orgId={orgId}
          chat={latestChat}
          initialTab={activeTab}
        />
      </div>
    </div>
  );
}
