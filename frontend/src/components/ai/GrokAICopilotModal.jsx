import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { 
  Bot, Sparkles, X, Send, RotateCcw, ShieldCheck, ChevronRight,
  BedDouble, UtensilsCrossed, Globe, Loader2, ArrowUpRight, Copy, Check
} from 'lucide-react';

export default function GrokAICopilotModal({ isOpen, onClose, restaurant, initialPrompt = '' }) {
  const restaurantName = restaurant?.name || 'Your Hotel & Restaurant';
  const restaurantSlug = restaurant?.slug || '';

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize welcome message with restaurant name when opened
  useEffect(() => {
    if (isOpen) {
      fetchSnapshot();
      if (messages.length === 0) {
        setMessages([
          {
            role: 'assistant',
            content: `👋 **Welcome to ${restaurantName} AI Operations Copilot!**\n\nI am actively monitoring all operations for **${restaurantName}** across:\n\n• **🌐 Online Storefront & Deliveries** (Live orders, delivery radius, today's specials & value combos)\n• **🍽️ Offline Restaurant & KOT** (Dining tables, kitchen orders, waiter requests, offline bills)\n• **🏨 Hotel Accommodation** (Tonight's room availability, occupancy rate, check-ins/check-outs, pending folios)\n\n*Ask me any question about your hotel or restaurant operations today!*`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen, restaurantName]);

  // Handle optional initial prompt
  useEffect(() => {
    if (isOpen && initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

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
        content: `👋 **Welcome to ${restaurantName} AI Operations Copilot!**\n\nI am actively monitoring all operations for **${restaurantName}** across:\n\n• **🌐 Online Storefront & Deliveries**\n• **🍽️ Offline Restaurant & KOT**\n• **🏨 Hotel Accommodation & Rooms**\n\nHow can I help you manage **${restaurantName}** right now?`,
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
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 transition-opacity duration-200"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 w-full max-w-3xl h-[92vh] max-h-[780px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 p-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Bot className="w-5 h-5 fill-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-white truncate">
                  {restaurantName} AI Operations Copilot
                </h3>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Powered by Grok
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Monitoring 100% of Online Storefront • Offline Dining & KOT • Hotel Accommodation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleResetChat}
              title="Reset Chat"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Monitoring Beacon Bar */}
        {snapshot && (
          <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto text-[11px] font-semibold scrollbar-hide shrink-0">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider shrink-0 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Live:
            </span>
            <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-lg border border-slate-700 shrink-0 flex items-center gap-1">
              <BedDouble className="w-3 h-3 text-amber-400" />
              Rooms: <strong className="text-white">{snapshot.accommodation?.vacant_rooms ?? 0}/{snapshot.accommodation?.total_rooms ?? 0} Left</strong>
            </span>
            <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-lg border border-slate-700 shrink-0 flex items-center gap-1">
              <Globe className="w-3 h-3 text-sky-400" />
              Online Orders: <strong className="text-white">{snapshot.online_storefront?.active_orders ?? 0} Active</strong>
            </span>
            <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-lg border border-slate-700 shrink-0 flex items-center gap-1">
              <UtensilsCrossed className="w-3 h-3 text-emerald-400" />
              Tables: <strong className="text-white">{snapshot.offline_restaurant?.occupied_tables ?? 0}/{snapshot.offline_restaurant?.total_tables ?? 0} Occupied</strong>
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
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-md shadow-emerald-500/20">
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                  isUser 
                    ? 'bg-[#3A7D7C] text-white rounded-br-xs font-medium' 
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-xs'
                }`}>
                  <div className="whitespace-pre-wrap space-y-1.5 font-sans">
                    {m.content.split('\n').map((line, lIdx) => {
                      // Simple markdown formatting for bold, bullets and headers
                      if (line.startsWith('### ')) {
                        return <h4 key={lIdx} className="font-bold text-emerald-300 text-sm mt-1">{line.replace('### ', '')}</h4>;
                      }
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={lIdx} className="font-bold text-white">{line.replace(/\*\*/g, '')}</p>;
                      }
                      // Handle inline bold
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <p key={lIdx} className={line.startsWith('• ') ? 'pl-2 text-slate-200' : ''}>
                          {parts.map((p, pIdx) => {
                            if (p.startsWith('**') && p.endsWith('**')) {
                              return <strong key={pIdx} className="font-bold text-white">{p.slice(2, -2)}</strong>;
                            }
                            return p;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  {m.notice && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700 text-[10px] text-amber-300 font-mono">
                      ℹ️ {m.notice}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-white/10 text-[10px] text-slate-400">
                    <span>{m.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopyMessage(m.content, idx)}
                        className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Copy message"
                      >
                        {copiedIndex === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              </div>
              <div className="bg-slate-800/90 text-slate-300 border border-slate-700/80 rounded-2xl rounded-bl-xs px-4 py-3 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Grok AI is analyzing live platform metrics for {restaurantName}...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Chips Bar */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40 shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Quick Operational Inquiries:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {quickPrompts.map((q, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => sendMessage(q.prompt)}
                disabled={loading}
                className="shrink-0 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-medium transition-all hover:border-emerald-400/60 disabled:opacity-50 cursor-pointer"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 shrink-0">
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
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !inputValue.trim()}
              className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4 fill-slate-950" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 px-1">
            <span>🛡️ Domain Guardrail Active: Answers only hotel accommodation, online & offline restaurant questions.</span>
            <span>Press Enter ↵</span>
          </div>
        </div>

      </div>
    </div>
  );
}
