/**
 * Clasificador de errores de yt-dlp.
 *
 * yt-dlp emite mensajes útiles pero en inglés y a veces crípticos. Esta capa
 * los traduce a una categoría estable que el renderer puede internacionalizar
 * con i18n. El mensaje crudo (stderr completo) se preserva para que el
 * usuario pueda expandir y ver los detalles si necesita reportar un bug.
 */

export type ErrorCategory =
  | 'unavailable' // video privado, eliminado, región bloqueada
  | 'signIn' // requiere verificación de edad o login
  | 'network' // timeout, DNS, ECONNRESET
  | 'format' // formato/calidad no disponible
  | 'diskFull' // sin espacio en disco
  | 'permission' // no se pudo escribir en la carpeta
  | 'binary' // yt-dlp binary corrupto o no ejecutable
  | 'unsupported' // sitio/URL no soportado
  | 'unknown' // no reconocido, mostrar mensaje crudo

export interface ClassifiedError {
  category: ErrorCategory
  /** Mensaje crudo de yt-dlp para mostrar en panel expandible */
  raw: string
  /** Exit code numérico si está disponible */
  exitCode?: number
}

/**
 * Clasifica un error de yt-dlp. El orden de las comprobaciones importa:
 * patrones más específicos primero.
 *
 * La función es case-insensitive y robusta a stderr vacío.
 */
export function classifyYtDlpError(stderr: string, exitCode?: number): ClassifiedError {
  const s = (stderr || '').toLowerCase()

  if (
    s.includes('sign in to confirm') ||
    s.includes('confirm your age') ||
    s.includes('not a bot')
  ) {
    return { category: 'signIn', raw: stderr, exitCode }
  }
  if (
    s.includes('video unavailable') ||
    s.includes('private video') ||
    s.includes('this video is not available') ||
    s.includes('has been removed')
  ) {
    return { category: 'unavailable', raw: stderr, exitCode }
  }
  if (s.includes('http error 403') || s.includes('http error 404')) {
    return { category: 'unavailable', raw: stderr, exitCode }
  }
  if (
    s.includes('getaddrinfo enotfound') ||
    s.includes('econnreset') ||
    s.includes('etimedout') ||
    s.includes('network is unreachable') ||
    s.includes('connection refused')
  ) {
    return { category: 'network', raw: stderr, exitCode }
  }
  if (s.includes('socket timeout') || s.includes('read timed out') || s.includes('timed out')) {
    return { category: 'network', raw: stderr, exitCode }
  }
  if (s.includes('no space left') || s.includes('enospc')) {
    return { category: 'diskFull', raw: stderr, exitCode }
  }
  if (s.includes('permission denied') || s.includes('eacces')) {
    return { category: 'permission', raw: stderr, exitCode }
  }
  if (
    s.includes('requested format not available') ||
    s.includes('no video formats found') ||
    s.includes('format not available')
  ) {
    return { category: 'format', raw: stderr, exitCode }
  }
  if (
    s.includes('unsupported url') ||
    s.includes('no extractor') ||
    s.includes('no suitable extractor')
  ) {
    return { category: 'unsupported', raw: stderr, exitCode }
  }
  if (s.includes('no such file') && s.includes('yt-dlp')) {
    return { category: 'binary', raw: stderr, exitCode }
  }

  return { category: 'unknown', raw: stderr, exitCode }
}
