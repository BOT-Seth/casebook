# Casebook: The 3 Launch Cases

Everything under 🔒 **Hidden** lives in `src/server/cases/index.ts`, a worker-only module, and never reaches the
browser (`npm run check:bundle` enforces this). The public half of each case is in `src/cases/catalog.ts`.

Every case has 4 parts, scored out of 100:

| Part | What the candidate does | How it's graded | Points |
| --- | --- | --- | --- |
| 1. Clarify | Asks up to 3 questions; the AI answers only from the fact sheet | AI: did the questions uncover the key facts? | 10 |
| 2. Structure | Submits a framework or issue tree | AI against the structure checkpoints | 30 |
| 3. Analyze | Exhibit unlocks. Submits **one number**, plus a one-line "so what" | **Number: code, ±2%** (20); interpretation: AI (10) | 30 |
| 4. Recommend | Submits a top-down recommendation | AI against the recommendation checkpoints | 30 |

Every case uses the same recommendation checkpoints:
1. Answer first (yes, no, or a clear action)
2. 2–3 supporting reasons, using the case's numbers
3. Risks
4. Next steps

---

## Case 1: Harvest Lane Markets (Profitability) · Easy

**Prompt (shown to the candidate):**
> Our client, Harvest Lane Markets, is a regional grocery chain with 42 stores across Ohio, Indiana and Michigan.
> Revenue has been flat at about $1.2 billion for three years, but net profit margin fell from 2.4% to 0.9%.
> The CEO wants to know what's driving the decline and how to get margin back above 2%.

🔒 **Hidden fact sheet** (what the AI may reveal if asked):
- Store count unchanged at 42; prices unchanged; customer traffic flat.
- An Aldi opened 6 stores nearby in 2024. *(A red herring: revenue didn't drop.)*
- **In January 2024, Harvest Lane closed its own distribution center in Fort Wayne and moved to a third-party
  logistics provider (MidStates Logistics) on a 3-year contract.**
- **Fresh-produce deliveries went from daily to 3× per week after the switch.**
- Labor and rent are stable. Goal: margin ≥ 2% within 2 years.

🔒 **Structure checkpoints:**
1. Splits profit into revenue and costs
2. Notes that revenue is flat, so the problem is on the cost side
3. Breaks costs into lines: product cost, shrink/spoilage, distribution/logistics, labor, occupancy, overhead
4. Considers external factors (competition, inflation) as well as internal operations

📊 **Exhibit 1: Cost structure as % of revenue** (unlocks in part 3)

| Cost line | FY2023 | FY2025 | Change |
| --- | --- | --- | --- |
| Product cost (COGS) | 72.0% | 72.2% | +0.2 |
| Shrink (spoilage + theft) | 2.6% | 3.3% | **+0.7** |
| Distribution & logistics | 3.2% | 4.0% | **+0.8** |
| Store labor | 11.5% | 11.6% | +0.1 |
| Occupancy | 5.0% | 5.0% | 0.0 |
| SG&A / other | 3.3% | 3.0% | −0.3 |
| **Net margin** | **2.4%** | **0.9%** | **−1.5** |

**Part 3 question:** "How much annual profit, in $M, is lost to the increases in shrink and distribution costs
combined?"

🔒 **Answer: $18.0M** = (0.7% + 0.8%) × $1.2B. That's the *entire* $18M decline (1.5% × $1.2B). The other lines
net to zero.

🔒 **Key insight:** the logistics switch caused both problems. Distribution costs rose, and less frequent fresh
deliveries increased spoilage.

🔒 **Model recommendation:**
> Fix the supply chain, not pricing.
> 1. Distribution (+$9.6M) and shrink (+$8.4M) explain all $18M of lost profit, and both trace to the January 2024
>    3PL switch.
> 2. Move fresh produce back to daily delivery, either a fresh-only lane or renegotiated 3PL terms.
> 3. Cut shrink with demand forecasting and earlier markdowns.
>
> **Risks:** contract exit penalties; capex if a fresh DC is reopened.
> **Next steps:** price the contract exit, then pilot daily fresh delivery in 10 stores for 90 days.

🔒 **Grading targets** (in code):
- Part 1 key facts: the 3PL switch in Jan 2024 · daily → 3×/week fresh deliveries · stores, prices and traffic flat
- Part 3 "so what": shrink + distribution explain essentially the whole decline, so it's a supply-chain cost problem
- Part 4 right call: name the 3PL switch (via distribution cost and spoilage) as the root cause; fix the supply chain,
  not prices

---

## Case 2: VoltPath (Market Entry) · Medium

**Prompt:**
> VoltPath runs depot charging hubs for electric delivery fleets in California. It's considering entering Texas
> with 6 hubs along the Houston–Dallas corridor, starting in 2027. Should VoltPath enter, and if so, how?

🔒 **Hidden fact sheet:**
- VoltPath has $20M available for expansion and wants positive ROI within 5 years.
- California hubs run at 82% average utilization.
- Projected fleet EVs in Houston + Dallas, 2027: **18,000** delivery vans and trucks.
- **40% of those fleets (Amazon, FedEx, etc.) charge at their own depots**, so they aren't addressable.
- Two competitors already hold contracts with about 35% of the addressable fleets.
- Texas power (ERCOT) is cheaper but more price-volatile than California's. Texas has no state fleet-EV mandate.
- A regional grocery-delivery fleet (150 vans) has signaled interest in a Houston contract.

🔒 **Structure checkpoints:**
1. Market attractiveness: size, growth, competition
2. Company fit and capabilities: does the California model transfer?
3. Economics: capex, break-even, ROI or payback
4. Entry approach and risks: phasing, partnerships, regulation and power prices

📊 **Exhibit 2: Hub unit economics**

| Item | Value |
| --- | --- |
| Capex per hub (20 chargers) | $2.4M, depreciated over 10 years |
| Fixed operating cost per hub | $180,000 / year |
| Price charged to fleets | $0.32 / kWh |
| Electricity cost | $0.12 / kWh |
| Avg energy per van | 30 kWh/day × 300 operating days |
| Max vans per hub | 300 |

**Part 3 question:** "How many vans does one hub need under contract to break even each year?"

🔒 **Answer: 233 vans** (233.3).
- Fixed costs per year: $180k + $240k depreciation = $420k.
- Margin: $0.32 − $0.12 = $0.20 per kWh.
- Break-even energy: $420k ÷ $0.20 = 2.1M kWh per year.
- Energy per van: 30 × 300 = 9,000 kWh per year.
- 2.1M ÷ 9,000 = 233.

🔒 **Key insight:** break-even needs **78% utilization** (233 of 300 vans) per hub. All 6 hubs need about 1,400
vans: **13% of the 10,800 addressable** vans, with competitors already holding 35%. Achievable, but not without
anchor contracts.

🔒 **Model recommendation:**
> Enter, but phased: start with 2 Houston hubs, not 6.
> 1. The market is real: 10,800 addressable vans.
> 2. Each hub needs 78% utilization to break even, close to California's 82%. That's only achievable with signed
>    anchor customers, such as the 150-van grocery fleet.
> 3. Two hubs cost $4.8M, keeping most of the $20M in reserve.
>
> **Risks:** ERCOT price spikes squeezing the $0.20 margin; competitors locking up contracts first.
> **Next steps:** sign the anchor contract, hedge power prices, expand when utilization passes 70%.

🔒 **Grading targets** (in code):
- Part 1 key facts: $20M budget and 5-year ROI · 40% of fleets self-charge · competitors hold 35% of contracts
- Part 3 "so what": ~233 vans means ~78% utilization, so anchor contracts are needed before building
- Part 4 right call: enter in phases, tied to anchor customers (not a 6-hub launch, not a flat no)

---

## Case 3: Clarion Analytics Acquisition (Pricing & M&A) · Hard

**Prompt:**
> Northwind Software, a mid-size CRM company, wants to add analytics to its product. It's considering acquiring
> Clarion Analytics, a B2B SaaS analytics startup, for an asking price of $45M. Should Northwind buy Clarion at
> that price?

🔒 **Hidden fact sheet:**
- Northwind's budget is up to $50M. It wants the deal closed this year.
- Clarion's ARR is growing 25% per year. Its customers are mostly small businesses.
- **30% of Clarion's customers already use Northwind's CRM.**
- Northwind has 5,000 customers it could cross-sell to.
- Comparable SaaS deals: **4–6× ARR for companies with ~20% churn; ~8× ARR for companies under 10% churn.**
- Clarion's founders are willing to stay for 1 year.

🔒 **Structure checkpoints:**
1. Standalone value of the target: revenue, growth, churn, unit economics
2. Synergies: cross-selling (revenue), lower churn, cost savings
3. Price versus value: valuation multiple vs comparable deals
4. Risks and deal structure: integration, people, earnout

📊 **Exhibit 3: Clarion customer metrics**

| Metric | Value |
| --- | --- |
| Customers | 600 |
| Annual revenue per account (ARPA) | $12,000 |
| ARR | $7.2M |
| Gross margin | 80% |
| Annual customer churn | 20% |
| Cost to acquire a customer (CAC) | $18,000 |

**Part 3 question:** "What is the lifetime value (LTV) of one Clarion customer, in dollars?"

🔒 **Answer: $48,000** = ARPA × gross margin ÷ churn = $12,000 × 0.80 ÷ 0.20.

🔒 **Key insight:**
- LTV/CAC = 48,000 ÷ 18,000 = **2.7×**, below the healthy 3× benchmark.
- The asking price of $45M is **6.25× ARR**, above the 4–6× range for 20%-churn companies.
- If integrating with Northwind's CRM cut churn to 12%, LTV would rise to $80,000 (LTV/CAC 4.4×). The price only
  works if that happens.

🔒 **Model recommendation:**
> Don't pay $45M upfront. Offer about $36–40M (5–5.5× ARR), with an earnout tied to churn improvement.
> 1. Standalone, Clarion is overpriced: 6.25× ARR vs 4–6× comparables, and LTV/CAC is only 2.7×.
> 2. The strategic fit is real: 30% customer overlap, plus 5,000 Northwind customers to cross-sell to.
> 3. An earnout pays the founders for the synergy only if it shows up.
>
> **Risks:** churn stays high; key engineers leave after year 1.
> **Next steps:** diligence churn by customer segment; pilot a cross-sell offer to 200 Northwind customers.

🔒 **Grading targets** (in code):
- Part 1 key facts: 30% customer overlap · 5,000 Northwind customers to cross-sell · comps at 4–6× ARR for ~20% churn
- Part 3 "so what": LTV/CAC of ~2.7× (below 3×) or the price looking expensive
- Part 4 right call: don't pay $45M upfront; ~$36–40M and/or an earnout tied to churn

---

## "Coming soon" rows (faded in the list, not playable)
- Market sizing: specialty coffee shops in Austin
- Pricing: airline checked-bag fees
- Operations: emergency-room wait times at a hospital network
- Growth strategy: a regional gym chain
