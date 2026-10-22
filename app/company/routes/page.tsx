"use client";

import { useEffect, useMemo, useRef, useState, useCallback, useId } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAppSelector, useAppDispatch } from "@/app/lib/store/hooks";
import { selectCompany, fetchCompanyFeatures, selectCompanyFeatures } from "@/app/lib/store/slices/companySlice";
import { apiClient } from "@/app/lib/services/api-client";
import { useAuth } from "@/app/lib/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardSkeleton,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  FormGrid,
  InlineError,
  Input,
  PageHeader,

  Spinner,
  focusRing,
} from "@/app/ui";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import { useCompanyBasePath } from "../lib/use-company-base-path";
import { useGooglePlacesAutocomplete } from "@/app/hooks/useGooglePlacesAutocomplete";
import { getPhoneValidationError, PHONE_MAX_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneInput } from "@/app/lib/utils/phone";
import { getOfficeStops } from "@/app/lib/utils/routeStops";
import { confidenceTone, stopsForDirection, type AiRecommendation, type CompanyRouteStop } from "./lib/route-types";
import {
  Activity,
  ArrowRight,
  Bus,
  Car,
  CheckCheck,
  CheckCircle2,
  MapPin,
  Plus,
  Sparkles,
  Sunrise,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from "lucide-react";

type CompanyRoute = {
  id: number;
  name: string;
  route_stops?: CompanyRouteStop[];
  vehicles?: { plate_number: string; model: string } | null;
  users?: { full_name: string; phone: string } | null;
  employee_route_assignments?: {
    users?: { full_name: string; email: string; phone: string } | null;
  }[];
};

// ─── Stop pills ───────────────────────────────────────────────────────────────

function StopPills({ stops }: { stops: CompanyRouteStop[] }) {
  const t = useTranslations("company.routes");
  const officeIds = new Set(getOfficeStops(stops).map((s) => s.id));
  const sorted = stopsForDirection(stops, "MORNING");
  if (sorted.length === 0) return <span className="text-xs italic text-fg-muted">{t("noStops")}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map((stop) => {
        const isOffice = officeIds.has(stop.id);
        return (
          <Badge key={stop.id} tone={isOffice ? "brand" : "neutral"} size="sm">
            {isOffice ? `${t("office")} · ${stop.name}` : stop.name}
          </Badge>
        );
      })}
    </div>
  );
}

// ─── Address input with Places suggestions (accessible combobox) ─────────────

function AddressInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  loading?: boolean;
  className?: string;
}) {
  const t = useTranslations("company.routes");
  const listId = useId();
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { suggestions, isLoading, search, clearSuggestions, refreshToken } = useGooglePlacesAutocomplete({ apiKey: googleMapsKey, country: "pk" });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleChange = (next: string) => {
    onChange(next);
    setActive(-1);
    if (googleMapsKey && next.trim().length >= 3) {
      search(next);
      setOpen(true);
    } else {
      clearSuggestions();
      setOpen(false);
    }
  };

  const select = (s: { display_name: string }) => {
    onChange(s.display_name);
    clearSuggestions();
    refreshToken();
    setOpen(false);
    setActive(-1);
  };

  const showList = open && suggestions.length > 0;
  const showEmpty = open && !isLoading && value.trim().length >= 3 && suggestions.length === 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        leftIcon={<MapPin aria-hidden="true" />}
        rightIcon={isLoading || loading ? <Spinner size="sm" /> : undefined}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && showList) {
            e.preventDefault();
            setActive((i) => Math.min(suggestions.length - 1, i + 1));
          } else if (e.key === "ArrowUp" && showList) {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (showList && active >= 0) select(suggestions[active]);
            else onSubmit?.();
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-elevated py-1 shadow-[var(--shadow-modal)]"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm text-fg", i === active && "bg-subtle")}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
              <span className="leading-snug">{s.display_name}</span>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg-muted shadow-[var(--shadow-modal)]">
          {t("addressNoResults")}
        </div>
      )}
    </div>
  );
}

// ─── AI Route Optimizer ──────────────────────────────────────────────────────

function AiRouteOptimizer({ companyId }: { companyId: number }) {
  const t = useTranslations("company.routes");
  const { companyPath } = useCompanyBasePath();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!address.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await apiClient.request<AiRecommendation>("/routes/recommend-for-address", {
        method: "POST",
        body: JSON.stringify({ address: address.trim(), company_id: companyId }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedAiRecommendation"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-brand-line">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />
            {t("aiOptimizerTitle")}
          </span>
        }
        description={t("aiOptimizerDescription")}
      />
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <AddressInput
            value={address}
            onChange={(v) => {
              setAddress(v);
              setResult(null);
              setError(null);
            }}
            onSubmit={handleAnalyze}
            placeholder={t("addressPlaceholder")}
            className="flex-1"
          />
          <Button onClick={handleAnalyze} disabled={!address.trim()} loading={loading} leftIcon={<Sparkles />}>
            {t("analyze")}
          </Button>
        </div>

        {error && <InlineError>{error}</InlineError>}

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg border border-brand-line bg-brand-soft/40 p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-fg">
                  <CheckCircle2 className="size-4 text-brand-ink" aria-hidden="true" />
                  {t("bestMatch", { routeName: result.routeName })}
                </span>
                <Badge tone={confidenceTone(result.confidence)} size="sm" dot>
                  {t("confidence", { level: result.confidence })}
                </Badge>
              </div>
              <p className="text-sm text-fg-secondary">{result.reason}</p>
              {result.routeId && (
                <Button asChild variant="link" size="sm" className="mt-2">
                  <Link href={companyPath(`/company/routes/${result.routeId}`)}>
                    {t("viewRouteDetails")} <ArrowRight className="rtl:-scale-x-100" />
                  </Link>
                </Button>
              )}
            </div>

            {result.alternativeRoutes.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{t("alternatives")}</p>
                <ul className="space-y-2">
                  {result.alternativeRoutes.map((alt) => (
                    <li key={alt.id}>
                      <Link
                        href={companyPath(`/company/routes/${alt.id}`)}
                        className={cn("flex items-start gap-3 rounded-lg border border-line bg-subtle px-4 py-3 transition-colors hover:bg-card", focusRing)}
                      >
                        <TrendingUp className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-fg">{alt.name}</span>
                          <span className="block text-xs text-fg-muted">{alt.reason}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-fg-muted rtl:-scale-x-100" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Employee drawer ─────────────────────────────────────────────────────

type AddEmployeeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  routes: CompanyRoute[];
  onSuccess: () => void;
};

const EMPTY_FORM = { full_name: "", email: "", phone: "", department: "", home_address: "", employee_id: "" };

function AddEmployeeDrawer({ open, onOpenChange, companyId, routes, onSuccess }: AddEmployeeDrawerProps) {
  const t = useTranslations("company.routes");
  const tEmployees = useTranslations("company.employees");
  const tCredentials = useTranslations("company.credentials");
  const tCommon = useTranslations("common");
  const radioName = useId();
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset everything when the drawer closes (render-time adjustment).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setForm(EMPTY_FORM);
      setSelectedRouteId(null);
      setAiRec(null);
      setAiError(null);
      setSubmitError(null);
      setDone(false);
      setCreatedCredentials(null);
    }
  }

  const runAiRecommend = useCallback(
    async (address: string) => {
      setAiLoading(true);
      setAiError(null);
      try {
        const data = await apiClient.request<AiRecommendation>("/routes/recommend-for-address", {
          method: "POST",
          body: JSON.stringify({ address, company_id: companyId }),
        });
        setAiRec(data);
        if (data.routeId) setSelectedRouteId(data.routeId);
      } catch {
        setAiError(t("couldNotGetAi"));
      } finally {
        setAiLoading(false);
      }
    },
    [companyId, t],
  );

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "home_address") {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (value.trim().length > 10) aiDebounceRef.current = setTimeout(() => void runAiRecommend(value.trim()), 900);
      else setAiRec(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) return;
    const phoneError = getPhoneValidationError(form.phone);
    if (phoneError) {
      setSubmitError(phoneError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1. Create the employee
      const created = await apiClient.request<{ data: { id: string; password?: string } }>("/employees/create", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
          home_address: form.home_address.trim() || undefined,
          employee_id: form.employee_id.trim() || undefined,
          company_id: companyId,
        }),
      });
      const userId = created?.data?.id;
      const password = created?.data?.password;

      // 2. Assign to route if selected
      if (selectedRouteId && userId) {
        await apiClient.request("/employee-route-assignments/assign", {
          method: "POST",
          body: JSON.stringify({ user_id: userId, route_id: selectedRouteId }),
        });
      }

      if (password) setCreatedCredentials({ email: form.email.trim(), password });
      setDone(true);
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("failedAddEmployee"));
    } finally {
      setSubmitting(false);
    }
  }

  const formId = `${radioName}-form`;

  return (
    <Drawer open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DrawerContent
        side="end"
        size="lg"
        title={t("addEmployee")}
        description={t("addEmployeeSubtitle")}
        footer={
          done ? (
            <Button onClick={() => onOpenChange(false)}>{tCredentials("done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" form={formId} loading={submitting} disabled={!form.full_name.trim() || !form.email.trim()} leftIcon={<UserPlus />}>
                {selectedRouteId ? t("addEmployeeAssign") : t("addEmployee")}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success-ink">
                <CheckCheck className="size-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-semibold text-fg">{t("employeeAdded")}</p>
                <p className="mt-1 text-sm text-fg-muted">
                  {selectedRouteId ? t("employeeAddedAssigned", { name: form.full_name }) : t("employeeAddedCreated", { name: form.full_name })}
                </p>
              </div>
            </div>
            {createdCredentials ? (
              <AccountCredentialsReveal
                email={createdCredentials.email}
                password={createdCredentials.password}
                fullName={form.full_name}
                subtitle={tCredentials("employeeAppSubtitle")}
                accountTypeKey="employee"
              />
            ) : (
              <SaveCredentialsNote accountTypeKey="employee" />
            )}
          </div>
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="space-y-5">
            <FormGrid cols={2}>
              <Field label={tEmployees("fullName")} required>
                <Input required value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} leftIcon={<User aria-hidden="true" />} />
              </Field>
              <Field label={t("employeeId")}>
                <Input value={form.employee_id} onChange={(e) => updateField("employee_id", e.target.value)} placeholder="EMP-001" />
              </Field>
            </FormGrid>
            <Field label={tEmployees("email")} required>
              <Input required type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} dir="ltr" />
            </Field>
            <FormGrid cols={2}>
              <Field label={tEmployees("phone")}>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={PHONE_MAX_LENGTH}
                  value={form.phone}
                  onChange={(e) => updateField("phone", sanitizePhoneInput(e.target.value))}
                  placeholder={PHONE_PLACEHOLDER}
                  dir="ltr"
                />
              </Field>
              <Field label={tEmployees("department")}>
                <Input value={form.department} onChange={(e) => updateField("department", e.target.value)} />
              </Field>
            </FormGrid>
            <Field label={t("homeAddress")} hint={t("aiAutoRecommendHint")} error={aiError ?? undefined}>
              <AddressInput value={form.home_address} onChange={(v) => updateField("home_address", v)} placeholder={t("addressPlaceholder")} loading={aiLoading} />
            </Field>

            {aiRec && (
              <div className="rounded-lg border border-brand-line bg-brand-soft/40 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-ink">{t("aiRecommendation")}</span>
                  <Badge tone={confidenceTone(aiRec.confidence)} size="sm" className="ms-auto">
                    {aiRec.confidence}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-fg">{aiRec.routeName}</p>
                <p className="mt-1 text-xs text-fg-muted">{aiRec.reason}</p>
              </div>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg">
                {t("assignToRoute")}
                {aiRec && <span className="ms-2 text-xs font-normal text-success-ink">{t("aiPreSelected")}</span>}
              </legend>
              <div role="radiogroup" aria-label={t("assignToRoute")} className="max-h-64 space-y-2 overflow-y-auto pe-1">
                <RouteRadio name={radioName} checked={selectedRouteId === null} onChange={() => setSelectedRouteId(null)} label={t("noRouteAssignment")} muted />
                {routes.map((route) => (
                  <RouteRadio
                    key={route.id}
                    name={radioName}
                    checked={selectedRouteId === route.id}
                    onChange={() => setSelectedRouteId(route.id)}
                    label={route.name}
                    description={`${t("passengersOnRoute", { count: route.employee_route_assignments?.length ?? 0 })}${route.vehicles ? ` · ${route.vehicles.plate_number}` : ""}`}
                    badge={aiRec?.routeId === route.id ? t("aiPick") : undefined}
                  />
                ))}
              </div>
            </fieldset>

            {submitError && <InlineError>{submitError}</InlineError>}
            <SaveCredentialsNote accountTypeKey="employee" />
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function RouteRadio({
  name,
  checked,
  onChange,
  label,
  description,
  badge,
  muted = false,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
  badge?: string;
  muted?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-brand-line bg-brand-soft/40" : "border-line hover:bg-subtle",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-brand" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("text-sm", muted ? "text-fg-muted" : "font-semibold text-fg")}>{label}</span>
          {badge && (
            <Badge tone="brand" size="sm" icon={<Sparkles aria-hidden="true" />}>
              {badge}
            </Badge>
          )}
        </span>
        {description && <span className="block text-xs text-fg-muted">{description}</span>}
      </span>
    </label>
  );
}

// ─── Route card ──────────────────────────────────────────────────────────────

function RouteCard({ route }: { route: CompanyRoute }) {
  const t = useTranslations("company.routes");
  const { companyPath } = useCompanyBasePath();
  const employees = route.employee_route_assignments?.map((a) => a.users).filter(Boolean) ?? [];
  const stops = route.route_stops ?? [];
  const morningStops = stops.filter((s) => s.morning_sequence != null).length;
  const href = companyPath(`/company/routes/${route.id}`);

  const stats = [
    { label: t("passengers"), value: String(employees.length), icon: Users },
    { label: t("stops"), value: t("stopsCount", { count: morningStops }), icon: MapPin },
    { label: t("vehicle"), value: route.vehicles?.plate_number ?? "—", icon: Car },
    { label: t("driver"), value: route.users?.full_name ?? t("unassigned"), icon: User },
  ];

  return (
    <Card interactive className="relative flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Bus className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-fg">
              {/* Stretched link: the whole card opens the route; inner controls sit above it. */}
              <Link href={href} className={cn("after:absolute after:inset-0 after:rounded-[inherit] after:content-['']", focusRing)}>
                {route.name}
              </Link>
            </h3>
            <p className="text-xs text-fg-muted">{t("routeNumber", { id: route.id })}</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="relative z-10 shrink-0">
          <Link href={companyPath(`/company/routes/${route.id}/track`)}>
            <Activity aria-hidden="true" />
            {t("track")}
          </Link>
        </Button>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-line bg-subtle px-3 py-2">
            <dt className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              <Icon className="size-3" aria-hidden="true" />
              {label}
            </dt>
            <dd className="truncate text-sm font-semibold text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning-ink">
          <Sunrise className="size-3" aria-hidden="true" />
          {t("morningStops")}
        </p>
        <StopPills stops={stops} />
      </div>

      {employees.length > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {employees.slice(0, 5).map((emp, i) => (
              <span
                key={i}
                className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-brand-soft text-[9px] font-bold text-brand-ink"
                title={emp?.full_name ?? ""}
              >
                {emp?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            ))}
            {employees.length > 5 && (
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-subtle text-[9px] font-bold text-fg-muted">
                +{employees.length - 5}
              </span>
            )}
          </div>
          <span className="text-xs text-fg-muted">{t("passengersCount", { count: employees.length })}</span>
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");
  const { companyPath } = useCompanyBasePath();
  const company = useAppSelector(selectCompany);
  const features = useAppSelector(selectCompanyFeatures);
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const isTrialUser = !!user?.is_trial;
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  const canManageShuttle = isTrialUser || (features.find((f) => f.feature_key === "shuttle_self_managed")?.is_enabled ?? false);
  const companyId = company?.id;

  useEffect(() => {
    if (companyId) dispatch(fetchCompanyFeatures(Number(companyId)));
  }, [companyId, dispatch]);

  // Fetch runs in the effect; `reloadKey` re-runs it (refresh shows the skeleton, reload keeps the list in place).
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.request<CompanyRoute[]>(`/routes?company_id=${companyId}`);
        if (cancelled) return;
        setRoutes(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("failedToLoadRoutes"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, t, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const refresh = useCallback(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => r.name.toLowerCase().includes(q) || r.vehicles?.plate_number?.toLowerCase().includes(q) || r.users?.full_name?.toLowerCase().includes(q));
  }, [routes, search]);

  if (!company) {
    return <EmptyState title={tCommon("errors.noCompanySelected")} />;
  }

  if (!company.services_enabled.shuttle_enabled) {
    return (
      <Card>
        <EmptyState icon={<Bus aria-hidden="true" />} title={t("shuttleDisabled")} description={t("shuttleDisabledDescription")} />
      </Card>
    );
  }

  const createButton = (
    <Button asChild variant={canManageShuttle ? "outline" : "primary"}>
      <Link href={companyPath("/company/routes/create")}>
        <Plus aria-hidden="true" />
        {t("createRoute")}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("pageDescription")}
        actions={
          canManageShuttle ? (
            <>
              {createButton}
              <Button onClick={() => setShowAddEmployee(true)} leftIcon={<UserPlus />}>
                {t("addEmployee")}
              </Button>
            </>
          ) : undefined
        }
      />

      <AiRouteOptimizer companyId={company.id} />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState title={t("failedToLoadRoutes")} message={error} onRetry={refresh} />
        </Card>
      ) : routes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bus aria-hidden="true" />}
            title={t("noRoutesAssigned")}
            description={canManageShuttle ? t("createRouteHint") : t("contactAdminRoutes")}
            action={canManageShuttle ? createButton : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <FilterBar search={{ value: search, onChange: setSearch, placeholder: t("searchPlaceholder") }} activeCount={search ? 1 : 0} onClear={() => setSearch("")}>
            <span className="text-sm text-fg-muted">{t("routesCount", { count: filtered.length })}</span>
          </FilterBar>
          {filtered.length === 0 ? (
            <Card>
              <EmptyState compact title={t("noRoutes")} />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          )}
        </div>
      )}

      <AddEmployeeDrawer open={showAddEmployee} onOpenChange={setShowAddEmployee} companyId={company.id} routes={routes} onSuccess={reload} />
    </div>
  );
}

