
const api = {TROOP_KINDS, TROOP_ERAS, KINDS, RIGS, CLIPS, NACIONES, ROLES, MAXP, buildTroop, poseTroop, blendPose, uniformPalette, troopStats, bakeClips, makeTroopMaterial, TroopShared, TroopBatch, TroopLodSet, CpuBatch,
  TROOP_GROUPS, troopGroup, troopGeoKey, nationalMark, clipInfo, clipPhase, eventsBetween, exportClipsJSON, SKIN, HORSE};
root.Troops3D = api;
['TROOP_KINDS', 'TROOP_ERAS', 'buildTroop', 'poseTroop', 'blendPose', 'uniformPalette', 'troopStats'].forEach(k => { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
