# Accessibility audit: CIC Nova

**Standard:** WCAG 2.1 AA  
**Date:** 2026-08-10

## Summary

Source audit and responsive browser verification found five systemic issues. All five were remediated in this iteration; no known critical blocker remains. Manual NVDA/VoiceOver and real Safari/iOS verification still require the corresponding external environment.

## Findings and remediation

| Area | WCAG | Severity | Resolution |
|---|---|---:|---|
| Clickable cards were not keyboard reachable | 2.1.1, 4.1.2 | Major | Replaced with explicit buttons or added role, keyboard handlers and accessible names |
| Legacy form labels lacked explicit association | 1.3.1, 3.3.2 | Major | Added runtime association bridge for dynamically rendered legacy fields; new forms use `htmlFor` directly |
| Small green text and green button endpoint had insufficient contrast | 1.4.3 | Major | Added darker accessible semantic green while preserving the bright green as a decorative brand color |
| Icon buttons and compact actions were below the target size | 2.5.5 | Major | Standardized buttons and icon actions to a minimum 44 px target |
| Feedback and destructive confirmation lacked consistent semantics/focus | 2.4.3, 3.3.1, 4.1.2 | Major | Added live-region toasts and an `alertdialog` with focus, Escape and backdrop behavior |

## Keyboard and responsive verification

- Login controls expose labels and logical tab order.
- Project, price-book, template and typology navigation is keyboard operable.
- Dialogs expose name, role and modal state; slide panels trap and restore focus.
- Visible focus styles cover buttons, table links and role-based cards.
- At viewport 390×844 the login page has no horizontal overflow (`scrollWidth = clientWidth = 390`).
- Motion is disabled for toast and skeleton effects when `prefers-reduced-motion` is enabled.

## Required release verification

1. Run NVDA + Edge/Chrome through login, project creation, import preview and quote lifecycle.
2. Run VoiceOver + Safari on an iPhone/iPad.
3. Check 200% zoom on authenticated data tables with staging data.
4. Recheck contrast if brand tokens are changed.
