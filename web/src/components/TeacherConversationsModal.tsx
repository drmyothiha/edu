import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ConversationDTO } from '../types';
import {
  MessageSquare,
  X,
  Search,
  Users,
  GraduationCap,
  Clock,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface TeacherConversationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conv: ConversationDTO) => void;
}

export const TeacherConversationsModal: React.FC<TeacherConversationsModalProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
}) => {
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const data = await api.conversations.list();
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = conversations.filter(
    (c) =>
      c.parent_name.toLowerCase().includes(search.toLowerCase()) ||
      c.student_name.toLowerCase().includes(search.toLowerCase()) ||
      c.parent_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Parent Messages & Direct Inquiries</h3>
              <p className="text-xs text-slate-400 font-sans">
                မိဘများနှင့် တိုက်ရိုက် စကားပြောဆိုမှုများ • Active parent chat threads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by parent name, child name, or email..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <button
            onClick={fetchConversations}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {loading && (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
              <span>Loading messages...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Users className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">No conversations yet</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Parents can reach out to you directly through their portal. When a parent messages you, the thread will appear here.
              </p>
            </div>
          )}

          {!loading &&
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className="w-full p-3.5 rounded-xl hover:bg-indigo-50/50 transition text-left flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition">
                        {conv.parent_name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        Parent
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(conv.latest_message_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                    <span>Student: <strong className="text-slate-700">{conv.student_name}</strong></span>
                  </div>

                  {conv.latest_message_content && (
                    <p className="text-xs text-slate-600 truncate italic">
                      "{conv.latest_message_content}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {conv.unread_count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                      {conv.unread_count} new
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition" />
                </div>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
