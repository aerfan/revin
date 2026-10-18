#!/usr/bin/env sh
# Downloads the PostgREST binary used by test/web (Linux x64).
set -e
cd "$(dirname "$0")" && mkdir -p bin && cd bin
curl -sSL -o pgrst.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
tar xf pgrst.tar.xz && rm pgrst.tar.xz && ./postgrest --version
