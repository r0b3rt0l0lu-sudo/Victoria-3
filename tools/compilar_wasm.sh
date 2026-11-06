#!/bin/sh
# Compila wasm/kernels.c → wasm/kernels.wasm (clang + wasm-ld). Sin libc; memoria inicial 96 MB (la reserva es virtual).
set -e
cd "$(dirname "$0")/.."
clang --target=wasm32 -O3 -ffp-contract=off -fno-fast-math -fno-builtin -nostdlib -fuse-ld=lld \
  -Wl,--no-entry -Wl,--export=__heap_base -Wl,--export-memory -Wl,--initial-memory=100663296 -Wl,--max-memory=268435456 -Wl,--strip-all \
  -o wasm/kernels.wasm wasm/kernels.c
ls -l wasm/kernels.wasm
