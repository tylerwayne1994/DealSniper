import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'd3-format';

const MarketBarChart = ({ data, dataKey, title, valueFormatter = (val) => val, barColor = '#D4AF37' }) => {
  // Color schemes based on chart type
  const getColorScheme = () => {
    if (title?.toLowerCase().includes('occupancy')) {
      return {
        gradient: ['#10b981', '#059669'],
        shadow: 'rgba(16, 185, 129, 0.3)',
        glow: 'rgba(16, 185, 129, 0.2)'
      };
    } else if (title?.toLowerCase().includes('rent growth')) {
      return {
        gradient: ['#f59e0b', '#d97706'],
        shadow: 'rgba(245, 158, 11, 0.3)',
        glow: 'rgba(245, 158, 11, 0.2)'
      };
    } else if (title?.toLowerCase().includes('cap rate')) {
      return {
        gradient: ['#3b82f6', '#2563eb'],
        shadow: 'rgba(59, 130, 246, 0.3)',
        glow: 'rgba(59, 130, 246, 0.2)'
      };
    }
    return {
      gradient: ['#8b5cf6', '#7c3aed'],
      shadow: 'rgba(139, 92, 246, 0.3)',
      glow: 'rgba(139, 92, 246, 0.2)'
    };
  };

  const colors = getColorScheme();
  
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const formattedValue = valueFormatter(value);
      
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          padding: '16px',
          border: 'none',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ margin: 0, fontWeight: '700', color: '#1f2937', fontSize: '15px' }}>
            {payload[0].payload.market || payload[0].payload.name}
          </p>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            <strong style={{ color: colors.gradient[0], fontSize: '18px' }}>{formattedValue}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ 
      width: '100%', 
      marginBottom: '32px',
      padding: '24px',
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
      border: '1px solid rgba(0,0,0,0.05)'
    }}>
      {title && (
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '700', 
          marginBottom: '20px', 
          color: '#111827',
          letterSpacing: '-0.01em'
        }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.gradient[0]} stopOpacity={1}/>
              <stop offset="100%" stopColor={colors.gradient[1]} stopOpacity={0.85}/>
            </linearGradient>
            <filter id={`shadow-${dataKey}`} height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="0" dy="4" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#e5e7eb" 
            strokeWidth={1}
            vertical={false}
          />
          <XAxis 
            dataKey="market" 
            angle={-35}
            textAnchor="end"
            height={90}
            tick={{ 
              fontSize: 13, 
              fill: '#6b7280',
              fontWeight: '500'
            }}
            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            tickLine={false}
          />
          <YAxis 
            tickFormatter={valueFormatter}
            tick={{ 
              fontSize: 13, 
              fill: '#6b7280',
              fontWeight: '500'
            }}
            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            tickLine={false}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: colors.glow, radius: 8 }}
          />
          <Bar 
            dataKey={dataKey} 
            radius={[8, 8, 0, 0]}
            fill={`url(#gradient-${dataKey})`}
            filter={`url(#shadow-${dataKey})`}
            maxBarSize={60}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#gradient-${dataKey})`}
                style={{ 
                  filter: `drop-shadow(0 4px 8px ${colors.shadow})`,
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MarketBarChart;
