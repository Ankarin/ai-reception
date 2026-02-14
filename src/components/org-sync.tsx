"use client";

import { syncOrganization } from "@/lib/actions/sync-organization";
import { useOrganization } from "@clerk/nextjs";
import { useEffect } from "react";

export function OrgSync() {
  const { organization, isLoaded } = useOrganization();

  useEffect(() => {
    if (!isLoaded || !organization) {
      return;
    }

    syncOrganization().catch((error) => {
      console.error("Failed to sync organization:", error);
    });
  }, [isLoaded, organization?.id]);

  return null;
}
