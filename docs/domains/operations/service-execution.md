# Boarding, Daycare, and Grooming Execution

## Boarding

| ID | Priority | Requirement |
|---|---:|---|
| OPS-FR-060 | P0 | Boarding staff shall see expected arrivals, current stays, housing, due care, alerts, departures, and occupancy context. |
| OPS-FR-061 | P0 | A boarding pet shall have a housing assignment or documented temporary holding state after check-in. |
| OPS-FR-062 | P0 | Staff shall record settling assessment and create follow-up for anxiety, appetite, elimination, or handling concerns. |
| OPS-FR-063 | P0 | Housing moves shall validate compatibility and preserve history. |
| OPS-FR-064 | P0 | Departure preparation shall schedule final care, belongings, report card, optional departure service, and readiness checks. |

## Daycare

| ID | Priority | Requirement |
|---|---:|---|
| OPS-FR-065 | P0 | Daycare staff shall manage attendance, arrival/departure, evaluation status, playgroup eligibility, rotation, rest, and alerts. |
| OPS-FR-066 | P0 | Playgroup assignment shall enforce size/behavior/evaluation constraints, group capacity, area readiness, and staff ratio rules. |
| OPS-FR-067 | P0 | Staff shall record group start/end, participating pets/staff, activities, observations, removals, timeouts, and incidents. |
| OPS-FR-068 | P0 | A pet removed for safety shall not return until the configured review/approval occurs. |
| OPS-FR-069 | P0 | Daycare attendance shall distinguish booked, arrived, in group, resting, one-on-one, ready, departed, and no-show states. |

## Grooming

| ID | Priority | Requirement |
|---|---:|---|
| OPS-FR-070 | P0 | Groomers shall see an ordered production board with arrival, intake, service, drying/processing, quality review, ready, and pickup states. |
| OPS-FR-071 | P0 | Grooming intake shall record coat/skin condition, requested style, sensitivities, matting, risks, estimates, and approvals. |
| OPS-FR-072 | P0 | Material service/price changes discovered at intake shall require authorized customer/staff approval through Booking/Pricing. |
| OPS-FR-073 | P0 | Grooming execution shall record assigned groomer, actual start/end, steps, add-ons, notes, photos, exceptions, and result. |
| OPS-FR-074 | P0 | Quality review shall verify requested/approved work and unresolved safety or customer-contact items before ready status. |

## Shared service rules

- Service execution begins only after check-in or approved operational intake.
- Actual service timestamps and assigned staff are recorded independently from schedule.
- An operational workflow may suggest an add-on but cannot charge it without authorized Booking/Pricing/Payments changes.
- Staff cannot move a pet into a playgroup, kennel, or grooming phase that violates a hard safety constraint.
- Combined services remain separate booking/service executions connected by one visit and dependency order.
- Ready-for-pickup means care/service requirements are complete, not that payment or authorization is resolved.

## Acceptance scenarios

| ID | Scenario |
|---|---|
| OPS-AT-060 | A boarding pet moves kennels after maintenance while care tasks and history remain intact. |
| OPS-AT-061 | A daycare pet is removed after behavior escalation and cannot rejoin until manager review. |
| OPS-AT-062 | Grooming intake finds severe matting; customer approves changed service/price before execution continues. |
| OPS-AT-063 | A boarding-plus-grooming visit completes each service separately and coordinates one checkout. |

