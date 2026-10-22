"""Local dev server for the game: like `python3 -m http.server`, but tells the
browser not to cache, so edits to the JS modules always load."""

import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8642


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    print(f'Duck Hunt on http://localhost:{PORT}')
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
