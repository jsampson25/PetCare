# Contributing

PetCare Platform is currently an early-stage product. Every change should keep the product documentation and implementation aligned.

## Working agreement

1. Use a short-lived branch for meaningful changes.
2. Keep commits focused and explain the product reason for the change.
3. Update affected documentation when behavior, terminology, data, or architecture changes.
4. Do not commit credentials, API keys, personal access tokens, customer data, or real pet medical records.
5. Add or update tests in proportion to the risk of the change.

## Definition of done

A change is complete when:

- The intended user outcome is documented.
- Loading, empty, error, and permission-denied states are handled where relevant.
- Tenant boundaries and role permissions are preserved.
- Accessibility and responsive behavior have been considered.
- Automated checks pass.
- Important decisions or compromises are recorded.

## Naming conventions

- Use **booking** as the general transaction term.
- Use **service** for configurable offerings such as boarding, daycare, and grooming.
- Use **business** for the subscribing organization and **location** for a physical facility.
- Use **customer** for the pet owner or household account.
- Use **pet** for the animal receiving services.

Refer to the [glossary](docs/product/glossary.md) before introducing new domain terminology.

