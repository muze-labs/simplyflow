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

**Problem:** State, effects, binding, model, paging, sort, filter, and columns are imported together in examples and presented as bundled libraries.

**Why it matters:** The library risks becoming a lightweight framework without a clear boundary.

**Suggested direction:** Document or package layers separately: `state`, `bind`, `model`, and optional model helpers. Make each usable and explainable on its own.

**Status:** Open

### 2. Clarify relationship to SimplyView and Muze projects

**Principle:** Replaceability and framework boundaries.

**Problem:** The README says SimplyFlow is intended for SimplyView but can be used standalone, and may be integrated into SimplyView once vetted.

**Why it matters:** Users need to know whether this is a stable standalone library or an experimental framework component.

**Suggested direction:** Add a “Relationship to SimplyView” section with current status and future compatibility promise.

**Status:** Open

### 3. Replace direct `src/` imports in public examples with stable imports

**Principle:** Stable APIs.

**Problem:** The README examples import from `simplyflow/src/state.mjs`, `src/bind.mjs`, and `src/model.mjs`.

**Why it matters:** Importing from source files exposes internal layout as public API and makes refactoring harder.

**Suggested direction:** Define stable export paths and update examples to use them. Keep source-path imports only in internal docs.

**Status:** Open

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
- Should `bind` depend on `state`, or should it accept generic signal-like adapters?
- Should model helpers live in their own package?

## Non-goals

- Do not become a full frontend framework unless that is a deliberate separate project.
- Do not hide DOM/browser behavior behind opaque magic.
- Do not make all Muze apps depend on SimplyFlow by accident.

## Review cadence

Review this document before feature work, before releases, and whenever the public API or dependency surface changes. Close issues by changing their status to `Done` and leaving a short note about the decision.
