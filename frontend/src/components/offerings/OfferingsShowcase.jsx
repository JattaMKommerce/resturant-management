import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { OFFERING_TYPES, getOfferingType, formatOfferingPrice } from '../../config/offerings';
import { getMediaUrl } from '../../utils/media';

/**
 * Storefront "What We Offer" strip: Today's Special, Brunch, Lunch, Dinner and Combos
 * that the restaurant manages from the Setup Wizard or Settings page.
 */
export default function OfferingsShowcase({ offerings, template }) {
  const [activeType, setActiveType] = useState('ALL');

  if (!offerings || offerings.length === 0) return null;

  const typesPresent = OFFERING_TYPES.filter(t => offerings.some(o => o.offering_type === t.id));
  const shown = activeType === 'ALL' ? offerings : offerings.filter(o => o.offering_type === activeType);

  return (
    <section className="mb-8" aria-labelledby="offerings-heading">
      <h2 id="offerings-heading" className="text-base font-bold text-white mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-amber-400 rounded-full"></span>
        What We Offer
      </h2>

      {typesPresent.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {[{ id: 'ALL', label: 'All', emoji: '✨' }, ...typesPresent].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveType(t.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeType === t.id
                ? template.buttonStyle
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-white/10'
                }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {shown.map(o => {
          const type = getOfferingType(o.offering_type);
          const img = getMediaUrl(o.image_url);
          const price = formatOfferingPrice(o.price);
          const hasVegFlag = o.is_veg !== null && o.is_veg !== undefined;
          return (
            <article
              key={o.id}
              className={`${template.cardClass} snap-start shrink-0 w-64 sm:w-72 rounded-2xl border shadow-md overflow-hidden flex flex-col`}
            >
              <div className="relative h-36 bg-slate-900">
                {img ? (
                  <img src={img} alt={o.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-4xl">
                    {type.emoji}
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold backdrop-blur-xs">
                  {type.emoji} {type.label}
                </span>
                {price && (
                  <span className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black shadow-md">
                    {price}
                  </span>
                )}
              </div>
              <div className="p-3.5 flex-1 flex flex-col gap-1.5">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  {hasVegFlag && (
                    <span
                      title={Number(o.is_veg) ? 'Veg' : 'Non-veg'}
                      className={`w-3.5 h-3.5 shrink-0 flex items-center justify-center rounded-xs border ${Number(o.is_veg) ? 'border-emerald-500' : 'border-rose-500'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${Number(o.is_veg) ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    </span>
                  )}
                  <span className="line-clamp-1">{o.title}</span>
                </h3>
                {o.available_time && (
                  <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {o.available_time}
                  </span>
                )}
                {o.description && <p className="text-xs text-slate-300 line-clamp-3">{o.description}</p>}
                {o.includes_text && (
                  <p className="text-[11px] text-slate-400 mt-auto pt-1 line-clamp-2">
                    <span className="font-bold text-slate-300">Includes:</span> {o.includes_text}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
