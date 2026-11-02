# React migration and browser testing

Hekomi is being migrated incrementally. The current HTML/vanilla-JavaScript application and Node server remain the production baseline while React components are introduced in small, reviewable slices. Avoid replacing the complete UI or backend in one change.

## React migration guardrails

- Keep the Node server, OAuth/session flow, MAL integration, manga adapters, catalog endpoints, and existing local data formats intact.
- Migrate one isolated UI area at a time; do not mount React over DOM nodes still managed by existing scripts.
- Keep Hekomi-chan and calendar scripts working until their own migration is explicitly planned and covered.
- Normalize API data at the boundary and validate arrays before mapping/rendering them.
- For each migrated slice, cover loading, empty, error, and success states.
- Run the existing validation workflow and the Playwright suite before merging.

## Headless browser tests

Install dependencies and the Chromium browser, then run:

```sh
npm install
npx playwright install chromium
npm run test:e2e
```

The Playwright configuration starts Hekomi with its existing Node server and checks the current landing workspace on desktop and mobile Chromium. CI installs the browser and runs the suite on pull requests.

These are migration baseline checks—not a claim that the React UI has been fully mounted or that all application workflows are covered yet. Extend the suite alongside each migrated component and workflow.