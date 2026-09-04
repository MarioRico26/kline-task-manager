import * as XLSX from 'xlsx'

type PropertyLookup = {
  id: string
  address: string
  city: string
  state: string
  zip: string
  customer: {
    id: string
    fullName: string
    email: string
    phone: string
  }
}

type CustomerLookup = {
  id: string
  fullName: string
  email: string
  phone: string
}

export type PoolWorkbookPreviewRow = {
  rowNumber: number
  lastName: string
  address: string
  town: string
  phone: string
  email: string
  serviceLabels: string[]
  waterStatus: string
  swimReadyDate: string | null
  closeDate: string | null
  accessCode: string
  notes: string
  workbookDuplicate: boolean
  warnings: string[]
  matchStatus: 'matched' | 'review' | 'unmatched'
  matchedProperty: {
    id: string
    label: string
    city: string
    state: string
    zip: string
    matchReason: string
  } | null
  matchedCustomer: {
    id: string
    fullName: string
    email: string
    phone: string
    matchReason: string
  } | null
}

export type PoolWorkbookPreview = {
  fileName: string
  selectedSheet: string
  availableSheets: string[]
  summary: {
    totalRows: number
    matchedRows: number
    reviewRows: number
    unmatchedRows: number
    duplicateRows: number
    exactPropertyMatches: number
    addressOnlyMatches: number
    customerOnlyMatches: number
  }
  rows: PoolWorkbookPreviewRow[]
}

const POOL_SHEET_CANDIDATES = ['2026 MAIN LIST', '2026 MAIN LIST - ORDERED', '2025 MAIN LIST', 'MAIN']

const TOWN_ALIASES: Record<string, string> = {
  BL: 'BARNEGAT LIGHT',
  'BL ': 'BARNEGAT LIGHT',
  HBH: 'HIGH BAR HARBOR',
  LL: 'LOVELADIES',
  HC: 'HARVEY CEDARS',
  SC: 'SURF CITY',
  BB: 'BRANT BEACH',
  BHW: 'BEACH HAVEN WEST',
  SSP: 'SEASIDE PARK',
  'LONG BEACH TWP': 'LONG BEACH TOWNSHIP',
}

const ADDRESS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bSTREET\b/g, 'ST'],
  [/\bST\.?\b/g, 'ST'],
  [/\bAVENUE\b/g, 'AVE'],
  [/\bAVE\.?\b/g, 'AVE'],
  [/\bBOULEVARD\b/g, 'BLVD'],
  [/\bBLVD\.?\b/g, 'BLVD'],
  [/\bDRIVE\b/g, 'DR'],
  [/\bROAD\b/g, 'RD'],
  [/\bLANE\b/g, 'LN'],
  [/\bCOURT\b/g, 'CT'],
  [/\bPLACE\b/g, 'PL'],
  [/\bTERRACE\b/g, 'TER'],
  [/\bCIRCLE\b/g, 'CIR'],
  [/\bNORTH\b/g, 'N'],
  [/\bSOUTH\b/g, 'S'],
  [/\bEAST\b/g, 'E'],
  [/\bWEST\b/g, 'W'],
  [/\bTOWNSHIP\b/g, 'TWP'],
  [/\bTWP\b/g, 'TWP'],
]

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeTown(value: string) {
  const trimmed = normalizeSpace(String(value || '').toUpperCase().replace(/[.,]/g, ''))
  return TOWN_ALIASES[trimmed] || trimmed
}

function normalizeAddress(value: string) {
  let normalized = normalizeSpace(String(value || '').toUpperCase())
  normalized = normalized.replace(/[#,./]/g, ' ')
  normalized = normalized.replace(/\bLONG BEACH TOWNSHIP\b/g, 'LONG BEACH TWP')
  for (const [pattern, replacement] of ADDRESS_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }
  normalized = normalized.replace(/\s+/g, ' ').trim()
  return normalized
}

function normalizePhone(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function toDisplayDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return String(value)
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }

  const text = normalizeSpace(String(value))
  if (!text) return null
  if (/^(TBD|ASAP|NONE|N\/A)$/i.test(text)) return text.toUpperCase()

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pickSheetName(sheetNames: string[]) {
  for (const candidate of POOL_SHEET_CANDIDATES) {
    const found = sheetNames.find((sheet) => sheet.trim().toUpperCase() === candidate.toUpperCase())
    if (found) return found
  }

  const generic2026 = sheetNames.find((sheet) => sheet.toUpperCase().includes('2026') && sheet.toUpperCase().includes('MAIN'))
  if (generic2026) return generic2026

  return sheetNames[0] || null
}

function cleanServiceLabel(value: string) {
  return normalizeSpace(value.replace(/\*+/g, '').replace(/\s+/g, ' '))
}

function normalizeHeader(value: string) {
  return normalizeSpace(value.toUpperCase().replace(/[?]/g, ''))
}

function findHeaderRowIndex(rows: Array<Array<string | number | null>>) {
  return rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(String(cell ?? '')))
    return normalized.includes('ADDRESS') && normalized.includes('LAST NAME') && normalized.includes('TOWN')
  })
}

function buildHeaderMap(headerRow: Array<string | number | null>) {
  const map = new Map<string, number>()
  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(String(cell ?? ''))
    if (header) map.set(header, index)
  })
  return map
}

function getCellByHeader(
  row: Array<string | number | null>,
  headerMap: Map<string, number>,
  headers: string[]
) {
  for (const header of headers) {
    const index = headerMap.get(normalizeHeader(header))
    if (index !== undefined) return row[index] ?? ''
  }
  return ''
}

function buildServiceLabels(openValue: string, closeValue: string, weeklyValue: string) {
  const labels: string[] = []
  const open = cleanServiceLabel(openValue)
  const close = cleanServiceLabel(closeValue)
  const weekly = cleanServiceLabel(weeklyValue)

  if (open) labels.push(open)
  if (close) labels.push(close)
  if (weekly) labels.push(weekly)

  return Array.from(new Set(labels.filter(Boolean)))
}

function rowLooksLikeSectionHeader(values: string[]) {
  const compact = values.filter(Boolean)
  if (compact.length === 0) return true
  if (compact.length === 1 && compact[0] === compact[0].toUpperCase()) return true
  return false
}

function findCustomerByDirectLookup(row: {
  email: string
  phone: string
  lastName: string
}, customers: CustomerLookup[]) {
  const normalizedEmail = row.email.trim().toLowerCase()
  const normalizedPhone = normalizePhone(row.phone)
  const lastName = normalizeSpace(row.lastName.toUpperCase())

  if (normalizedEmail) {
    const emailMatch = customers.find((customer) => customer.email.trim().toLowerCase() === normalizedEmail)
    if (emailMatch) {
      return {
        id: emailMatch.id,
        fullName: emailMatch.fullName,
        email: emailMatch.email,
        phone: emailMatch.phone,
        matchReason: 'Matched by customer email',
      }
    }
  }

  if (normalizedPhone) {
    const phoneMatches = customers.filter((customer) => normalizePhone(customer.phone) === normalizedPhone)
    if (phoneMatches.length === 1) {
      const phoneMatch = phoneMatches[0]
      return {
        id: phoneMatch.id,
        fullName: phoneMatch.fullName,
        email: phoneMatch.email,
        phone: phoneMatch.phone,
        matchReason: 'Matched by customer phone',
      }
    }
  }

  if (lastName) {
    const lastNameMatches = customers.filter((customer) => normalizeSpace(customer.fullName.toUpperCase()).split(' ').includes(lastName))
    if (lastNameMatches.length === 1) {
      const nameMatch = lastNameMatches[0]
      return {
        id: nameMatch.id,
        fullName: nameMatch.fullName,
        email: nameMatch.email,
        phone: nameMatch.phone,
        matchReason: 'Matched by customer name',
      }
    }
  }

  return null
}

export function buildPoolWorkbookPreview(params: {
  fileName: string
  fileBuffer: Buffer
  properties: PropertyLookup[]
  customers: CustomerLookup[]
}): PoolWorkbookPreview {
  const workbook = XLSX.read(params.fileBuffer, { type: 'buffer', cellDates: false, raw: false })
  const selectedSheet = pickSheetName(workbook.SheetNames)

  if (!selectedSheet) {
    throw new Error('The workbook does not contain any sheets.')
  }

  const worksheet = workbook.Sheets[selectedSheet]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  })

  const headerRowIndex = findHeaderRowIndex(rows)
  if (headerRowIndex === -1) {
    throw new Error('The workbook does not contain the expected pool service columns.')
  }
  const headerMap = buildHeaderMap(rows[headerRowIndex] || [])

  const propertyByAddressTown = new Map<string, PropertyLookup[]>()
  const propertyByAddressOnly = new Map<string, PropertyLookup[]>()

  for (const property of params.properties) {
    const addressKey = normalizeAddress(property.address)
    const townKey = normalizeTown(property.city)
    const compound = `${addressKey}__${townKey}`
    propertyByAddressTown.set(compound, [...(propertyByAddressTown.get(compound) || []), property])
    propertyByAddressOnly.set(addressKey, [...(propertyByAddressOnly.get(addressKey) || []), property])
  }

  const parsedRows: PoolWorkbookPreviewRow[] = []
  const workbookAddressCounts = new Map<string, number>()

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || []
    const values = row.map((cell) => normalizeSpace(String(cell ?? '')))

    if (rowLooksLikeSectionHeader(values)) continue

    const openValue = normalizeSpace(String(getCellByHeader(row, headerMap, ['FREE?', 'OPEN?']) ?? ''))
    const closeValue = normalizeSpace(String(getCellByHeader(row, headerMap, ['CLOSE?']) ?? ''))
    const weeklyValue = normalizeSpace(String(getCellByHeader(row, headerMap, ['WEEKLY?']) ?? ''))
    const lastName = normalizeSpace(String(getCellByHeader(row, headerMap, ['LAST NAME']) ?? ''))
    const address = normalizeSpace(String(getCellByHeader(row, headerMap, ['ADDRESS']) ?? ''))
    const town = normalizeSpace(String(getCellByHeader(row, headerMap, ['TOWN']) ?? ''))
    const waterStatus = normalizeSpace(String(getCellByHeader(row, headerMap, ['WATER?']) ?? ''))
    const dayCleaned = normalizeSpace(String(getCellByHeader(row, headerMap, ['DAY CLEANED']) ?? ''))
    const swimReadyDate = toDisplayDate(getCellByHeader(row, headerMap, ['SWIM READY DATE']))
    const closeDate = toDisplayDate(getCellByHeader(row, headerMap, ['CLOSE DATE']))
    const accessCode = normalizeSpace(String(getCellByHeader(row, headerMap, ['CODE']) ?? ''))
    const phone = normalizeSpace(String(getCellByHeader(row, headerMap, ['PHONE NUMBER']) ?? ''))
    const email = normalizeSpace(String(getCellByHeader(row, headerMap, ['EMAIL']) ?? ''))
    const notes = normalizeSpace(String(getCellByHeader(row, headerMap, ['NOTES']) ?? ''))

    if (!address) continue
    if (!lastName && !phone && !email && !openValue && !closeValue && !weeklyValue && !waterStatus && !notes) continue

    const addressKey = normalizeAddress(address)
    const townKey = normalizeTown(town)
    const workbookKey = `${addressKey}__${townKey || 'NO_TOWN'}`
    workbookAddressCounts.set(workbookKey, (workbookAddressCounts.get(workbookKey) || 0) + 1)

    const exactMatches = propertyByAddressTown.get(`${addressKey}__${townKey}`) || []
    const addressOnlyMatches = propertyByAddressOnly.get(addressKey) || []

    let matchedProperty: PoolWorkbookPreviewRow['matchedProperty'] = null
    let matchedCustomer: PoolWorkbookPreviewRow['matchedCustomer'] = null
    const warnings: string[] = []
    let matchStatus: PoolWorkbookPreviewRow['matchStatus'] = 'unmatched'

    if (exactMatches.length === 1) {
      const property = exactMatches[0]
      matchedProperty = {
        id: property.id,
        label: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        matchReason: 'Exact address + town match',
      }
      matchedCustomer = {
        id: property.customer.id,
        fullName: property.customer.fullName,
        email: property.customer.email,
        phone: property.customer.phone,
        matchReason: 'Linked through matched property',
      }
      matchStatus = 'matched'
    } else if (exactMatches.length > 1) {
      warnings.push('More than one property matched this address and town.')
      matchStatus = 'review'
    } else if (addressOnlyMatches.length === 1) {
      const property = addressOnlyMatches[0]
      matchedProperty = {
        id: property.id,
        label: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        matchReason: 'Matched by address only',
      }
      matchedCustomer = {
        id: property.customer.id,
        fullName: property.customer.fullName,
        email: property.customer.email,
        phone: property.customer.phone,
        matchReason: 'Linked through matched property',
      }
      warnings.push('Town needs review. Address matched but city did not match exactly.')
      matchStatus = 'review'
    } else if (addressOnlyMatches.length > 1) {
      warnings.push('Address matched multiple properties in the system.')
      matchStatus = 'review'
    } else {
      matchedCustomer = findCustomerByDirectLookup({ email, phone, lastName }, params.customers)
      if (matchedCustomer) {
        warnings.push('Customer matched, but no property match was found yet.')
        matchStatus = 'review'
      } else {
        warnings.push('No customer or property match found in the system.')
      }
    }

    const serviceLabels = buildServiceLabels(openValue, closeValue, weeklyValue)
    if (serviceLabels.length === 0) {
      warnings.push('No service package was detected from the row.')
      if (matchStatus === 'matched') matchStatus = 'review'
    }

    if (dayCleaned) {
      warnings.push(`Day cleaned noted: ${dayCleaned}`)
    }

    parsedRows.push({
      rowNumber: index + 1,
      lastName,
      address,
      town,
      phone,
      email,
      serviceLabels,
      waterStatus,
      swimReadyDate,
      closeDate,
      accessCode,
      notes,
      workbookDuplicate: false,
      warnings,
      matchStatus,
      matchedProperty,
      matchedCustomer,
    })
  }

  for (const row of parsedRows) {
    const key = `${normalizeAddress(row.address)}__${normalizeTown(row.town) || 'NO_TOWN'}`
    if ((workbookAddressCounts.get(key) || 0) > 1) {
      row.workbookDuplicate = true
      row.warnings = [...row.warnings, 'This address appears more than once in the workbook.']
      if (row.matchStatus === 'matched') {
        row.matchStatus = 'review'
      }
    }
  }

  const summary = {
    totalRows: parsedRows.length,
    matchedRows: parsedRows.filter((row) => row.matchStatus === 'matched').length,
    reviewRows: parsedRows.filter((row) => row.matchStatus === 'review').length,
    unmatchedRows: parsedRows.filter((row) => row.matchStatus === 'unmatched').length,
    duplicateRows: parsedRows.filter((row) => row.workbookDuplicate).length,
    exactPropertyMatches: parsedRows.filter((row) => row.matchedProperty?.matchReason === 'Exact address + town match').length,
    addressOnlyMatches: parsedRows.filter((row) => row.matchedProperty?.matchReason === 'Matched by address only').length,
    customerOnlyMatches: parsedRows.filter((row) => !row.matchedProperty && row.matchedCustomer).length,
  }

  return {
    fileName: params.fileName,
    selectedSheet,
    availableSheets: workbook.SheetNames,
    summary,
    rows: parsedRows,
  }
}
