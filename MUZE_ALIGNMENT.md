# Muze alignment: simplyflow

> Initial alignment roadmap. It is intended as a practical maintenance document, not as a complete code audit.

## Muze design principles

Muze builds web software for technically curious non-professional programmers, without making the tools unattractive to professionals.

We prefer:

- simplicity over completeness
- small, decoupled, single-concern libraries
- correct abstractions that do not cross conceptual boundaries
- browser-native standards where possible
- lightweight abstractions only when they make developer code simpler
- stable, long-term APIs
- components and frameworks that are easy to adapt or replace
- standards-based or open-source hosting stacks that avoid lock-in
- software small enough to work well on slow devices and connections
- a view-source philosophy: invite developers to look under the hood and learn

When making tradeoffs, prefer composability, replaceability, web-platform alignment, and long-term simplicity over convenience, popularity, or feature completeness.


## Muze package namespace policy

The `@muze-nl` npm namespace should be a trust signal. Packages published there should be close to production-ready: the public API is expected to be stable, the package can be installed and used by a fresh project, and the README should be clear about supported usage.

Experimental libraries should use the `@muze-labs` namespace until they are mature enough to carry the main Muze production-readiness signal. Moving from `@muze-labs` into `@muze-nl` should be treated as a release-readiness decision, not only a naming cleanup.

## Current assessment

SimplyFlow is powerful and useful, but it sits close to framework territory. It includes signals/effects, reactive databinding, and model helpers such as paging/sorting/filtering/columns. The main alignment task is to split and document these as composable layers rather than one large concept.

## Strengths

- Uses vanilla JavaScript concepts rather than requiring a large frontend framework.
- Signals/effects can be a small and useful primitive for browser apps.
- Databinding and model helpers solve real application problems.
- The README says it can be used standalone, which fits Muze’s decoupled-library goal.

## Alignment issues

### 1. Split the conceptual surface into explicit packages or modules

**Principle:** Small, decoupled, single-concern libraries.

**Problem:** State, effects, binding, model, paging, sort, filter, and columns were originally implemented and published as one package surface.

**Why it matters:** The library risks becoming a lightweight framework without a clear boundary.

**Suggested direction:** Document or package layers separately: `state`, `bind`, `model`, and optional app helpers. Make each usable and explainable on its own.

**Status:** Done

**Decision:** The repository is now a workspace monorepo. The core layers live in separate packages: `@muze-labs/simplyflow-state`, `@muze-labs/simplyflow-bind`, `@muze-labs/simplyflow-model`, and `@muze-labs/simplyflow-app`. The main `@muze-labs/simplyflow` package is kept as a compatibility and beginner-friendly convenience package that re-exports those layers through stable subpaths such as `@muze-labs/simplyflow/state`, `@muze-labs/simplyflow/bind`, and `@muze-labs/simplyflow/model`.

The split is intentionally conservative: tightly coupled binding internals such as `bind/render`, `bind/transformers`, and `dom` remain together in the bind package; app-layer helpers such as routes, commands, actions, behaviors, includes, shortcuts, path, suggest, and highlight remain together in the app package until their boundaries are clearer.

### 1a. Keep package entry points tree-shakeable where possible

**Principle:** Small software, composability, and usage simplicity without unnecessary bundle cost.

**Problem:** Splitting code into packages helps, but bundlers can only remove unused code reliably when entry points are pure ESM and modules avoid top-level side effects.

**Why it matters:** Developers should be able to use only the state, binding, model, or app layer they need. This keeps SimplyFlow useful for small pages and slow connections, while preserving a simple beginner-facing import.

**Suggested direction:** Mark side-effect-free packages with `"sideEffects": false`; keep the main package as thin re-exports for subpath imports; isolate intentionally side-effectful browser-global behavior.

**Status:** Done

**Decision:** `@muze-labs/simplyflow-state`, `@muze-labs/simplyflow-bind`, `@muze-labs/simplyflow-model`, and `@muze-labs/simplyflow-app` are ESM packages marked `"sideEffects": false`. The main `@muze-labs/simplyflow` package exposes stable subpaths that re-export those packages, while its root entry point remains the script-tag/global convenience entry point.

`render.mjs` is deliberately not treated as side-effect-free, because importing it registers the `<simply-render>` custom element. The main package declares side-effectful files explicitly rather than marking the whole package as pure.

### 1b. Keep beginner no-build examples simple

**Principle:** Usage simplicity first, with an optimization path for experienced developers.

**Problem:** After the package split, source-based browser examples needed a large import map so the browser could resolve every split package and internal subpath. That made the beginner journey look more complex than the app code itself.

**Why it matters:** The HNPWA examples are meant to show how little code is needed to build a real app. A long import map teaches package plumbing before it teaches SimplyFlow.

**Suggested direction:** Beginner/no-build examples should import only the complete `@muze-labs/simplyflow` browser bundle and any external library they directly use, such as Metro. Reference docs and advanced examples can still show tree-shakeable subpath imports and direct split-package imports.

**Status:** Done

**Decision:** The HNPWA and datagrid examples now map only `@muze-labs/simplyflow` to `packages/simplyflow/dist/simply.flow.js` plus the external libraries they directly use, such as Metro. This deliberately trades tree-shaking for a simpler no-build learning path. The edit demo is the exception because it demonstrates the separate `@muze-labs/simplyedit` package. The tree-shakeable path remains documented through `@muze-labs/simplyflow/state`, `@muze-labs/simplyflow/bind`, `@muze-labs/simplyflow/model`, and the direct split packages.


### 1c. Keep beginner examples on the app-level API

**Principle:** Usage simplicity and correct abstraction boundaries.

**Problem:** Some examples still used the lower-level `bind()` API directly with a custom `data-flow-*` prefix, even though they were otherwise written as `simply.app()` examples.

**Why it matters:** Beginners should learn one coherent path first: create an app, put data in `app.data`, and use `data-simply-*` attributes. Dropping to `bind()` early makes the app API look incomplete and exposes lower-level binding details before they are needed.

**Suggested direction:** Beginner examples should use `data-simply-field`, `data-simply-edit`, `data-simply-list`, and `data-simply-transform`; they should pass data and custom transformers to `simply.app()` and let the app's default binding run automatically. Lower-level `bind()` examples, including keyed `data-simply-map` examples, remain useful in advanced/reference documentation.

**Status:** Done

**Decision:** The beginner-facing examples now use `data-simply-*` attributes and `simply.app({ data, transformers })`. The app constructor forwards `transformers` to its default binding, so examples no longer need a separate `simply.bind()` call just to configure custom binding transforms.

Beginner documentation now treats `data-simply-list` as the normal collection concept and avoids introducing `data-simply-map` there. The reference documentation keeps `data-simply-map`, but defines it specifically as keyed-object rendering. This avoids making object/list behavior mysterious for linked data, where a single object may simply mean “one value”.

### 2. Clarify relationship to SimplyView and Muze projects

**Principle:** Replaceability and framework boundaries.

**Problem:** The README says SimplyFlow is intended for SimplyView but can be used standalone, and may be integrated into SimplyView once vetted.

**Why it matters:** Users need to know whether this is a stable standalone library or an experimental framework component.

**Suggested direction:** Add a “Relationship to SimplyView” section with current status and future compatibility promise.

**Status:** Open

### 3. Replace direct `src/` imports in public examples with stable imports

**Principle:** Stable APIs.

**Problem:** Earlier README examples imported from `simplyflow/src/state.mjs`, `src/bind.mjs`, and `src/model.mjs`.

**Why it matters:** Importing from source files exposes internal layout as public API and makes refactoring harder.

**Suggested direction:** Define stable export paths and update examples to use them. Keep source-path imports only in internal docs.

**Status:** Done

**Decision:** The package is now published as `@muze-labs/simplyflow`, with stable entry points such as `@muze-labs/simplyflow`, `@muze-labs/simplyflow/state`, `@muze-labs/simplyflow/bind`, and `@muze-labs/simplyflow/model`. Public docs and examples now use those package names instead of `simplyflow/src/...` imports.

### 4. Add a minimal mental model document

**Principle:** View-source learnability.

**Problem:** Reactivity and databinding can become magical if the propagation model is not explained.

**Why it matters:** Curious developers should be able to predict when effects run and how DOM updates happen.

**Suggested direction:** Add a “How SimplyFlow works” guide: signals, effects, batching, binding lifecycle, cleanup, and model transformations.

**Status:** Open

### 5. Define production-readiness and experimental boundaries

**Principle:** Stable APIs and user trust.

**Problem:** The README warns the project is experimental and not for production unless users can fix problems themselves.

**Why it matters:** That honesty is good, but a Muze roadmap should say what must be done to change that status.

**Suggested direction:** Add a checklist for moving from experimental to stable: tests, import paths, docs, examples, API freeze, browser support, package metadata.

**Status:** Open

## Open questions

- Is SimplyFlow part of Muze’s core stack, or a transitional dependency for current apps?
- Should the app helper package eventually split further into routes, commands, includes, and shortcuts?
- Should `bind` eventually accept generic signal-like adapters instead of depending directly on `state`?

## Non-goals

- Do not become a full frontend framework unless that is a deliberate separate project.
- Do not hide DOM/browser behavior behind opaque magic.
- Do not make all Muze apps depend on SimplyFlow by accident.

## Review cadence

Review this document before feature work, before releases, and whenever the public API or dependency surface changes. Close issues by changing their status to `Done` and leaving a short note about the decision.


### Prefer editable positive state in examples

**Status:** Done

Column visibility now uses `visible` as the public model option. Columns remain
visible by default (`visible !== false`), but examples that expose visibility in
the UI use explicit `visible: true` / `visible: false` booleans and bind
checkboxes with `data-simply-edit`. This keeps beginner examples command-free
where simple data editing is enough, and avoids supporting both `hidden` and
`visible` for the same concept.

### Add reversible binding transformers and attributes-only rendering

**Principle:** Keep the core binding layer small, but make it expressive enough for editor packages to compose on top.

**Decision:** SimplyFlow binding transformers now support separate `render` and `extract` hooks. Existing function transformers remain render-only. Editable bindings (`data-simply-edit` / `data-flow-edit`) run extract hooks before writing DOM values back to data, so editor-oriented packages can keep a clean stored data shape without adding CMS-specific behavior to the binding core.

The built-in `attributes` transformer renders and extracts selected HTML attributes without replacing an element's content. This covers RDFa/semantic-attribute style templates needed by a future SimplyEdit replacement while keeping the feature as an opt-in transformer rather than a new beginner-facing binding concept.

The built-in `escape_html` transformer is reversible too. This keeps SimplyFlow's default HTML-string rendering intact, while giving source views and literal previews an explicit opt-in escape hatch.

**Status:** Done

### Build SimplyEdit as a separate application layer

**Principle:** Keep SimplyFlow small and general; build editor-specific behavior as a separate package on top.

**Decision:** The first `@muze-labs/simplyedit` package now treats HTML strings as the canonical rich-text data format. It mounts contenteditable editing sessions on elements marked with `data-simply-editable`, writes changed HTML back to `app.data`, and renders a floating toolbar with SimplyFlow.

The editing engine is behind a small session adapter (`mount`, `execute`, `query`, `getHTML`, `setHTML`, `destroy`) so the initial DOM/contenteditable engine can later be replaced by a Cobalt-backed engine or another mature editor without coupling the toolbar to that engine.

**Status:** Started


### SimplyEdit toolbar interaction model

**Principle:** Keep the editing UI discoverable without letting application-specific behavior leak into SimplyFlow.

**Decision:** The SimplyEdit toolbar is owned by `@muze-labs/simplyedit`, not the core SimplyFlow packages. Editing fields activate on focus/click, but the toolbar only appears when the user has selected text or explicitly asks for the toolbar with `Control+Space`. `Escape` hides the toolbar. The toolbar uses the original visible cursor anchor approach and supports expandable subtoolbars for commands such as links.

### Add SimplyEdit sortable list editing

**Principle:** Keep editor behavior in SimplyEdit while preserving SimplyFlow's data-first rendering model.

**Decision:** Sortable list editing lives in `@muze-labs/simplyedit`, not in SimplyFlow core. A list becomes sortable with a boolean `data-simply-sortable` attribute on the same element that already has `data-simply-list`, so the data path is not duplicated. If a rendered item provides `data-simply-sort-handle`, SimplyEdit uses it; otherwise it inserts a default accessible handle button as editor chrome.

The first implementation uses Pointer Events rather than HTML5 Drag and Drop so it can support mouse, touch, and pen input more consistently. During a drag the helper may move DOM nodes temporarily for feedback, but the drop updates the underlying array in `app.data`; SimplyFlow remains the source of truth and re-renders from data. Handles also support keyboard reordering with arrow/Home/End keys.

Generated item handles are editor chrome: they are positioned to the left of the rendered item and should not change the item's normal layout. Item handles can open a small action toolbar for delete/append actions. Sortable lists also get a list-level handle, present even for empty lists, which opens an insert toolbar and inserts before the first item. This keeps structural editing inside SimplyEdit while the underlying list remains ordinary SimplyFlow data.

**Status:** Started
