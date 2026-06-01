import { SpanEvent } from '../types'

export class HttpTransport {
  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
  ) {}

  async send(span: SpanEvent): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['x-api-key'] = this.apiKey

    const res = await fetch(`${this.url}/spans`, {
      method: 'POST',
      headers,
      body: JSON.stringify(span),
    })

    if (!res.ok && res.status !== 202) {
      throw new Error(`collector responded ${res.status}`)
    }
  }
}
