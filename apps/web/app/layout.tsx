import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "../lib/auth/AuthProvider";
import { QueryProvider } from "../lib/query";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Clinic AI Receptionist",
  description: "Clinic AI Receptionist dashboard.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
