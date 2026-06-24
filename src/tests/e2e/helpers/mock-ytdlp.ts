/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElectronApplication } from '@playwright/test'

export async function mockYtDlp(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    class Emitter {
      _events: Record<string, ((...args: any[]) => void)[]> = {}
      on(event: string, fn: (...args: any[]) => void) {
        ;(this._events[event] = this._events[event] || []).push(fn)
        return this
      }
      emit(event: string, ...args: any[]) {
        ;(this._events[event] || []).forEach((fn) => fn(...args))
        return this
      }
    }

    try {
      const electronGlobal = globalThis as any
      const modules = electronGlobal.process?.mainModule?.children || []
      for (const mod of modules) {
        if (mod?.exports?.default?.prototype?.exec) {
          mod.exports.default.prototype.exec = function (args: string[]) {
            const proc = new Emitter() as any
            proc.stdout = new Emitter()
            proc.stderr = new Emitter()
            proc.stdin = new Emitter()
            proc.kill = () => {}
            proc.pid = 12345

            const isMetadata = args.some(
              (a: string) => a === '--dump-json' || a === '--flat-playlist'
            )

            if (isMetadata) {
              const data = JSON.stringify({
                title: 'Mock Video',
                duration: 180,
                uploader: 'Mock Channel',
                is_playlist: false,
                formats: [{ url: 'https://mock.com/v.mp4', ext: 'mp4', quality: '720p' }]
              })
              setTimeout(() => {
                proc.stdout.emit('data', Buffer.from(data))
                proc.emit('close', 0)
              }, 50)
            } else {
              const lines = [
                '[download]   0.0% of   5.00MiB',
                '[download]  50.0% of   5.00MiB',
                '[download] 100.0% of   5.00MiB'
              ]
              let i = 0
              const iv = setInterval(() => {
                if (i < lines.length) {
                  proc.stdout.emit('data', Buffer.from(lines[i] + '\n'))
                  i++
                } else {
                  clearInterval(iv)
                  proc.emit('close', 0)
                }
              }, 100)
            }

            return proc
          }
          break
        }
      }
    } catch {
      // Silently fail - tests will work without mock
    }
  })
}

export async function mockYtDlpError(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    class Emitter {
      _events: Record<string, ((...args: any[]) => void)[]> = {}
      on(event: string, fn: (...args: any[]) => void) {
        ;(this._events[event] = this._events[event] || []).push(fn)
        return this
      }
      emit(event: string, ...args: any[]) {
        ;(this._events[event] || []).forEach((fn) => fn(...args))
        return this
      }
    }

    try {
      const electronGlobal = globalThis as any
      const modules = electronGlobal.process?.mainModule?.children || []
      for (const mod of modules) {
        if (mod?.exports?.default?.prototype?.exec) {
          mod.exports.default.prototype.exec = function () {
            const proc = new Emitter() as any
            proc.stdout = new Emitter()
            proc.stderr = new Emitter()
            proc.stdin = new Emitter()
            proc.kill = () => {}
            proc.pid = 12345

            setTimeout(() => {
              proc.stderr.emit('data', Buffer.from('ERROR: Video unavailable'))
              proc.emit('close', 1)
            }, 50)

            return proc
          }
          break
        }
      }
    } catch {
      // Silently fail
    }
  })
}
