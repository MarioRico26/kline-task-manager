# Calls Inbox Implementation Plan

## Goal

Introduce the Calls Inbox module safely, without disrupting the current task notification workflows that are already working well in production.

## Guiding Principle

The first delivery should focus on:

- ownership
- follow-up accountability
- call status tracking
- voicemail/transcript readiness

It should not try to become a full phone system or call center product in the first release.

## Recommended Delivery Order

### Step 1: Blueprint and Workflow Validation

Objective:

- confirm the business workflow before code

Work:

- finalize statuses
- finalize assignment policy
- finalize reassignment and email rules
- finalize required fields for v1

Deliverable:

- approved blueprint and field list

### Step 2: Permission Foundation

Objective:

- make the module accessible only to selected staff

Recommended permissions:

- `VIEW_CALLS`
- `MANAGE_CALLS`
- `ASSIGN_CALLS`
- `RESOLVE_CALLS`
- `VIEW_CALL_RECORDINGS`

Deliverable:

- only selected users can see and use Calls Inbox

### Step 3: Module Shell

Objective:

- introduce the module without touching current task behavior

Work:

- add `/calls-inbox`
- add inbox shell
- add dashboard card only for authorized users
- no production integration yet

Deliverable:

- visible isolated module entry point

### Step 4: Core Prisma Model

Objective:

- support call records, callback attempts and activity history

Work:

- add models:
  - `CallRecord`
  - `CallbackAttempt`
  - `CallActivity`
- add enums for:
  - source type
  - call type
  - priority
  - status
  - callback outcome

Deliverable:

- persistence model ready for manual office workflow

### Step 5: Manual Intake MVP

Objective:

- allow office staff to work immediately, even before voicemail ingestion is automated

Work:

- create answered call manually
- create voicemail record manually
- paste transcript manually
- assign or auto-assign to intake owner
- reassign
- update status
- log callback attempts

Deliverable:

- office can stop relying on scattered manual follow-up outside the system

### Step 6: Assignment Notification Emails

Objective:

- make assignment ownership explicit

Work:

- send internal email on:
  - first assignment
  - reassignment
- include:
  - caller
  - phone
  - summary
  - assigned by
  - received time
  - link to record

Deliverable:

- assignees are actively notified when a call record becomes their responsibility

### Step 7: Voicemail Readiness Layer

Objective:

- prepare for voicemail recordings and transcripts

Work:

- support storing:
  - audio reference URL or uploaded file link
  - transcript
  - extracted summary fields

Deliverable:

- system is ready before Xfinity recording workflow is finalized

### Step 8: Ingestion Workflow

Objective:

- move from manual voicemail entry to assisted or semi-automated ingestion

Examples:

- upload voicemail batch
- import transcript text
- later parse names, phone numbers, addresses and service hints

Deliverable:

- less manual re-entry of voicemail content

## First Safe Technical Cut

To avoid risk to the current production system, the first coding phase should be:

1. docs
2. permissions
3. isolated module shell
4. core schema

Only after that should we add:

- real call entry forms
- reassignment workflow
- assignment emails

## Open Decisions

### Office Intake Owner

Need to decide who is the default assignee for ambiguous inbound records.

Suggested setting:

- `defaultCallIntakeOwnerUserId`

### Assignment Email Rules

Need to confirm whether emails should fire on:

- first assignment only
- reassignment only
- both

Recommended:

- both

### Audio Storage Approach

Need to decide whether voicemail recordings will be:

- stored in Blob
- referenced by URL
- attached manually from another source

Recommended first version:

- support URL or upload reference

### Customer Matching Strategy

Need to decide how aggressively we try to auto-link calls to customers/properties.

Recommended first version:

- manual linking
- optional suggested matching later

## Success Criteria for Phase 1

Phase 1 should be considered successful when:

- the module is visible only to selected users
- office staff can register answered calls and voicemails manually
- every record has an owner
- reassignment is tracked
- callback attempts are logged
- activity history is visible
- the module is ready to receive voicemail transcripts and audio references later
