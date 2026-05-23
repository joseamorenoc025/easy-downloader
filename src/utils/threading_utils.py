import threading
from queue import Queue
from yt_dlp import YoutubeDL

class DownloadWorker:
    """Executes downloads in background sequentially."""
    
    def __init__(self, on_progress, on_complete, on_error):
        self.queue = Queue()
        self.on_progress = on_progress
        self.on_complete = on_complete
        self.on_error = on_error
        self._thread = None
        self._stop_flag = False
        self._current_url = None
    
    def add_to_queue(self, url: str, options: dict, title: str):
        """Adds a new item to the download queue."""
        self.queue.put((url, options, title))
        if not self._thread or not self._thread.is_alive():
            self._stop_flag = False
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
            
    def get_queue_size(self) -> int:
        return self.queue.qsize()
    
    def stop(self):
        """Signals the worker to stop processing new items."""
        self._stop_flag = True
    
    def _run(self):
        while not self.queue.empty() and not self._stop_flag:
            url, opts, title = self.queue.get()
            self._current_url = url
            try:
                # Add our hook on top of existing ones
                opts['progress_hooks'] = [
                    lambda d: self.on_progress(d, title) if d['status'] == 'downloading' else None,
                    *opts.get('progress_hooks', [])
                ]
                with YoutubeDL(opts) as ydl:
                    ydl.download([url])
                self.on_complete(title)
            except Exception as e:
                self.on_error(title, str(e))
            finally:
                self._current_url = None
                self.queue.task_done()
