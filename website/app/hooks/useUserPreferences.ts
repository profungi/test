'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface UserPreferences {
  location?: string;
  type?: string;
  week?: string;
  price?: string;
  referrer?: string;
  lastVisit?: string;
  visitCount?: number;
}

const STORAGE_KEY = 'bayAreaEventsPreferences';
const REFERRER_KEY = 'bayAreaEventsReferrer';

/**
 * Hook to manage user preferences using localStorage
 * Automatically saves and loads user's filter preferences
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedPrefs = localStorage.getItem(STORAGE_KEY);
      const savedReferrer = localStorage.getItem(REFERRER_KEY);

      // Parse saved preferences or use empty object
      let parsed: UserPreferences = {};
      if (savedPrefs) {
        parsed = JSON.parse(savedPrefs);
        setPreferences(parsed);
      }

      // Save referrer on first visit
      if (!savedReferrer && document.referrer) {
        localStorage.setItem(REFERRER_KEY, document.referrer);
        setPreferences((prev) => ({
          ...prev,
          referrer: document.referrer,
        }));
      } else if (savedReferrer) {
        setPreferences((prev) => ({
          ...prev,
          referrer: savedReferrer,
        }));
      }

      // Update visit count
      const visitCount = (parsed?.visitCount || 0) + 1;
      const updatedPrefs = {
        ...parsed,
        lastVisit: new Date().toISOString(),
        visitCount,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPrefs));
      setPreferences(updatedPrefs);
      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading preferences:', error);
      setIsLoaded(true);
    }
  }, []);

  // Save current filter state to preferences
  const savePreferences = (newPrefs: Partial<UserPreferences>) => {
    if (typeof window === 'undefined') return;

    try {
      const updated = {
        ...preferences,
        ...newPrefs,
        lastVisit: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setPreferences(updated);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Auto-save filter changes
  useEffect(() => {
    if (!isLoaded) return;

    const location = searchParams.get('location') || undefined;
    const type = searchParams.get('type') || undefined;
    const week = searchParams.get('week') || undefined;
    const price = searchParams.get('price') || undefined;

    // Only save if filters are explicitly set by user
    if (location || type || week || price) {
      savePreferences({ location, type, week, price });
    }
  }, [searchParams, isLoaded]);

  // Apply saved preferences to URL (only on first load if no params exist)
  const applySavedPreferences = () => {
    if (typeof window === 'undefined' || !isLoaded) return;

    // Don't override existing URL params
    if (searchParams.toString()) return;

    // Apply saved preferences if they exist
    const params = new URLSearchParams();

    if (preferences.week) params.set('week', preferences.week);
    if (preferences.location) params.set('location', preferences.location);
    if (preferences.type) params.set('type', preferences.type);
    if (preferences.price) params.set('price', preferences.price);

    if (params.toString()) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  // Clear preferences
  const clearPreferences = () => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEY);
      setPreferences({});
    } catch (error) {
      console.error('Error clearing preferences:', error);
    }
  };

  // Get analytics data for feedback submission
  const getAnalyticsData = () => {
    return {
      referrer: preferences.referrer,
      visitCount: preferences.visitCount,
      lastVisit: preferences.lastVisit,
      currentFilters: {
        location: searchParams.get('location'),
        type: searchParams.get('type'),
        week: searchParams.get('week'),
        price: searchParams.get('price'),
      },
    };
  };

  return {
    preferences,
    isLoaded,
    savePreferences,
    clearPreferences,
    applySavedPreferences,
    getAnalyticsData,
  };
}
