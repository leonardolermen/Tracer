import { useEffect, useState } from 'react'
import {
  Copy, Check, Eye, EyeOff, Settings, Zap, Terminal,
  Coffee, Globe, Wifi, WifiOff, RefreshCw,
} from 'lucide-react'
import { api } from '../lib/api'
import type { WorkspaceInfo, Service } from '../lib/api'

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
  const [tab, setTab]         = useState<'spring' | 'node' | 'curl'>('spring')

  useEffect(() => {
    Promise.all([api.me(), api.services()])
      .then(([me, svc]) => {
        setWs(me.workspace)
        setEmail(me.email)
        setServices(svc.services)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function reload() {
    setLoading(true)
    Promise.all([api.me(), api.services()])
      .then(([me, svc]) => { setWs(me.workspace); setEmail(me.email); setServices(svc.services) })
      .finally(() => setLoading(false))
  }

  const workspaceId    = ws?.id ?? '…'
  const collectorHost  = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
  const collectorUrl   = `http://${collectorHost}:4317`
  const connected      = services.length > 0
  const maskedKey      = ws?.api_key
    ? ws.api_key.replace(/^(tf_live_).{4}/, '$1••••').replace(/.{4}$/, '••••')
    : ''

  // ── Snippets ─────────────────────────────────────────────────────────────────
  const springYml = `# application.yml
traceflow:
  collector-url: ${collectorUrl}
  workspace-id: ${workspaceId}
  capture-http-body: true
  redact-sensitive-fields: true`

  const springPom = `<!-- pom.xml — dentro de <dependencies> -->
<dependency>
  <groupId>com.traceflow</groupId>
  <artifactId>traceflow-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>`

  const nodeInit = `import { TraceFlow, traceflowMiddleware } from '@traceflow/sdk'

// Opção 1: via código
TraceFlow.init({
  serviceName: 'meu-servico',
  workspaceId: '${workspaceId}',
  collectorUrl: '${collectorUrl}',
})

// Opção 2: via variáveis de ambiente (recomendado)
// TRACEFLOW_WORKSPACE_ID=${workspaceId}
// TRACEFLOW_COLLECTOR_URL=${collectorUrl}
TraceFlow.init({ serviceName: 'meu-servico' })

// Adicione o middleware no Express
app.use(traceflowMiddleware(TraceFlow.instance))`

  const nodeInstall = `npm install @traceflow/sdk`

  const envFile = `# .env
TRACEFLOW_WORKSPACE_ID=${workspaceId}
TRACEFLOW_COLLECTOR_URL=${collectorUrl}`

  const curlTest = `curl -X POST ${collectorUrl}/v1/logs \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "test-log-1",
    "trace_id": "abc123def456",
    "service_name": "meu-servico",
    "level": "INFO",
    "message": "Hello TraceFlow! 🚀",
    "workspace_id": "${workspaceId}",
    "timestamp": "${new Date().toISOString()}"
  }'`

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

        {/* ── Getting Started ── */}
        <div className="glass-card" style={{ marginBottom: 24, padding: '20px 24px' }}>
          <SectionTitle icon={<Zap style={{ width: 16, height: 16 }} />} title="Getting Started" />

          {/* Language tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
            {([
              { id: 'spring', label: 'Spring Boot', icon: <Coffee style={{ width: 13, height: 13 }} /> },
              { id: 'node',   label: 'Node.js',     icon: <Terminal style={{ width: 13, height: 13 }} /> },
              { id: 'curl',   label: 'cURL / Test', icon: <Globe style={{ width: 13, height: 13 }} /> },
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
