import os
from src.config.settings import settings

def build_download_options(
    mode: str, 
    quality: str, 
    output_filename_template: str,
    download_dir: str,
    progress_hook=None
) -> dict:
    """Builds yt-dlp options based on user preferences."""
    
    # Base options
    base_opts = {
        'outtmpl': os.path.join(download_dir, output_filename_template),
        'noplaylist': False,  # Allow playlists
        'quiet': True,
        'no_warnings': True,
    }
    
    if progress_hook:
        base_opts['progress_hooks'] = [progress_hook]
    
    if mode == 'Audio':
        # Audio extraction
        base_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': quality.replace('kbps', ''),
            }],
            'postprocessor_args': {'ffmpeg': ['-hide_banner']}
        })
    else:
        # Video: map quality
        format_map = {
            'Best': 'bv*+ba/b',
            '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
            '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
        }
        base_opts['format'] = format_map.get(quality, 'bv*+ba/b')
        base_opts['merge_output_format'] = 'mp4'
        
    return base_opts
