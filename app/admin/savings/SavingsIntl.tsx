"use client";

import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { loadMessages } from "@/i18n/load-messages";

const messages = loadMessages("en");

/**
 * The savings dashboard is shared with the company portal and reads the company message bundle.
 * The admin portal has no next-intl provider, so the savings pages render it in English here.
 */
export function SavingsIntl({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Karachi">
      {children}
    </NextIntlClientProvider>
  );
}
