import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import "./fixes.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Personal Achievement Hub", template: "%s · Achievement Hub" },
  description: "Projects, competitions, certificates, education and experiences in one personal achievement hub.",
  openGraph: { type: "website", siteName: "Personal Achievement Hub" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            // Applies the saved theme before paint, and tints the phone's browser
            // bar to match (public-nav.tsx keeps it in step when toggled).
            __html: `(function(){var d=true;try{var t=localStorage.getItem('theme');d=t?t==='dark':true}catch(e){}document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';var m=document.createElement('meta');m.name='theme-color';m.content=d?'#012624':'#f7fafb';document.head.appendChild(m)})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><a className="skip-link" href="#main">Skip to content</a>{children}<Toaster richColors position="bottom-right" /></body>
    </html>
  );
}
