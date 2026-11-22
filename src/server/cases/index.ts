/**
 * HIDDEN case data: Worker-only. Never import this from src/pages or
 * src/components. Anything here is visible to anyone who can read the
 * browser bundle if it leaks into it; src/cases/catalog.test.ts fails the
 * build if it does.
 *
 * The full write-up of every case (and why the numbers are what they are)
 * is in CASES.md at the repo root.
 */

export interface Exhibit {
  title: string
  columns: string[]
  rows: string[][]
  /** Index of a row to render bold (e.g. a total). */
  boldRow?: number
  note?: string
}

export interface HiddenCase {
  /** Facts the interviewer may reveal when asked in Part 1. */
  facts: string[]
  /** What a strong framework covers (Part 2). */
  structureCheckpoints: string[]
  exhibit: Exhibit
  /** Part 3 numeric answer, graded by code. */
  answer: { value: number; tolerancePct: number; working: string }
  keyInsight: string
  modelRecommendation: string
}

export const RECOMMENDATION_CHECKPOINTS = [
  'Leads with a clear answer (yes, no, or a specific action)',
  'Gives 2-3 supporting reasons using the case numbers',
  'Names the main risks',
  'Proposes concrete next steps',
]

export const HIDDEN_CASES: Record<string, HiddenCase> = {
  'harvest-lane': {
    facts: [
      'Store count unchanged at 42; prices unchanged; customer traffic flat.',
      'An Aldi opened 6 stores nearby in 2024, but revenue did not drop.',
      'In January 2024 Harvest Lane closed its own distribution center in Fort Wayne and moved to a third-party logistics provider, MidStates Logistics, on a 3-year contract.',
      'Fresh-produce deliveries went from daily to 3 times per week after the switch.',
      'Labor and rent are stable. The goal is net margin of at least 2% within 2 years.',
    ],
    structureCheckpoints: [
      'Splits profit into revenue and costs',
      'Notes revenue is flat, so the problem is on the cost side',
      'Breaks costs into lines: product cost, shrink/spoilage, distribution/logistics, labor, occupancy, overhead',
      'Considers external factors (competition, inflation) as well as internal operations',
    ],
    exhibit: {
      title: 'Exhibit 1: Cost structure as % of revenue',
      columns: ['Cost line', 'FY2023', 'FY2025'],
      rows: [
        ['Product cost (COGS)', '72.0%', '72.2%'],
        ['Shrink (spoilage + theft)', '2.6%', '3.3%'],
        ['Distribution & logistics', '3.2%', '4.0%'],
        ['Store labor', '11.5%', '11.6%'],
        ['Occupancy', '5.0%', '5.0%'],
        ['SG&A / other', '3.3%', '3.0%'],
        ['Net margin', '2.4%', '0.9%'],
      ],
      boldRow: 6,
      note: 'Revenue: $1.2B in both years.',
    },
    answer: {
      value: 18,
      tolerancePct: 2,
      working: '(0.7% shrink + 0.8% distribution) x $1.2B = $18.0M, which is the entire 1.5-point margin decline.',
    },
    keyInsight:
      'The January 2024 switch to a third-party logistics provider caused both problems: distribution costs rose, and less frequent fresh deliveries increased spoilage.',
    modelRecommendation:
      'Fix the supply chain, not pricing. Distribution (+$9.6M) and shrink (+$8.4M) explain all $18M of lost profit, and both trace to the January 2024 3PL switch. Move fresh produce back to daily delivery (a fresh-only lane or renegotiated 3PL terms) and cut shrink with demand forecasting and earlier markdowns. Risks: contract exit penalties and capex if a fresh DC is reopened. Next steps: price the contract exit and pilot daily fresh delivery in 10 stores for 90 days.',
  },

  voltpath: {
    facts: [
      'VoltPath has $20M available for expansion and wants positive ROI within 5 years.',
      'California hubs run at 82% average utilization.',
      'Projected fleet EVs in Houston and Dallas in 2027: 18,000 delivery vans and trucks.',
      '40% of those fleets (Amazon, FedEx and similar) charge at their own depots, so they are not addressable.',
      'Two competitors already hold contracts with about 35% of the addressable fleets.',
      'Texas power (ERCOT) is cheaper but more price-volatile than California power. Texas has no state fleet-EV mandate.',
      'A regional grocery-delivery fleet with 150 vans has signaled interest in a Houston contract.',
    ],
    structureCheckpoints: [
      'Market attractiveness: size, growth and competition',
      'Company fit and capabilities: does the California model transfer?',
      'Economics: capex, break-even, ROI or payback',
      'Entry approach and risks: phasing, partnerships, regulation and power prices',
    ],
    exhibit: {
      title: 'Exhibit 2: Hub unit economics',
      columns: ['Item', 'Value'],
      rows: [
        ['Capex per hub (20 chargers)', '$2.4M, depreciated over 10 years'],
        ['Fixed operating cost per hub', '$180,000 / year'],
        ['Price charged to fleets', '$0.32 / kWh'],
        ['Electricity cost', '$0.12 / kWh'],
        ['Average energy per van', '30 kWh/day x 300 operating days'],
        ['Max vans per hub', '300'],
      ],
    },
    answer: {
      value: 233.33,
      tolerancePct: 2,
      working:
        'Fixed costs = $180k + $240k depreciation = $420k/yr. Margin = $0.32 - $0.12 = $0.20/kWh. Break-even energy = $420k / $0.20 = 2.1M kWh/yr. Per van = 30 x 300 = 9,000 kWh/yr. 2.1M / 9,000 = 233 vans.',
    },
    keyInsight:
      'Break-even needs 78% utilization per hub (233 of 300 vans). All 6 hubs need about 1,400 vans, 13% of the 10,800 addressable vans, while competitors already hold 35%: achievable only with anchor contracts.',
    modelRecommendation:
      'Enter, but phased: start with 2 Houston hubs, not 6. The market is real (10,800 addressable vans), but each hub needs 78% utilization to break even, close to California\'s 82%, which is only realistic with signed anchor customers such as the 150-van grocery fleet. Two hubs cost $4.8M and keep most of the $20M in reserve. Risks: ERCOT price spikes squeezing the $0.20/kWh margin, and competitors locking up contracts first. Next steps: sign the anchor contract, hedge power prices, expand once utilization passes 70%.',
  },

  clarion: {
    facts: [
      "Northwind's budget is up to $50M and it wants the deal closed this year.",
      "Clarion's ARR is growing 25% per year. Its customers are mostly small businesses.",
      "30% of Clarion's customers already use Northwind's CRM.",
      'Northwind has 5,000 customers it could cross-sell analytics to.',
      'Comparable SaaS deals: 4-6x ARR for companies with about 20% churn; about 8x ARR for companies under 10% churn.',
      "Clarion's founders are willing to stay for 1 year after a deal.",
    ],
    structureCheckpoints: [
      'Standalone value of the target: revenue, growth, churn, unit economics',
      'Synergies: cross-selling, lower churn, cost savings',
      'Price versus value: valuation multiple vs comparable deals',
      'Risks and deal structure: integration, people, earnout',
    ],
    exhibit: {
      title: 'Exhibit 3: Clarion customer metrics',
      columns: ['Metric', 'Value'],
      rows: [
        ['Customers', '600'],
        ['Annual revenue per account (ARPA)', '$12,000'],
        ['ARR', '$7.2M'],
        ['Gross margin', '80%'],
        ['Annual customer churn', '20%'],
        ['Cost to acquire a customer (CAC)', '$18,000'],
      ],
    },
    answer: {
      value: 48000,
      tolerancePct: 2,
      working: 'LTV = ARPA x gross margin / churn = $12,000 x 0.80 / 0.20 = $48,000.',
    },
    keyInsight:
      'LTV/CAC is 48,000 / 18,000 = 2.7x, below the healthy 3x benchmark, and $45M is 6.25x ARR, above the 4-6x range for 20%-churn companies. The price only works if integration cuts churn (at 12% churn, LTV rises to $80,000).',
    modelRecommendation:
      "Don't pay $45M upfront. Offer about $36-40M (5-5.5x ARR) with an earnout tied to churn improvement. Standalone, Clarion is overpriced: 6.25x ARR versus 4-6x comparables, and LTV/CAC is only 2.7x. The strategic fit is real: 30% customer overlap and 5,000 Northwind customers to cross-sell to, and an earnout pays the founders for that synergy only if it shows up. Risks: churn stays high; key engineers leave after year 1. Next steps: diligence churn by customer segment and pilot a cross-sell offer to 200 Northwind customers.",
  },
}

export function getHiddenCase(id: string): HiddenCase | undefined {
  return Object.prototype.hasOwnProperty.call(HIDDEN_CASES, id) ? HIDDEN_CASES[id] : undefined
}
