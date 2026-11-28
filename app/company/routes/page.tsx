"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCompanyAccess } from "../lib/access-context";
import { apiClient } from "../../lib/services/api-client";
import { Card } from "../components/Card";
import { AccountCredentialsReveal, SaveCredentialsNote } from "../components/AccountCredentialsReveal";
import {
  TABLE_CARD_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEADER_CELL_CLASS,
  TABLE_TOP_BAR_CLASS,
} from "../components/PageLayout";
import {
  Badge,
  Button,
  CardDescription,
  CardTitle,
  Drawer,
  DrawerContent,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  PageHeader,
  TableSkeletonRows,
  type BadgeTone,
} from "@/app/admin/ui";
import {
  Activity,
  ArrowRight,
  Building2,
  Bus,
  CheckCheck,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  UserPlus,
} from "@/app/components/icons";
import { useGooglePlacesAutocomplete } from "../../hooks/useGooglePlacesAutocomplete";
import {
  getPhoneValidationError,
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  sanitizePhoneInput,
} from "../../lib/utils/phone";
import { useCompanyLocale } from "../lib/locale-context";
import { formatLocaleNumber } from "../../lib/i18n/format";
import { cn } from "@/lib/utils";

type RouteStop = {
  id: number;
  route_id: number;
  name: string;
  sequence_order: number;
  morning_sequence?: number | null;
  evening_sequence?: number | null;
  morning_eta?: string | null;
  evening_eta?: string | null;
};

type CompanyRoute = {
  id: number;
  name: string;
  route_stops?: RouteStop[];
  /** `seat_capacity` / `capacity` are read only if the API includes them; the list endpoint may not. */
  vehicles?: { plate_number: string; model: string; seat_capacity?: number | null; capacity?: number | null } | null;
  users?: { full_name: string; phone: string } | null;
  employee_route_assignments?: {
    users?: { full_name: string; email: string; phone: string } | null;
  }[];
};

type AiRecommendation = {
  routeId: number | null;
  routeName: string;
  reason: string;
  confidence: "High" | "Medium" | "Low";
  alternativeRoutes: { id: number; name: string; reason: string }[];
};

const CONFIDENCE_TONE: Record<string, BadgeTone> = {
  High: "success",
  Medium: "warning",
  Low: "neutral",
};

// ─── Morning stop path ────────────────────────────────────────────────────────

function MorningStopPath({ stops }: { stops: RouteStop[] }) {
  const t = useTranslations("company.routes");
  const withMorning = stops.filter((s) => s.morning_sequence != null);
  const maxMorning = withMorning.length
    ? Math.max(...withMorning.map((s) => s.morning_sequence!))
    : null;
  const officeStopId =
    maxMorning != null
      ? withMorning.find((s) => s.morning_sequence === maxMorning)?.id ?? null
      : null;

  const sorted = [...withMorning].sort((a, b) => (a.morning_sequence ?? 0) - (b.morning_sequence ?? 0));
  if (sorted.length === 0) return <span className="text-xs text-fg-muted">{t("noStops")}</span>;

  return (
    <span
      className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-fg-muted"
      title={sorted.map((s) => s.name).join(", ")}
    >
      {sorted.map((stop, i) => (
        <span key={stop.id} className="inline-flex shrink-0 items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60 rtl:rotate-180" aria-hidden="true" />}
          {stop.id === officeStopId && <Building2 className="size-3 shrink-0" aria-hidden="true" />}
          <span className={stop.id === officeStopId ? "text-fg-secondary" : undefined}>{stop.name}</span>
        </span>
      ))}
    </span>
  );
}

// ─── AI route lookup ──────────────────────────────────────────────────────────

function AiRouteOptimizer({ companyId }: { companyId: number }) {
  const t = useTranslations("company.routes");
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [address, setAddress] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addressContainerRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    isLoading: isLoadingSuggestions,
    search,
    clearSuggestions,
    refreshToken,
  } = useGooglePlacesAutocomplete({
    apiKey: googleMapsKey,
    country: "pk",
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressContainerRef.current && !addressContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleAddressChange(value: string) {
    setAddress(value);
    setResult(null);
    setError(null);
    if (googleMapsKey && value.trim().length >= 3) {
      search(value);
      setShowSuggestions(true);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  }

  function handleSelectSuggestion(suggestion: { place_id: string; display_name: string }) {
    setAddress(suggestion.display_name);
    clearSuggestions();
    refreshToken();
    setShowSuggestions(false);
    setResult(null);
    setError(null);
  }

  async function handleAnalyze() {
    if (!address.trim()) return;
    setShowSuggestions(false);
    clearSuggestions();
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
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 lg:max-w-xl">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-fg-muted" aria-hidden="true" />
            {t("aiOptimizerTitle")}
          </CardTitle>
          <CardDescription>{t("aiOptimizerDescription")}</CardDescription>
        </div>

        <div className="flex w-full gap-2 lg:max-w-xl">
          <div ref={addressContainerRef} className="relative min-w-0 flex-1">
            <Input
              type="text"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
              placeholder={t("addressPlaceholder")}
              aria-label={t("addressPlaceholder")}
              autoComplete="off"
              className="pe-9"
            />
            {isLoadingSuggestions && (
              <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden="true" />
            )}

            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-popover py-1 shadow-[var(--shadow-modal)]">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.place_id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(suggestion);
                      }}
                      className="w-full px-3 py-2.5 text-start text-sm leading-snug text-fg transition-colors hover:bg-row-hover"
                    >
                      {suggestion.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showSuggestions && !isLoadingSuggestions && address.trim().length >= 3 && suggestions.length === 0 && (
              <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-line bg-popover px-3 py-2.5 text-sm text-fg-muted shadow-[var(--shadow-modal)]">
                {t("addressNoResults")}
              </div>
            )}
          </div>
          <Button variant="outline" onClick={handleAnalyze} disabled={!address.trim()} loading={loading}>
            {loading ? t("analyzing") : t("analyze")}
          </Button>
        </div>
      </div>

      {error && <InlineError>{error}</InlineError>}

      {result && (
        <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-fg">{t("bestMatch", { routeName: result.routeName })}</p>
              <Badge tone={CONFIDENCE_TONE[result.confidence] ?? "neutral"} dot>
                {t("confidence", { level: result.confidence })}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{result.reason}</p>
            {result.routeId && (
              <Button asChild variant="link" size="sm" className="mt-2">
                <Link href={`/company/routes/${result.routeId}`}>
                  {t("viewRouteDetails")}
                  <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>

          {result.alternativeRoutes.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-fg-muted">{t("alternatives")}</p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {result.alternativeRoutes.map((alt) => (
                  <li key={alt.id}>
                    <Link
                      href={`/company/routes/${alt.id}`}
                      className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-row-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-fg">{alt.name}</div>
                        <div className="text-xs text-fg-muted">{alt.reason}</div>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-muted rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Add Employee Panel ───────────────────────────────────────────────────────

type AddEmployeePanelProps = {
  companyId: number;
  routes: CompanyRoute[];
  onClose: () => void;
  onSuccess: () => void;
};

const ADD_EMPLOYEE_FORM_ID = "company-routes-add-employee";

function AddEmployeePanel({ companyId, routes, onClose, onSuccess }: AddEmployeePanelProps) {
  const t = useTranslations("company.routes");
  const tEmployees = useTranslations("company.employees");
  const tCredentials = useTranslations("company.credentials");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    department: "",
    home_address: "",
    employee_id: "",
  });
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "home_address") {
      // Debounce AI recommendation when address changes
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (value.trim().length > 10) {
        aiDebounceRef.current = setTimeout(() => runAiRecommend(value.trim()), 900);
      } else {
        setAiRec(null);
      }
    }
  }

  async function runAiRecommend(address: string) {
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

      if (password) {
        setCreatedCredentials({ email: form.email.trim(), password });
      }
      setDone(true);
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("failedAddEmployee"));
    } finally {
      setSubmitting(false);
    }
  }

  const routeOptionCls = (selected: boolean, neutral = false) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      !selected ? "border-line hover:bg-row-hover" : neutral ? "border-line-strong bg-subtle" : "border-brand-line bg-brand-soft",
    );

  const radioDot = (selected: boolean, neutral = false) => (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border",
        !selected ? "border-line-strong" : neutral ? "border-fg-muted" : "border-brand bg-brand",
      )}
    >
      {selected && <span className={cn("size-1.5 rounded-full", neutral ? "bg-fg-muted" : "bg-white")} />}
    </span>
  );

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        size="lg"
        title={t("addEmployee")}
        description={t("addEmployeeSubtitle")}
        footer={
          done ? (
            <Button type="button" onClick={onClose}>
              {tCredentials("done")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                {tCommon("actions.cancel")}
              </Button>
              <Button
                type="submit"
                form={ADD_EMPLOYEE_FORM_ID}
                disabled={!form.full_name.trim() || !form.email.trim()}
                loading={submitting}
                leftIcon={<UserPlus />}
              >
                {submitting ? t("adding") : selectedRouteId ? t("addEmployeeAssign") : t("addEmployee")}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col gap-6 py-2">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success-ink">
                <CheckCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-semibold text-fg">{t("employeeAdded")}</p>
                <p className="mt-1 text-sm text-fg-muted">
                  {selectedRouteId
                    ? t("employeeAddedAssigned", { name: form.full_name })
                    : t("employeeAddedCreated", { name: form.full_name })}
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
          <form id={ADD_EMPLOYEE_FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fullNameRequired")}>
                <Input
                  required
                  type="text"
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  placeholder="Ahmed Khan"
                />
              </Field>
              <Field label={t("employeeId")}>
                <Input
                  type="text"
                  value={form.employee_id}
                  onChange={(e) => updateField("employee_id", e.target.value)}
                  placeholder="EMP-001"
                />
              </Field>
            </div>

            <Field label={t("emailRequired")}>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="ahmed@company.com"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tEmployees("phone")}>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={PHONE_MAX_LENGTH}
                  value={form.phone}
                  onChange={(e) => updateField("phone", sanitizePhoneInput(e.target.value))}
                  placeholder={PHONE_PLACEHOLDER}
                  className="tabular-nums"
                />
              </Field>
              <Field label={tEmployees("department")}>
                <Input
                  type="text"
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  placeholder="Engineering"
                />
              </Field>
            </div>

            <Field
              label={
                <>
                  {t("homeAddress")}
                  <span className="ms-1.5 font-normal text-fg-muted">{t("aiAutoRecommend")}</span>
                </>
              }
              error={aiError ?? undefined}
            >
              <div className="relative">
                <Input
                  type="text"
                  value={form.home_address}
                  onChange={(e) => updateField("home_address", e.target.value)}
                  placeholder={t("addressPlaceholder")}
                  className="pe-9"
                />
                {aiLoading && (
                  <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden="true" />
                )}
              </div>
            </Field>

            {aiRec && (
              <div className="rounded-lg border border-line bg-subtle p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-fg-muted" aria-hidden="true" />
                  <span className="text-xs font-medium text-fg-muted">{t("aiRecommendation")}</span>
                  <Badge tone={CONFIDENCE_TONE[aiRec.confidence] ?? "neutral"} dot className="ms-auto">
                    {aiRec.confidence}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-fg">{aiRec.routeName}</p>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{aiRec.reason}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <p id={`${ADD_EMPLOYEE_FORM_ID}-route-label`} className="text-[13px] font-medium text-fg-secondary">
                {t("assignToRoute")}
                {aiRec && <span className="ms-1.5 font-normal text-fg-muted">{t("aiPreSelected")}</span>}
              </p>
              <div
                role="radiogroup"
                aria-labelledby={`${ADD_EMPLOYEE_FORM_ID}-route-label`}
                className="flex max-h-56 flex-col gap-2 overflow-y-auto pe-1"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedRouteId === null}
                  onClick={() => setSelectedRouteId(null)}
                  className={routeOptionCls(selectedRouteId === null, true)}
                >
                  {radioDot(selectedRouteId === null, true)}
                  <span className={cn("text-sm", selectedRouteId === null ? "text-fg" : "text-fg-muted")}>
                    {t("noRouteAssignment")}
                  </span>
                </button>
                {routes.map((route) => {
                  const isSelected = selectedRouteId === route.id;
                  const isAiPick = aiRec?.routeId === route.id;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={routeOptionCls(isSelected)}
                    >
                      {radioDot(isSelected)}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-fg">{route.name}</span>
                          {isAiPick && (
                            <Badge tone="brand" icon={<Sparkles />}>
                              {t("aiPick")}
                            </Badge>
                          )}
                        </span>
                        <span className="block text-xs text-fg-muted tabular-nums">
                          {t("passengersOnRoute", { count: route.employee_route_assignments?.length ?? 0 })}
                          {route.vehicles ? ` · ${route.vehicles.plate_number}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && <InlineError>{submitError}</InlineError>}

            <SaveCredentialsNote accountTypeKey="employee" />
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ─── Routes table ─────────────────────────────────────────────────────────────

function RouteRow({ route }: { route: CompanyRoute }) {
  const t = useTranslations("company.routes");
  const { locale } = useCompanyLocale();
  const router = useRouter();
  const employees = route.employee_route_assignments?.map((a) => a.users).filter(Boolean) ?? [];
  const stops = route.route_stops ?? [];
  const vehicle = route.vehicles;
  const driver = route.users;
  const morningStops = stops.filter((s) => s.morning_sequence != null).length;
  const capacity = vehicle?.seat_capacity ?? vehicle?.capacity ?? null;
  const num = (v: number) => formatLocaleNumber(v, locale);

  return (
    <tr
      className="cursor-pointer align-top transition-colors hover:bg-row-hover"
      onClick={() => router.push(`/company/routes/${route.id}`)}
    >
      <td className={cn(TABLE_CELL_CLASS, "max-w-[28rem]")}>
        <Link
          href={`/company/routes/${route.id}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-sm text-sm font-medium text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {route.name}
        </Link>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs text-fg-muted">{t("routeNumber", { id: route.id })}</span>
          <span aria-hidden="true" className="text-xs text-fg-muted">·</span>
          <MorningStopPath stops={stops} />
        </div>
      </td>
      <td className={cn(TABLE_CELL_CLASS, "text-end text-sm text-fg")}>{num(morningStops)}</td>
      <td className={cn(TABLE_CELL_CLASS, "text-end text-sm text-fg")}>
        {num(employees.length)}
        {capacity ? <span className="text-fg-muted"> / {num(capacity)}</span> : null}
      </td>
      <td className={cn(TABLE_CELL_CLASS, "text-sm whitespace-nowrap")}>
        {vehicle?.plate_number ? (
          <span className="font-mono text-fg">{vehicle.plate_number}</span>
        ) : (
          <Badge tone="warning" dot>{t("unassigned")}</Badge>
        )}
      </td>
      <td className={cn(TABLE_CELL_CLASS, "text-sm")}>
        {driver?.full_name ? (
          <span className="text-fg">{driver.full_name}</span>
        ) : (
          <Badge tone="warning" dot>{t("unassigned")}</Badge>
        )}
      </td>
      <td className={cn(TABLE_CELL_CLASS, "text-end")}>
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/company/routes/${route.id}/track`} onClick={(e) => e.stopPropagation()}>
              <Activity aria-hidden="true" />
              {t("track")}
            </Link>
          </Button>
          <ChevronRight className="size-4 text-fg-muted rtl:rotate-180" aria-hidden="true" />
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const t = useTranslations("company.routes");
  const { company, access } = useCompanyAccess();
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  const canManageShuttle = access.can.selfManageShuttle;

  function loadRoutes() {
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    apiClient
      .request<CompanyRoute[]>(`/routes?company_id=${company.id}`)
      .then((data) => setRoutes(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : t("failedToLoadRoutes")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const createRouteButton = (variant: "primary" | "outline") => (
    <Button asChild variant={variant}>
      <Link href="/company/routes/create">
        <Plus aria-hidden="true" />
        {t("createRoute")}
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 pb-12">
      <PageHeader
        title={t("title")}
        description={t("pageDescription")}
        actions={
          canManageShuttle ? (
            <>
              {createRouteButton("outline")}
              <Button onClick={() => setShowAddEmployee(true)} leftIcon={<UserPlus />}>
                {t("addEmployee")}
              </Button>
            </>
          ) : undefined
        }
      />

      <AiRouteOptimizer companyId={company.id} />

      <Card className={TABLE_CARD_CLASS}>
        {error ? (
          <ErrorState title={t("failedToLoadRoutes")} message={error} onRetry={loadRoutes} />
        ) : !loading && routes.length === 0 ? (
          <EmptyState
            icon={<Bus aria-hidden="true" />}
            title={t("noRoutesAssigned")}
            description={canManageShuttle ? t("createRouteHint") : undefined}
            action={canManageShuttle ? createRouteButton("primary") : undefined}
          />
        ) : (
          <>
            <div className={cn(TABLE_TOP_BAR_CLASS, "flex items-center justify-between gap-3")}>
              <p className="text-sm font-semibold text-fg tabular-nums">
                {loading ? t("loadingRoutes") : t("routesCount", { count: routes.length })}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-start">
                <thead className="border-b border-line">
                  <tr>
                    <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-start")}>{t("routeName")}</th>
                    <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-end")}>{t("stops")}</th>
                    <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-end")}>{t("passengers")}</th>
                    <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-start")}>{t("vehicle")}</th>
                    <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-start")}>{t("driver")}</th>
                    <th scope="col" className={cn(TABLE_HEADER_CELL_CLASS, "text-end")}>
                      <span className="sr-only">{t("actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <TableSkeletonRows columns={6} rows={5} />
                  ) : (
                    routes.map((route) => <RouteRow key={route.id} route={route} />)
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {showAddEmployee && (
        <AddEmployeePanel
          companyId={company.id}
          routes={routes}
          onClose={() => setShowAddEmployee(false)}
          onSuccess={() => loadRoutes()}
        />
      )}
    </div>
  );
}
