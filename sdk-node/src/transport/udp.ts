import { createSocket } from 'dgram'
import { pack } from 'msgpackr'
import { SpanEvent } from '../types'

export class UdpTransport {
  private readonly host: string
  private readonly port: number
  private readonly apiKey?: string

  constructor(host: string, port: number, apiKey?: string) {
    this.host = host
    this.port = port
    this.apiKey = apiKey
  }

  send(span: SpanEvent): void {
    const socket = createSocket('udp4')
    // UDP has no headers, so the api-key travels in the payload.
    const payload = pack(this.apiKey ? { ...span, api_key: this.apiKey } : span)

    socket.send(payload, 0, payload.length, this.port, this.host, () => {
      socket.close()
    })
  }
}
