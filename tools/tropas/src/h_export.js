
const api = {TROOP_KINDS, TROOP_ERAS, KINDS, RIGS, CLIPS, NACIONES, ROLES, MAXP, buildTroop, poseTroop, blendPose, uniformPalette, troopStats, bakeClips, makeTroopMaterial, TroopShared, TroopBatch, TroopLodSet, CpuBatch,
  TROOP_GROUPS, troopGroup, troopGeoKey, nationalMark, clipInfo, clipPhase, eventsBetween, exportClipsJSON, SKIN, HORSE, _dev: {GeoBuilder, xf}, troopAimClip, TROOP_BAKE, TroopViewmodel, TROOP_ARMS, TROOP_ARMS_NAT, TROOP_ARMS_E, troopArm, troopMuzzle, TROOP_FX, troopFxDisparo, troopFxExpulsion, troopFxTrazadora, troopFxImpacto, troopFxCamara};
root.Troops3D = api;
['TROOP_KINDS', 'TROOP_ERAS', 'buildTroop', 'poseTroop', 'blendPose', 'uniformPalette', 'troopStats'].forEach(k => { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
