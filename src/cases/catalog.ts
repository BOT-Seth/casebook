/**
 * PUBLIC case catalog: safe to ship to the browser.
 *
 * Only what a candidate is allowed to see before starting a case lives here.
 * Fact sheets, exhibit numbers, answers and model answers live in
 * src/server/cases/, which only the Worker imports (see the bundle check in
 * src/cases/catalog.test.ts).
 */

export type CaseType = 'Profitability' | 'Market Entry' | 'M&A' | 'Pricing' | 'Market Sizing' | 'Operations' | 'Growth Strategy'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface CaseSummary {
  id: string
  title: string
  type: CaseType
  difficulty: Difficulty
  industry: string
  estMinutes: number
  /** The situation, read aloud at the start. */
  prompt: string
  /** The real published case whose format this one follows (decision #15). */
  modeledOn: { label: string; url: string }
  /** The question asked in Part 3. Public: it's shown once Part 3 opens. */
  analyzeQuestion: string
  analyzeUnit: string
}

export const CASES: CaseSummary[] = [
  {
    id: 'harvest-lane',
    title: 'Harvest Lane Markets',
    type: 'Profitability',
    difficulty: 'Easy',
    industry: 'Grocery retail',
    estMinutes: 25,
    prompt:
      'Our client, Harvest Lane Markets, is a regional grocery chain with 42 stores across Ohio, Indiana and Michigan. Revenue has been flat at about $1.2 billion for three years, but net profit margin fell from 2.4% to 0.9%. The CEO wants to know what is driving the decline and how to get margin back above 2%.',
    modeledOn: {
      label: 'the classic retail profitability case (MBA casebook format)',
      url: 'https://www.hackingthecaseinterview.com/pages/mba-consulting-casebooks',
    },
    analyzeQuestion:
      'How much annual profit, in $M, is lost to the increases in shrink and distribution costs combined?',
    analyzeUnit: '$M',
  },
  {
    id: 'voltpath',
    title: 'VoltPath Fleet Charging',
    type: 'Market Entry',
    difficulty: 'Medium',
    industry: 'EV infrastructure',
    estMinutes: 30,
    prompt:
      'VoltPath runs depot charging hubs for electric delivery fleets in California. It is considering entering Texas with 6 hubs along the Houston to Dallas corridor, starting in 2027. Should VoltPath enter, and if so, how?',
    modeledOn: {
      label: "Bain's Coffee Shop Co. practice case",
      url: 'https://www.bain.com/careers/hiring-process/case-interview/',
    },
    analyzeQuestion: 'How many vans does one hub need under contract to break even each year?',
    analyzeUnit: 'vans',
  },
  {
    id: 'clarion',
    title: 'Clarion Analytics Acquisition',
    type: 'M&A',
    difficulty: 'Hard',
    industry: 'B2B software',
    estMinutes: 35,
    prompt:
      'Northwind Software, a mid-size CRM company, wants to add analytics to its product. It is considering acquiring Clarion Analytics, a B2B SaaS analytics startup, for an asking price of $45M. Should Northwind buy Clarion at that price?',
    modeledOn: {
      label: "McKinsey's interactive practice case format",
      url: 'https://www.mckinsey.com/careers/interviewing',
    },
    analyzeQuestion: 'What is the lifetime value (LTV) of one Clarion customer, in dollars?',
    analyzeUnit: '$',
  },
]

/** Shown faded under the playable cases: where the library is heading. */
export const COMING_SOON: Array<Pick<CaseSummary, 'title' | 'type' | 'difficulty'>> = [
  { title: 'Austin Specialty Coffee', type: 'Market Sizing', difficulty: 'Easy' },
  { title: 'SkyLink Bag Fees', type: 'Pricing', difficulty: 'Medium' },
  { title: 'Mercy General ER Wait Times', type: 'Operations', difficulty: 'Medium' },
  { title: 'IronWorks Gym Expansion', type: 'Growth Strategy', difficulty: 'Hard' },
]

export function getCase(id: string): CaseSummary | undefined {
  return CASES.find((c) => c.id === id)
}

/** The four parts every case is played in. */
export const PARTS = [
  { n: 1, key: 'clarify', label: 'Clarify', points: 10 },
  { n: 2, key: 'structure', label: 'Structure', points: 30 },
  { n: 3, key: 'analyze', label: 'Analyze', points: 30 },
  { n: 4, key: 'recommend', label: 'Recommend', points: 30 },
] as const

export const MAX_SCORE = 100

/**
 * A case counts as "solved" at this score (the "Strong" band). Finishing a
 * case below it counts as attempted, like a failed submission on LeetCode.
 */
export const SOLVED_SCORE = 70
