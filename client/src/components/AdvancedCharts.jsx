// Advanced Chart Components for V2 Results
import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, 
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#6b7280'
};

// Amortization Schedule Chart
export const AmortizationChart = ({ data }) => {
  if (!data || data.length === 0) return <div style={{ padding: '20px', color: '#6b7280' }}>No amortization data available</div>;

  return (
    <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" stroke="#6b7280" />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
          <Bar dataKey="principal" fill={COLORS.success} name="Principal" stackId="a" />
          <Bar dataKey="interest" fill={COLORS.danger} name="Interest" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Loan Balance Over Time
export const LoanBalanceChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" stroke="#6b7280" />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Area type="monotone" dataKey="balance" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorBalance)" name="Loan Balance" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Sensitivity Heatmap Table
export const SensitivityTable = ({ data, title, columns }) => {
  if (!data || data.length === 0) return null;

  const getColor = (irr) => {
    if (irr >= 20) return '#10b981';
    if (irr >= 15) return '#34d399';
    if (irr >= 10) return '#fbbf24';
    if (irr >= 5) return '#fb923c';
    return '#ef4444';
  };

  return (
    <div style={{ marginBottom: '30px' }}>
      <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>{title}</h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {columns.map((col, idx) => (
                <th key={idx} style={{ padding: '10px', textAlign: idx === 0 ? 'left' : 'right', fontWeight: '600', color: '#374151' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                {Object.values(row).map((val, cellIdx) => {
                  const isIRR = columns[cellIdx]?.includes('IRR') || columns[cellIdx]?.includes('Return');
                  const displayVal = cellIdx === 0 
                    ? (typeof val === 'number' ? `$${val.toLocaleString()}` : val)
                    : (typeof val === 'number' ? (isIRR ? `${val.toFixed(2)}%` : val.toFixed(2)) : val);
                  
                  return (
                    <td 
                      key={cellIdx} 
                      style={{ 
                        padding: '10px', 
                        textAlign: cellIdx === 0 ? 'left' : 'right',
                        backgroundColor: isIRR && typeof val === 'number' ? `${getColor(val)}15` : 'transparent',
                        fontWeight: isIRR ? '600' : 'normal'
                      }}
                    >
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Monthly Cash Flow Chart
export const MonthlyCashFlowChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
          <Line type="monotone" dataKey="income" stroke={COLORS.success} strokeWidth={2} name="Income" />
          <Line type="monotone" dataKey="expenses" stroke={COLORS.danger} strokeWidth={2} name="Expenses" />
          <Line type="monotone" dataKey="noi" stroke={COLORS.primary} strokeWidth={3} name="NOI" />
          <Line type="monotone" dataKey="cashFlow" stroke={COLORS.purple} strokeWidth={2} name="Cash Flow" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Occupancy Ramp Chart
export const OccupancyRampChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} domain={[0, 1]} />
          <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
          <Area type="monotone" dataKey="occupancy" stroke={COLORS.success} fillOpacity={1} fill="url(#colorOccupancy)" name="Occupancy %" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Exit Scenarios Chart
export const ExitScenariosChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="exitYear" stroke="#6b7280" label={{ value: 'Exit Year', position: 'insideBottom', offset: -5 }} />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `${value.toFixed(0)}%`} />
          <Tooltip formatter={(value, name) => {
            if (name === 'IRR') return `${value.toFixed(2)}%`;
            if (name === 'Equity Multiple') return `${value.toFixed(2)}x`;
            return value;
          }} />
          <Legend />
          <Bar dataKey="irr" fill={COLORS.primary} name="IRR (%)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Waterfall Distribution Pie Chart
export const WaterfallPieChart = ({ waterfallData }) => {
  if (!waterfallData) return null;

  const data = [
    { name: 'LP Distribution', value: waterfallData.lp.total },
    { name: 'GP Distribution', value: waterfallData.gp.total }
  ];

  const WATERFALL_COLORS = [COLORS.primary, COLORS.success];

  return (
    <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={WATERFALL_COLORS[index % WATERFALL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Tax Impact Chart
export const TaxImpactChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: '400px', minHeight: '400px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" stroke="#6b7280" />
          <YAxis stroke="#6b7280" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          <Legend />
          <Bar dataKey="preTaxCashFlow" fill={COLORS.primary} name="Pre-Tax Cash Flow" />
          <Bar dataKey="afterTaxCashFlow" fill={COLORS.success} name="After-Tax Cash Flow" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Projections Table
export const ProjectionsTable = ({ projections }) => {
  if (!projections || projections.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#374151', position: 'sticky', left: 0, backgroundColor: '#f9fafb' }}>Year</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>PGI</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Vacancy</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>EGI</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>OpEx</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>NOI</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>CapEx</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Debt Service</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Cash Flow</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>DSCR</th>
          </tr>
        </thead>
        <tbody>
          {projections.slice(0, 10).map((proj, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
              <td style={{ padding: '10px', fontWeight: '600', position: 'sticky', left: 0, backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>{proj.year}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>${(proj.potentialGrossIncome || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right', color: COLORS.danger }}>-${(proj.vacancyLoss || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>${(proj.effectiveGrossIncome || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right', color: COLORS.danger }}>-${(proj.operatingExpenses || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: COLORS.success }}>${(proj.noi || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right', color: COLORS.warning }}>-${(proj.totalCapEx || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right', color: COLORS.danger }}>-${(proj.debtService || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: COLORS.primary }}>${(proj.cashFlowAfterFinancing || 0).toLocaleString()}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{(proj.dscr || 0).toFixed(2)}x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const chartComponents = {
  AmortizationChart,
  LoanBalanceChart,
  SensitivityTable,
  MonthlyCashFlowChart,
  OccupancyRampChart,
  ExitScenariosChart,
  WaterfallPieChart,
  TaxImpactChart,
  ProjectionsTable
};

export default chartComponents;
