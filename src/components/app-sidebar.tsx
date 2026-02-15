"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";

import { useAuth } from "@clerk/nextjs";
import { BarChart3, MessageSquare, Settings, Search, Clock, ArrowUpDown, Stethoscope, CalendarDays, Plug } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/lib/i18n/context";

function AppSidebarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { orgId, orgRole } = useAuth();
  const { locale, setLocale } = useLocale();
  const t = useT();

  const isChatsPage = pathname === "/dashboard/chats";

  const updateSearchParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/chats?${params.toString()}`);
  }, [searchParams, router]);

  const sortBy = searchParams.get("sortBy") || "updatedAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const urlSearch = searchParams.get("search") || "";
  const pageSize = searchParams.get("pageSize") || "20";

  const [searchInput, setSearchInput] = useState(urlSearch);

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (searchInput === urlSearch) return;

    const timer = setTimeout(() => {
      updateSearchParams("search", searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, urlSearch, updateSearchParams]);

  const toggleSort = (newSortBy: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (sortBy === newSortBy) {
      params.set("sortOrder", sortOrder === "desc" ? "asc" : "desc");
    } else {
      params.set("sortBy", newSortBy);
      params.set("sortOrder", "desc");
    }

    router.push(`/dashboard/chats?${params.toString()}`);
  };

  return (
    <Sidebar>
      <SidebarContent>
        {orgId && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {orgRole === "org:admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => router.push("/dashboard")}
                      isActive={pathname === "/dashboard"}
                    >
                      <Settings className="h-4 w-4" />
                      <span>{t.sidebar.promptWidget}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/analytics")}
                    isActive={pathname === "/analytics"}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span>{t.sidebar.analytics}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/dashboard/services")}
                    isActive={pathname === "/dashboard/services"}
                  >
                    <Stethoscope className="h-4 w-4" />
                    <span>{t.sidebar.services}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/dashboard/bookings")}
                    isActive={pathname === "/dashboard/bookings"}
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>{t.sidebar.bookings}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/dashboard/chats")}
                    isActive={pathname.startsWith("/dashboard/chats")}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>{t.sidebar.chats}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {orgRole === "org:admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => router.push("/dashboard/integrations")}
                      isActive={pathname === "/dashboard/integrations"}
                    >
                      <Plug className="h-4 w-4" />
                      <span>{t.integrations.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isChatsPage && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>{t.sidebar.filters}</SidebarGroupLabel>
              <SidebarGroupContent className="space-y-4 px-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t.sidebar.search}</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={t.sidebar.searchPlaceholder}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>


                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t.sidebar.sortBy}</Label>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant={sortBy === "updatedAt" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSort("updatedAt")}
                      className="w-full justify-between text-xs h-8"
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {t.sidebar.lastActivity}
                      </span>
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={sortBy === "createdAt" ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSort("createdAt")}
                      className="w-full justify-between text-xs h-8"
                    >
                      <span className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t.sidebar.createdDate}
                      </span>
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t.sidebar.itemsPerPage}</Label>
                  <Select
                    value={pageSize}
                    onValueChange={(v) => updateSearchParams("pageSize", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-1 px-2 pb-2">
          <Button
            variant={locale === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("en")}
            className="flex-1 h-8 text-xs"
          >
            EN
          </Button>
          <Button
            variant={locale === "uk" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("uk")}
            className="flex-1 h-8 text-xs"
          >
            UA
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar() {
  return (
    <Suspense fallback={
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="flex items-center justify-center p-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
    }>
      <AppSidebarContent />
    </Suspense>
  );
}
