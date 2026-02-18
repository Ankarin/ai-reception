import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/chat/mcp-server";
import {
  getOrgIntegrationSettings,
  verifyOrgWebhookSecret,
} from "@/lib/utils/integration-settings";

async function handleMcpRequest(
  request: Request,
  orgId: string,
): Promise<Response> {
  const settings = await getOrgIntegrationSettings(orgId);
  if (!settings || !settings.elevenlabsEnabled) {
    return new Response(JSON.stringify({ error: "Integration not enabled" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!verifyOrgWebhookSecret(request, settings.webhookSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = createMcpServer(orgId);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — each request is independent
  });

  await server.connect(transport);

  return transport.handleRequest(request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  return handleMcpRequest(request, orgId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  return handleMcpRequest(request, orgId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  return handleMcpRequest(request, orgId);
}
