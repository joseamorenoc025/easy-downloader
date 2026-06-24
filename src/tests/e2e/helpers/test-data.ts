export const TEST_URLS = {
  youtube: {
    video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    playlist: 'https://www.youtube.com/playlist?list=PL-osiE80TeTsWmV9i9c58mdDCSskIFdDS',
    invalid: 'not-a-url',
    nonHttp: 'ftp://example.com/file.mp4'
  },
  spotify: {
    track: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
    playlist: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    album: 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3'
  }
}

export const MOCK_METADATA = {
  title: 'Mock Video Title',
  duration: 180,
  uploader: 'Mock Channel',
  thumbnail: 'https://mock.com/thumb.jpg',
  isPlaylist: false
}

export const MOCK_SPOTIFY_TRACK = {
  name: 'Never Gonna Give You Up',
  artist: 'Rick Astley',
  album: 'Whenever You Need Somebody',
  duration: 213
}

export const MOCK_SPOTIFY_PLAYLIST = {
  name: 'Test Playlist',
  tracks: [
    { name: 'Track 1', artist: 'Artist 1' },
    { name: 'Track 2', artist: 'Artist 2' },
    { name: 'Track 3', artist: 'Artist 3' }
  ]
}
