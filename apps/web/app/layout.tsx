import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuPulse AI",
  description: "Dokümanlarınızdan bilgi grafiği ve kaynaklı yanıtlar",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // safe areas // HIG: layout
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

/** Applies the Settings appearance choice before paint, so there is no flash. */
const themeScript = `try{var t=localStorage.getItem("dp-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("dp-contrast")==="more")document.documentElement.dataset.contrast="more"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
