"use client";

import { FileUp, Plus, Users } from "lucide-react";
import type { Employee } from "../../../../lib/services/api-client";
import type { useCompanyDetail } from "../hooks/useCompanyDetail";
import { EMPLOYEES_PAGE_SIZE } from "../hooks/useCompanyDetail";
import {
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  FilterBar,
  InlineError,
  StatusBadge,
  type DataTableColumn,
} from "../../../ui";

type Props = { detail: ReturnType<typeof useCompanyDetail> };

const columns: DataTableColumn<Employee>[] = [
  { key: "employee_id", header: "Emp ID", mono: true, width: "8rem", cell: (e) => <span className="text-fg-muted">{e.employee_id || "—"}</span> },
  {
    key: "name",
    header: "Name",
    cell: (e) => (
      <div className="min-w-0">
        <div className="font-medium text-fg">{e.full_name}</div>
        <div className="truncate text-xs text-fg-muted md:hidden">{e.email || "No email"}</div>
      </div>
    ),
  },
  {
    key: "contact",
    header: "Contact",
    hideBelow: "md",
    cell: (e) => (
      <div className="min-w-0 text-xs">
        <div className="truncate text-fg">{e.email || "No email"}</div>
        <div className="font-mono text-fg-muted">{e.phone || "—"}</div>
      </div>
    ),
  },
  { key: "department", header: "Department", hideBelow: "lg", cell: (e) => <span className="text-fg-secondary">{e.department || "—"}</span> },
  {
    key: "home_address",
    header: "Home address",
    hideBelow: "xl",
    className: "max-w-[24rem]",
    cell: (e) => <span className="line-clamp-2 text-xs text-fg-muted">{e.home_address || "—"}</span>,
  },
  { key: "status", header: "Status", width: "1%", cell: (e) => <StatusBadge status={e.status} /> },
];

export function CompanyEmployeesTab({ detail: d }: Props) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar
            search={{ value: d.empSearch, onChange: d.setEmployeeSearch, placeholder: "Search employees…" }}
            activeCount={d.empSearch ? 1 : 0}
            onClear={() => d.setEmployeeSearch("")}
            actions={
              <>
                <Button variant="outline" onClick={d.openCsvModal} disabled={d.isUploadingCsv || !d.canCreate} leftIcon={<FileUp />}>
                  Upload CSV
                </Button>
                <Button onClick={() => d.setIsEmpModalOpen(true)} disabled={!d.canCreate} leftIcon={<Plus />}>
                  Add employee
                </Button>
              </>
            }
          />
        </CardContent>
        <DataTable<Employee>
          caption="Employees"
          columns={columns}
          rows={d.employees}
          rowKey={(e) => e.id}
          loading={d.employeesLoading}
          error={d.employeesError}
          onRetry={d.refetchEmployees}
          empty={{
            icon: <Users aria-hidden="true" />,
            title: d.empSearch ? "No employees match your search" : "No employees yet",
            description: d.empSearch ? "Try another name, email or employee ID." : "Add employees one at a time or upload a CSV roster.",
            action: d.empSearch ? (
              <Button variant="outline" size="sm" onClick={() => d.setEmployeeSearch("")}>
                Clear search
              </Button>
            ) : (
              <Button size="sm" onClick={() => d.setIsEmpModalOpen(true)} disabled={!d.canCreate} leftIcon={<Plus />}>
                Add employee
              </Button>
            ),
          }}
          rowActions={(e) => [
            {
              label: e.status === "ACTIVE" ? "Deactivate" : "Activate",
              destructive: e.status === "ACTIVE",
              disabled: !d.canUpdate,
              onSelect: () => d.handleToggleStatus(e),
            },
          ]}
          pagination={{
            page: d.empPagination.page,
            totalPages: d.empPagination.pages,
            total: d.empPagination.total,
            pageSize: EMPLOYEES_PAGE_SIZE,
            onPageChange: d.setEmpPage,
          }}
        />
      </Card>

      <Dialog open={d.isCsvModalOpen} onOpenChange={(open) => !open && !d.isUploadingCsv && d.closeCsvModal()}>
        <DialogContent
          size="xl"
          priority="elevated"
          title="Bulk upload employees (CSV)"
          description="Preview the file, then upload the valid rows."
          footer={
            <>
              <Button variant="outline" onClick={d.closeCsvModal} disabled={d.isUploadingCsv}>
                Cancel
              </Button>
              <Button onClick={d.uploadCsvFromPreview} loading={d.isUploadingCsv} disabled={!d.canCreate || !d.csvPreviewSummary.canUpload} leftIcon={<FileUp />}>
                Upload {d.csvPreviewSummary.uploadableRows > 0 ? `${d.csvPreviewSummary.uploadableRows} rows` : ""}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border border-line bg-subtle p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium text-fg">Required columns</p>
                <p className="mt-1 font-mono text-xs text-fg-secondary">{d.csvRequiredHeaders.join(", ")}</p>
              </div>
              <div>
                <p className="font-medium text-fg">Optional columns</p>
                <p className="mt-1 font-mono text-xs text-fg-secondary">{d.csvOptionalHeaders.join(", ")}</p>
              </div>
              <p className="text-xs text-fg-muted sm:col-span-2">
                Headers are case-insensitive; extra columns are ignored. Wrap addresses containing commas in quotes.{" "}
                <code className="font-mono">Official Number</code> maps to phone. After a successful upload, a credentials CSV downloads
                automatically for auto-generated passwords.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3.5 text-sm font-medium text-fg shadow-xs hover:bg-subtle focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-page">
                <input type="file" accept=".csv" onChange={d.handleCsvFileSelected} className="sr-only" disabled={d.isUploadingCsv || !d.canCreate} />
                <FileUp className="size-4" aria-hidden="true" />
                Choose CSV file
              </label>
              <p className="text-sm text-fg-muted" aria-live="polite">
                {d.csvPreviewSummary.totalRows > 0
                  ? `${d.csvPreviewSummary.totalRows} rows · ${d.csvPreviewSummary.uploadableRows} uploadable · ${d.csvPreviewSummary.skippedRows} skipped`
                  : "No file selected yet."}
              </p>
            </div>

            {d.csvMissingHeaders.length > 0 && (
              <InlineError>
                Missing required column{d.csvMissingHeaders.length > 1 ? "s" : ""}: <span className="font-semibold">{d.csvMissingHeaders.join(", ")}</span>
              </InlineError>
            )}

            {d.csvSkippedRows.length > 0 && (
              <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning-ink">
                Some rows are missing required fields and will be skipped (showing first 10):
                <ul className="mt-1 space-y-0.5 text-xs">
                  {d.csvSkippedRows.slice(0, 10).map((s) => (
                    <li key={`${s.row}-${s.missing.join(",")}`}>
                      Row {s.row}: missing {s.missing.join(", ")}
                    </li>
                  ))}
                  {d.csvSkippedRows.length > 10 && <li>…and {d.csvSkippedRows.length - 10} more</li>}
                </ul>
              </div>
            )}

            {d.csvPreviewRows.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="flex items-center justify-between border-b border-line bg-subtle px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Preview</p>
                  <p className="text-xs text-fg-muted">First 25 rows</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-subtle text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                      <tr>
                        {d.csvAllKnownHeaders.map((h) => (
                          <th key={h} scope="col" className="whitespace-nowrap border-b border-line px-3 py-2 font-mono">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {d.csvPreviewRows.slice(0, 25).map((row, idx) => (
                        <tr key={idx} className="hover:bg-row-hover">
                          {d.csvAllKnownHeaders.map((h) => (
                            <td key={h} className="whitespace-nowrap px-3 py-2 text-fg">
                              {row[h] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
