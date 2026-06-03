export function InfoSection() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-4xl">🎵</div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        Welcome to EasyDownloader
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Download videos and music from YouTube and Spotify. Paste a URL above
        and click Add to get started.
      </p>
      <div className="flex gap-6 text-left text-sm text-muted-foreground">
        <div>
          <h3 className="mb-1 font-medium text-foreground">YouTube</h3>
          <ul className="list-inside list-disc space-y-0.5">
            <li>Videos up to 4K</li>
            <li>Audio in MP3</li>
            <li>Playlists supported</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-1 font-medium text-foreground">Spotify</h3>
          <ul className="list-inside list-disc space-y-0.5">
            <li>Single tracks</li>
            <li>Albums & playlists</li>
            <li>Requires spotdl</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
