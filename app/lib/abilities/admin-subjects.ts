import type { PermissionKey } from "../types/auth-types";

/**
 * CASL subject names for admin sections — one per PermissionKey.
 * Use these with AdminCan / useAdminAbility (e.g. I="read" a="Dashboard").
 */
export const ADMIN_SUBJECTS = {
  dashboard: "Dashboard",
  companies: "Companies",
  pricing: "Pricing",
  vehicles: "Vehicles",
  fuel_records: "FuelRecords",
  maintenance: "Maintenance",
  vendors: "Vendors",
  vendor_logs: "VendorLogs",
  drivers: "Drivers",
  bookings: "Bookings",
  routes: "Routes",
  ops_shuttle: "OpsShuttle",
  shuttle_audit: "ShuttleAudit",
  ops_chauffeur: "OpsChauffeur",
  reports: "Reports",
  expenses: "Expenses",
  invoicing: "Invoicing",
  fixed_contracts: "FixedContracts",
  external_vendors: "ExternalVendors",
  company_features: "CompanyFeatures",
  vendor_fleet: "VendorFleet",
  fleet_efficiency: "FleetEfficiency",
} as const satisfies Record<PermissionKey, string>;

export type AdminSubject = (typeof ADMIN_SUBJECTS)[PermissionKey];
