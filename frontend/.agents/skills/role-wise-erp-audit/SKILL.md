
---
name: role-wise-erp-audit
description: Perform senior-level role-wise UI, UX, functional, responsive, accessibility, navigation, and frontend quality audits of the Startup Talent ERP Platform. Use when reviewing, testing, fixing, or improving any role-based application page.
---

# Role-Wise ERP Audit

Act as a senior frontend engineer, QA engineer, and product UX reviewer.

## Product roles

Audit each role independently:

1. Startup
2. Mentor
3. Investor
4. Job Seeker
5. Employer

## Audit requirements

### 1. Page structure
- Inspect all routes and nested pages.
- Identify duplicated components and inconsistent layouts.
- Check whether shared components should be extracted.
- Check file naming and folder organization.
- Verify that each role has a consistent application shell.

### 2. Visual consistency
- Inspect typography, font sizes, weights and line heights.
- Inspect spacing, margins, padding and alignment.
- Check color consistency, borders, shadows and radii.
- Check page headings, cards, tables, forms and dialogs.
- Identify inconsistent components across roles.
- Establish reusable design tokens and component standards.

### 3. Navigation
- Test every sidebar item and navigation link.
- Check active and selected navigation states.
- Test nested navigation and browser back/forward.
- Check direct URL access and refresh behavior.
- Identify broken routes and incorrect redirects.

### 4. Functional testing
- Test every visible button and clickable control.
- Test forms, validation, submission and error states.
- Test search, filters, sorting and pagination.
- Test dropdowns, tabs, modals and notifications.
- Identify placeholder interactions and fake success messages.
- Never assume an action works because an onClick exists.

### 5. Responsive testing
Test at:
- 1440px desktop
- 1024px laptop/tablet
- 768px tablet
- 390px mobile

Identify overflow, broken layouts, inaccessible controls,
and inappropriate mobile navigation.

### 6. Accessibility and UX
- Check semantic HTML and accessible labels.
- Check keyboard navigation and visible focus.
- Check contrast and readable font sizes.
- Check loading, empty, success and error states.
- Evaluate whether a first-time user understands each page.
- Identify confusing labels and unnecessary steps.

### 7. Performance
- Inspect unnecessary React re-renders.
- Identify large client components and bundles.
- Check images, fonts and loading behavior.
- Identify duplicate network requests.
- Check data fetching waterfalls.
- Measure performance where browser tooling is available.

## Rules

- Inspect before modifying code.
- Never invent functionality or pretend a test passed.
- Do not replace real API integrations with mock data.
- Do not remove existing features without approval.
- Preserve existing role permissions and business logic.
- Follow installed Next.js, React and Tailwind versions.
- Reuse shared components instead of creating duplicates.
- Fix root causes rather than hiding visual symptoms.

## Workflow

1. Discover all routes for one role.
2. Build a page inventory.
3. Inspect source code and dependencies.
4. Run the application.
5. Test pages in a real browser.
6. Record screenshots and reproducible defects.
7. Produce a prioritized audit report.
8. Wait for approval before large-scale refactoring.
9. Fix issues in small, logical groups.
10. Rerun tests and compare screenshots.

## Severity

- P0: Security, data exposure or critical application failure.
- P1: Broken primary workflow, navigation or essential action.
- P2: Major UI, UX, responsiveness or performance problem.
- P3: Minor visual inconsistency or polish.

Every finding must include:
- Role
- Page and route
- Issue
- Severity
- Steps to reproduce
- Expected result
- Actual result
- Suggested fix
- Screenshot or evidence, where available
