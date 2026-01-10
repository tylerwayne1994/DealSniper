import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketBarChart, MetricsComparisonChart } from '../charts';
import { MarketMap } from '../maps';
import { MarketDataTable, PipelineTable } from '../tables';
import { format } from 'd3-format';
import { loadPipelineDeals, deleteDeal } from '../../lib/dealsService';

const MarketReportDisplay = ({ reportData }) => {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({});
  const [pipelineDeals, setPipelineDeals] = useState([]);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(true);
  
  const formatCurrency = format('$,.0f');
  const formatPercent = format('.1%');

  // Load pipeline deals when component mounts
  useEffect(() => {
    const loadDeals = async () => {
      setIsLoadingPipeline(true);
      try {
        const deals = await loadPipelineDeals();
        setPipelineDeals(deals);
      } catch (error) {
        console.error('Error loading pipeline deals:', error);
        setPipelineDeals([]);
      } finally {
        setIsLoadingPipeline(false);
      }
    };
    loadDeals();
  }, []);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleDeleteDeal = async (dealId) => {
    if (window.confirm('Are you sure you want to remove this deal from the pipeline?')) {
      try {
        await deleteDeal(dealId);
        setPipelineDeals(prev => prev.filter(d => d.dealId !== dealId));
      } catch (error) {
        console.error('Error deleting deal:', error);
        alert('Failed to delete deal: ' + error.message);
      }
    }
  };

  const handleViewDeal = (deal) => {
    if (deal.dealId.startsWith('sample-')) {
      const mockScenarioData = {
        property: {
          address: deal.address,
          units: deal.units,
          property_type: 'Multifamily',
          year_built: 1985,
          rba_sqft: deal.units * 850
        },
        pricing_financing: {
          price: deal.purchasePrice,
          purchase_price: deal.purchasePrice
        },
        financing: {
          ltv: 75,
          interest_rate: 6.5,
          loan_term_years: 10,
          amortization_years: 30,
          io_years: 0,
          loan_fees_percent: 1.5
        },
        pnl: {
          potential_gross_income: deal.units * 1200 * 12,
          vacancy_rate: 5,
          operating_expenses: deal.units * 400 * 12
        },
        unit_mix: [
          { unit_type: '2BR/1BA', units: deal.units, unit_sf: 850, rent_current: 1200 }
        ],
        broker: {
          name: deal.brokerName,
          phone: deal.brokerPhone,
          email: deal.brokerEmail
        }
      };
      
      navigate('/underwrite', {
        state: {
          dealId: deal.dealId,
          scenarioData: mockScenarioData,
          goToResults: true
        }
      });
    } else {
      navigate(`/underwrite?viewDeal=${deal.dealId}`);
    }
  };

  const handleGenerateLOI = (deal) => {
    navigate(`/loi?dealId=${deal.dealId}`);
  };

  const handleDueDiligence = (deal) => {
    navigate(`/due-diligence?dealId=${deal.dealId}`);
  };

  if (!reportData) {
    return null;
  }

  const { 
    title, 
    summary, 
    sections = [], 
    chartData = [], 
    mapData = {}, 
    tableData = {} 
  } = reportData;

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '1400px', 
      margin: '0 auto',
      padding: '24px',
      backgroundColor: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      {title && (
        <div style={{ 
          marginBottom: '32px',
          borderBottom: '2px solid #e0e0e0',
          paddingBottom: '16px'
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: '#1a1a1a',
            margin: '0 0 16px 0'
          }}>
            {title}
          </h1>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '12px',
            fontSize: '14px',
            color: '#666'
          }}>
            <span style={{
              backgroundColor: '#f0f0f0',
              padding: '4px 12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {reportData.region || 'Regional Analysis'}
            </span>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div style={{ 
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '32px',
          borderLeft: '4px solid #D4AF37'
        }}>
          <p style={{ 
            margin: 0, 
            lineHeight: '1.6',
            color: '#333',
            fontSize: '15px'
          }}>
            {summary}
          </p>
        </div>
      )}

      {/* Map Section */}
      {mapData && mapData.markets && mapData.markets.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: '#1a1a1a',
              margin: 0
            }}>
              Top rental markets
            </h2>
            <button
              onClick={() => toggleSection('map')}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px 8px'
              }}
            >
              {expandedSections['map'] === false ? 'Show map' : 'Hide outline'}
            </button>
          </div>
          {expandedSections['map'] !== false && (
            <MarketMap 
              markets={mapData.markets}
              highlightedZipCodes={mapData.highlightedZipCodes || []}
              center={mapData.center}
              zoom={mapData.zoom}
            />
          )}
        </div>
      )}

      {/* Pipeline Deals Section */}
      {!isLoadingPipeline && pipelineDeals && pipelineDeals.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1a1a1a',
            marginBottom: '16px'
          }}>
            Your Pipeline Deals
          </h2>
          <PipelineTable
            deals={pipelineDeals}
            onViewDeal={handleViewDeal}
            onGenerateLOI={handleGenerateLOI}
            onDueDiligence={handleDueDiligence}
            onDeleteDeal={handleDeleteDeal}
            showPitchComingSoon={false}
          />
        </div>
      )}

      {/* Charts Section */}
      {chartData && chartData.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1a1a1a',
            marginBottom: '24px'
          }}>
            Key rental metrics across top markets
          </h2>
          
          {chartData.map((chart, index) => (
            <div key={index} style={{ marginBottom: '32px' }}>
              {chart.type === 'bar' && (
                <MarketBarChart
                  data={chart.data}
                  dataKey={chart.dataKey}
                  title={chart.title}
                  valueFormatter={chart.format === 'currency' ? formatCurrency : chart.format === 'percent' ? formatPercent : (val) => val}
                  barColor={chart.color || '#D4AF37'}
                />
              )}
              {chart.type === 'comparison' && (
                <MetricsComparisonChart
                  data={chart.data}
                  metrics={chart.metrics}
                  title={chart.title}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table Section */}
      {tableData && tableData.data && tableData.data.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1a1a1a',
            marginBottom: '16px'
          }}>
            {tableData.title || 'Market comparison'}
          </h2>
          <MarketDataTable 
            data={tableData.data}
            columns={tableData.columns || [
              { key: 'market', label: 'Market', type: 'text', align: 'left' },
              { key: 'rent', label: 'In-place rent', type: 'currency', align: 'right' },
              { key: 'occupancy', label: 'Occupancy', type: 'percent', align: 'right' },
              { key: 'tradeout', label: 'Tradeout', type: 'percent', align: 'right' },
              { key: 'fico', label: 'FICO score', type: 'number', align: 'right' },
              { key: 'income', label: 'Income median', type: 'currency', align: 'right' },
              { key: 'jobGrowth', label: 'Job growth', type: 'percent', align: 'right' }
            ]}
          />
        </div>
      )}

      {/* Content Sections */}
      {sections && sections.length > 0 && sections.map((section, index) => (
        <div key={index} style={{ marginBottom: '40px' }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#1a1a1a',
            marginBottom: '16px'
          }}>
            {section.title}
          </h2>
          {section.content && section.content.split('\n\n').map((paragraph, pIndex) => (
            <p key={pIndex} style={{ 
              margin: '0 0 16px 0',
              lineHeight: '1.7',
              color: '#444',
              fontSize: '15px'
            }}>
              {paragraph}
            </p>
          ))}
        </div>
      ))}

      {/* Footer Note */}
      <div style={{
        marginTop: '48px',
        paddingTop: '24px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '13px',
        color: '#888',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0 }}>
          Market analysis report generated by DealSniper • Data sources: US Census Bureau, Fair Market Rents, Cushman & Wakefield
        </p>
      </div>
    </div>
  );
};

export default MarketReportDisplay;
