import { notFound } from "next/navigation";
import { DesignGallery } from "@/app/ui/gallery/DesignGallery";

/**
 * Dev-only gallery of every portal primitive inside the company shell, so the translated
 * labels and RTL layout (/sa/company/design-system) can be reviewed. Not in the nav.
 */
export default function CompanyDesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery home={{ label: "Company", href: "/company" }} />;
}
