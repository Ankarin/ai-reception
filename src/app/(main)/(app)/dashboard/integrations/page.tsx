"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Send,
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orpc } from "@/lib/orpc/client";
import { useT } from "@/lib/i18n/context";

function useBaseUrl() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1" />
          {t.integrations.copied}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1" />
          {t.integrations.copyUrl}
        </>
      )}
    </Button>
  );
}

function CodeBlock({ children, copyValue }: { children: string; copyValue?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-md p-3 text-sm overflow-x-auto font-mono">
        <code>{children}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={copyValue || children} />
      </div>
    </div>
  );
}

function WebhookUrlDisplay({ url, label }: { url: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
          {url}
        </code>
        <CopyButton value={url} />
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  description,
  children,
  color,
  enabled,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  color: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useT();

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className="rounded-lg p-2 shrink-0"
              style={{ backgroundColor: `${color}15`, color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{title}</CardTitle>
                <Badge
                  variant={enabled ? "default" : "secondary"}
                  className="cursor-pointer text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                >
                  {enabled ? t.integrations.enabled : t.integrations.disabled}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {expanded && <CardContent className="space-y-6 pt-0">{children}</CardContent>}
    </Card>
  );
}

function StepBlock({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground">{detail}</p>
      {children}
    </div>
  );
}

export default function IntegrationsPage() {
  const { orgId } = useAuth();
  const t = useT();
  const baseUrl = useBaseUrl();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [resendApiKey, setResendApiKey] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [elevenlabsEnabled, setElevenlabsEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await orpc.integrations.get({ orgId });
      setTelegramBotToken(data.telegramBotToken || "");
      setTelegramEnabled(data.telegramEnabled === 1);
      setResendApiKey(data.resendApiKey || "");
      setEmailEnabled(data.emailEnabled === 1);
      setElevenlabsEnabled(data.elevenlabsEnabled === 1);
      setWebhookSecret(data.webhookSecret || "");
    } catch (error) {
      console.error("Failed to load integration settings:", error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (overrides?: Record<string, unknown>) => {
    if (!orgId) return;
    setSaving(true);
    try {
      const secret = webhookSecret || crypto.randomUUID();
      if (!webhookSecret) setWebhookSecret(secret);

      const data = await orpc.integrations.update({
        orgId,
        telegramBotToken: telegramBotToken || null,
        telegramEnabled: telegramEnabled ? 1 : 0,
        resendApiKey: resendApiKey || null,
        emailEnabled: emailEnabled ? 1 : 0,
        elevenlabsEnabled: elevenlabsEnabled ? 1 : 0,
        webhookSecret: secret,
        ...overrides,
      });

      if (data.webhookSecret) setWebhookSecret(data.webhookSecret);

      toast.success(t.integrations.settingsSaved);
    } catch (error) {
      console.error("Failed to save integration settings:", error);
      toast.error(t.integrations.settingsSaveError);
    } finally {
      setSaving(false);
    }
  };

  const generateSecret = async () => {
    const newSecret = crypto.randomUUID();
    setWebhookSecret(newSecret);
    await saveSettings({ webhookSecret: newSecret });
  };

  const telegramWebhookUrl = `${baseUrl}/api/webhooks/telegram/${orgId}`;
  const emailWebhookUrl = `${baseUrl}/api/webhooks/email/${orgId}`;
  const elevenlabsWebhookUrl = `${baseUrl}/api/webhooks/elevenlabs/${orgId}`;

  const setWebhookCurl = `curl -X POST "https://api.telegram.org/bot${telegramBotToken || "<YOUR_BOT_TOKEN>"}/setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "${telegramWebhookUrl}?secret=${webhookSecret || "<YOUR_WEBHOOK_SECRET>"}"}'`;

  const elevenlabsPayload = `{
  "call_id": "abc123",
  "transcript": "...",
  "extracted_data": {
    "booking": {
      "patient_name": "John Smith",
      "patient_phone": "+1234567890",
      "date": "2026-03-15",
      "time": "10:00",
      "service_name": "Teeth Cleaning"
    }
  }
}`;

  if (!orgId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.integrations.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.integrations.subtitle}
          </p>
        </div>
        <Button onClick={() => saveSettings()} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? t.integrations.savingSettings : t.integrations.saveSettings}
        </Button>
      </div>

      {/* Webhook secret section */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                {t.integrations.securityNotice}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-500/80">
                {t.integrations.securityNoticeDetail}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t.integrations.webhookSecretLabel}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-background rounded-md px-3 py-2 text-sm font-mono break-all border">
                {webhookSecret ? (showSecret ? webhookSecret : "••••••••••••••••••••••••••••••••••••") : "—"}
              </code>
              {webhookSecret && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              )}
              {webhookSecret && <CopyButton value={webhookSecret} />}
              <Button
                variant="outline"
                size="sm"
                onClick={generateSecret}
                className="shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {webhookSecret ? t.integrations.regenerateSecret : t.integrations.generateSecret}
              </Button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-500/80">
              {t.integrations.webhookSecretHint}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Telegram */}
      <IntegrationCard
        icon={Send}
        title={t.integrations.telegram.title}
        description={t.integrations.telegram.description}
        color="#229ED9"
        enabled={telegramEnabled}
        onToggle={() => {
          setTelegramEnabled(!telegramEnabled);
          saveSettings({ telegramEnabled: !telegramEnabled ? 1 : 0 });
        }}
      >
        <StepBlock
          title={t.integrations.telegram.step1}
          detail={t.integrations.telegram.step1Detail}
        >
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            @BotFather <ExternalLink className="h-3 w-3" />
          </a>
        </StepBlock>

        <StepBlock
          title={t.integrations.telegram.step2}
          detail={t.integrations.telegram.step2Detail}
        >
          <div className="space-y-1.5">
            <Label htmlFor="telegramBotToken">{t.integrations.telegram.botToken}</Label>
            <PasswordInput
              id="telegramBotToken"
              value={telegramBotToken}
              onChange={setTelegramBotToken}
              placeholder={t.integrations.telegram.botTokenPlaceholder}
            />
          </div>
        </StepBlock>

        <StepBlock
          title={t.integrations.telegram.step3}
          detail={t.integrations.telegram.step3Detail}
        >
          <WebhookUrlDisplay url={telegramWebhookUrl} label={t.integrations.webhookUrl} />
          <div className="space-y-1.5 mt-3">
            <p className="text-sm font-medium text-muted-foreground">
              {t.integrations.telegram.setWebhookCommand}
            </p>
            <CodeBlock>{setWebhookCurl}</CodeBlock>
          </div>
        </StepBlock>
      </IntegrationCard>

      {/* Email */}
      <IntegrationCard
        icon={Mail}
        title={t.integrations.email.title}
        description={t.integrations.email.description}
        color="#7C3AED"
        enabled={emailEnabled}
        onToggle={() => {
          setEmailEnabled(!emailEnabled);
          saveSettings({ emailEnabled: !emailEnabled ? 1 : 0 });
        }}
      >
        <StepBlock
          title={t.integrations.email.step1}
          detail={t.integrations.email.step1Detail}
        >
          <a
            href="https://resend.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            resend.com <ExternalLink className="h-3 w-3" />
          </a>
        </StepBlock>

        <StepBlock
          title={t.integrations.email.step2}
          detail={t.integrations.email.step2Detail}
        >
          <div className="space-y-1.5">
            <Label htmlFor="resendApiKey">{t.integrations.email.resendApiKey}</Label>
            <PasswordInput
              id="resendApiKey"
              value={resendApiKey}
              onChange={setResendApiKey}
              placeholder={t.integrations.email.resendApiKeyPlaceholder}
            />
          </div>
        </StepBlock>

        <StepBlock
          title={t.integrations.email.step3}
          detail={t.integrations.email.step3Detail}
        >
          <WebhookUrlDisplay url={emailWebhookUrl} label={t.integrations.webhookUrl} />
        </StepBlock>
      </IntegrationCard>

      {/* ElevenLabs */}
      <IntegrationCard
        icon={Phone}
        title={t.integrations.elevenlabs.title}
        description={t.integrations.elevenlabs.description}
        color="#0F172A"
        enabled={elevenlabsEnabled}
        onToggle={() => {
          setElevenlabsEnabled(!elevenlabsEnabled);
          saveSettings({ elevenlabsEnabled: !elevenlabsEnabled ? 1 : 0 });
        }}
      >
        <StepBlock
          title={t.integrations.elevenlabs.step1}
          detail={t.integrations.elevenlabs.step1Detail}
        >
          <a
            href="https://elevenlabs.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            elevenlabs.io <ExternalLink className="h-3 w-3" />
          </a>
        </StepBlock>

        <StepBlock
          title={t.integrations.elevenlabs.step2}
          detail={t.integrations.elevenlabs.step2Detail}
        >
          <WebhookUrlDisplay url={elevenlabsWebhookUrl} label={t.integrations.webhookUrl} />
        </StepBlock>

        <StepBlock
          title={t.integrations.elevenlabs.step3}
          detail={t.integrations.elevenlabs.step3Detail}
        >
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              {t.integrations.elevenlabs.payloadFormat}
            </p>
            <CodeBlock>{elevenlabsPayload}</CodeBlock>
          </div>
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              source: "elevenlabs"
            </Badge>
          </div>
        </StepBlock>
      </IntegrationCard>
    </div>
  );
}
