'use client';

import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ReviewAuthor {
  _id: string;
  name?: string;
  profilePicture?: string;
}

interface Review {
  _id: string;
  user: ReviewAuthor;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewsProps {
  targetType: 'hostel' | 'product';
  targetId: string;
  averageRating?: number;
  reviewCount?: number;
  title?: string;
}

export function Reviews({ targetType, targetId, averageRating = 0, reviewCount = 0, title = 'Ratings & Reviews' }: ReviewsProps) {
  const { user: authUser, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');

  const loadReviews = async () => {
    try {
      const res = await api.get('/reviews', { params: { targetType, targetId } });
      setReviews(res.data?.data ?? []);
    } catch (e) {
      console.error('Failed to load reviews', e);
    }
  };

  const loadMyReview = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/reviews/my', { params: { targetType, targetId } });
      setMyReview(res.data?.data ?? null);
      if (res.data?.data) {
        setFormRating(res.data.data.rating);
        setFormComment(res.data.data.comment || '');
      } else {
        setFormRating(5);
        setFormComment('');
      }
    } catch (e) {
      console.error('Failed to load my review', e);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await Promise.all([loadReviews(), loadMyReview()]);
      setLoading(false);
    };
    run();
  }, [targetType, targetId, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (myReview) {
        await api.patch(`/reviews/${myReview._id}`, { rating: formRating, comment: formComment });
        setEditingId(null);
      } else {
        await api.post('/reviews', {
          targetType,
          targetId,
          rating: formRating,
          comment: formComment,
        });
      }
      await loadReviews();
      await loadMyReview();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to save review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview || !confirm('Delete your review?')) return;
    setSubmitting(true);
    try {
      await api.delete(`/reviews/${myReview._id}`);
      setMyReview(null);
      setFormRating(5);
      setFormComment('');
      setEditingId(null);
      await loadReviews();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to delete review');
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = isAuthenticated && ((editingId === 'new' && !myReview) || editingId === myReview?._id);
  const displayRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : (averageRating || 0).toFixed(1);
  const displayCount = reviews.length || reviewCount || 0;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-paw-bark mb-3">{title}</h2>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex text-amber-500">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-5 h-5 ${i <= Math.round(Number(displayRating)) ? 'fill-current' : ''}`}
            />
          ))}
        </div>
        <span className="font-bold text-gray-800">{displayRating}</span>
        <span className="text-gray-600">({displayCount} reviews)</span>
      </div>

      {isAuthenticated && !myReview && !editingId && (
        <button
          type="button"
          onClick={() => setEditingId('new')}
          className="mb-4 flex items-center gap-2 text-paw-bark font-medium hover:underline"
        >
          <MessageSquare className="w-4 h-4" />
          Write a review
        </button>
      )}
      {isAuthenticated && myReview && editingId !== myReview._id && (
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingId(myReview._id)}
            className="flex items-center gap-1 text-paw-bark font-medium hover:underline"
          >
            <Pencil className="w-4 h-4" />
            Edit your review
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex items-center gap-1 text-red-600 font-medium hover:underline disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your rating</label>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFormRating(i)}
                className="p-1 rounded hover:bg-amber-100"
              >
                <Star className={`w-8 h-8 ${i <= formRating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
          <textarea
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-paw-bark focus:border-paw-bark outline-none"
            placeholder="Share your experience..."
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-paw-bark text-white rounded-lg font-medium hover:bg-paw-bark/90 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : myReview ? 'Update review' : 'Submit review'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-sm text-gray-600">No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r._id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-paw-bark/20 flex items-center justify-center text-paw-bark font-semibold text-sm">
                    {(r.user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-800">{r.user?.name || 'Anonymous'}</span>
                </div>
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`w-4 h-4 ${i <= r.rating ? 'fill-current' : ''}`} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
              <p className="text-xs text-gray-500 mt-2">
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
