export type CallSourceOption = {
  value: 'ANSWERED_CALL' | 'VOICEMAIL' | 'MISSED_CALL'
  label: string
  description: string
}

export type CallStatusOption = {
  value:
    | 'NEW'
    | 'TRIAGE_REQUIRED'
    | 'ASSIGNED'
    | 'CALLBACK_PENDING'
    | 'CALLBACK_ATTEMPTED'
    | 'WAITING_ON_CUSTOMER'
    | 'RESOLVED'
    | 'CLOSED'
    | 'SPAM'
  label: string
  description: string
}

export const callSourceOptions: CallSourceOption[] = [
  {
    value: 'ANSWERED_CALL',
    label: 'Answered Call',
    description: 'Office staff answered the call and logs the follow-up manually.',
  },
  {
    value: 'VOICEMAIL',
    label: 'Voicemail',
    description: 'Inbound voicemail with transcript and optional recording reference.',
  },
  {
    value: 'MISSED_CALL',
    label: 'Missed Call',
    description: 'Inbound call was not answered and requires triage or callback ownership.',
  },
]

export const callStatusOptions: CallStatusOption[] = [
  { value: 'NEW', label: 'New', description: 'Fresh record waiting for initial review.' },
  { value: 'TRIAGE_REQUIRED', label: 'Triage Required', description: 'Needs office intake review and classification.' },
  { value: 'ASSIGNED', label: 'Assigned', description: 'An owner has been assigned to the record.' },
  { value: 'CALLBACK_PENDING', label: 'Callback Pending', description: 'Waiting for a callback to happen.' },
  { value: 'CALLBACK_ATTEMPTED', label: 'Callback Attempted', description: 'A follow-up call was attempted and logged.' },
  { value: 'WAITING_ON_CUSTOMER', label: 'Waiting on Customer', description: 'Team is waiting for customer response or confirmation.' },
  { value: 'RESOLVED', label: 'Resolved', description: 'Operational follow-up is complete.' },
  { value: 'CLOSED', label: 'Closed', description: 'Record is fully closed and archived operationally.' },
  { value: 'SPAM', label: 'Spam', description: 'Irrelevant or spam call.' },
]

export const callTypeOptions = [
  'CUSTOMER_SERVICE',
  'ESTIMATE_REQUEST',
  'BILLING',
  'VENDOR',
  'MUNICIPAL',
  'INTERNAL',
  'RETAIL_QUESTION',
  'UNKNOWN',
] as const

export const callPriorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export const callbackOutcomeOptions = [
  'NO_ANSWER',
  'LEFT_VOICEMAIL',
  'SPOKE_TO_CALLER',
  'WRONG_NUMBER',
  'CALL_BACK_LATER',
] as const

export const voicemailImportBatchStatusOptions = [
  'IMPORTED',
  'REVIEW_IN_PROGRESS',
  'READY_TO_PROMOTE',
  'PARTIALLY_PROMOTED',
  'COMPLETED',
] as const

export const voicemailImportItemStatusOptions = [
  'IMPORTED',
  'REVIEW_REQUIRED',
  'READY_TO_CREATE',
  'CREATED_AS_CALL_RECORD',
  'SKIPPED',
  'DUPLICATE',
] as const

export const audioTranscriptionStatusOptions = [
  'NOT_APPLICABLE',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const

export type CallsInboxRecord = {
  id: string
  sourceType: string
  status: string
  priority: string
  callType: string
  receivedAt: string
  phoneNumber: string | null
  callerNameRaw: string | null
  summary: string
  transcriptRaw: string | null
  internalNotes: string | null
  detectedAddress: string | null
  detectedTown: string | null
  detectedServiceCategory: string | null
  assignedToUserId: string | null
  assignedToUser: { id: string; email: string } | null
  customer: { id: string; fullName: string } | null
  property: { id: string; address: string; city: string; state: string } | null
  relatedTask: {
    id: string
    serviceName: string | null
    statusName: string | null
    scheduledFor: string | null
  } | null
  latestNextFollowUpAt: string | null
  isFollowUpOverdue: boolean
  isFollowUpDueToday: boolean
  ageInHours: number
  ageLabel: string
  ageBucket: 'UNDER_4_HOURS' | 'FOUR_TO_TWENTY_FOUR_HOURS' | 'ONE_TO_TWO_DAYS' | 'OVER_TWO_DAYS'
  isSlaWarning: boolean
  isSlaBreached: boolean
  callbackAttemptCount: number
  activityCount: number
}

export type CallsInboxApiResponse = {
  records: CallsInboxRecord[]
  currentUserId: string | null
  moduleReady: boolean
  message?: string
}

export type CallActivityRecord = {
  id: string
  actionType: string
  fromValue: string | null
  toValue: string | null
  note: string | null
  createdAt: string
  createdByUser: { id: string; email: string } | null
}

export type CallbackAttemptRecord = {
  id: string
  attemptedAt: string
  outcome: string
  notes: string | null
  nextFollowUpAt: string | null
  attemptedByUser: { id: string; email: string } | null
}

export type CallsInboxDetailRecord = CallsInboxRecord & {
  requestedAction: string | null
  detectedAddress: string | null
  detectedTown: string | null
  activities: CallActivityRecord[]
  callbackAttempts: CallbackAttemptRecord[]
}

export type CallsInboxDetailApiResponse = {
  record: CallsInboxDetailRecord | null
  currentUserId: string | null
  moduleReady: boolean
  message?: string
}

export type VoicemailImportBatchRecord = {
  id: string
  source: string
  status: string
  notes: string | null
  itemCount: number
  processedCount: number
  errorCount: number
  uploadedAt: string
  uploadedByUser: { id: string; email: string } | null
  counts: {
    reviewRequired: number
    readyToCreate: number
    created: number
    skipped: number
    duplicate: number
  }
}

export type VoicemailImportItemRecord = {
  id: string
  recordedAt: string | null
  phoneNumberRaw: string | null
  callerNameRaw: string | null
  transcriptRaw: string | null
  audioUrl: string | null
  audioFileName: string | null
  audioMimeType: string | null
  audioSizeBytes: number | null
  transcriptionStatus: string
  transcriptionError: string | null
  summaryDraft: string | null
  detectedAddress: string | null
  detectedTown: string | null
  detectedServiceCategory: string | null
  status: string
  reviewNotes: string | null
  reviewedAt: string | null
  reviewedByUser: { id: string; email: string } | null
  createdCallRecordId: string | null
}

export type VoicemailImportsListApiResponse = {
  batches: VoicemailImportBatchRecord[]
  moduleReady: boolean
  message?: string
}

export type VoicemailImportBatchDetailApiResponse = {
  batch: VoicemailImportBatchRecord | null
  items: VoicemailImportItemRecord[]
  moduleReady: boolean
  message?: string
}

export function formatEnumLabel(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
