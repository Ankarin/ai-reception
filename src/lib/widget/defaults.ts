export interface WidgetCustomization {
  primaryColor?: string;
  backgroundColor?: string;
  secondaryColor?: string;
  textPrimaryColor?: string;
  textSecondaryColor?: string;
  borderColor?: string;

  logoUrl?: string;
  logoKey?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoBorderRadius?: number;

  headerTitle?: string;

  inputPlaceholder?: string;
  initialMessage?: string;
  showBranding?: boolean;
  brandingText?: string;
  brandingLink?: string;

  enableQuickReplies?: boolean;
  quickReplies?: string[];
  enableTimeTrigger?: boolean;
  timeTriggerSeconds?: number;
}

export const DEFAULT_WIDGET_COLORS = {
  primaryColor: "#171717",
  backgroundColor: "#ffffff",
  secondaryColor: "#f5f5f5",
  textPrimaryColor: "#0a0a0a",
  textSecondaryColor: "#fafafa",
  borderColor: "#e5e5e5",
} as const;

export const DEFAULT_WIDGET_TEXTS = {
  headerTitle: "Support",
  inputPlaceholder: "What would you like to know?",
  initialMessage: "Hi there! 👋 How can I help you today?",
  showBranding: true,
  brandingText: "Powered by AI Receptionist",
  brandingLink: "#",
  enableQuickReplies: true,
  quickReplies: [] as string[],
} as const;

export const DEFAULT_WIDGET_LOGO = {
  logoUrl: "",
  logoKey: "",
  logoWidth: 100,
  logoHeight: 40,
  logoBorderRadius: 8,
} as const;

export const DEFAULT_WIDGET_BEHAVIOR = {
  enableTimeTrigger: true,
  timeTriggerSeconds: 15,
} as const;

export const DEFAULT_WIDGET_CONFIG: Required<WidgetCustomization> = {
  ...DEFAULT_WIDGET_COLORS,
  ...DEFAULT_WIDGET_TEXTS,
  ...DEFAULT_WIDGET_LOGO,
  ...DEFAULT_WIDGET_BEHAVIOR,
};
