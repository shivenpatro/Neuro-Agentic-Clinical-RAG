import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neuro-Agentic Clinical RAG",
  description: "Neurosymbolic clinical decision support with explainable AI reasoning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#060a0f] antialiased">{children}</body>
    </html>
  );
}
