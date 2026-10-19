import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateAppearancePreference } from '../adapters/tauri';
import type { BusinessSettings } from '../types';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  appearance: AppearanceMode;
  resolvedTheme: ResolvedTheme;
  setAppearance: (mode: AppearanceMode) => Promise<void>;
  persistenceError: string | null;
  clearPersistenceError: () => void;
  reconcilePreference: (mode: AppearanceMode) => void;
}

const STORAGE_KEY = 'billzen_appearance_pref';

export function getStoredAppearance(): AppearanceMode {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch {
    // LocalStorage might be unavailable in restricted environments
  }
  return 'system';
}

export function resolveAppearance(mode: AppearanceMode): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyThemeToDOM(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Coordinate Android WebView & mobile native status/navigation bar theme
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.setAttribute('name', 'theme-color');
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', resolved === 'dark' ? '#09090b' : '#ffffff');

  // Explicitly notify Android native host for status bar & navigation bar contrast
  if (typeof (window as any).BillZenNative?.setDarkMode === 'function') {
    try {
      (window as any).BillZenNative.setDarkMode(resolved === 'dark');
    } catch {}
  }
}

// Synchronous initialization before React paint to prevent theme flash
export function initThemeBeforeMount(): ResolvedTheme {
  const pref = getStoredAppearance();
  const resolved = resolveAppearance(pref);
  applyThemeToDOM(resolved);
  return resolved;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  initialPreference,
}: {
  children: React.ReactNode;
  initialPreference?: AppearanceMode;
}) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // Graceful fallback if rendered outside QueryClientProvider
  }

  const [appearance, setAppearanceState] = useState<AppearanceMode>(() => {
    return initialPreference || getStoredAppearance();
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    return resolveAppearance(appearance);
  });

  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  // Apply to DOM whenever resolved theme changes
  useEffect(() => {
    const resolved = resolveAppearance(appearance);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
  }, [appearance]);

  // Listen to OS-level prefers-color-scheme changes when in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only react to OS changes if in 'system' mode
      if (appearance === 'system') {
        const nextResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(nextResolved);
        applyThemeToDOM(nextResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [appearance]);

  const reconcilePreference = (mode: AppearanceMode) => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      if (mode !== appearance) {
        setAppearanceState(mode);
        const resolved = resolveAppearance(mode);
        setResolvedTheme(resolved);
        applyThemeToDOM(resolved);
        try {
          localStorage.setItem(STORAGE_KEY, mode);
        } catch {}
      }
    }
  };

  const handleSetAppearance = async (mode: AppearanceMode) => {
    const previousAppearance = appearance;
    setAppearanceState(mode);
    const nextResolved = resolveAppearance(mode);
    setResolvedTheme(nextResolved);
    applyThemeToDOM(nextResolved);
    setPersistenceError(null);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}

    // Persist to backend SQLite store
    try {
      await updateAppearancePreference(mode);
      if (queryClient) {
        queryClient.setQueryData<BusinessSettings>(['business_settings'], (old) => {
          if (!old) return old;
          return { ...old, appearance_preference: mode };
        });
      }
    } catch (e: any) {
      console.warn('Failed to persist appearance preference to backend, rolling back:', e);
      // Roll back to previous state and localStorage
      setAppearanceState(previousAppearance);
      const prevResolved = resolveAppearance(previousAppearance);
      setResolvedTheme(prevResolved);
      applyThemeToDOM(prevResolved);
      try {
        localStorage.setItem(STORAGE_KEY, previousAppearance);
      } catch {}
      setPersistenceError(
        typeof e === 'string' ? e : e?.message || 'Failed to save appearance preference to database'
      );
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        appearance,
        resolvedTheme,
        setAppearance: handleSetAppearance,
        persistenceError,
        clearPersistenceError: () => setPersistenceError(null),
        reconcilePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
