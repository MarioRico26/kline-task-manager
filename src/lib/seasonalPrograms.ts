export type SeasonalProgramKey = 'irrigation' | 'maintenance' | 'pool-services'

export type SeasonalProgramConfig = {
  key: SeasonalProgramKey
  code: 'IRRIGATION' | 'MAINTENANCE' | 'POOL_SERVICES'
  title: string
  subtitle: string
  accent: string
  summary: string
  focusAreas: string[]
  examples: string[]
}

export const seasonalProgramConfigs: SeasonalProgramConfig[] = [
  {
    key: 'irrigation',
    code: 'IRRIGATION',
    title: 'Irrigation',
    subtitle: 'Turn on, turn off, service calls and repair coordination',
    accent: '#0d6efd',
    summary: 'Best first category to digitize because the roster and seasonal milestones are relatively clean.',
    focusAreas: ['2026 roster import', 'Turn on / turn off workflow', 'Repair and access issue tracking'],
    examples: ['Water on confirmation', 'Garage / gate access notes', 'Service call follow-up'],
  },
  {
    key: 'maintenance',
    code: 'MAINTENANCE',
    title: 'Maintenance',
    subtitle: 'Seasonal cleanups, monthly work and recurring grounds service',
    accent: '#198754',
    summary: 'Most matrix-like workbook: one enrollment can include many recurring service components across the year.',
    focusAreas: ['2026 cleanup matrix', 'Recurring visit structure', 'Program-level notes and service package view'],
    examples: ['Spring cleanup', 'June / July / August recurring work', 'Fall and weed control'],
  },
  {
    key: 'pool-services',
    code: 'POOL_SERVICES',
    title: 'Pool Services',
    subtitle: 'Open, close, weekly service and pool issue management',
    accent: '#fd7e14',
    summary: 'Blends packaged services with timing-sensitive issues like no water, repairs, access or weekly support.',
    focusAreas: ['2026 main list onboarding', 'Open / weekly / close model', 'Problems and repairs'],
    examples: ['Swim ready scheduling', 'Weekly service package', 'Pool problems and repair queue'],
  },
]

export function getSeasonalProgramConfig(key: string) {
  return seasonalProgramConfigs.find((program) => program.key === key) || null
}
