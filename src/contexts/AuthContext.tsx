import { createContext, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const mockProfile: Profile = {
    id: 'mock-id',
    email: 'admin@sps.fr',
    first_name: 'Admin',
    last_name: 'SPS',
    phone: null,
    role: 'super_admin',
    zone_geographique: null,
    specialite: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const value: AuthContextType = {
    user: null,
    profile: mockProfile,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refreshProfile: async () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
