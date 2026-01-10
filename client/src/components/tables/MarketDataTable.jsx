import React, { useState } from 'react';
import { format } from 'd3-format';

const MarketDataTable = ({ data, columns }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const formatCurrency = format('$,.0f');
  const formatPercent = format('.1%');

  // Format cell value based on column type
  const formatValue = (value, type) => {
    if (value === null || value === undefined) return '—';
    
    switch (type) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return formatPercent(value / 100);
      case 'number':
        return value.toLocaleString();
      default:
        return value;
    }
  };

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' 
        ? aVal - bVal
        : bVal - aVal;
    });
  }, [data, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return ' ⇅';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div style={{ 
      width: '100%', 
      overflowX: 'auto', 
      marginBottom: '32px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px'
    }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: '14px',
        backgroundColor: 'white'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
            {columns.map((col, index) => (
              <th 
                key={index}
                onClick={() => handleSort(col.key)}
                style={{
                  padding: '12px 16px',
                  textAlign: col.align || 'left',
                  fontWeight: '600',
                  color: '#333',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#ebebeb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                {col.label}
                <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.6 }}>
                  {getSortIcon(col.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              style={{
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              {columns.map((col, colIndex) => (
                <td 
                  key={colIndex}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.align || 'left',
                    color: colIndex === 0 ? '#333' : '#666',
                    fontWeight: colIndex === 0 ? '600' : '400',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {formatValue(row[col.key], col.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MarketDataTable;
