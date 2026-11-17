import type { ReactNode } from "react";
import CompanyLayoutClient from "./CompanyLayoutClient";
import { CompanyThemeScript } from "./lib/theme-context";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Applies the saved company theme before paint (light by default). */}
      <CompanyThemeScript />
      <CompanyLayoutClient>{children}</CompanyLayoutClient>
    </>
  );
}
