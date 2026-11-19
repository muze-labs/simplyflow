import { jest } from '@jest/globals'
import { runInThisContext } from 'node:vm'
import { raw } from '@muze-labs/simplyflow-state'
import { app, mergeable } from '@muze-labs/simplyflow-app'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

beforeEach(() => {
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
})

afterEach(() => {
  document.body.innerHTML = ''
  history.replaceState({}, '', '/')
  jest.restoreAllMocks()
  delete globalThis.fetch
})

describe('app API', () => {
  it.each(['data-flow', 'data-table'])('binds %s attributes alongside SimplyEdit fields', async (attribute) => {
    document.body.innerHTML = `<div id="app">
      <span data-simply-field="title">Managed by SimplyEdit</span>
      <span ${attribute}-field="title"></span>
      <input ${attribute}-edit="title">
      <ul ${attribute}-list="items"><template><li ${attribute}-field=":value"></li></template></ul>
      <button data-simply-command="increment">Increment</button>
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      attribute,
      data: { title: 'SimplyFlow title', items: ['First'], count: 0 },
      actions: { increment() { this.data.count++ } },
      commands: { increment() { this.actions.increment() } }
    })

    await wait()
    expect(testApp.binding.options.attribute).toBe(attribute)
    expect(container.querySelector('[data-simply-field]').textContent).toBe('Managed by SimplyEdit')
    expect(container.querySelector(`[${attribute}-field]`).textContent).toBe('SimplyFlow title')
    expect(container.querySelector('li').textContent).toBe('First')
    container.querySelector('button').click()
    expect(testApp.data.count).toBe(1)

    const input = container.querySelector('input')
    input.value = 'Edited'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait()
    expect(testApp.data.title).toBe('Edited')
    expect(container.querySelector(`[${attribute}-field]`).textContent).toBe('Edited')

    container.insertAdjacentHTML('beforeend', `<span ${attribute}-field="title"></span>`)
    testApp.data.items.push('Second')
    await wait()
    expect(container.lastElementChild.textContent).toBe('Edited')
    expect(Array.from(container.querySelectorAll('li'), li => li.textContent)).toEqual(['First', 'Second'])
    expect(container.querySelector('[data-simply-field]').textContent).toBe('Managed by SimplyEdit')

    testApp.destroy()
    container.querySelector('button').click()
    expect(testApp.data.count).toBe(1)
  })

  it('uses data as the reactive application object', async () => {
    document.body.innerHTML = `<div id="app"><span data-simply-field="title"></span></div>`
    const container = document.getElementById('app')

    const testApp = app({
      container,
      data: {
        title: 'Hello'
      }
    })

    await wait()
    expect(container.querySelector('span').innerHTML).toBe('Hello')

    testApp.data.title = 'Hello again'
    await wait()
    expect(container.querySelector('span').innerHTML).toBe('Hello again')

    testApp.destroy()
  })

  it('uses data-simply-field as one-way binding by default', async () => {
    document.body.innerHTML = `<div id="app"><input data-simply-field="name"></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        name: 'Ada'
      }
    })

    await wait()
    const input = container.querySelector('input')
    expect(input.value).toBe('Ada')

    input.value = 'Grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wait()
    expect(testApp.data.name).toBe('Ada')
    testApp.destroy()
  })


  it('passes app transformers to the default binding', async () => {
    document.body.innerHTML = `<div id="app"><a data-simply-field="id" data-simply-transform="item_link">Item</a></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        id: 42
      },
      transformers: {
        item_link(context, next) {
          context.value = { href: `#item/${context.value}` }
          next(context)
        }
      }
    })

    await wait()
    expect(container.querySelector('a').getAttribute('href')).toBe('#item/42')

    testApp.destroy()
  })

  it('uses current named transformers for mounted app bindings', async () => {
    const fields = `<span data-simply-field="title" data-simply-transform="escape_html label"></span>
      <input data-simply-edit="value" data-simply-transform="label">`
    document.body.innerHTML = `<div id="first">${fields}</div><div id="second">${fields}</div>`
    const first = document.querySelector('#first')
    const second = document.querySelector('#second')
    const makeTransformer = (name) => ({
      render: jest.fn(function(context, next) {
        if (!context.edit) {
          context.value = `${this.app.api.label} ${name}: ${context.value}`
        }
        return next(context)
      }),
      extract: jest.fn(function(context, next) {
        if (context.value !== context.currentValue) {
          context.value = `${this.app.api.label} ${name}: ${context.value}`
        }
        return next(context)
      })
    })
    const component = { transformers: { label: makeTransformer('component') } }
    const original = makeTransformer('app')
    const replacement = makeTransformer('override')
    const testApp = app({
      container: first,
      data: { title: 'original', value: 'draft' },
      api: { label: 'first' },
      components: { component },
      transformers: { label: original }
    })
    const otherApp = app({
      container: second,
      data: { title: 'original', value: 'draft' },
      api: { label: 'second' },
      components: { component }
    })

    try {
      const title = first.querySelector('span')
      const input = first.querySelector('input')
      await wait()
      expect(title.textContent).toBe('first app: original')
      expect(second.querySelector('span').textContent).toBe('second component: original')

      testApp.transformers.label = replacement
      testApp.data.title = '<replacement>'
      input.value = 'edited'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wait()
      expect(title.textContent).toBe('first override: <replacement>')
      expect(testApp.data.value).toBe('first override: edited')
      expect(testApp.binding.app).toBe(testApp)
      expect(replacement.render.mock.contexts[0]).toBe(testApp.binding)
      expect(replacement.render.mock.calls[0]).toHaveLength(2)
      expect(replacement.extract.mock.contexts[0]).toBe(testApp.binding)
      expect(replacement.extract.mock.calls[0]).toHaveLength(2)
      expect(second.querySelector('span').textContent).toBe('second component: original')
      expect(otherApp.data.value).toBe('draft')

      const revised = makeTransformer('revised source')
      testApp.components.app.transformers.label = revised
      delete testApp.transformers.label
      testApp.data.title = 'restored'
      input.value = 'new draft'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await wait()
      expect(title.textContent).toBe('first revised source: restored')
      expect(testApp.data.value).toBe('first revised source: new draft')

      testApp.transformers.label = function(context, next) {
        context.value = `${this.app.api.label} direct: ${context.value}`
        return next(context)
      }
      testApp.data.title = 'edited definition'
      await wait()
      expect(title.textContent).toBe('first direct: edited definition')
    } finally {
      testApp.destroy()
      otherApp.destroy()
    }
  })

  it('recomposes only the deleted name from current component and app hooks', () => {
    const base = { render() {}, extract() {} }
    const editor = { transformers: { label: base } }
    const appSource = { render() {} }
    const testApp = app({
      components: { editor },
      transformers: { label: appSource }
    })

    try {
      expect(testApp.components.editor).toBe(editor)
      expect(testApp.components.app.transformers.label).toBe(appSource)
      expect(testApp.transformers.label.render).toBe(appSource.render)
      expect(testApp.transformers.label.extract).toBe(base.extract)

      const localRender = () => {}
      testApp.transformers.label.render = localRender
      expect(appSource.render).not.toBe(localRender)
      expect(base.render).not.toBe(localRender)
      testApp.transformers.other = localRender

      editor.transformers.label = { extract() {} }
      delete testApp.transformers.label
      expect(testApp.transformers.label.render).toBe(appSource.render)
      expect(testApp.transformers.label.extract).toBe(editor.transformers.label.extract)
      expect(testApp.transformers.other).toBe(localRender)
      delete testApp.transformers.other
      expect(Object.keys(testApp.transformers)).toEqual(['label'])

      const replacementComponent = { transformers: { label: { extract() {} } } }
      testApp.components.editor = replacementComponent
      delete testApp.transformers.label
      expect(testApp.transformers.label.extract).toBe(replacementComponent.transformers.label.extract)

      delete replacementComponent.transformers.label
      delete testApp.components.app.transformers.label
      delete testApp.transformers.label
      expect(Object.keys(testApp.transformers)).toEqual([])
    } finally {
      testApp.destroy()
    }
  })

  it.each([
    ['top-level', { app: {} }],
    ['nested', { editor: { components: { app: {} } } }]
  ])('rejects a %s component named app before startup', (_, components) => {
    const start = jest.fn()
    expect(() => app({ components, start, templates: { card: '<p>Card</p>' } }))
      .toThrow(/component name "app" is reserved/)
    expect(start).not.toHaveBeenCalled()
    expect(document.querySelector('template#card')).toBeNull()
  })

  describe('component data defaults', () => {
    // This version of jsdom lacks structuredClone. Use Node's native implementation.
    beforeAll(() => { globalThis.structuredClone = runInThisContext('structuredClone') })
    afterAll(() => { delete globalThis.structuredClone })

    it('isolates defaults on each mount and keeps edits reactive', async () => {
      const row = { title: 'Draft' }
      const editor = { data: { rows: [row], selected: row, status: 'Draft' } }
      document.body.innerHTML = '<main><span data-simply-field="status"></span></main><aside></aside>'
      const mount = selector => app({
        components: { editor }, container: document.querySelector(selector)
      })
      const first = mount('main')
      const second = mount('aside')
      try {
        await wait()
        const field = document.querySelector('span')
        expect(field.textContent).toBe('Draft')
        first.data.rows[0].title = 'Edited'
        first.data.status = first.data.selected.title
        await wait()
        expect(field.textContent).toBe('Edited')
        expect(second.data.selected.title).toBe('Draft')
        expect(editor.data.selected.title).toBe('Draft')
        delete first.data.rows
        expect(first.data.rows).toBeUndefined()
        expect(second.data.rows).toHaveLength(1)
      } finally {
        first.destroy()
        second.destroy()
      }
    })

    it('merges in definition order and keeps app-supplied values by reference', () => {
      const child = { data: { child: true, parent: 'child', sibling: 'child' } }
      const parent = { components: { child }, data: {
        parent: 'parent', sibling: 'parent', settings: mergeable({ light: true }),
        draft: { old: true }
      } }
      const sibling = { data: { sibling: 'sibling', title: 'default' } }
      const draft = { save() {} }
      const testApp = app({
        components: { parent, sibling },
        data: { title: 'app', settings: mergeable({ compact: true }), draft }
      })
      try {
        expect(testApp.data.child).toBe(true)
        expect(testApp.data.parent).toBe('parent')
        expect(testApp.data.sibling).toBe('sibling')
        expect(testApp.data.title).toBe('app')
        expect(testApp.data.settings).toEqual({ light: true, compact: true })
        expect(raw(testApp.data.draft)).toBe(draft)
        const later = { submit() {} }
        testApp.data.draft = later
        expect(raw(testApp.data.draft)).toBe(later)
      } finally {
        testApp.destroy()
      }
    })

    it('reports an uncloneable component default before startup', () => {
      const start = jest.fn()
      const editor = { data: { callback() {} } }
      expect(() => app({ components: { editor }, start })).toThrow(
        expect.objectContaining({ name: 'DataCloneError' })
      )
      expect(start).not.toHaveBeenCalled()
    })
  })

  it('keeps reactive data exclusively on each app', () => {
    const editor = { actions: { discard() { delete this.data.draft } } }
    const first = app({ data: { draft: 'first' }, components: { editor } })
    const second = app({ data: { draft: 'second' }, components: { editor } })
    try {
      first.actions.discard()
      expect(Object.hasOwn(first.data, 'draft')).toBe(false)
      expect(second.data.draft).toBe('second')
      expect(Object.hasOwn(first.components.app, 'data')).toBe(false)
      expect(Object.hasOwn(editor, 'data')).toBe(false)
    } finally {
      first.destroy()
      second.destroy()
    }
  })

  it('retains same-named components, top-level lifecycle and service identity', () => {
    const nested = { transformers: { label() {} } }
    const shared = mergeable({ details: mergeable({ base: true }) })
    const parent = {
      components: { editor: nested },
      api: shared,
      start: jest.fn(),
      onError: jest.fn()
    }
    const editor = { transformers: { label() {} } }
    const service = new Map()
    const start = jest.fn()
    const onError = jest.fn()
    const testApp = app({
      components: { parent, editor },
      api: mergeable({ details: mergeable({ local: true }) }),
      service,
      start,
      onError
    })

    try {
      expect(testApp.components.editor).toBe(editor)
      expect(testApp.components.parent.components.editor).toBe(nested)
      expect(testApp.components.app.start).toBe(start)
      expect(testApp.transformers.label).toBe(editor.transformers.label)
      expect(testApp.api.details).toEqual({ base: true, local: true })
      expect(shared.details).toEqual({ base: true })
      expect(testApp.service).toBe(service)
      expect(testApp.onError).toBe(onError)
      expect(start).toHaveBeenCalledTimes(1)
      expect(start.mock.contexts[0]).toBe(testApp)
      expect(parent.start).not.toHaveBeenCalled()
    } finally {
      testApp.destroy()
    }
  })

  it('restores custom properties and nested service methods from current definitions', () => {
    const shared = { api: mergeable({ labels: mergeable({ format: () => 'shared' }) }), title: 'component' }
    const api = mergeable({ labels: mergeable({ alternate: () => 'alternate' }) })
    const testApp = app({ components: { shared }, api, title: 'top' })
    try {
      const local = () => 'local'
      testApp.api.labels.format = local
      testApp.api.labels.alternate = local
      shared.api.labels.format = () => 'revised'
      delete testApp.api.labels.format
      expect(testApp.api.labels.format()).toBe('revised')
      expect(testApp.api.labels.alternate()).toBe('local')
      expect(api.labels.alternate()).toBe('alternate')

      testApp.api = { local }
      delete testApp.api
      expect(testApp.api.labels.alternate()).toBe('alternate')
      expect(testApp.api.labels.format()).toBe('revised')
      testApp.title = 'session'
      delete testApp.title
      expect(testApp.title).toBe('top')
      delete testApp.components.app.title
      delete testApp.title
      expect(testApp.title).toBe('component')
      testApp.temporary = true
      delete testApp.temporary
      expect(Object.hasOwn(testApp, 'temporary')).toBe(false)
    } finally {
      testApp.destroy()
    }
  })

  it.each(['api', 'commands'])('keeps references to %s live through whole-map edits', name => {
    const original = { label() { return 'first' } }
    const component = { [name]: name === 'api' ? mergeable(original) : original }
    const testApp = app({ components: { component } })
    try {
      const held = testApp[name]
      const preview = { preview() { return 'preview' } }
      testApp[name] = name === 'api' ? mergeable(preview) : preview
      expect(testApp[name]).toBe(held)
      expect(held.preview()).toBe('preview')
      expect(held.label).toBeUndefined()
      expect(original.label()).toBe('first')

      original.label = () => 'revised'
      delete testApp[name]
      expect(testApp[name]).toBe(held)
      expect(held.label()).toBe('revised')
      expect(held.preview).toBeUndefined()

      testApp[name] = null
      expect(testApp[name]).toBeNull()
      expect(held.label).toBeUndefined()
      delete testApp[name]
      expect(testApp[name]).toBe(held)
      expect(held.label()).toBe('revised')

      delete component[name]
      delete testApp[name]
      expect(Object.hasOwn(testApp, name)).toBe(name === 'commands')
      expect(held.label).toBeUndefined()
    } finally {
      testApp.destroy()
    }
  })

  it('keeps nested and runtime-added marked maps live through replacement', () => {
    const tool = mergeable({ labels: mergeable({ save: 'Save' }) })
    const testApp = app({ tool })
    try {
      const labels = testApp.tool.labels
      testApp.tool = mergeable({ labels: mergeable({ preview: 'Preview' }) })
      expect(testApp.tool.labels).toBe(labels)
      expect(labels).toEqual({ preview: 'Preview' })
      delete testApp.tool
      expect(testApp.tool.labels).toBe(labels)
      expect(labels.save).toBe('Save')

      testApp.extra = mergeable({ title: 'Initial' })
      const extra = testApp.extra
      testApp.extra = mergeable({ title: 'Edited' })
      expect(extra.title).toBe('Edited')
      delete testApp.extra
      expect(Object.hasOwn(testApp, 'extra')).toBe(false)
      expect(Object.keys(extra)).toEqual([])
    } finally {
      testApp.destroy()
    }
  })

  it('dispatches commands and actions added after an empty app has mounted', () => {
    document.body.innerHTML = '<main><button data-simply-command="save">Save</button></main><aside></aside>'
    const first = app({ container: document.querySelector('main') })
    const second = app({ container: document.querySelector('aside') })
    const button = document.querySelector('button')
    const save = jest.fn(function() { this.data.saved = true })
    try {
      first.actions.save = save
      first.commands.save = function() { this.actions.save() }
      button.click()
      expect(save).toHaveBeenCalledTimes(1)
      expect(save.mock.contexts[0]).toBe(first)
      expect(first.data.saved).toBe(true)
      expect(Object.hasOwn(second.actions, 'save')).toBe(false)
      expect(Object.hasOwn(second.commands, 'save')).toBe(false)
      expect(Object.hasOwn(first.components.app, 'commands')).toBe(false)

      delete first.commands
      delete first.actions
      expect(Object.hasOwn(first.commands, 'save')).toBe(false)
      expect(Object.hasOwn(first.actions, 'save')).toBe(false)
      first.actions = { save }
      first.commands = { save() { this.actions.save() } }
      button.click()
      expect(save).toHaveBeenCalledTimes(2)
    } finally {
      first.destroy()
      second.destroy()
    }
    button.click()
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('uses late definitions for initially empty built-in sections', () => {
    const testApp = app()
    const start = jest.fn()
    try {
      testApp.routes['/late'] = () => 'late route'
      expect(testApp.routes.match('/late')).toBe('late route')
      testApp.shortcuts.s = start
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }))
      testApp.behaviors.late = start
      const node = document.createElement('div')
      node.dataset.simplyBehavior = 'late'
      testApp.behaviors.start(node)
      expect(start).toHaveBeenCalledTimes(2)
      testApp.templates.late = '<b>late</b>'
      testApp.styles.late = 'b { color: blue }'
      expect(document.getElementById('late').content.textContent).toBe('late')
      expect(document.getElementById('late.css').textContent).toContain('blue')
    } finally {
      testApp.destroy()
    }
  })

  it('dispatches an authored command named call through the button and public controller', () => {
    document.body.innerHTML = '<button data-simply-command="call">Call</button>'
    const original = jest.fn()
    const replacement = jest.fn()
    const editor = { commands: { call: original } }
    const testApp = app({ components: { editor } })
    try {
      const button = document.querySelector('button')
      button.click()
      expect(original).toHaveBeenCalledTimes(1)
      expect(original.mock.contexts[0]).toBe(testApp)
      expect(original.mock.calls[0][0]).toBe(button)
      expect(testApp.commands.call).toBe(original)
      testApp.commands.call = replacement
      button.click()
      expect(replacement).toHaveBeenCalledTimes(1)
      delete testApp.commands.call
      button.click()
      expect(original).toHaveBeenCalledTimes(2)
      expect(editor.commands.call).toBe(original)
    } finally {
      testApp.destroy()
    }
  })

  it('dispatches current commands, actions, shortcuts and routes after deletion', () => {
    document.body.innerHTML = '<button data-simply-command="save">Save</button>'
    const calls = []
    const editor = {
      commands: { save() { this.actions.save() } },
      actions: { save() { calls.push('original') } },
      shortcuts: { default: { s() { this.actions.save() } } },
      routes: { '/save': 'save' }
    }
    const testApp = app({ components: { editor } })
    const click = () => document.querySelector('button').click()
    const key = () => document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', bubbles: true
    }))
    try {
      testApp.commands.save = () => calls.push('command')
      click()
      delete testApp.commands.save
      testApp.actions.save = () => calls.push('action')
      click()
      delete testApp.actions.save
      click()
      testApp.shortcuts.default.s = () => { calls.push('shortcut') }
      key()
      delete testApp.shortcuts.default.s
      key()
      testApp.routes['/save'] = () => calls.push('route')
      testApp.routes.match('/save')
      delete testApp.routes['/save']
      testApp.routes.match('/save')
      expect(calls).toEqual(['command', 'action', 'original', 'shortcut', 'original', 'route', 'original'])

      testApp.commands = { save() { calls.push('whole section') } }
      click()
      editor.commands.save = () => calls.push('revised')
      delete testApp.commands
      click()
      expect(calls.slice(-2)).toEqual(['whole section', 'revised'])
    } finally {
      testApp.destroy()
    }
    click()
    expect(calls.at(-1)).toBe('revised')
  })

  it('preserves routing order, loaded routes and listeners across edits', () => {
    const calls = []
    const testApp = app({ routes: {
      '/item/:id': () => 'first',
      '/item/special': () => 'second'
    } })
    try {
      const router = testApp.routes
      router.load({ '/extra': () => 'extra' })
      router.addListener('match', '/item/:id', () => { calls.push('match') })
      testApp.routes = {
        '/item/special': () => 'specific',
        '/item/:id': () => 'generic'
      }
      expect(router.match('/item/special')).toBe('specific')
      expect(() => { testApp.routes['/:*'] = () => 'bad' }).toThrow(/wildcard/)
      expect(Object.hasOwn(testApp.routes, '/:*')).toBe(false)
      delete testApp.routes
      expect(router.match('/item/special')).toBe('first')
      expect(router.match('/extra')).toBe('extra')
      expect(calls).toEqual(['match', 'match'])
      expect(router.has('/eventHandlers')).toBe(false)
    } finally {
      testApp.destroy()
    }
  })

  it('uses restored behaviors on the next mount and runs the matching cleanup', () => {
    const calls = []
    const start = name => () => {
      calls.push(name)
      return () => calls.push('stop ' + name)
    }
    const testApp = app({ behaviors: { card: start('original') } })
    const node = document.createElement('div')
    node.dataset.simplyBehavior = 'card'
    try {
      testApp.behaviors.card = start('local')
      testApp.behaviors.start(node)
      delete testApp.behaviors.card
      testApp.behaviors.stop(node)
      testApp.behaviors.start(node)
    } finally {
      testApp.destroy()
    }
    expect(calls).toEqual(['local', 'stop local', 'original', 'stop original'])
  })

  it('keeps unmarked services intact, including accessors, hidden state and symbols', () => {
    const secret = Symbol('secret')
    const reads = jest.fn()
    const api = {
      get label() { reads(); return this[secret] },
      set label(value) { this[secret] = value }
    }
    Object.defineProperty(api, 'hidden', { value: 42 })
    api[secret] = 'original'
    const editor = { api: { earlier: true }, tools: mergeable({ service: { earlier: true } }) }
    const testApp = app({ components: { editor }, api, tools: mergeable({ service: api }) })
    try {
      expect(reads).not.toHaveBeenCalled()
      expect(testApp.api).toBe(api)
      expect(testApp.tools.service).toBe(api)
      testApp.tools.service.label = 'updated'
      expect(testApp.api.label).toBe('updated')
      expect(testApp.api.hidden).toBe(42)
      expect(testApp.api[secret]).toBe('updated')
      testApp.api = mergeable({ different: true })
      delete testApp.api
      expect(testApp.api).toBe(api)
    } finally {
      testApp.destroy()
    }
  })

  it('replaces a marked contribution with an unmarked service without reading its members', () => {
    const get = jest.fn(() => 'live')
    const service = Object.freeze(Object.defineProperty({}, 'label', { get }))
    const tools = mergeable({ earlier: true })
    const testApp = app({ components: { editor: { api: tools } }, api: service })
    try {
      expect(testApp.api).toBe(service)
      expect(get).not.toHaveBeenCalled()
      expect(() => mergeable(service)).toThrow(/non-configurable property "label"/)
      delete testApp.components.app.api
      delete testApp.api
      expect(testApp.api.earlier).toBe(true)
      expect(get).not.toHaveBeenCalled()
    } finally {
      testApp.destroy()
    }
  })

  it('composes top-level accessors without evaluating them during startup or assignment', () => {
    const get = jest.fn(function() { return this.data.title })
    const set = jest.fn(function(value) { this.data.title = value })
    const source = { data: { title: 'initial' } }
    Object.defineProperty(source, 'title', { get, set, configurable: true })
    const testApp = app(source)
    try {
      expect(get).not.toHaveBeenCalled()
      testApp.title = 'updated'
      expect(get).not.toHaveBeenCalled()
      expect(set.mock.contexts[0]).toBe(testApp)
      expect(testApp.title).toBe('updated')
      expect(get.mock.contexts[0]).toBe(testApp)
    } finally {
      testApp.destroy()
    }
  })

  it('preserves descriptors across marked-map composition, replacement and restoration', () => {
    const hidden = Symbol('hidden')
    const get = jest.fn(function() { return this.prefix + '!' })
    const set = jest.fn(function(value) { this.prefix = value })
    const base = mergeable({ prefix: 'base' })
    Object.defineProperty(base, 'label', { get, set, configurable: true })
    Object.defineProperty(base, hidden, { value: 42, configurable: true })
    const testApp = app({ components: { editor: { api: base } }, api: mergeable({ prefix: 'top' }) })
    try {
      const held = testApp.api
      expect(get).not.toHaveBeenCalled()
      expect(Object.getOwnPropertyDescriptor(held, 'label')).toEqual(
        Object.getOwnPropertyDescriptor(base, 'label'))
      expect(held.label).toBe('top!')
      held.label = 'edited'
      expect(set.mock.contexts[0]).toBe(held)
      expect(base.prefix).toBe('base')
      expect(held[hidden]).toBe(42)
      expect(Reflect.set(held, hidden, 0)).toBe(false)
      testApp.api = mergeable({ prefix: 'replaced' })
      expect(held.label).toBeUndefined()
      delete testApp.api
      expect(held.label).toBe('top!')
      delete held.label
      expect(Object.getOwnPropertyDescriptor(held, 'label').get).toBe(get)
    } finally {
      testApp.destroy()
    }
  })

  it('preserves unmarked leaves and self-references inside an opted-in map', () => {
    const names = ['original']
    const api = mergeable({ label: () => 'source', names })
    api.self = api
    const first = app({ api })
    const second = app({ api })
    try {
      first.api.label = () => 'local'
      expect(first.api.self).toBe(first.api)
      expect(first.api.names).toBe(names)
      expect(second.api.label()).toBe('source')
      expect(api.label()).toBe('source')
      api.label = () => 'revised'
      delete first.api.label
      expect(first.api.label()).toBe('revised')
    } finally {
      first.destroy()
      second.destroy()
    }
  })

  it('reapplies installed template and style entries when edits are deleted', () => {
    const editor = { templates: { card: '<b>A</b>' }, styles: { card: 'b { color: red }' } }
    const testApp = app({ components: { editor } })
    try {
      testApp.templates.card = '<i>B</i>'
      testApp.styles.card = 'i { color: blue }'
      const template = document.getElementById('card')
      const style = document.getElementById('card.css')
      expect(template.content.textContent).toBe('B')
      expect(style.textContent).toContain('blue')
      delete testApp.templates.card
      delete testApp.styles.card
      expect(template.content.textContent).toBe('A')
      expect(style.textContent).toContain('red')
      expect(document.querySelectorAll('style')).toHaveLength(1)
      testApp.templates.temporary = 'temporary'
      delete testApp.templates.temporary
      expect(document.getElementById('temporary')).toBeNull()
    } finally {
      testApp.destroy()
    }
  })

  it('falls back to the binding built-in after removing an app-only edit', async () => {
    document.body.innerHTML =
      '<span data-simply-field="title" data-simply-transform="escape_html"></span>'
    const testApp = app({ data: { title: '<first>' } })
    try {
      expect(Object.hasOwn(testApp.components.app, 'data')).toBe(false)
      testApp.transformers.escape_html = (context, next) => {
        context.value = 'custom'
        next(context)
      }
      testApp.data.title = '<second>'
      await wait()
      expect(document.querySelector('span').textContent).toBe('custom')

      delete testApp.transformers.escape_html
      testApp.data.title = '<third>'
      await wait()
      expect(document.querySelector('span').textContent).toBe('<third>')
    } finally {
      testApp.destroy()
    }
  })

  it('uses transformer extract hooks for editable fields', async () => {
    document.body.innerHTML = `<div id="app">
      <select data-simply-edit="type" data-simply-transform="selectedObjectKey">
        <option value="article">Article</option>
        <option value="note">Note</option>
      </select>
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        type: {
          note: {
            label: 'Existing note'
          }
        }
      },
      transformers: {
        selectedObjectKey: {
          render(context, next) {
            context.value = Object.keys(context.value || {})[0] || ''
            return next(context)
          },
          extract(context, next) {
            context.value = {
              [context.value]: context.currentValue?.[context.value] || {}
            }
            context.replaceValue = true
            return next(context)
          }
        }
      }
    })

    await wait()
    const select = container.querySelector('select')
    expect(select.value).toBe('note')

    select.value = 'article'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(Object.keys(testApp.data.type)).toEqual(['article'])

    testApp.destroy()
  })

  it('uses the attributes transformer for attributes-only editing', async () => {
    document.body.innerHTML = `<div id="app">
      <h1 data-simply-edit="subject" data-simply-transform="attributes" data-simply-attributes="about property typeof">Visible title</h1>
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        subject: {
          about: '#thing',
          property: 'schema:name',
          typeof: 'schema:Thing',
          ignored: 'not-rendered'
        }
      }
    })

    await wait()
    const heading = container.querySelector('h1')
    expect(heading.innerHTML).toBe('Visible title')
    expect(heading.getAttribute('about')).toBe('#thing')
    expect(heading.getAttribute('property')).toBe('schema:name')
    expect(heading.getAttribute('typeof')).toBe('schema:Thing')
    expect(heading.hasAttribute('ignored')).toBe(false)

    heading.setAttribute('property', 'schema:headline')
    await wait()
    expect(testApp.data.subject).toEqual({
      about: '#thing',
      property: 'schema:headline',
      typeof: 'schema:Thing'
    })

    testApp.destroy()
  })

  it('uses data-simply-edit for editable fields', async () => {
    document.body.innerHTML = `<div id="app"><input data-simply-edit="name"><textarea data-simply-edit="note"></textarea></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        name: 'Ada',
        note: 'hello'
      }
    })

    await wait()
    const input = container.querySelector('input')
    const textarea = container.querySelector('textarea')
    expect(input.value).toBe('Ada')
    expect(textarea.value).toBe('hello')

    input.value = 'Grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.value = 'updated'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await wait()
    expect(testApp.data.name).toBe('Grace')
    expect(testApp.data.note).toBe('updated')
    testApp.destroy()
  })


  it('edits checkbox boolean values explicitly', async () => {
    document.body.innerHTML = `<div id="app"><input type="checkbox" data-simply-edit="active"></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        active: true
      }
    })

    await wait()
    const checkbox = container.querySelector('input')
    expect(checkbox.checked).toBe(true)

    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(testApp.data.active).toBe(false)

    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(testApp.data.active).toBe(true)
    testApp.destroy()
  })

  it('edits checkbox arrays by toggling the checkbox value', async () => {
    document.body.innerHTML = `<div id="app">
      <input id="js" type="checkbox" value="js" data-simply-edit="tags">
      <input id="html" type="checkbox" value="html" data-simply-edit="tags">
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        tags: ['js']
      }
    })

    await wait()
    const js = container.querySelector('#js')
    const html = container.querySelector('#html')
    expect(js.checked).toBe(true)
    expect(html.checked).toBe(false)

    html.checked = true
    html.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(Array.from(testApp.data.tags)).toEqual(['js', 'html'])

    js.checked = false
    js.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(Array.from(testApp.data.tags)).toEqual(['html'])
    testApp.destroy()
  })

  it('edits radio groups by writing the selected radio value', async () => {
    document.body.innerHTML = `<div id="app">
      <input id="red" type="radio" name="color" value="red" data-simply-edit="color">
      <input id="blue" type="radio" name="color" value="blue" data-simply-edit="color">
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        color: 'red'
      }
    })

    await wait()
    const red = container.querySelector('#red')
    const blue = container.querySelector('#blue')
    expect(red.checked).toBe(true)
    expect(blue.checked).toBe(false)

    blue.checked = true
    blue.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()
    expect(testApp.data.color).toBe('blue')
    testApp.destroy()
  })

  it('edits select and multiple-select values', async () => {
    document.body.innerHTML = `<div id="app">
      <select id="country" data-simply-edit="country">
        <option value="nl">Netherlands</option>
        <option value="be">Belgium</option>
      </select>
      <select id="tags" multiple data-simply-edit="tags">
        <option value="js">JavaScript</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
      </select>
    </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        country: 'nl',
        tags: ['js']
      }
    })

    await wait()
    const country = container.querySelector('#country')
    const tags = container.querySelector('#tags')
    expect(country.value).toBe('nl')
    expect(Array.from(tags.selectedOptions).map(option => option.value)).toEqual(['js'])

    country.value = 'be'
    country.dispatchEvent(new Event('change', { bubbles: true }))
    tags.options[1].selected = true
    tags.options[0].selected = false
    tags.dispatchEvent(new Event('change', { bubbles: true }))
    await wait()

    expect(testApp.data.country).toBe('be')
    expect(Array.from(testApp.data.tags)).toEqual(['html'])
    testApp.destroy()
  })

  it('runs commands with the app as this so commands can change data', async () => {
    document.body.innerHTML = `
      <div id="app">
        <button data-simply-command="increment">+</button>
        <span data-simply-field="count"></span>
      </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        count: 0
      },
      commands: {
        increment() {
          this.data.count++
        }
      }
    })

    await wait()
    container.querySelector('button').click()
    await wait()

    expect(testApp.data.count).toBe(1)
    expect(container.querySelector('span').innerHTML).toBe('1')
    testApp.destroy()
  })

  it('uses shortcuts with the app as this', async () => {
    document.body.innerHTML = `<div id="app"><input><span data-simply-field="saved"></span></div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        saved: false
      },
      shortcuts: {
        'Control+s'(event) {
          this.data.saved = true
          expect(event).toBeInstanceOf(KeyboardEvent)
        }
      }
    })

    container.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    }))

    await wait()
    expect(testApp.data.saved).toBe(true)
    expect(container.querySelector('span').innerHTML).toBe('true')
    expect(testApp.shortcuts).toBeDefined()
    testApp.destroy()
  })

  it('lets commands call actions that update data', async () => {
    document.body.innerHTML = `
      <div id="app">
        <button data-simply-command="setName" data-simply-value="Grace">Set</button>
        <span data-simply-field="name"></span>
      </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        name: 'Ada'
      },
      commands: {
        setName(el, value) {
          this.actions.setName(value)
        }
      },
      actions: {
        setName(name) {
          this.data.name = name
        }
      }
    })

    await wait()
    container.querySelector('button').click()
    await wait()

    expect(testApp.data.name).toBe('Grace')
    expect(container.querySelector('span').innerHTML).toBe('Grace')
    testApp.destroy()
  })




  it('loads includes inside the app container and binds included content', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<span data-simply-field="title"></span>'
    })
    document.body.innerHTML = `
      <div id="app">
        <link rel="simply-include" href="https://example.com/card.html">
      </div>`
    const container = document.getElementById('app')
    const testApp = app({
      container,
      data: {
        title: 'Included title'
      }
    })

    await wait(140)

    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/card.html')
    expect(container.querySelector('span').innerHTML).toBe('Included title')
    testApp.destroy()
  })

  it('stops loading new includes after app destroy', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<section>Loaded</section>'
    })
    const container = document.createElement('div')
    document.body.append(container)
    const testApp = app({ container, data: {} })
    testApp.destroy()

    const link = document.createElement('link')
    link.rel = 'simply-include'
    link.href = 'https://example.com/after-destroy.html'
    container.append(link)
    await wait(140)

    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(link.rel).toBe('simply-include')
  })

  it('uses app-level behaviors for data-simply-behavior elements', async () => {
    document.body.innerHTML = `<div id="app"><button data-simply-behavior="focusButton">Focus</button></div>`
    const container = document.getElementById('app')
    const started = []
    const stopped = []
    const thisValues = []

    const testApp = app({
      container,
      data: {},
      behaviors: {
        focusButton(element) {
          thisValues.push(this)
          started.push(element)
          return function cleanup(cleanupElement) {
            thisValues.push(this)
            stopped.push(cleanupElement)
          }
        }
      }
    })

    const button = container.querySelector('button')
    expect(started).toEqual([button])
    expect(thisValues[0]).toBe(testApp)
    testApp.destroy()
    expect(stopped).toEqual([button])
    expect(thisValues[1]).toBe(testApp)
  })

})


describe('app integration details', () => {
  it('installs inline templates and styles', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const testApp = app({
      container,
      templates: {
        greeting: '<span>Hello</span>'
      },
      styles: {
        base: '.greeting { color: black; }'
      }
    })

    expect(container.querySelector('template#greeting').innerHTML).toContain('<span>Hello</span>')
    expect(container.querySelector('style#base\\.css').innerHTML).toContain('.greeting')
    expect(testApp.app).toBe(testApp)
    testApp.destroy()
  })

  it('merges components before app options and ignores prototype-polluting options', () => {
    const container = document.createElement('div')
    document.body.append(container)

    const testApp = app({
      container,
      components: {
        base: {
          actions: {
            componentAction() { return 'component' }
          }
        }
      },
      data: { overridden: true },
      actions: {
        appAction() { return 'app' }
      },
      __proto__: { polluted: true }
    })

    expect(testApp.data.overridden).toBe(true)
    expect(testApp.actions.componentAction()).toBe('component')
    expect(testApp.actions.appAction()).toBe('app')
    expect({}.polluted).toBeUndefined()
    testApp.destroy()
  })


  it('supports route action-name shorthand in app routes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const calls = []

    const testApp = app({
      container,
      actions: {
        showContact({ id, tab }) {
          calls.push({ thisValue: this, id, tab })
          return id
        }
      },
      routes: {
        '/contacts/:id': 'showContact'
      }
    })

    expect(testApp.routes.match('/contacts/42?tab=notes')).toBe('42')
    expect(calls).toEqual([
      {
        thisValue: testApp,
        id: '42',
        tab: 'notes'
      }
    ])
    testApp.destroy()
  })

  it('waits for async start before initializing routes', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const calls = []

    const testApp = app({
      container,
      baseURL: '/',
      async start() {
        calls.push('start')
        await wait(0)
        history.replaceState({}, '', '/ready')
        calls.push('started')
      },
      routes: {
        '/ready': function() {
          calls.push(['route', true])
        }
      }
    })

    // Route initialization is scheduled after async start settles.
    await wait()
    expect(calls[0]).toBe('start')
    expect(calls).toContain('started')
    expect(calls.some(call => Array.isArray(call) && call[0] === 'route')).toBe(true)
    testApp.destroy()
  })

  it('routes start errors to onError', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const errors = []

    const testApp = app({
      container,
      start() {
        throw new Error('start failed')
      },
      onError(error, context) {
        errors.push({ error, context })
      }
    })

    expect(errors).toHaveLength(1)
    expect(errors[0].error.message).toBe('start failed')
    expect(errors[0].context).toBe(testApp.start)
    testApp.destroy()
  })
  it('copies custom app options without warning so actions can use app services', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const api = {
      async get(path) {
        return { path, title: 'Loaded' }
      }
    }

    const testApp = app({
      data: {
        item: null
      },
      api,
      actions: {
        async loadItem() {
          this.data.item = await this.api.get('foo.json')
        }
      }
    })

    await testApp.actions.loadItem()

    expect(testApp.api).toBe(api)
    expect(testApp.api.get).toBe(api.get)
    expect(testApp.data.item).toEqual({ path: 'foo.json', title: 'Loaded' })
    expect(warn).not.toHaveBeenCalled()
    testApp.destroy()
    warn.mockRestore()
  })

  it('warns when a custom app option is probably a typo of a built-in option', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const testApp = app({
      data: {},
      commmands: {
        save() {}
      }
    })

    expect(testApp.commmands).toEqual({ save: expect.any(Function) })
    expect(Object.hasOwn(testApp.commands, 'save')).toBe(false)
    expect(warn).toHaveBeenCalledWith('simplyflow/app: unknown option "commmands". Did you mean "commands"? The option was still added to the app as "app.commmands".')
    testApp.destroy()
    warn.mockRestore()
  })


  it('passes dynamic command values from list templates', async () => {
    document.body.innerHTML = `
      <div id="app">
        <ul data-simply-list="contacts">
          <template>
            <li>
              <button data-simply-command="select" data-simply-value=":value.id">Select</button>
              <button data-simply-command="selectItem" data-simply-value=":value">Select item</button>
              <span data-simply-field="name"></span>
            </li>
          </template>
        </ul>
      </div>`
    const container = document.getElementById('app')
    const selected = []
    const selectedItems = []
    const testApp = app({
      container,
      data: {
        contacts: [
          { id: 'ada', name: 'Ada' },
          { id: 'grace', name: 'Grace' }
        ]
      },
      commands: {
        select(el, value) {
          selected.push(value)
        },
        selectItem(el, value) {
          selectedItems.push(value)
        }
      }
    })

    await wait()
    const buttons = container.querySelectorAll('button')
    buttons[0].click()
    buttons[3].click()

    expect(selected).toEqual(['ada'])
    expect(selectedItems).toEqual([testApp.data.contacts[1]])
    testApp.destroy()
  })

  it('keeps dynamic command value paths correct when list items are reused', async () => {
    document.body.innerHTML = `
      <div id="app">
        <ul data-simply-list="contacts">
          <template>
            <li>
              <button data-simply-command="select" data-simply-value=":value.id">Select</button>
              <span data-simply-field="name"></span>
            </li>
          </template>
        </ul>
      </div>`
    const container = document.getElementById('app')
    const selected = []
    const testApp = app({
      container,
      data: {
        contacts: [
          { id: 'ada', name: 'Ada' },
          { id: 'grace', name: 'Grace' }
        ]
      },
      commands: {
        select(el, value) {
          selected.push(value)
        }
      }
    })

    await wait()
    const adaButton = container.querySelector('button')
    testApp.data.contacts.unshift({ id: 'alan', name: 'Alan' })
    await wait()
    adaButton.click()

    expect(selected).toEqual(['ada'])
    testApp.destroy()
  })

  it('passes dynamic command keys from map templates', async () => {
    document.body.innerHTML = `
      <div id="app">
        <ul data-simply-map="contacts">
          <template>
            <li>
              <button data-simply-command="select" data-simply-value=":key">Select</button>
              <span data-simply-field="name"></span>
            </li>
          </template>
        </ul>
      </div>`
    const container = document.getElementById('app')
    const selected = []
    const testApp = app({
      container,
      data: {
        contacts: {
          ada: { name: 'Ada' },
          grace: { name: 'Grace' }
        }
      },
      commands: {
        select(el, value) {
          selected.push(value)
        }
      }
    })

    await wait()
    container.querySelectorAll('button')[1].click()

    expect(selected).toEqual(['grace'])
    testApp.destroy()
  })


  it('destroy stops command listeners', async () => {
    document.body.innerHTML = `<div id="app"><button data-simply-command="count">Count</button></div>`
    const container = document.getElementById('app')
    let count = 0
    const testApp = app({
      container,
      data: {},
      commands: {
        count() {
          count++
        }
      }
    })

    await wait()
    const button = container.querySelector('button')
    button.click()
    testApp.destroy()
    button.click()

    expect(count).toBe(1)
  })

  it('destroy stops shortcut and accesskey listeners', async () => {
    document.body.innerHTML = `<div id="app">
      <input>
      <button data-simply-accesskey="Control+k">Open</button>
    </div>`
    const container = document.getElementById('app')
    let shortcuts = 0
    let accesskeyClicks = 0
    container.querySelector('button').addEventListener('click', () => {
      accesskeyClicks++
    })

    const testApp = app({
      container,
      data: {},
      shortcuts: {
        'Control+s'() {
          shortcuts++
        }
      }
    })

    await wait()
    const input = container.querySelector('input')
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    }))
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'k',
      ctrlKey: true,
      keyCode: 75
    }))
    testApp.destroy()
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 's',
      ctrlKey: true,
      keyCode: 83
    }))
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'k',
      ctrlKey: true,
      keyCode: 75
    }))

    expect(shortcuts).toBe(1)
    expect(accesskeyClicks).toBe(1)
  })

  it('destroy stops route event listeners', async () => {
    document.body.innerHTML = `<div id="app"></div>`
    const container = document.getElementById('app')
    const hits = []
    const testApp = app({
      container,
      data: {},
      actions: {
        show({ id }) {
          hits.push(id)
        }
      },
      routes: {
        '/contacts/:id': 'show'
      }
    })

    await wait()
    history.pushState({}, '', '/contacts/ada')
    globalThis.dispatchEvent(new Event('popstate'))
    testApp.destroy()
    history.pushState({}, '', '/contacts/grace')
    globalThis.dispatchEvent(new Event('popstate'))

    expect(hits).toEqual(['ada'])
  })

  it('does not initialize routes after an async start if the app was destroyed first', async () => {
    document.body.innerHTML = `<div id="app"></div>`
    const container = document.getElementById('app')
    let resolveStart
    const started = new Promise(resolve => {
      resolveStart = resolve
    })
    const hits = []
    const testApp = app({
      container,
      data: {},
      start() {
        return started
      },
      actions: {
        show({ id }) {
          hits.push(id)
        }
      },
      routes: {
        '/contacts/:id': 'show'
      }
    })

    testApp.destroy()
    resolveStart()
    await wait()
    history.pushState({}, '', '/contacts/ada')
    globalThis.dispatchEvent(new Event('popstate'))

    expect(hits).toEqual([])
  })

})
