#!/bin/sh
cd "$(dirname "$0")" && cat src/a_geo.js src/b_uni.js src/c_fig.js src/d_kinds.js src/e_clips.js src/f_core.js > troops3d.js && echo "troops3d.js $(wc -c < troops3d.js) bytes"
