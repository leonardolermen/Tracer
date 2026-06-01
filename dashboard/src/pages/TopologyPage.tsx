import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Activity, AlertTriangle } from 'lucide-react'

function ServiceNode({ data }: { data: any }) {
  const isHealthy = data.errorRate < 5
  const color = isHealthy ? 'var(--success)' : 'var(--error)'

  return (
    <div style={{
      background: 'rgba(20,20,20,0.8)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${color}`,
      borderRadius: '8px',
      padding: '12px 16px',
      minWidth: '150px',
      boxShadow: `0 0 15px ${isHealthy ? 'rgba(169,220,118,0.2)' : 'rgba(239,68,68,0.2)'}`
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: 'none' }} />
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '8px' }}>
        {data.label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={12} /> {data.spanCount}
        </div>
        {data.errorRate > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--error)' }}>
            <AlertTriangle size={12} /> {data.errorRate.toFixed(1)}%
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none' }} />
    </div>
  )
}

const nodeTypes = {
  service: ServiceNode,
}

export function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/topology', {
        headers: { Authorization: `Bearer ${localStorage.getItem('tf_token')}` }
      })
      const data = await res.json()

      const newNodes = data.nodes.map((n: any, i: number) => ({
        id: n.id,
        type: 'service',
        position: { x: (i % 3) * 250, y: Math.floor(i / 3) * 150 },
        data: { label: n.id, spanCount: n.spanCount, errorRate: 0 },
      }))

      const newEdges = data.edges.map((e: any) => {
        const isError = e.errorRate > 5
        return {
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          animated: true,
          label: \`\${e.p95Latency}ms\`,
          style: { stroke: isError ? 'var(--error)' : 'var(--success)' },
          labelStyle: { fill: 'var(--text-primary)', fontSize: 10 },
          labelBgStyle: { fill: 'rgba(0,0,0,0.8)' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isError ? 'var(--error)' : 'var(--success)',
          },
        }
      })

      setNodes(newNodes)
      setEdges(newEdges)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted">Loading topology...</div>
  }

  return (
    <div className="flex-1 overflow-hidden relative" style={{ width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <h1 className="text-xl font-bold text-primary" style={{ letterSpacing: '0.02em' }}>Service Map</h1>
        <p className="text-sm text-secondary">A visual map of how your services communicate over the last hour.</p>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
      >
        <Background color="rgba(255,255,255,0.05)" gap={16} />
        <Controls style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-subtle)', fill: 'var(--text-primary)' }} />
      </ReactFlow>
    </div>
  )
}
