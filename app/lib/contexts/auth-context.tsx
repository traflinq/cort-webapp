"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../services/api-client';
import {
    AuthContextType,
    AuthUser,
    AuthSession,
    UserRole,
    PermissionKey,
    CrudAction,
} from '../types/auth-types';
import { staffHasCrud } from '../utils/staff-permissions';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [session, setSession] = useState<AuthSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const loadUserProfile = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            if (!apiClient.isAuthenticated()) {
                setUser(null);
                setSession(null);
                setLoading(false);
                return;
            }

            const response = await apiClient.getProfile();
            setUser(response.data);
        } catch (err) {
            console.error('Failed to load user profile:', err);
            setError(err instanceof Error ? err.message : 'Failed to load profile');
            await apiClient.logout();
            setUser(null);
            setSession(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUserProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiClient.login({ email, password });

            setUser(response.data.user);
            setSession(response.data.session);

            if (response.data.user.role === UserRole.COMPANY_VENDOR) {
                router.push('/vendor');
            } else if (response.data.user.role === UserRole.CORT_VENDOR) {
                router.push('/cort-vendor');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [router]);

    const logout = useCallback(async () => {
        try {
            setLoading(true);
            await apiClient.logout();
            setUser(null);
            setSession(null);
            setError(null);
            router.push('/');
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    const refreshProfile = useCallback(async () => {
        await loadUserProfile();
    }, [loadUserProfile]);

    const markTrialOnboardingComplete = useCallback(() => {
        setUser((prev) =>
            prev ? { ...prev, trial_onboarding_completed: true } : prev,
        );
    }, []);

    const isAuthenticated = !!user && !!apiClient.isAuthenticated();
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    const isInternalStaff = user?.role === UserRole.INTERNAL_STAFF;
    const isCompanyAdmin = user?.role === UserRole.COMPANY_ADMIN;
    const isEmployee = user?.role === UserRole.EMPLOYEE;
    const isDriver = user?.role === UserRole.DRIVER;
    const isCompanyVendor = user?.role === UserRole.COMPANY_VENDOR;
    const isCortVendor = user?.role === UserRole.CORT_VENDOR;

    const hasRole = useCallback((roles: UserRole[]): boolean => {
        if (!user) return false;
        return roles.includes(user.role);
    }, [user]);

    const hasCompanyAccess = useCallback((companyId: number): boolean => {
        if (!user) return false;
        if (user.role === UserRole.SUPER_ADMIN) return true;
        return user.company_id === companyId;
    }, [user]);

    const hasCrud = useCallback((key: PermissionKey, action: CrudAction): boolean => {
        if (!user) return false;
        if (user.role === UserRole.SUPER_ADMIN) return true;
        if (user.role === UserRole.INTERNAL_STAFF) {
            return staffHasCrud(user.permissions ?? null, key, action);
        }
        return false;
    }, [user]);

    const hasPermission = useCallback(
        (key: PermissionKey): boolean => hasCrud(key, 'read'),
        [hasCrud],
    );

    const isShuttleEnabled = !!user && (user.role === UserRole.SUPER_ADMIN || user.enabled_services?.shuttle === true);
    const isChauffeurEnabled = !!user && (user.role === UserRole.SUPER_ADMIN || user.enabled_services?.chauffeur === true);

    const value: AuthContextType = {
        user,
        session,
        loading,
        error,
        login,
        logout,
        refreshProfile,
        markTrialOnboardingComplete,
        isAuthenticated,
        isSuperAdmin,
        isInternalStaff,
        isCompanyAdmin,
        isEmployee,
        isDriver,
        isCompanyVendor,
        isCortVendor,
        hasRole,
        hasCompanyAccess,
        hasPermission,
        hasCrud,
        isShuttleEnabled,
        isChauffeurEnabled,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
