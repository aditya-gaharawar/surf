import "@/styles/globals.css";

import { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "../components/providers";
import { ChatProvider } from "@/lib/chat-context";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "CUA - WEBSPACEAI Computer Use Agent",
  description:
    "WEBSPACEAI computer-use assistant for operating a virtual desktop through natural language instructions",
  keywords: [
    "CUA",
    "WEBSPACEAI",
    "AI",
    "desktop",
    "automation",
    "Gemini",
    "virtual desktop",
    "sandbox",
  ],
  authors: [{ name: "WEBSPACEAI", url: "https://webspaceai.in" }],
  icons: {
    icon: "/img/logo.png",
    shortcut: "/img/logo.png",
    apple: "/img/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <Providers>
          <ChatProvider>
            <Toaster position="top-center" richColors />
            {children}
            <Analytics />
          </ChatProvider>
        </Providers>
      </body>
    </html>
  );
}
