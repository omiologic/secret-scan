# Conventions

## Feature notes

Use `_notes/features/<feature>/README.md` as a small, temporary staging page for future GitHub Wiki content. Name feature directories with short, descriptive kebab-case names.

Each page has one job: let a reader understand the feature quickly. Keep only what is useful:

- what the feature does and why it exists;
- what works now;
- what is planned or being considered; and
- links to the relevant source, tests, architecture, or work items.

Use `current`, `planned`, `proposed`, or `unknown` when a state label makes the note clearer. Keep the distinction simple:

- `current` is supported by the repository now;
- `planned` has an existing planning source;
- `proposed` is an idea that is not committed; and
- `unknown` needs more information.

Prefer links over copied detail. The source code, repository architecture, and planning records remain authoritative. Do not create separate architecture, resource, requirements, or roadmap documents for every feature; add another file only when the single page genuinely becomes difficult to use.

## Governed convention records

- [Keep feature notes small and useful](conventions/feature-documentation.md)
