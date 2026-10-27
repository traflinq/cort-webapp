export interface SuperAdminDashboardStats {
    totalRevenue: MetricComparison;
    totalCOGS: MetricComparison;
    chauffeurCOGS: MetricComparison;
    shuttleCOGS: MetricComparison;
    chauffeurRevenue: MetricComparison;
    shuttleRevenue: MetricComparison;
    grossProfit: MetricComparison;
    netMargin: MetricComparison;
    ridesBreakdown: BreakdownItem[];
    expensesBreakdown: BreakdownItem[];
    fuelExpenses: BreakdownItem[];
    fuelMonthComparison?: FuelMonthComparison;
    repairExpenses: BreakdownItem[];
    oilMaintenanceExpenses: BreakdownItem[];
    revenueByClient: BreakdownItem[];
    chauffeurProfit: MetricComparison;
    shuttleProfit: MetricComparison;
    avgChauffeurProfit: MetricComparison;
    avgShuttleProfit: MetricComparison;
    chauffeurRides: MetricComparison;
    costPerRide: number;
    totalReceivables: number;
    totalPayables: number;
    currentPeriodReceivables: number | null;
    currentPeriodPayables: number | null;
    alerts: any[];
    totalUnassignedBookings: number;
    receivablesByClient: BreakdownItem[];
    overdueInvoices: OverdueInvoice[];
    revenueBreakdown: BreakdownItem[];
    problemReports: ProblemReport[];
    notStartedShuttleRides?: NotStartedShuttleRide[];
}

export interface OverdueInvoice {
    id: number;
    invoice_number: string;
    company_name: string;
    total_amount: number;
    generated_at: string;
    status: string;
}

export interface MetricComparison {
    current: number;
    previous: number;
    percentageChange: number;
    trend: string;
}

export interface BreakdownItem {
    name: string;
    value: number;
}

export interface ProblemReport {
    id: number;
    message: string;
    issue_type?: 'app_issue' | 'ride_issue' | 'other' | null;
    created_at: string;
    reported_by_user_id: string;
    company_id: number | null;
    reporter_name: string;
    reporter_email: string;
    reporter_role: string;
    company_name: string | null;
}

export interface FuelMonthComparison {
    currentLabel: string;
    previousLabel: string;
    rows: { name: string; current: number; previous: number }[];
}

export interface NotStartedShuttleRide {
    tripId: number;
    direction: 'MORNING' | 'EVENING';
    routeName: string;
    companyName: string | null;
    driverId: string | null;
    driverName: string | null;
    driverPhone: string | null;
    vehiclePlate: string | null;
    scheduledTime: string;
    minutesLate: number;
}
