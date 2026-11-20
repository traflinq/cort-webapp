import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./lib/contexts/auth-context";
import { AdminThemeScript } from "./admin/lib/theme-script";
import { geistSans, geistMono, notoSansArabic, jakarta } from "./fonts";

export const metadata: Metadata = {
  title: "Traflinq Portal",
  description: "Traflinq Portal",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} ${jakarta.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
