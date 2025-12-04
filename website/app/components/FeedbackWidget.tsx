'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

interface FeedbackWidgetProps {
  filterState?: {
    week?: string;
    location?: string;
    type?: string;
    price?: string;
  };
  eventsShown: number;
  className?: string;
}

export default function FeedbackWidget({
  filterState,
  eventsShown,
  className = '',
}: FeedbackWidgetProps) {
  const t = useTranslations('feedback');
  const locale = useLocale();

  const [selectedFeedback, setSelectedFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  const handleThumbClick = async (type: 'thumbs_up' | 'thumbs_down') => {
    if (isSubmitted) return;

    setSelectedFeedback(type);

    // For thumbs down, show comment box
    if (type === 'thumbs_down') {
      setShowCommentBox(true);
      return;
    }

    // For thumbs up, submit immediately
    await submitFeedback(type, '');
  };

  const submitFeedback = async (feedbackType: 'thumbs_up' | 'thumbs_down', feedbackComment: string) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackType,
          comment: feedbackComment,
          filterState,
          eventsShown,
          locale,
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setShowCommentBox(false);
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (selectedFeedback) {
      await submitFeedback(selectedFeedback, comment);
    }
  };

  if (isSubmitted) {
    return (
      <div className={`bg-green-900/40 border border-green-400/50 rounded-lg p-6 text-center ${className}`}>
        <p className="text-green-200 font-medium">
          {t('thankYou')}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-purple-900/30 backdrop-blur-sm border border-purple-400/30 rounded-lg p-6 ${className}`}>
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-purple-100 mb-2">
          {t('question')}
        </h3>
      </div>

      {/* Thumbs up/down buttons */}
      <div className="flex justify-center gap-6 mb-4">
        <button
          onClick={() => handleThumbClick('thumbs_up')}
          disabled={isSubmitting || isSubmitted}
          className={`
            text-5xl transition-all duration-200 transform hover:scale-110
            ${selectedFeedback === 'thumbs_up' ? 'scale-125' : ''}
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:drop-shadow-lg'}
          `}
          aria-label={t('helpful')}
        >
          👍
        </button>
        <button
          onClick={() => handleThumbClick('thumbs_down')}
          disabled={isSubmitting || isSubmitted}
          className={`
            text-5xl transition-all duration-200 transform hover:scale-110
            ${selectedFeedback === 'thumbs_down' ? 'scale-125' : ''}
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:drop-shadow-lg'}
          `}
          aria-label={t('notHelpful')}
        >
          👎
        </button>
      </div>

      {/* Comment box for thumbs down */}
      {showCommentBox && (
        <div className="mt-4 animate-fadeIn">
          <p className="text-sm text-purple-200 mb-2 text-center">
            {t('commentPrompt')}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            className="w-full p-3 bg-purple-950/50 text-white placeholder-purple-400 border border-purple-400/40 rounded-lg resize-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            rows={3}
            maxLength={500}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowCommentBox(false);
                setSelectedFeedback(null);
                setComment('');
              }}
              className="px-4 py-2 text-purple-300 hover:text-purple-100 transition-colors"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleCommentSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/50"
            >
              {isSubmitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
