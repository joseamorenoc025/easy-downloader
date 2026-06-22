import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../renderer/src/App'

// Mock de componentes y hooks
vi.mock('../renderer/src/components/DownloadQueue', () => ({
  default: () => <div data-testid="download-queue">Queue</div>,
}))

vi.mock('../renderer/src/components/History', () => ({
  default: () => <div data-testid="history">History</div>,
}))

vi.mock('../renderer/src/components/Settings', () => ({
  default: () => <div data-testid="settings">Settings</div>,
}))

vi.mock('../renderer/src/hooks/use-downloads', () => ({
  useDownloads: () => ({
    queue: [],
    history: [],
    addDownload: vi.fn(),
    cancelDownload: vi.fn(),
    retryDownload: vi.fn(),
  }),
}))

vi.mock('../renderer/src/hooks/use-settings', () => ({
  useSettings: () => ({
    settings: {
      theme: 'dark',
      language: 'es',
      maxConcurrent: 3,
      downloadPath: '/downloads',
      incognito: false,
      metadataEnabled: true,
      globalPause: false,
    },
    updateSetting: vi.fn(),
    pauseAll: vi.fn(),
    resumeAll: vi.fn(),
    setGlobalPause: vi.fn(),
  }),
}))

describe('App Component - UI Features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe renderizar el toggle de modo incógnito', async () => {
    render(<App />)
    
    // Buscar el botón INC (Incognito)
    const incognitoButton = screen.getByRole('button', { name: /inc/i })
    expect(incognitoButton).toBeInTheDocument()
  })

  it('debe renderizar el toggle de metadatos', async () => {
    render(<App />)
    
    // Buscar el botón Meta
    const metaButton = screen.getByRole('button', { name: /meta/i })
    expect(metaButton).toBeInTheDocument()
  })

  it('debe renderizar el botón de pausa global', async () => {
    render(<App />)
    
    // El botón de pause/play debe estar presente
    const pauseButton = screen.getByTestId('pause-play-toggle')
    expect(pauseButton).toBeInTheDocument()
  })

  it('debe mostrar indicador visual cuando incógnito está activo', async () => {
    const { useSettings } = await import('../renderer/src/hooks/use-settings')
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        theme: 'dark',
        language: 'es',
        maxConcurrent: 3,
        downloadPath: '/downloads',
        incognito: true,
        metadataEnabled: true,
        globalPause: false,
      },
      updateSetting: vi.fn(),
      pauseAll: vi.fn(),
      resumeAll: vi.fn(),
      setGlobalPause: vi.fn(),
    })

    render(<App />)
    
    // Verificar que hay un indicador visual de modo incógnito
    const incognitoIndicator = screen.getByTestId('incognito-indicator')
    expect(incognitoIndicator).toBeInTheDocument()
  })
})
