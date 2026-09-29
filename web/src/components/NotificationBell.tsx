import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { NotificationDTO } from '../types';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  MessageSquare,
  Megaphone,
  Clock,
  ExternalLink,
  Check,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface NotificationBellProps {
  onOpenChat?: (conversationId?: string, studentId?: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenChat }) => {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.list(20, 0);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // 1. Initial fetch on mount
    fetchNotifications();

    // 2. Connect to real-time Server-Sent Events (SSE) stream
    const streamUrl = api.notifications.getStreamUrl();
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('notification', (e: MessageEvent) => {
      try {
        const newNotif: NotificationDTO = JSON.parse(e.data);
        setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
        setUnreadCount((prev) => prev + 1);
      } catch (err) {
        console.error('Failed to parse SSE notification:', err);
      }
    });

    eventSource.onerror = () => {
      // EventSource natively auto-reconnects with exponential backoff on network interruption
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (notif: NotificationDTO) => {
    if (!notif.is_read) {
      try {
        await api.notifications.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }

    if (notif.type === 'message' && notif.data?.conversation_id && onOpenChat) {
      onOpenChat(notif.data.conversation_id, notif.data?.student_id);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'absence_alert':
        return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4 text-indigo-500" />;
      case 'lesson_created':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-400" />
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500/30 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-400/30">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold">No notifications right now</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Absence alerts, class announcements, and messages will show here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const timeAgo = new Date(notif.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 ${
                      !notif.is_read ? 'bg-indigo-50/40' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 h-fit ${
                        notif.type === 'absence_alert'
                          ? 'bg-rose-100/70 border border-rose-200'
                          : notif.type === 'message'
                          ? 'bg-emerald-100/70 border border-emerald-200'
                          : notif.type === 'lesson_created'
                          ? 'bg-amber-100/70 border border-amber-200'
                          : 'bg-indigo-100/70 border border-indigo-200'
                      }`}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4
                          className={`text-xs truncate ${
                            !notif.is_read
                              ? 'font-bold text-slate-900'
                              : 'font-medium text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-sans">
                          {timeAgo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.body}
                      </p>
                      {notif.type === 'absence_alert' && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Urgent Follow-up Required
                        </div>
                      )}
                      {notif.type === 'message' && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Click to Open Chat <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      )}
                      {notif.type === 'lesson_created' && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <BookOpen className="h-2.5 w-2.5" /> MoE RAG Validated
                        </div>
                      )}
                    </div>

                    {!notif.is_read && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200 self-start"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
