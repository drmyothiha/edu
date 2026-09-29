import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ConversationDTO, MessageDTO } from '../types';
import {
  MessageSquare,
  Send,
  X,
  User,
  GraduationCap,
  Clock,
  Check,
  CheckCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string;
  teacherId?: string;
  parentId?: string;
  conversationId?: string;
  title?: string;
  subtitle?: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  studentId,
  teacherId,
  parentId,
  conversationId: initialConvId,
  title,
  subtitle,
}) => {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ConversationDTO | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversationAndMessages = async (isPolling = false) => {
    if (!isOpen) return;
    if (!isPolling) setLoading(true);
    setError(null);

    try {
      let conv: ConversationDTO;
      if (initialConvId) {
        conv = await api.conversations.get(initialConvId);
      } else {
        conv = await api.conversations.create({
          student_id: studentId,
          teacher_id: teacherId,
          parent_id: parentId,
        });
      }
      setConversation(conv);

      const msgs = await api.conversations.getMessages(conv.id);
      setMessages(msgs);
      if (!isPolling) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (err: any) {
      if (!isPolling) setError(err.message || 'Failed to load conversation');
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConversationAndMessages();
      const interval = setInterval(() => {
        loadConversationAndMessages(true);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, initialConvId, studentId, teacherId, parentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !conversation || sending) return;

    setSending(true);
    try {
      const newMsg = await api.conversations.sendMessage(conversation.id, text);
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const headerTitle =
    title ||
    (user?.role === 'parent'
      ? `Teacher Chat: ${conversation?.teacher_name || 'Loading...'}`
      : `Parent Chat: ${conversation?.parent_name || 'Loading...'}`);

  const headerSubtitle =
    subtitle ||
    (conversation?.student_name
      ? `Regarding Student: ${conversation.student_name}`
      : 'Direct Parent-Teacher Message Line');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl h-[85vh] max-h-[700px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight text-white">{headerTitle}</h3>
              <p className="text-xs text-slate-400 font-sans">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadConversationAndMessages()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh messages"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-xs font-medium">Opening secure conversation...</span>
            </div>
          )}

          {error && !loading && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400 space-y-3">
              <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">No messages yet</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Start the conversation directly between parent and teacher. Messages and notifications are transmitted securely.
                </p>
              </div>
            </div>
          )}

          {!loading &&
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              const formattedTime = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-600">{msg.sender_name}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded capitalize ${
                        msg.sender_role === 'teacher'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {msg.sender_role}
                    </span>
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMe ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      <span>{formattedTime}</span>
                      {isMe && (
                        <span>
                          {msg.is_read ? (
                            <CheckCheck className="h-3 w-3 text-indigo-200" />
                          ) : (
                            <Check className="h-3 w-3 text-indigo-300" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white border-t border-slate-200 flex gap-2 items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message to teacher/parent..."
            disabled={loading || sending}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending || loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition shadow-xs"
          >
            <span>Send</span>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
