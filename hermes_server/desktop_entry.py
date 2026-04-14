from __future__ import annotations

import argparse

import uvicorn

from hermes_server.app_factory import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Hermes Desktop sidecar")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9119)
    args = parser.parse_args()

    app = create_app(port=args.port)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
