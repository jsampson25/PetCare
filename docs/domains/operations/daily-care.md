# Daily Care and Tasks

## Task engine requirements

| ID         | Priority | Requirement                                                                                                                   |
| ---------- | -------: | ----------------------------------------------------------------------------------------------------------------------------- |
| OPS-FR-040 |       P0 | Care-plan snapshots and service templates shall generate dated tasks with due windows, priority, skill/role, and pet context. |
| OPS-FR-041 |       P0 | Managers shall create, edit, reassign, cancel, and add ad-hoc tasks subject to audit rules.                                   |
| OPS-FR-042 |       P0 | Staff shall complete a task with structured outcome, actual time, notes, and evidence when required.                          |
| OPS-FR-043 |       P0 | The system shall escalate approaching-due, overdue, missed, refused, failed, and blocked tasks according to severity.         |
| OPS-FR-044 |       P0 | Task changes shall not silently alter already completed or clinically/safety-significant history.                             |

## Feeding requirements

| ID         | Priority | Requirement                                                                                                                      |
| ---------- | -------: | -------------------------------------------------------------------------------------------------------------------------------- |
| OPS-FR-045 |       P0 | Meal tasks shall display food source, amount, preparation, supplements, allergy, separate-feeding, and handling instructions.    |
| OPS-FR-046 |       P0 | Staff shall record offered and consumed amount, appetite outcome, water, reaction, notes, and actual time.                       |
| OPS-FR-047 |       P0 | Refusal, vomiting, diarrhea, supply shortage, or preparation discrepancy shall create configured observation/exception workflow. |
| OPS-FR-048 |       P0 | Batch meal preparation may be supported, but completion requires pet-specific verification.                                      |

## Medication requirements

| ID         | Priority | Requirement                                                                                                                           |
| ---------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| OPS-FR-049 |       P0 | Medication tasks shall display pet, medication, dose, unit, route, window, food dependency, storage, and special instructions.        |
| OPS-FR-050 |       P0 | Administration shall verify the correct pet, medication, dose, route, and scheduled time before completion.                           |
| OPS-FR-051 |       P0 | Staff shall record actual time, administrator, administered dose, result, refusal/missed reason, reaction, and witness when required. |
| OPS-FR-052 |       P0 | Critical overdue, missed, incorrect, or adverse medication outcomes shall escalate immediately under configured rules.                |
| OPS-FR-053 |       P0 | Medication administration cannot be completed through generic task bulk actions.                                                      |

## Activity, elimination, and wellness

| ID         | Priority | Requirement                                                                                                                                             |
| ---------- | -------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPS-FR-054 |       P0 | Staff shall record potty/elimination outcome, activity, enrichment, rest, mood, and wellness observations using configured structured options.          |
| OPS-FR-055 |       P0 | Concerning appetite, elimination, mobility, hydration, respiratory, skin/coat, injury, or behavior observations shall trigger thresholds and follow-up. |
| OPS-FR-056 |       P0 | Observations shall retain source, context, actual time, staff member, visibility, and any linked incident.                                              |

## Cleaning and turnover

| ID         | Priority | Requirement                                                                                                              |
| ---------- | -------: | ------------------------------------------------------------------------------------------------------------------------ |
| OPS-FR-057 |       P0 | Resource release shall create applicable cleaning, sanitation, setup, and inspection tasks.                              |
| OPS-FR-058 |       P0 | Staff shall record checklist completion, products/protocol references, result, actual time, and inspector when required. |
| OPS-FR-059 |       P0 | Failed inspection shall return the resource to cleaning-required state and block assignment.                             |

## Care rules

- Due windows are explicit; a task completed outside its window is not automatically considered compliant.
- A skipped task requires an allowed reason and appropriate permission.
- Staff cannot document care for a pet not in care or outside their authorized location/area without controlled correction.
- Customer-facing updates never imply medication success when the outcome was refused, missed, or uncertain.
- Operational observations are not veterinary diagnoses.
- Critical alerts remain visible even when a staff member filters the task list.

## Implemented E10 task foundation

- `care_tasks` binds feeding and medication work to the active pet visit and immutable check-in snapshot.
- Scheduling requires an explicit due window inside the visit. The platform never guesses medication times from free-text profile instructions.
- Feeding and medication use separate permissions, allowed outcome sets, and pet-specific completion.
- Medication completion requires explicit five-rights verification and is never available as a generic bulk action.
- `care_task_events` preserves scheduling, start, outcome, escalation, and future correction history under idempotent request keys.
- Refused, missed, unable, or adverse outcomes create durable operational alerts; medication exceptions escalate as critical.
- `visit_observations` records activity, elimination, rest, and wellness facts with actual time, author, concern level, and customer-visibility intent.
- Urgent and critical observations automatically enter the operational alert queue. Acknowledgement records ownership but does not hide an unresolved alert.
- Alert resolution requires written evidence; critical alerts additionally require an owner or manager.
- Manager corrections append a correction record and event while preserving the originally recorded feeding or medication outcome.

## Implemented E11 turnover foundation

- Checkout creates one turnover task after the final active assignment releases a resource.
- The Turnover workspace separates cleaning-required, cleaning, inspection-required, and ready states.
- Cleaning completion requires debris removal, washing, disinfection, drying, setup reset, and a protocol/product reference.
- A cleaned resource remains unavailable until an owner or manager records a complete inspection.
- Passing inspection releases the resource to `ready`; failing inspection returns it to `cleaning_required` and retains the failure reason.
- Append-only turnover events preserve staff, timestamps, checklists, and transition evidence.
- Idempotency keys prevent duplicate starts, completions, inspections, or release transitions.

## Acceptance scenarios

| ID         | Scenario                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| OPS-AT-040 | A meal refusal triggers a follow-up observation and manager alert after the configured pattern.                   |
| OPS-AT-041 | A medication due-window passes; escalation occurs and late administration records both scheduled and actual time. |
| OPS-AT-042 | A batch feeding workflow cannot complete the wrong pet's meal.                                                    |
| OPS-AT-043 | A failed kennel inspection blocks reassignment until recleaning passes.                                           |
