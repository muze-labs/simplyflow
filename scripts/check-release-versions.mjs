import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const registry = 'https://registry.npmjs.org/'
const root = fileURLToPath(new URL('../', import.meta.url))

export async function publishedPackage(name, fetchRegistry = globalThis.fetch) {
    const response = await fetchRegistry(`${registry}${encodeURIComponent(name)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`${name}: npm registry returned HTTP ${response.status}`)
    const manifest = await response.json()
    if (!manifest?.versions || typeof manifest.versions !== 'object' || Array.isArray(manifest.versions)) {
        throw new Error(`${name}: npm registry returned an invalid package manifest`)
    }
    return manifest
}

export function releaseStatus(packed, published) {
    const current = published?.versions[packed.version]
    const latest = published?.['dist-tags']?.latest ?? null
    if (!current) return { state: 'publish', latest }
    if (packed.shasum && current.dist?.shasum === packed.shasum) {
        return { state: 'skip', latest }
    }
    return { state: 'collision', latest }
}

export async function checkReleaseVersions({ cwd = root, fetchRegistry = globalThis.fetch, report = console.log } = {}) {
    // Compare the archive npm would publish, including built files. This also
    // permits rerunning the check after only part of a release was published.
    const packed = JSON.parse(execFileSync('npm', [
        'pack', '--dry-run', '--json', '--workspaces', '--ignore-scripts'
    ], { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }))

    const results = await Promise.allSettled(packed.map(async pkg => ({
        pkg,
        ...releaseStatus(pkg, await publishedPackage(pkg.name, fetchRegistry))
    })))
    let failed = false
    for (let index = 0; index < results.length; index++) {
        const result = results[index]
        const pkg = packed[index]
        const label = `${pkg.name}@${pkg.version}`
        if (result.status === 'rejected') {
            failed = true
            report(`ERROR ${label}: could not verify npm (${result.reason.message}). Retry the check.`)
            continue
        }
        const { state, latest } = result.value
        if (state === 'collision') {
            failed = true
            report(`COLLISION ${label}: already published with different contents (latest: ${latest ?? 'unknown'}). Bump its version and update workspace dependency references.`)
        } else if (state === 'skip') {
            report(`SKIP ${label}: identical package already published; do not publish it again.`)
        } else {
            report(`PUBLISH ${label}: version available (latest: ${latest ?? 'unpublished'}).`)
        }
    }
    if (failed) throw new Error('Release version check failed. Nothing was published.')
    report('Release version check passed. Publish only packages marked PUBLISH, in dependency order.')
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try {
        await checkReleaseVersions()
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
