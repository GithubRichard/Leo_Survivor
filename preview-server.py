"""Local Survivor preview: python preview-server.py [--port 80]."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent

class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route in ("/", "/survivor/"):
            self.send_response(302)
            self.send_header("Location", "/survivor")
            self.end_headers()
            return
        if route == "/survivor":
            self.path = "/index.html"
            route = "/index.html"
        # LAN preview only serves game files and art, with no folder listing.
        parts = Path(route.lstrip("/")).parts
        public = route == "/index.html" or (
            len(parts) == 1 and Path(route).suffix in (".js", ".css")
        ) or (route.startswith("/art/") and Path(route).suffix in (".png", ".json", ".js", ".html", ".md"))
        if ".." in parts or not public:
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=80)
    parser.add_argument("--lan", action="store_true", help="Allow phones/tablets on the same LAN")
    options = parser.parse_args()
    server = ThreadingHTTPServer(("0.0.0.0" if options.lan else "127.0.0.1", options.port), PreviewHandler)
    print(f"http://localhost{':' + str(options.port) if options.port != 80 else ''}/survivor", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
