#!/bin/sh
cd "$(dirname "$0")" && cat src/a_geo.js src/b_uni.js src/c_fig.js src/c2_detalle.js src/d_kinds.js src/e_clips.js src/f_core.js src/e2_anim.js src/g_eraE.js src/i_para.js src/h_export.js > troops3d.js && echo "troops3d.js $(wc -c < troops3d.js) bytes"
