# CLAUDE SYSTEM PROMPT — Real Estate Underwriting Model

---

## SYSTEM PROMPT (send this to Claude with every request)

```
You are a real estate underwriting assistant. A user will provide deal information in any format (text, paste, form data). Your job is to extract and suggest values for a structured investment underwriting model.

Return ONLY a valid JSON object. No explanation. No markdown. No extra text. Just the JSON.

If a value is not provided and cannot be reasonably suggested based on the deal inputs, return null for that field.
Do NOT invent numbers for financial fields like Purchase Price, Loan Amount, or rent amounts — only return those if explicitly provided.
You MAY suggest values for: interest rate, cap rates, closing cost %, vacancy rate, expense ratios, and hold period — based on current market context for the asset type and location provided.

Return this exact JSON structure:
{
  "property": {
    "deal_name": "",
    "address": "",
    "city_state_zip": "",
    "property_name": "",
    "asset_type": "",
    "year_built": null,
    "year_renovated": null,
    "apn": "",
    "gross_building_sf": null,
    "lot_size_acres": null,
    "total_units": null,
    "unit_mix": "",
    "current_occupancy_pct": null,
    "avg_sf_per_unit": null,
    "avg_current_rent_per_unit": null
  },
  "purchase_and_financing": {
    "purchase_price": null,
    "down_payment_pct": null,
    "interest_rate_pct": null,
    "amortization_years": null,
    "closing_costs_pct": null,
    "working_capital": null
  },
  "equity_partner_structure": {
    "investor_contribution": null,
    "your_contribution": null,
    "preferred_return_pct": null,
    "partner_equity_pct": null,
    "your_equity_pct": null
  },
  "value_add_assumptions": {
    "rent_bump_per_mo": null,
    "rubs_recovery_per_year": null,
    "trash_fee_per_unit_per_mo": null,
    "annual_appreciation_rate_pct": null,
    "exit_cap_conservative_pct": null,
    "exit_cap_market_pct": null,
    "hold_period_years": null
  },
  "expenses": {
    "property_tax": null,
    "insurance": null,
    "management_pct_of_goi": null,
    "repairs_and_maintenance": null,
    "landscaping": null,
    "turnover_cleaning": null,
    "payroll": null,
    "water_sewer": null,
    "electricity_common_only": null,
    "pest_control": null,
    "trash_service": null,
    "general_admin": null,
    "marketing": null,
    "reserves": null,
    "licenses_and_permits": null
  },
  "rent_roll": [
    {
      "unit_number": 1,
      "mix": "",
      "current_rent": null,
      "market_rent": null,
      "lease_end": "",
      "sf": null
    }
  ],
  "claude_suggestions": {
    "suggested_interest_rate_pct": null,
    "suggested_exit_cap_conservative_pct": null,
    "suggested_exit_cap_market_pct": null,
    "suggested_closing_costs_pct": null,
    "suggested_vacancy_rate_pct": null,
    "risk_flags": [],
    "deal_notes": ""
  }
}
```

---

## CELL MAPPING — JSON Field → Excel Cell Reference

> Blue cells = user inputs Claude fills. Black cells = formulas, never touch.

### HEADER ROW
| JSON Field | Excel Cell |
|---|---|
| `property.deal_name` | A1 (merged header) |
| `property.address` + `property.city_state_zip` | A2 (subtitle bar) |
| `property.total_units` | subtitle bar — Units |
| `property.year_built` | subtitle bar — Year Built |
| `purchase_and_financing.purchase_price` | subtitle bar — Offer Price |
| `purchase_and_financing.down_payment_pct` | subtitle bar — Down % |
| `purchase_and_financing.interest_rate_pct` | subtitle bar — Rate |
| `purchase_and_financing.amortization_years` | subtitle bar — Amort |

---

### PROPERTY INFORMATION (rows 19–31)
| JSON Field | Excel Cell |
|---|---|
| `property.property_name` | B19 |
| `property.address` | B20 |
| `property.asset_type` | B22 |
| `property.year_built` / `property.year_renovated` | B23 |
| `property.apn` | B24 |
| `property.gross_building_sf` | B25 |
| `property.lot_size_acres` | B26 |
| `property.total_units` | B27 |
| `property.unit_mix` | B28 |
| `property.current_occupancy_pct` | B29 |
| `property.avg_sf_per_unit` | B30 |
| `property.avg_current_rent_per_unit` | B31 |

---

### PURCHASE & FINANCING (rows 33–39)
| JSON Field | Excel Cell |
|---|---|
| `purchase_and_financing.purchase_price` | B33 |
| `purchase_and_financing.down_payment_pct` | B34 |
| `purchase_and_financing.interest_rate_pct` | B35 |
| `purchase_and_financing.amortization_years` | B36 |
| `purchase_and_financing.closing_costs_pct` | B37 |
| `purchase_and_financing.working_capital` | B38 |

> Rows 40–44 (Loan Amount, Closing Costs $, Total Cash to Close, Monthly Debt Service, Annual Debt Service) = FORMULAS — do not write to these cells.

---

### EQUITY PARTNER STRUCTURE (rows 46–50)
| JSON Field | Excel Cell |
|---|---|
| `equity_partner_structure.investor_contribution` | B46 |
| `equity_partner_structure.your_contribution` | B47 |
| `equity_partner_structure.preferred_return_pct` | B48 |
| `equity_partner_structure.partner_equity_pct` | B49 |
| `equity_partner_structure.your_equity_pct` | B50 |

---

### VALUE-ADD ASSUMPTIONS (rows 52–58)
| JSON Field | Excel Cell |
|---|---|
| `value_add_assumptions.rent_bump_per_mo` | B52 |
| `value_add_assumptions.rubs_recovery_per_year` | B53 |
| `value_add_assumptions.trash_fee_per_unit_per_mo` | B54 |
| `value_add_assumptions.annual_appreciation_rate_pct` | B55 |
| `value_add_assumptions.exit_cap_conservative_pct` | B56 |
| `value_add_assumptions.exit_cap_market_pct` | B57 |
| `value_add_assumptions.hold_period_years` | B58 |

---

### EXPENSES (rows 71–84)
| JSON Field | Excel Cell |
|---|---|
| `expenses.property_tax` | B71 |
| `expenses.insurance` | B72 |
| `expenses.management_pct_of_goi` | B73 (enter as % — formula-driven) |
| `expenses.repairs_and_maintenance` | B74 |
| `expenses.landscaping` | B75 |
| `expenses.turnover_cleaning` | B76 |
| `expenses.payroll` | B77 |
| `expenses.water_sewer` | B78 |
| `expenses.electricity_common_only` | B79 |
| `expenses.pest_control` | B80 |
| `expenses.trash_service` | B81 |
| `expenses.general_admin` | B82 |
| `expenses.marketing` | B83 |
| `expenses.reserves` | B84 |
| `expenses.licenses_and_permits` | B85 |

> Rows 86 (TOTAL EXPENSES) and 88 (NET OPERATING INCOME) = FORMULAS — do not touch.

---

### RENT ROLL (rows 125–136, columns A–H)
| JSON Field | Excel Column |
|---|---|
| `rent_roll[n].unit_number` | A |
| `rent_roll[n].mix` | B |
| `rent_roll[n].current_rent` | C |
| `rent_roll[n].market_rent` | D |
| `rent_roll[n].lease_end` | E |
| `rent_roll[n].sf` | F |

> Columns G (Rent/SF) and H (Market Rent/SF) = FORMULAS — do not touch.

---

### CLAUDE SUGGESTIONS — Write to a dedicated "AI Notes" tab or a reserved notes cell
| JSON Field | Destination |
|---|---|
| `claude_suggestions.suggested_interest_rate_pct` | AI Notes tab or cell comment on B35 |
| `claude_suggestions.suggested_exit_cap_conservative_pct` | AI Notes tab or cell comment on B56 |
| `claude_suggestions.suggested_exit_cap_market_pct` | AI Notes tab or cell comment on B57 |
| `claude_suggestions.suggested_closing_costs_pct` | AI Notes tab or cell comment on B37 |
| `claude_suggestions.suggested_vacancy_rate_pct` | AI Notes tab |
| `claude_suggestions.risk_flags` | AI Notes tab — list each flag on its own row |
| `claude_suggestions.deal_notes` | AI Notes tab — free text block |

---

## NOTES

- All formula cells (black in the model) must never be written to by the backend.
- All dollar values from Claude come back as raw numbers (no $ signs, no commas).
- All percentage values from Claude come back as decimals (e.g. 0.07 for 7%) unless your backend normalizes them.
- If `rent_roll` has more units than rows available (125–136 = 12 units visible), expand dynamically downward before injecting.
- The three cashflow scenario columns (Scenario 1, 2, 3) are formula-driven off the inputs above — do not write to them directly.
