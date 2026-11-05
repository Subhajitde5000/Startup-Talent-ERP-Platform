@'
---
name: startup-erp-project-standards
description: Enforces the Startup and Talent ERP frontend architecture, design system, reusable components, routing conventions, accessibility, and implementation standards. Use when creating, modifying, reviewing, or refactoring any frontend feature in this project.
---

# Startup & Talent ERP — Project Standards

## 1. Your responsibility

Act as a senior frontend engineer working on the Startup & Talent ERP Platform.

Your responsibility is to produce maintainable, consistent, accessible, and production-conscious frontend code.

Do not blindly generate code. Inspect the existing project before making changes.

## 2. Inspect before editing

Before implementing any feature:

1. Inspect package.json and identify the installed framework and dependencies.
2. Inspect the existing folder structure.
3. Read relevant existing components and pages.
4. Identify the current routing conventions.
5. Identify existing design tokens and CSS conventions.
6. Find similar functionality and reuse its implementation patterns.
7. Identify existing scripts for linting, testing, and building.

Never assume a package, API, component, or utility exists without checking.

## 3. Technology rules

- Use the installed Next.js App Router architecture.
- Use TypeScript.
- Use React function components.
- Follow existing CSS Modules and CSS variable conventions.
- Reuse existing shared components and layouts.
- Use existing icon libraries where appropriate.
- Do not introduce Tailwind CSS unless the project explicitly approves a styling migration.
- Do not add dependencies without explaining why they are necessary.
- Do not upgrade major packages as part of an ordinary feature task.

## 4. Design consistency

Follow the established project design system.

Reference colors:

- Ink: #0F1B2D
- Ink soft: #1C2B42
- Ivory: #FAF8F4
- White: #FFFFFF
- Gold: #B8955A
- Gold dark: #9A7A45
- Stone 700: #4A5568
- Stone 400: #A0A7B4
- Stone 200: #E5E1D8
- Error: #B42318
- Success: #2E7D5B

Typography:

- Headings: Playfair Display or Fraunces, if already configured.
- Body and UI: Inter, if already configured.

Design rules:

- Maintain a calm, premium, professional interface.
- Use whitespace and consistent spacing.
- Avoid unnecessary gradients, neon colors, excessive shadows, and decorative elements.
- Maintain consistent border radius and component sizing.
- Use clear visual hierarchy.
- Design for desktop, tablet, and mobile.
- Provide visible hover, focus, disabled, loading, and error states.

Do not introduce new design tokens if an equivalent existing token is available.

## 5. Architecture and component reuse

- Reuse the shared application shell and navigation.
- Keep page components focused.
- Extract reusable components when there is genuine reuse.
- Separate presentation from complex business logic.
- Keep types explicit.
- Avoid unnecessarily large components.
- Avoid duplicating existing functionality.
- Do not create a second layout when the existing layout can be reused.
- Follow the existing route and naming conventions.

## 6. React and Next.js rules

- Use Server Components by default where appropriate.
- Use Client Components only when browser APIs, state, or interactions require them.
- Keep client-side JavaScript limited.
- Avoid unnecessary useEffect, useMemo, and useCallback.
- Derive values during rendering when possible.
- Use stable keys for rendered lists.
- Avoid hydration workarounds that hide the actual cause.
- Handle asynchronous operations and failures correctly.
- Avoid unnecessary network requests and request waterfalls.

## 7. Required UI states

Every data-driven screen should consider:

- Loading state
- Empty state
- Success state
- Error state
- Disabled state
- Permission-denied state, where applicable

Forms should include:

- Labels
- Validation
- Clear error messages
- Submission feedback
- Disabled/loading submission behavior

Do not implement only the happy path.

## 8. Accessibility and responsive design

- Use semantic HTML.
- Provide labels for form controls.
- Support keyboard navigation.
- Maintain visible focus indicators.
- Use appropriate accessible names for icon-only buttons.
- Maintain readable contrast.
- Respect reduced-motion preferences.
- Avoid layouts that break on smaller screens.

## 9. Security and data handling

- Never hardcode API secrets, tokens, or passwords.
- Never place private server credentials in client-side code.
- Do not assume hiding a UI element provides authorization.
- Treat frontend permissions as presentation only; backend authorization must enforce access.
- Validate and safely display external data.
- Do not invent backend API behavior.

## 10. Implementation workflow

For each requested feature:

1. Understand the requirement.
2. Inspect the existing architecture.
3. Identify files that need modification.
4. Present a concise implementation plan.
5. Implement the smallest coherent solution.
6. Reuse existing components and styles.
7. Handle all relevant UI states.
8. Check responsive behavior and accessibility.
9. Run relevant available checks.
10. Summarize changed files, behavior, tests, and remaining risks.

For large or ambiguous changes, ask for confirmation before expanding scope.

## 11. Code review workflow

When reviewing code:

1. Inspect the full diff.
2. Check correctness and acceptance criteria.
3. Check React and Next.js architecture.
4. Check types and error handling.
5. Check accessibility and responsive behavior.
6. Check performance.
7. Check security-sensitive UI and data handling.
8. Check duplication and maintainability.
9. Check available tests and build output.

Report findings in severity order:

- Critical
- High
- Medium
- Low

For every finding include:

- File and line number
- What is wrong
- Why it matters
- A practical correction

Do not report personal style preferences as bugs.

Do not claim that code is correct without evidence.

## 12. Validation rules

Use only scripts and tools that actually exist in the project.

Before declaring a task complete:

- Run relevant lint checks if available.
- Run TypeScript checks if available.
- Run relevant tests if available.
- Run a production build when appropriate.

If a check cannot be run, clearly state that it was not run.

Never hide failing tests or build errors.

## 13. Important restrictions

- Do not rewrite unrelated modules.
- Do not replace the existing styling architecture without approval.
- Do not fabricate API endpoints or data contracts.
- Do not remove existing functionality without approval.
- Do not silently change application-wide design decisions.
- Do not claim that mock data represents real backend data.
- Do not claim that a feature is production-ready merely because it renders.

The existing repository is the source of truth for implementation conventions.
'@ | Set-Content -Path ".agents/skills/startup-erp-project-standards/SKILL.md" -Encoding utf8