#!/usr/bin/env node
// Usage: node scripts/load-test.js [--spans 500] [--concurrency 20] [--host http://localhost:4317]

const args = process.argv.slice(2)
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def }

const TOTAL     = parseInt(getArg('--spans', '500'))
const CONCUR    = parseInt(getArg('--concurrency', '20'))
const HOST      = getArg('--host', 'http://localhost:4317')
const WS_ID     = 'ws_dev'

const SERVICES = ['api-gateway', 'auth-service', 'checkout-service', 'payment-service', 'inventory-service', 'notification-service']
const OPERATIONS = {
  'api-gateway':          ['GET /orders', 'POST /checkout', 'GET /products', 'DELETE /cart', 'PUT /profile'],
  'auth-service':         ['validateToken', 'refreshToken', 'login', 'logout'],
  'checkout-service':     ['createOrder', 'calculateTax', 'applyDiscount', 'validateCart'],
  'payment-service':      ['chargeCard', 'refund', 'validatePayment', 'processWebhook'],
  'inventory-service':    ['checkStock', 'reserveItem', 'releaseReservation', 'updateQuantity'],
  'notification-service': ['sendEmail', 'sendSMS', 'sendPush', 'queueNotification'],
}
const KINDS    = ['server', 'client', 'internal']
const STATUSES = ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'error', 'timeout', 'ok'] // ~80% ok

function randId(len = 32) {
  return [...crypto.getRandomValues(new Uint8Array(len / 2))].map(b => b.toString(16).padStart(2, '0')).join('')
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function makeTrace() {
  const traceId = randId(32)
  const rootSvc = pick(SERVICES)
  const now = new Date()
  const spans = []

  // root span
  const rootId = randId(16)
  const rootDuration = randInt(50, 2000)
  const rootStatus = pick(STATUSES)
  const rootEndedAt = new Date(now.getTime() + rootDuration)

  spans.push({
    id:             rootId,
    trace_id:       traceId,
    service_name:   rootSvc,
    operation_name: pick(OPERATIONS[rootSvc]),
    kind:           'server',
    started_at:     now.toISOString(),
    ended_at:       rootEndedAt.toISOString(),
    duration_ms:    rootDuration,
    status:         rootStatus,
    error:          rootStatus === 'error' ? { type: 'ServiceError', message: 'Internal error processing request' } : undefined,
    tags:           { 'http.method': pick(['GET','POST','PUT','DELETE']), 'http.status_code': rootStatus === 'error' ? '500' : '200' },
    workspace_id:   WS_ID,
  })

  // child spans (1–4)
  const childCount = randInt(1, 4)
  for (let i = 0; i < childCount; i++) {
    const svc = pick(SERVICES.filter(s => s !== rootSvc))
    const offset = randInt(5, 100)
    const dur    = randInt(10, rootDuration - offset)
    const status = pick(STATUSES)
    const start  = new Date(now.getTime() + offset)
    const end    = new Date(start.getTime() + dur)

    spans.push({
      id:             randId(16),
      trace_id:       traceId,
      parent_id:      rootId,
      service_name:   svc,
      operation_name: pick(OPERATIONS[svc]),
      kind:           pick(KINDS),
      started_at:     start.toISOString(),
      ended_at:       end.toISOString(),
      duration_ms:    dur,
      status,
      error:          status === 'error' ? { type: 'DatabaseError', message: 'Query timeout after 5000ms' } : undefined,
      tags:           { 'db.type': pick(['postgres','redis','elasticsearch']), 'peer.service': rootSvc },
      workspace_id:   WS_ID,
    })
  }

  return spans
}

async function sendSpan(span) {
  const res = await fetch(`${HOST}/spans`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'tf_live_devkey' },
    body:    JSON.stringify(span),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
}

async function runBatch(spans) {
  await Promise.all(spans.map(s => sendSpan(s).catch(e => console.error(`  ✗ span ${s.id}: ${e.message}`))))
}

async function main() {
  console.log(`\n🚀 TraceFlow Load Test`)
  console.log(`   Target:      ${HOST}`)
  console.log(`   Spans:       ${TOTAL}`)
  console.log(`   Concurrency: ${CONCUR}`)
  console.log(`   Workspace:   ${WS_ID}\n`)

  // build all spans
  const allSpans = []
  while (allSpans.length < TOTAL) {
    allSpans.push(...makeTrace())
  }
  const limited = allSpans.slice(0, TOTAL)

  const start = Date.now()
  let sent = 0
  let errors = 0

  for (let i = 0; i < limited.length; i += CONCUR) {
    const batch = limited.slice(i, i + CONCUR)
    const results = await Promise.allSettled(batch.map(s =>
      sendSpan(s).then(() => { sent++ }).catch(() => { errors++ })
    ))
    const pct = Math.round(((i + batch.length) / limited.length) * 100)
    process.stdout.write(`\r  Progress: ${pct}% (${Math.min(i + CONCUR, limited.length)}/${limited.length})`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2)
  console.log(`\n\n✅ Done in ${elapsed}s`)
  console.log(`   Sent:   ${sent}`)
  console.log(`   Errors: ${errors}`)
  console.log(`   RPS:    ${(sent / elapsed).toFixed(0)}\n`)
}

main().catch(console.error)
