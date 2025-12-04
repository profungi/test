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
      <div className={`bg-[#2FA56D]/20 border-2 border-[#2FA56D]/40 rounded-2xl p-6 text-center ${className}`}>
        <p className="text-[#2FA56D] font-bold text-lg">
          ✨ {t('thankYou')}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white/90 backdrop-blur-sm border-2 border-[#F0D3B6] rounded-2xl p-6 shadow-md ${className}`}>
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-[#4A2C22] mb-2">
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
          <p className="text-sm text-[#4A2C22] mb-2 text-center font-medium">
            {t('commentPrompt')}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            className="w-full p-3 bg-white text-[#4A2C22] placeholder-[#4A2C22]/40 border-2 border-[#F0D3B6] rounded-xl resize-none focus:ring-2 focus:ring-[#A25AD9] focus:border-[#A25AD9] transition-all"
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
              className="px-4 py-2 text-[#4A2C22]/70 hover:text-[#4A2C22] font-medium transition-colors"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleCommentSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#A25AD9] text-white rounded-xl hover:bg-[#8C3EC5] font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-[#A25AD9]/30"
            >
              {isSubmitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
