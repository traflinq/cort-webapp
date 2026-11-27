"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAppDispatch } from '../../lib/store/hooks';
import { clearDashboardCache, fetchDashboardStats } from '../../lib/store/slices/dashboardSlice';
import { apiClient } from '../../lib/services/api-client';
import { CreditCard, Loader2 } from 'lucide-react';

interface EditBudgetFormProps {
    companyId: string;
    currentBudget: number;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function EditBudgetForm({ companyId, currentBudget, onSuccess, onCancel }: EditBudgetFormProps) {
    const t = useTranslations('company.dashboard');
    const tEmployees = useTranslations('company.employees');
    const tCommon = useTranslations('common');
    const dispatch = useAppDispatch();
    const [budget, setBudget] = useState<string>(currentBudget.toString());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const newBudget = parseInt(budget.replace(/,/g, ''), 10);

        if (isNaN(newBudget) || newBudget < 0) {
            setError(tCommon('validation.validPositiveNumber'));
            return;
        }

        setIsSubmitting(true);
        try {
            await apiClient.updateCompany(companyId, { monthly_budget: newBudget });
            dispatch(clearDashboardCache());
            dispatch(fetchDashboardStats(companyId));
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : tEmployees('failedUpdateBudget'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm border border-red-500/20 flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-rose-500 mt-2 shrink-0" />
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {t('monthlyBudgetLabel')}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                        <CreditCard className="w-4 h-4" />
                    </div>
                    <input
                        type="text"
                        required
                        min="0"
                        value={budget}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setBudget(val);
                        }}
                        className="w-full ps-10 pe-3 py-2 bg-[var(--bg-card)] border border-[var(--border-input)] text-[var(--text-primary)] rounded-xl focus:ring-2 focus:ring-ring/20 focus:border-ring transition-shadow transition-colors ltr-content"
                        placeholder={t('budgetPlaceholder')}
                        dir="ltr"
                    />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                    {tEmployees('budgetHint')}
                </p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[var(--border-input)]">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 border border-[var(--border-input)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--row-hover)] font-medium transition-colors"
                >
                    {tCommon('actions.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || !budget}
                    className="flex-1 px-4 py-2 bg-brand text-[var(--text-on-brand)] rounded-xl hover:bg-primary-hover font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin me-2" />
                            {tEmployees('saving')}
                        </>
                    ) : (
                        tEmployees('saveBudget')
                    )}
                </button>
            </div>
        </form>
    );
}
