#!/usr/bin/env sh
# Downloads the PostgREST binary used by test/web (Darwin/macOS or Linux).
set -e
cd "$(dirname "$0")" && mkdir -p bin && cd bin

OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then
  FILE="postgrest-v12.2.3-macos-x64.tar.xz"
else
  FILE="postgrest-v12.2.3-linux-static-x64.tar.xz"
fi

curl -sSL -o pgrst.tar.xz "https://github.com/PostgREST/postgrest/releases/download/v12.2.3/$FILE"
tar xf pgrst.tar.xz && rm pgrst.tar.xz && ./postgrest --version
