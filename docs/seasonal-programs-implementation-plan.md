# Seasonal Programs Implementation Plan

## Goal

Deliver the Seasonal Programs module incrementally, starting with a secure foundation and a clean integration path into the existing customer/property/task platform.

## Implementation Order

### Step 1: Permission Foundation

Objective:

- Gate the new module to selected users only

Work:

- Extend current user access model beyond planner-only style exceptions
- Introduce support for:
  - `VIEW_SEASONAL_PROGRAMS`
  - `MANAGE_SEASONAL_PROGRAMS`
  - `IMPORT_SEASONAL_PROGRAMS`
- Add enforcement in:
  - session user resolution
  - proxy/route protection
  - dashboard visibility
  - user administration UI

Deliverable:

- Users can be granted or denied Seasonal Programs access
- Module is invisible and inaccessible without permission

### Step 2: Module Shell

Objective:

- Introduce the module without importing Excel yet

Work:

- Add `/seasonal-programs`
- Add category entry cards:
  - Irrigation
  - Maintenance
  - Pool Services
- Add placeholder metrics and empty-state structure

Deliverable:

- Accessible shell for the new module
- Navigation and security path verified end to end

### Step 3: Prisma Domain Model

Objective:

- Add the data structures needed for recurring seasonal operations

Work:

- Add models for:
  - Program
  - ProgramSeason
  - Enrollment
  - EnrollmentService
  - Occurrence
  - Issue
- Keep notification tasks independent
- Add optional linkage fields for task origins later if needed

Deliverable:

- Schema ready for migration and UI/API work

### Step 4: Roster UI MVP

Objective:

- Create operational visibility before automation

Work:

- Program dashboard
- Program roster table
- Enrollment detail page
- Basic filters

Deliverable:

- Staff can browse and inspect active seasonal program data

### Step 5: Import MVP

Objective:

- Bring active 2026 spreadsheets into the system

Import targets:

- Irrigation:
  - `2026  IRRIGATION`
- Maintenance:
  - `2026 CLEAN UPS`
- Pool:
  - `2026 MAIN LIST`

Work:

- Parse workbook source
- Normalize rows
- Match to existing customers/properties
- Create enrollments and services
- Produce import preview before final commit

Deliverable:

- Operational 2026 roster inside the system

### Step 6: Issues and Exceptions

Objective:

- Track the repair/problem side of operations

Import targets:

- Irrigation repairs/service calls
- Pool problems/repairs

Deliverable:

- Issues visible inside enrollment detail and execution views

### Step 7: Notification Integration

Objective:

- Allow operational events to generate communication when needed

Work:

- Create notification actions from occurrences/issues
- Reuse existing task/email/SMS engine
- Preserve general notifications as a separate workflow

Deliverable:

- Seasonal Programs can trigger communication without replacing Task Management

## First Recommended Technical Cut

For the first implementation pass, focus on:

1. Permission foundation
2. Seasonal Programs module shell
3. Blueprint docs in repo

This is the safest cut because it:

- avoids premature schema complexity
- proves the access model
- creates visible progress
- does not yet commit us to irreversible import assumptions

## Open Decisions

The following should be finalized before schema implementation:

### Program Permission Model

Decide whether access is:

- broad:
  - one permission for all Seasonal Programs
- granular:
  - separate permissions for irrigation, maintenance, pool

Recommended first version:

- one broad Seasonal Programs permission

### User Editing Experience

Decide whether permissions should appear as:

- simple toggles
- grouped permission blocks
- role presets plus overrides

Recommended first version:

- grouped permission blocks with a small number of toggles

### Import Matching Strategy

Decide whether imports match properties primarily by:

- exact address
- normalized address
- invoice number plus address

Recommended first version:

- normalized address with manual exception handling

## Success Criteria for Phase 1

Phase 1 should be considered successful when:

- selected users can access Seasonal Programs
- non-authorized users cannot see or open it
- the dashboard reflects access correctly
- the new module shell exists cleanly in production
- the repo contains agreed system documentation for the module
