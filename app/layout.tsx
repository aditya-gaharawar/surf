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
    icon: "/img/b5556be9-1da8-4fdb-a6b9-969b73491798 (1).png",
    shortcut: "/img/b5556be9-1da8-4fdb-a6b9-969b73491798 (1).png",
    apple: "/img/b5556be9-1da8-4fdb-a6b9-969b73491798 (1).png",
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
