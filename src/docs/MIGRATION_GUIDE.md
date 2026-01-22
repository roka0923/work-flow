# Caliper Flow Migration Guide

This guide details the transition from a monolithic file structure to a modular React architecture.

## Changes Overview

| Feature | Old Location | New Location |
|---------|--------------|--------------|
| Job State | `App.jsx` | `src/hooks/useJobs.js` |
| Staff State | `App.jsx` | `src/hooks/useStaff.js` |
| Constants | Multi-defined | `src/config/constants.js` |
| Global Styles | `index.css` | `src/styles/modules/base.css` |
| UI Components | Large components | `src/components/common/`, etc. |

## Step-by-Step Migration

1. **Hooks Adoption**: Replace `useState` and `useEffect` calls in `App.jsx` with the `useJobs` and `useStaff` hooks.
2. **Component Breakdown**:
   - `Dashboard.jsx` now uses `StatCard` and `QueueCard`.
   - `ProcessList.jsx` now handles only layout/filtering and delegates to `JobCard` and `ProcessModals`.
3. **Style Consolidation**: Ensure all global variables are defined in `base.css` and imported correctly via `@import`.

## Verification Checklist

- [ ] All 6 stages on Dashboard show correct counts.
- [ ] Job creation via `JobRequest` works.
- [ ] Status updates and batch updates in `ProcessList` work.
- [ ] Data persists after refresh.
- [ ] Modals (Detail, Edit, Delete) function as expected.
