import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    // Helper to calculate page range with ellipses
    const getPageRange = () => {
        const delta = 1; // Number of neighbors to show around current page
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    const displayPages = getPageRange();

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5 px-2">
            {/* Page Info */}
            <div className="text-sm text-[var(--text-muted)] order-2 sm:order-1">
                Showing page <span className="font-medium text-[var(--text-primary)]">{currentPage}</span> of{' '}
                <span className="font-medium text-[var(--text-primary)]">{totalPages}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 order-1 sm:order-2 bg-[var(--bg-card)] p-1 rounded-full border border-[var(--pill-line,var(--border-default))]">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Previous Page"
                >
                    <ChevronLeft className="w-5 h-5 rtl-flip" />
                </button>

                <div className="hidden sm:flex items-center gap-1 px-2">
                    {displayPages.map((page, idx) => {
                        if (page === '...') {
                            return (
                                <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-[var(--text-muted)]">
                                    <MoreHorizontal className="w-4 h-4" />
                                </span>
                            );
                        }

                        const isCurrent = currentPage === page;
                        return (
                            <button
                                key={page}
                                onClick={() => onPageChange(page as number)}
                                className={`
                                    w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors
                                    ${isCurrent
                                        ? 'bg-[var(--cort-navy)] text-white'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                                    }
                                `}
                            >
                                {page}
                            </button>
                        );
                    })}
                </div>

                {/* Mobile simplified view */}
                <div className="flex sm:hidden items-center px-4 font-medium text-sm text-[var(--text-primary)] tabular-nums">
                    {currentPage} / {totalPages}
                </div>

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Next Page"
                >
                    <ChevronRight className="w-5 h-5 rtl-flip" />
                </button>
            </div>
        </div>
    );
}
