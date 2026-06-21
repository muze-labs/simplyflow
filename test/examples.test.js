import fs from 'node:fs'
import { jest } from '@jest/globals'

const wait = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))

const sampleItems = [
  {
    id: 1,
    title: 'One',
    time_ago: '1 hour ago',
    user: 'ada',
    domain: 'example.com',
    comments_count: 2,
    points: 10
  },
  {
    id: 2,
    title: 'Two',
    time_ago: '2 hours ago',
    user: 'bob',
    domain: 'example.org',
    comments_count: 3,
    points: 20
  }
]

const sampleItem = {
  id: 1,
  title: 'One',
  url: 'https://example.com/',
  domain: 'example.com',
  content: 'hello',
  points: 10,
  user: 'ada',
  time_ago: '1 hour ago',
  comments: []
}

function readExample(step)
{
  return fs.readFileSync(`examples/hnpwa/hnpwa.step${step}.html`, 'utf8')
}

async function runHnpwaExample(step)
{
  document.body.innerHTML = readExample(step)
  history.replaceState({}, '', `/examples/hnpwa/hnpwa.step${step}.html`)

  await import('@muze-labs/simplyflow')

  globalThis.metro = {
    jsonApi() {
      return {
        news: jest.fn(async () => sampleItems),
        item: jest.fn(async () => sampleItem)
      }
    },
    api() {
      return {
        news: jest.fn(async () => sampleItems),
        item: jest.fn(async () => sampleItem)
      }
    }
  }

  const moduleCode = Array.from(document.querySelectorAll('script[type="module"]'))
    .map(script => script.textContent)
    .join('\n')
    .replace(/^import .*$/mg, '')
    .replace('var hnpwa =', 'globalThis.hnpwa =')
    .replace('simply.bind({', 'globalThis.hnpwaBinding = simply.bind({')

  await globalThis.eval(`(async () => {${moduleCode}\n})()`)
  await wait(150)
}

describe('HNPWA examples', () => {
  afterEach(() => {
    if (globalThis.hnpwaBinding?.destroy) {
      globalThis.hnpwaBinding.destroy()
    }
    if (globalThis.hnpwa?.destroy) {
      globalThis.hnpwa.destroy()
    }
    delete globalThis.hnpwaBinding
    delete globalThis.hnpwa
    delete globalThis.metro
    document.body.innerHTML = ''
    history.replaceState({}, '', '/')
    jest.restoreAllMocks()
  })

  it('keeps all script tags closed', () => {
    for (const step of [1, 2, 3, 4, 5]) {
      const html = readExample(step)
      const openScripts = html.match(/<script\b/gi)?.length || 0
      const closeScripts = html.match(/<\/script>/gi)?.length || 0

      expect(closeScripts).toBe(openScripts)
    }
  })

  it('keeps beginner example import maps small', () => {
    for (const step of [1, 2, 3, 4, 5]) {
      const html = readExample(step)
      const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)
      const importMap = JSON.parse(match[1])

      expect(Object.keys(importMap.imports)).toEqual([
        '@muze-labs/simplyflow',
        '@muze-nl/metro'
      ])
      expect(importMap.imports['@muze-labs/simplyflow']).toBe(
        '../../packages/simplyflow/dist/simply.flow.js'
      )
    }

    for (const file of fs.readdirSync('examples/datagrid').filter(file => file.endsWith('.html'))) {
      const html = fs.readFileSync(`examples/datagrid/${file}`, 'utf8')
      const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)
      const importMap = JSON.parse(match[1])

      expect(Object.keys(importMap.imports)).toEqual(['@muze-labs/simplyflow'])
      expect(importMap.imports['@muze-labs/simplyflow']).toBe(
        '../../packages/simplyflow/dist/simply.flow.js'
      )
    }
  })

  it('keeps beginner examples from importing split packages directly', () => {
    const allowed = new Set(['examples/edit.html'])
    const files = [
      ...fs.readdirSync('examples/hnpwa').filter(file => file.endsWith('.html')).map(file => `examples/hnpwa/${file}`),
      ...fs.readdirSync('examples/datagrid').filter(file => file.endsWith('.html')).map(file => `examples/datagrid/${file}`),
      'examples/edit.html'
    ]

    for (const file of files) {
      const html = fs.readFileSync(file, 'utf8')
      if (allowed.has(file)) {
        continue
      }

      expect(html).not.toMatch(/@muze-labs\/simplyflow-(state|bind|model|app|edit)/)
      expect(html).not.toMatch(/@muze-labs\/simplyflow\/(state|bind|model|app|dom|path|route|commands|actions|behaviors|includes|shortcuts|highlight|render|suggest|symbols)/)
    }
  })

  it('renders step 1 with loaded stories', async () => {
    await runHnpwaExample(1)

    expect(document.body.textContent).toContain('One')
    expect(document.body.textContent).toContain('Two')
  })

  it('renders step 2 with loaded stories', async () => {
    await runHnpwaExample(2)

    expect(document.querySelectorAll('li.item')).toHaveLength(2)
    expect(document.body.textContent).toContain('One')
    expect(document.body.textContent).toContain('Two')
  })
})
