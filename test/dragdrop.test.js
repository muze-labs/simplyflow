import { TextDecoder, TextEncoder } from 'node:util'
import { jest } from '@jest/globals'
import { dragdrop } from '../packages/app/src/dragdrop.mjs'

const format = 'application/x-test-card'
const controllers = []

beforeEach(() => {
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true })
  Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true })
  document.body.innerHTML = ''
})

afterEach(() => {
  controllers.splice(0).forEach(controller => controller.destroy())
  document.body.innerHTML = ''
  jest.restoreAllMocks()
})

function mount(markup, options, data = {}) {
  const container = document.createElement('div')
  container.innerHTML = markup
  document.body.append(container)
  const app = { container, data }
  const controller = dragdrop({ app, ...options })
  controllers.push(controller)
  return { app, container, controller }
}

// jsdom does not provide a native drag session. Model its protected data store.
function transfer() {
  const formats = new Map()
  let phase
  return {
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    get types() { return Array.from(formats.keys()) },
    setPhase(value) { phase = value },
    clearData() { formats.clear() },
    setData(type, data) { formats.set(type.toLowerCase(), data) },
    getData: jest.fn(type => phase === 'drop' ? formats.get(type) ?? '' : '')
  }
}

function dispatch(element, type, dataTransfer, clientY = 0) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  dataTransfer.setPhase(type)
  element.dispatchEvent(event)
  dataTransfer.setPhase(undefined)
  return event
}

function source(id = 'Card-É') {
  return mount(
    '<article draggable="true" data-simply-drag="card" data-simply-value-path="card.id"></article>',
    {
      drags: {
        card(element, value) {
          expect(this.data.card.id).toBe(value)
          return {
            meta: { id: value },
            data: { [format]: value },
            effects: ['copy', 'move']
          }
        }
      }
    },
    { card: { id } }
  ).container.firstElementChild
}

describe('dragdrop API', () => {
  it('exposes metadata during hover and captures the payload before an async drop handler resumes', async () => {
    const card = source()
    const calls = []
    const { app, container } = mount(
      '<section data-simply-drop="column" data-simply-value="done"></section>',
      {
        drops: {
          column: {
            effects: ['copy'],
            accepts(element, value, drag) {
              expect(value).toBe('done')
              expect(drag.data).toBeUndefined()
              return drag.meta?.id === 'Card-É' && drag.types.includes(format)
            },
            async drop(element, value, drag) {
              await Promise.resolve()
              calls.push({ app: this, element, value, drag })
            }
          }
        }
      }
    )
    const target = container.firstElementChild
    const dt = transfer()

    dispatch(card, 'dragstart', dt)
    expect(dispatch(target, 'dragover', dt).defaultPrevented).toBe(true)
    expect(dt.getData).not.toHaveBeenCalled()
    expect(dt.dropEffect).toBe('copy')
    expect(target.hasAttribute('data-simply-drag-over')).toBe(true)

    expect(dispatch(target, 'drop', dt).defaultPrevented).toBe(true)
    await Promise.resolve()
    expect(calls).toEqual([{
      app, element: target, value: 'done',
      drag: expect.objectContaining({
        meta: { id: 'Card-É' },
        data: { [format]: 'Card-É' },
        effect: 'copy'
      })
    }])
    expect(target.hasAttribute('data-simply-drag-over')).toBe(false)
  })

  it('rechecks acceptance at drop and clears a rejected preview', () => {
    const card = source()
    const accepts = jest.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const drop = jest.fn()
    const { container } = mount('<div data-simply-drop="column"></div>', {
      drops: { column: { accepts, drop } }
    })
    const target = container.firstElementChild
    const dt = transfer()

    dispatch(card, 'dragstart', dt)
    expect(dispatch(target, 'dragover', dt).defaultPrevented).toBe(true)
    expect(dispatch(target, 'drop', dt).defaultPrevented).toBe(false)
    expect(accepts).toHaveBeenCalledTimes(2)
    expect(drop).not.toHaveBeenCalled()
    expect(dt.getData).not.toHaveBeenCalled()
    expect(target.hasAttribute('data-simply-drag-over')).toBe(false)
  })

  it('reports a stable insertion anchor and appends to an empty destination', () => {
    const card = source()
    const drop = jest.fn()
    const { container } = mount(`
      <section data-simply-drop="column" data-simply-sort="vertical">
        <article data-simply-drag="card" data-simply-value="next"></article>
      </section>
      <section data-simply-drop="column" data-simply-sort="vertical"></section>
    `, { drops: { column: { drop } } })
    const [populated, empty] = container.children
    const next = populated.firstElementChild
    jest.spyOn(next, 'getBoundingClientRect').mockReturnValue({ top: 20, height: 40 })
    const dt = transfer()

    dispatch(card, 'dragstart', dt)
    dispatch(populated, 'dragover', dt, 25)
    expect(next.hasAttribute('data-simply-drop-before')).toBe(true)
    dispatch(populated, 'drop', dt, 25)
    expect(drop.mock.calls[0][2].before).toBe('next')
    expect(next.hasAttribute('data-simply-drop-before')).toBe(false)

    dispatch(card, 'dragstart', dt)
    dispatch(empty, 'dragover', dt)
    expect(empty.hasAttribute('data-simply-drop-end')).toBe(true)
    dispatch(empty, 'drop', dt)
    expect(drop.mock.calls[1][2].before).toBeNull()
    expect(empty.hasAttribute('data-simply-drop-end')).toBe(false)
  })

  it('removes the preview and stops accepting drops after destroy', () => {
    const card = source()
    const drop = jest.fn()
    const { container, controller } = mount('<div data-simply-drop="column"></div>', {
      drops: { column: { drop } }
    })
    const target = container.firstElementChild
    const dt = transfer()

    dispatch(card, 'dragstart', dt)
    dispatch(target, 'dragover', dt)
    expect(target.hasAttribute('data-simply-drag-over')).toBe(true)
    controller.destroy()
    expect(target.hasAttribute('data-simply-drag-over')).toBe(false)
    expect(dispatch(target, 'dragover', dt).defaultPrevented).toBe(false)
    expect(dispatch(target, 'drop', dt).defaultPrevented).toBe(false)
    expect(drop).not.toHaveBeenCalled()
  })
})
