"use client";

import { cx } from "../../../components/ui/cx";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../../../lib/services/api-client";

import type { useCompanyDetail } from "../hooks/useCompanyDetail";

type Props = { detail: ReturnType<typeof useCompanyDetail> };

export function CompanyServicesTab({ detail: d }: Props) {
  if (!d.company) return null;
  return (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {(d.featuresLoading || d.vendorsLoading) ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 animate-pulse">
                                    <div className="h-5 bg-slate-200 rounded w-1/4 mb-3"></div>
                                    <div className="h-3 bg-slate-200 rounded w-1/3 mb-6"></div>
                                    <div className="h-10 bg-slate-100 rounded w-full"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Chauffeur Service Card */}
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-base font-bold text-[#0c225e]">Chauffeur Service</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">On-demand point-to-point bookings</p>
                                    </div>
                                    <ToggleSwitch
                                        checked={d.company.is_chauffeur_enabled}
                                        onChange={() => d.toggleService('chauffeur')}
                                        disabled={!d.canUpdate}
                                        loading={d.isTogglePending('service:is_chauffeur_enabled')}
                                    />
                                </div>
                                {d.company.is_chauffeur_enabled ? (
                                    <div className="divide-y divide-slate-100">
                                        {/* CORT Managed */}
                                        {(() => {
                                            const cmChauffeur = d.features.find(f => f.feature_key === 'chauffeur_cort_managed')?.is_enabled ?? false;
                                            return (
                                        <div className="flex items-center justify-between px-5 py-4">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">CORT Managed</div>
                                                <div className="text-xs text-slate-500">CORT assigns drivers and vehicles for bookings</div>
                                            </div>
                                            <ToggleSwitch
                                                checked={cmChauffeur}
                                                onChange={() => d.handleChauffeurCortManagedToggle(!cmChauffeur)}
                                                disabled={!d.canUpdate}
                                                loading={d.isTogglePending('feature:chauffeur_cort_managed')}
                                            />
                                        </div>
                                            );
                                        })()}
                                        {/* External Vendor */}
                                        {(() => {
                                            const cvEnabled = d.features.find(f => f.feature_key === 'chauffeur_external_vendor')?.is_enabled ?? false;
                                            const cvVendors = d.companyVendorLinks.filter(l => l.serves_chauffeur);
                                            return (
                                                <div className="px-5 py-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-700">External Vendor</div>
                                                            <div className="text-xs text-slate-500">Third-party vendors fulfill bookings via their dashboard</div>
                                                        </div>
                                                        <ToggleSwitch
                                                            checked={cvEnabled}
                                                            onChange={() => d.toggleFeature('chauffeur_external_vendor', !cvEnabled)}
                                                            disabled={!d.canUpdate}
                                                            loading={d.isTogglePending('feature:chauffeur_external_vendor')}
                                                        />
                                                    </div>
                                                    
                                                    <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
                                                        {cvVendors.length > 0 && (
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                                    <tr>{["Vendor", "Status", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {cvVendors.map(link => (
                                                                        <tr key={link.id} className="hover:bg-slate-50">
                                                                            <td className="px-3 py-2 font-medium text-slate-800">{link.external_vendors?.name ?? `Vendor #${link.vendor_id}`}</td>
                                                                            <td className="px-3 py-2">
                                                                                <button onClick={() => d.updateLink(link.id, { is_active: !link.is_active })} className={cx("inline-flex px-2 py-0.5 rounded-full text-xs font-medium transition-colors", link.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                                                                                    {link.is_active ? "Active" : "Inactive"}
                                                                                </button>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-right"><button onClick={() => d.removeLink(link.id)} className="text-red-400 hover:text-red-600 hover:underline">Remove</button></td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                        {cvVendors.length === 0 && <div className="px-4 py-3 text-xs text-slate-400 bg-slate-50">No vendors linked for chauffeur yet.</div>}
                                                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                                                            <span className="text-[11px] text-slate-400">
                                                                {cvEnabled ? "Link a vendor for chauffeur fulfilment." : "Link a vendor first, then enable External Vendor."}
                                                            </span>
                                                            <button
                                                                onClick={() => d.openLinkModal('chauffeur')}
                                                                disabled={!d.canUpdate}
                                                                className={cx(
                                                                    "text-xs font-semibold",
                                                                    d.canUpdate ? "text-[#f47f00] hover:underline" : "text-slate-300 cursor-not-allowed"
                                                                )}
                                                            >
                                                                + Add Vendor
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                </div>
                                    );
                                })()}
                                {/* Own Pool */}
                                {(() => {
                                    const smEnabled = d.features.find(f => f.feature_key === 'chauffeur_self_managed')?.is_enabled ?? false;
                                    return (
                                        <div className="flex items-center justify-between px-5 py-4">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">Own Pool (Self-Managed)</div>
                                                <div className="text-xs text-slate-500">Company runs its own drivers and vehicle pool</div>
                                            </div>
                                            <ToggleSwitch
                                                checked={smEnabled}
                                                onChange={() => d.toggleFeature('chauffeur_self_managed', !smEnabled)}
                                                disabled={!d.canUpdate}
                                                loading={d.isTogglePending('feature:chauffeur_self_managed')}
                                            />
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="px-5 py-4 text-sm text-slate-400 bg-slate-50/50">Enable Chauffeur Service to configure fulfilment modes.</div>
                        )}
                    </div>

                    {/* Shuttle Service Card */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-bold text-[#0c225e]">Shuttle Service</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Fixed routes with scheduled stops</p>
                            </div>
                            <ToggleSwitch
                                checked={d.company.is_shuttle_enabled}
                                onChange={() => d.toggleService('shuttle')}
                                disabled={!d.canUpdate}
                                loading={d.isTogglePending('service:is_shuttle_enabled')}
                            />
                        </div>
                        {d.company.is_shuttle_enabled ? (
                            <div className="divide-y divide-slate-100">
                                {/* CORT Managed */}
                                {(() => {
                                    const cmShuttle = d.features.find(f => f.feature_key === 'shuttle_cort_managed')?.is_enabled ?? false;
                                    return (
                                <div className="flex items-center justify-between px-5 py-4">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-700">CORT Managed</div>
                                        <div className="text-xs text-slate-500">CORT manages shuttle routes and drivers</div>
                                    </div>
                                    <ToggleSwitch
                                        checked={cmShuttle}
                                        onChange={() => d.handleShuttleCortManagedToggle(!cmShuttle)}
                                        disabled={!d.canUpdate}
                                        loading={d.isTogglePending('feature:shuttle_cort_managed')}
                                    />
                                </div>
                                    );
                                })()}
                                {/* External Vendor */}
                                {(() => {
                                    const svEnabled = d.features.find(f => f.feature_key === 'shuttle_external_vendor')?.is_enabled ?? false;
                                    const svVendors = d.companyVendorLinks.filter(l => l.serves_shuttle);
                                    return (
                                        <div className="px-5 py-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-700">External Vendor</div>
                                                    <div className="text-xs text-slate-500">Third-party vendors manage shuttle routes</div>
                                                </div>
                                                <ToggleSwitch
                                                    checked={svEnabled}
                                                    onChange={() => d.toggleFeature('shuttle_external_vendor', !svEnabled)}
                                                    disabled={!d.canUpdate}
                                                    loading={d.isTogglePending('feature:shuttle_external_vendor')}
                                                />
                                            </div>
                                            
                                            <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
                                                {svVendors.length > 0 && (
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-200">
                                                            <tr>{["Vendor", "Status", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {svVendors.map(link => (
                                                                <tr key={link.id} className="hover:bg-slate-50">
                                                                    <td className="px-3 py-2 font-medium text-slate-800">{link.external_vendors?.name ?? `Vendor #${link.vendor_id}`}</td>
                                                                    <td className="px-3 py-2">
                                                                        <button onClick={() => d.updateLink(link.id, { is_active: !link.is_active })} className={cx("inline-flex px-2 py-0.5 rounded-full text-xs font-medium transition-colors", link.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                                                                            {link.is_active ? "Active" : "Inactive"}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right"><button onClick={() => d.removeLink(link.id)} className="text-red-400 hover:text-red-600 hover:underline">Remove</button></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                                {svVendors.length === 0 && <div className="px-4 py-3 text-xs text-slate-400 bg-slate-50">No vendors linked for shuttle yet.</div>}
                                                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                                                    <span className="text-[11px] text-slate-400">
                                                        {svEnabled ? "Link a vendor for shuttle fulfilment." : "Link a vendor first, then enable External Vendor."}
                                                    </span>
                                                    <button
                                                        onClick={() => d.openLinkModal('shuttle')}
                                                        disabled={!d.canUpdate}
                                                        className={cx(
                                                            "text-xs font-semibold",
                                                            d.canUpdate ? "text-[#f47f00] hover:underline" : "text-slate-300 cursor-not-allowed"
                                                        )}
                                                    >
                                                + Add Vendor
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                </div>
                                    );
                                })()}
                                {/* Own Fleet (Self-Managed) */}
                                {(() => {
                                    const smEnabled = d.features.find(f => f.feature_key === 'shuttle_self_managed')?.is_enabled ?? false;
                                    return (
                                        <div className="flex items-center justify-between px-5 py-4">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">Own Fleet (Self-Managed)</div>
                                                <div className="text-xs text-slate-500">Company runs its own shuttle vehicles, drivers, routes, stops, and employee assignments</div>
                                            </div>
                                            <ToggleSwitch
                                                checked={smEnabled}
                                                onChange={() => d.toggleFeature('shuttle_self_managed', !smEnabled)}
                                                disabled={!d.canUpdate}
                                                loading={d.isTogglePending('feature:shuttle_self_managed')}
                                            />
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="px-5 py-4 text-sm text-slate-400 bg-slate-50/50">Enable Shuttle Service to configure fulfilment modes.</div>
                        )}
                    </div>

                    {/* Tracking Card */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-base font-bold text-[#0c225e]">Tracking</h3>
                            <p className="text-xs text-slate-500 mt-0.5">How vehicles and drivers are tracked. Both methods can be active simultaneously.</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {(() => {
                                const tEnabled = d.features.find(f => f.feature_key === 'tracker_api_integration')?.is_enabled ?? false;
                                return (
                                    <div className="px-5 py-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">Third-Party Tracker API</div>
                                                <div className="text-xs text-slate-500">Integrate with the d.company's own external tracking system</div>
                                            </div>
                                            <ToggleSwitch
                                                checked={tEnabled}
                                                onChange={() => d.toggleFeature('tracker_api_integration', !tEnabled)}
                                                disabled={!d.canUpdate}
                                                loading={d.isTogglePending('feature:tracker_api_integration')}
                                            />
                                        </div>
                                        {tEnabled && (
                                            <form onSubmit={d.saveTrackerConfig} className="mt-3 bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-3">
                                                <p className="text-xs font-semibold text-blue-800">TPL Trakker Credentials</p>
                                                <p className="text-[11px] text-blue-600">
                                                    Enter the account credentials from TPL Trakker. The system will call
                                                    <code className="mx-1 px-1 py-0.5 bg-blue-100 rounded text-[10px]">GetToken</code> then
                                                    <code className="mx-1 px-1 py-0.5 bg-blue-100 rounded text-[10px]">GetVLL</code>
                                                    every 30 seconds to update vehicle positions.
                                                </p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">UserID</label>
                                                        <input
                                                            type="text"
                                                            value={d.trackerForm.user_id}
                                                            onChange={(e) => d.setTrackerForm(f => ({ ...f, user_id: e.target.value }))}
                                                            placeholder="e.g. Z1X5CVA"
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                                                        <input
                                                            type="password"
                                                            value={d.trackerForm.password}
                                                            onChange={(e) => d.setTrackerForm(f => ({ ...f, password: e.target.value }))}
                                                            placeholder="••••••••"
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                                                        <input
                                                            type="text"
                                                            value={d.trackerForm.phone}
                                                            onChange={(e) => d.setTrackerForm(f => ({ ...f, phone: e.target.value }))}
                                                            placeholder="e.g. 03156618471"
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                                                        <input
                                                            type="text"
                                                            value={d.trackerForm.year}
                                                            onChange={(e) => d.setTrackerForm(f => ({ ...f, year: e.target.value }))}
                                                            placeholder="e.g. 1992"
                                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button
                                                        type="submit"
                                                        disabled={d.trackerSaving}
                                                        className="bg-[#f47f00] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                                                    >
                                                        {d.trackerSaving ? 'Saving…' : 'Save Credentials'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={d.testTrackerConnection}
                                                        disabled={d.trackerTesting || !d.trackerForm.user_id || !d.trackerForm.phone}
                                                        className="border border-blue-400 text-blue-700 bg-white text-sm px-4 py-2 rounded-lg disabled:opacity-40 hover:bg-blue-50 transition-colors"
                                                    >
                                                        {d.trackerTesting ? 'Testing…' : 'Test Connection'}
                                                    </button>
                                                </div>
                                                {d.trackerTestResult && (
                                                    <div className={`rounded-lg p-3 text-xs border ${d.trackerTestResult.count > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                                                        {d.trackerTestResult.count > 0 ? (
                                                            <>
                                                                <span className="font-bold">✓ {d.trackerTestResult.count} vehicle(s) found.</span>
                                                                {d.trackerTestResult.vehicles.length > 0 && (
                                                                    <span className="ml-2 font-mono">
                                                                        {d.trackerTestResult.vehicles.join(', ')}
                                                                        {d.trackerTestResult.count > 5 ? ` +${d.trackerTestResult.count - 5} more` : ''}
                                                                    </span>
                                                                )}
                                                                <p className="mt-1 text-green-700 font-medium">
                                                                    Vehicles matching active trip plate numbers will appear live on the mobility map.
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <span className="font-bold">⚠ Connected but no vehicles found. Check Phone and Year fields.</span>
                                                        )}
                                                    </div>
                                                )}
                                            </form>
                                        )}

                                    </div>
                                );
                            })()}
                            {(() => {
                                const appEnabled = d.features.find(f => f.feature_key === 'tracking_via_app')?.is_enabled ?? false;
                                return (
                                    <div className="flex items-center justify-between px-5 py-4">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-700">App Tracking (CORT)</div>
                                            <div className="text-xs text-slate-500">Track drivers and vehicles via GPS in the CORT mobile app</div>
                                        </div>
                                        <ToggleSwitch
                                            checked={appEnabled}
                                            onChange={() => d.toggleFeature('tracking_via_app', !appEnabled)}
                                            disabled={!d.canUpdate}
                                            loading={d.isTogglePending('feature:tracking_via_app')}
                                        />
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <TravelModuleCard detail={d} />

                    {/* Add-ons Card */}
                    {(() => {
                        const aiEnabled = d.features.find(f => f.feature_key === 'ai_insights')?.is_enabled ?? false;
                        return (
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-slate-100">
                                    <h3 className="text-base font-bold text-[#0c225e]">Add-ons</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Optional d.features available to any configuration.</p>
                                </div>
                                <div className="flex items-center justify-between px-5 py-4">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-700">AI Insights</div>
                                        <div className="text-xs text-slate-500">AI-powered cost savings analysis and recommendations</div>
                                    </div>
                                    <ToggleSwitch
                                        checked={aiEnabled}
                                        onChange={() => d.toggleFeature('ai_insights', !aiEnabled)}
                                        disabled={!d.canUpdate}
                                        loading={d.isTogglePending('feature:ai_insights')}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Active Services Summary */}
                    {(() => {
                        const cvEnabled = d.features.find(f => f.feature_key === 'chauffeur_external_vendor')?.is_enabled ?? false;
                        const svEnabled = d.features.find(f => f.feature_key === 'shuttle_external_vendor')?.is_enabled ?? false;
                        const smChauffeurEnabled = d.features.find(f => f.feature_key === 'chauffeur_self_managed')?.is_enabled ?? false;
                        const smShuttleEnabled = d.features.find(f => f.feature_key === 'shuttle_self_managed')?.is_enabled ?? false;
                        const cmChauffeur = d.features.find(f => f.feature_key === 'chauffeur_cort_managed')?.is_enabled ?? false;
                        const cmShuttle = d.features.find(f => f.feature_key === 'shuttle_cort_managed')?.is_enabled ?? false;
                        const tEnabled = d.features.find(f => f.feature_key === 'tracker_api_integration')?.is_enabled ?? false;
                        const appEnabled = d.features.find(f => f.feature_key === 'tracking_via_app')?.is_enabled ?? false;
                        const aiEnabled = d.features.find(f => f.feature_key === 'ai_insights')?.is_enabled ?? false;
                        const cvCount = d.companyVendorLinks.filter(l => l.serves_chauffeur && l.is_active).length;
                        const svCount = d.companyVendorLinks.filter(l => l.serves_shuttle && l.is_active).length;
                        const items: { label: string; color: "blue" | "green" | "purple" | "orange" }[] = [];
                        if (d.company.is_chauffeur_enabled) {
                            if (cmChauffeur) items.push({ label: "Chauffeur — CORT Managed", color: "blue" });
                            if (cvEnabled) items.push({ label: `Chauffeur — External Vendor (${cvCount} active)`, color: "purple" });
                            if (smChauffeurEnabled) items.push({ label: "Chauffeur — Own Pool", color: "green" });
                        }
                        if (d.company.is_shuttle_enabled) {
                            if (cmShuttle) items.push({ label: "Shuttle — CORT Managed", color: "blue" });
                            if (svEnabled) items.push({ label: `Shuttle — External Vendor (${svCount} active)`, color: "purple" });
                            if (smShuttleEnabled) items.push({ label: "Shuttle — Own Fleet", color: "green" });
                        }
                        if (tEnabled) items.push({ label: "Tracking — Third-Party API", color: "orange" });
                        if (appEnabled) items.push({ label: "Tracking — CORT App GPS", color: "orange" });
                        if (aiEnabled) items.push({ label: "Add-on: AI Insights", color: "green" });
                        if (d.company.is_travel_enabled) items.push({ label: "Travel Packages", color: "blue" });
                        return (
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                                <h3 className="text-sm font-bold text-slate-600 mb-3">Active Services Summary</h3>
                                {items.length === 0 ? (
                                    <p className="text-xs text-slate-400">No services enabled yet.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {items.map((item, i) => <Badge key={i} color={item.color}>{item.label}</Badge>)}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Link Vendor Modal */}
                    {d.showLinkModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900">Link External Vendor</h2>
                                    <button onClick={() => d.setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                                </div>
                                <form onSubmit={d.handleLinkVendor} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Select Vendor *</label>
                                        <select required value={d.linkForm.vendor_id} onChange={(e) => d.setLinkForm(f => ({ ...f, vendor_id: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                            <option value={0}>— Choose a vendor —</option>
                                            {d.allVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-4">
                                        <label className={cx("flex items-center gap-2 text-sm", d.linkContext === 'chauffeur' ? "opacity-60" : "cursor-pointer")}>
                                            <input type="checkbox" checked={d.linkForm.serves_chauffeur} disabled={d.linkContext === 'chauffeur'} onChange={(e) => d.linkContext !== 'chauffeur' && d.setLinkForm(f => ({ ...f, serves_chauffeur: e.target.checked }))} />
                                            Serves Chauffeur
                                        </label>
                                        <label className={cx("flex items-center gap-2 text-sm", d.linkContext === 'shuttle' ? "opacity-60" : "cursor-pointer")}>
                                            <input type="checkbox" checked={d.linkForm.serves_shuttle} disabled={d.linkContext === 'shuttle'} onChange={(e) => d.linkContext !== 'shuttle' && d.setLinkForm(f => ({ ...f, serves_shuttle: e.target.checked }))} />
                                            Serves Shuttle
                                        </label>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-2">
                                        <button type="button" onClick={() => d.setShowLinkModal(false)} disabled={d.linkSaving} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                                        <button type="submit" disabled={d.linkSaving || !d.linkForm.vendor_id} className="inline-flex items-center justify-center gap-2 bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                            {d.linkSaving && (
                                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-25" />
                                                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-90" />
                                                </svg>
                                            )}
                                            {d.linkSaving ? "Saving..." : "Link Vendor"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                        </>
                    )}
                </div>
  );
}

function TravelModuleCard({ detail: d }: { detail: ReturnType<typeof useCompanyDetail> }) {
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [allocating, setAllocating] = useState(false);
  const enabled = d.company?.is_travel_enabled ?? false;

  useEffect(() => {
    if (!enabled || !d.company) return;
    apiClient.getAdminCompanyTravelWallet(d.company.id)
      .then((res) => setWallet(res.data))
      .catch(() => setWallet({ balance: 0 }));
  }, [enabled, d.company]);

  const allocate = async () => {
    if (!d.company || allocating) return;
    setAllocating(true);
    try {
      const res = await apiClient.allocateCompanyTravelWallet(d.company.id, Number(amount));
      setWallet(res.data);
      setAmount("");
      toast.success("Company travel wallet funded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to allocate");
    } finally {
      setAllocating(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-[#0c225e]">Travel Packages</h3>
          <p className="text-xs text-slate-500 mt-0.5">Bus, flight, train, and car bookings with first and last mile</p>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={() => d.toggleService("travel")}
          disabled={!d.canUpdate}
          loading={d.isTogglePending("service:is_travel_enabled")}
        />
      </div>
      {enabled && (
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-600">Company wallet: <span className="font-bold">PKR {Number(wallet?.balance ?? 0).toLocaleString()}</span></p>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Allocate amount"
              className="border rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button onClick={allocate} disabled={!d.canUpdate || !amount || allocating} className="bg-[#f47f00] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
              {allocating ? "Allocating..." : "Allocate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
