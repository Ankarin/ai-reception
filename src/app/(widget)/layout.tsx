// Widget layout WITHOUT ClerkProvider
// This prevents session conflicts when embedded in iframes on external domains

export default function WidgetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
