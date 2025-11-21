'use client';

import { useEffect } from 'react';
import FeedbackWidget from './FeedbackWidget';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useSearchParams } from 'next/navigation';

interface FeedbackSectionProps {
  eventsCount: number;
}

export default function FeedbackSection({ eventsCount }: FeedbackSectionProps) {
  const searchParams = useSearchParams();
  const { applySavedPreferences, isLoaded } = useUserPreferences();

  // Apply saved preferences on first load
  useEffect(() => {
    if (isLoaded && !searchParams.toString()) {
      applySavedPreferences();
    }
  }, [isLoaded]);

  const filterState = {
    week: searchParams.get('week') || undefined,
    location: searchParams.get('location') || undefined,
    type: searchParams.get('type') || undefined,
    price: searchParams.get('price') || undefined,
  };

  return (
    <div className="mt-8 mb-8">
      <FeedbackWidget
        filterState={filterState}
        eventsShown={eventsCount}
      />
    </div>
  );
}
