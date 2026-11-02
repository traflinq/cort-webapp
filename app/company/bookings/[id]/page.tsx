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
import { Card } from "../../components/DashboardComponents";
import { IllustrationTile, PillButton } from "../../ui";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-[var(--tone-warning-soft)] text-[var(--tone-warning-ink)]",
    ACCEPTED: "bg-[var(--tone-success-soft)] text-[var(--tone-success-ink)]",
    REJECTED: "bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)]",
    EXPIRED: "bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)]",
};

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

    if (loading) {
        return <div className="p-8 text-sm text-[var(--text-muted)]">{t("loadingBooking")}</div>;
    }

    if (!booking) {
        return <div className="p-8 text-sm text-[var(--text-muted)]">{t("bookingNotFound")}</div>;
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

    const vendorTableHeaders = [
        t("vendors.vendorName"),
        t("status"),
        t("assignedVehicle"),
        t("assignedDriver"),
        t("respondedAt"),
        t("action"),
    ];

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
            <Link href="/company/bookings" className="inline-flex items-center gap-1 text-sm text-[var(--cort-orange)] hover:underline">
                <span className="rtl-flip inline-block">←</span> {t("backToBookings")}
            </Link>

            <Card>
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <IllustrationTile name="car" size="md" />
                        <div>
                        <h1 className="text-[2rem] font-medium leading-tight tracking-[-0.02em] text-[var(--text-primary)]">#{booking.id}</h1>
                        <p className="text-[15px] text-[var(--text-muted)] mt-1">{bookingData.service_category ?? t("chauffeurRide")}</p>
                        </div>
                    </div>
                    <span className={cx("inline-flex px-3 py-1.5 rounded-full text-xs font-medium", STATUS_COLORS[bookingData.status ?? ""] ?? "bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)]")}>
                        {bookingData.status ?? "—"}
                    </span>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
                        <dt className="text-xs text-[var(--text-muted)]">{t("pickup")}</dt>
                        <dd className="text-[15px] text-[var(--text-primary)] mt-1">{bookingData.pickup_address ?? "—"}</dd>
                    </div>
                    <div className="rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
                        <dt className="text-xs text-[var(--text-muted)]">{t("scheduledFor")}</dt>
                        <dd className="text-[15px] text-[var(--text-primary)] mt-1 ltr-content">
                            {bookingData.scheduled_for
                                ? formatLocaleDate(bookingData.scheduled_for, locale, { dateStyle: "medium", timeStyle: "short" })
                                : "—"}
                        </dd>
                    </div>
                    <div className="rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
                        <dt className="text-xs text-[var(--text-muted)]">{t("package")}</dt>
                        <dd className="text-[15px] text-[var(--text-primary)] mt-1">{bookingData.package_selected ?? "—"}</dd>
                    </div>
                    <div className="rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
                        <dt className="text-xs text-[var(--text-muted)]">{t("fulfillment")}</dt>
                        <dd className="mt-1.5">
                            <span className={cx("inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                                isExternalVendor ? "bg-[var(--tone-info-soft)] text-[var(--tone-info-ink)]" :
                                bookingData.fulfillment_type === "SELF_MANAGED" ? "bg-[var(--tone-purple-soft)] text-[var(--tone-purple-ink)]" :
                                "bg-[var(--tone-brand-soft)] text-[var(--tone-brand-ink)]"
                            )}>
                                {bookingData.fulfillment_type ?? "CORT_MANAGED"}
                            </span>
                        </dd>
                    </div>
                </dl>
            </Card>

            {showVendorResponses && (
                <Card>
                    {!isExternalVendor && vendorRequests.length > 0 && (
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            {t("vendorBroadcastNote")}
                        </p>
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-medium text-[var(--text-primary)]">{t("vendorResponses")}</h2>
                        {vendorRequests.some((r) => r.status === "PENDING") && (
                            <span className="text-xs text-[var(--text-muted)]">{t("autoRefreshing")}</span>
                        )}
                    </div>

                    {vendorRequests.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">{t("noVendorResponses")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-[var(--divider)]">
                                    <tr>
                                        {vendorTableHeaders.map((h) => (
                                            <th key={h} className="px-3 py-3 text-start text-[13px] font-normal text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--divider)]">
                                    {vendorRequests.map((req) => (
                                        <tr key={req.id} className={cx("hover:bg-[var(--row-hover)]", req.status === "ACCEPTED" && "bg-[var(--tone-success-soft)]")}>
                                            <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                                                {req.company_vendor_links?.companies?.name ?? `Link #${req.company_vendor_link_id}`}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={cx("inline-flex px-2.5 py-1 rounded-full text-xs font-medium", STATUS_COLORS[req.status] ?? "bg-[var(--tone-neutral-soft)] text-[var(--tone-neutral-ink)]")}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-[var(--text-secondary)]">
                                                {req.vehicles ? `${req.vehicles.plate_number} — ${req.vehicles.make} ${req.vehicles.model}` : "—"}
                                            </td>
                                            <td className="px-3 py-3 text-[var(--text-secondary)]">
                                                {req.users?.full_name ?? "—"}
                                            </td>
                                            <td className="px-3 py-3 text-[var(--text-muted)] text-xs ltr-content">
                                                {req.responded_at ? formatLocaleDate(req.responded_at, locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                                            </td>
                                            <td className="px-3 py-3">
                                                {req.status === "ACCEPTED" && (
                                                    <PillButton
                                                        size="sm"
                                                        onClick={() => confirmVendor(req.id)}
                                                        disabled={confirming === req.id}
                                                    >
                                                        {confirming === req.id ? t("confirming") : t("confirmVendor")}
                                                    </PillButton>
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
