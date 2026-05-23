def estimate_filesize(format_info: dict) -> tuple[int, str]:
    """
    Calculates estimated size in bytes and a readable string.
    Priority: filesize > filesize_approx > tbr*duration
    """
    if format_info.get('filesize'):
        return format_info['filesize'], format_bytes(format_info['filesize'])
    
    if format_info.get('filesize_approx'):
        return int(format_info['filesize_approx']), f"≈{format_bytes(format_info['filesize_approx'])}"
    
    tbr = format_info.get('tbr')  # kbps
    duration = format_info.get('duration')  # seconds
    
    if tbr and duration:
        estimated = int((tbr * 1000 / 8) * duration)
        return estimated, f"≈{format_bytes(estimated)}"
    
    return 0, "Unknown Size"

def format_bytes(size: int) -> str:
    """Converts bytes to a readable string: 1.2 GB, 450 MB, etc."""
    if size == 0:
        return "0 B"
        
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024:
            return f"{size:.1f} {unit}" if unit != 'B' else f"{size} {unit}"
        size /= 1024
    return f"{size:.1f} PB"

def format_duration(seconds: int) -> str:
    """Converts seconds to HH:MM:SS or MM:SS"""
    if not seconds:
        return "00:00"
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"
