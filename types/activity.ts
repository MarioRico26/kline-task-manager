export type ActivityType = 
  | 'TASK_CREATED' 
  | 'TASK_UPDATED' 
  | 'TASK_COMPLETED' 
  | 'TASK_DELETED'
  | 'USER_CREATED'
  | 'USER_UPDATED' 
  | 'USER_DELETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'SERVICE_CREATED'
  | 'SERVICE_UPDATED'
  | 'SERVICE_DELETED'

export interface Activity {
  id: string
  type: ActivityType
  description: string
  timestamp: string
  user: string
}