import { del, put } from "@vercel/blob";

import { ORPCError, os } from "@orpc/server";
import { nanoid } from "nanoid";
import * as z from "zod";

import {
  authMiddleware,
  requireAdminMiddleware,
  requireOrgMiddleware,
} from "../middleware";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const uploadFile = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAdminMiddleware)
  .input(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      base64Data: z.string(),
    })
  )
  .handler(async ({ input, context }) => {
    const { filename, contentType, base64Data } = input;

    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid file type. Only images are allowed.",
      });
    }

    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > MAX_FILE_SIZE) {
      throw new ORPCError("BAD_REQUEST", {
        message: "File too large. Maximum size is 5MB.",
      });
    }

    const ext = filename.split(".").pop() || "png";
    const newFilename = `${context.orgId}-${nanoid()}.${ext}`;

    // Upload to Vercel Blob
    const blob = await put(newFilename, buffer, {
      access: "public",
      contentType,
    });

    return {
      key: newFilename,
      url: blob.url,
    };
  });

export const deleteFile = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAdminMiddleware)
  .input(
    z.object({
      url: z.string(),
    })
  )
  .handler(async ({ input, context }) => {
    const { url } = input;

    // Security check: ensure the URL contains the org ID
    if (!url.includes(context.orgId)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Unauthorized: Cannot delete this file",
      });
    }

    await del(url);

    return { success: true };
  });
