import { SpanEvent } from '../types'

export class HttpTransport {
  constructor(private readonly url: string) {}

  async send(span: SpanEvent): Promise<void> {
    const res = await fetch(`${this.url}/spans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(span),
    })

    if (!res.ok && res.status !== 202) {
      throw new Error(`collector responded ${res.status}`)
    }
  }
}
