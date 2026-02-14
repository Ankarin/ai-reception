import "server-only";

import { headers } from "next/headers";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { router } from "./router";

type OrpcClient = RouterClient<typeof router, Record<string, unknown>>;

const createClient = () =>
  createRouterClient(router, {
    context: async () => ({
      headers: await headers(),
    }),
  });

export const orpcServer: OrpcClient =
  globalThis.$orpcClient ?? (globalThis.$orpcClient = createClient());

declare global {
  var $orpcClient: OrpcClient | undefined;
}
