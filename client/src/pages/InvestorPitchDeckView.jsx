// Public, read-only investor pitch-deck view. Reached only via a valid
// access code (either typed on /investor, or via a direct
// /investor/view/:code link). Renders ONLY the InvestorDealRoom document —
// no sidebar, no nav, no other tabs, no editing. This is the entire
// experience an investor gets.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { redeemInvestorAccessCode } from '../lib/investorAccessService';
import { mapDealRow } from '../lib/dealsService';
import { computeDealMetrics, normalizeDealImages } from '../lib/dealMetrics';
import { buildDealRoomData } from '../lib/dealRoomData';
import InvestorDealRoom from '../components/dealroom/InvestorDealRoom';

export default function InvestorPitchDeckView() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, viewModel: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await redeemInvestorAccessCode(code);
        if (cancelled) return;

        const deal = mapDealRow(res.deal);
        const metrics = computeDealMetrics(deal);
        const normalizedImages = normalizeDealImages(deal);
        const data = buildDealRoomData({
          deal,
          full: metrics._full,
          metrics,
          allocations: res.allocations || [],
          distributions: res.distributions || [],
          images: normalizedImages.map((img) => ({ url: img.url })),
          narrative: deal?.parsedData?.dealRoomNarrative || null,
        });

        setState({
          loading: false,
          error: null,
          viewModel: {
            data,
            full: metrics._full,
            metrics,
            scenarioData: deal?.scenarioData || deal?.parsedData,
            documents: res.documents || [],
            closeDate: deal?.parsedData?.dealRoomCloseDate || null,
          },
        });
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, error: e.message || 'This access code is not valid.', viewModel: null });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (state.loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: '#6b7280', fontSize: 14,
      }}>
        Loading pitch deck…
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            This link isn&rsquo;t working
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
            {state.error}
          </div>
          <button
            onClick={() => navigate('/investor')}
            style={{
              padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Enter a different code
          </button>
        </div>
      </div>
    );
  }

  const { data, full, metrics, scenarioData, documents, closeDate } = state.viewModel;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f6f7fb', padding: '24px 16px' }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', backgroundColor: '#fff',
        borderRadius: 12, border: '1px solid #e6e9ef', overflow: 'hidden',
      }}>
        <InvestorDealRoom
          data={data}
          full={full}
          metrics={metrics}
          scenarioData={scenarioData}
          documents={documents}
          closeDate={closeDate}
          readOnly
        />
      </div>
    </div>
  );
}
