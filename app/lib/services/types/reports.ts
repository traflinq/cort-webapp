import { ChauffeurTripDailyLog } from './bookings';

export interface ChauffeurReport {
    id: number;
    city?: string;
    completed_at: string;
    total_duration_minutes: number;
    total_distance_km: number;
    total_cost: number;
    company?: {
        id: number;
        name: string;
    } | null;
    passenger: {
        full_name: string;
        email: string;
        employee_id: string;
    } | null;
    driver: {
        full_name: string;
    } | null;
    vehicle: {
        make: string;
        model: string;
        plate_number: string;
    } | null;
    route: {
        pickup: string;
        dropoff: string;
    };
    breakdown: {
        service_charge: number;
        fuel_cost: number;
        toll: number;
        parking: number;
        accommodation: number;
        outstation_allowance: number;
        overtime: number;
        expense_toll_image_url?: string | null;
        expense_parking_image_url?: string | null;
    };
    daily_logs?: ChauffeurTripDailyLog[];
}

export interface ShuttlePassengerLog {
    status: string;
    scanned_at: string | null;
    drop_off_at: string | null;
    employee: {
        full_name: string;
        email: string;
        employee_id: string | null;
        department: string | null;
    } | null;
}

export interface ShuttleReport {
    id: number;
    trip_date: string;
    direction: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    route: {
        id: number;
        name: string;
        stops?: {
            id: number;
            name: string;
            sequence: number | null;
        }[];
    } | null;
    company: {
        id: number;
        name: string;
    } | null;
    vehicle: {
        make: string;
        model: string;
        plate_number: string;
    } | null;
    driver: {
        full_name: string;
    } | null;
    passengers: {
        total: number;
        boarded: number;
        absent: number;
        details: ShuttlePassengerLog[];
    };
    stop_logs?: {
        stop_id: number;
        stop_name: string | null;
        arrived_at: string | null;
        departed_at: string | null;
        boarded_at: string | null;
        drop_off_at: string | null;
        absent_at: string | null;
        morning_sequence: number | null;
        evening_sequence: number | null;
    }[];
}

export interface ReportQueryParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    routeId?: number;
}
