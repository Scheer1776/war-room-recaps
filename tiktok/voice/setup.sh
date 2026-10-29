#!/usr/bin/env bash
# One-time setup for the free voice (Kokoro "am_michael") and the name check (faster-whisper).
# Makes voice/.venv with Python 3.11 (Kokoro's deps don't build on 3.13). Takes a few minutes.
set -euo pipefail
cd "$(dirname "$0")"
[ -x .venv/bin/python ] && .venv/bin/python -c "import kokoro, faster_whisper" 2>/dev/null && exit 0
uv venv -q -p 3.11 .venv
uv pip install -q -p .venv/bin/python torch --index-url https://download.pytorch.org/whl/cpu
uv pip install -q -p .venv/bin/python kokoro soundfile faster-whisper pip \
  "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
echo "voice env ready"
