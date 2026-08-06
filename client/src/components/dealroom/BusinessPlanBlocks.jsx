import React from 'react';

/**
 * Renders the structured Business Plan JSON (see backend's
 * BUSINESS_PLAN_TOOL_SCHEMA / submit_business_plan tool in claude_chat.py)
 * into real UI elements -- tables, paragraphs, lists -- instead of parsing
 * AI-generated markdown text. This replaced a ReactMarkdown-based approach
 * that was fragile (Claude not always closing its code fence correctly,
 * trailing commentary, truncation before the closing fence, etc.).
 *
 * Used both by the live Deal Room section (InvestorDealRoom.jsx) and the
 * off-screen PDF snapshot (DealRoomPage.jsx) so both stay in sync from a
 * single source of truth.
 *
 * @param {Object} props
 * @param {Object} props.plan  { title, offeringHighlights, investmentThesis, sections }
 * @param {'live'|'pdf'} [props.variant]
 */
export default function BusinessPlanBlocks({ plan, variant = 'live' }) {
  if (!plan) return null;
  const isPdf = variant === 'pdf';

  const headingColor = isPdf ? '#1F4E79' : 'var(--dr-accent)';
  const subheadingColor = isPdf ? '#2E75B6' : undefined;
  const tableClassName = isPdf ? undefined : 'dr-table';
  const tableStyle = isPdf
    ? { width: '100%', borderCollapse: 'collapse', margin: '10px 0 16px', fontSize: 13 }
    : { margin: '10px 0 18px' };
  const thStyle = isPdf ? { background: '#1F4E79', color: '#fff', padding: '6px 10px', textAlign: 'left', border: '1px solid #d1d5db' } : undefined;
  const tdStyle = isPdf ? { padding: '6px 10px', border: '1px solid #d1d5db' } : undefined;

  const renderTable = (block, key) => {
    if (!block.rows?.length && !block.columns?.length) return null;
    return (
      <table key={key} className={tableClassName} style={tableStyle}>
        {block.columns?.length > 0 && (
          <thead>
            <tr>{block.columns.map((c, i) => <th key={i} style={thStyle}>{c}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {(block.rows || []).map((row, ri) => (
            <tr key={ri}>{(row || []).map((cell, ci) => <td key={ci} style={tdStyle}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderBlock = (block, key) => {
    switch (block.type) {
      case 'subheading':
        return block.text ? (
          <h4 key={key} style={{ fontSize: isPdf ? 15 : 15, fontWeight: 700, margin: '16px 0 8px', color: subheadingColor }}>
            {block.text}
          </h4>
        ) : null;
      case 'table':
        return renderTable(block, key);
      case 'list':
      case 'checklist':
        return (block.items?.length > 0) ? (
          <ul key={key} style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            {block.items.map((item, i) => <li key={i} style={{ fontSize: 14, marginBottom: 4, lineHeight: 1.6 }}>{item}</li>)}
          </ul>
        ) : null;
      case 'paragraph':
      default:
        return block.text ? (
          <p key={key} style={{ fontSize: 14, lineHeight: 1.7, margin: '0 0 10px' }}>{block.text}</p>
        ) : null;
    }
  };

  return (
    <div>
      {plan.offeringHighlights?.length > 0 && (
        <table className={tableClassName} style={{ ...tableStyle, margin: '0 0 16px' }}>
          <tbody>
            {plan.offeringHighlights.map((row, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{row.label}</td>
                <td style={tdStyle}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {plan.investmentThesis && (
        <p style={{ fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 20px' }}>
          <strong>Investment Thesis: </strong>{plan.investmentThesis}
        </p>
      )}
      {(plan.sections || []).map((section, si) => (
        <div key={si} style={{ marginTop: si ? 24 : 0 }}>
          {section.heading && (
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '20px 0 10px', color: headingColor }}>
              {section.heading}
            </h3>
          )}
          {(section.blocks || []).map((block, bi) => renderBlock(block, `${si}-${bi}`))}
        </div>
      ))}
    </div>
  );
}
