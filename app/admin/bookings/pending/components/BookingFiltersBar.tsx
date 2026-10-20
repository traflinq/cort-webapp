"use client";

import { DateRangePicker, FilterBar, FilterField, Select, type DateRange } from "../../../ui";
import { BOOKING_STATUS_OPTIONS } from "./booking-status";
import type { CompanyOption } from "../hooks/usePendingBookings";

type BookingFiltersBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  companyFilter: string;
  onCompanyChange: (value: string) => void;
  dateRange: DateRange | null;
  onDateRangeChange: (range: DateRange | null) => void;
  companies: CompanyOption[];
  activeCount: number;
  onClear: () => void;
};

export function BookingFiltersBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  companyFilter,
  onCompanyChange,
  dateRange,
  onDateRangeChange,
  companies,
  activeCount,
  onClear,
}: BookingFiltersBarProps) {
  return (
    <FilterBar
      search={{ value: searchQuery, onChange: onSearchChange, placeholder: "Search passenger, company, vehicle…" }}
      activeCount={activeCount}
      onClear={onClear}
    >
      <FilterField label="Company">
        <Select value={companyFilter} onChange={(e) => onCompanyChange(e.target.value)} placeholder="All companies" className="h-8 text-xs">
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="Status">
        <Select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)} placeholder="All statuses" className="h-8 text-xs">
          {BOOKING_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="Scheduled">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} size="sm" allowClear label="Scheduled period" />
      </FilterField>
    </FilterBar>
  );
}
