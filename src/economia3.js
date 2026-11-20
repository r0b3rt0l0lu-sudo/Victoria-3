/* ===== ECONOMÍA 3: limpieza de medidas superpuestas =====
   Las medidas económicas venían de siete fuentes (leyes, política comercial, salarios, planificación, programas de fomento, tecnologías y rasgos) que
   se sumaban sin límite y se pisaban entre sí (p. ej. «libre comercio» y «laissez-faire» daban los dos inversión). Reglas ahora:
   1) La inversión privada depende de la LEY económica; la política comercial solo toca aranceles (impuestos), industria e innovación.
   2) Los programas de fomento no se acumulan con la planificación estatal ni con el estímulo del mismo tipo.
   3) Rendimientos decrecientes: por encima de un tope razonable cada punto adicional vale 35 %. */
const ECO_CAPS = {invest: [-0.2, 0.34], indOut: [-0.1, 0.22], agriOut: [-0.1, 0.3], mineOut: [-0.1, 0.25], tax: [-0.15, 0.22], out: [-0.08, 0.1], constr: [-0.1, 0.5], innov: [-0.2, 0.4], lab: [-0.1, 0.2], rad: [-0.4, 0.5]};
const _recalcMods = recalcMods;
recalcMods = function (c) {
  // los programas de fomento industrial no se suman a la planificación «industria pesada» (se queda el mayor)
  const e = c.eco, pr = c.prog;
  const m = _recalcMods(c);
  if (e && e.plan === 'heavy' && pr && pr.fomento && typeof progLeft === 'function' && progLeft(c, 'fomento') > 0) m.indOut -= Math.min(0.08, EC_PLAN.heavy.mods.indOut);
  c.ecoCapped = [];
  for (const k in ECO_CAPS) {
    const [lo, hi] = ECO_CAPS[k], v = m[k]; if (v === undefined) continue;
    if (v > hi) { m[k] = hi + (v - hi) * 0.35; c.ecoCapped.push(k); } else if (v < lo) { m[k] = lo + (v - lo) * 0.35; c.ecoCapped.push(k); }
  }
  return m;
};
