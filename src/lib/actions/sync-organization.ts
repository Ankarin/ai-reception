"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

import { db } from "@/db";
import { organizations } from "@/db/schema";

export async function syncOrganization() {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    if (!orgId) {
      return { success: false, error: "No organization selected" };
    }

    let organizationName = "Unnamed Organization";

    try {
      const client = await clerkClient();
      const org = await client.organizations.getOrganization({
        organizationId: orgId,
      });
      organizationName = org.name;
    } catch (error) {
      console.warn("Could not fetch organization name from Clerk:", error);
    }

    const [syncedOrg] = await db
      .insert(organizations)
      .values({
        id: orgId,
        name: organizationName,
      })
      .onConflictDoUpdate({
        target: organizations.id,
        set: {
          name: organizationName,
        },
      })
      .returning();

    return { success: true, organization: syncedOrg };
  } catch (error) {
    console.error("Error syncing organization:", error);
    return { success: false, error: String(error) };
  }
}
