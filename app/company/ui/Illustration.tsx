import {
  BarChart3,
  Building2,
  Bus,
  CalendarDays,
  Car,
  CarTaxiFront,
  CircleCheck,
  ClipboardList,
  Fuel,
  Handshake,
  KeyRound,
  Lightbulb,
  MapPin,
  Map as MapIcon,
  Milestone,
  Package,
  Receipt,
  Search,
  Signpost,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Named pictograms used for thumbnails, hero spots and empty states across the company portal. */
export type IllustrationName =
  | "car" | "taxi" | "bus" | "minibus" | "busstop" | "pin" | "map" | "bulb" | "moneybag" | "calendar"
  | "chart" | "trend" | "people" | "building" | "receipt" | "clipboard" | "fuel" | "motorway"
  | "sparkles" | "check" | "key" | "handshake" | "search" | "package";

const ICONS: Record<IllustrationName, LucideIcon> = {
  car: Car, taxi: CarTaxiFront, bus: Bus, minibus: Bus, busstop: Signpost, pin: MapPin, map: MapIcon,
  bulb: Lightbulb, moneybag: Wallet, calendar: CalendarDays, chart: BarChart3, trend: TrendingUp,
  people: Users, building: Building2, receipt: Receipt, clipboard: ClipboardList, fuel: Fuel,
  motorway: Milestone, sparkles: Sparkles, check: CircleCheck, key: KeyRound, handshake: Handshake,
  search: Search, package: Package,
};

/** Brand tone per pictogram, so thumbnails read as a family: orange = money/attention, navy = operations. */
const ORANGE = new Set<IllustrationName>(["moneybag", "receipt", "bulb", "sparkles", "fuel", "trend", "chart"]);

/**
 * Hero pictogram: line icon on a soft gradient disc inside concentric rings.
 * Decorative only (aria-hidden); sized by `size` so it never shifts layout.
 */
export function Illustration({ name, size = 56, className, tone }: { name: IllustrationName; size?: number; className?: string; tone?: "orange" | "navy" }) {
  const Icon = ICONS[name];
  const orange = tone ? tone === "orange" : ORANGE.has(name);
  const disc = Math.round(size * 0.62);
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border border-[var(--divider)] bg-[var(--tile-bg)]/50" />
      <span className="absolute inset-[11%] rounded-full border border-[var(--divider)] bg-[var(--bg-card)]" />
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(28,27,77,0.45)]",
          orange
            ? "bg-[linear-gradient(145deg,#f7a15f_0%,var(--cort-orange)_55%,#d9500f_100%)]"
            : "bg-[linear-gradient(145deg,#4a48a8_0%,var(--cort-navy)_60%,#12113a_100%)]",
        )}
        style={{ width: disc, height: disc }}
      >
        <Icon strokeWidth={1.6} style={{ width: disc * 0.46, height: disc * 0.46 }} />
      </span>
    </span>
  );
}

/** Pictogram in a soft rounded tile — list thumbnails and card icons, with optional corner badge. */
export function IllustrationTile({
  name,
  size = "md",
  badge,
  className,
  tone,
}: {
  name: IllustrationName;
  size?: "sm" | "md" | "lg";
  badge?: React.ReactNode;
  className?: string;
  tone?: "orange" | "navy";
}) {
  const Icon = ICONS[name];
  const orange = tone ? tone === "orange" : ORANGE.has(name);
  const box = { sm: "size-10 rounded-[12px]", md: "size-12 rounded-[14px]", lg: "size-16 rounded-[18px]" }[size];
  const icon = { sm: 18, md: 22, lg: 26 }[size];
  return (
    <span
      aria-hidden={badge == null ? true : undefined}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        orange ? "bg-[var(--tone-brand-soft)] text-[var(--cort-orange)]" : "bg-[var(--tile-bg)] text-[var(--cort-navy-ring,var(--cort-navy))]",
        box,
        className,
      )}
    >
      <Icon size={icon} strokeWidth={1.7} />
      {badge != null && <span className="absolute -top-2 -end-2">{badge}</span>}
    </span>
  );
}
