"use client";

import { Pagination as KitPagination } from "@/app/company/ui";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Legacy props over the company design-system Pagination (translated, RTL-aware, token-based). */
export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return <KitPagination page={currentPage} totalPages={totalPages} onPageChange={onPageChange} className="w-full" />;
}
