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
    icon: "https://code.webspaceai.in/lovable-uploads/4bd26b7b-d74d-49e7-b1b5-75e7b8b47ca9.png",
    shortcut: "https://code.webspaceai.in/lovable-uploads/4bd26b7b-d74d-49e7-b1b5-75e7b8b47ca9.png",
    apple: "https://code.webspaceai.in/lovable-uploads/4bd26b7b-d74d-49e7-b1b5-75e7b8b47ca9.png",
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
        className="font-webspaceai"
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
