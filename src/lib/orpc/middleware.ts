import { auth } from "@clerk/nextjs/server";
import { ORPCError, os } from "@orpc/server";

export const authMiddleware = os.middleware(async ({ next }) => {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "You must be signed in to access this resource",
    });
  }

  return next({
    context: {
      userId,
      orgId: orgId || null,
      orgRole: orgRole || null,
    },
  });
});

export const requireOrgMiddleware = os
  .$context<{ userId: string; orgId: string | null; orgRole: string | null }>()
  .middleware(async ({ context, next }) => {
    if (!context.orgId) {
      throw new ORPCError("FORBIDDEN", {
        message: "You must be part of an organization to access this resource",
      });
    }

    return next({
      context: {
        ...context,
        orgId: context.orgId,
      },
    });
  });

export const requireAdminMiddleware = os
  .$context<{ userId: string; orgId: string; orgRole: string | null }>()
  .middleware(async ({ context, next }) => {
    if (context.orgRole !== "org:admin") {
      throw new ORPCError("FORBIDDEN", {
        message: "You must be an organization admin to access this resource",
      });
    }

    return next({ context });
  });
