import { bind } from '@muze-labs/simplyflow-bind'
import * as model from '@muze-labs/simplyflow-model'
import * as state from '@muze-labs/simplyflow-state'
import './render.mjs'
import * as dom from '@muze-labs/simplyflow-bind/dom'
import { app } from '@muze-labs/simplyflow-app'
import { actions } from '@muze-labs/simplyflow-app/action'
import { behaviors } from '@muze-labs/simplyflow-app/behavior'
import { commands } from '@muze-labs/simplyflow-app/command'
import { include, includes } from '@muze-labs/simplyflow-app/include'
import { shortcuts } from '@muze-labs/simplyflow-app/shortcut'
import path from '@muze-labs/simplyflow-app/path'
import { routes, SimplyRoute } from '@muze-labs/simplyflow-app/route'
import { html, css } from '@muze-labs/simplyflow-app/highlight'

if (!globalThis.simply) {
    globalThis.simply = {}
}

// These global template tags are intentional. Many editors recognize
// html`...` and css`...` template literals and provide syntax highlighting.
// Keeping them global gives script-tag users the same authoring experience
// without requiring a build step or explicit imports.
globalThis.html = html
globalThis.css = css

const modelApi = Object.assign(model.model, {
    model: model.model,
    sort: model.sort,
    paging: model.paging,
    filter: model.filter,
    columns: model.columns,
    scroll: model.scroll
})

Object.assign(globalThis.simply, {
    app,
    bind,
    model: modelApi,
    state,
    signal: state.signal,
    effect: state.effect,
    batch: state.batch,
    clone: state.clone,
    destroy: state.destroy,
    untracked: state.untracked,
    throttledEffect: state.throttledEffect,
    clockEffect: state.clockEffect,
    createSignal: state.createSignal,
    isSignal: state.isSignal,
    raw: state.raw,
    dom,
    behaviors,
    actions,
    commands,
    include,
    includes,
    shortcuts,
    path,
    routes
})

delete globalThis.simply.advanced

export {
    app,
    bind,
    model,
    state,
    dom,
    behaviors,
    actions,
    commands,
    include,
    includes,
    shortcuts,
    path,
    routes,
    SimplyRoute,
    html,
    css
}

export default globalThis.simply
