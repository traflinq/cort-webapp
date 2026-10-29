'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapPin, UserMinus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardSkeleton,
    EmptyState,
    Field,
    FormGrid,
    IconButton,
    SearchInput,
    SectionHeader,
    Select,
} from '@/app/admin/ui';
import { useConfirm } from '@/app/lib/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '@/app/lib/store/hooks';
import {
    fetchRouteAssignments,
    assignEmployeeToRoute,
    removeEmployeeFromRoute,
    selectRouteAssignments,
    selectAssignmentStatus,
    type Route,
} from '@/app/lib/store/slices/adminRoutesSlice';
import { fetchEmployees, selectEmployees } from '@/app/lib/store/slices/employeeSlice';
import { format12h, initials } from '../../RouteCommandBar';
import { getOfficeStops } from '@/app/lib/utils/routeStops';

export default function RosteringTab({ route, canEdit }: { route: Route; canEdit: boolean }) {
    const dispatch = useAppDispatch();
    const confirm = useConfirm();
    const assignments = useAppSelector(selectRouteAssignments);
    const assignmentStatus = useAppSelector(selectAssignmentStatus);
    const employees = useAppSelector(selectEmployees);

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [selectedStopId, setSelectedStopId] = useState<number | ''>('');
    const [selectedOfficeStopId, setSelectedOfficeStopId] = useState<number | ''>('');
    const [search, setSearch] = useState('');
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);

    // A route may have multiple OFFICE-type stops (multi-office shuttle support).
    const officeStops = getOfficeStops(route.route_stops ?? []);
    const officeStopIds = new Set(officeStops.map((s) => s.id));
    const hasMultipleOffices = officeStops.length > 1;

    // Clear the add form when the route changes (render-time adjustment), then load data.
    const routeKey = `${route.id}|${route.company_id ?? ''}`;
    const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
    if (prevRouteKey !== routeKey) {
        setPrevRouteKey(routeKey);
        setSelectedEmployeeId('');
        setSelectedStopId('');
        setSelectedOfficeStopId('');
    }

    useEffect(() => {
        if (route.id && route.company_id) {
            dispatch(fetchRouteAssignments(route.id));
            dispatch(fetchEmployees(route.company_id.toString()));
        }
    }, [dispatch, route.id, route.company_id]);

    // Default-select the single office stop so single-office routes need no extra input.
    const officeDefaultKey = `${route.id}|${hasMultipleOffices}|${officeStops.length}`;
    const [prevOfficeDefaultKey, setPrevOfficeDefaultKey] = useState<string | null>(null);
    if (prevOfficeDefaultKey !== officeDefaultKey) {
        setPrevOfficeDefaultKey(officeDefaultKey);
        if (!hasMultipleOffices && officeStops.length === 1) {
            setSelectedOfficeStopId(officeStops[0].id);
        } else if (!hasMultipleOffices) {
            setSelectedOfficeStopId('');
        }
    }

    const handleAssign = async () => {
        if (!canEdit) return;
        if (!selectedEmployeeId || !selectedStopId) {
            toast.error('Select a person and a pickup');
            return;
        }
        if (hasMultipleOffices && !selectedOfficeStopId) {
            toast.error('Select which office this person is assigned to');
            return;
        }
        try {
            await dispatch(assignEmployeeToRoute({
                user_id: selectedEmployeeId,
                route_id: route.id,
                pickup_stop_id: Number(selectedStopId),
                ...(hasMultipleOffices ? { office_stop_id: Number(selectedOfficeStopId) } : {}),
            })).unwrap();
            toast.success('Added to this route');
            setSelectedEmployeeId('');
            setSelectedStopId('');
            setSelectedOfficeStopId(hasMultipleOffices ? '' : selectedOfficeStopId);
        } catch {
            toast.error('Could not add this person');
        }
    };

    const handleRemove = async (userId: string, name: string) => {
        if (!canEdit) return;
        const ok = await confirm({
            title: `Remove ${name} from this route?`,
            message: 'They are taken off the standing roster for this route.',
            consequences: [
                'They will no longer be listed as a regular rider on this route',
                'Their employee account is not changed',
            ],
            destructive: true,
            confirmLabel: 'Remove',
        });
        if (!ok) return;
        try {
            setRemovingUserId(userId);
            await dispatch(removeEmployeeFromRoute(userId)).unwrap();
            toast.success('Removed from this route');
        } catch {
            toast.error('Could not remove this person');
        } finally {
            setRemovingUserId(null);
        }
    };

    // Office stops are not assignable as a pickup.
    const pickupStops = (route.route_stops ?? []).filter((s) => !officeStopIds.has(s.id));
    const assignedUserIds = new Set(assignments.map((a) => a.user_id));
    const availableEmployees = employees.filter((emp) => !assignedUserIds.has(emp.id));

    const stopById = useMemo(() => {
        const map = new Map((route.route_stops ?? []).map((s) => [s.id, s]));
        return map;
    }, [route.route_stops]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return assignments;
        return assignments.filter((a) => {
            const name = a.users?.full_name ?? '';
            const pickup = a.route_stops?.name ?? '';
            const office = a.office_route_stops?.name ?? '';
            return `${name} ${pickup} ${office}`.toLowerCase().includes(q);
        });
    }, [assignments, search]);

    // Group riders by pickup, in morning boarding order, so ops can read "who boards where".
    const groups = useMemo(() => {
        const byStop = new Map<number | null, typeof visible>();
        for (const a of visible) {
            const key = a.pickup_stop_id ?? null;
            byStop.set(key, [...(byStop.get(key) ?? []), a]);
        }
        const order = (key: number | null) => {
            const s = key != null ? stopById.get(key) : undefined;
            return s ? (s.morning_sequence ?? s.sequence_order ?? 0) : Number.MAX_SAFE_INTEGER;
        };
        return [...byStop.entries()]
            .sort(([a], [b]) => order(a) - order(b))
            .map(([key, riders]) => {
                const stop = key != null ? stopById.get(key) : undefined;
                return {
                    key: key ?? 'none',
                    name: riders[0]?.route_stops?.name ?? stop?.name ?? 'Unknown pickup',
                    time: format12h(stop?.morning_eta ?? null),
                    seq: stop ? (stop.morning_sequence ?? stop.sequence_order) : null,
                    riders,
                };
            });
    }, [visible, stopById]);

    const pickupCount = new Set(assignments.map((a) => a.pickup_stop_id)).size;
    const isLoading = assignmentStatus === 'loading' && assignments.length === 0;
    const isAssigning = assignmentStatus === 'loading' && !isLoading;

    return (
        <div className="space-y-4">
            <SectionHeader
                title="Who normally rides this route"
                description="This is the standing roster. Day-of moves live on Today's shuttle plan."
                actions={
                    assignments.length > 0 ? (
                        <Badge tone="neutral">
                            {assignments.length} {assignments.length === 1 ? 'rider' : 'riders'} · {pickupCount} {pickupCount === 1 ? 'pickup' : 'pickups'}
                        </Badge>
                    ) : undefined
                }
            />

            {canEdit && (
                <Card>
                    <CardHeader title="Add a rider" description="Pick an employee and where they board." />
                    <CardContent>
                        <FormGrid cols={hasMultipleOffices ? 4 : 3} className="items-end">
                            <Field label="Employee">
                                <Select placeholder="Select employee" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                                    {availableEmployees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Pickup">
                                <Select
                                    placeholder="Select pickup"
                                    value={selectedStopId === '' ? '' : String(selectedStopId)}
                                    onChange={(e) => setSelectedStopId(e.target.value ? Number(e.target.value) : '')}
                                >
                                    {pickupStops.map((stop) => (
                                        <option key={stop.id} value={stop.id}>
                                            {stop.name}{stop.morning_eta ? ` · ${format12h(stop.morning_eta) ?? stop.morning_eta}` : ''}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            {hasMultipleOffices && (
                                <Field label="Office">
                                    <Select
                                        placeholder="Select office"
                                        value={selectedOfficeStopId === '' ? '' : String(selectedOfficeStopId)}
                                        onChange={(e) => setSelectedOfficeStopId(e.target.value ? Number(e.target.value) : '')}
                                    >
                                        {officeStops.map((stop) => (
                                            <option key={stop.id} value={stop.id}>{stop.name}</option>
                                        ))}
                                    </Select>
                                </Field>
                            )}
                            <Button onClick={() => void handleAssign()} loading={isAssigning} leftIcon={<UserPlus />}>
                                Add to route
                            </Button>
                        </FormGrid>
                        <p className="mt-2 text-xs text-fg-muted">
                            {hasMultipleOffices
                                ? 'Office stops are excluded from pickup — people board at pickups only. This route has multiple offices, so pick which one this person is assigned to.'
                                : 'Office is excluded — people board at pickups only.'}
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="max-w-sm">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder={hasMultipleOffices ? 'Search name, pickup, or office' : 'Search name or pickup'}
                    aria-label="Search roster"
                />
            </div>

            {isLoading ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                        <CardSkeleton key={i} lines={2} />
                    ))}
                </div>
            ) : visible.length === 0 ? (
                <Card>
                    <EmptyState
                        compact
                        icon={<Users aria-hidden="true" />}
                        title={assignments.length === 0 ? 'No one is on this route yet' : 'No one matches that search'}
                        description={assignments.length === 0 ? (canEdit ? 'Add people using the form above.' : undefined) : 'Try a different name or pickup.'}
                        action={search ? <Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear search</Button> : undefined}
                    />
                </Card>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => (
                        <Card key={group.key} className="overflow-hidden">
                            <div className="flex items-center gap-3 border-b border-line bg-subtle px-4 py-2.5">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info-soft text-[11px] font-semibold text-info-ink" aria-hidden="true">
                                    {group.seq ?? <MapPin className="size-3" />}
                                </span>
                                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{group.name}</h3>
                                {group.time && <span className="text-xs tabular-nums text-fg-muted">{group.time}</span>}
                                <Badge tone="neutral" size="sm">{group.riders.length}</Badge>
                            </div>
                            <ul className="divide-y divide-line">
                                {group.riders.map((assignment) => {
                                    const name = assignment.users?.full_name ?? 'Employee';
                                    const officeName = assignment.office_route_stops?.name ?? null;
                                    return (
                                        <li key={assignment.user_id} className="group flex items-center gap-3 px-4 py-2.5">
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink" aria-hidden="true">
                                                {initials(name)}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium text-fg">{name}</div>
                                                {assignment.users?.email && (
                                                    <div className="truncate text-xs text-fg-muted">{assignment.users.email}</div>
                                                )}
                                            </div>
                                            {hasMultipleOffices && officeName && <Badge tone="purple" size="sm">{officeName}</Badge>}
                                            {canEdit && (
                                                <IconButton
                                                    label={`Remove ${name} from this route`}
                                                    size="icon-xs"
                                                    className="shrink-0 text-danger-ink hover:bg-danger-soft hover:text-danger-ink md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
                                                    onClick={() => void handleRemove(assignment.user_id, name)}
                                                    loading={removingUserId === assignment.user_id}
                                                >
                                                    <UserMinus />
                                                </IconButton>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
