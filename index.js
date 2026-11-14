import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const API_ROOT = '/api/open-design-preset'

const ROOTS = {
  functional: {
    id: 'functional',
    label: '功能技能',
    local: path.join(DSH_HOME, 'open-design', 'skills'),
    bundled: path.join(PACKAGE_ROOT, 'skills'),
  },
  design: {
    id: 'design',
    label: '设计系统',
    local: path.join(DSH_HOME, 'open-design', 'design-system-skills'),
    bundled: path.join(PACKAGE_ROOT, 'design-system-skills'),
  },
}

const GLOBAL_ROOTS = [
  path.join(DSH_HOME, 'skills'),
  path.join(os.homedir(), '.agents', 'skills'),
  ...(process.env.DSH_BUNDLED_SKILL_DIR ? [process.env.DSH_BUNDLED_SKILL_DIR] : []),
]

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function text(res, status, value) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8',
  })
  res.end(value)
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1024 * 1024) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const raw = Buffer.concat(chunks).toString('utf8')
  const parsed = JSON.parse(raw)
  return parsed !== null && typeof parsed === 'object' ? parsed : {}
}

function sameOrigin(req) {
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return false
  return true
}

function unquote(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseFrontmatter(raw) {
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  if (!match) return {}
  const lines = match[1].split('\n')
  const data = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!pair) continue
    const key = pair[1]
    const first = pair[2]
    if (first === '' || first === '|' || first === '>' || first === '|-' || first === '>-') {
      const values = []
      for (index += 1; index < lines.length; index += 1) {
        const next = lines[index]
        if (/^[A-Za-z0-9_-]+:\s*/.test(next)) {
          index -= 1
          break
        }
        const trimmed = next.trim()
        if (trimmed !== '') values.push(trimmed)
      }
      data[key] = values.join(first === '|' || first === '|-' ? '\n' : ' ')
    } else {
      data[key] = unquote(first)
    }
  }
  return data
}

async function readSkill(directory, kind, globals) {
  let fileName
  let enabled
  try {
    await fs.access(path.join(directory, 'SKILL.md'))
    fileName = 'SKILL.md'
    enabled = true
  } catch {
    try {
      await fs.access(path.join(directory, 'SKILL.md.disabled'))
      fileName = 'SKILL.md.disabled'
      enabled = false
    } catch {
      return undefined
    }
  }
  let raw
  try {
    raw = await fs.readFile(path.join(directory, fileName), 'utf8')
  } catch {
    return undefined
  }
  const meta = parseFrontmatter(raw)
  const name = String(meta.name || path.basename(directory)).trim()
  const description = String(meta.description || '').replace(/\s+/g, ' ').trim()
  return {
    kind,
    folder: path.basename(directory),
    name,
    description: description.length > 240 ? `${description.slice(0, 239)}…` : description,
    enabled,
    global: globals.has(name),
  }
}

async function scanRoot(root, kind, globals) {
  let entries = []
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const skills = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const skill = await readSkill(path.join(root, entry.name), kind, globals)
    if (skill !== undefined) skills.push(skill)
  }
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

async function scanGlobals() {
  const names = new Set()
  for (const root of GLOBAL_ROOTS) {
    let entries = []
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) {
        for (const fileName of ['SKILL.md', 'SKILL.md.disabled']) {
          try {
            const raw = await fs.readFile(path.join(root, entry.name, fileName), 'utf8')
            const meta = parseFrontmatter(raw)
            if (meta.name) names.add(String(meta.name).trim())
            else names.add(entry.name)
            break
          } catch {
            /* try the next name */
          }
        }
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = await fs.readFile(path.join(root, entry.name), 'utf8')
          const meta = parseFrontmatter(raw)
          if (meta.name) names.add(String(meta.name).trim())
          else names.add(entry.name.replace(/\.md$/, ''))
        } catch {
          /* ignore unreadable global skill */
        }
      }
    }
  }
  return names
}

async function countDirs(root) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).length
  } catch {
    return 0
  }
}

async function readState() {
  const globals = await scanGlobals()
  const functional = await scanRoot(ROOTS.functional.local, 'functional', globals)
  const design = await scanRoot(ROOTS.design.local, 'design', globals)
  const functionalExpected = await countDirs(ROOTS.functional.bundled)
  const designExpected = await countDirs(ROOTS.design.bundled)
  const functionalLocal = new Set(functional.map((skill) => skill.name))
  const designLocal = new Set(design.map((skill) => skill.name))
  const functionalBundled = new Set()
  const designBundled = new Set()
  for (const entry of await fs.readdir(ROOTS.functional.bundled, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) functionalBundled.add(entry.name)
  }
  for (const entry of await fs.readdir(ROOTS.design.bundled, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) designBundled.add(entry.name)
  }
  const missingFunctional = [...functionalBundled].filter((folder) => !functional.some((skill) => skill.folder === folder))
  const missingDesign = [...designBundled].filter((folder) => !design.some((skill) => skill.folder === folder))
  return {
    ok: true,
    version: JSON.parse(await fs.readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version,
    roots: [
      { id: 'functional', label: '功能技能', path: ROOTS.functional.local, installed: functional.length, expected: functionalExpected, missing: missingFunctional },
      { id: 'design', label: '设计系统', path: ROOTS.design.local, installed: design.length, expected: designExpected, missing: missingDesign },
    ],
    globalRoots: GLOBAL_ROOTS,
    total: functional.length + design.length,
    enabled: functional.filter((skill) => skill.enabled).length + design.filter((skill) => skill.enabled).length,
    globalCount: [...new Set([...functional, ...design].filter((skill) => skill.global).map((skill) => skill.name))].length,
    skills: [...functional, ...design],
  }
}

async function copyMissing(from, to) {
  await fs.mkdir(to, { recursive: true })
  let copied = 0
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const target = path.join(to, entry.name)
    try {
      await fs.access(target)
      continue
    } catch {
      await fs.cp(path.join(from, entry.name), target, { recursive: true })
      copied += 1
    }
  }
  return copied
}

async function installBundled() {
  const functional = await copyMissing(ROOTS.functional.bundled, ROOTS.functional.local)
  const design = await copyMissing(ROOTS.design.bundled, ROOTS.design.local)
  return { functional, design, total: functional + design }
}

async function toggleSkill(name, enabled) {
  for (const root of [ROOTS.functional.local, ROOTS.design.local]) {
    let entries = []
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const directory = path.join(root, entry.name)
      const active = path.join(directory, 'SKILL.md')
      const disabled = path.join(directory, 'SKILL.md.disabled')
      let current
      const meta = await readSkill(directory, 'functional', new Set())
      if (meta === undefined || meta.name !== name) continue
      try {
        await fs.access(active)
        current = active
      } catch {
        current = disabled
      }
      const target = enabled ? active : disabled
      if (current === target) return { ok: true, name, enabled }
      await fs.rename(current, target)
      return { ok: true, name, enabled }
    }
  }
  return { ok: false, error: 'skill not found' }
}

function route(ctx, req, res, url) {
  let rejection
  const connection = ctx.get?.('connection')
  if (connection !== undefined && typeof connection.requestRejection === 'function') {
    try {
      rejection = connection.requestRejection(req)
    } catch {
      rejection = 403
    }
  } else if (!sameOrigin(req)) {
    rejection = 403
  }
  if (rejection !== undefined) {
    text(res, rejection, rejection === 401 ? 'unauthorized: browser session required' : 'forbidden')
    return
  }
  if (url.pathname === `${API_ROOT}/state` && req.method === 'GET') {
    readState().then((state) => json(res, 200, state)).catch((error) => json(res, 500, { ok: false, error: error.message }))
    return
  }
  if (url.pathname === `${API_ROOT}/install` && req.method === 'POST') {
    installBundled().then((result) => json(res, 200, { ok: true, ...result })).catch((error) => json(res, 500, { ok: false, error: error.message }))
    return
  }
  if (url.pathname === `${API_ROOT}/toggle` && req.method === 'POST') {
    readJsonBody(req)
      .then((body) => toggleSkill(String(body.name || ''), body.enabled === true))
      .then((result) => json(res, result.ok ? 200 : 404, result))
      .catch((error) => json(res, 400, { ok: false, error: error.message }))
    return
  }
  json(res, 404, { ok: false, error: 'unknown route' })
}

function apply(ctx) {
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: API_ROOT,
      methods: ['GET', 'POST'],
      handler: async (req, res) => {
        route(ctx, req, res, new URL(req.url || '/', 'http://localhost'))
      },
    })
    return dispose
  }, 'open-design-preset: settings routes')
}

export { apply }
export const inject = ['webServer']
