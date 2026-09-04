export type SeasonalProgramKey = 'irrigation' | 'maintenance' | 'pool-services'

export type SeasonalOperationalService = {
  value: string
  label: string
  description?: string
  isActive?: boolean
}

export type SeasonalProgramConfig = {
  key: SeasonalProgramKey
  code: 'IRRIGATION' | 'MAINTENANCE' | 'POOL_SERVICES'
  title: string
  subtitle: string
  accent: string
  summary: string
  focusAreas: string[]
  examples: string[]
  seasonLabel: string
  operationalServices: SeasonalOperationalService[]
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
    seasonLabel: 'Irrigation Season',
    operationalServices: [
      { value: 'TURN_ON', label: 'Turn On' },
      { value: 'TURN_OFF', label: 'Turn Off' },
      { value: 'SERVICE_CALL', label: 'Service Call' },
      { value: 'REPAIR', label: 'Repair' },
    ],
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
    seasonLabel: 'Maintenance Season',
    operationalServices: [
      { value: 'SPRING_CLEANUP', label: 'Spring Cleanup', description: 'One-time spring cleanup, mulch and property preparation.', isActive: true },
      { value: 'MONTHLY_MAINTENANCE', label: 'Monthly Maintenance', description: 'Recurring grounds-service visit scheduled one visit at a time.', isActive: true },
      { value: 'FALL_CLEANUP', label: 'Fall Cleanup', description: 'Seasonal fall cleanup and closing work.', isActive: false },
      { value: 'WEED_CONTROL', label: 'Weed Control', description: 'Targeted weed-control visits.', isActive: false },
      { value: 'FLATS', label: 'Flats / Planting', description: 'Planting, flats and seasonal color work.', isActive: false },
      { value: 'MULCH', label: 'Mulch', description: 'Mulch delivery and installation.', isActive: false },
      { value: 'PRUNING', label: 'Pruning', description: 'Pruning and one-time landscape detail work.', isActive: false },
      { value: 'SPECIAL_REQUEST', label: 'Special Request', description: 'One-time customer request outside the standard plan.', isActive: false },
    ],
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
    seasonLabel: 'Pool Season',
    operationalServices: [
      { value: 'OPEN', label: 'Open' },
      { value: 'WEEKLY', label: 'Weekly' },
      { value: 'CLOSE', label: 'Close' },
      { value: 'ADDITIONAL', label: 'Additional' },
    ],
  },
]

export function getSeasonalProgramConfig(key: string) {
  return seasonalProgramConfigs.find((program) => program.key === key) || null
}
