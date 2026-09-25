"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { Toaster } from "sonner";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/contexts/auth-context";
import { UserRole, VendorLink } from "../lib/types/auth-types";
import {
    LayoutDashboard,
    Inbox,
    Car,
    Users,
    Map,
    LogOut,
    Menu,
    X,
    ChevronDown,
    ClipboardList,
} from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

// ─── Vendor Context ──────────────────────────────────────────────────────────

interface VendorContextValue {
    selectedLink: VendorLink | null;
    setSelectedLink: (link: VendorLink) => void;
}

const VendorContext = createContext<VendorContextValue>({
    selectedLink: null,
    setSelectedLink: () => {},
});

export function useVendorContext() {
    return useContext(VendorContext);
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function VendorLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, isAuthenticated, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedLink, setSelectedLinkState] = useState<VendorLink | null>(null);
    const [showCompanySwitcher, setShowCompanySwitcher] = useState(false);

    // Guard: only COMPANY_VENDOR
    useEffect(() => {
        if (loading || pathname === "/vendor/login") return;
        if (!isAuthenticated || user?.role !== UserRole.COMPANY_VENDOR) {
            router.replace("/vendor/login");
        }
    }, [loading, isAuthenticated, user, router, pathname]);

    // Initialize selected link from localStorage or first link
    useEffect(() => {
        if (!user?.vendor_links?.length) return;
        const stored = typeof window !== "undefined" ? localStorage.getItem("vendor_link_id") : null;
        const storedLink = stored ? user.vendor_links.find((l) => l.id === Number(stored)) : null;
        const activeLinks = user.vendor_links.filter((l) => l.is_active);
        setSelectedLinkState(storedLink ?? activeLinks[0] ?? user.vendor_links[0]);
    }, [user]);

    const setSelectedLink = useCallback((link: VendorLink) => {
        setSelectedLinkState(link);
        if (typeof window !== "undefined") {
            localStorage.setItem("vendor_link_id", String(link.id));
        }
        setShowCompanySwitcher(false);
    }, []);

    const isLogin = pathname === "/vendor/login";

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-[#f47f00] border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (isLogin) return <>{children}</>;

    if (!user || user.role !== UserRole.COMPANY_VENDOR) {
        return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-[#f47f00] border-t-transparent rounded-full animate-spin" /></div>;
    }

    const links = user.vendor_links ?? [];
    const activeLinks = links.filter((l) => l.is_active);

    const navItems = [
        { href: "/vendor", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/vendor/requests", label: "Booking Requests", icon: Inbox },
        { href: "/vendor/bookings", label: "Bookings", icon: ClipboardList },
        { href: "/vendor/fleet/vehicles", label: "Vehicles", icon: Car },
        { href: "/vendor/travel-cars", label: "Travel rentals", icon: Car },
        { href: "/vendor/travel-mile-vehicles", label: "Travel miles", icon: Car },
        { href: "/vendor/fleet/drivers", label: "Drivers", icon: Users },
        ...(selectedLink?.serves_shuttle ? [{ href: "/vendor/routes", label: "Routes", icon: Map }] : []),
    ];

    const isActive = (href: string, exact?: boolean) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0c225e] to-[#081845]">
            {/* Logo */}
            <div className="px-6 py-10 flex items-center">
                <img src="/traflinq_dark_no_tagline-Photoroom.png" alt="Traflinq" className="h-15 w-auto" />
            </div>

            {/* Company Switcher */}
            {activeLinks.length > 0 && (
                <div className="px-4 mb-8 relative">
                    <button
                        onClick={() => setShowCompanySwitcher(!showCompanySwitcher)}
                        className="w-full flex items-center justify-between bg-white/5 rounded-2xl px-4 py-4 text-left hover:bg-white/10 transition-all border border-white/5 shadow-inner"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Current Partner</p>
                            <p className="text-sm font-black text-white truncate pr-2">
                                {selectedLink?.companies?.name ?? `Link #${selectedLink?.id}`}
                            </p>
                            <div className="flex gap-1.5 mt-1.5">
                                {selectedLink?.serves_chauffeur && <span className="text-[9px] font-black bg-[#f47f00]/20 text-[#f47f00] px-2 py-0.5 rounded-md uppercase">Chauffeur</span>}
                                {selectedLink?.serves_shuttle && <span className="text-[9px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md uppercase">Shuttle</span>}
                            </div>
                        </div>
                        <ChevronDown className={cx("w-4 h-4 text-white/40 transition-transform duration-300", showCompanySwitcher && "rotate-180")} />
                    </button>
                    {showCompanySwitcher && (
                        <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-2xl shadow-2xl z-50 py-2 border border-gray-100 overflow-hidden ring-4 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="px-4 py-2 border-b border-gray-50 mb-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Partner</p>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {activeLinks.map((link) => (
                                    <button
                                        key={link.id}
                                        onClick={() => setSelectedLink(link)}
                                        className={cx(
                                            "w-full text-left px-4 py-3 text-sm transition-all flex flex-col gap-0.5",
                                            selectedLink?.id === link.id 
                                                ? "bg-orange-50/50 text-[#f47f00] font-black border-l-4 border-[#f47f00]" 
                                                : "text-gray-600 hover:bg-gray-50 border-l-4 border-transparent"
                                        )}
                                    >
                                        <p className="font-bold">{link.companies?.name ?? `Link #${link.id}`}</p>
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            {[link.serves_chauffeur && "Chauffeur", link.serves_shuttle && "Shuttle"].filter(Boolean).join(" · ")}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-2">
                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] px-4 mb-4">Main Menu</p>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href, item.exact);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cx(
                                "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all relative group",
                                active
                                    ? "bg-[#f47f00] text-white shadow-xl shadow-[#f47f00]/20"
                                    : "text-white/60 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <Icon className={cx("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", active ? "text-white" : "text-white/40 group-hover:text-white")} />
                            {item.label}
                            {active && (
                                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* User / Logout */}
            <div className="px-4 py-8 border-t border-white/5 bg-black/10">
                <div className="bg-white/5 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#f47f00] to-[#ff9b33] flex items-center justify-center text-white text-sm font-black shadow-lg">
                            {user.full_name?.[0]?.toUpperCase() ?? "V"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white truncate">{user.full_name}</p>
                            <p className="text-[10px] font-bold text-white/40 truncate tracking-tight">{user.email}</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 text-xs font-black text-white/50 hover:text-red-400 px-4 py-3 rounded-xl hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                >
                    <LogOut className="w-4 h-4" />
                    SIGN OUT
                </button>
            </div>
        </div>
    );

    return (
        <VendorContext.Provider value={{ selectedLink, setSelectedLink }}>
            <div className="flex h-screen bg-gray-50">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:flex w-64 shrink-0 flex-col">
                    <SidebarContent />
                </aside>

                {/* Mobile Sidebar */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
                        <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col">
                            <SidebarContent />
                        </aside>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Mobile Header */}
                    <header className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
                            <Menu className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="text-sm font-semibold text-[#0c225e]">Vendor Portal</span>
                        <div className="w-9" />
                    </header>

                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
            <Toaster position="top-right" richColors />
        </VendorContext.Provider>
    );
}
