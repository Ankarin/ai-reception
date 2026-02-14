"use client";

import { ClerkLoaded, ClerkLoading, OrganizationSwitcher, UserButton } from "@clerk/nextjs";

import { SidebarTrigger } from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";

const UserButtonSkeleton = () => <Skeleton className="h-8 w-8 rounded-full" />;

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="hover:bg-accent hover:text-accent-foreground transition-colors" />
        </div>

        <div className="flex items-center gap-3">

          <OrganizationSwitcher hidePersonal={true} />

          <ClerkLoading>
            <UserButtonSkeleton />
          </ClerkLoading>

          <ClerkLoaded>
            <UserButton
              appearance={{
                elements: {
                  rootBox: "min-w-8 min-h-8",
                  userButtonAvatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-lg border-border/40",
                },
              }}
              fallback={<UserButtonSkeleton />}
            />
          </ClerkLoaded>
        </div>
      </div>
    </header>
  );
};

export default Header;
