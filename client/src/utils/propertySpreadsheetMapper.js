/**
 * Maps parsed data from OM/T12/Rent Estoppel/P&L to PropertySpreadsheet format
 * PRODUCTION-READY: Handles all edge cases with intelligent defaults
 */

export function mapParsedDataToSpreadsheet(parsedData) {
  if (!parsedData) return null;

  const mapped = {};

  // ============================================================================
  // STEP 1: Extract core financial data with fallbacks
  // ============================================================================
  const pnl = parsedData.pnl || {};
  const property = parsedData.property || {};
  const pricing = parsedData.pricing_financing || {};
  const financing = parsedData.financing || {};
  const expenses = parsedData.expenses || {};
  
  // Get NOI - prioritize proforma, then T12, then calculated
  const noi = pnl.noi_proforma || pnl.noi_t12 || pnl.noi || 0;
  
  // ============================================================================
  // STEP 2: Calculate or get purchase price
  // ============================================================================
  let purchasePrice = property.purchase_price || property.asking_price || pricing.price || 0;
  
  // If no purchase price but we have NOI, estimate using cap rate
  if ((!purchasePrice || purchasePrice === 0) && noi > 0) {
    const capRate = pnl.cap_rate_proforma || pnl.cap_rate_t12 || pnl.cap_rate || 0.06;
    purchasePrice = Math.round(noi / capRate);
    console.log(`[MAPPER] Auto-calculated purchase price: $${purchasePrice.toLocaleString()} from NOI $${noi.toLocaleString()} at ${(capRate * 100).toFixed(1)}% cap`);
  }
  
  // ============================================================================
  // STEP 3: Calculate financing structure
  // ============================================================================
  const ltv = financing.ltv || pricing.ltv || 75; // Default 75%
  const interestRate = financing.interest_rate || pricing.interest_rate || 6; // Default 6%
  const termYears = financing.loan_term_years || pricing.term_years || 10; // Default 10 years
  const amortYears = financing.amortization_years || 30; // Default 30 years
  
  // Calculate loan amount
  let loanAmount = financing.loan_amount || pricing.loan_amount || 0;
  if ((!loanAmount || loanAmount === 0) && purchasePrice > 0) {
    loanAmount = Math.round(purchasePrice * (ltv / 100));
    console.log(`[MAPPER] Auto-calculated loan: $${loanAmount.toLocaleString()} (${ltv}% of $${purchasePrice.toLocaleString()})`);
  }
  
  // Calculate equity
  const totalEquity = purchasePrice - loanAmount;
  const lpEquity = Math.round(totalEquity * 0.9); // 90%
  const gpEquity = Math.round(totalEquity * 0.1); // 10%
  
  // ============================================================================
  // STEP 4: Calculate acquisition costs
  // ============================================================================
  const closingCosts = Math.round(purchasePrice * 0.025); // 2.5%
  const dueDiligence = Math.round(purchasePrice * 0.005); // 0.5%
  const financingCosts = Math.round(loanAmount * 0.015); // 1.5%
  const operatingReserves = purchasePrice > 0 ? 50000 : 0; // $50k default
  const capexBudgetYear1 = 0; // Usually specified separately

  // Map SOURCES and USES so downstream IRR/sensitivity calculations have
  // a real capital stack to work from.
  mapped.sources = {
    seniorDebt: loanAmount,
    mezDebt: 0,
    preferredEquity: 0,
    lpEquity,
    gpEquity,
  };

  mapped.uses = {
    purchasePrice,
    closingCosts,
    dueDiligence,
    immediateCapex: capexBudgetYear1,
    financingFees: financingCosts,
    operatingReserves,
    other: 0,
  };
  
  // ============================================================================
  // STEP 5: Map property info
  // ============================================================================
  mapped.propertyName = property.name || property.address || '';
  mapped.units = property.units || property.unit_count || 0;
  mapped.squareFeet = property.square_feet || property.rba_sqft || property.total_sq_ft || 0;
  mapped.purchasePrice = purchasePrice;
  mapped.stabilizedNOI = pnl.noi_stabilized || 0;
  mapped.proFormaNOI = pnl.noi_proforma || pnl.noi || 0;
  mapped.city = property.city || '';
  mapped.state = property.state || '';
  mapped.zip = property.zip || property.zipcode || '';
  mapped.landAreaAcres = property.land_area_acres || 0;
  mapped.parkingSpaces = property.parking_spaces || 0;
  mapped.yearBuilt = property.year_built || '';
  mapped.propertyType = property.property_type || '';
  mapped.propertyClass = property.property_class || '';
  
  // ============================================================================
  // STEP 6: Map acquisition assumptions
  // ============================================================================
  mapped.acquisition = {
    acquisitionDate: (parsedData.acquisition || {}).date || '',
    holdPeriod: (parsedData.acquisition || {}).hold_period || parsedData.underwriting?.holding_period || 5,
    yearBuilt: property.year_built || '',
    closingCosts: closingCosts,
    dueDiligence: dueDiligence,
    capexBudgetYear1: capexBudgetYear1,
    financingCosts: financingCosts,
    operatingReserves: operatingReserves,
  };
  
  // ============================================================================
  // STEP 7: Map growth assumptions with proper decimal handling
  // ============================================================================
  const toDecimal = (value, defaultValue) => {
    if (!value && value !== 0) return defaultValue / 100;
    return value > 1 ? value / 100 : value;
  };
  
  const growth = parsedData.assumptions || parsedData.growth || {};
  mapped.growth = {
    annualRentGrowth: toDecimal(growth.rent_growth_rate || growth.annual_rent_growth, 3),
    annualExpenseGrowth: toDecimal(growth.expense_growth_rate || growth.annual_expense_growth, 3),
    vacancyRate: toDecimal(growth.vacancy_rate || pnl.vacancy_rate || pnl.vacancy_rate_stabilized, 5),
    badDebtRate: toDecimal(growth.bad_debt_rate, 2),
    concessions: growth.concessions || 0,
    managementFeePercent: toDecimal(growth.management_fee_percent || growth.management_fee, 3),
    exitCapRate5Yr: toDecimal(growth.exit_cap_rate_5yr || growth.exit_cap_rate || parsedData.underwriting?.exit_cap_rate, 6),
    exitCapRate10Yr: toDecimal(growth.exit_cap_rate_10yr || growth.exit_cap_rate || parsedData.underwriting?.exit_cap_rate, 6),
  };

  
  // ============================================================================
  // STEP 8: Map sale assumptions
  // ============================================================================
  const sale = parsedData.sale || parsedData.assumptions || {};
  mapped.sale = {
    sellingCostsPercent: toDecimal(sale.selling_costs_percent || sale.selling_costs, 2),
    capexReservePerUnitPerYear: sale.capex_reserve_per_unit || 300,
    renovatedUnitPremium: sale.renovated_premium || 0,
    classicRentAvg: sale.classic_rent || 0,
    renovatedRentAvg: sale.renovated_rent || 0,
  };

  // ============================================================================
  // STEP 9: Map rent roll / unit mix
  // ============================================================================
  if (parsedData.rent_roll && Array.isArray(parsedData.rent_roll)) {
    mapped.rentRoll = parsedData.rent_roll.slice(0, 10).map((unit, i) => ({
      id: i + 1,
      unitNumber: unit.unit_number || unit.unit || `Unit ${i + 1}`,
      type: unit.unit_type || unit.type || (unit.bedrooms ? `${unit.bedrooms}BR/${unit.bathrooms}BA` : ''),
      sf: unit.square_feet || unit.sf || unit.unit_sf || 0,
      status: unit.status || unit.occupancy_status || 'Occupied',
      marketRent: unit.market_rent || unit.rent_market || unit.projected_rent || 0,
      inPlaceRent: unit.current_rent || unit.rent_current || unit.actual_rent || unit.market_rent || 0,
      leaseStart: unit.lease_start || unit.move_in_date || '',
      leaseEnd: unit.lease_end || unit.lease_expiration || '',
      tenantName: unit.tenant_name || unit.tenant || ''
    }));

    while (mapped.rentRoll.length < 10) {
      mapped.rentRoll.push({
        id: mapped.rentRoll.length + 1,
        unitNumber: '', type: '', sf: 0, status: '',
        marketRent: 0, inPlaceRent: 0, leaseStart: '', leaseEnd: '', tenantName: ''
      });
    }
  } else if (parsedData.unit_mix && Array.isArray(parsedData.unit_mix)) {
    // Create synthetic rent roll from unit mix
    mapped.rentRoll = [];
    let unitCounter = 1;
    
    parsedData.unit_mix.forEach(mix => {
      const unitCount = mix.units || 0;
      for (let i = 0; i < unitCount && mapped.rentRoll.length < 10; i++) {
        const marketRent = mix.rent_market || mix.rent_current || 0;
        const inPlaceRent = mix.rent_current || 0;
        
        mapped.rentRoll.push({
          id: unitCounter,
          unitNumber: `${unitCounter}`,
          type: mix.type || '',
          sf: mix.unit_sf || 0,
          status: 'Occupied',
          marketRent: marketRent,
          inPlaceRent: inPlaceRent,
          leaseStart: '', leaseEnd: '', tenantName: ''
        });
        unitCounter++;
      }
    });
    
    while (mapped.rentRoll.length < 10) {
      mapped.rentRoll.push({
        id: mapped.rentRoll.length + 1,
        unitNumber: '', type: '', sf: 0, status: '',
        marketRent: 0, inPlaceRent: 0, leaseStart: '', leaseEnd: '', tenantName: ''
      });
    }
  }

  // ============================================================================
  // STEP 10: Map other income
  // ============================================================================
  const income = parsedData.other_income || parsedData.income || {};
  mapped.otherIncome = {
    laundry: income.laundry || income.laundry_income || 0,
    parking: income.parking || income.parking_income || 0,
    petFees: income.pet_fees || income.pet_rent || 0,
    applicationFees: income.application_fees || 0,
    lateFees: income.late_fees || 0,
    storage: income.storage || income.storage_income || 0,
    other: income.other || income.miscellaneous || pnl.other_income || 0,
  };

  // ============================================================================
  // STEP 11: Map operating expenses
  // ============================================================================
  mapped.expenses = {
    realEstateTaxes: expenses.real_estate_taxes || expenses.property_taxes || expenses.taxes || 0,
    propertyInsurance: expenses.property_insurance || expenses.insurance || 0,
    waterSewer: expenses.water_sewer || expenses.water || expenses.utilities?.water || expenses.utilities || 0,
    electric: expenses.electric || expenses.electricity || expenses.utilities?.electric || 0,
    gas: expenses.gas || expenses.utilities?.gas || 0,
    trashRemoval: expenses.trash_removal || expenses.trash || expenses.waste || 0,
    repairsMaintenance: expenses.repairs_maintenance || expenses.repairs || expenses.maintenance || 0,
    landscaping: expenses.landscaping || expenses.grounds || 0,
    pestControl: expenses.pest_control || expenses.pest || 0,
    snowRemoval: expenses.snow_removal || expenses.snow || 0,
    unitTurnover: expenses.unit_turnover || expenses.turnover || 0,
    onSitePayroll: expenses.on_site_payroll || expenses.payroll || expenses.management?.payroll || 0,
    marketing: expenses.marketing || expenses.advertising || 0,
    legalProfessional: expenses.legal_professional || expenses.legal || expenses.professional_fees || 0,
    accounting: expenses.accounting || expenses.bookkeeping || 0,
    administrative: expenses.administrative || expenses.admin || 0,
    security: expenses.security || 0,
    cableInternet: expenses.cable_internet || expenses.cable || expenses.internet || 0,
    elevatorMaintenance: expenses.elevator_maintenance || expenses.elevator || 0,
    poolMaintenance: expenses.pool_maintenance || expenses.pool || 0,
  };


  // ============================================================================
  // STEP 12: Map financing structure with auto-calculations
  // ============================================================================
  mapped.financing = {
    subjectTo: {
      balance: financing.existing_loan_balance || financing.subject_to_balance || 0,
      interestRate: financing.existing_interest_rate ? financing.existing_interest_rate / 100 : 0,
      remainingTermMonths: financing.remaining_term_months || financing.subject_to_term || 0,
    },
    sellerFinancing: {
      loanAmount: financing.seller_financing_amount || financing.seller_loan || 0,
      interestRate: financing.seller_financing_rate ? financing.seller_financing_rate / 100 : 0,
      termMonths: financing.seller_financing_term ? financing.seller_financing_term * 12 : 0,
      amortizationMonths: financing.seller_amortization ? financing.seller_amortization * 12 : (amortYears * 12),
      interestOnlyMonths: financing.seller_io_months || (financing.seller_io ? financing.seller_io * 12 : 0),
    },
    sellerCarryback: {
      loanAmount: financing.seller_carryback_amount || financing.carryback || 0,
      interestRate: financing.seller_carryback_rate ? financing.seller_carryback_rate / 100 : 0,
      termMonths: financing.seller_carryback_term ? financing.seller_carryback_term * 12 : 0,
      interestOnly: financing.carryback_interest_only || false,
    },
    dscrLoan: {
      loanAmount: loanAmount,
      ltv: ltv / 100,
      interestRate: interestRate / 100,
      termMonths: termYears * 12,
      dscrRequirement: financing.dscr_requirement || 1.25,
    },
  };

  // ============================================================================
  // STEP 13: Map sources of funds with auto-calculated equity split
  // ============================================================================
  mapped.sources = {
    seniorDebt: loanAmount,
    mezDebt: (parsedData.sources || {}).mez_debt || (parsedData.sources || {}).mezzanine || 0,
    preferredEquity: (parsedData.sources || {}).preferred_equity || (parsedData.sources || {}).pref_equity || 0,
    lpEquity: lpEquity,
    gpEquity: gpEquity,
  };

  // ============================================================================
  // STEP 14: Map uses of funds with auto-calculated costs
  // ============================================================================
  mapped.uses = {
    purchasePrice: purchasePrice,
    closingCosts: closingCosts,
    dueDiligence: dueDiligence,
    immediateCapex: capexBudgetYear1,
    financingFees: financingCosts,
    operatingReserves: operatingReserves,
    other: (parsedData.uses || {}).other || (parsedData.uses || {}).miscellaneous || 0,
  };

  // ============================================================================
  // STEP 15: Map waterfall structure with defaults
  // ============================================================================
  const waterfall = parsedData.waterfall || {};
  mapped.waterfall = {
    preferredReturn: toDecimal(waterfall.preferred_return, 8),
    lpEquitySplitPrePref: toDecimal(waterfall.lp_split_pre_pref, 90),
    gpEquitySplitPrePref: toDecimal(waterfall.gp_split_pre_pref, 10),
    lpSplitAfterPref: toDecimal(waterfall.lp_split_after_pref, 70),
    gpPromoteAfterPref: toDecimal(waterfall.gp_promote_after_pref, 30),
  };

  // ============================================================================
  // STEP 16: Comprehensive logging for debugging
  // ============================================================================
  console.log('[MAPPER] ========== COMPREHENSIVE MAPPING COMPLETE ==========');
  console.log('[MAPPER] Purchase Price:', purchasePrice ? `$${purchasePrice.toLocaleString()}` : 'NOT SET');
  console.log('[MAPPER] Loan Amount:', loanAmount ? `$${loanAmount.toLocaleString()} (${ltv}% LTV)` : 'NOT SET');
  console.log('[MAPPER] Total Equity:', totalEquity ? `$${totalEquity.toLocaleString()}` : 'NOT SET');
  console.log('[MAPPER]   - LP Equity (90%):', lpEquity ? `$${lpEquity.toLocaleString()}` : 'NOT SET');
  console.log('[MAPPER]   - GP Equity (10%):', gpEquity ? `$${gpEquity.toLocaleString()}` : 'NOT SET');
  console.log('[MAPPER] Acquisition Costs:');
  console.log('[MAPPER]   - Closing:', closingCosts ? `$${closingCosts.toLocaleString()}` : '$0');
  console.log('[MAPPER]   - Due Diligence:', dueDiligence ? `$${dueDiligence.toLocaleString()}` : '$0');
  console.log('[MAPPER]   - Financing:', financingCosts ? `$${financingCosts.toLocaleString()}` : '$0');
  console.log('[MAPPER]   - Reserves:', operatingReserves ? `$${operatingReserves.toLocaleString()}` : '$0');
  console.log('[MAPPER] Units:', mapped.units || 0);
  console.log('[MAPPER] Rent Roll:', mapped.rentRoll ? `${mapped.rentRoll.filter(u => u.unitNumber).length} units mapped` : 'NOT SET');
  console.log('[MAPPER] Expenses Mapped:', Object.values(mapped.expenses || {}).filter(v => v > 0).length, 'categories');
  console.log('[MAPPER] Other Income:', mapped.otherIncome?.other || 0);
  console.log('[MAPPER] =========================================================');
  
  return mapped;
}
