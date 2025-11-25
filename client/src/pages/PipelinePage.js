import React from 'react';

// State management
let currentView = "pipeline";
let selectedDeal = null;

// Sample pipeline deals data
const pipelineDeals = [
  {
    deal_id: 1,
    property: "82 West Apartments",
    location: "Kansas City, MO",
    units_or_pads: "78 units",
    purchase_price: 6000000,
    day1_cf_per_month: 4500,
    stabilized_cf_per_month: 12000,
    refi_value: 7800000,
    cash_out_at_refi: 1200000,
    post_refi_cf_per_month: 8500,
    structure_type: "SELLER_CARRY_SECOND",
    structure_label: "75% bank + 25% seller carry",
    status: "OFFER_SENT",
    priority: "A",
    next_action: "Follow up on offer response",
    next_action_due: "2025-11-28",
    last_touch: "2025-11-22",
    agent_name: "Sarah Johnson",
    agent_phone: "(816) 555-0123",
    agent_email: "sjohnson@realty.com"
  },
  {
    deal_id: 2,
    property: "Sunset RV Resort",
    location: "Phoenix, AZ",
    units_or_pads: "120 pads",
    purchase_price: 8500000,
    day1_cf_per_month: 8200,
    stabilized_cf_per_month: 18000,
    refi_value: 11000000,
    cash_out_at_refi: 2100000,
    post_refi_cf_per_month: 14500,
    structure_type: "HYBRID_SUB2_SELLER",
    structure_label: "Sub2 + seller second",
    status: "UNDER_CONTRACT",
    priority: "A",
    next_action: "Send docs to title company",
    next_action_due: "2025-11-25",
    last_touch: "2025-11-23",
    agent_name: "Mike Peterson",
    agent_phone: "(602) 555-0456",
    agent_email: "mpeterson@coldwell.com"
  },
  {
    deal_id: 3,
    property: "Green Valley Mobile Home Park",
    location: "Austin, TX",
    units_or_pads: "60 pads + house",
    purchase_price: 3200000,
    day1_cf_per_month: 3800,
    stabilized_cf_per_month: 9500,
    refi_value: 4500000,
    cash_out_at_refi: 850000,
    post_refi_cf_per_month: 7200,
    structure_type: "EQUITY_5_25_SPLIT",
    structure_label: "5% in / 25% equity partner",
    status: "AGENT_CONTACTED",
    priority: "B",
    next_action: "Call agent for T-12",
    next_action_due: "2025-11-26",
    last_touch: "2025-11-20",
    agent_name: "Linda Martinez",
    agent_phone: "(512) 555-0789",
    agent_email: "lmartinez@kw.com"
  },
  {
    deal_id: 4,
    property: "Riverside Apartments",
    location: "Tampa, FL",
    units_or_pads: "45 units",
    purchase_price: 4100000,
    day1_cf_per_month: 2900,
    stabilized_cf_per_month: 8200,
    refi_value: 5200000,
    cash_out_at_refi: 750000,
    post_refi_cf_per_month: 6100,
    structure_type: "BANK_DEBT_ONLY",
    structure_label: "Traditional bank financing",
    status: "BANK_ENGAGED",
    priority: "A",
    next_action: "Prepare offer",
    next_action_due: "2025-11-27",
    last_touch: "2025-11-21",
    agent_name: "Robert Chen",
    agent_phone: "(813) 555-0321",
    agent_email: "rchen@remax.com"
  },
  {
    deal_id: 5,
    property: "Highland Park Estates",
    location: "Dallas, TX",
    units_or_pads: "92 units",
    purchase_price: 7200000,
    day1_cf_per_month: -1200,
    stabilized_cf_per_month: 15000,
    refi_value: 9500000,
    cash_out_at_refi: 1800000,
    post_refi_cf_per_month: 11000,
    structure_type: "SELLER_FINANCE",
    structure_label: "100% seller financing",
    status: "DEAD",
    priority: "C",
    next_action: "Archive deal",
    next_action_due: "2025-12-01",
    last_touch: "2025-11-15",
    agent_name: "Jennifer White",
    agent_phone: "(214) 555-0654",
    agent_email: "jwhite@century21.com"
  },
  {
    deal_id: 6,
    property: "Oak Creek Community",
    location: "Charlotte, NC",
    units_or_pads: "55 units",
    purchase_price: 4800000,
    day1_cf_per_month: 5200,
    stabilized_cf_per_month: 11500,
    refi_value: 6200000,
    cash_out_at_refi: 980000,
    post_refi_cf_per_month: 8900,
    structure_type: "JV_EQUITY",
    structure_label: "50/50 JV partnership",
    status: "NEW",
    priority: "B",
    next_action: "Initial property tour",
    next_action_due: "2025-11-29",
    last_touch: "2025-11-24",
    agent_name: "David Thompson",
    agent_phone: "(704) 555-0987",
    agent_email: "dthompson@era.com"
  }
];

function getLightColor(status) {
  const activeStatuses = ["NEW", "AGENT_CONTACTED", "OFFER_READY", "OFFER_SENT", "BANK_ENGAGED"];
  const successStatuses = ["UNDER_CONTRACT", "CLOSED"];
  
  if (activeStatuses.includes(status)) {
    return "#FFD700"; // Yellow/Gold
  } else if (successStatuses.includes(status)) {
    return "#4CAF50"; // Green
  } else {
    return "#9E9E9E"; // Gray
  }
}

function formatCurrency(value) {
  if (value == null) return '-';
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatStatusLabel(status) {
  return status.replace(/_/g, ' ');
}

function PipelinePage() {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    
    renderPipeline(containerRef.current);
  }, []);

  return React.createElement('div', { ref: containerRef });
}

function renderPipeline(root) {
  if (currentView === "dealDetail") {
    renderDealDetailPage(root, selectedDeal);
    return;
  }
  
  initPipelineUI(root);
}

function renderDealDetailPage(root, dealObj) {
  // Clear root
  root.innerHTML = '';
  
  // Main container
  const container = document.createElement('div');
  container.style.maxWidth = '1200px';
  container.style.margin = '0 auto';
  container.style.padding = '40px 20px';
  container.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  
  // Back button
  const backButton = document.createElement('button');
  backButton.textContent = '← Back to Pipeline';
  backButton.style.backgroundColor = '#ffffff';
  backButton.style.border = '1px solid #e0e0e0';
  backButton.style.borderRadius = '6px';
  backButton.style.padding = '10px 20px';
  backButton.style.fontSize = '14px';
  backButton.style.fontWeight = '500';
  backButton.style.color = '#1a1a1a';
  backButton.style.cursor = 'pointer';
  backButton.style.marginBottom = '24px';
  backButton.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  backButton.onmouseover = () => {
    backButton.style.backgroundColor = '#f5f5f5';
  };
  backButton.onmouseout = () => {
    backButton.style.backgroundColor = '#ffffff';
  };
  backButton.onclick = () => {
    currentView = "pipeline";
    selectedDeal = null;
    renderPipeline(root);
  };
  container.appendChild(backButton);
  
  // Title
  const title = document.createElement('h1');
  title.textContent = 'Deal Details';
  title.style.fontSize = '32px';
  title.style.fontWeight = '700';
  title.style.color = '#1a1a1a';
  title.style.marginBottom = '24px';
  container.appendChild(title);
  
  // Property info card
  const infoCard = document.createElement('div');
  infoCard.style.backgroundColor = '#ffffff';
  infoCard.style.border = '1px solid #e0e0e0';
  infoCard.style.borderRadius = '8px';
  infoCard.style.padding = '24px';
  infoCard.style.marginBottom = '32px';
  infoCard.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  
  const propertyName = document.createElement('h2');
  propertyName.textContent = dealObj.property;
  propertyName.style.fontSize = '24px';
  propertyName.style.fontWeight = '600';
  propertyName.style.color = '#1a1a1a';
  propertyName.style.marginBottom = '16px';
  infoCard.appendChild(propertyName);
  
  const infoGrid = document.createElement('div');
  infoGrid.style.display = 'grid';
  infoGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
  infoGrid.style.gap = '12px';
  
  const infoItems = [
    { label: 'Location', value: dealObj.location },
    { label: 'Units / Pads', value: dealObj.units_or_pads },
    { label: 'Purchase Price', value: formatCurrency(dealObj.purchase_price) },
    { label: 'Status', value: formatStatusLabel(dealObj.status) }
  ];
  
  infoItems.forEach(item => {
    const itemDiv = document.createElement('div');
    
    const label = document.createElement('div');
    label.textContent = item.label;
    label.style.fontSize = '12px';
    label.style.color = '#666';
    label.style.marginBottom = '4px';
    label.style.textTransform = 'uppercase';
    label.style.letterSpacing = '0.5px';
    itemDiv.appendChild(label);
    
    const value = document.createElement('div');
    value.textContent = item.value;
    value.style.fontSize = '16px';
    value.style.color = '#1a1a1a';
    value.style.fontWeight = '500';
    itemDiv.appendChild(value);
    
    infoGrid.appendChild(itemDiv);
  });
  
  infoCard.appendChild(infoGrid);
  container.appendChild(infoCard);
  
  // Placeholder message
  const placeholderBox = document.createElement('div');
  placeholderBox.style.backgroundColor = '#f8f8f8';
  placeholderBox.style.border = '1px solid #e0e0e0';
  placeholderBox.style.borderRadius = '8px';
  placeholderBox.style.padding = '48px';
  placeholderBox.style.textAlign = 'center';
  
  const placeholderText = document.createElement('p');
  placeholderText.textContent = 'Full underwriting details will be displayed here.';
  placeholderText.style.fontSize = '16px';
  placeholderText.style.color = '#666';
  placeholderText.style.margin = '0';
  placeholderBox.appendChild(placeholderText);
  
  container.appendChild(placeholderBox);
  root.appendChild(container);
}

function initPipelineUI(root) {
  // Clear root
  root.innerHTML = '';
  
  // Main container
  const container = document.createElement('div');
  container.style.maxWidth = '1600px';
  container.style.margin = '0 auto';
  container.style.padding = '40px 20px';
  container.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  
  // Title
  const title = document.createElement('h1');
  title.textContent = 'Approved Deals Pipeline';
  title.style.fontSize = '32px';
  title.style.fontWeight = '700';
  title.style.color = '#1a1a1a';
  title.style.marginBottom = '16px';
  container.appendChild(title);
  
  // Legend
  const legend = document.createElement('div');
  legend.style.display = 'flex';
  legend.style.gap = '24px';
  legend.style.marginBottom = '24px';
  legend.style.fontSize = '14px';
  legend.style.color = '#666';
  
  const yellowLegend = document.createElement('div');
  yellowLegend.style.display = 'flex';
  yellowLegend.style.alignItems = 'center';
  yellowLegend.style.gap = '8px';
  
  const yellowCircle = document.createElement('div');
  yellowCircle.style.width = '12px';
  yellowCircle.style.height = '12px';
  yellowCircle.style.borderRadius = '50%';
  yellowCircle.style.backgroundColor = '#FFD700';
  
  const yellowLabel = document.createElement('span');
  yellowLabel.textContent = 'Active (pre-contract)';
  
  yellowLegend.appendChild(yellowCircle);
  yellowLegend.appendChild(yellowLabel);
  
  const greenLegend = document.createElement('div');
  greenLegend.style.display = 'flex';
  greenLegend.style.alignItems = 'center';
  greenLegend.style.gap = '8px';
  
  const greenCircle = document.createElement('div');
  greenCircle.style.width = '12px';
  greenCircle.style.height = '12px';
  greenCircle.style.borderRadius = '50%';
  greenCircle.style.backgroundColor = '#4CAF50';
  
  const greenLabel = document.createElement('span');
  greenLabel.textContent = 'Under contract / Closed';
  
  greenLegend.appendChild(greenCircle);
  greenLegend.appendChild(greenLabel);
  
  const grayLegend = document.createElement('div');
  grayLegend.style.display = 'flex';
  grayLegend.style.alignItems = 'center';
  grayLegend.style.gap = '8px';
  
  const grayCircle = document.createElement('div');
  grayCircle.style.width = '12px';
  grayCircle.style.height = '12px';
  grayCircle.style.borderRadius = '50%';
  grayCircle.style.backgroundColor = '#9E9E9E';
  
  const grayLabel = document.createElement('span');
  grayLabel.textContent = 'Dead';
  
  grayLegend.appendChild(grayCircle);
  grayLegend.appendChild(grayLabel);
  
  legend.appendChild(yellowLegend);
  legend.appendChild(greenLegend);
  legend.appendChild(grayLegend);
  container.appendChild(legend);
  
  // Table wrapper
  const tableWrapper = document.createElement('div');
  tableWrapper.style.backgroundColor = '#ffffff';
  tableWrapper.style.border = '1px solid #e0e0e0';
  tableWrapper.style.borderRadius = '8px';
  tableWrapper.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  tableWrapper.style.overflowX = 'auto';
  
  // Table
  const table = document.createElement('div');
  table.style.display = 'table';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  
  // Header row
  const headerRow = document.createElement('div');
  headerRow.style.display = 'table-row';
  headerRow.style.backgroundColor = '#f8f8f8';
  
  const headers = [
    { text: '', width: '40px', align: 'center' }, // Light indicator
    { text: 'Property', width: '180px', align: 'left' },
    { text: 'Location', width: '150px', align: 'left' },
    { text: 'Units / Pads', width: '100px', align: 'left' },
    { text: 'Purchase Price', width: '130px', align: 'right' },
    { text: 'Day 1 CF / Month', width: '130px', align: 'right' },
    { text: 'Stabilized CF / Month', width: '150px', align: 'right' },
    { text: 'Refi Value', width: '130px', align: 'right' },
    { text: 'Cash Out at Refi', width: '130px', align: 'right' },
    { text: 'Post-Refi CF / Month', width: '150px', align: 'right' },
    { text: 'Structure Type', width: '180px', align: 'left' },
    { text: 'Status', width: '130px', align: 'left' },
    { text: 'Priority', width: '80px', align: 'center' },
    { text: 'Next Action', width: '180px', align: 'left' },
    { text: 'Next Due', width: '100px', align: 'left' },
    { text: 'Last Touch', width: '100px', align: 'left' },
    { text: 'Agent Name', width: '140px', align: 'left' },
    { text: 'Agent Phone', width: '120px', align: 'left' },
    { text: 'Agent Email', width: '180px', align: 'left' },
    { text: 'Actions', width: '200px', align: 'center' }
  ];
  
  headers.forEach(header => {
    const cell = createHeaderCell(header.text, header.width, header.align);
    headerRow.appendChild(cell);
  });
  
  table.appendChild(headerRow);
  
  // Data rows
  pipelineDeals.forEach((deal, index) => {
    const row = document.createElement('div');
    row.style.display = 'table-row';
    row.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
    row.style.cursor = 'pointer';
    
    // Hover effect for row
    row.onmouseenter = (e) => {
      const currentBg = row.style.backgroundColor;
      row.setAttribute('data-original-bg', currentBg);
      row.style.backgroundColor = '#e8f4f8';
    };
    row.onmouseleave = (e) => {
      const originalBg = row.getAttribute('data-original-bg');
      row.style.backgroundColor = originalBg || (index % 2 === 0 ? '#ffffff' : '#fafafa');
    };
    
    // Row click handler (navigate to detail page)
    row.onclick = (e) => {
      // Don't navigate if clicking action buttons
      if (e.target.classList.contains('action-button')) {
        return;
      }
      currentView = "dealDetail";
      selectedDeal = deal;
      renderPipeline(root);
    };
    
    // Light indicator
    const lightCell = createCell('', '40px', 'center');
    const lightIndicator = document.createElement('div');
    lightIndicator.style.width = '16px';
    lightIndicator.style.height = '16px';
    lightIndicator.style.borderRadius = '50%';
    lightIndicator.style.backgroundColor = getLightColor(deal.status);
    lightIndicator.style.margin = '0 auto';
    lightCell.appendChild(lightIndicator);
    row.appendChild(lightCell);
    
    // Property
    row.appendChild(createCell(deal.property, '180px', 'left'));
    
    // Location
    row.appendChild(createCell(deal.location, '150px', 'left'));
    
    // Units / Pads
    row.appendChild(createCell(deal.units_or_pads, '100px', 'left'));
    
    // Purchase Price
    row.appendChild(createCell(formatCurrency(deal.purchase_price), '130px', 'right'));
    
    // Day 1 CF / Month
    const day1CF = createCell(formatCurrency(deal.day1_cf_per_month), '130px', 'right');
    if (deal.day1_cf_per_month < 0) {
      day1CF.style.color = '#d32f2f';
    }
    row.appendChild(day1CF);
    
    // Stabilized CF / Month
    row.appendChild(createCell(formatCurrency(deal.stabilized_cf_per_month), '150px', 'right'));
    
    // Refi Value
    row.appendChild(createCell(formatCurrency(deal.refi_value), '130px', 'right'));
    
    // Cash Out at Refi
    row.appendChild(createCell(formatCurrency(deal.cash_out_at_refi), '130px', 'right'));
    
    // Post-Refi CF / Month
    row.appendChild(createCell(formatCurrency(deal.post_refi_cf_per_month), '150px', 'right'));
    
    // Structure Type
    row.appendChild(createCell(deal.structure_label, '180px', 'left'));
    
    // Status
    const statusCell = createCell(formatStatusLabel(deal.status), '130px', 'left');
    statusCell.style.fontWeight = '500';
    row.appendChild(statusCell);
    
    // Priority
    const priorityCell = createCell(deal.priority, '80px', 'center');
    priorityCell.style.fontWeight = '600';
    priorityCell.style.color = deal.priority === 'A' ? '#d32f2f' : deal.priority === 'B' ? '#f57c00' : '#666';
    row.appendChild(priorityCell);
    
    // Next Action
    row.appendChild(createCell(deal.next_action, '180px', 'left'));
    
    // Next Due
    row.appendChild(createCell(deal.next_action_due, '100px', 'left'));
    
    // Last Touch
    row.appendChild(createCell(deal.last_touch, '100px', 'left'));
    
    // Agent Name
    row.appendChild(createCell(deal.agent_name, '140px', 'left'));
    
    // Agent Phone
    row.appendChild(createCell(deal.agent_phone, '120px', 'left'));
    
    // Agent Email
    row.appendChild(createCell(deal.agent_email, '180px', 'left'));
    
    // Actions column with buttons
    const actionsCell = createCell('', '200px', 'center');
    actionsCell.style.padding = '8px';
    
    const actionsContainer = document.createElement('div');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = '8px';
    actionsContainer.style.justifyContent = 'center';
    actionsContainer.style.alignItems = 'center';
    
    // Summary button
    const summaryBtn = createActionButton('Summary', () => {
      console.log(`Clicked Summary for deal ${deal.deal_id}: ${deal.property}`);
    });
    actionsContainer.appendChild(summaryBtn);
    
    // LOI button
    const loiBtn = createActionButton('LOI', () => {
      console.log(`Clicked LOI for deal ${deal.deal_id}: ${deal.property}`);
    });
    actionsContainer.appendChild(loiBtn);
    
    // Deck button
    const deckBtn = createActionButton('Deck', () => {
      console.log(`Clicked Deck for deal ${deal.deal_id}: ${deal.property}`);
    });
    actionsContainer.appendChild(deckBtn);
    
    actionsCell.appendChild(actionsContainer);
    row.appendChild(actionsCell);
    
    table.appendChild(row);
  });
  
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);
  root.appendChild(container);
}

function createHeaderCell(text, width, align) {
  const cell = document.createElement('div');
  cell.style.display = 'table-cell';
  cell.style.padding = '12px 16px';
  cell.style.borderBottom = '2px solid #e0e0e0';
  cell.style.fontWeight = '600';
  cell.style.fontSize = '12px';
  cell.style.color = '#1a1a1a';
  cell.style.textTransform = 'uppercase';
  cell.style.letterSpacing = '0.5px';
  cell.style.textAlign = align;
  cell.style.width = width;
  cell.style.minWidth = width;
  cell.textContent = text;
  return cell;
}

function createCell(content, width, align) {
  const cell = document.createElement('div');
  cell.style.display = 'table-cell';
  cell.style.padding = '16px';
  cell.style.borderBottom = '1px solid #f0f0f0';
  cell.style.fontSize = '14px';
  cell.style.color = '#1a1a1a';
  cell.style.textAlign = align;
  cell.style.width = width;
  cell.style.minWidth = width;
  cell.style.verticalAlign = 'middle';
  
  if (typeof content === 'string') {
    cell.textContent = content;
  }
  
  return cell;
}

function createActionButton(label, onClick) {
  const btn = document.createElement('span');
  btn.textContent = label;
  btn.className = 'action-button';
  btn.style.padding = '6px 12px';
  btn.style.fontSize = '12px';
  btn.style.fontWeight = '500';
  btn.style.color = '#1a1a1a';
  btn.style.backgroundColor = '#f5f5f5';
  btn.style.border = '1px solid #e0e0e0';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.display = 'inline-block';
  btn.style.transition = 'all 0.2s';
  btn.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  
  btn.onmouseover = () => {
    btn.style.backgroundColor = '#e8e8e8';
    btn.style.borderColor = '#d0d0d0';
  };
  btn.onmouseout = () => {
    btn.style.backgroundColor = '#f5f5f5';
    btn.style.borderColor = '#e0e0e0';
  };
  
  btn.onclick = (e) => {
    e.stopPropagation(); // Prevent row click
    onClick();
  };
  
  return btn;
}

export default PipelinePage;
