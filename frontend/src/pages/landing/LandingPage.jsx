import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Bike,
  Check,
  ChefHat,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import './landing.css';

// One entry per page section. The 3D scene has a camera stop for each, in this order.
const SECTIONS = [
  { id: 'hero', label: 'Overview' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'website', label: 'Website' },
  { id: 'orders', label: 'Orders' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'dine-in', label: 'Dine-in KOT' },
  { id: 'plans', label: 'Plans' },
];

// The five steps of the product flow. `steps` light up one by one, in time with the 3D animation.
const CHAPTERS = [
  {
    id: 'onboarding',
    num: '01',
    align: 'right',
    icon: ClipboardCheck,
    eyebrow: 'Onboarding',
    title: (
      <>
        Sign up and set up <em>your restaurant</em>
      </>
    ),
    body: 'Create an account and a simple wizard takes you through the rest. Watch the restaurant build itself as each step gets ticked.',
    steps: [
      'Create your account',
      'Add restaurant details, location and delivery area',
      'Add your menu',
    ],
  },
  {
    id: 'website',
    num: '02',
    align: 'left',
    icon: Globe,
    eyebrow: 'Your website',
    title: (
      <>
        Get your own <em>ordering website</em>
      </>
    ),
    body: 'No coding and no designer. Pick a ready-made design, add your logo and photos, and publish it yourself.',
    steps: [
      'Choose a website design',
      'Your logo, photos and menu fill the page',
      'Press Publish. Ordering opens once your restaurant is approved',
    ],
  },
  {
    id: 'orders',
    num: '03',
    align: 'right',
    icon: ShoppingBag,
    eyebrow: 'Getting orders',
    title: (
      <>
        Orders come <em>straight to you</em>
      </>
    ),
    body: 'A customer orders on your website from their phone. The order lands on your dashboard right away, with a sound alert.',
    steps: [
      'Customer picks food and places the order',
      'The order reaches your restaurant instantly',
      'You accept it and the kitchen starts cooking',
    ],
  },
  {
    id: 'delivery',
    num: '04',
    align: 'left',
    icon: Bike,
    eyebrow: 'Delivery',
    title: (
      <>
        Your delivery boy <em>takes it home</em>
      </>
    ),
    body: 'Hand the order to your own rider. They see it on their phone, and the customer can follow the trip live on a map.',
    steps: [
      'The order is assigned to your rider',
      'Rider picks it up and the customer tracks it live',
      'Delivered at the door',
    ],
  },
  {
    id: 'dine-in',
    num: '05',
    align: 'right',
    icon: ChefHat,
    eyebrow: 'Inside the restaurant',
    title: (
      <>
        Dine-in runs on <em>the KOT flow</em>
      </>
    ),
    body: 'For guests at the table. The order goes to the kitchen screen as a KOT, comes back as food, and ends with a printed bill.',
    steps: [
      'Guest scans the table QR, or the waiter takes the order',
      'The KOT shows up on the kitchen screen',
      'Chef marks it ready and the waiter serves',
      'The bill is printed at the counter',
    ],
  },
];

const PORTALS = [
  {
    label: 'Customer Storefront',
    sub: 'The Grand Palace live demo',
    to: '/restaurant/hotel',
    icon: Store,
  },
  {
    label: 'Admin Console',
    sub: 'Restaurant & hotel owners',
    to: '/admin/login',
    icon: LayoutDashboard,
  },
  {
    label: 'Kitchen Display (KDS)',
    sub: 'Live ticket queue for chefs',
    to: '/kitchen/login',
    icon: ChefHat,
  },
  {
    label: 'Waiter Station',
    sub: 'Floor & table service',
    to: '/waiter/login',
    icon: UtensilsCrossed,
  },
  {
    label: 'Delivery Partner',
    sub: 'Rider duty & live dispatch',
    to: '/driver/login',
    icon: Bike,
  },
  {
    label: 'Classic Mode Picker',
    sub: 'Workspace selection view',
    to: '/select-product',
    icon: Sparkles,
  },
];

function TiltPlanCard({ featured, ribbon, title, price, oldPrice, desc, features, cta, onSelect }) {
  const cardRef = useRef(null);

  const handleMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 9;
    const ry = (px - 0.5) * 11;
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  };

  const handleEnter = () => {
    cardRef.current?.classList.add('is-live');
  };

  const handleLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove('is-live');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <div className="lp-tilt-wrap">
      <button
        ref={cardRef}
        type="button"
        onClick={onSelect}
        onMouseMove={handleMove}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`lp-tilt ${featured ? 'lp-tilt-featured' : ''}`}
      >
        {ribbon && <span className="lp-ribbon">{ribbon}</span>}

        <div className="lp-pop-sm w-full">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e8b964]">
              1 Month Free Trial
            </span>
            <span className="text-[11px] font-semibold text-[#a3bcbe] line-through">{oldPrice}</span>
          </div>

          <h3 className="lp-serif text-2xl sm:text-3xl font-medium text-[#f8f1e4] mb-3">
            {title}
          </h3>

          <div className="flex items-baseline gap-2 mb-4">
            <span className="lp-serif lp-price text-[#f8f1e4]">{price}</span>
            <span className="text-xs font-medium text-[#a3bcbe]">/ month</span>
          </div>

          <p className="text-sm text-[#d3e0e0] leading-relaxed mb-6">{desc}</p>
        </div>

        <ul className="lp-pop-sm space-y-2.5 text-sm text-[#d3e0e0] mb-8 flex-1 w-full">
          {features.map((feat) => (
            <li key={feat} className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#e3b25b]/15 border border-[#e3b25b]/40 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#f3d595]" />
              </span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <div className="lp-pop w-full pt-4 border-t border-white/10">
          <span
            className={`lp-btn w-full py-3.5 px-5 text-sm ${
              featured ? 'lp-btn-gold' : 'lp-btn-ghost'
            }`}
          >
            <span>{cta}</span>
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </button>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const sectionRefs = useRef([]);

  const [sceneReady, setSceneReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dimScene, setDimScene] = useState(false);
  // which step of the 3D animation is playing right now
  const [playing, setPlaying] = useState({ stop: 0, phase: -1 });

  // Scoped root class so global scrollbar/background only affect the landing route
  useEffect(() => {
    document.documentElement.classList.add('lp-active');
    return () => {
      document.documentElement.classList.remove('lp-active');
    };
  }, []);

  // Start the 3D scene. three.js is loaded on demand so the staff screens never download it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let instance = null;
    let cancelled = false;

    import('./FlowScene')
      .then(({ createFlowScene }) => {
        if (cancelled) return;
        instance = createFlowScene(canvas, {
          reducedMotion,
          onReady: () => setSceneReady(true),
          onPhase: (stop, phase) => setPlaying({ stop, phase }),
        });
        sceneRef.current = instance;
        window.dispatchEvent(new Event('scroll'));
      })
      .catch((err) => {
        // No WebGL (or the script failed to load): the page still works over the plain background.
        console.error('3D scene could not start:', err);
      });

    const onPointerMove = (e) => {
      if (!sceneRef.current) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = -(e.clientY / window.innerHeight - 0.5) * 2;
      sceneRef.current.setPointer(nx, ny);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('pointermove', onPointerMove);
      if (instance) instance.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Scroll choreography: interpolate camera stops & highlight active chapter
  useEffect(() => {
    const updateOnScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      setScrolled(y > 32);

      const els = sectionRefs.current.filter(Boolean);
      if (!els.length) return;

      const viewMid = y + window.innerHeight * 0.45;
      const centers = els.map((el) => {
        const rect = el.getBoundingClientRect();
        return y + rect.top + rect.height * 0.45;
      });

      let progress = 0;
      if (viewMid <= centers[0]) {
        progress = 0;
      } else if (viewMid >= centers[centers.length - 1]) {
        progress = centers.length - 1;
      } else {
        for (let i = 0; i < centers.length - 1; i++) {
          if (viewMid >= centers[i] && viewMid <= centers[i + 1]) {
            const span = Math.max(1, centers[i + 1] - centers[i]);
            progress = i + (viewMid - centers[i]) / span;
            break;
          }
        }
      }

      if (sceneRef.current) {
        sceneRef.current.setProgress(progress);
      }

      const nearest = Math.round(progress);
      setActiveIdx(nearest);
      setDimScene(progress > centers.length - 1.55);
    };

    updateOnScroll();
    window.addEventListener('scroll', updateOnScroll, { passive: true });
    window.addEventListener('resize', updateOnScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateOnScroll);
      window.removeEventListener('resize', updateOnScroll);
    };
  }, []);

  // Reveal cards smoothly on intersection
  useEffect(() => {
    const nodes = document.querySelectorAll('.lp-reveal');
    if (!nodes.length) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.classList.add('is-in'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
          }
        });
      },
      { threshold: 0.16 }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleChoosePlan = (mode) => {
    localStorage.setItem('hotel_product_mode', mode);
    navigate('/admin/login');
  };

  return (
    <div className="lp">
      {/* 3D Night-Time Hotel Backdrop */}
      <canvas
        ref={canvasRef}
        className={`lp-canvas ${sceneReady ? 'is-ready' : ''}`}
        aria-hidden="true"
      />
      <div className="lp-scrim" aria-hidden="true" />
      <div className={`lp-dim ${dimScene ? 'is-on' : ''}`} aria-hidden="true" />

      {/* Top Navigation */}
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => scrollToSection('hero')}
            className="flex items-center gap-2 sm:gap-3 text-left min-w-0 cursor-pointer bg-transparent border-0"
          >
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f6dc9f] via-[#e3b25b] to-[#c69238] text-[#1a1204] flex items-center justify-center font-black text-sm shadow-lg shadow-[#e3b25b]/25">
              GP
            </span>
            <div>
              <span className="lp-serif block text-[15px] sm:text-lg font-medium tracking-tight text-[#f8f1e4] leading-none whitespace-nowrap">
                The Grand Palace
              </span>
              <span className="hidden sm:block text-[9px] font-bold uppercase tracking-[0.22em] text-[#e8b964] mt-1">
                Hospitality Suite
              </span>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold tracking-wide">
            {SECTIONS.slice(1).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className="lp-link bg-transparent border-0 cursor-pointer"
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/restaurant/hotel"
              className="hidden sm:inline-flex lp-btn lp-btn-ghost px-4 py-2 text-xs"
            >
              <Store className="w-3.5 h-3.5 text-[#e8b964]" />
              <span>Live Storefront</span>
            </Link>
            <Link
              to="/admin/login"
              className="lp-btn lp-btn-ghost px-3 sm:px-4 py-2 text-xs"
            >
              <span>Sign In</span>
            </Link>
            <Link
              to="/register-restaurant"
              className="lp-btn lp-btn-gold px-3 sm:px-5 py-2 text-xs"
            >
              <span>Start Free</span>
              <ArrowRight className="hidden sm:block w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Right-Edge Chapter Indicator Dots */}
      <aside className="lp-dots hidden sm:flex" aria-label="Story chapters">
        {SECTIONS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            className={`lp-dot ${activeIdx === idx ? 'is-active' : ''}`}
            aria-label={`Jump to ${s.label}`}
          >
            <span>{s.label}</span>
            <i />
          </button>
        ))}
      </aside>

      {/* Main Scroll Story */}
      <main className="lp-content">
        {/* 0. HERO */}
        <section
          id="hero"
          ref={(el) => (sectionRefs.current[0] = el)}
          className="lp-hero min-h-screen flex items-center relative px-5 sm:px-8 pt-24 pb-16"
        >
          <div className="max-w-7xl mx-auto w-full">
            <div className="max-w-2xl space-y-6">
              <div className="lp-eyebrow lp-rise" style={{ animationDelay: '0.08s' }}>
                How it works, in 3D
              </div>

              <h1
                className="lp-serif lp-h1 lp-rise text-[#f8f1e4]"
                style={{ animationDelay: '0.2s' }}
              >
                From sign-up to <em>served</em>, in five steps.
              </h1>

              <p
                className="lp-lead lp-rise text-base sm:text-lg leading-relaxed max-w-xl"
                style={{ animationDelay: '0.32s' }}
              >
                Set up your restaurant, launch your own ordering website, receive orders, send
                your delivery boy, and run dine-in with KOT. Scroll down and watch each step
                happen.
              </p>

              <div
                className="lp-rise flex flex-wrap items-center gap-3.5 pt-2"
                style={{ animationDelay: '0.44s' }}
              >
                <button
                  type="button"
                  onClick={() => scrollToSection('onboarding')}
                  className="lp-btn lp-btn-gold px-6 py-3.5 text-sm"
                >
                  <span>See how it works</span>
                  <span className="lp-scrollhint inline-flex">
                    <ArrowDown className="w-4 h-4" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('plans')}
                  className="lp-btn lp-btn-ghost px-6 py-3.5 text-sm"
                >
                  <span>Start 1-month free trial</span>
                </button>
              </div>

              {/* The whole flow at a glance; each stop jumps to its 3D scene */}
              <ol
                className="lp-flow lp-rise"
                style={{ animationDelay: '0.58s' }}
                aria-label="The five steps"
              >
                {CHAPTERS.map(({ id, icon: Icon, eyebrow }, i) => (
                  <li key={id}>
                    <button type="button" onClick={() => scrollToSection(id)} className="lp-flow-stop">
                      <span className="lp-flow-icon">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="lp-flow-text">
                        <b>Step {i + 1}</b>
                        {eyebrow}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 1–5. THE FLOW, ONE STEP PER SCREEN */}
        {CHAPTERS.map((ch, i) => {
          const sectionIndex = i + 1;
          const isPlaying = playing.stop === sectionIndex;
          return (
            <section
              key={ch.id}
              id={ch.id}
              ref={(el) => (sectionRefs.current[sectionIndex] = el)}
              className="lp-chapter px-5 sm:px-8"
            >
              <div
                className={`lp-chapter-pin max-w-7xl mx-auto w-full ${
                  ch.align === 'right' ? 'lg:justify-end' : 'lg:justify-start'
                }`}
              >
                <article className="lp-card lp-reveal">
                  <div className="flex items-end justify-between gap-4 mb-4">
                    <span className="lp-eyebrow">
                      Step {sectionIndex} of {CHAPTERS.length} · {ch.eyebrow}
                    </span>
                    <span className="lp-serif lp-card-num select-none" aria-hidden="true">
                      {ch.num}
                    </span>
                  </div>

                  <h2 className="lp-serif lp-h2 text-[#f8f1e4] mb-3">{ch.title}</h2>

                  <p className="text-sm sm:text-[15px] leading-relaxed text-[#d3e0e0] mb-5">
                    {ch.body}
                  </p>

                  <ol className="lp-steps">
                    {ch.steps.map((text, k) => {
                      const now = isPlaying && playing.phase === k;
                      const done = isPlaying && playing.phase > k;
                      return (
                        <li
                          key={text}
                          className={`lp-step ${now ? 'is-now' : ''} ${done ? 'is-done' : ''}`}
                        >
                          <span className="lp-step-dot">
                            {done ? <Check className="w-3.5 h-3.5" /> : k + 1}
                          </span>
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ol>
                </article>
              </div>
            </section>
          );
        })}

        {/* 6. PLANS & PORTALS */}
        <section
          id="plans"
          ref={(el) => (sectionRefs.current[SECTIONS.length - 1] = el)}
          className="min-h-screen px-5 sm:px-8 py-24 flex flex-col justify-center"
        >
          <div className="max-w-6xl mx-auto w-full space-y-16">
            {/* Pricing Header */}
            <div className="text-center max-w-2xl mx-auto space-y-4 lp-reveal">
              <div className="lp-eyebrow justify-center">Simple, Transparent Plans</div>
              <h2 className="lp-serif lp-h2 text-[#f8f1e4]">
                Choose the suite built for <em>your property</em>
              </h2>
              <p className="text-sm sm:text-base text-[#a3bcbe]">
                Every plan includes a full 30-day free trial with no credit card required.
              </p>
            </div>

            {/* 3D Tilt Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch lp-reveal">
              <TiltPlanCard
                title="Restaurant Only"
                price="₹2,999"
                oldPrice="₹4,999"
                desc="Everything required to run online ordering, dine-in QR menus, live KDS, and POS billing."
                features={[
                  'Online Ordering Website & Subdomain',
                  'Dine-In QR Menus & Table Reservations',
                  'Split-Department KDS & Waiter App',
                  'GST Billing, Coupons & Recipe Inventory',
                ]}
                cta="Start Restaurant Trial"
                onSelect={() => handleChoosePlan('RESTAURANT_ONLY')}
              />

              <TiltPlanCard
                featured
                ribbon="Recommended · Best Value"
                title="Restaurant + Accommodation"
                price="₹3,999"
                oldPrice="₹6,999"
                desc="Complete hospitality operating system uniting restaurant dining, hotel rooms, folios, and rider fleet."
                features={[
                  'Everything in Restaurant Only',
                  'Hotel Rooms, Check-In/Out & Folios',
                  'Private Guest Stay Room-Service Portal',
                  'Delivery Rider App, GPS & Wallet Payouts',
                ]}
                cta="Enter Hospitality Suite"
                onSelect={() => handleChoosePlan('RESTAURANT_ACCOMMODATION')}
              />
            </div>

            {/* Quick Portal Links */}
            <div className="space-y-5 lp-reveal">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e8b964]">
                  Jump Directly Into Any Portal
                </p>
                <span className="text-xs text-[#a3bcbe]">
                  Multi-role access across storefront, floor, kitchen &amp; fleet
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {PORTALS.map(({ label, sub, to, icon: Icon }) => (
                  <Link key={label} to={to} className="lp-portal">
                    <span className="w-10 h-10 rounded-xl bg-[#e3b25b]/12 border border-[#e3b25b]/28 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#f8f1e4] truncate">
                        {label}
                      </span>
                      <span className="block text-xs text-[#a3bcbe] truncate">{sub}</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#a3bcbe] shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

