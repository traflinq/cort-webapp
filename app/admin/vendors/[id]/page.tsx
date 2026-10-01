'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '../../../lib/store/hooks';
import {
    selectAdminVendors,
} from '../../../lib/store/slices/adminVendorsSlice';
import {
    fetchAdminCompanies,
    selectAdminCompanies,
} from '../../../lib/store/slices/adminCompaniesSlice';
import {
    fetchVendorLogs,
    fetchVendorStats,
    markVendorLogsAsPaid,
    selectVendorLogs,
    selectVendorStats,
    selectVendorLogsStatus,
    selectVendorLogsPagination,
    createVendorPayment
} from '../../../lib/store/slices/vendorLogsSlice';
import { ArrowLeft, Calendar, Filter, DollarSign, X, Pencil, Check } from 'lucide-react';
import Pagination from '../../../components/ui/Pagination';
import { AdminProtectedPage } from '../../components/AdminProtectedPage';
import { useAdminAbility } from '../../../lib/abilities/AdminAbilityProvider';
import { ADMIN_SUBJECTS } from '../../../lib/abilities/admin-subjects';
import { apiClient } from '../../../lib/services/api-client';

export default function VendorDetailsPage() {
    return (
        <AdminProtectedPage permission="vendor_logs" subject={ADMIN_SUBJECTS.vendor_logs}>
            <VendorDetailsContent />
        </AdminProtectedPage>
    );
}

function VendorDetailsContent() {
    const params = useParams();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const ability = useAdminAbility();
    const canEditPayments = ability.can('update', ADMIN_SUBJECTS.vendor_logs);
    const vendorId = Number(params.id);

    const logs = useAppSelector(selectVendorLogs);
    const stats = useAppSelector(selectVendorStats);
    const logsStatus = useAppSelector(selectVendorLogsStatus);
    const logsPagination = useAppSelector(selectVendorLogsPagination);
    const vendors = useAppSelector(selectAdminVendors);
    const companies = useAppSelector(selectAdminCompanies);

    // We might need to fetch the single vendor details if not in list, but let's assume we can get it or just show ID/Logs for now.
    // Or we can rely on the logs to show vendor details? No.
    // Ideally we should have `fetchVendorById`. For now, let's just use the ID in header or try to find in list.
    const vendor = vendors.find(v => v.id === vendorId);

    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        payment_status: '',
        company_id: '',
    });

    useEffect(() => {
        dispatch(fetchAdminCompanies({ limit: 200 }));
    }, [dispatch]);

    useEffect(() => {
        if (vendorId) {
            const statsParams = {
                vendor_id: vendorId,
                ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
            };
            dispatch(fetchVendorStats(statsParams));
            dispatch(fetchVendorLogs({
                vendor_id: vendorId,
                page: 1,
                limit: 10,
                ...(filters.start_date ? { start_date: filters.start_date } : {}),
                ...(filters.end_date ? { end_date: filters.end_date } : {}),
                ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
                ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
            }));
        }
    }, [dispatch, vendorId, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedLogForPayment, setSelectedLogForPayment] = useState<{
        type: 'CHAUFFEUR' | 'SHUTTLE';
        id: number;
        cost: number;
        paid: number;
    } | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    // Settlement breakdown modal state (chauffeur only)
    const [settlementOpen, setSettlementOpen] = useState(false);
    const [settlementLog, setSettlementLog] = useState<any | null>(null);
    const [settlementLoading, setSettlementLoading] = useState(false);
    const [settlementError, setSettlementError] = useState<string | null>(null);
    const [settlementTxns, setSettlementTxns] = useState<any[]>([]);

    // Inline row-edit state for settlement transactions
    const [editingTxnId, setEditingTxnId] = useState<number | null>(null);
    const [editTxnForm, setEditTxnForm] = useState({ amount: '', payment_method: '', notes: '', payment_date: '' });
    const [savingTxn, setSavingTxn] = useState(false);
    const [txnEditError, setTxnEditError] = useState<string | null>(null);

    const toDatetimeLocal = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const startEditTxn = (t: any) => {
        setEditingTxnId(t.id);
        setEditTxnForm({
            amount: String(Number(t.amount || 0)),
            payment_method: t.payment_method || '',
            notes: t.notes || '',
            payment_date: t.payment_date ? toDatetimeLocal(t.payment_date) : '',
        });
        setTxnEditError(null);
    };

    const cancelEditTxn = () => {
        setEditingTxnId(null);
        setTxnEditError(null);
    };

    const refreshVendorLogsAndStats = () => {
        dispatch(fetchVendorStats({
            vendor_id: vendorId,
            ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
        }));
        dispatch(fetchVendorLogs({
            vendor_id: vendorId,
            page: logsPagination.page,
            limit: logsPagination.limit,
            ...(filters.start_date ? { start_date: filters.start_date } : {}),
            ...(filters.end_date ? { end_date: filters.end_date } : {}),
            ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
            ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
        }));
    };

    const saveEditTxn = async (txnId: number) => {
        const amount = parseFloat(editTxnForm.amount);
        if (isNaN(amount) || amount <= 0) {
            setTxnEditError('Enter a valid amount greater than zero.');
            return;
        }
        setSavingTxn(true);
        setTxnEditError(null);
        try {
            await apiClient.updateVendorPayment(txnId, {
                amount,
                payment_method: editTxnForm.payment_method || undefined,
                notes: editTxnForm.notes || undefined,
                payment_date: editTxnForm.payment_date ? new Date(editTxnForm.payment_date).toISOString() : undefined,
            });

            if (settlementLog?.booking_id) {
                const res: any = await apiClient.getVendorPaymentHistory(settlementLog.booking_id);
                const txns = Array.isArray(res) ? res : (res?.data ?? []);
                setSettlementTxns(Array.isArray(txns) ? txns : []);
            }
            refreshVendorLogsAndStats();
            setEditingTxnId(null);
        } catch (e: any) {
            setTxnEditError(e?.message || 'Failed to save changes.');
        } finally {
            setSavingTxn(false);
        }
    };

    const openSettlement = async (log: any) => {
        setSettlementLog(log);
        setSettlementOpen(true);
        setSettlementError(null);
        setSettlementTxns([]);
        setEditingTxnId(null);
        setTxnEditError(null);

        if (!log?.booking_id || log?.type !== 'CHAUFFEUR') {
            return;
        }

        setSettlementLoading(true);
        try {
            const res: any = await apiClient.getVendorPaymentHistory(log.booking_id);
            const txns = Array.isArray(res) ? res : (res?.data ?? []);
            setSettlementTxns(Array.isArray(txns) ? txns : []);
        } catch (e: any) {
            setSettlementError(e?.message || 'Failed to load settlement history');
        } finally {
            setSettlementLoading(false);
        }
    };

    const openPaymentModal = (
        log: { type?: string; booking_id?: number; invoice_id?: number; cost: number; amount_paid?: number },
    ) => {
        const isShuttle = log.type === 'SHUTTLE';
        const id = isShuttle ? log.invoice_id : log.booking_id;
        if (!id) return;

        const cost = Number(log.cost);
        const paid = Number(log.amount_paid || 0);
        setSelectedLogForPayment({
            type: isShuttle ? 'SHUTTLE' : 'CHAUFFEUR',
            id,
            cost,
            paid,
        });
        setPaymentAmount(cost > 0 ? Math.max(cost - paid, 0).toString() : '');
        setPaymentNotes('');
        setPaymentError(null);
        setIsPaymentModalOpen(true);
    };

    const closePaymentModal = () => {
        setIsPaymentModalOpen(false);
        setSelectedLogForPayment(null);
        setPaymentAmount('');
        setPaymentNotes('');
        setPaymentError(null);
    };

    const handleSubmitPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLogForPayment || !paymentAmount) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            setPaymentError('Please enter a valid amount greater than zero.');
            return;
        }

        setIsSubmittingPayment(true);
        setPaymentError(null);
        try {
            const payload =
                selectedLogForPayment.type === 'SHUTTLE'
                    ? { invoice_id: selectedLogForPayment.id, amount, notes: paymentNotes, payment_method: 'CASH' as const }
                    : { booking_id: selectedLogForPayment.id, amount, notes: paymentNotes, payment_method: 'CASH' as const };

            await dispatch(createVendorPayment(payload)).unwrap();

            dispatch(fetchVendorStats({
                vendor_id: vendorId,
                ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
            }));
            dispatch(fetchVendorLogs({
                vendor_id: vendorId,
                page: logsPagination.page,
                limit: logsPagination.limit,
                ...(filters.start_date ? { start_date: filters.start_date } : {}),
                ...(filters.end_date ? { end_date: filters.end_date } : {}),
                ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
                ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
            }));
            closePaymentModal();
        } catch (error: any) {
            setPaymentError(error?.message || 'Failed to record payment. Please try again.');
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {vendor?.name || `Vendor #${vendorId}`}
                    </h1>
                    <p className="text-slate-500">Vendor Trip & Shuttle Logs · Financials</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Total Logs</h3>
                    <div className="text-3xl font-bold text-slate-900">
                        {logsStatus === 'loading' ? '...' : stats?.total_rides || 0}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Total Cost</h3>
                    <div className="text-3xl font-bold text-slate-900">
                        PKR {logsStatus === 'loading' ? '...' : (stats?.total_cost || 0).toLocaleString()}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Total Outstanding</h3>
                    <div className={`text-3xl font-bold ${(stats?.total_outstanding || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        PKR {logsStatus === 'loading' ? '...' : (stats?.total_outstanding || 0).toLocaleString()}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm bg-blue-50/30">
                    <h3 className="text-sm font-medium text-blue-600 mb-2 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Settled To Date
                    </h3>
                    <div className="text-3xl font-bold text-blue-700">
                        PKR {logsStatus === 'loading' ? '...' : ((stats?.total_cost || 0) - (stats?.total_outstanding || 0)).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="date"
                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                        />
                    </div>
                    <span className="text-slate-400">-</span>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="date"
                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <select
                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-transparent"
                            value={filters.company_id}
                            onChange={(e) => handleFilterChange('company_id', e.target.value)}
                        >
                            <option value="">All Companies</option>
                            {companies.map((company) => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <select
                            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-transparent"
                            value={filters.payment_status}
                            onChange={(e) => handleFilterChange('payment_status', e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="FULLY_PAID">Fully Paid</option>
                            <option value="PARTIALLY_PAID">Partially Paid</option>
                            <option value="UNPAID">Unpaid</option>
                        </select>
                    </div>
                </div>

                {/* Only visible when rows are selected */}

            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Date</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Settled At</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Type</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Reference / Passenger</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Driver</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Charged Against</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Vehicle</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Vendor Cost</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-center">Status</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logsStatus === 'loading' ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                        No logs found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log: any) => {
                                    const statusRaw = log.status || '';
                                    const isPaid = ['FULLY_PAID', 'PAID'].includes(statusRaw.toUpperCase());
                                    const canSettle = !isPaid && (
                                        (log.type === 'CHAUFFEUR' && log.booking_id) ||
                                        (log.type === 'SHUTTLE' && log.invoice_id)
                                    );
                                    const isAdvanceOnly = Number(log.cost) <= 0;

                                    return (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                                            onClick={() => openSettlement(log)}
                                            title={log.type === 'CHAUFFEUR' ? 'Click to view settlement breakdown' : log.type === 'TRAVEL' ? 'Travel partner vehicle log' : 'Settlement breakdown not available for shuttle yet'}
                                        >
                                            <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                                {new Date(log.date).toLocaleDateString()}
                                                <div className="text-[10px] text-slate-400">
                                                    {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                                {log.settled_at ? (
                                                    <>
                                                        {new Date(log.settled_at).toLocaleDateString()}
                                                        <div className="text-[10px] text-slate-400">
                                                            {new Date(log.settled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    log.type === 'SHUTTLE'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : log.type === 'TRAVEL'
                                                            ? 'bg-orange-100 text-orange-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {log.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900 font-medium">{log.passenger || 'N/A'}</div>
                                                <div className="text-xs text-slate-500">{log.details || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900">{log.driver || '—'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.invoice_id ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">
                                                        Invoice #{log.invoice_id}
                                                    </span>
                                                ) : log.booking_id ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                                                        Booking #{log.booking_id}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-900">{log.vehicle || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-medium text-slate-900">
                                                    PKR {Number(log.cost).toLocaleString()}
                                                </div>
                                                {Number(log.amount_paid || 0) > 0 ? (
                                                    <div className="text-[10px] space-y-0.5">
                                                        <div className="text-green-600 font-medium">
                                                            Paid: PKR {Number(log.amount_paid).toLocaleString()}
                                                        </div>
                                                        <div className="text-slate-400">
                                                            Rem: PKR {Number(log.amount_remaining).toLocaleString()}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${isPaid
                                                    ? 'bg-green-100 text-green-700'
                                                    : statusRaw === 'PARTIALLY_PAID'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {log.status || 'UNPAID'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {canSettle && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openPaymentModal(log);
                                                        }}
                                                        className="text-orange hover:opacity-80 font-bold text-xs inline-flex items-center gap-1 uppercase"
                                                    >
                                                        <DollarSign className="w-3.5 h-3.5" />
                                                        {isAdvanceOnly ? 'Pay Advance' : 'Settle'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="border-t border-slate-200">
                    <Pagination
                        currentPage={logsPagination.page}
                        totalPages={logsPagination.pages}
                        onPageChange={(page) => {
                            dispatch(fetchVendorLogs({
                                vendor_id: vendorId,
                                page,
                                limit: logsPagination.limit,
                                ...(filters.start_date ? { start_date: filters.start_date } : {}),
                                ...(filters.end_date ? { end_date: filters.end_date } : {}),
                                ...(filters.payment_status ? { payment_status: filters.payment_status } : {}),
                                ...(filters.company_id ? { company_id: Number(filters.company_id) } : {}),
                            }));
                        }}
                    />
                </div>
            </div>

            {/* Payment Modal */}
            {
                isPaymentModalOpen && selectedLogForPayment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
                                <button onClick={closePaymentModal} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmitPayment} className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {selectedLogForPayment.type === 'SHUTTLE' ? 'Invoice ID' : 'Booking ID'}
                                    </label>
                                    <div className="text-slate-900 font-semibold">#{selectedLogForPayment.id}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Cost</label>
                                    <div className="text-slate-900">
                                        {selectedLogForPayment.cost > 0
                                            ? `PKR ${selectedLogForPayment.cost.toLocaleString()}`
                                            : <span className="text-orange-600 text-sm font-medium">Trip in progress — cost not yet finalized</span>
                                        }
                                    </div>
                                    {selectedLogForPayment.paid > 0 && (
                                        <div className="text-xs text-green-600 mt-1">
                                            Already paid: PKR {selectedLogForPayment.paid.toLocaleString()}
                                            {' · '}
                                            Remaining: PKR {Math.max(selectedLogForPayment.cost - selectedLogForPayment.paid, 0).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">PKR</span>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            step="0.01"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            className="w-full pl-12 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                                    <textarea
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none h-24"
                                        placeholder="Enter payment details..."
                                    />
                                </div>
                                {paymentError && (
                                    <p className="text-sm text-red-600">{paymentError}</p>
                                )}
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={closePaymentModal}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingPayment}
                                        className="px-4 py-2 bg-orange text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSubmittingPayment ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Record Payment'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Settlement Breakdown Modal */}
            {settlementOpen && settlementLog && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => {
                        setSettlementOpen(false);
                        setSettlementLog(null);
                        setSettlementTxns([]);
                        setSettlementError(null);
                    }}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-900">Settlement Breakdown</h3>
                            <button
                                onClick={() => {
                                    setSettlementOpen(false);
                                    setSettlementLog(null);
                                    setSettlementTxns([]);
                                    setSettlementError(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <div className="text-xs text-slate-500">Type</div>
                                    <div className="font-semibold text-slate-900">{settlementLog.type}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">Booking</div>
                                    <div className="font-semibold text-slate-900">{settlementLog.booking_id ? `#${settlementLog.booking_id}` : '—'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">Status</div>
                                    <div className="font-semibold text-slate-900">{settlementLog.status || 'UNPAID'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">Total Cost</div>
                                    <div className="font-semibold text-slate-900">PKR {Number(settlementLog.cost || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">Paid</div>
                                    <div className="font-semibold text-green-700">PKR {Number(settlementLog.amount_paid || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500">Remaining</div>
                                    <div className="font-semibold text-orange-700">PKR {Number(settlementLog.amount_remaining || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            {settlementLog.type !== 'CHAUFFEUR' ? (
                                <div className="text-sm text-slate-500">
                                    Settlement breakdown is currently available for chauffeur logs only.
                                </div>
                            ) : settlementLoading ? (
                                <div className="text-sm text-slate-500">Loading settlement history…</div>
                            ) : settlementError ? (
                                <div className="text-sm text-red-600">{settlementError}</div>
                            ) : (
                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    {txnEditError && (
                                        <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">{txnEditError}</div>
                                    )}
                                    <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                                                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Amount</th>
                                                <th className="px-4 py-3 font-semibold text-slate-700">Method</th>
                                                <th className="px-4 py-3 font-semibold text-slate-700">Notes</th>
                                                <th className="px-4 py-3 font-semibold text-slate-700">Settled By</th>
                                                <th className="sticky right-0 bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-right shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {settlementTxns.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                                        No payments recorded yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                settlementTxns.map((t: any) => {
                                                    const isEditing = editingTxnId === t.id;
                                                    return (
                                                        <tr key={t.id} className="group hover:bg-slate-50">
                                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="datetime-local"
                                                                        value={editTxnForm.payment_date}
                                                                        onChange={(e) => setEditTxnForm(f => ({ ...f, payment_date: e.target.value }))}
                                                                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                                                                    />
                                                                ) : (
                                                                    t.payment_date ? new Date(t.payment_date).toLocaleString() : '—'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={editTxnForm.amount}
                                                                        onChange={(e) => setEditTxnForm(f => ({ ...f, amount: e.target.value }))}
                                                                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm text-right"
                                                                    />
                                                                ) : (
                                                                    `PKR ${Number(t.amount || 0).toLocaleString()}`
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editTxnForm.payment_method}
                                                                        onChange={(e) => setEditTxnForm(f => ({ ...f, payment_method: e.target.value }))}
                                                                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                                                                    />
                                                                ) : (
                                                                    t.payment_method || '—'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editTxnForm.notes}
                                                                        onChange={(e) => setEditTxnForm(f => ({ ...f, notes: e.target.value }))}
                                                                        className="w-full min-w-[10rem] rounded-md border border-slate-300 px-2 py-1 text-sm"
                                                                    />
                                                                ) : (
                                                                    t.notes || '—'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                                                {t.users?.full_name || t.created_by || '—'}
                                                            </td>
                                                            <td className="sticky right-0 bg-white group-hover:bg-slate-50 px-4 py-3 text-right whitespace-nowrap shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">
                                                                {!canEditPayments ? (
                                                                    <span className="text-slate-300">—</span>
                                                                ) : isEditing ? (
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => saveEditTxn(t.id)}
                                                                            disabled={savingTxn}
                                                                            title="Save"
                                                                            className="rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={cancelEditTxn}
                                                                            disabled={savingTxn}
                                                                            title="Cancel"
                                                                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startEditTxn(t)}
                                                                        title="Edit payment"
                                                                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
