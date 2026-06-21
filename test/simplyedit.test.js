import { jest } from '@jest/globals'
import { edit, createHtmlDomEngine } from '@muze-labs/simplyedit'
import { signal } from '@muze-labs/simplyflow-state'
import { bind } from '@muze-labs/simplyflow-bind'

const wait = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))

describe('@muze-labs/simplyedit', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('mounts a contenteditable HTML session and writes edited HTML back to app data', async () => {
    document.body.innerHTML = '<article data-simply-field="body" data-simply-editable="richtext"></article>'

    const editor = edit({
      container: document.body,
      data: {
        body: '<p>Hello <strong>world</strong></p>'
      }
    })

    try {
      await wait()
      const article = document.querySelector('article')
      expect(article.innerHTML).toBe('<p>Hello <strong>world</strong></p>')

      article.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      expect(article.getAttribute('contenteditable')).toBe('true')

      article.innerHTML = '<p>Hello <em>editor</em></p>'
      article.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await wait()

      expect(editor.app.data.body).toBe('<p>Hello <em>editor</em></p>')
    } finally {
      editor.destroy()
    }
  })

  it('renders a SimplyFlow toolbar that dispatches commands to the active session', async () => {
    document.body.innerHTML = '<article data-simply-field="body" data-simply-editable="richtext"></article>'
    const executed = []
    const engine = {
      mount({ element, html, onChange }) {
        element.innerHTML = html
        element.setAttribute('contenteditable', 'true')
        return {
          element,
          execute(command) {
            executed.push(command)
            element.innerHTML = '<strong>changed</strong>'
            onChange(element.innerHTML)
            return true
          },
          query() { return false },
          focus() {},
          destroy() {}
        }
      }
    }
    const editor = edit({
      container: document.body,
      data: { body: '<p>Hello</p>' },
      engine
    })

    try {
      await wait()
      const article = document.querySelector('article')
      article.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wait(250)
      expect(editor.toolbar.element.hidden).toBe(true)

      article.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: ' ', code: 'Space' }))
      await wait(250)

      const button = editor.toolbar.element.shadowRoot.querySelector('button.simply-edit-button')
      expect(button).not.toBeNull()
      button.click()
      await wait()

      expect(executed).toEqual(['bold'])
      expect(editor.app.data.body).toBe('<strong>changed</strong>')
    } finally {
      editor.destroy()
    }
  })



  it('positions the toolbar through a cursor anchor', async () => {
    document.body.innerHTML = '<article data-simply-field="body" data-simply-editable="richtext">Hello editor</article>'
    const article = document.querySelector('article')
    const originalCreateRange = document.createRange
    const originalGetSelection = globalThis.getSelection

    article.getBoundingClientRect = () => ({ left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100 })
    document.body.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 })
    document.createRange = jest.fn(() => ({
      setStart() {},
      collapse() {},
      getClientRects() {
        return [{ left: 96, top: 48, right: 96, bottom: 66, width: 0, height: 18 }]
      }
    }))
    globalThis.getSelection = jest.fn(() => ({
      rangeCount: 1,
      isCollapsed: true,
      focusNode: article.firstChild,
      focusOffset: 5,
      anchorNode: article.firstChild,
      anchorOffset: 5
    }))

    const editor = edit({
      container: document.body,
      data: { body: 'Hello editor' }
    })

    try {
      await wait()
      article.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wait()
      expect(editor.toolbar.element.hidden).toBe(true)

      article.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: ' ', code: 'Space' }))
      await wait()

      expect(editor.toolbar.anchor.element.style.display).toBe('block')
      expect(editor.toolbar.anchor.element.style.left).toBe('96px')
      expect(editor.toolbar.anchor.element.style.top).toBe('66px')
      expect(editor.toolbar.anchor.element.style.width).toBe('10px')
      expect(editor.toolbar.anchor.element.style.height).toBe('10px')
      expect(editor.toolbar.anchor.element.style.transform).toBe('rotate(45deg)')
      expect(editor.toolbar.element.style.transform).toBe('')
      expect(editor.toolbar.element.style.left).toBe('96px')
      expect(editor.toolbar.element.style.marginTop).toBe('-4px')
      expect(editor.toolbar.element.style.top).toBe('66px')
    } finally {
      editor.destroy()
      document.createRange = originalCreateRange
      globalThis.getSelection = originalGetSelection
    }
  })


  it('shows the toolbar for selected text, hides it with Escape, and supports subtoolbars', async () => {
    document.body.innerHTML = '<article data-simply-field="body" data-simply-editable="richtext">Hello editor</article>'
    const article = document.querySelector('article')
    const originalCreateRange = document.createRange
    const originalGetSelection = globalThis.getSelection

    document.createRange = jest.fn(() => ({
      setStart() {},
      collapse() {},
      getClientRects() {
        return [{ left: 40, top: 30, right: 40, bottom: 48, width: 0, height: 18 }]
      }
    }))
    globalThis.getSelection = jest.fn(() => ({
      rangeCount: 1,
      isCollapsed: false,
      focusNode: article.firstChild,
      focusOffset: 5,
      anchorNode: article.firstChild,
      anchorOffset: 0
    }))

    const editor = edit({
      container: document.body,
      data: { body: 'Hello editor' }
    })

    try {
      await wait()
      article.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      document.dispatchEvent(new Event('selectionchange'))
      await wait()

      expect(editor.toolbar.element.hidden).toBe(false)

      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
      await wait()
      expect(editor.toolbar.element.hidden).toBe(true)

      article.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: ' ', code: 'Space' }))
      await wait()
      expect(editor.toolbar.element.hidden).toBe(false)

      const shadow = editor.toolbar.element.shadowRoot
      const linkButton = shadow.querySelector('[data-toolbar-command="expand"][data-toolbar-value="link"]')
      expect(linkButton).not.toBeNull()
      linkButton.click()
      await wait()

      expect(linkButton.classList.contains('simply-edit-button-expanded')).toBe(true)
      expect(shadow.querySelector('.simply-edit-toolbar-sub').hidden).toBe(false)
      expect(shadow.querySelector('[data-toolbar-panel="link"]').hidden).toBe(false)
    } finally {
      editor.destroy()
      document.createRange = originalCreateRange
      globalThis.getSelection = originalGetSelection
    }
  })

  it('keeps the HTML editing engine behind a replaceable adapter interface', () => {
    const engine = createHtmlDomEngine()
    expect(engine.name).toBe('html-dom')
    expect(typeof engine.mount).toBe('function')
  })
})

describe('escape_html transformer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders HTML as literal text while keeping the stored value as raw HTML', async () => {
    document.body.innerHTML = '<pre data-simply-edit="body" data-simply-transform="escape_html"></pre>'
    const data = signal({ body: '<p>Hello <strong>source</strong></p>' })
    const databind = bind({ container: document.body, root: data, attribute: 'data-simply' })

    try {
      await wait()
      const pre = document.querySelector('pre')
      expect(pre.textContent).toBe('<p>Hello <strong>source</strong></p>')

      pre.innerHTML = '&lt;p&gt;Changed&lt;/p&gt;'
      pre.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await wait()

      expect(data.body).toBe('<p>Changed</p>')
    } finally {
      databind.destroy()
    }
  })
})

describe('SimplyEdit sortable lists', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('adds default handles to sortable list items and reorders app data with the keyboard', async () => {
    document.body.innerHTML = `
      <ol data-simply-list="sections" data-simply-sortable>
        <template>
          <li><span data-simply-field="title"></span></li>
        </template>
      </ol>
    `

    const editor = edit({
      container: document.body,
      data: {
        sections: [
          { title: 'First' },
          { title: 'Second' },
          { title: 'Third' }
        ]
      }
    })

    try {
      await wait(150)
      const handles = document.querySelectorAll('[data-simply-sort-handle]')
      expect(handles).toHaveLength(3)
      expect(handles[0].getAttribute('data-simply-generated')).toBe('true')
      expect(handles[0].tagName).toBe('BUTTON')

      handles[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }))
      await wait(150)

      expect(editor.app.data.sections.map(section => section.title)).toEqual(['Second', 'First', 'Third'])
      expect(Array.from(document.querySelectorAll('li span')).map(span => span.textContent)).toEqual(['Second', 'First', 'Third'])
    } finally {
      editor.destroy()
    }
  })


  it('shows generated item handles outside the item flow and opens an item toolbar', async () => {
    document.body.innerHTML = `
      <ol data-simply-list="sections" data-simply-sortable>
        <template>
          <li><span data-simply-field="title"></span></li>
        </template>
      </ol>
    `

    const editor = edit({
      container: document.body,
      data: { sections: [{ title: 'First' }, { title: 'Second' }] }
    })

    try {
      await wait(150)
      const firstItem = document.querySelector('li')
      const handle = firstItem.querySelector('[data-simply-sort-handle]')
      expect(handle.getAttribute('data-simply-generated')).toBe('true')
      expect(firstItem.classList.contains('simply-edit-has-default-sort-handle')).toBe(true)
      expect(getComputedStyle(handle).position).toBe('absolute')

      handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      await wait()

      const toolbar = document.querySelector('[data-simply-sort-action-toolbar]')
      expect(toolbar.hidden).toBe(false)
      expect(toolbar.querySelector('[data-simply-sort-action="delete"]')).not.toBeNull()
      expect(toolbar.querySelector('[data-simply-sort-action="append"]')).not.toBeNull()

      toolbar.querySelector('[data-simply-sort-action="append"]').click()
      await wait(150)

      expect(editor.app.data.sections.map(section => section.title)).toEqual(['First', '', 'Second'])
      expect(Array.from(document.querySelectorAll('li span')).map(span => span.textContent)).toEqual(['First', '', 'Second'])
    } finally {
      editor.destroy()
    }
  })

  it('adds a list handle that can insert into an empty list from the template shape', async () => {
    document.body.innerHTML = `
      <ol data-simply-list="sections" data-simply-sortable>
        <template>
          <li>
            <span data-simply-field="title"></span>
            <ul data-simply-list="children"><template><li data-simply-field=":value"></li></template></ul>
          </li>
        </template>
      </ol>
    `

    const editor = edit({
      container: document.body,
      data: { sections: [] }
    })

    try {
      await wait(150)
      const listHandle = document.querySelector('[data-simply-list-handle]')
      expect(listHandle).not.toBeNull()
      expect(listHandle.textContent).toBe('+')

      listHandle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      await wait()

      const toolbar = document.querySelector('[data-simply-sort-action-toolbar]')
      expect(toolbar.hidden).toBe(false)
      expect(toolbar.querySelector('[data-simply-sort-action="insert"]')).not.toBeNull()

      toolbar.querySelector('[data-simply-sort-action="insert"]').click()
      await wait(150)

      expect(editor.app.data.sections).toEqual([{ title: '', children: [] }])
      expect(document.querySelectorAll('li')).toHaveLength(1)
    } finally {
      editor.destroy()
    }
  })

  it('uses custom sort handles when the template provides them', async () => {
    document.body.innerHTML = `
      <ol data-simply-list="sections" data-simply-sortable>
        <template>
          <li>
            <button type="button" class="custom-handle" data-simply-sort-handle>Move</button>
            <span data-simply-field="title"></span>
          </li>
        </template>
      </ol>
    `

    const editor = edit({
      container: document.body,
      data: { sections: [{ title: 'First' }, { title: 'Second' }] }
    })

    try {
      await wait(150)
      const handles = document.querySelectorAll('[data-simply-sort-handle]')
      expect(handles).toHaveLength(2)
      expect(handles[0].classList.contains('custom-handle')).toBe(true)
      expect(handles[0].hasAttribute('data-simply-generated')).toBe(false)
    } finally {
      editor.destroy()
    }
  })
})
