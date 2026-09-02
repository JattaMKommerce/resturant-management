// 5 Curated High-Converting Website Templates Config for Hotel OS

export const WEBSITE_TEMPLATES = [
  {
    id: 'royal_heritage',
    name: 'Royal Grand Heritage',
    category: '5-Star Luxury & Palace',
    badge: '👑 Most Popular for Heritage Hotels',
    tagline: 'Timeless Opulence & Regal Hospitality',
    previewBg: 'from-amber-900 via-slate-900 to-amber-950',
    primaryColor: '#D97706',
    secondaryColor: '#0F172A',
    accentColor: '#F59E0B',
    bgClass: 'bg-slate-950 text-slate-100',
    cardClass: 'bg-slate-900/90 border-amber-500/30 text-white shadow-xl',
    heroGradient: 'from-amber-950/90 via-slate-950/80 to-slate-900/90',
    badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    buttonStyle: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black shadow-lg shadow-amber-500/20',
    description: 'Deep navy, gold accents, royal font pairings, parallax hero slider, and floating gold amenity badges.'
  },
  {
    id: 'azure_coastal',
    name: 'Azure Coastal Resort',
    category: 'Beachfront, Island & Wellness Spa',
    badge: '🌊 Best for Beach Resorts & Spas',
    tagline: 'Sun-Kissed Tranquility & Ocean Front Luxury',
    previewBg: 'from-sky-700 via-cyan-900 to-blue-950',
    primaryColor: '#0284C7',
    secondaryColor: '#0C4A6E',
    accentColor: '#38BDF8',
    bgClass: 'bg-sky-950 text-sky-50',
    cardClass: 'bg-cyan-950/70 border-cyan-400/30 text-white shadow-xl backdrop-blur-md',
    heroGradient: 'from-sky-900/80 via-cyan-950/80 to-slate-950/90',
    badgeStyle: 'bg-cyan-400/20 text-cyan-200 border-cyan-400/40',
    buttonStyle: 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white font-black shadow-lg shadow-cyan-500/20',
    description: 'Ocean cyan, sand beige accents, tropical backdrop imagery, floating pool & Wi-Fi badges, glassmorphism cards.'
  },
  {
    id: 'boutique_eco',
    name: 'Boutique Eco-Lodge',
    category: 'Modern Eco & Nature Retreat',
    badge: '🌿 Best for Eco Stays & Homestays',
    tagline: 'Harmonious Living & Forest Sanctuary',
    previewBg: 'from-emerald-900 via-slate-900 to-teal-950',
    primaryColor: '#3A7D7C',
    secondaryColor: '#064E3B',
    accentColor: '#10B981',
    bgClass: 'bg-slate-900 text-emerald-50',
    cardClass: 'bg-emerald-950/60 border-emerald-500/30 text-white shadow-lg',
    heroGradient: 'from-emerald-950/90 via-slate-950/80 to-teal-950/90',
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    buttonStyle: 'bg-gradient-to-r from-[#3A7D7C] to-emerald-600 hover:from-[#2F6665] hover:to-emerald-700 text-white font-black shadow-lg shadow-emerald-500/20',
    description: 'Sage green, organic stone textures, minimalist room grid, direct 1-tap WhatsApp booking button.'
  },
  {
    id: 'gourmet_dining',
    name: 'Gourmet Fine Dining & Stay',
    category: 'Boutique Restaurant & Hotel Hybrid',
    badge: '🍽️ Best for Hotel + Fine Dining',
    tagline: 'Exquisite Culinary Journey & Restful Suites',
    previewBg: 'from-rose-950 via-slate-950 to-red-950',
    primaryColor: '#E11D48',
    secondaryColor: '#4C0519',
    accentColor: '#F43F5E',
    bgClass: 'bg-slate-950 text-rose-50',
    cardClass: 'bg-rose-950/50 border-rose-500/30 text-white shadow-xl',
    heroGradient: 'from-rose-950/90 via-slate-950/80 to-rose-900/80',
    badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    buttonStyle: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black shadow-lg shadow-rose-500/20',
    description: 'Ruby burgundy, warm amber tones, 2-in-1 Food & Stay switcher header, interactive culinary menu catalog.'
  },
  {
    id: 'express_business',
    name: 'Express Business Hotel',
    category: 'Corporate & Urban Transit Hotel',
    badge: '⚡ Best for Transit & Corporate Hotels',
    tagline: 'Seamless Business Travel & Instant Comfort',
    previewBg: 'from-indigo-950 via-slate-900 to-slate-950',
    primaryColor: '#4F46E5',
    secondaryColor: '#1E1B4B',
    accentColor: '#6366F1',
    bgClass: 'bg-slate-900 text-slate-100',
    cardClass: 'bg-indigo-950/60 border-indigo-500/30 text-white shadow-xl',
    heroGradient: 'from-indigo-950/90 via-slate-900/90 to-slate-950/90',
    badgeStyle: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    buttonStyle: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black shadow-lg shadow-indigo-500/20',
    description: 'Indigo & electric slate, 30-second room reservation widget, express front desk check-in badge.'
  }
];

export const getTemplateById = (id) => {
  return WEBSITE_TEMPLATES.find(t => t.id === id) || WEBSITE_TEMPLATES[0];
};
