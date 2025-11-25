import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px 20px'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '32px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
    marginBottom: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: 0
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    border: '1px solid #1a1a1a'
  },
  buttonSuccess: {
    backgroundColor: '#388e3c'
  },
  approvedBadge: {
    padding: '10px 20px',
    backgroundColor: '#388e3c',
    color: '#ffffff',
    borderRadius: '4px',
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '20px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px'
  },
  gridItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  value: {
    fontSize: '16px',
    color: '#1a1a1a',
    fontWeight: '500'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    boxSizing: 'border-box'
  },
  formGroup: {
    marginBottom: '0'
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    marginBottom: '24px',
    border: '1px solid #fcc'
  },
  loading: {
    color: '#666',
    fontSize: '16px'
  },
  lightCard: {
    backgroundColor: '#f8f8f8'
  },
  buttonContainer: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  generatedContent: {
    marginTop: '24px'
  },
  slideCard: {
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: '#f8f8f8',
    borderRadius: '4px'
  },
  slideTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '12px'
  },
  slideContent: {
    marginTop: '8px'
  },
  pre: {
    whiteSpace: 'pre-wrap',
    backgroundColor: '#f8f8f8',
    padding: '16px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px'
  }
};

function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [generatedContent, setGeneratedContent] = useState(null);

  useEffect(() => {
    fetchDeal();
  }, [id]);

  const fetchDeal = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/deals/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch deal');
      }
      
      const data = await response.json();
      setDeal(data);
      setFormData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/deals/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to update deal');
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);
      setEditMode(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/deals/${id}/approve`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to approve deal');
      }

      const updatedDeal = await response.json();
      setDeal(updatedDeal);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGeneratePitchDeck = async () => {
    try {
      const response = await fetch(`/api/deals/${id}/pitch-deck`);
      
      if (!response.ok) {
        throw new Error('Failed to generate pitch deck');
      }

      const data = await response.json();
      setGeneratedContent({ type: 'pitch-deck', data });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGenerateExecutionPlan = async () => {
    try {
      const response = await fetch(`/api/deals/${id}/execution-plan`);
      
      if (!response.ok) {
        throw new Error('Failed to generate execution plan');
      }

      const data = await response.json();
      setGeneratedContent({ type: 'execution-plan', data });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGenerateBrokerScript = async () => {
    try {
      const response = await fetch(`/api/deals/${id}/broker-script`);
      
      if (!response.ok) {
        throw new Error('Failed to generate broker script');
      }

      const data = await response.json();
      setGeneratedContent({ type: 'broker-script', data });
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (value) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value == null) return '-';
    return `${(value * 100).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loading}>Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.error}>Error: {error}</p>
          <button onClick={fetchDeal} style={styles.button}>Retry</button>
          <button onClick={() => navigate('/pipeline')} style={{...styles.button, ...styles.buttonSecondary, marginLeft: '12px'}}>Back to Pipeline</button>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p>Deal not found</p>
          <button onClick={() => navigate('/pipeline')} style={styles.button}>Back to Pipeline</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>{deal.property_name}</h1>
          <div style={styles.buttonGroup}>
            <button onClick={() => navigate('/pipeline')} style={{...styles.button, ...styles.buttonSecondary}}>Back to Pipeline</button>
            {!deal.is_approved && (
              <button onClick={handleApprove} style={{...styles.button, ...styles.buttonSuccess}}>
                Approve Deal
              </button>
            )}
            {deal.is_approved && (
              <span style={styles.approvedBadge}>
                ✓ Approved
              </span>
            )}
          </div>
        </div>

        {/* Basic Info Section */}
        <div style={{...styles.card, ...styles.lightCard}}>
          <h2 style={styles.sectionTitle}>Property Information</h2>
          <div style={styles.grid}>
            <div style={styles.gridItem}>
              <span style={styles.label}>Location</span>
              <span style={styles.value}>{deal.location || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Units/Pads</span>
              <span style={styles.value}>{deal.units_or_pads || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Status</span>
              <span style={styles.value}>{deal.status || 'New'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Priority</span>
              <span style={styles.value}>{deal.priority || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Best Structure</span>
              <span style={styles.value}>{deal.best_structure_name || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Purchase Price</span>
              <span style={styles.value}>{formatCurrency(deal.purchase_price)}</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics Section */}
        <div style={{...styles.card, ...styles.lightCard}}>
          <h2 style={styles.sectionTitle}>Financial Metrics</h2>
          <div style={styles.grid}>
            <div style={styles.gridItem}>
              <span style={styles.label}>NOI</span>
              <span style={styles.value}>{formatCurrency(deal.noi)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Cap Rate</span>
              <span style={styles.value}>{formatPercent(deal.cap_rate)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>DSCR</span>
              <span style={styles.value}>{deal.dscr ? deal.dscr.toFixed(2) : '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Day 1 CF/Month</span>
              <span style={styles.value}>{formatCurrency(deal.day1_cf_per_month)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Stabilized CF/Month</span>
              <span style={styles.value}>{formatCurrency(deal.stabilized_cf_per_month)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Post-Refi CF/Month</span>
              <span style={styles.value}>{formatCurrency(deal.post_refi_cf_per_month)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Refi Value</span>
              <span style={styles.value}>{formatCurrency(deal.refi_value)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Cash Out at Refi</span>
              <span style={styles.value}>{formatCurrency(deal.cash_out_at_refi)}</span>
            </div>
          </div>
        </div>

        {/* Assumptions Section */}
        <div style={{...styles.card, ...styles.lightCard}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h2 style={{...styles.sectionTitle, marginBottom: 0}}>Underwriting Assumptions</h2>
            <button onClick={() => setEditMode(!editMode)} style={styles.button}>
              {editMode ? 'Cancel Edit' : 'Edit Assumptions'}
            </button>
          </div>

          {editMode ? (
            <form onSubmit={handleUpdate}>
              <div style={styles.grid}>
                {['purchase_price', 'down_payment_pct', 'interest_rate', 'ltv', 'amortization_years', 'io_period_months', 'rehab_per_unit', 'rent_bump_pct', 'vacancy_pct'].map(field => (
                  <div key={field} style={styles.formGroup}>
                    <label style={styles.label}>{field.replace(/_/g, ' ')}</label>
                    <input
                      type="number"
                      step={field.includes('pct') || field.includes('rate') ? '0.001' : field === 'purchase_price' || field === 'rehab_per_unit' ? '1000' : '1'}
                      name={field}
                      value={formData[field] || ''}
                      onChange={handleChange}
                      style={styles.input}
                    />
                  </div>
                ))}
              </div>
              <button type="submit" style={{...styles.button, marginTop: '20px'}}>Save & Recalculate</button>
            </form>
          ) : (
            <div style={styles.grid}>
              <div style={styles.gridItem}>
                <span style={styles.label}>Down Payment</span>
                <span style={styles.value}>{formatPercent(deal.down_payment_pct)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>Interest Rate</span>
                <span style={styles.value}>{formatPercent(deal.interest_rate)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>LTV</span>
                <span style={styles.value}>{formatPercent(deal.ltv)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>Amortization</span>
                <span style={styles.value}>{deal.amortization_years || '-'} years</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>IO Period</span>
                <span style={styles.value}>{deal.io_period_months || 0} months</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>Rehab Per Unit</span>
                <span style={styles.value}>{formatCurrency(deal.rehab_per_unit)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>Rent Bump</span>
                <span style={styles.value}>{formatPercent(deal.rent_bump_pct)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.label}>Vacancy</span>
                <span style={styles.value}>{formatPercent(deal.vacancy_pct)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Agent Info Section */}
        <div style={{...styles.card, ...styles.lightCard}}>
          <h2 style={styles.sectionTitle}>Agent Information</h2>
          <div style={styles.grid}>
            <div style={styles.gridItem}>
              <span style={styles.label}>Name</span>
              <span style={styles.value}>{deal.agent_name || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Phone</span>
              <span style={styles.value}>{deal.agent_phone || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Email</span>
              <span style={styles.value}>{deal.agent_email || '-'}</span>
            </div>
          </div>
        </div>

        {/* Pipeline Management Section */}
        <div style={{...styles.card, ...styles.lightCard}}>
          <h2 style={styles.sectionTitle}>Pipeline Management</h2>
          <div style={styles.grid}>
            <div style={styles.gridItem}>
              <span style={styles.label}>Max Price You Can Pay</span>
              <span style={styles.value}>{formatCurrency(deal.max_price_you_can_pay)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Offer Price</span>
              <span style={styles.value}>{formatCurrency(deal.offer_price)}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Next Action</span>
              <span style={styles.value}>{deal.next_action || '-'}</span>
            </div>
            <div style={styles.gridItem}>
              <span style={styles.label}>Next Action Due</span>
              <span style={styles.value}>{deal.next_action_due ? new Date(deal.next_action_due).toLocaleDateString() : '-'}</span>
            </div>
          </div>
          <div style={{marginTop: '20px'}}>
            <span style={styles.label}>Notes</span>
            <p style={{marginTop: '8px', whiteSpace: 'pre-wrap', color: '#1a1a1a'}}>{deal.notes || 'No notes yet.'}</p>
          </div>
        </div>

        {/* LLM Actions Section */}
        <div style={{...styles.card, ...styles.lightCard}}>
          <h2 style={styles.sectionTitle}>AI-Assisted Actions</h2>
          <p style={{marginBottom: '20px', color: '#888', fontSize: '14px'}}>
            These are stub endpoints that will be powered by LLM later.
          </p>
          <div style={styles.buttonContainer}>
            <button onClick={handleGeneratePitchDeck} style={styles.button}>Generate Pitch Deck</button>
            <button onClick={handleGenerateExecutionPlan} style={styles.button}>Generate Step-by-Step Plan</button>
            <button onClick={handleGenerateBrokerScript} style={styles.button}>Generate Broker Call Script</button>
          </div>
        </div>

        {/* Generated Content Display */}
        {generatedContent && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              {generatedContent.type === 'pitch-deck' && 'Generated Pitch Deck'}
              {generatedContent.type === 'execution-plan' && 'Generated Execution Plan'}
              {generatedContent.type === 'broker-script' && 'Generated Broker Script'}
            </h2>
            
            {generatedContent.type === 'pitch-deck' && (
              <div>
                {generatedContent.data.slides.map((slide) => (
                  <div key={slide.slide_number} style={styles.slideCard}>
                    <h3 style={styles.slideTitle}>Slide {slide.slide_number}: {slide.title}</h3>
                    <ul style={styles.slideContent}>
                      {slide.content.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {generatedContent.type === 'execution-plan' && (
              <div>
                {generatedContent.data.plan.map((item) => (
                  <div key={item.step} style={{marginBottom: '12px'}}>
                    <strong>Step {item.step}:</strong> {item.action}
                  </div>
                ))}
              </div>
            )}

            {generatedContent.type === 'broker-script' && (
              <pre style={styles.pre}>
                {generatedContent.data.script}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DealDetailPage;
