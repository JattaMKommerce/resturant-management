import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { 
  Bot, Sparkles, X, Send, RotateCcw, ShieldCheck, ChevronRight,
  BedDouble, UtensilsCrossed, Globe, Loader2, ArrowUpRight, Copy, Check
} from 'lucide-react';

export default function GrokAICopilotModal({ isOpen, onClose, restaurant, initialPrompt = '', focus = null }) {
  const restaurantName = restaurant?.name || 'Your Hotel & Restaurant';
  const restaurantSlug = restaurant?.slug || '';

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastFocusRef = useRef(null);

  // Initialize welcome message with restaurant name when opened
  useEffect(() => {
    if (isOpen) {
      fetchSnapshot();
      if (messages.length === 0 && !focus) {
        setMessages([
          {
            role: 'assistant',
            content: `👋 **Welcome to Your AI Assistant for ${restaurantName}!**\n\nI am actively monitoring all operations for **${restaurantName}** across:\n\n• **🌐 Online Storefront & Deliveries** (Live orders, delivery radius, today's specials & value combos)\n• **🍽️ Offline Restaurant & KOT** (Dining tables, kitchen orders, waiter requests, offline bills)\n• **🏨 Hotel Accommodation** (Tonight's room availability, occupancy rate, check-ins/check-outs, pending folios)\n\n*Ask me any question about your hotel or restaurant operations today!*`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
    if (!isOpen) {
      lastFocusRef.current = null;
    }
  }, [isOpen, restaurantName]);

  // Handle optional initial prompt (generic open, no card focus)
  useEffect(() => {
    if (isOpen && initialPrompt && !focus) {
      sendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  // Handle card-focused open: reset to a focused welcome and auto-ask about that section
  useEffect(() => {
    if (isOpen && focus && focus.key && lastFocusRef.current !== focus.key) {
      lastFocusRef.current = focus.key;
      setMessages([
        {
          role: 'assistant',
          content: `🎯 **Focused on ${focus.label} — ${restaurantName}.**\n\nI'll keep this view to the **${focus.label}** section. Pulling the live numbers now…`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      if (focus.prompt) sendMessage(focus.prompt);
    }
  }, [isOpen, focus]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchSnapshot = async () => {
    try {
      const res = await api.get('/admin/ai/snapshot');
      if (res.data?.success && res.data.snapshot) {
        setSnapshot(res.data.snapshot);
      }
    } catch (e) {
      // Non-blocking
    }
  };

  const sendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const payload = {
        message: text,
        focus: focus?.label || '',
        messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
      };

      const res = await api.post('/admin/ai/chat', payload);
      if (res.data?.success) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.reply || `Here is the current live status for ${restaurantName}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            notice: res.data.notice,
            provider: res.data.provider
          }
        ]);
        if (res.data.snapshot) {
          setSnapshot(res.data.snapshot);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: res.data?.message || 'Unable to retrieve answer. Please try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: true
          }
        ]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered a temporary connection issue. Please check back in a moment.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `👋 **Welcome to Your AI Assistant for ${restaurantName}!**\n\nI am actively monitoring all operations for **${restaurantName}** across:\n\n• **🌐 Online Storefront & Deliveries**\n• **🍽️ Offline Restaurant & KOT**\n• **🏨 Hotel Accommodation & Rooms**\n\nHow can I help you manage **${restaurantName}** right now?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleCopyMessage = (content, index) => {
    navigator.clipboard?.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  const quickPrompts = [
    { label: '🏨 Room Occupancy Tonight', prompt: 'How is our room occupancy and availability tonight?' },
    { label: '🚪 Check-ins & Arrivals Today', prompt: 'Who is arriving and departing today, and how many in-house guests are staying?' },
    { label: '🍕 Live Online Orders', prompt: 'Are there any active online delivery orders and how are today\'s specials doing?' },
    { label: '🍽️ Tables & Kitchen KOTs', prompt: 'How many dining tables are occupied, and are any KOT orders pending in the kitchen?' },
    { label: '💰 Pending Payments & Folios', prompt: 'What room folios or guest payments are currently pending collection?' },
    { label: '⚡ 360° Operations Briefing', prompt: 'How is my hotel and restaurant performing today across online, offline, and accommodation?' }
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 transition-opacity duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F6FAFB] border border-[#D7E5E8] w-full max-w-3xl h-[92vh] max-h-[780px] rounded-3xl shadow-2xl shadow-slate-900/10 flex flex-col overflow-hidden text-slate-700 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-white via-[#F1F8F8] to-white border-b border-[#D7E5E8] p-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3A7D7C] to-teal-400 text-white flex items-center justify-center shadow-md shadow-[#3A7D7C]/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-slate-800 truncate">
                  Your AI Assistant · {restaurantName}
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              </div>
              <p className={`text-[11px] truncate mt-0.5 ${focus ? 'text-[#3A7D7C] font-semibold' : 'text-slate-500'}`}>
                {focus
                  ? `🎯 Focused on ${focus.label} — answering about this section`
                  : 'Monitoring 100% of Online Storefront • Offline Dining & KOT • Hotel Accommodation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleResetChat}
              title="Reset Chat"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Monitoring Beacon Bar */}
        {snapshot && (
          <div className="bg-[#EAF4F7]/70 border-b border-[#D7E5E8] px-4 py-2 flex items-center gap-2 overflow-x-auto text-[11px] font-semibold scrollbar-hide shrink-0">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider shrink-0 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3A7D7C]" /> Live:
            </span>
            <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-lg border border-[#D7E5E8] shadow-2xs shrink-0 flex items-center gap-1">
              <BedDouble className="w-3 h-3 text-amber-500" />
              Rooms: <strong className="text-slate-900">{snapshot.accommodation?.vacant_rooms ?? 0}/{snapshot.accommodation?.total_rooms ?? 0} Left</strong>
            </span>
            <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-lg border border-[#D7E5E8] shadow-2xs shrink-0 flex items-center gap-1">
              <Globe className="w-3 h-3 text-sky-500" />
              Online Orders: <strong className="text-slate-900">{snapshot.online_storefront?.active_orders ?? 0} Active</strong>
            </span>
            <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-lg border border-[#D7E5E8] shadow-2xs shrink-0 flex items-center gap-1">
              <UtensilsCrossed className="w-3 h-3 text-[#3A7D7C]" />
              Tables: <strong className="text-slate-900">{snapshot.offline_restaurant?.occupied_tables ?? 0}/{snapshot.offline_restaurant?.total_tables ?? 0} Occupied</strong>
            </span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3A7D7C] to-teal-400 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm shadow-[#3A7D7C]/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-[13px] leading-relaxed ${
                  isUser
                    ? 'bg-[#3A7D7C] text-white rounded-br-sm font-medium shadow-sm shadow-[#3A7D7C]/20'
                    : 'bg-white text-slate-700 border border-[#D7E5E8] rounded-bl-sm shadow-sm'
                }`}>
                  <div className="whitespace-pre-wrap space-y-1.5 font-sans">
                    {m.content.split('\n').map((line, lIdx) => {
                      // Simple markdown formatting for bold, bullets and headers
                      if (line.startsWith('### ')) {
                        return <h4 key={lIdx} className={`font-bold text-sm mt-1 ${isUser ? 'text-white' : 'text-[#2F6665]'}`}>{line.replace('### ', '')}</h4>;
                      }
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={lIdx} className={`font-bold ${isUser ? 'text-white' : 'text-slate-900'}`}>{line.replace(/\*\*/g, '')}</p>;
                      }
                      // Handle inline bold
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <p key={lIdx} className={line.startsWith('• ') ? `pl-2 ${isUser ? 'text-white/90' : 'text-slate-600'}` : ''}>
                          {parts.map((p, pIdx) => {
                            if (p.startsWith('**') && p.endsWith('**')) {
                              return <strong key={pIdx} className={`font-bold ${isUser ? 'text-white' : 'text-slate-900'}`}>{p.slice(2, -2)}</strong>;
                            }
                            return p;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  {m.notice && (
                    <div className={`mt-2.5 pt-2 border-t text-[10px] font-mono ${isUser ? 'border-white/20 text-amber-100' : 'border-slate-100 text-amber-600'}`}>
                      ℹ️ {m.notice}
                    </div>
                  )}

                  <div className={`flex items-center justify-between gap-2 mt-2 pt-1.5 border-t text-[10px] ${isUser ? 'border-white/20 text-white/70' : 'border-slate-100 text-slate-400'}`}>
                    <span>{m.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopyMessage(m.content, idx)}
                        className="hover:text-[#3A7D7C] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Copy message"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3A7D7C] to-teal-400 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white text-slate-500 border border-[#D7E5E8] rounded-2xl rounded-bl-sm px-4 py-3 text-xs flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#3A7D7C] animate-ping"></span>
                <span>Your AI Assistant is analyzing live metrics for {restaurantName}...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Chips Bar */}
        <div className="px-4 py-2 border-t border-[#D7E5E8] bg-white shrink-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#3A7D7C]" />
            Quick Operational Inquiries:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {quickPrompts.map((q, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => sendMessage(q.prompt)}
                disabled={loading}
                className="shrink-0 px-3 py-1 rounded-full bg-[#EAF4F7] hover:bg-[#DCEBEF] text-[#2F6665] border border-[#D7E5E8] hover:border-[#3A7D7C]/40 text-[11px] font-medium transition-all disabled:opacity-50 cursor-pointer"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#D7E5E8] shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder={`Ask about ${restaurantName}'s online orders, dining tables, or rooms tonight...`}
                className="w-full bg-slate-50 border border-[#D7E5E8] focus:bg-white focus:border-[#3A7D7C] focus:ring-2 focus:ring-[#3A7D7C]/15 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !inputValue.trim()}
              className="p-3 bg-[#3A7D7C] hover:bg-[#2F6665] disabled:opacity-40 text-white font-bold rounded-xl shadow-sm shadow-[#3A7D7C]/20 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
            <span>🛡️ Domain Guardrail Active: Answers only hotel accommodation, online & offline restaurant questions.</span>
            <span>Press Enter ↵</span>
          </div>
        </div>

      </div>
    </div>
  );
}
