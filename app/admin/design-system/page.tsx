import { notFound } from "next/navigation";
import { DesignGallery } from "./DesignGallery";

/**
 * Dev-only gallery of every admin primitive, in both themes.
 * Not available in production builds.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
