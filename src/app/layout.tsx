import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Critpath — otimizador de parada de manutenção",
  description:
    "Programação de parada com restrição de recursos e motor de otimização em WASM: solver RCPSP, risco da data de partida por Monte Carlo e intervalo ótimo por Weibull censurado.",
  applicationName: "Critpath",
  authors: [{ name: "Igor Bahia" }],
  keywords: ["RCPSP", "turnaround", "parada", "manutenção", "scheduling", "Monte Carlo", "Weibull", "otimização"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t?t==='dark':true);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
