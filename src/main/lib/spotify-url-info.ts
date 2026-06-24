// Re-export spotify-url-info factory via CJS require (package is CJS-only).
// Wrapping in a local module makes it mockable by vitest.

const factory = require('spotify-url-info') as (fetch: typeof globalThis.fetch) => {
  getData: (url: string) => Promise<any>
  getPreview: (url: string) => Promise<any>
  getTracks: (url: string) => Promise<any[]>
}

export default factory
