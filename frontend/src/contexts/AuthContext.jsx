import React, { createContext, useContext, useCallback, useMemo } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchCurrentUser();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data);
        } catch (error) {
            console.error('Failed to fetch current user:', error.response?.data?.detail || error.message);
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        // Use URLSearchParams so the payload is encoded exactly as
        // application/x-www-form-urlencoded, which FastAPI's
        // OAuth2PasswordRequestForm expects.
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await api.post('/auth/login/access-token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, user: userData } = response.data;
        localStorage.setItem('token', access_token);
        if (userData) {
            setUser(userData);
        } else {
            await fetchCurrentUser();
        }
        return response.data;
    };

    const register = async (userData) => {
        const response = await api.post('/auth/register', userData);
        return response.data;
    };

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
    }, []);

    // Computed properties for role checks
    const isAuthenticated = useMemo(() => !!user, [user]);
    const isAdmin = useMemo(() => user?.role === 'admin', [user]);
    const userRole = useMemo(() => user?.role || 'analyst', [user]);

    // Role check helper
    const hasRole = useCallback((role) => {
        if (!user) return false;
        if (Array.isArray(role)) return role.includes(user.role);
        return user.role === role;
    }, [user]);

    // Permission check helper
    const hasPermission = useCallback((permission) => {
        if (!user) return false;
        // Admin has all permissions
        if (user.role === 'admin') return true;
        // Check based on role hierarchy
        const permissions = {
            admin: ['read', 'write', 'delete', 'admin', 'settings'],
            analyst: ['read', 'write'],
            viewer: ['read'],
        };
        return permissions[user.role]?.includes(permission) || false;
    }, [user]);

    const value = useMemo(() => ({
        user,
        loading,
        login,
        logout,
        register,
        isAuthenticated,
        isAdmin,
        userRole,
        hasRole,
        hasPermission,
        refreshUser: fetchCurrentUser,
    }), [user, loading, logout, isAuthenticated, isAdmin, userRole, hasRole, hasPermission]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
