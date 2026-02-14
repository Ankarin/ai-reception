"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import { X } from "lucide-react";
import { toast } from "sonner";

import { Loader } from "@/components/ai-elements/loader";
import { WebsiteWidget } from "@/components/chat/website-widget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { CHAT_NOT_CREATED } from "@/lib/chat/constants";
import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetCustomization,
} from "@/lib/widget/defaults";
import { useT } from "@/lib/i18n/context";
import { t as fmt } from "@/lib/i18n/utils";

interface Chat {
  id: string;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WidgetCustomizerProps {
  orgId: string;
  chat: Chat | null;
  initialTab?: string;
}

export function WidgetCustomizer({
  orgId,
  chat,
  initialTab = "prompt",
}: WidgetCustomizerProps) {
  const [settings, setSettings] = useState<WidgetCustomization>({
    ...DEFAULT_WIDGET_CONFIG,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showRemoveLogoDialog, setShowRemoveLogoDialog] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  const t = useT();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/widget-settings`,
        );
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [orgId]);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const { orpc } = await import("@/lib/orpc/client");
        const org = await orpc.organizations.get({ orgId });
        setSystemPrompt(org.prompt || "");
      } catch (error) {
        console.error("Failed to load prompt:", error);
      } finally {
        setIsLoadingPrompt(false);
      }
    };

    fetchPrompt();
  }, [orgId]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const finalSettings = { ...settings };

      if (selectedLogoFile) {
        // Delete old logo first
        if (settings.logoUrl) {
          try {
            await fetch("/api/upload/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: settings.logoUrl }),
            });
          } catch (deleteError) {
            console.warn("Error deleting old logo:", deleteError);
          }
        }

        try {
          const formData = new FormData();
          formData.append("file", selectedLogoFile);

          const uploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.error || "Upload failed");
          }

          const uploadData = await uploadResponse.json();
          finalSettings.logoKey = uploadData.key;
          finalSettings.logoUrl = uploadData.url;
        } catch (error: any) {
          toast.error(fmt(t.customizer.logo.uploadError, { error: error.message || "Unknown error" }));
          setIsSaving(false);
          return;
        }
      }

      const response = await fetch(
        `/api/organizations/${orgId}/widget-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(finalSettings),
        },
      );

      if (response.ok) {
        const savedData = await response.json();
        setSettings(savedData);
        setSelectedLogoFile(null);
        setLogoPreviewUrl(null);
        toast.success(t.customizer.saveSuccess);
      } else {
        toast.error(t.customizer.saveError);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t.customizer.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (
    key: keyof WidgetCustomization,
    value: string | number | boolean | string[],
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = async () => {
    setIsSaving(true);

    try {
      // Delete old logo if exists
      if (settings.logoUrl) {
        try {
          await fetch("/api/upload/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: settings.logoUrl }),
          });
        } catch (deleteError) {
          console.warn("Error deleting logo:", deleteError);
        }
      }

      const response = await fetch(
        `/api/organizations/${orgId}/widget-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(DEFAULT_WIDGET_CONFIG),
        },
      );

      if (response.ok) {
        const savedData = await response.json();
        setSettings(savedData);
        setSelectedLogoFile(null);
        setLogoPreviewUrl(null);
        toast.success(t.customizer.resetSuccess);
      } else {
        toast.error(t.customizer.resetError);
      }
    } catch (error) {
      console.error("Failed to reset settings:", error);
      toast.error(t.customizer.resetError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    setIsSaving(true);

    try {
      // Delete logo from storage
      if (settings.logoUrl) {
        try {
          await fetch("/api/upload/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: settings.logoUrl }),
          });
        } catch (deleteError) {
          console.warn("Failed to delete logo file:", deleteError);
        }
      }

      const updatedSettings = {
        ...settings,
        logoKey: "",
        logoUrl: "",
      };

      const response = await fetch(
        `/api/organizations/${orgId}/widget-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedSettings),
        },
      );

      if (response.ok) {
        const savedData = await response.json();
        setSettings(savedData);
        setSelectedLogoFile(null);
        setLogoPreviewUrl(null);
        toast.success(t.customizer.logo.removeSuccess);
      } else {
        toast.error(t.customizer.logo.removeError);
      }
    } catch (error) {
      console.error("Failed to remove logo:", error);
      toast.error(t.customizer.logo.removeError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setSelectedLogoFile(file);

    const previewUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(previewUrl);
  };

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const widgetCustomization = useMemo(
    () => ({
      ...settings,
      logoUrl: logoPreviewUrl || settings.logoUrl,
    }),
    [settings, logoPreviewUrl],
  );

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const { orpc } = await import("@/lib/orpc/client");
      const org = await orpc.organizations.get({ orgId });
      await orpc.organizations.update({
        orgId,
        name: org.name,
        prompt: systemPrompt || null,
      });
      toast.success(t.customizer.systemPrompt.saveSuccess);
    } catch (error) {
      console.error("Failed to save prompt:", error);
      toast.error(t.customizer.systemPrompt.saveError);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
      <div className="space-y-6">
        {initialTab === "prompt" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.customizer.systemPrompt.title}</CardTitle>
                <CardDescription>
                  {t.customizer.systemPrompt.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingPrompt ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader className="h-8 w-8" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="systemPrompt">{t.customizer.systemPrompt.label}</Label>
                      <Textarea
                        id="systemPrompt"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                        placeholder={t.customizer.systemPrompt.placeholder}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t.customizer.systemPrompt.hint}
                      </p>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={handleSavePrompt}
                        disabled={isSavingPrompt}
                      >
                        {isSavingPrompt ? t.customizer.systemPrompt.savingButton : t.customizer.systemPrompt.saveButton}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {initialTab === "colors" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.customizer.colors.title}</CardTitle>
                <CardDescription>
                  {t.customizer.colors.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">{t.customizer.colors.primaryColor}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) =>
                          updateSetting("primaryColor", e.target.value)
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) =>
                          updateSetting("primaryColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backgroundColor">{t.customizer.colors.backgroundColor}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="backgroundColor"
                        type="color"
                        value={settings.backgroundColor}
                        onChange={(e) =>
                          updateSetting("backgroundColor", e.target.value)
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={settings.backgroundColor}
                        onChange={(e) =>
                          updateSetting("backgroundColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">{t.customizer.colors.secondaryColor}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) =>
                          updateSetting("secondaryColor", e.target.value)
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={settings.secondaryColor}
                        onChange={(e) =>
                          updateSetting("secondaryColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="textPrimaryColor">{t.customizer.colors.textPrimaryColor}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="textPrimaryColor"
                        type="color"
                        value={settings.textPrimaryColor}
                        onChange={(e) =>
                          updateSetting("textPrimaryColor", e.target.value)
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={settings.textPrimaryColor}
                        onChange={(e) =>
                          updateSetting("textPrimaryColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="textSecondaryColor">
                      {t.customizer.colors.textSecondaryColor}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="textSecondaryColor"
                        type="color"
                        value={settings.textSecondaryColor}
                        onChange={(e) =>
                          updateSetting("textSecondaryColor", e.target.value)
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={settings.textSecondaryColor}
                        onChange={(e) =>
                          updateSetting("textSecondaryColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="borderColor">{t.customizer.colors.borderColor}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="borderColor"
                        type="color"
                        value={settings.borderColor}
                        onChange={(e) =>
                          updateSetting("borderColor", e.target.value)
                        }
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={settings.borderColor}
                        onChange={(e) =>
                          updateSetting("borderColor", e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {initialTab === "logo" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.customizer.logo.title}</CardTitle>
                <CardDescription>
                  {t.customizer.logo.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logoFile">{t.customizer.logo.uploadLabel}</Label>
                  <Input
                    id="logoFile"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    disabled={isSaving}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t.customizer.logo.uploadHint}
                  </p>
                </div>

                {(logoPreviewUrl || settings.logoUrl) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t.customizer.logo.preview}</Label>
                      {settings.logoUrl && !logoPreviewUrl && (
                        <Button
                          onClick={() => setShowRemoveLogoDialog(true)}
                          disabled={isSaving}
                          variant="destructive"
                          size="sm"
                        >
                          {t.customizer.logo.removeButton}
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                      <Image
                        src={logoPreviewUrl || settings.logoUrl || ""}
                        alt={t.customizer.logo.preview}
                        width={settings.logoWidth || 40}
                        height={settings.logoHeight || 40}
                        className="object-contain"
                      />
                    </div>
                    {logoPreviewUrl && (
                      <p className="text-sm text-amber-600">
                        {t.customizer.logo.pendingUpload}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logoWidth">{t.customizer.logo.width}</Label>
                    <Input
                      id="logoWidth"
                      type="number"
                      value={settings.logoWidth || 40}
                      onChange={(e) =>
                        updateSetting(
                          "logoWidth",
                          Number.parseInt(e.target.value),
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logoHeight">{t.customizer.logo.height}</Label>
                    <Input
                      id="logoHeight"
                      type="number"
                      value={settings.logoHeight || 40}
                      onChange={(e) =>
                        updateSetting(
                          "logoHeight",
                          Number.parseInt(e.target.value),
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logoBorderRadius">{t.customizer.logo.borderRadius}</Label>
                    <Input
                      id="logoBorderRadius"
                      type="number"
                      min="0"
                      value={settings.logoBorderRadius ?? 8}
                      onChange={(e) =>
                        updateSetting(
                          "logoBorderRadius",
                          e.target.value === ""
                            ? 0
                            : Number.parseInt(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {initialTab === "texts" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.customizer.texts.title}</CardTitle>
                <CardDescription>
                  {t.customizer.texts.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headerTitle">{t.customizer.texts.headerTitle}</Label>
                  <Input
                    id="headerTitle"
                    type="text"
                    value={settings.headerTitle || ""}
                    onChange={(e) =>
                      updateSetting("headerTitle", e.target.value)
                    }
                    placeholder={t.customizer.texts.headerTitlePlaceholder}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.customizer.texts.headerTitleHint}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inputPlaceholder">{t.customizer.texts.inputPlaceholder}</Label>
                  <Input
                    id="inputPlaceholder"
                    type="text"
                    value={settings.inputPlaceholder || ""}
                    onChange={(e) =>
                      updateSetting("inputPlaceholder", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialMessage">{t.customizer.texts.initialMessage}</Label>
                  <Textarea
                    id="initialMessage"
                    value={settings.initialMessage || ""}
                    onChange={(e) =>
                      updateSetting("initialMessage", e.target.value)
                    }
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.customizer.texts.initialMessageHint}
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        )}

        {initialTab === "quick-replies" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.customizer.quickReplies.title}</CardTitle>
                <CardDescription>
                  {t.customizer.quickReplies.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <Label>{t.customizer.quickReplies.enableLabel}</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.customizer.quickReplies.enableHint}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableQuickReplies !== false}
                    onChange={(e) =>
                      updateSetting("enableQuickReplies", e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                </div>

                <div className={settings.enableQuickReplies === false ? "opacity-50 pointer-events-none" : ""}>
                  {(settings.quickReplies || []).map((reply, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        type="text"
                        value={reply}
                        onChange={(e) => {
                          const newReplies = [...(settings.quickReplies || [])];
                          newReplies[index] = e.target.value;
                          updateSetting("quickReplies", newReplies);
                        }}
                        placeholder={fmt(t.customizer.quickReplies.optionPlaceholder, { n: index + 1 })}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newReplies = (settings.quickReplies || []).filter(
                            (_, i) => i !== index,
                          );
                          updateSetting("quickReplies", newReplies);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newReplies = [...(settings.quickReplies || []), ""];
                      updateSetting("quickReplies", newReplies);
                    }}
                    className="w-full"
                  >
                    {t.customizer.quickReplies.addButton}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.customizer.quickReplies.hint}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {initialTab === "proactive" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t.customizer.proactive.title}</CardTitle>
                <CardDescription>
                  {t.customizer.proactive.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t.customizer.proactive.timeBasedTrigger}</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.customizer.proactive.timeBasedTriggerHint}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableTimeTrigger)}
                      onChange={(e) =>
                        updateSetting("enableTimeTrigger", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeTriggerSeconds">
                      {t.customizer.proactive.triggerAfter}
                    </Label>
                    <Input
                      id="timeTriggerSeconds"
                      type="number"
                      min="1"
                      max="300"
                      value={settings.timeTriggerSeconds || 15}
                      onChange={(e) =>
                        updateSetting(
                          "timeTriggerSeconds",
                          Number.parseInt(e.target.value) || 15,
                        )
                      }
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        )}
        <div className="flex items-center justify-end gap-4">
          <Button
            onClick={() => setShowResetDialog(true)}
            disabled={isSaving}
            variant="outline"
          >
            {t.customizer.resetToDefaults}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t.common.saving : t.customizer.saveChanges}
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-8 h-fit max-h-[calc(100vh-6rem)] overflow-auto">
        <WebsiteWidget
          orgId={orgId}
          chatId={chat?.id || CHAT_NOT_CREATED}
          customization={widgetCustomization}
          showResetButton={true}
        />
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={handleReset}
        title={t.customizer.resetDialog.title}
        description={t.customizer.resetDialog.description}
        confirmText={t.common.reset}
        cancelText={t.common.cancel}
        variant="destructive"
      />

      <ConfirmDialog
        open={showRemoveLogoDialog}
        onOpenChange={setShowRemoveLogoDialog}
        onConfirm={handleRemoveLogo}
        title={t.customizer.removeLogoDialog.title}
        description={t.customizer.removeLogoDialog.description}
        confirmText={t.common.remove}
        cancelText={t.common.cancel}
        variant="destructive"
      />
    </div>
  );
}
