'use client';

import type { ReactNode } from 'react';
import { Bus } from 'lucide-react';
import { Card, EmptyState } from '@/app/admin/ui';

export function PlanEmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <Card>
            <EmptyState icon={<Bus aria-hidden="true" />} title={title} description={description} action={action} />
        </Card>
    );
}
