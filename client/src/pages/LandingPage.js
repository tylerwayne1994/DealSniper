import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Check,
  FileText,
  Calculator,
  TrendingUp,
  ClipboardList,
  Download,
  Layers,
  Mail,
  Zap,
  Shield,
  BarChart3,
  Star,
  ArrowRight,
  Target,
  Brain,
  Clock,
  DollarSign,
  Users,
} from 'lucide-react';

// ============================================================================
// Landing Page - Premium Redesign
// ============================================================================

function LandingPage() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState(null);

  const trackEvent = (eventName, data = {}) => {
    console.log(`[TRACK] ${eventName}`, data);
    if (window.gtag) {
      window.gtag('event', eventName, data);
    }
  };

  const onClickPrimaryCTA = (location) => {
    trackEvent('click_primary_cta', { location });
    navigate('/signup');
  };

  const onClickSeeHowItWorks = () => {
    trackEvent('click_see_how_it_works');
    document.getElementById('what-it-does')?.scrollIntoView({ behavior: 'smooth' });
  };

  const onClickFAQExpand = (faqId) => {
    trackEvent('click_faq_expand', { faqId });
    setExpandedFaq(expandedFaq === faqId ? null : faqId);
  };

  // -------------------------------------------------------------------------
  // FAQ Data
  // -------------------------------------------------------------------------
  const faqs = [
    {
      id: 'lender-quote',
      q: 'Is this a lender quote?',
      a: 'No. Deal Sniper is an underwriting tool, not a lender. We help you model financing structures and cash flows so you can confidently approach lenders with accurate numbers.',
    },
    {
      id: 'missing-data',
      q: 'What if the OM is missing data?',
      a: 'We flag every missing input with a clear "Missing Input" badge instead of showing blank dashes. You know exactly what is incomplete and where to find it.',
    },
    {
      id: 'accuracy',
      q: 'How accurate are the calculations?',
      a: 'Our engine uses institutional-grade formulas for DSCR, cash-on-cash, cap rate, amortization, and IRR. All calculations are transparent and auditable in each tab.',
    },
    {
      id: 'equity-partner',
      q: 'Can I model equity partners?',
      a: 'Yes. The Equity Partner structure supports preferred returns, deferred returns, and refi-based buyout scenarios. It calculates whether your refi proceeds cover the partner buyout.',
    },
    {
      id: 'email-flow',
      q: 'How does the email underwriting work?',
      a: 'Forward any broker email with an OM PDF to deals@dealsniper.org. We read the PDF, extract the financials, and create a full underwrite automatically \u2014 no uploads, no data entry.',
    },
    {
      id: 'export',
      q: 'Can I export or share my analysis?',
      a: 'Export to CSV and PDF is available. Share links and Google Sheets integration are on the roadmap.',
    },
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#ffffff',
        overflowX: 'hidden',
      }}
    >
      {/* =================================================================
          HERO SECTION
      ================================================================= */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/Gemini_Generated_Image_h1bn6ch1bn6ch1bn.png"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(160deg, rgba(2, 6, 23, 0.92) 0%, rgba(15, 23, 42, 0.85) 50%, rgba(15, 23, 42, 0.7) 100%)',
            zIndex: 1,
          }}
        />

        {/* Nav */}
        <nav
          style={{
            padding: '20px 48px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: '30px',
              fontWeight: '900',
              color: '#ffffff',
              letterSpacing: '-1.5px',
            }}
          >
            DEAL<span style={{ color: '#10b981' }}>SNIPER</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => onClickSeeHowItWorks()}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Features
            </button>
            <button
              onClick={() =>
                document
                  .getElementById('testimonials')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Testimonials
            </button>
            <button
              onClick={() => navigate('/investor')}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.target.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.target.style.color = '#94a3b8'; }}
            >
              Investor Access
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.25)',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.5)';
                e.target.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.25)';
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              Log In
            </button>
            <button
              onClick={() => onClickPrimaryCTA('nav')}
              style={{
                padding: '10px 24px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#059669';
                e.target.style.boxShadow =
                  '0 6px 24px rgba(16, 185, 129, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#10b981';
                e.target.style.boxShadow =
                  '0 4px 16px rgba(16, 185, 129, 0.3)';
              }}
            >
              Get Started Free
            </button>
          </div>
        </nav>

        {/* Hero Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '0 40px',
            maxWidth: '1000px',
            margin: '0 auto',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 20px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '100px',
              marginBottom: '28px',
            }}
          >
            <Zap size={14} color="#10b981" />
            <span
              style={{
                color: '#10b981',
                fontSize: '13px',
                fontWeight: '600',
                letterSpacing: '0.3px',
              }}
            >
              Redefined Multifamily Underwriting
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: '900',
              color: '#ffffff',
              lineHeight: '1.05',
              marginBottom: '24px',
              letterSpacing: '-3px',
            }}
          >
            Underwrite any deal
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #10b981, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              in minutes, not days
            </span>
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: '20px',
              color: '#cbd5e1',
              lineHeight: '1.7',
              marginBottom: '36px',
              maxWidth: '680px',
            }}
          >
            Forward a broker email, upload an OM, or paste a link. We extract
            every number, compare financing structures, and build an
            institutional-quality underwrite &mdash; then hand you an interactive
            one-page deal room to bring investors into it with you.
          </p>

          {/* Bullet Benefits */}
          <div
            style={{
              display: 'flex',
              gap: '28px',
              marginBottom: '44px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {[
              'Email an OM \u2192 get a full underwrite back',
              'Compare 7 financing structures side-by-side',
              'Invite investors into an interactive one-page deal room',
              'Get a read from top-earning multifamily investors on every deal',
            ].map((benefit, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={12} color="#10b981" />
                </div>
                <span
                  style={{
                    color: '#e2e8f0',
                    fontSize: '15px',
                    fontWeight: '500',
                  }}
                >
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => onClickPrimaryCTA('hero')}
              style={{
                padding: '18px 44px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                fontSize: '17px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.25s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow =
                  '0 12px 40px rgba(16, 185, 129, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 8px 32px rgba(16, 185, 129, 0.4)';
              }}
            >
              Start Free &mdash; No Credit Card
              <ArrowRight size={18} />
            </button>
            <button
              onClick={onClickSeeHowItWorks}
              style={{
                padding: '18px 32px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: '14px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.12)';
                e.target.style.borderColor = 'rgba(255,255,255,0.35)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.08)';
                e.target.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
            >
              See How It Works
            </button>
          </div>

          {/* Investor entry point */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => navigate('/investor')}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
              onMouseEnter={(e) => { e.target.style.color = '#e2e8f0'; }}
              onMouseLeave={(e) => { e.target.style.color = '#94a3b8'; }}
            >
              Have an investor access code? Enter it here &rarr;
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div
          style={{
            padding: '28px 48px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '64px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { value: '2 min', label: 'Average underwrite time' },
              { value: '7', label: 'Financing structures compared' },
              { value: '500+', label: 'Deals underwritten' },
              { value: '50-75%', label: 'Less than legacy platforms' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: '800',
                    color: '#10b981',
                    marginBottom: '4px',
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '600',
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          HOW IT WORKS - 3-Step Flow
      ================================================================= */}
      <section
        id="what-it-does"
        style={{
          padding: '100px 48px',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                backgroundColor: '#ecfdf5',
                borderRadius: '100px',
                marginBottom: '16px',
              }}
            >
              <Target size={14} color="#059669" />
              <span
                style={{
                  color: '#059669',
                  fontSize: '13px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                How It Works
              </span>
            </div>
            <h2
              style={{
                fontSize: '42px',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-1.5px',
                marginBottom: '16px',
              }}
            >
              Three ways in. One institutional-quality underwrite out.
            </h2>
            <p
              style={{
                fontSize: '18px',
                color: '#64748b',
                maxWidth: '650px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              No matter how a deal lands on your desk, Deal Sniper handles it.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '32px',
            }}
          >
            {[
              {
                step: '01',
                icon: <Mail size={28} color="#10b981" />,
                title: 'Forward the Email',
                desc: 'Got a broker blast with an OM PDF? Forward it to deals@dealsniper.org. We read every page, extract rent rolls, financials, and property details \u2014 then build a full underwrite automatically.',
              },
              {
                step: '02',
                icon: <FileText size={28} color="#10b981" />,
                title: 'Upload or Paste a Link',
                desc: 'Drop an OM PDF directly or paste a Crexi/LoopNet link. Deal Sniper pulls the data, identifies missing fields, and builds your model \u2014 no manual data entry needed.',
              },
              {
                step: '03',
                icon: <Layers size={28} color="#10b981" />,
                title: 'Compare & Execute',
                desc: 'Instantly see 7 financing structures side-by-side: traditional bank, seller finance, equity partner, creative combos, and more. Each comes with a step-by-step execution playbook.',
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  padding: '40px 32px',
                  backgroundColor: '#fafafa',
                  borderRadius: '20px',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow =
                    '0 20px 40px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <div
                  style={{
                    fontSize: '48px',
                    fontWeight: '900',
                    color: '#f0fdf4',
                    position: 'absolute',
                    top: '16px',
                    right: '24px',
                    lineHeight: 1,
                  }}
                >
                  {item.step}
                </div>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    backgroundColor: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                  }}
                >
                  {item.icon}
                </div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '12px',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: '15px',
                    color: '#64748b',
                    lineHeight: '1.65',
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          FEATURES DEEP-DIVE
      ================================================================= */}
      <section
        style={{
          padding: '100px 48px',
          backgroundColor: '#0f172a',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '100px',
                marginBottom: '16px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <Zap size={14} color="#10b981" />
              <span
                style={{
                  color: '#10b981',
                  fontSize: '13px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Platform Features
              </span>
            </div>
            <h2
              style={{
                fontSize: '42px',
                fontWeight: '800',
                color: '#ffffff',
                letterSpacing: '-1.5px',
                marginBottom: '16px',
              }}
            >
              Everything you need to underwrite with confidence
            </h2>
            <p
              style={{
                fontSize: '18px',
                color: '#94a3b8',
                maxWidth: '650px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              From deal intake to investor-ready pitch &mdash; all in one place.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px',
            }}
          >
            {[
              {
                icon: <Brain size={24} color="#10b981" />,
                title: 'Automatic Deal Extraction',
                desc: 'We read your OM PDFs page by page \u2014 rent rolls, T12 financials, expense breakdowns, cap rates \u2014 and fill in every field automatically. No manual data entry.',
              },
              {
                icon: <Layers size={24} color="#10b981" />,
                title: '7 Financing Structures',
                desc: 'Traditional bank, seller finance, equity partner, seller carry + bank 2nd, lease option, and more. See cash required, DSCR, and returns for each.',
              },
              {
                icon: <Mail size={24} color="#10b981" />,
                title: 'Email-to-Underwrite',
                desc: 'Forward broker emails to deals@dealsniper.org. PDFs are extracted, parsed, and underwritten automatically. Deals appear in your pipeline within minutes.',
              },
              {
                icon: <BarChart3 size={24} color="#10b981" />,
                title: 'Market Research & Comps',
                desc: 'Automated comp pulls, demographic analysis, rent trends, and submarket scoring. Know the market before you make an offer.',
              },
              {
                icon: <TrendingUp size={24} color="#10b981" />,
                title: 'Value-Add Modeling',
                desc: 'Model rent bumps, expense cuts, and capital improvements. See stabilized NOI, refi feasibility, and equity partner buyout in real time.',
              },
              {
                icon: <ClipboardList size={24} color="#10b981" />,
                title: 'Execution Playbooks',
                desc: 'Each financing structure has its own step-by-step checklist with required documents. Know exactly what to do from LOI to close.',
              },
              {
                icon: <Calculator size={24} color="#10b981" />,
                title: 'Institutional Calculations',
                desc: 'DSCR, cash-on-cash, cap rate, IRR, amortization \u2014 all transparent and auditable. No hidden formulas, no black boxes.',
              },
              {
                icon: <Download size={24} color="#10b981" />,
                title: 'Interactive Investor Deal Room',
                desc: 'Turn any underwrite into a live, interactive one-page deal room. Send investors a link and let them explore the numbers, market data, and deal structure themselves \u2014 no static PDF required.',
              },
              {
                icon: <Users size={24} color="#10b981" />,
                title: 'Board of Advisors',
                desc: 'Get a candid read on every deal from a panel modeled on top-earning multifamily investors \u2014 weighing in on your deal\u2019s real numbers, risks, and structure before you commit.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                style={{
                  padding: '28px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.25s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(255,255,255,0.07)';
                  e.currentTarget.style.borderColor =
                    'rgba(16, 185, 129, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor =
                    'rgba(255,255,255,0.08)';
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  {feature.icon}
                </div>
                <h3
                  style={{
                    fontSize: '17px',
                    fontWeight: '700',
                    color: '#ffffff',
                    marginBottom: '8px',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    lineHeight: '1.6',
                    margin: 0,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          WHAT SETS US APART
      ================================================================= */}
      <section style={{ padding: '100px 48px', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                backgroundColor: '#ecfdf5',
                borderRadius: '100px',
                marginBottom: '16px',
              }}
            >
              <Target size={14} color="#059669" />
              <span
                style={{
                  color: '#059669',
                  fontSize: '13px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Why Deal Sniper
              </span>
            </div>
            <h2
              style={{
                fontSize: '42px',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-1.5px',
                marginBottom: '16px',
              }}
            >
              What sets us apart from every other underwriting tool
            </h2>
            <p
              style={{
                fontSize: '18px',
                color: '#64748b',
                maxWidth: '700px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              Most tools give you a blank spreadsheet and wish you luck. We
              built something different.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              {
                icon: <Clock size={24} color="#10b981" />,
                title: 'Zero data entry',
                desc: 'Other tools make you type in every number from the OM. Deal Sniper reads the PDF and fills everything in \u2014 rent rolls, T12 expenses, cap rates, unit mixes. You review, not re-type.',
                highlight: 'What used to take 2 hours takes 2 minutes.',
              },
              {
                icon: <Layers size={24} color="#10b981" />,
                title: 'Structure-first underwriting',
                desc: "Most platforms give you one financing structure and call it a day. Deal Sniper models 7 structures simultaneously \u2014 traditional bank, seller finance, equity partner, creative combos \u2014 so you can see which path gets you the best returns before you commit to one.",
                highlight: 'Compare every financing path in one screen.',
              },
              {
                icon: <Mail size={24} color="#10b981" />,
                title: 'Fully automated email pipeline',
                desc: "No other underwriting tool lets you forward a broker email and get a complete underwrite back without lifting a finger. Forward to deals@dealsniper.org and the deal shows up in your pipeline, fully modeled, within minutes.",
                highlight: "Your broker never even knows you did all this analysis.",
              },
              {
                icon: <Shield size={24} color="#10b981" />,
                title: 'A fraction of the cost',
                desc: "Enterprise underwriting platforms charge tens of thousands of dollars a year for a fraction of what Deal Sniper does out of the box. You get the same institutional-grade modeling, plus the financing comparisons, deal room, and advisor read they don't have — for 50-75% less.",
                highlight: 'Institutional-quality underwriting without the institutional price tag.',
              },
              {
                icon: <DollarSign size={24} color="#10b981" />,
                title: 'Value-add flows into execution',
                desc: "Model your renovation, rent bumps, and expense cuts in the Value-Add tab. The stabilized NOI automatically feeds into the Deal Execution tab \u2014 showing refi feasibility, seller payoff coverage, and equity partner buyout math. No copy-paste between tabs.",
                highlight: 'One source of truth from acquisition to exit.',
              },
              {
                icon: <ClipboardList size={24} color="#10b981" />,
                title: 'Execution playbooks, not just numbers',
                desc: 'Every financing structure comes with a step-by-step playbook: what documents to prepare, what to send to the lender, when to engage attorneys, and how to structure the close. You get a plan, not just a spreadsheet.',
                highlight: 'Know what to do next \u2014 not just what the numbers say.',
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '24px',
                  padding: '32px',
                  backgroundColor: '#fafafa',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow =
                    '0 8px 24px rgba(16,185,129,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    backgroundColor: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: '19px',
                      fontWeight: '700',
                      color: '#0f172a',
                      marginBottom: '8px',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '15px',
                      color: '#64748b',
                      lineHeight: '1.65',
                      margin: '0 0 12px 0',
                    }}
                  >
                    {item.desc}
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      backgroundColor: '#ecfdf5',
                      borderRadius: '8px',
                    }}
                  >
                    <Zap size={13} color="#059669" />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: '#059669',
                      }}
                    >
                      {item.highlight}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          TESTIMONIALS
      ================================================================= */}
      <section
        id="testimonials"
        style={{
          padding: '100px 48px',
          backgroundColor: '#0f172a',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '100px',
                marginBottom: '16px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <Star size={14} color="#10b981" />
              <span
                style={{
                  color: '#10b981',
                  fontSize: '13px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Testimonials
              </span>
            </div>
            <h2
              style={{
                fontSize: '42px',
                fontWeight: '800',
                color: '#ffffff',
                letterSpacing: '-1.5px',
                marginBottom: '16px',
              }}
            >
              Investors are closing faster with Deal Sniper
            </h2>
            <p
              style={{
                fontSize: '18px',
                color: '#94a3b8',
                maxWidth: '600px',
                margin: '0 auto',
                lineHeight: '1.6',
              }}
            >
              Hear from real estate investors who use Deal Sniper to screen,
              underwrite, and execute deals.
            </p>
          </div>

          {/* Testimonial Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px',
              marginBottom: '48px',
            }}
          >
            {[
              {
                quote:
                  "I used to spend 3-4 hours per deal building a custom spreadsheet for each OM. Now I forward the broker email and have a full underwrite in my pipeline before my coffee gets cold. It's completely changed how I screen deal flow.",
                name: 'James R.',
                role: 'Multifamily Syndicator, 200+ Units',
                stars: 5,
              },
              {
                quote:
                  "The financing structure comparison is what sold me. I was only looking at traditional bank debt on every deal. Deal Sniper showed me a seller-carry + bank 2nd structure on a 24-unit that saved me $180K in cash at closing. I would have missed it completely.",
                name: 'Maria L.',
                role: 'Value-Add Investor, TX & AZ',
                stars: 5,
              },
              {
                quote:
                  "As a broker, I use Deal Sniper to quickly underwrite listings for my investor clients. I can turn around a full analysis within an hour of getting the OM. My clients think I have a team of analysts \u2014 it's just me and Deal Sniper.",
                name: 'David K.',
                role: 'Commercial RE Broker',
                stars: 5,
              },
              {
                quote:
                  "I used to build a separate PDF every time I brought a new investor into a deal. Now I just send them a link to the interactive deal room — they can dig into the numbers, the market data, and the whole structure themselves. It's made raising capital so much easier.",
                name: 'Rachel T.',
                role: 'LP/GP Hybrid, Midwest Markets',
                stars: 5,
              },
              {
                quote:
                  "We were using a $50K/year enterprise underwriting platform. Deal Sniper does everything it does and more for a fraction of the price \u2014 the automatic extraction alone saves my team 20+ hours per week. The execution playbooks are something our old tool never had.",
                name: 'Michael S.',
                role: 'Director of Acquisitions, PE Fund',
                stars: 5,
              },
              {
                quote:
                  "I'm a newer investor and was intimidated by underwriting. Before I make an offer, I get a read on the deal from a panel modeled on top-earning multifamily investors \u2014 it flags risks I never would have thought to ask about. It gave me the confidence to put in my first LOI.",
                name: 'Priya N.',
                role: 'First-Time Multifamily Investor',
                stars: 5,
              },
            ].map((t, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: '16px',
                  padding: '28px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    'rgba(16, 185, 129, 0.3)';
                  e.currentTarget.style.backgroundColor =
                    'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    'rgba(255,255,255,0.08)';
                  e.currentTarget.style.backgroundColor =
                    'rgba(255,255,255,0.04)';
                }}
              >
                {/* Stars */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '3px',
                      marginBottom: '16px',
                    }}
                  >
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star
                        key={si}
                        size={16}
                        color="#fbbf24"
                        fill="#fbbf24"
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: '15px',
                      color: '#e2e8f0',
                      lineHeight: '1.65',
                      marginBottom: '20px',
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: '700',
                      color: '#ffffff',
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#10b981',
                      fontWeight: '500',
                    }}
                  >
                    {t.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '48px',
              padding: '32px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              flexWrap: 'wrap',
            }}
          >
            {[
              { value: '95%', label: 'Time saved vs manual underwriting' },
              { value: '20+ hrs', label: 'Saved per week per team' },
              { value: '3x', label: 'More deals screened' },
              { value: '4.9/5', label: 'Average user rating' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center', minWidth: '140px' }}>
                <div
                  style={{
                    fontSize: '30px',
                    fontWeight: '800',
                    color: '#10b981',
                  }}
                >
                  {m.value}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                  }}
                >
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          FAQ
      ================================================================= */}
      <section style={{ padding: '100px 48px', backgroundColor: '#ffffff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '42px',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-1.5px',
                marginBottom: '16px',
              }}
            >
              Frequently Asked Questions
            </h2>
            <p
              style={{
                fontSize: '18px',
                color: '#64748b',
                lineHeight: '1.6',
              }}
            >
              Quick answers to common questions.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {faqs.map((faq) => (
              <div
                key={faq.id}
                style={{
                  backgroundColor: '#fafafa',
                  borderRadius: '14px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                <button
                  onClick={() => onClickFAQExpand(faq.id)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#0f172a',
                    }}
                  >
                    {faq.q}
                  </span>
                  {expandedFaq === faq.id ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </button>
                {expandedFaq === faq.id && (
                  <div
                    style={{
                      padding: '0 24px 20px',
                      fontSize: '15px',
                      color: '#64748b',
                      lineHeight: '1.65',
                    }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================
          FINAL CTA
      ================================================================= */}
      <section
        style={{
          padding: '100px 48px',
          background:
            'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '48px',
              fontWeight: '900',
              color: '#ffffff',
              letterSpacing: '-2px',
              marginBottom: '20px',
              lineHeight: '1.1',
            }}
          >
            Stop building spreadsheets.
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #10b981, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Start closing deals.
            </span>
          </h2>
          <p
            style={{
              fontSize: '18px',
              color: '#94a3b8',
              lineHeight: '1.6',
              marginBottom: '40px',
            }}
          >
            Join investors who are screening more deals, building better models,
            and closing faster &mdash; all without touching a spreadsheet.
          </p>
          <button
            onClick={() => onClickPrimaryCTA('footer')}
            style={{
              padding: '20px 52px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.25s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow =
                '0 12px 40px rgba(16, 185, 129, 0.55)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 8px 32px rgba(16, 185, 129, 0.4)';
            }}
          >
            Start Free &mdash; No Credit Card
            <ArrowRight size={18} />
          </button>
          <p
            style={{
              marginTop: '20px',
              fontSize: '14px',
              color: '#64748b',
            }}
          >
            Questions?{' '}
            <a
              href="mailto:support@dealsniper.org"
              style={{ color: '#10b981', textDecoration: 'none', fontWeight: '600' }}
            >
              support@dealsniper.org
            </a>
          </p>
        </div>
      </section>

      {/* =================================================================
          FOOTER
      ================================================================= */}
      <footer
        style={{
          padding: '24px 48px',
          backgroundColor: '#020617',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
          &copy; {new Date().getFullYear()} Deal Sniper. Built for investors who
          move fast.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
