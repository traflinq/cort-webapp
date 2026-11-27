"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppSelector } from "../../../lib/store/hooks";
import { selectCompany } from "../../../lib/store/slices/companySlice";
import { apiClient, ChauffeurBooking } from "../../../lib/services/api-client";
import { BookingVendorRequest } from "../../../lib/services/types/multi-mode";
import { toast } from "sonner";
import { useCompanyLocale } from "../../lib/locale-context";
import { formatLocaleDate } from "../../../lib/i18n/format";
import { Badge, Button, EmptyState, LoadingBlock, PageHeader, StatusBadge, type StatusEntry } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../../components/Card";
import { TABLE_CELL_CLASS, TABLE_HEADER_CELL_CLASS } from "../../components/PageLayout";

/** Booking + vendor-request statuses → shared badge tones. */
const STATUS_TONES: Record<string, StatusEntry> = {
    PENDING: { tone: "warning" },
    ACCEPTED: { tone: "success" },
    REJECTED: { tone: "danger" },
    EXPIRED: { tone: "neutral" },
    ARRIVED: { tone: "info" },
    IN_PROGRESS: { tone: "purple" },
};

const STATUS_LABEL_KEYS: Record<string, "pending" | "assigned" | "arrived" | "inProgress" | "completed" | "cancelled"> = {
    PENDING: "pending",
    ASSIGNED: "assigned",
    ARRIVED: "arrived",
    IN_PROGRESS: "inProgress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
};

const FULFILLMENT_LABEL_KEYS: Record<string, "cortManaged" | "externalVendor" | "selfManaged"> = {
    CORT_MANAGED: "cortManaged",
    EXTERNAL_VENDOR: "externalVendor",
    SELF_MANAGED: "selfManaged",
};

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-fg-muted">{label}</dt>
            <dd className="mt-1 text-sm text-fg">{children}</dd>
        </div>
    );
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const t = useTranslations("company.bookings");
    const tCommon = useTranslations("common");
    const { locale } = useCompanyLocale();
    const company = useAppSelector(selectCompany);
    const companyId = Number(company?.id);

    const [booking, setBooking] = useState<ChauffeurBooking | null>(null);
    const [vendorRequests, setVendorRequests] = useState<BookingVendorRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState<number | null>(null);

    const load = useCallback(async () => {
        if (!companyId) return;
        try {
            const [bookingRes, reqRes] = await Promise.all([
                apiClient.getCompanyChauffeurBooking(companyId, Number(id)),
                apiClient.getBookingVendorRequests(companyId, Number(id)).catch(() => ({ data: [] })),
            ]);
            setBooking(bookingRes.data as unknown as ChauffeurBooking);
            setVendorRequests((reqRes as { data: BookingVendorRequest[] }).data ?? []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedToLoadBooking"));
        } finally {
            setLoading(false);
        }
    }, [companyId, id, t]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const hasPending = vendorRequests.some((r) => r.status === "PENDING");
        if (!hasPending) return;
        const timer = setInterval(load, 30_000);
        return () => clearInterval(timer);
    }, [vendorRequests, load]);

    const confirmVendor = async (requestId: number) => {
        setConfirming(requestId);
        try {
            await apiClient.confirmVendorForBooking(companyId, Number(id), requestId);
            toast.success(t("vendorConfirmed"));
            load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t("failedToConfirmVendor"));
        } finally {
            setConfirming(null);
        }
    };

    const statusLabel = (status: string | undefined) => {
        const key = status ? STATUS_LABEL_KEYS[status] : undefined;
        return key ? tCommon(`status.${key}`) : undefined;
    };

    if (loading) {
        return <LoadingBlock label={t("loadingBooking")} />;
    }

    if (!booking) {
        return (
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12">
                <EmptyState
                    title={t("bookingNotFound")}
                    action={
                        <Button variant="outline" asChild>
                            <Link href="/company/bookings">{t("backToBookings")}</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    const bookingData = booking as ChauffeurBooking & {
        service_category?: string;
        status?: string;
        pickup_address?: string;
        scheduled_for?: string;
        package_selected?: string;
        fulfillment_type?: string;
    };
    const isExternalVendor = bookingData.fulfillment_type === "EXTERNAL_VENDOR";
    const showVendorResponses = isExternalVendor || vendorRequests.length > 0;
    const fulfillmentValue = bookingData.fulfillment_type ?? "CORT_MANAGED";
    const fulfillmentKey = FULFILLMENT_LABEL_KEYS[fulfillmentValue];

    const vendorTableHeaders = [
        t("vendors.vendorName"),
        t("status"),
        t("assignedVehicle"),
        t("assignedDriver"),
        t("respondedAt"),
        t("action"),
    ];

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-6 pb-12">
            <PageHeader
                back={{ href: "/company/bookings", label: t("backToBookings") }}
                title={<span className="tabular-nums">#{booking.id}</span>}
                description={bookingData.service_category ?? t("chauffeurRide")}
                meta={
                    <StatusBadge
                        status={bookingData.status}
                        label={statusLabel(bookingData.status)}
                        overrides={STATUS_TONES}
                    />
                }
            />

            <Card>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem label={t("pickup")}>{bookingData.pickup_address ?? "—"}</DetailItem>
                    <DetailItem label={t("scheduledFor")}>
                        <span className="ltr-content tabular-nums">
                            {bookingData.scheduled_for
                                ? formatLocaleDate(bookingData.scheduled_for, locale, { dateStyle: "medium", timeStyle: "short" })
                                : "—"}
                        </span>
                    </DetailItem>
                    <DetailItem label={t("package")}>{bookingData.package_selected ?? "—"}</DetailItem>
                    <DetailItem label={t("fulfillment")}>
                        <Badge tone="neutral">
                            {fulfillmentKey ? tCommon(`fulfillment.${fulfillmentKey}`) : fulfillmentValue}
                        </Badge>
                    </DetailItem>
                </dl>
            </Card>

            {showVendorResponses && (
                <Card className="overflow-hidden p-0 sm:p-0">
                    <div className="flex flex-col gap-1 border-b border-line px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-sm font-semibold text-fg">{t("vendorResponses")}</h2>
                            {vendorRequests.some((r) => r.status === "PENDING") && (
                                <span className="text-xs text-fg-muted">{t("autoRefreshing")}</span>
                            )}
                        </div>
                        {!isExternalVendor && vendorRequests.length > 0 && (
                            <p className="text-xs text-fg-muted">{t("vendorBroadcastNote")}</p>
                        )}
                    </div>

                    {vendorRequests.length === 0 ? (
                        <EmptyState compact title={t("noVendorResponses")} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="border-b border-line bg-subtle/50">
                                    <tr>
                                        {vendorTableHeaders.map((h, i) => (
                                            <th
                                                key={h}
                                                scope="col"
                                                className={cn(TABLE_HEADER_CELL_CLASS, i === vendorTableHeaders.length - 1 ? "text-end" : "text-start")}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {vendorRequests.map((req) => (
                                        <tr key={req.id} className="transition-colors hover:bg-row-hover">
                                            <td className={cn(TABLE_CELL_CLASS, "font-medium text-fg")}>
                                                {req.company_vendor_links?.companies?.name ?? `Link #${req.company_vendor_link_id}`}
                                            </td>
                                            <td className={TABLE_CELL_CLASS}>
                                                <StatusBadge status={req.status} label={statusLabel(req.status)} overrides={STATUS_TONES} />
                                            </td>
                                            <td className={cn(TABLE_CELL_CLASS, "text-fg-secondary")}>
                                                {req.vehicles ? `${req.vehicles.plate_number} — ${req.vehicles.make} ${req.vehicles.model}` : "—"}
                                            </td>
                                            <td className={cn(TABLE_CELL_CLASS, "text-fg-secondary")}>
                                                {req.users?.full_name ?? "—"}
                                            </td>
                                            <td className={cn(TABLE_CELL_CLASS, "whitespace-nowrap text-xs text-fg-muted")}>
                                                <span className="ltr-content">
                                                    {req.responded_at ? formatLocaleDate(req.responded_at, locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                                                </span>
                                            </td>
                                            <td className={cn(TABLE_CELL_CLASS, "py-2 text-end")}>
                                                {req.status === "ACCEPTED" && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => confirmVendor(req.id)}
                                                        loading={confirming === req.id}
                                                    >
                                                        {confirming === req.id ? t("confirming") : t("confirmVendor")}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
