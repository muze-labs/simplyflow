import '@muze-labs/simplyflow/render'
import { app } from '@muze-labs/simplyflow/app'
import { DEP } from '@muze-labs/simplyflow/symbols'

const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms))

describe('simply-render custom element API', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('replaces itself with the referenced template content and copies non-rel attributes', async () => {
    document.body.innerHTML = `
      <template id="card"><article><template id="nested"></template><span>Card</span></article></template>
    `
    const render = document.createElement('simply-render')
    render.setAttribute('rel', 'card')
    render.setAttribute('data-kind', 'profile')
    document.body.appendChild(render)
    await wait(0)

    expect(document.querySelector('simply-render')).toBeNull()
    const article = document.querySelector('article')
    expect(article.dataset.kind).toBe('profile')
    expect(article.querySelector('span').textContent).toBe('Card')
    expect(article.querySelector('template').hasAttribute('simply-render')).toBe(true)
  })

  it('identifies adjacent instances by their source template', () => {
    document.body.innerHTML = `
      <template id="card">
        <!-- A card --> <article>Card</article>
      </template>
      <main><simply-render rel="card"></simply-render><simply-render rel="card"></simply-render></main>
    `
    const main = document.querySelector('main')
    const roots = main.querySelectorAll('article[data-simply-template="card"]')
    expect(roots).toHaveLength(2)
    expect(main.childNodes).toHaveLength(2)
    for (const root of roots) {
      expect(root[DEP.TEMPLATE]).toBe(document.getElementById('card'))
    }
  })

  it('refreshes one expanded instance with its invocation attributes and current app data', async () => {
    document.body.innerHTML = `<template id="card"><article>Old</article></template>
      <main><simply-render rel="card" class="first"></simply-render>
      <simply-render rel="card" class="second"></simply-render></main>`
    const container = document.querySelector('main')
    const editor = app({ container, data: { title: 'New' } })
    const template = document.getElementById('card')
    try {
      template.innerHTML = '<section><span data-simply-field="title"></span></section>'
      expect(editor.binding.rerender(container.querySelector('.first'), template)).toBe(true)
      await wait(0)
      expect(container.querySelector('section.first').textContent).toBe('New')
      expect(container.querySelector('article.second').textContent).toBe('Old')
    } finally {
      editor.destroy()
    }
  })

  it.each(['', 'text', '<p></p><p></p>', '<p></p>text'])(
    'reports invalid template roots before replacing the element (%j)', markup => {
      document.body.innerHTML = `<template id="invalid">${markup}</template><main></main>`
      const host = document.querySelector('main')
      const render = document.createElement('simply-render')
      render.setAttribute('rel', 'invalid')
      let error
      const capture = event => {
        event.preventDefault()
        error = event.error
      }
      window.addEventListener('error', capture)
      try {
        host.appendChild(render)
        expect(error?.message).toContain('template "invalid" must contain a single root element')
        expect(host.childNodes).toHaveLength(1)
        expect(host.firstChild).toBe(render)
      } finally {
        window.removeEventListener('error', capture)
      }
    }
  )

  it('renders when the referenced template is added after the custom element', async () => {
    const render = document.createElement('simply-render')
    render.setAttribute('rel', 'late-card')
    document.body.appendChild(render)

    const template = document.createElement('template')
    template.id = 'late-card'
    template.innerHTML = '<section>Late</section>'
    document.body.appendChild(template)
    await wait()

    expect(document.querySelector('simply-render')).toBeNull()
    expect(document.querySelector('section[data-simply-template="late-card"]').textContent).toBe('Late')
  })
})

