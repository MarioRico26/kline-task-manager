# Architecture Flows

## System context
Kline Task Manager is a Next.js 16 App Router application running on Vercel.
The platform manages tasks, customers, properties, services, statuses, and automated notifications.

Core runtime components:
- Web UI: Next.js pages under `src/app/*`
- Edge access control: `src/proxy.ts`
- API layer: `src/app/api/*`
- Persistence: PostgreSQL via Prisma
- File storage: Vercel Blob
- Notifications: SMTP email + Twilio SMS

## Request flow (high level)
```mermaid
flowchart LR
  U[Office Staff / Admin] --> W[Next.js UI]
  W --> P[Proxy Auth Guard]
  P --> A[App Routes & API Routes]
  A --> D[(PostgreSQL / Prisma)]
  A --> B[(Vercel Blob)]
  A --> E[SMTP Provider]
  A --> S[Twilio SMS]
```

## Authentication flow
```mermaid
sequenceDiagram
  participant User as User
  participant UI as /auth/login
  participant API as /api/auth/login
  participant DB as PostgreSQL

  User->>UI: Enter email + password
  UI->>API: POST credentials
  API->>DB: find user by email
  API->>API: bcrypt.compare(password)
  API-->>UI: 200 + set cookies user-id/access-scope
  UI-->>User: Redirect to /dashboard or /tasks
```

## Task creation flow (with staged uploads)
```mermaid
sequenceDiagram
  participant Staff as Office Staff
  participant UI as /tasks/new
  participant UAPI as /api/uploads
  participant Blob as Vercel Blob
  participant TAPI as /api/tasks
  participant DB as PostgreSQL
  participant Mail as SMTP
  participant SMS as Twilio

  Staff->>UI: Select customer/property/service + photos
  loop each file
    UI->>UI: Auto-compress image (client-side)
    UI->>UAPI: POST file
    UAPI->>Blob: put file
    Blob-->>UAPI: file URL
    UAPI-->>UI: file URL
  end
  UI->>TAPI: POST task + uploadedImageUrls
  TAPI->>DB: create task + media rows
  alt notifyClient = true
    TAPI->>Mail: sendTaskUpdateEmail
    TAPI->>SMS: sendSMS
  end
  TAPI-->>UI: task created
```

## Sequential workflow flow (permits and other sequences)
```mermaid
sequenceDiagram
  participant Staff as Office Staff
  participant UI as Task View / Case View
  participant API as /api/tasks/[id]
  participant DB as PostgreSQL

  Staff->>UI: Mark step as Completed
  UI->>API: PUT status=Completed
  API->>DB: update current task
  API->>DB: resolve next sequential step
  alt next step exists and not active
    API->>DB: auto-create next task with In Progress/Open
  end
  API-->>UI: updated task + optional next task id
```

## Access-scope flow
- `ALL`: full module access
- `PERMITS_ONLY`: restricted by `src/proxy.ts` and server checks in APIs
- Scope source of truth: latest `AuditLog` (`entity = USER_SCOPE`)

