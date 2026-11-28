"""Apply public, project-owned service settings to a staged GitHub Pages build."""
import os
import re
import sys
from html import escape
from pathlib import Path
from urllib.parse import urlsplit


def configure(directory, settings):
    ga4 = settings.get("GA4_MEASUREMENT_ID", "").strip()
    client_ga4 = settings.get("GA4_CLIENT_MEASUREMENT_ID", "").strip()
    for name, stream in [("GA4_MEASUREMENT_ID", ga4), ("GA4_CLIENT_MEASUREMENT_ID", client_ga4)]:
        if stream and not re.fullmatch(r"G-[A-Z0-9]{6,18}", stream):
            raise ValueError(f"{name} must be a GA4 web stream ID (G-…).")
    pixel = settings.get("META_PIXEL_ID", "").strip()
    receiver = settings.get("FORPSI_INQUIRY_URL", "").strip()
    if pixel and not re.fullmatch(r"[1-9][0-9]{9,19}", pixel):
        raise ValueError("META_PIXEL_ID must be a numeric Meta Pixel ID.")
    if receiver:
        url = urlsplit(receiver)
        if (url.scheme != "https" or not url.hostname or url.username is not None
                or url.password is not None or url.fragment or "\\" in receiver
                or any(char.isspace() or ord(char) < 32 for char in receiver)):
            raise ValueError("FORPSI_INQUIRY_URL must be a public HTTPS endpoint without credentials.")

    changes = {}
    for page in directory.glob("*.html"):
        original = page.read_text(encoding="utf-8")
        content = original
        if (ga4 or client_ga4 or pixel) and 'src="measurement.js' in content:
            def update_tag(match):
                tag = match.group()
                for attr, value in [("data-ga4", ga4), ("data-client-ga4", client_ga4), ("data-meta-pixel", pixel)]:
                    if value:
                        tag, count = re.subn(fr'\b{attr}="[^"]*"', f'{attr}="{value}"', tag)
                        if count != 1:
                            raise ValueError(f"Missing {attr} setting in {page.name}.")
                return tag
            content, count = re.subn(r'<script\b[^>]*\bsrc="measurement\.js(?:\?[^"]*)?"[^>]*>', update_tag, content)
            if count != 1:
                raise ValueError(f"Expected one measurement script in {page.name}.")
        if receiver and page.name == "index.html":
            content, count = re.subn(r'\bdata-inquiry-endpoint="[^"]*"',
                                      lambda _: f'data-inquiry-endpoint="{escape(receiver, quote=True)}"', content)
            if count != 1:
                raise ValueError("Could not identify the project inquiry form.")
        if receiver and page.name == "ochrana-osobnich-udaju.html":
            for mode in ["mailto", "forpsi"]:
                content, count = re.subn(fr'<p data-inquiry-mode="{mode}"(?: hidden)?>',
                                         f'<p data-inquiry-mode="{mode}"' + (" hidden>" if mode == "mailto" else ">"), content)
                if count != 1:
                    raise ValueError(f"Missing {mode} privacy notice.")
        if content != original:
            changes[page] = content
    for page, content in changes.items():
        page.write_text(content, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    configure(Path(sys.argv[1]), os.environ)
