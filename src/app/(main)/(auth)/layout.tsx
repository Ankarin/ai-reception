import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
      appearance={{
        baseTheme: shadcn,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
