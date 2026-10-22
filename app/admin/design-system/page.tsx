import { notFound } from "next/navigation";
import { DesignGallery } from "@/app/ui/gallery/DesignGallery";
import { SuperAdminPage } from "../components/SuperAdminPage";

/**
 * Dev-only gallery of every portal primitive, in both themes.
 * Not available in production builds.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <SuperAdminPage>
      <DesignGallery home={{ label: "Admin", href: "/admin" }} />
    </SuperAdminPage>
  );
}
