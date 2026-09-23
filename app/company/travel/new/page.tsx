"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "../../components/PageLayout";
import NewTravelBookingForm from "../NewTravelBookingForm";

export default function NewTravelBookingPage() {
  const t = useTranslations("company.travel");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-12">
      <PageHeader label={t("label")} title={t("newTitle")} />
      <NewTravelBookingForm onSuccess={() => router.push("/company/travel")} />
    </div>
  );
}
