import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";

import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/header";
import { LocaleProvider } from "@/lib/i18n/context";
import { OrgSync } from "@/components/org-sync";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
      appearance={{
        baseTheme: shadcn,
      }}
    >
      <LocaleProvider>
        <SidebarProvider>
          <OrgSync />
          <AppSidebar />
          <main className="flex-1 flex h-screen w-full flex-col overflow-hidden">
            <Header />
            <div className="flex-1 overflow-auto">{children}</div>
          </main>
        </SidebarProvider>
      </LocaleProvider>
    </ClerkProvider>
  );
}
