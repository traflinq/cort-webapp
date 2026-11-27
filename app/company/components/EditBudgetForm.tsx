"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Field, InlineError, Input } from '@/app/admin/ui';
import { useAppDispatch } from '../../lib/store/hooks';
import { clearDashboardCache, fetchDashboardStats } from '../../lib/store/slices/dashboardSlice';
import { apiClient } from '../../lib/services/api-client';

interface EditBudgetFormProps {
    companyId: string;
    currentBudget: number;
    onSuccess: () => void;
    onCancel: () => void;
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII, then drop everything that isn't a digit. */
function toDigits(raw: string): string {
    return raw
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/\D/g, '');
}

/** Amount entry keeps Western digits (the field is LTR) but groups thousands so large budgets stay readable. */
const group = (digits: string) => (digits ? Number(digits).toLocaleString('en-US') : '');

export default function EditBudgetForm({ companyId, currentBudget, onSuccess, onCancel }: EditBudgetFormProps) {
    const t = useTranslations('company.dashboard');
    const tEmployees = useTranslations('company.employees');
    const tCommon = useTranslations('common');
    const dispatch = useAppDispatch();
    const [digits, setDigits] = useState<string>(currentBudget > 0 ? String(Math.round(currentBudget)) : '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFieldError(null);
        setSubmitError(null);

        const newBudget = Number(digits);
        if (!digits || !Number.isSafeInteger(newBudget) || newBudget < 0) {
            setFieldError(tCommon('validation.validPositiveNumber'));
            return;
        }

        setIsSubmitting(true);
        try {
            await apiClient.updateCompany(companyId, { monthly_budget: newBudget });
            dispatch(clearDashboardCache());
            dispatch(fetchDashboardStats(companyId));
            onSuccess();
        } catch (err: unknown) {
            setSubmitError(err instanceof Error && err.message ? err.message : tEmployees('failedUpdateBudget'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {submitError && <InlineError>{submitError}</InlineError>}

            <Field label={t('monthlyBudgetLabel')} hint={tEmployees('budgetHint')} error={fieldError} required>
                <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    dir="ltr"
                    aria-required="true"
                    className="tabular-nums"
                    autoFocus
                    value={group(digits)}
                    onChange={(e) => {
                        setDigits(toDigits(e.target.value).slice(0, 15));
                        if (fieldError) setFieldError(null);
                    }}
                    placeholder={t('budgetPlaceholder')}
                    disabled={isSubmitting}
                />
            </Field>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    {tCommon('actions.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={!digits} className="sm:min-w-32">
                    {isSubmitting ? tEmployees('saving') : tEmployees('saveBudget')}
                </Button>
            </div>
        </form>
    );
}
