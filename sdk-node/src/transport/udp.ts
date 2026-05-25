import { createSocket } from 'dgram'
import { pack } from 'msgpackr'
import { SpanEvent } from '../types'

export class UdpTransport {
  private readonly host: string
  private readonly port: number

  constructor(host: string, port: number) {
    this.host = host
    this.port = port
  }

  send(span: SpanEvent): void {
    const socket = createSocket('udp4')
    const payload = pack(span)

    socket.send(payload, 0, payload.length, this.port, this.host, () => {
      socket.close()
    })
  }
}
