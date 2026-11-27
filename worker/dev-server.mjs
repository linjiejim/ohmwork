/**
 * Zero-dependency local dev server for the Cloudflare Worker (Node 22+).
 * Persists KV entries in .worker-kv.json at the repo root so you can test
 * the full frontend + worker flow locally without a Cloudflare account.
 *
 * Optional env vars:
 *   PORT=8787
 *   GITHUB_CLIENT_ID=...
 *   GITHUB_CLIENT_SECRET=...
 *   MOCK_GITHUB=1   # Enables a built-in mock GitHub OAuth page for local testing
 */
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { handleRequest } from "./src/app.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const kvFile = process.env.KV_FILE || path.resolve(__dirname, "../.worker-kv.json")
const port = Number(process.env.PORT || 8787)
const mockGithub = process.env.MOCK_GITHUB === "1"

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(kvFile, "utf8"))
  } catch {
    return {}
  }
}

let store = loadStore()
function saveStore() {
  fs.writeFileSync(kvFile, JSON.stringify(store, null, 2))
}

const KV = {
  async get(key) {
    const entry = store[key]
    if (!entry) return null
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      delete store[key]
      saveStore()
      return null
    }
    return entry.value
  },
  async put(key, value, options) {
    store[key] = {
      value,
      expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null,
    }
    saveStore()
  },
  async delete(key) {
    if (key in store) {
      delete store[key]
      saveStore()
    }
  },
}

const baseUrl = `http://127.0.0.1:${port}`
const mockAccounts = new Map([
  ["demo-octocat", { id: 10001, login: "octocat", name: "The Octocat", avatar_url: null }],
  ["demo-ada", { id: 10002, login: "ada-ee", name: "Ada", avatar_url: null }],
])

const env = {
  KV,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:5273,http://127.0.0.1:5273,https://ohmwork.linjiejim.com",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || baseUrl,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || (mockGithub ? "mock-client-id" : ""),
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || (mockGithub ? "mock-client-secret" : ""),
  GITHUB_OAUTH_BASE: mockGithub ? `${baseUrl}/__mock_github` : undefined,
  GITHUB_API_BASE: mockGithub ? `${baseUrl}/__mock_github_api` : undefined,
}

async function handleMockGithub(url, req) {
  if (url.pathname === "/__mock_github/login/oauth/authorize") {
    const redirectUri = url.searchParams.get("redirect_uri") || `${baseUrl}/auth/github/callback`
    const state = url.searchParams.get("state") || ""
    const pick = url.searchParams.get("pick")
    if (pick && mockAccounts.has(pick)) {
      const target = new URL(redirectUri)
      target.searchParams.set("code", pick)
      target.searchParams.set("state", state)
      return new Response(null, { status: 302, headers: { Location: target.toString() } })
    }
    const links = [...mockAccounts.entries()]
      .map(([code, acc]) => {
        const next = new URL(redirectUri)
        next.searchParams.set("code", code)
        next.searchParams.set("state", state)
        return `<li style="margin:12px 0"><a href="${next.toString()}" style="font-size:16px">授权登录为 @${acc.login}（${acc.name}）</a></li>`
      })
      .join("")
    const cancel = new URL(redirectUri)
    cancel.searchParams.set("error", "access_denied")
    cancel.searchParams.set("state", state)
    const html = `<!doctype html><meta charset="utf-8"><title>Mock GitHub OAuth</title><body style="font-family:system-ui;max-width:480px;margin:48px auto;padding:0 16px"><h1>本地模拟 GitHub OAuth</h1><p>选择一个模拟账号完成授权：</p><ul>${links}</ul><p><a href="${cancel.toString()}">取消授权</a></p></body>`
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })
  }
  if (url.pathname === "/__mock_github/login/oauth/access_token" && req.method === "POST") {
    const body = await req.json()
    if (!mockAccounts.has(body.code)) {
      return new Response(JSON.stringify({ error: "bad_verification_code" }), { status: 400 })
    }
    return new Response(JSON.stringify({ access_token: `mock-token:${body.code}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (url.pathname === "/__mock_github_api/user") {
    const auth = req.headers.get("Authorization") || ""
    const code = auth.replace(/^Bearer\s+mock-token:/, "")
    const acc = mockAccounts.get(code)
    if (!acc) return new Response("Unauthorized", { status: 401 })
    return new Response(JSON.stringify(acc), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
  return null
}

const server = http.createServer(async (req, res) => {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
    const fullUrl = new URL(req.url || "/", baseUrl)
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((item) => headers.append(k, item))
      else if (v !== undefined) headers.set(k, v)
    }
    const request = new Request(fullUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    })

    const response = (mockGithub && (await handleMockGithub(fullUrl, request))) || (await handleRequest(request, env))
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    const buf = Buffer.from(await response.arrayBuffer())
    res.end(buf)
  } catch (err) {
    console.error("[ohmwork-worker]", err)
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Internal Server Error" }))
  }
})

server.listen(port, "127.0.0.1", () => {
  console.log(`[ohmwork-worker] listening on ${baseUrl} (kv: ${kvFile}${mockGithub ? ", mock GitHub OAuth ON" : ""})`)
})
