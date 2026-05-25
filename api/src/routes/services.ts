import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listServices, getServiceStats } from '../db/services'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const services = await listServices(req.auth.workspaceId)
  res.json({ services })
})

router.get('/:serviceName/stats', async (req, res) => {
  const { from, to, interval = '5m' } = req.query

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const series = await getServiceStats(
    req.auth.workspaceId,
    req.params.serviceName,
    (from as string) ?? oneHourAgo.toISOString(),
    (to as string) ?? now.toISOString(),
    interval as string
  )

  res.json({
    service_name: req.params.serviceName,
    from: from ?? oneHourAgo.toISOString(),
    to: to ?? now.toISOString(),
    interval,
    series,
  })
})

export default router
