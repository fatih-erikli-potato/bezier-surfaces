function lerp(t, a, b) {
   const dx = (b.x - a.x);
   const dy = (b.y - a.y);
   const dz = (b.z - a.z);
   return {
    "x": a.x + t * dx,
    "y": a.y + t * dy,
    "z": a.z + t * dz,
   };
}

function bezier(t, p0, p1, p2, p3) {
  const a = lerp(t, p0, p1);
  const b = lerp(t, p1, p2);
  const c = lerp(t, p2, p3);
  const d = lerp(t, a, b);
  const e = lerp(t, b, c);
  const f = lerp(t, d, e);
  return f;
}

function splitbezier(t, p0, p1, p2, p3) {
  const p4 = lerp(t, p0, p1);
  const p5 = lerp(t, p1, p2);
  const p6 = lerp(t, p2, p3);
  const p7 = lerp(t, p4, p5);
  const p8 = lerp(t, p5, p6);
  const p9 = lerp(t, p7, p8);
  return [
    [{...p0}, p4, p7, p9],
    [{...p9}, p8, p6, {...p3}]
  ];
}