import React, { useState, useRef } from 'react';
import { Clock, ChevronLeft, ChevronRight, Sparkles, X, Check, ShoppingBag, Eye } from 'lucide-react';
import { OFFERING_TYPES, getOfferingType, formatOfferingPrice } from '../../config/offerings';
import { getMediaUrl } from '../../utils/media';

/**
 * Storefront "What We Offer" strip: Today's Special, Brunch, Lunch, Dinner and Combos
 * displayed at the top of the menu when the customer opens the website.
 */
export default function OfferingsShowcase({ offerings, template, onSelectOffering }) {
  const [activeType, setActiveType] = useState('ALL');
  const [selectedOffering, setSelectedOffering] = useState(null);
  const scrollContainerRef = useRef(null);

  if (!offerings || offerings.length === 0) return null;

  const tpl = template || {
    cardClass: 'bg-slate-900/90 border-amber-500/30 text-white shadow-xl',
    buttonStyle: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black shadow-lg shadow-amber-500/20'
  };

  const typesPresent = OFFERING_TYPES.filter(t => offerings.some(o => o.offering_type === t.id));
  const shown = activeType === 'ALL' ? offerings : offerings.filter(o => o.offering_type === activeType);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-8" aria-labelledby="offerings-heading">
      {/* Header with Title and Scroll Arrows */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-5 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
            <h2 id="offerings-heading" className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
              ⭐ Today's Specials, Meals & Combos
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Today's chef specials, curated brunch, lunch, dinner & value combo options
          </p>
        </div>

        {/* Scroll Controls (Desktop) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={scrollLeft}
            aria-label="Scroll left"
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            aria-label="Scroll right"
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Type Filter Pills */}
      {typesPresent.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-hide">
          {[{ id: 'ALL', label: 'All Specials', emoji: '✨' }, ...typesPresent].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeType === t.id
                  ? tpl.buttonStyle
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-white/10'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Cards Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scrollbar-hide"
      >
        {shown.map(o => {
          const type = getOfferingType(o.offering_type);
          const img = getMediaUrl(o.image_url);
          const price = formatOfferingPrice(o.price);
          const hasVegFlag = o.is_veg !== null && o.is_veg !== undefined;

          return (
            <article
              key={o.id}
              onClick={() => setSelectedOffering(o)}
              className={`${tpl.cardClass} snap-start shrink-0 w-68 sm:w-76 rounded-2xl border shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer group`}
            >
              {/* Image & Badges */}
              <div className="relative h-40 bg-slate-900 overflow-hidden">
                {img ? (
                  <img
                    src={img}
                    alt={o.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 flex flex-col items-center justify-center text-4xl gap-1">
                    <span>{type.emoji}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type.label}</span>
                  </div>
                )}
                
                {/* Offering Type Pill */}
                <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1 shadow-sm border border-white/10">
                  <span>{type.emoji}</span> {type.label}
                </span>

                {/* Veg / Non-Veg Indicator */}
                {hasVegFlag && (
                  <span
                    className={`absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center rounded-sm bg-white/90 backdrop-blur-xs border ${
                      Number(o.is_veg) ? 'border-emerald-600' : 'border-rose-600'
                    } shadow-sm`}
                    title={Number(o.is_veg) ? 'Veg' : 'Non-Veg'}
                  >
                    <span className={`w-2 h-2 rounded-full ${Number(o.is_veg) ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                  </span>
                )}

                {/* Price Badge */}
                {price && (
                  <span className="absolute bottom-2.5 right-2.5 px-3 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-lg">
                    {price}
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {o.title}
                  </h3>
                  {o.available_time && (
                    <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" /> {o.available_time}
                    </span>
                  )}
                </div>

                {o.description && (
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {o.description}
                  </p>
                )}

                {o.includes_text && (
                  <div className="mt-auto pt-2">
                    <p className="text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-xl p-2 line-clamp-2">
                      <span className="font-bold text-amber-300">Includes: </span>
                      {o.includes_text}
                    </p>
                  </div>
                )}

                {/* Card Action */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10 mt-1">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 group-hover:underline">
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </span>
                  {onSelectOffering && price && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOffering(o);
                      }}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${tpl.buttonStyle}`}
                    >
                      Order +
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Expanded Offering Detail Modal */}
      {selectedOffering && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedOffering(null)}
        >
          <div
            className="bg-slate-900 border border-amber-500/30 text-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image */}
            <div className="relative h-56 sm:h-64 bg-slate-950 shrink-0">
              {selectedOffering.image_url ? (
                <img
                  src={getMediaUrl(selectedOffering.image_url)}
                  alt={selectedOffering.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-5xl bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950 gap-2">
                  <span>{getOfferingType(selectedOffering.offering_type).emoji}</span>
                  <span className="text-xs font-bold text-amber-300 tracking-wider">
                    {getOfferingType(selectedOffering.offering_type).label}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedOffering(null)}
                aria-label="Close dialog"
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer border border-white/20"
              >
                <X className="w-4 h-4" />
              </button>

              <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/75 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 border border-white/10">
                <span>{getOfferingType(selectedOffering.offering_type).emoji}</span>
                {getOfferingType(selectedOffering.offering_type).label}
              </span>

              {formatOfferingPrice(selectedOffering.price) && (
                <span className="absolute bottom-3 right-3 px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-sm font-black shadow-lg">
                  {formatOfferingPrice(selectedOffering.price)}
                </span>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {selectedOffering.is_veg !== null && selectedOffering.is_veg !== undefined && (
                    <span
                      className={`w-4 h-4 flex items-center justify-center rounded-xs bg-white border ${
                        Number(selectedOffering.is_veg) ? 'border-emerald-600' : 'border-rose-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${Number(selectedOffering.is_veg) ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                    </span>
                  )}
                  <span className="text-xs font-bold text-amber-400">
                    {Number(selectedOffering.is_veg) ? 'Vegetarian' : selectedOffering.is_veg === 0 || selectedOffering.is_veg === '0' ? 'Non-Vegetarian' : 'Chef Special'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white leading-tight">{selectedOffering.title}</h3>
                {selectedOffering.available_time && (
                  <span className="text-xs text-amber-300 font-semibold flex items-center gap-1.5 mt-1">
                    <Clock className="w-3.5 h-3.5" /> Available: {selectedOffering.available_time}
                  </span>
                )}
              </div>

              {selectedOffering.description && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">About This Offering</h4>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedOffering.description}
                  </p>
                </div>
              )}

              {selectedOffering.includes_text && (
                <div className="p-3.5 rounded-2xl bg-amber-400/10 border border-amber-400/20">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> What's Included:
                  </h4>
                  <p className="text-xs text-slate-100 whitespace-pre-line font-medium leading-relaxed">
                    {selectedOffering.includes_text}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOffering(null)}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-slate-300 hover:text-white font-bold text-xs hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              {onSelectOffering && formatOfferingPrice(selectedOffering.price) && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectOffering(selectedOffering);
                    setSelectedOffering(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${tpl.buttonStyle}`}
                >
                  <ShoppingBag className="w-4 h-4" /> Order This Special ({formatOfferingPrice(selectedOffering.price)})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
