"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiClient, Company, Employee } from "../../../../lib/services/api-client";
import { CompanyFeature, CompanyVendorLink, ExternalVendor } from "../../../../lib/services/types/multi-mode";
import { useAdminAbility } from "../../../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../../../lib/abilities/admin-subjects";
import { useAuth } from "../../../../lib/contexts/auth-context";
import { useConfirm } from "../../../../lib/hooks/useConfirm";
import { getPhoneValidationError } from "../../../../lib/utils/phone";

export function useCompanyDetail(id: string) {
  const confirm = useConfirm();
  const ability = useAdminAbility();
  const { hasCrud } = useAuth();
    const canCreate = ability.can("create", ADMIN_SUBJECTS.companies);
    const canUpdate = ability.can("update", ADMIN_SUBJECTS.companies);
    const canViewPricing = hasCrud("pricing", "read");

    const [company, setCompany] = useState<Company | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<"employees" | "services">("employees");
    const [linkContext, setLinkContext] = useState<'chauffeur' | 'shuttle' | 'general'>('general');

    // Feature flags state
    const [features, setFeatures] = useState<CompanyFeature[]>([]);
    const [featuresLoading, setFeaturesLoading] = useState(false);
    const [trackerForm, setTrackerForm] = useState({ user_id: '', password: '', phone: '', year: '' });
    const [trackerSaving, setTrackerSaving] = useState(false);
    const [trackerTesting, setTrackerTesting] = useState(false);
    const [trackerTestResult, setTrackerTestResult] = useState<{ count: number; vehicles: string[] } | null>(null);
    const [pendingToggleKeys, setPendingToggleKeys] = useState<string[]>([]);

    // External vendors tab state
    const [companyVendorLinks, setCompanyVendorLinks] = useState<CompanyVendorLink[]>([]);
    const [vendorsLoading, setVendorsLoading] = useState(false);
    const [allVendors, setAllVendors] = useState<ExternalVendor[]>([]);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkSaving, setLinkSaving] = useState(false);
    const [linkForm, setLinkForm] = useState({ vendor_id: 0, serves_chauffeur: false, serves_shuttle: false });

    // Employee Modal
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [newEmpName, setNewEmpName] = useState("");
    const [newEmpEmail, setNewEmpEmail] = useState("");
    const [newEmpPhone, setNewEmpPhone] = useState("");
    const [newEmpPassword, setNewEmpPassword] = useState("");
    const [newEmpHomeAddress, setNewEmpHomeAddress] = useState("");

    const [newEmpId, setNewEmpId] = useState("");
    const [newEmpDepartment, setNewEmpDepartment] = useState("");
    const [isCreatingEmp, setIsCreatingEmp] = useState(false);
    const [isUploadingCsv, setIsUploadingCsv] = useState(false);

    // CSV bulk upload modal state
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvRawText, setCsvRawText] = useState<string>("");
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
    const [csvSkippedRows, setCsvSkippedRows] = useState<Array<{ row: number; missing: string[] }>>([]);
    const [csvMissingHeaders, setCsvMissingHeaders] = useState<string[]>([]);
    const [csvHasPreview, setCsvHasPreview] = useState(false);

    const csvRequiredHeaders = useMemo(() => ["full_name", "email"], []);
    const csvOptionalHeaders = useMemo(
        () => ["phone", "employee_id", "department", "home_address"],
        [],
    );
    const csvAllKnownHeaders = useMemo(
        () => [...csvRequiredHeaders, ...csvOptionalHeaders],
        [csvOptionalHeaders, csvRequiredHeaders],
    );

    const resetCsvState = useCallback(() => {
        setCsvFile(null);
        setCsvRawText("");
        setCsvHeaders([]);
        setCsvPreviewRows([]);
        setCsvSkippedRows([]);
        setCsvMissingHeaders([]);
        setCsvHasPreview(false);
    }, []);

    const openCsvModal = useCallback(() => {
        resetCsvState();
        setIsCsvModalOpen(true);
    }, [resetCsvState]);

    const closeCsvModal = useCallback(() => {
        setIsCsvModalOpen(false);
        resetCsvState();
    }, [resetCsvState]);

    const parseCsvForPreview = useCallback(
        async (file: File) => {
            if (!company) return;
            const text = await file.text();
            if (!text) {
                toast.error("CSV file is empty.");
                return;
            }

            // Quote-aware CSV split so commas inside "addresses, like this" stay in one cell.
            const parseCsvLine = (line: string): string[] => {
                const cells: string[] = [];
                let current = "";
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            current += '"';
                            i += 1;
                        } else {
                            inQuotes = !inQuotes;
                        }
                        continue;
                    }
                    if (ch === "," && !inQuotes) {
                        cells.push(current.trim());
                        current = "";
                        continue;
                    }
                    current += ch;
                }
                cells.push(current.trim());
                return cells;
            };

            // Common spreadsheet aliases → employee fields we accept.
            const headerAliases: Record<string, string> = {
                full_name: "full_name",
                name: "full_name",
                email: "email",
                phone: "phone",
                "official number": "phone",
                "official_number": "phone",
                mobile: "phone",
                employee_id: "employee_id",
                department: "department",
                home_address: "home_address",
                address: "home_address",
                password: "password",
            };

            const lines = text.split(/\r?\n/);
            // Keep empty header slots so column indexes stay aligned with data rows.
            const rawHeaders = parseCsvLine(lines[0] || "").map((h) => h.trim().toLowerCase());
            const headers = rawHeaders
                .map((h) => headerAliases[h] || h)
                .filter(Boolean);

            const missingHeaders = csvRequiredHeaders.filter(
                (h) => !rawHeaders.some((rh) => (headerAliases[rh] || rh) === h),
            );

            const previewRows: any[] = [];
            const skipped: Array<{ row: number; missing: string[] }> = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = parseCsvLine(line);
                const emp: any = { company_id: company.id };

                rawHeaders.forEach((rawHeader, index) => {
                    const field = headerAliases[rawHeader];
                    if (!field) return;
                    const val = values[index]?.trim();
                    if (val) emp[field] = val;
                });

                const missingRequired = csvRequiredHeaders.filter(
                    (h) => !emp[h] || String(emp[h]).trim().length === 0,
                );

                if (missingRequired.length > 0) {
                    skipped.push({ row: i + 1, missing: missingRequired });
                }

                previewRows.push(emp);
            }

            setCsvFile(file);
            setCsvRawText(text);
            setCsvHeaders(headers);
            setCsvMissingHeaders(missingHeaders);
            setCsvSkippedRows(skipped);
            setCsvPreviewRows(previewRows);
            setCsvHasPreview(true);
        },
        [company, csvRequiredHeaders],
    );

    const handleCsvFileSelected = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !company) return;
            await parseCsvForPreview(file);
        },
        [company, parseCsvForPreview],
    );

    const csvPreviewSummary = useMemo(() => {
        const totalRows = csvPreviewRows.length;
        const missingReqCols = csvMissingHeaders.length;
        const skippedRows = csvSkippedRows.length;
        const canUpload =
            csvHasPreview &&
            missingReqCols === 0 &&
            totalRows > 0 &&
            totalRows - skippedRows > 0;

        return {
            totalRows,
            skippedRows,
            uploadableRows: Math.max(0, totalRows - skippedRows),
            missingReqCols,
            canUpload,
        };
    }, [csvHasPreview, csvMissingHeaders.length, csvPreviewRows.length, csvSkippedRows.length]);

    const fetchCompanyData = async () => {
        try {
            setIsLoading(true);
            const companyRes = await apiClient.getCompany(id);
            setCompany(companyRes.data);

            const employeesRes = await apiClient.getEmployees({ company_id: Number(id), limit: 100 });
            setEmployees(employeesRes.data.data);
            setError(null);
        } catch (err: any) {
            console.error("Failed to load company data:", err);
            setError("Failed to load company details. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanyData();
    }, [id]);

    const fetchFeatures = useCallback(async () => {
        setFeaturesLoading(true);
        try {
            const res = await apiClient.getCompanyFeatures(Number(id));
            setFeatures(res.data);
            // Also fetch the saved tracker config to pre-fill the credential form
            try {
                const cfgRes = await apiClient.getTrackerConfig(Number(id));
                const cfg = (cfgRes as any)?.data?.config ?? {};
                if (cfg.user_id || cfg.phone) {
                    setTrackerForm({
                        user_id: (cfg.user_id as string) ?? '',
                        password: (cfg.password as string) ?? '',
                        phone: (cfg.phone as string) ?? '',
                        year: (cfg.year as string) ?? '',
                    });
                }
            } catch {
                // silently ignore — config may not exist yet
            }
        } catch {
            // silently ignore
        } finally {
            setFeaturesLoading(false);
        }
    }, [id]);

    const fetchCompanyVendors = useCallback(async () => {
        setVendorsLoading(true);
        try {
            const res = await apiClient.getCompanyExternalVendors(Number(id));
            setCompanyVendorLinks(res.data);
        } catch {
            // silently ignore
        } finally {
            setVendorsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (activeTab === "services") {
            fetchFeatures();
            fetchCompanyVendors();
        }
    }, [activeTab, fetchFeatures, fetchCompanyVendors]);

    const isTogglePending = (key: string) => pendingToggleKeys.includes(key);

    const runWithTogglePending = async (key: string, action: () => Promise<void>) => {
        setPendingToggleKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
        try {
            await action();
        } finally {
            setPendingToggleKeys((prev) => prev.filter((item) => item !== key));
        }
    };

    const toggleFeature = async (feature_key: string, is_enabled: boolean) => {
        await runWithTogglePending(`feature:${feature_key}`, async () => {
            try {
                await apiClient.upsertCompanyFeature(Number(id), { feature_key, is_enabled });
                setFeatures((prev) => prev.map((f) => f.feature_key === feature_key ? { ...f, is_enabled } : f));
                toast.success(`${feature_key.replace(/_/g, " ")} ${is_enabled ? "enabled" : "disabled"}`);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to update feature");
            }
        });
    };

    const saveTrackerConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setTrackerSaving(true);
        try {
            await apiClient.upsertTrackerConfig(Number(id), {
                config: {
                    user_id: trackerForm.user_id.trim(),
                    password: trackerForm.password.trim(),
                    phone: trackerForm.phone.trim(),
                    year: trackerForm.year.trim(),
                },
            });
            toast.success('TPL Trakker credentials saved');
            setTrackerTestResult(null); // reset test result so user can re-test
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save tracker config');
        } finally {
            setTrackerSaving(false);
        }
    };

    const testTrackerConnection = async () => {
        setTrackerTesting(true);
        setTrackerTestResult(null);
        try {
            const res = await apiClient.getActiveTrackerVehicles(Number(id));
            const vehicles = (res as any)?.data ?? [];
            const count = Array.isArray(vehicles) ? vehicles.length : 0;
            const plates = Array.isArray(vehicles)
                ? vehicles.slice(0, 5).map((v: any) => v.RegNo ?? '?')
                : [];
            setTrackerTestResult({ count, vehicles: plates });
            toast.success(`Connection successful — ${count} vehicle(s) found`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Connection test failed');
        } finally {
            setTrackerTesting(false);
        }
    };

    const handleLinkVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkForm.vendor_id) return;
        try {
            setLinkSaving(true);
            await apiClient.createVendorLink(linkForm.vendor_id, {
                company_id: Number(id),
                serves_chauffeur: linkForm.serves_chauffeur,
                serves_shuttle: linkForm.serves_shuttle,
            });
            toast.success("Vendor link saved");
            setShowLinkModal(false);
            fetchCompanyVendors();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to link vendor");
        } finally {
            setLinkSaving(false);
        }
    };

    const updateLink = async (linkId: number, dto: { serves_chauffeur?: boolean; serves_shuttle?: boolean; is_active?: boolean }) => {
        try {
            await apiClient.updateVendorLink(linkId, dto);
            fetchCompanyVendors();
            toast.success("Link updated");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update link");
        }
    };

    const removeLink = async (linkId: number) => {
        const ok = await confirm({ message: "Remove this vendor link?", destructive: true, confirmLabel: "Remove" });
        if (!ok) return;
        try {
            await apiClient.removeVendorLink(linkId);
            fetchCompanyVendors();
            toast.success("Link removed");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to remove link");
        }
    };

    const openLinkModal = (context: 'chauffeur' | 'shuttle' | 'general' = 'general') => {
        setLinkContext(context);
        setLinkForm({
            vendor_id: 0,
            serves_chauffeur: context === 'chauffeur',
            serves_shuttle: context === 'shuttle',
        });
        setShowLinkModal(true);
        // Load vendor list in background — modal is already visible
        apiClient.getExternalVendors({ limit: 100 })
            .then(res => setAllVendors(res.data.data))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load vendors"));
    };

    // -- Handlers --

    const handleCreateEmployee = async () => {
        if (!newEmpName.trim() || !company) return;
        const phoneError = getPhoneValidationError(newEmpPhone);
        if (phoneError) {
            toast.error(phoneError);
            return;
        }
        try {
            setIsCreatingEmp(true);
            await apiClient.createEmployee({
                company_id: company.id,
                full_name: newEmpName,
                email: newEmpEmail,
                phone: newEmpPhone,
                password: newEmpPassword || undefined,
                employee_id: newEmpId || undefined,
                department: newEmpDepartment || undefined,
                home_address: newEmpHomeAddress || undefined,
            });
            await fetchCompanyData(); // Refresh list
            setNewEmpName("");
            setNewEmpEmail("");
            setNewEmpPhone("");
            setNewEmpPassword("");
            setNewEmpPassword("");
            setNewEmpId("");
            setNewEmpDepartment("");
            setNewEmpHomeAddress("");
            setIsEmpModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to create employee");
        } finally {
            setIsCreatingEmp(false);
        }
    };

    const uploadCsvFromPreview = useCallback(async () => {
        if (!company) return;
        if (!csvHasPreview || !csvFile) {
            toast.error("Please select a CSV file and preview it first.");
            return;
        }
        if (csvMissingHeaders.length > 0) {
            toast.error(
                `CSV is missing required column(s): ${csvMissingHeaders.join(", ")}.`,
            );
            return;
        }

        // Upload only the rows that have required fields present
        const rowsToUpload = csvPreviewRows.filter((r) =>
            csvRequiredHeaders.every((h) => r[h] && String(r[h]).trim().length > 0),
        );

        if (rowsToUpload.length === 0) {
            toast.error("No valid rows to upload (missing required fields).");
            return;
        }

        setIsUploadingCsv(true);
        try {
            const result = await apiClient.bulkCreateEmployees(rowsToUpload);
            const { successful, failed } = result.data;

            const passwordsByEmail = new Map<string, string>();
            for (const row of rowsToUpload) {
                if (row.email && row.password) {
                    passwordsByEmail.set(String(row.email).toLowerCase(), String(row.password));
                }
            }

            const credentialRows = successful.flatMap((emp) => {
                const email = emp.email ? String(emp.email) : "";
                const password =
                    emp.password ||
                    (email ? passwordsByEmail.get(email.toLowerCase()) : undefined);
                if (!email || !password) return [];
                return [
                    {
                        email,
                        full_name: emp.full_name ?? "",
                        password: String(password),
                        employee_id: emp.employee_id ?? "",
                        phone: emp.phone ?? "",
                        department: emp.department ?? "",
                    },
                ];
            });

            if (credentialRows.length > 0 && company) {
                const escapeCsv = (value: string) => {
                    const s = String(value ?? "");
                    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                    return s;
                };
                const lines = [
                    "email,full_name,password,employee_id,phone,department",
                    ...credentialRows.map((r) =>
                        [
                            escapeCsv(r.email),
                            escapeCsv(r.full_name),
                            escapeCsv(r.password),
                            escapeCsv(r.employee_id),
                            escapeCsv(r.phone),
                            escapeCsv(r.department),
                        ].join(","),
                    ),
                ];
                const blob = new Blob([lines.join("\n")], {
                    type: "text/csv;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `cort-${company.name}-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            let message =
                `CSV upload finished.\n` +
                `Rows previewed: ${csvPreviewRows.length}\n` +
                `Uploaded: ${rowsToUpload.length}\n` +
                `Successful: ${successful.length}\n` +
                `Failed (API): ${failed.length}\n` +
                `Skipped (missing required): ${csvSkippedRows.length}`;

            if (credentialRows.length > 0) {
                message += `\nCredentials CSV downloaded (${credentialRows.length} accounts).`;
            }

            if (failed.length > 0) {
                message += `\n\nFailures:\n` + failed.map((f) => `${f.email}: ${f.reason}`).join("\n");
            }

            if (failed.length > 0 || csvSkippedRows.length > 0) toast.error(message);
            else toast.success(message);

            await fetchCompanyData();
            closeCsvModal();
        } catch (err: any) {
            toast.error("Failed to upload CSV: " + (err?.message || "Unknown error"));
        } finally {
            setIsUploadingCsv(false);
        }
    }, [
        closeCsvModal,
        company,
        csvFile,
        csvHasPreview,
        csvMissingHeaders.length,
        csvMissingHeaders,
        csvPreviewRows,
        csvRequiredHeaders,
        csvSkippedRows.length,
        fetchCompanyData,
    ]);

    const handleToggleStatus = async (emp: Employee) => {
        try {
            const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            // Optimistic update
            setEmployees(employees.map(e => e.id === emp.id ? { ...e, status: nextStatus } : e));
            await apiClient.updateEmployee(emp.id, { status: nextStatus });
        } catch (err: any) {
            console.error("Failed to update status:", err);
            // Revert on error
            setEmployees(employees.map(e => e.id === emp.id ? { ...e, status: emp.status } : e));
            toast.error(err instanceof Error ? err.message : "Failed to update status");
        }
    };

    const handleExportCredentials = () => {
        if (!company) return;
        // Roster export only — plaintext passwords are not stored. Use the
        // credentials CSV downloaded automatically after a successful bulk upload.
        const escapeCsv = (value: string) => {
            const s = String(value ?? "");
            if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const lines = [
            "employee_id,full_name,email,phone,department,status",
            ...employees.map((e) =>
                [
                    escapeCsv(e.employee_id || ""),
                    escapeCsv(e.full_name),
                    escapeCsv(e.email),
                    escapeCsv(e.phone || ""),
                    escapeCsv(e.department || ""),
                    escapeCsv(e.status),
                ].join(","),
            ),
        ];

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cort-${company.name}-employees.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleService = async (service: 'shuttle' | 'chauffeur') => {
        if (!company) return;
        const key = service === 'shuttle' ? 'is_shuttle_enabled' : 'is_chauffeur_enabled';
        const newVal = !company[key];

        // Optimistic
        setCompany({ ...company, [key]: newVal });

        await runWithTogglePending(`service:${key}`, async () => {
            try {
                await apiClient.updateCompany(company.id, { [key]: newVal });
            } catch (err) {
                setCompany({ ...company, [key]: !newVal }); // Revert
                toast.error(err instanceof Error ? err.message : "Failed to update settings");
            }
        });
    };

    const updateCompanyField = async (field: 'is_cort_managed' | 'is_external_vendor_managed' | 'is_own_pooled_cars_managed', newVal: boolean) => {
        if (!company) return;
        const prev = company[field];
        setCompany({ ...company, [field]: newVal });

        await runWithTogglePending(`company:${field}`, async () => {
            try {
                await apiClient.updateCompany(company.id, { [field]: newVal });
            } catch (err) {
                setCompany({ ...company, [field]: prev }); // Revert
                toast.error(err instanceof Error ? err.message : "Failed to update settings");
            }
        });
    };

    const handleChauffeurCortManagedToggle = async (newVal: boolean) => {
        if (!canUpdate) return;
        await toggleFeature('chauffeur_cort_managed', newVal);
        if (newVal) {
            const appTrackingFeat = features.find(f => f.feature_key === 'tracking_via_app');
            if (!appTrackingFeat?.is_enabled) {
                await toggleFeature('tracking_via_app', true);
                toast.success("App Tracking was auto-enabled for CORT Managed Chauffeur.");
            }
        }
    };

    const handleShuttleCortManagedToggle = async (newVal: boolean) => {
        if (!canUpdate) return;
        await toggleFeature('shuttle_cort_managed', newVal);
        if (newVal) {
            const appTrackingFeat = features.find(f => f.feature_key === 'tracking_via_app');
            if (!appTrackingFeat?.is_enabled) {
                await toggleFeature('tracking_via_app', true);
                toast.success("App Tracking was auto-enabled for CORT Managed Shuttle.");
            }
        }
    };

  return {
    company, employees, isLoading, error, canCreate, canUpdate, canViewPricing,
    activeTab, setActiveTab, linkContext, setLinkContext,
    features, featuresLoading, trackerForm, setTrackerForm, trackerSaving, trackerTesting, trackerTestResult, pendingToggleKeys,
    companyVendorLinks, vendorsLoading, allVendors, showLinkModal, setShowLinkModal, linkSaving, linkForm, setLinkForm,
    isEmpModalOpen, setIsEmpModalOpen, newEmpName, setNewEmpName, newEmpEmail, setNewEmpEmail, newEmpPhone, setNewEmpPhone,
    newEmpPassword, setNewEmpPassword, newEmpId, setNewEmpId,
    newEmpDepartment, setNewEmpDepartment, newEmpHomeAddress, setNewEmpHomeAddress, isCreatingEmp, isUploadingCsv,
    toggleFeature, saveTrackerConfig, testTrackerConnection, updateLink,
    handleCreateEmployee,
    openCsvModal,
    closeCsvModal,
    isCsvModalOpen,
    handleCsvFileSelected,
    csvRequiredHeaders,
    csvOptionalHeaders,
    csvAllKnownHeaders,
    csvHeaders,
    csvMissingHeaders,
    csvSkippedRows,
    csvPreviewRows,
    csvPreviewSummary,
    uploadCsvFromPreview,
    handleExportCredentials,
    handleChauffeurCortManagedToggle, handleShuttleCortManagedToggle,
    toggleService, openLinkModal, handleLinkVendor, removeLink, handleToggleStatus, isTogglePending,
  };
}
