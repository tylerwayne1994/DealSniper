import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Check, FileText, Calculator, TrendingUp, ClipboardList, Download, Layers } from 'lucide-react';

// ============================================================================
// Landing Page - Conversion-Optimized
// ============================================================================

function LandingPage() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState(null);

  // -------------------------------------------------------------------------
  // Tracking Events (lightweight, no external libs)
  // -------------------------------------------------------------------------
  const trackEvent = (eventName, data = {}) => {
    console.log(`[TRACK] ${eventName}`, data);
    // Future: send to analytics endpoint
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
  // Styles
  // -------------------------------------------------------------------------
  const section = {
    padding: '80px 40px',
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const sectionDark = {
    ...section,
    maxWidth: '100%',
    backgroundColor: '#0f172a',
    padding: '80px 40px'
  };

  const sectionLight = {
    ...section,
    maxWidth: '100%',
    backgroundColor: '#f8fafc',
    padding: '80px 40px'
  };

  const heading2 = {
    fontSize: '36px',
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: '16px',
    letterSpacing: '-1px'
  };

  const heading2Light = {
    ...heading2,
    color: '#ffffff'
  };

  const subheading = {
    fontSize: '18px',
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: '700px',
    margin: '0 auto 48px',
    lineHeight: '1.6'
  };

  const subheadingLight = {
    ...subheading,
    color: '#94a3b8'
  };

  const cardStyle = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb'
  };

  const primaryBtn = {
    padding: '18px 40px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.2s'
  };

  const secondaryLink = {
    color: '#10b981',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'underline',
    background: 'none',
    border: 'none'
  };

  // -------------------------------------------------------------------------
  // FAQ Data
  // -------------------------------------------------------------------------
  const faqs = [
    {
      id: 'lender-quote',
      q: 'Is this a lender quote?',
      a: 'No. Deal Sniper is an underwriting tool, not a lender. We help you model financing structures and cash flows so you can confidently approach lenders with accurate numbers.'
    },
    {
      id: 'missing-data',
      q: 'What if the OM is missing data?',
      a: 'We flag every missing input with a clear "Missing Input" badge instead of showing blank dashes. You will know exactly what is incomplete and where to find it.'
    },
    {
      id: 'email-credentials',
      q: 'Do you store my email credentials?',
      a: 'We use secure OAuth connections for email integrations. Your credentials are never stored on our servers-only temporary access tokens with limited scope.'
    },
    {
      id: 'accuracy',
      q: 'How accurate are the calculations?',
      a: 'Our engine uses institutional-grade formulas for DSCR, cash-on-cash, cap rate, amortization, and IRR. All calculations are transparent and auditable in each tab.'
    },
    {
      id: 'equity-partner',
      q: 'Can I model equity partners?',
      a: 'Yes. The Equity Partner structure supports preferred returns, deferred returns, and refi-based buyout scenarios. It calculates whether your refi proceeds cover the partner buyout.'
    },
    {
      id: 'export',
      q: 'Can I export or share my analysis?',
      a: 'Export to CSV and PDF is available. Share links and Google Sheets integration are on the roadmap.'
    }
  ];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#ffffff' }}>

      {/* ===================================================================
          HERO SECTION (Above the Fold) - With Background Image
      =================================================================== */}
      <section style={{
        minHeight: '100vh',
        backgroundImage: 'url(/Gemini_Generated_Image_fw8pkofw8pkofw8p.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dark overlay for readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.8) 100%)',
          zIndex: 1
        }} />
        
        {/* Minimal Nav */}
        <nav style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', letterSpacing: '-1px' }}>
            DEAL<span style={{ color: '#10b981' }}>SNIPER</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '10px 24px', backgroundColor: 'transparent', color: '#ffffff', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              Log In
            </button>
            <button
              onClick={() => onClickPrimaryCTA('nav')}
              style={{ padding: '10px 24px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
            >
              Start Free
            </button>
          </div>
        </nav>

        {/* Hero Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 40px', maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          
          {/* Headline */}
          <h1 style={{ fontSize: '56px', fontWeight: '900', color: '#ffffff', lineHeight: '1.1', marginBottom: '20px', letterSpacing: '-2px' }}>
            Know if a deal works<br/>
            <span style={{ color: '#10b981' }}>before you waste a week on it</span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: '20px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '32px', maxWidth: '700px' }}>
            For multifamily investors who need to screen deals fast, compare financing structures, and get a clear execution plan-without building another spreadsheet.
          </p>

          {/* 3 Bullet Benefits */}
          <div style={{ display: 'flex', gap: '32px', marginBottom: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              'Compare 7 financing structures side-by-side',
              'See cash required, DSCR, and refi feasibility instantly',
              'Get a step-by-step execution playbook per structure'
            ].map((benefit, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} color="#10b981" />
                </div>
                <span style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: '500' }}>{benefit}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => onClickPrimaryCTA('hero')}
              style={primaryBtn}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.45)'; }}
              onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.35)'; }}
            >
              Start Free - No Credit Card
            </button>
            <button onClick={onClickSeeHowItWorks} style={secondaryLink}>
              See how it works
            </button>
          </div>
        </div>

        {/* Trust Row */}
        <div style={{ padding: '32px 40px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px', fontWeight: '500' }}>
            Used by investors analyzing <span style={{ color: '#10b981', fontWeight: '700' }}>50+ deals/week</span>
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', opacity: 0.5 }}>
            {/* Logo placeholders */}
            {['Investor Group A', 'Capital Partners', 'Syndicator Pro'].map((name, i) => (
              <div key={i} style={{ padding: '8px 24px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          WHAT DEAL SNIPER DOES (Site-specific flow)
      =================================================================== */}
      <section id="what-it-does" style={{ ...sectionLight, maxWidth: '100%' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={heading2}>What Deal Sniper Does</h2>
          <p style={subheading}>
            From raw deal inputs to execution-ready playbook in minutes-not days.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {[
              { icon: <FileText size={24} color="#10b981" />, title: 'Ingest deal inputs', desc: 'Paste a Crexi link, upload an OM PDF, or forward an email. We extract property data, rent rolls, and financials automatically.' },
              { icon: <Layers size={24} color="#10b981" />, title: 'Compare 7 financing structures', desc: 'Traditional bank, seller finance, subject-to, hybrid (sub-to + seller carry), equity partner, seller carry (bank + 2nd), and lease option. See cash required, DSCR, and cash flow for each.' },
              { icon: <Calculator size={24} color="#10b981" />, title: 'Flag missing inputs-not blank dashes', desc: 'Every incomplete field shows a clear "Missing Input" badge so you know exactly what to chase before making an offer.' },
              { icon: <TrendingUp size={24} color="#10b981" />, title: 'Plan value-add and stabilization', desc: 'Model rent bumps, expense cuts, and capital improvements. See the resulting stabilized value and NOI without building a second spreadsheet.' },
              { icon: <Calculator size={24} color="#10b981" />, title: 'Validate refi and buyout feasibility', desc: 'Value-Add outputs feed directly into Deal Execution. See if your refi covers the original loan, seller payoff, or equity partner buyout.' },
              { icon: <ClipboardList size={24} color="#10b981" />, title: 'Get a step-by-step execution playbook', desc: 'Each financing structure has its own checklist of steps and required documents-so you know exactly what to do after you get the deal under contract.' },
              { icon: <Download size={24} color="#10b981" />, title: 'Export and share', desc: 'Download CSV or PDF. Share links coming soon. No double-entry-everything flows from one source of truth.' }
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', padding: '20px 24px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {step.icon}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{step.title}</div>
                  <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center', padding: '24px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: '15px', color: '#166534', fontWeight: '600', margin: 0 }}>
              No double-calcs. Read-only sourcing between tabs. Clear execution steps.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================================
          WHY IT IS DIFFERENT (Positioning)
      =================================================================== */}
      <section style={{ ...section }}>
        <h2 style={heading2}>Why It Is Different</h2>
        <p style={subheading}>
          Most underwriting tools make you build everything from scratch. We do not.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            { title: 'Structure-first underwriting', desc: 'Compare 7 financing structures instantly. See which one requires the least cash and highest returns-before you waste time on one path.' },
            { title: 'Execution playbooks', desc: 'Each structure has its own step-by-step checklist and required documents. Know exactly what to do from LOI to close.' },
            { title: 'Value-add to refi validation', desc: 'Your stabilized value and refi loan amount flow directly into the execution tab. See if refi covers payoffs and buyouts-no copy-paste.' }
          ].map((card, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Check size={24} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>{card.title}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
          PROOF (Trust + Credibility)
      =================================================================== */}
      <section style={sectionDark}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={heading2Light}>What Investors Are Saying</h2>
          <p style={subheadingLight}>
            Placeholder testimonials-replace with real quotes.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
            {[
              { quote: 'Cut my deal screening time from 2 hours to 15 minutes. I can finally keep up with my broker deal flow.', name: 'J. Martinez', role: 'Multifamily Syndicator' },
              { quote: 'The execution playbook alone saved me from missing a critical doc on my last sub-to deal.', name: 'S. Thompson', role: 'Creative Finance Investor' },
              { quote: 'Finally, a tool that shows equity partner buyout feasibility without a custom Excel model.', name: 'K. Patel', role: 'LP/GP Hybrid Investor' }
            ].map((t, i) => (
              <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <p style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: '1.6', marginBottom: '16px', fontStyle: 'italic' }}>"{t.quote}"</p>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>{t.name}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics Strip */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '64px', padding: '32px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {[
              { value: '15 min', label: 'Avg time saved per deal' },
              { value: '50+', label: 'Deals screened per week' },
              { value: '6', label: 'Structures compared instantly' }
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#10b981' }}>{m.value}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          FAQ (Objection Handling)
      =================================================================== */}
      <section style={{ ...section }}>
        <h2 style={heading2}>Frequently Asked Questions</h2>
        <p style={subheading}>
          Quick answers to common questions.
        </p>

        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq) => (
            <div
              key={faq.id}
              style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}
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
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{faq.q}</span>
                {expandedFaq === faq.id ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
              </button>
              {expandedFaq === faq.id && (
                <div style={{ padding: '0 24px 20px', fontSize: '15px', color: '#6b7280', lineHeight: '1.6' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================
          FINAL CTA SECTION
      =================================================================== */}
      <section style={{ ...sectionDark, textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ ...heading2Light, marginBottom: '16px' }}>Ready to screen deals faster?</h2>
          <p style={{ ...subheadingLight, marginBottom: '32px' }}>
            Start free. No credit card required. Cancel anytime.
          </p>
          <button
            onClick={() => onClickPrimaryCTA('footer')}
            style={{ ...primaryBtn, padding: '20px 48px', fontSize: '18px' }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.45)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.35)'; }}
          >
            Start Free - No Credit Card
          </button>
          <p style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
            Questions? Email <a href="mailto:support@dealsniper.io" style={{ color: '#10b981' }}>support@dealsniper.io</a>
          </p>
        </div>
      </section>

      {/* ===================================================================
          FOOTER
      =================================================================== */}
      <footer style={{ padding: '24px 40px', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
          2025 Deal Sniper. Built for investors who move fast.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
