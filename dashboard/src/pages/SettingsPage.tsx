import { useEffect, useState } from 'react'
import {
  Copy, Check, Eye, EyeOff, Settings, Zap, Terminal,
  Coffee, Globe, Wifi, WifiOff, RefreshCw, Box, Code,
  Layers, Package, Key, Plus, Trash2, Activity,
} from 'lucide-react'
import { api } from '../lib/api'
import type { WorkspaceInfo, Service } from '../lib/api'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const size = small ? 13 : 15
  return (
    <button
      onClick={copy}
      title="Copy"
      style={{
        background: copied ? 'rgba(169,220,118,0.15)' : 'rgba(255,255,255,0.07)',
        border: `1px solid ${copied ? 'rgba(169,220,118,0.4)' : 'rgba(255,255,255,0.12)'}`,
        color: copied ? 'var(--success)' : 'var(--text-secondary)',
        borderRadius: 6, padding: small ? '3px 8px' : '5px 10px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
        fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}
    >
      {copied
        ? <><Check style={{ width: size, height: size }} />Copied!</>
        : <><Copy style={{ width: size, height: size }} />Copy</>}
    </button>
  )
}

// ── Code block ─────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1,
      }}>
        <CopyButton text={code} small />
      </div>
      <pre style={{
        margin: 0, padding: '16px 14px',
        fontFamily: '"Fira Code", "Cascadia Code", monospace',
        fontSize: '0.78rem', lineHeight: 1.75,
        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
        overflowX: 'auto', whiteSpace: 'pre',
      }}>
        <code>{code}</code>
      </pre>
      <span style={{
        position: 'absolute', bottom: 10, right: 10,
        fontSize: '0.6rem', color: 'var(--text-muted)',
        fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>{lang}</span>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 20, paddingBottom: 12,
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
      <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>
        {title}
      </h2>
    </div>
  )
}

export function SettingsPage() {
  const [ws, setWs]           = useState<WorkspaceInfo | null>(null)
  const [email, setEmail]     = useState('')
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [tab, setTab]         = useState<'spring' | 'node' | 'csharp' | 'go' | 'ruby' | 'python' | 'sidecar' | 'curl' | 'otel'>('spring')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.me(), 
      api.services(),
      fetch('/api/v1/api-keys', { headers: { Authorization: `Bearer ${localStorage.getItem('tf_token')}` } }).then(r => r.json()).catch(() => ({ keys: [] }))
    ])
      .then(([me, svc, keysData]) => {
        setWs(me.workspace)
        setEmail(me.email)
        setServices(svc.services)
        setApiKeys(keysData.keys ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function reload() {
    setLoading(true)
    Promise.all([
      api.me(), 
      api.services(),
      fetch('/api/v1/api-keys', { headers: { Authorization: `Bearer ${localStorage.getItem('tf_token')}` } }).then(r => r.json()).catch(() => ({ keys: [] }))
    ])
      .then(([me, svc, keysData]) => { 
        setWs(me.workspace)
        setEmail(me.email)
        setServices(svc.services)
        setApiKeys(keysData.keys ?? [])
      })
      .finally(() => setLoading(false))
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault()
    if (!newKeyName) return
    const res = await fetch('/api/v1/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('tf_token')}` },
      body: JSON.stringify({ name: newKeyName })
    })
    if (!res.ok) return
    const data = await res.json()
    setApiKeys([data, ...apiKeys])
    setCreatedKey(data.api_key)
    setShowKeyForm(false)
    setNewKeyName('')
  }

  async function handleRevokeKey(id: string) {
    if (!confirm('Tem certeza? Serviços usando essa chave pararão de enviar dados.')) return
    await fetch(`/api/v1/api-keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('tf_token')}` },
    })
    setApiKeys(apiKeys.map(k => k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k))
  }

  const workspaceId    = ws?.id ?? '…'
  const apiKey         = ws?.api_key ?? ''
  const collectorHost  = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
  const collectorUrl   = `http://${collectorHost}:4317`
  const connected      = services.length > 0
  const maskedKey      = apiKey
    ? apiKey.replace(/^(tf_live_).{4}/, '$1••••').replace(/.{4}$/, '••••')
    : ''

  // ── Snippets ─────────────────────────────────────────────────────────────────
  const springYml = `# application.yml
traceflow:
  collector-url: ${collectorUrl}
  api-key: ${apiKey}
  capture-http-body: true
  redact-sensitive-fields: true`

  const springPom = `<!-- pom.xml — dentro de <dependencies> -->
<dependency>
  <groupId>com.traceflow</groupId>
  <artifactId>traceflow-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>`


  const nodeInstall = `npm install @traceflow/sdk`

  const envFile = `# .env
TRACEFLOW_API_KEY=${apiKey}
TRACEFLOW_COLLECTOR_URL=${collectorUrl}`

  const curlTest = `curl -X POST ${collectorUrl}/v1/logs \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{
    "id": "test-log-1",
    "trace_id": "abc123def456",
    "service_name": "meu-servico",
    "level": "INFO",
    "message": "Hello TraceFlow! 🚀",
    "timestamp": "${new Date().toISOString()}"
  }'`

  const goInit = `import "github.com/traceflow/sdk-go"

// Envolve seu handler padrão net/http:
http.Handle("/minha-rota", traceflow.Middleware(meuHandler))

// Ou usando gin-gonic:
// r.Use(traceflow.GinMiddleware())`

  const csharpInit = `// No Program.cs (.NET 6+) ou Startup.cs
using TraceFlow.Sdk;

var builder = WebApplication.CreateBuilder(args);
// Configura serviços (adiciona o HTTP client background e etc)
builder.Services.AddTraceFlow(options => {
    options.ServiceName = "meu-servico-dotnet";
});

var app = builder.Build();
// Adiciona o Middleware na pipeline
app.UseTraceFlow();`

  const rubyInit = `# Em config/application.rb (Rails) ou no Sinatra
require 'traceflow'

# Adiciona o middleware do Rack
config.middleware.use TraceFlow::Middleware, service_name: "meu-servico-ruby"`

  const sidecarCompose = `# docker-compose.yml — adicione ao seu projeto
services:

  meu-servico:       # seu serviço existente
    build: .         # sem alterações de código
    # ports: []      # remova a exposição direta de porta

  meu-servico-sidecar:
    image: traceflow/sidecar:latest
    environment:
      TF_TARGET:        "http://meu-servico:8080"  # upstream
      TF_SERVICE_NAME:  "meu-servico"              # nome no TraceFlow
      TF_API_KEY:       "${apiKey}"
      TF_COLLECTOR_URL: "${collectorUrl}"
    ports:
      - "8080:8080"   # clientes apontam para cá`

  const otelCollectorConfig = `# otel-collector-config.yaml
exporters:
  otlphttp/traceflow:
    endpoint: ${collectorUrl}
    headers:
      x-api-key: "${apiKey}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/traceflow]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/traceflow]`

  const pyInstall = `pip install traceflow-sdk`
  
  const pyFastApi = `from fastapi import FastAPI
from traceflow import TraceFlow
from traceflow.integrations.fastapi import TraceFlowMiddleware

TraceFlow.init(
    service_name="my-fastapi",
    api_key="${apiKey}",
    collector_url="${collectorUrl}"
)

app = FastAPI()
app.add_middleware(TraceFlowMiddleware)

@app.get("/")
def read_root():
    return {"status": "ok"}`

  const pyFlask = `from flask import Flask
from traceflow import TraceFlow
from traceflow.integrations.flask import TraceFlowFlask

TraceFlow.init(
    service_name="my-flask",
    api_key="${apiKey}",
    collector_url="${collectorUrl}"
)

app = Flask(__name__)
TraceFlowFlask(app)

@app.route("/")
def index():
    return {"status": "ok"}`

  const pyDjango = `from traceflow import TraceFlow

TraceFlow.init(
    service_name="my-django",
    api_key="${apiKey}",
    collector_url="${collectorUrl}"
)

# In settings.py, add to MIDDLEWARE:
MIDDLEWARE = [
    # ...
    'traceflow.integrations.django.TraceFlowMiddleware',
]`

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Settings style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3, animation: 'spin 2s linear infinite' }} />
          <div className="text-sm">Loading settings…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div style={{ maxWidth: 860 }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Settings
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tudo o que você precisa para integrar seus serviços ao TraceFlow.
          </p>
        </div>

        {/* ── Connection status ── */}
        <div className="glass-card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: connected ? 'var(--success)' : 'var(--text-muted)',
                boxShadow: connected ? '0 0 8px var(--success)' : 'none',
                animation: connected ? 'none' : 'pulse 2s ease infinite',
              }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
                  {connected ? `Integrado — ${services.length} service${services.length > 1 ? 's' : ''} detectado${services.length > 1 ? 's' : ''}` : 'Aguardando primeiro trace…'}
                </div>
                {connected && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {services.map(s => s.name).join(' · ')}
                  </div>
                )}
                {!connected && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Nenhum dado recebido ainda. Integre um serviço usando os snippets abaixo.
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {connected ? <Wifi style={{ width: 18, height: 18, color: 'var(--success)' }} /> : <WifiOff style={{ width: 18, height: 18, color: 'var(--text-muted)' }} />}
              <button onClick={reload} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <RefreshCw style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Workspace info ── */}
        <div className="glass-card" style={{ marginBottom: 24, padding: '20px 24px' }}>
          <SectionTitle icon={<Settings style={{ width: 16, height: 16 }} />} title="Workspace" />

          <div style={{ display: 'grid', gap: 16 }}>
            {/* Name + email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Workspace Name</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ws?.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Account</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{email}</div>
              </div>
            </div>

            {/* Workspace ID */}
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>Workspace ID</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <code style={{
                  flex: 1, fontFamily: 'monospace', fontSize: '0.88rem',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent-primary)',
                }}>{workspaceId}</code>
                <CopyButton text={workspaceId} />
              </div>
            </div>

            {/* API Key */}
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6, textTransform: 'uppercase' }}>API Key</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <code style={{
                  flex: 1, fontFamily: 'monospace', fontSize: '0.88rem',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)', letterSpacing: apiKeyVisible ? 'normal' : '0.1em',
                }}>{apiKeyVisible ? ws?.api_key : maskedKey}</code>
                <button
                  onClick={() => setApiKeyVisible(v => !v)}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                    borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {apiKeyVisible ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
                {ws?.api_key && <CopyButton text={ws.api_key} />}
              </div>
            </div>

            {/* Plan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
                background: ws?.plan === 'free' ? 'rgba(255,255,255,0.06)' : 'rgba(249,115,22,0.15)',
                color: ws?.plan === 'free' ? 'var(--text-muted)' : 'var(--accent-primary)',
                border: ws?.plan === 'free' ? '1px solid var(--border-subtle)' : '1px solid rgba(249,115,22,0.4)',
              }}>{ws?.plan ?? 'free'}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Criado em {ws?.created_at ? new Date(ws.created_at).toLocaleDateString('pt-BR') : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── API Keys ── */}
        <div className="glass-card" style={{ marginBottom: 24, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--accent-primary)' }}><Key style={{ width: 16, height: 16 }} /></span>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>API Keys</h2>
            </div>
            <button
              onClick={() => setShowKeyForm(v => !v)}
              className="btn-primary"
              style={{ width: 'auto', padding: '6px 12px', gap: '6px', fontSize: '0.75rem', height: 'auto' }}
            >
              <Plus style={{ width: 14, height: 14 }} /> New Key
            </button>
          </div>

          {showKeyForm && (
            <form onSubmit={handleCreateKey} style={{ marginBottom: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production, Staging"
                    required
                    className="glass-input"
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Create</button>
                <button type="button" onClick={() => setShowKeyForm(false)} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {createdKey && (
            <div style={{ marginBottom: 24, padding: 16, background: 'rgba(169,220,118,0.1)', border: '1px solid rgba(169,220,118,0.3)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check style={{ width: 16, height: 16 }} /> API Key created successfully!
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Please copy this key now. You will not be able to see it again.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <code style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {createdKey}
                </code>
                <CopyButton text={createdKey} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apiKeys.length === 0 ? (
              <div className="text-sm text-muted">No API keys created yet.</div>
            ) : (
              apiKeys.map(k => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{k.name}</span>
                      {k.revoked_at ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error)' }}>REVOKED</span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(169,220,118,0.15)', color: 'var(--success)' }}>ACTIVE</span>
                      )}
                    </div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{k.key_prefix}••••••••••••</code>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Created: {new Date(k.created_at).toLocaleDateString()} · Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                  {!k.revoked_at && (
                    <button onClick={() => handleRevokeKey(k.id)} style={{ padding: 8, background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'} title="Revoke Key">
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Getting Started ── */}
        <div className="glass-card" style={{ marginBottom: 24, padding: '20px 24px' }}>
          <SectionTitle icon={<Zap style={{ width: 16, height: 16 }} />} title="Getting Started" />

          {/* Language tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
            {([
              { id: 'spring',  label: 'Spring Boot', icon: <Coffee style={{ width: 13, height: 13 }} /> },
              { id: 'csharp',  label: '.NET / C#',   icon: <Layers style={{ width: 13, height: 13 }} /> },
              { id: 'node',    label: 'Node.js',     icon: <Terminal style={{ width: 13, height: 13 }} /> },
              { id: 'go',      label: 'Go',          icon: <Code style={{ width: 13, height: 13 }} /> },
              { id: 'ruby',    label: 'Ruby',        icon: <Package style={{ width: 13, height: 13 }} /> },
              { id: 'python',  label: 'Python',      icon: <Terminal style={{ width: 13, height: 13 }} /> },
              { id: 'sidecar', label: 'Sidecar',     icon: <Box style={{ width: 13, height: 13 }} /> },
              { id: 'otel',    label: 'OpenTelemetry',icon: <Activity style={{ width: 13, height: 13 }} /> },
              { id: 'curl',    label: 'cURL / Test', icon: <Globe style={{ width: 13, height: 13 }} /> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                  background: tab === t.id ? 'rgba(249,115,22,0.15)' : 'transparent',
                  border: tab === t.id ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
                  color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >{t.icon}{t.label}</button>
            ))}
          </div>

          {/* Spring Boot tab */}
          {tab === 'spring' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Adicione a dependência ao seu <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>pom.xml</code> e configure o <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>application.yml</code>. O SDK captura automaticamente todas as requisições HTTP de entrada e saída.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                1. Adicione ao pom.xml
              </div>
              <CodeBlock code={springPom} lang="xml" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                2. Configure o application.yml
              </div>
              <CodeBlock code={springYml} lang="yaml" />
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)',
              }}>
                <Zap style={{ width: 14, height: 14, color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
                Reinicie o serviço após a configuração. O TraceFlow passa a instrumentar automaticamente todas as requisições — sem mais nenhuma alteração de código.
              </div>
            </div>
          )}

          {/* Node.js tab */}
          {tab === 'node' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Instale o SDK e adicione o middleware ao seu Express. Todas as rotas serão instrumentadas automaticamente com captura de body, headers e propagação de trace entre serviços.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                1. Instale o pacote
              </div>
              <CodeBlock code={nodeInstall} lang="bash" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                2. Inicialize no seu app
              </div>
              <CodeBlock code={nodeInit} lang="typescript" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                Opção: via variáveis de ambiente (.env)
              </div>
              <CodeBlock code={envFile} lang=".env" />
            </div>
          )}

          {/* C# tab */}
          {tab === 'csharp' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Instale o pacote NuGet e adicione o middleware na sua pipeline do ASP.NET Core. Ele faz buffer do Request/Response de forma segura.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                1. Instale o pacote
              </div>
              <CodeBlock code="dotnet add package TraceFlow.Sdk" lang="bash" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                2. Configuração no Program.cs
              </div>
              <CodeBlock code={csharpInit} lang="csharp" />
            </div>
          )}

          {/* Go tab */}
          {tab === 'go' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Baixe o módulo e adicione o middleware para interceptar requisições HTTP nativas.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                1. Instale o módulo
              </div>
              <CodeBlock code="go get github.com/traceflow/sdk-go" lang="bash" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                2. Envolva seus handlers
              </div>
              <CodeBlock code={goInit} lang="go" />
            </div>
          )}

          {/* Ruby tab */}
          {tab === 'ruby' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Instale a Gem e inclua o middleware Rack. Funciona nativamente com Ruby on Rails, Sinatra e qualquer aplicação baseada em Rack.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                1. Adicione ao Gemfile
              </div>
              <CodeBlock code="gem 'traceflow-sdk'" lang="ruby" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                2. Use o middleware
              </div>
              <CodeBlock code={rubyInit} lang="ruby" />
            </div>
          )}

          {/* Sidecar tab */}
          {tab === 'sidecar' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                O Sidecar é um proxy reverso que senta na frente do seu serviço. Você <strong style={{ color: 'var(--text-primary)' }}>não toca no código</strong> — só redireciona a porta no docker-compose. Ideal para serviços legados ou linguagens sem SDK.
              </p>

              {/* Comparison table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Sidecar (zero código)', items: ['✅ Request body', '✅ Response body', '✅ Status HTTP', '✅ Latência', '✅ Propagação de trace', '❌ Logs de negócio'], accent: false },
                  { label: 'SDK (uma linha de código)', items: ['✅ Request body', '✅ Response body', '✅ Status HTTP', '✅ Latência', '✅ Propagação de trace', '✅ Logs de negócio'], accent: true },
                ].map(col => (
                  <div key={col.label} style={{
                    background: col.accent ? 'rgba(249,115,22,0.06)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${col.accent ? 'rgba(249,115,22,0.25)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)', padding: '14px 16px',
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: col.accent ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: 10, letterSpacing: '0.04em' }}>{col.label}</div>
                    {col.items.map(item => (
                      <div key={item} style={{ fontSize: '0.78rem', color: item.startsWith('❌') ? 'var(--text-muted)' : 'var(--text-secondary)', marginBottom: 4 }}>{item}</div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                Adicione ao seu docker-compose.yml
              </div>
              <CodeBlock code={sidecarCompose} lang="yaml" />
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)',
              }}>
                <Box style={{ width: 14, height: 14, color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
                O sidecar injeta o header <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>X-Traceflow-Trace-Id</code> nas respostas. Se dois serviços tiverem sidecar, os traces aparecem correlacionados automaticamente.
              </div>
            </div>
          )}

          {/* Python tab */}
          {tab === 'python' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                O SDK Python intercepta requests e propaga contexto no FastAPI, Flask e Django.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                Instalação
              </div>
              <CodeBlock code={pyInstall} lang="bash" />
              
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, marginTop: 16, fontWeight: 600, letterSpacing: '0.04em' }}>
                FastAPI
              </div>
              <CodeBlock code={pyFastApi} lang="python" />

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, marginTop: 16, fontWeight: 600, letterSpacing: '0.04em' }}>
                Flask
              </div>
              <CodeBlock code={pyFlask} lang="python" />

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, marginTop: 16, fontWeight: 600, letterSpacing: '0.04em' }}>
                Django
              </div>
              <CodeBlock code={pyDjango} lang="python" />
            </div>
          )}

          {/* cURL tab */}
          {tab === 'curl' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Teste a conexão diretamente com cURL antes de integrar o SDK. Se o comando abaixo retornar <code style={{ color: 'var(--success)', fontFamily: 'monospace' }}>201 Created</code>, o coletor está funcionando.
              </p>
              <CodeBlock code={curlTest} lang="bash" />
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                background: 'rgba(169,220,118,0.06)', border: '1px solid rgba(169,220,118,0.2)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)',
              }}>
                <Check style={{ width: 14, height: 14, color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                Após executar, o log aparecerá em Traces → detalhe do trace com o trace_id <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>abc123def456</code>.
              </div>
            </div>
          )}

          {/* OpenTelemetry tab */}
          {tab === 'otel' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                O TraceFlow tem suporte nativo a OpenTelemetry via <strong>OTLP/HTTP</strong>. Você pode enviar traces e logs diretamente do seu <code style={{ color: 'var(--text-primary)' }}>otel-collector</code> ou configurar o exporter diretamente na sua aplicação.
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em' }}>
                Opção 1: OTEL Collector (Recomendado)
              </div>
              <CodeBlock code={otelCollectorConfig} lang="yaml" />
              
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, marginTop: 16, fontWeight: 600, letterSpacing: '0.04em' }}>
                Opção 2: Via variáveis de ambiente (qualquer linguagem com OTEL)
              </div>
              <CodeBlock code={`OTEL_EXPORTER_OTLP_ENDPOINT="${collectorUrl}"
OTEL_EXPORTER_OTLP_HEADERS="x-api-key=${apiKey}"
OTEL_TRACES_EXPORTER="otlp"
OTEL_LOGS_EXPORTER="otlp"`} lang="env" />

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 16
              }}>
                <Zap style={{ width: 14, height: 14, color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
                Os endpoints <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>/v1/traces</code> e <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>/v1/logs</code> já estão embutidos na URL base acima, seguindo o padrão da especificação OTLP.
              </div>
            </div>
          )}
        </div>

        {/* ── Collector endpoint ── */}
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24 }}>
          <SectionTitle icon={<Globe style={{ width: 16, height: 16 }} />} title="Collector Endpoint" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Spans (HTTP)',  url: `${collectorUrl}/v1/spans` },
              { label: 'Logs (HTTP)',   url: `${collectorUrl}/v1/logs` },
              { label: 'Health check', url: `${collectorUrl}/health` },
            ].map(row => (
              <div key={row.label} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4, textTransform: 'uppercase' }}>{row.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1 }}>{row.url}</code>
                  <CopyButton text={row.url} small />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
