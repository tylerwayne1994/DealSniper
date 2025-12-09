import React from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.85) 100%)',
    zIndex: 1
  },
  content: {
    position: 'relative',
    zIndex: 2,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '40px'
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '60px'
  },
  logo: {
    fontSize: '32px',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: '-1px',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)'
  },
  navButtons: {
    display: 'flex',
    gap: '16px'
  },
  navButton: {
    padding: '12px 28px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    border: '2px solid rgba(255,255,255,0.3)',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s',
    backdropFilter: 'blur(10px)',
    letterSpacing: '0.3px'
  },
  hero: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  badge: {
    display: 'inline-block',
    padding: '10px 24px',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    border: '2px solid #10b981',
    borderRadius: '50px',
    color: '#10b981',
    fontSize: '14px',
    fontWeight: '800',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '32px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)'
  },
  title: {
    fontSize: '80px',
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: '24px',
    lineHeight: '1.1',
    letterSpacing: '-3px',
    textShadow: '0 4px 20px rgba(0,0,0,0.8)'
  },
  subtitle: {
    fontSize: '24px',
    color: '#e0e0e0',
    marginBottom: '48px',
    lineHeight: '1.6',
    maxWidth: '800px',
    fontWeight: '400',
    textShadow: '0 2px 10px rgba(0,0,0,0.8)'
  },

  ctaButtons: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center'
  },
  primaryButton: {
    padding: '20px 48px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  secondaryButton: {
    padding: '20px 48px',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '3px solid #ffffff',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.3s',
    backdropFilter: 'blur(10px)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  researchButton: {
    padding: '20px 48px',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: '#ffffff',
    border: '3px solid #6366f1',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.3s',
    backdropFilter: 'blur(10px)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)'
  },
  footer: {
    textAlign: 'center',
    paddingTop: '40px'
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '64px',
    marginBottom: '32px'
  },
  stat: {
    textAlign: 'center'
  },
  statNumber: {
    fontSize: '40px',
    fontWeight: '900',
    color: '#10b981',
    marginBottom: '8px',
    textShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
  },
  statLabel: {
    fontSize: '14px',
    color: '#c0c0c0',
    fontWeight: '600',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  footerText: {
    color: '#888',
    fontSize: '13px'
  }
};

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <img 
        src="/Gemini_Generated_Image_fw8pkofw8pkofw8p.png" 
        alt="Background" 
        style={styles.backgroundImage}
      />
      <div style={styles.overlay}></div>
      
      <div style={styles.content}>
        <nav style={styles.nav}>
          <div style={styles.logo}>DEALSNIPER</div>
          <div style={styles.navButtons}>
            <button 
              style={styles.navButton}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.2)';
                e.target.style.borderColor = 'rgba(255,255,255,0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                e.target.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
              onClick={() => navigate('/underwrite')}
            >
              Underwrite
            </button>
            <button 
              style={styles.navButton}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.2)';
                e.target.style.borderColor = 'rgba(255,255,255,0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                e.target.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </button>
          </div>
        </nav>

        <div style={styles.hero}>
          <div style={styles.badge}>AI-Powered Deal Analysis</div>
          
          <h1 style={styles.title}>
            Underwrite Multifamily<br/>Deals in Seconds
          </h1>
          
          <p style={styles.subtitle}>
            Upload offering memorandums, extract data with AI, and analyze multifamily & RV park investments with institutional-grade underwriting—all automated.
          </p>

          <div style={styles.ctaButtons}>
            <button 
              style={styles.primaryButton}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-4px) scale(1.05)';
                e.target.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0) scale(1)';
                e.target.style.boxShadow = '0 8px 32px rgba(16, 185, 129, 0.4)';
              }}
              onClick={() => navigate('/upload')}
            >
              Upload Your First Deal
            </button>
            <button 
              style={styles.researchButton}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(99, 102, 241, 0.4)';
                e.target.style.transform = 'translateY(-4px) scale(1.05)';
                e.target.style.boxShadow = '0 12px 40px rgba(99, 102, 241, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                e.target.style.transform = 'translateY(0) scale(1)';
                e.target.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.3)';
              }}
              onClick={() => navigate('/market-research')}
            >
              🔍 Find Perfect Market
            </button>
            <button 
              style={styles.secondaryButton}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                e.target.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }}
              onClick={() => navigate('/pipeline')}
            >
              View Pipeline
            </button>
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.stats}>
            <div style={styles.stat}>
              <div style={styles.statNumber}>5min</div>
              <div style={styles.statLabel}>Avg Underwriting Time</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>98%</div>
              <div style={styles.statLabel}>Data Accuracy</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statNumber}>∞</div>
              <div style={styles.statLabel}>Deals You Can Track</div>
            </div>
          </div>
          <p style={styles.footerText}>
            © 2025 DealSniper. Built for real estate investors who move fast.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
