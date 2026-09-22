"use client";

import { useEffect, useState, useMemo } from "react";
import { apiClient } from "../lib/services/api-client";
import { VendorDashboardStats, BookingVendorRequest } from "../lib/services/types/multi-mode";
import { useVendorContext } from "./layout";
import {
    Inbox, Car, Users, Building2,
    Plus, Calendar, ArrowRight,
    TrendingUp, Shield, Map,
    ChevronRight, Clock, User
} from "lucide-react";
import Link from "next/link";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

function KpiCard({ label, value, icon: Icon, color, trend }: {
    label: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    trend?: string;
}) {
    return (
        <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color} transition-transform group-hover:scale-110`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <span className="flex items-center text-[10px] font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full uppercase tracking-wider">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-3xl font-black text-[#0c225e] mb-1">{value}</p>
                <p className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wide">{label}</p>
            </div>
            <div className="mt-4 h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                <div className={`h-full opacity-60 rounded-full ${color.replace('text-', 'bg-').split(' ')[0]}`} style={{ width: '60%' }} />
            </div>
        </div>
    );
}

function QuickAction({ label, icon: Icon, href, color }: { label: string; icon: React.ElementType; href: string; color: string }) {
    return (
        <Link href={href} className="group flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-[#f47f00] hover:shadow-md">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-[#0c225e] text-center">{label}</span>
        </Link>
    );
}

export default function VendorDashboardPage() {
    const { selectedLink } = useVendorContext();
    const [stats, setStats] = useState<VendorDashboardStats | null>(null);
    const [recentRequests, setRecentRequests] = useState<BookingVendorRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const currentTime = useMemo(() => {
        const now = new Date();
        return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [statsRes, reqsRes] = await Promise.all([
                    apiClient.getVendorDashboard(),
                    selectedLink ? apiClient.getVendorRequests({ link_id: selectedLink.id, limit: 3, status: 'PENDING' }) : Promise.resolve({ data: { data: [] } })
                ]);
                setStats(statsRes.data);
                setRecentRequests(reqsRes.data.data);
            } catch (error) {
                console.error("Dashboard data load error:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [selectedLink]);

    // Mock chart data
    const chartData = [
        { name: 'Mon', bookings: 4, requests: 2 },
        { name: 'Tue', bookings: 7, requests: 5 },
        { name: 'Wed', bookings: 5, requests: 8 },
        { name: 'Thu', bookings: 12, requests: 10 },
        { name: 'Fri', bookings: 9, requests: 6 },
        { name: 'Sat', bookings: 15, requests: 12 },
        { name: 'Sun', bookings: 10, requests: 7 },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-[#f9fafb] min-h-full">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#0c225e]">Hello, Vendor!</h1>
                    <div className="flex items-center gap-2 mt-2 text-[#9ca3af]">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">{currentTime}</span>
                        {selectedLink && (
                            <>
                                <span className="h-1 w-1 rounded-full bg-gray-300 mx-1" />
                                <span className="text-sm font-bold text-[#f47f00]">
                                    {selectedLink.companies?.name ?? `Link #${selectedLink.id}`}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="bg-white text-[#0c225e] border border-gray-200 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-all">
                        <Clock className="w-4 h-4" />
                        Generate Log
                    </button>
                    <Link href="/vendor/requests" className="bg-[#f47f00] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-[#f47f00]/20 hover:bg-[#e67c00] flex items-center gap-2 transition-all">
                        View Requests
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-36 animate-pulse" />
                    ))
                ) : stats ? (
                    <>
                        <KpiCard label="Pending Bookings" value={stats.pending_requests} icon={Inbox} color="bg-orange-50 text-[#f47f00]" trend="+12%" />
                        <KpiCard label="Travel rentals" value={stats.pending_travel_requests ?? 0} icon={Inbox} color="bg-indigo-50 text-indigo-600" />
                        <KpiCard label="Active Rides" value={stats.active_bookings} icon={Building2} color="bg-blue-50 text-blue-600" trend="+5%" />
                        <KpiCard label="Fleet" value={stats.total_vehicles} icon={Car} color="bg-green-50 text-green-600" />
                        <KpiCard label="Drivers" value={stats.total_drivers} icon={Users} color="bg-purple-50 text-purple-600" />
                    </>
                ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Analytics Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-black text-[#0c225e]">Performance Analytics</h2>
                            <p className="text-sm text-[#9ca3af] font-medium">Weekly booking vs requests trend</p>
                        </div>
                        <select className="bg-gray-50 border-none text-xs font-bold text-[#0c225e] rounded-lg px-3 py-1 focus:ring-0">
                            <option>Last 7 Days</option>
                            <option>Last 30 Days</option>
                        </select>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f47f00" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f47f00" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0c225e" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#0c225e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="bookings" stroke="#f47f00" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" />
                                <Area type="monotone" dataKey="requests" stroke="#0c225e" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <div className="bg-[#0c225e] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <Shield className="w-10 h-10 text-[#f47f00] mb-4" />
                            <h3 className="text-lg font-black mb-2">Fleet Management</h3>
                            <p className="text-white/70 text-sm mb-6 leading-relaxed">
                                Keep your fleet updated to receive more booking requests from partners.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Link href="/vendor/fleet/vehicles" className="flex items-center justify-center bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-white/10">
                                    Vehicles
                                </Link>
                                <Link href="/vendor/fleet/drivers" className="flex items-center justify-center bg-[#f47f00] hover:bg-[#e67c00] px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-black/20">
                                    Drivers
                                </Link>
                            </div>
                        </div>
                        {/* Decorative circle */}
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <QuickAction label="Add Vehicle" icon={Plus} href="/vendor/fleet/vehicles" color="bg-orange-50 text-[#f47f00]" />
                        <QuickAction label="New Driver" icon={User} href="/vendor/fleet/drivers" color="bg-blue-50 text-blue-600" />
                        <QuickAction label="Manage Routes" icon={Map} href="/vendor/routes" color="bg-green-50 text-green-600" />
                        <QuickAction label="All Bookings" icon={Calendar} href="/vendor/bookings" color="bg-purple-50 text-purple-600" />
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Requests */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-[#0c225e]">Pending Requests</h2>
                        <Link href="/vendor/requests" className="text-xs font-bold text-[#f47f00] hover:underline flex items-center gap-1">
                            View All
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                            ))
                        ) : recentRequests.length > 0 ? (
                            recentRequests.map((req) => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-2xl border border-transparent hover:border-gray-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                            <Calendar className="w-5 h-5 text-[#f47f00]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-[#0c225e] truncate max-w-[200px]">
                                                {req.chauffeur_bookings?.pickup_address ?? "New Request"}
                                            </p>
                                            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider mt-0.5">
                                                {req.chauffeur_bookings?.scheduled_for ? new Date(req.chauffeur_bookings.scheduled_for).toLocaleDateString() : 'Date TBD'} · {req.chauffeur_bookings?.package_selected}
                                            </p>
                                        </div>
                                    </div>
                                    <Link href="/vendor/requests" className="bg-white text-[#0c225e] border border-gray-200 h-10 w-10 rounded-xl flex items-center justify-center shadow-sm hover:border-[#f47f00] hover:text-[#f47f00] transition-all">
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Inbox className="w-8 h-8 text-[#9ca3af]" />
                                </div>
                                <p className="text-sm font-bold text-[#0c225e]">No pending requests</p>
                                <p className="text-xs text-[#9ca3af] mt-1">You're all caught up for today!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Company Linkings */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                    <h2 className="text-xl font-black text-[#0c225e] mb-6">Company Assignments</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stats?.company_links && stats.company_links.length > 0 ? (
                            stats.company_links.map((link) => (
                                <div key={link.link_id} className="p-4 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-8 w-8 rounded-lg bg-[#0c225e] flex items-center justify-center text-white text-[10px] font-black group-hover:bg-[#f47f00] transition-colors">
                                            {link.company_name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <p className="text-sm font-black text-[#0c225e] truncate">{link.company_name}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {link.serves_chauffeur && (
                                            <span className="text-[10px] font-black bg-orange-50 text-[#f47f00] px-2 py-1 rounded-lg uppercase tracking-wider">Chauffeur</span>
                                        )}
                                        {link.serves_shuttle && (
                                            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg uppercase tracking-wider">Shuttle</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[#9ca3af] font-medium col-span-2 py-10 text-center bg-gray-50 rounded-2xl">No active company assignments found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

