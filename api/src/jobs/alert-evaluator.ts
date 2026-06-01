import { pool } from '../db/pool'

export function startAlertEvaluator() {
  setInterval(async () => {
    try {
      await evaluateAlerts()
    } catch (err) {
      console.error('[alert-evaluator] Failed to evaluate alerts:', err)
    }
  }, 60000)
}

async function evaluateAlerts() {
  const { rows: alerts } = await pool.query(`
    SELECT id, workspace_id, name, condition, channels
    FROM alerts
    WHERE enabled = TRUE
  `)

  for (const alert of alerts) {
    try {
      const condition = typeof alert.condition === 'string' ? JSON.parse(alert.condition) : alert.condition
      const channels = typeof alert.channels === 'string' ? JSON.parse(alert.channels) : alert.channels

      const isFiring = await evaluateCondition(alert.workspace_id, condition)

      if (isFiring) {
        const ok: any[] = []
        const err: any[] = []

        for (const channel of channels) {
          try {
            if (channel.type === 'webhook') {
              await fetch(channel.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  alert_id: alert.id,
                  alert_name: alert.name,
                  workspace_id: alert.workspace_id,
                  condition: condition,
                  fired_at: new Date().toISOString()
                })
              })
              ok.push(channel)
            } else if (channel.type === 'email') {
              console.log(`[alert-evaluator] Mock sending email to ${channel.address} for alert ${alert.name}`)
              ok.push(channel)
            }
          } catch (e: any) {
            err.push({ ...channel, error: e.message })
          }
        }

        await pool.query(`
          INSERT INTO alert_firings (alert_id, workspace_id, condition, channels_ok, channels_err)
          VALUES ($1, $2, $3, $4, $5)
        `, [alert.id, alert.workspace_id, JSON.stringify(condition), JSON.stringify(ok), JSON.stringify(err)])

        await pool.query(`
          UPDATE alerts 
          SET last_fired_at = NOW(), fired_count = fired_count + 1
          WHERE id = $1
        `, [alert.id])
      }
    } catch (err) {
      console.error(`[alert-evaluator] Failed processing alert ${alert.id}:`, err)
    }
  }
}

async function evaluateCondition(workspaceId: string, condition: any): Promise<boolean> {
  const service = condition.service
  
  if (condition.type === 'latency_p95') {
    const { rows } = await pool.query(`
      SELECT percentile_cont(0.95) within group (order by duration_ms) as p95
      FROM spans
      WHERE workspace_id = $1 AND service_name = $2
        AND started_at >= NOW() - INTERVAL '5 minutes'
    `, [workspaceId, service])
    
    if (rows.length > 0 && rows[0].p95 !== null) {
      return rows[0].p95 > condition.threshold
    }
  } else if (condition.type === 'error_rate') {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'error') as errors
      FROM spans
      WHERE workspace_id = $1 AND service_name = $2
        AND started_at >= NOW() - INTERVAL '5 minutes'
    `, [workspaceId, service])
    
    if (rows.length > 0 && rows[0].total > 0) {
      const errorRate = (rows[0].errors / rows[0].total) * 100
      return errorRate > condition.threshold
    }
  } else if (condition.type === 'service_down') {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as total
      FROM spans
      WHERE workspace_id = $1 AND service_name = $2
        AND started_at >= NOW() - INTERVAL '5 minutes'
    `, [workspaceId, service])
    
    if (rows.length > 0) {
      return rows[0].total === '0' || rows[0].total === 0
    }
  }
  
  return false
}
