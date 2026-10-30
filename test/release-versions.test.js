/** @jest-environment node */
import { publishedPackage, releaseStatus } from '../scripts/check-release-versions.mjs'

const packed = { name: '@muze-labs/example', version: '0.10.3', shasum: 'local-archive' }
const manifest = (version, shasum) => ({
    'dist-tags': { latest: version },
    versions: { [version]: { dist: { shasum } } }
})

test('an unpublished package or unused version can be published', () => {
    expect(releaseStatus(packed, null)).toEqual({ state: 'publish', latest: null })
    expect(releaseStatus(packed, manifest('0.10.2', 'old'))).toEqual({ state: 'publish', latest: '0.10.2' })
})

test('an identical published archive is skipped when resuming a release', () => {
    expect(releaseStatus(packed, manifest('0.10.3', 'local-archive')).state).toBe('skip')
})

test('a published version with different contents is a collision', () => {
    expect(releaseStatus(packed, manifest('0.10.3', 'old-archive')).state).toBe('collision')
})

test('every published version is checked, even when it is not latest', () => {
    const published = manifest('0.10.4', 'newer')
    published.versions['0.10.3'] = { dist: { shasum: 'old-archive' } }
    expect(releaseStatus(packed, published)).toEqual({ state: 'collision', latest: '0.10.4' })
})

test('missing checksums do not establish that a published package is identical', () => {
    expect(releaseStatus({ ...packed, shasum: undefined }, manifest('0.10.3', undefined)).state).toBe('collision')
})

test('only HTTP 404 means that a package has not been published', async () => {
    const result = await publishedPackage(packed.name, async url => {
        expect(url).toBe('https://registry.npmjs.org/%40muze-labs%2Fexample')
        return { status: 404 }
    })
    expect(result).toBeNull()
    for (const status of [401, 403, 429, 500]) {
        await expect(publishedPackage(packed.name, async () => ({ status, ok: false }))).rejects.toThrow(`HTTP ${status}`)
    }
})

test('network failures and malformed registry replies fail verification', async () => {
    await expect(publishedPackage(packed.name, async () => { throw new Error('offline') })).rejects.toThrow('offline')
    await expect(publishedPackage(packed.name, async () => ({ status: 200, ok: true, json: async () => ({}) }))).rejects.toThrow('invalid package manifest')
})
