const RIGHT = 30;
const TOP = 5;
const FRONT = 20;
const PAINTROTATEHORIZONTAL = 20;
const PAINTROTATEVERTICAL = 40;
const max = Math.max;
const min = Math.min;
const ceil = Math.ceil;
function createcube(x, y, z) {
  if (PAINTROTATEVERTICAL > 0 && PAINTROTATEVERTICAL < 90 && PAINTROTATEHORIZONTAL > -90 && PAINTROTATEHORIZONTAL < 0) {
    return [
      [
        TOP,
        [x-1, y, z-1],
        [x, y, z-1],
        [x, y, z],
        [x-1, y, z]
      ],
      [
        FRONT,
        [x-1, y, z],
        [x, y, z],
        [x, y-1, z],
        [x-1, y-1, z]
      ],
      [
        RIGHT,
        [x-1, y, z-1],
        [x-1, y, z],
        [x-1, y-1, z],
        [x-1, y-1, z-1]
      ],
    ];
  }
  if (PAINTROTATEVERTICAL > 0 && PAINTROTATEVERTICAL < 90 && PAINTROTATEHORIZONTAL < 90 && PAINTROTATEHORIZONTAL > 0) {
    return [
      [
        TOP,
        [x, y, z-1],
        [x+1, y, z-1],
        [x+1, y, z],
        [x, y, z]
      ],
       [
        FRONT,
        [x, y, z],
        [x+1, y, z],
        [x+1, y-1, z],
        [x, y-1, z]
      ],
      [
        RIGHT,
        [x+1, y, z-1],
        [x+1, y, z],
        [x+1, y-1, z],
        [x+1, y-1, z-1]
      ]
    ];
  }
}
function barycenter(xyzs) {
  let sumx = 0;
  let sumy = 0;
  let sumz = 0;
  for (const xyz of xyzs) {
    sumx += xyz.x;
    sumy += xyz.y;
    sumz += xyz.z;
  }
  const l = xyzs.length;
  return {
    "x": sumx / l,
    "y": sumy / l,
    "z": sumz / l
  };
}
function subxyz(a, b) {
  return {
    "x": a.x - b.x,
    "y": a.y - b.y,
    "z": a.z - b.z
  };
}
function mulxyz(a, b) {
  return {
    "x": a.x * b.x,
    "y": a.y * b.y,
    "z": a.z * b.z
  };
}
function distance(a, b) {
  const dx = max(a.x, b.x) - min(a.x, b.x);
  const dy = max(a.y, b.y) - min(a.y, b.y);
  const dz = max(a.z, b.z) - min(a.z, b.z);
  return max(dx, dy, dz);
}
function fillfacewcubes(face) {
  const cubes = [];
  const [a, b, c, d] = face;
  segmentswide = max(1, max(distance(a, b), distance(d, c)))
  for (let w = 0; w < ceil(segmentswide); w++) {
    const linea = lerp(w / segmentswide, a, b);
    const lineb = lerp(w / segmentswide, d, c);
    segmentsline = max(1, distance(linea, lineb))
    for (let f = 0; f < ceil(segmentsline); f++) {
      cubes.push(lerp(f / segmentsline, linea, lineb))
    }
  }
  cubes.sort((a, b) => {
    if (PAINTROTATEHORIZONTAL > 0) {
      return a.y - b.y || a.z - b.z || a.x - b.x;  
    } else {
      return a.y - b.y || a.z - b.z || -a.x - -b.x;
    }
  })
  return cubes;
}
function darken(r, g, b, percent) {
  const rblacks = ceil(r * (percent / 100));
  const gblacks = ceil(g * (percent / 100));
  const bblacks = ceil(b * (percent / 100));
  return [max(r - rblacks, 0), max(g - gblacks, 0), max(b - bblacks, 0)];
}
function drawcubes(context, unitscale, cubes, canvasw, canvash) {
  const faces = [];
  for (const xyz of cubes) {
    const cube = createcube(xyz.x, xyz.y, xyz.z, PAINTROTATEHORIZONTAL, PAINTROTATEVERTICAL);
    for (const [darkenpercent, ...diamond] of cube) {
      const points = []
      for (const [x, y, z] of diamond) {
        const [xn, yn, zn] = rotatexyz(x * unitscale, y * unitscale, z * unitscale,
                                       PAINTROTATEHORIZONTAL, PAINTROTATEVERTICAL);
        points.push({
          "x": canvasw / 2 + xn,
          "y": canvash / 2 + yn * -1
        });
      }
      faces.push([points, darkenpercent]);
    }
  }
  for (const [points, darkenpercent] of faces) {
    const path2d = new Path2D();
    path2d.moveTo(points[0].x, points[0].y);
    path2d.lineTo(points[1].x, points[1].y);
    path2d.lineTo(points[2].x, points[2].y);
    path2d.lineTo(points[3].x, points[3].y);
    const [r, g, b] = darken(255, 255, 255, darkenpercent);
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.fill(path2d);
  }
}
function drawcarboncopy(context, unitscale, face, canvasw, canvash) {
  const points = [];
  for (const xyz of face) {
    const [xn, yn, zn] = rotatexyz(xyz.x * unitscale, xyz.y * unitscale, xyz.z * unitscale,
                                   PAINTROTATEHORIZONTAL, PAINTROTATEVERTICAL);
    points.push({
      "x": canvasw / 2 + xn,
      "y": canvash / 2 + yn * -1
    });
  }
  const [a, b, c, d] = points;
  const path2d = new Path2D();
  path2d.moveTo(a.x, a.y);
  path2d.lineTo(b.x, b.y);
  path2d.lineTo(c.x, c.y);
  path2d.lineTo(d.x, d.y);
  context.fillStyle = "black";
  context.fill(path2d);
}
function faceboundingbox(face) {
  const points = [];
  let maxx;
  let maxy;
  let minx;
  let miny
  for (const xyz of face) {
    const [xn, yn, zn] = rotatexyz(xyz.x, xyz.y, xyz.z,
                                   PAINTROTATEHORIZONTAL, PAINTROTATEVERTICAL);
    const x = xn;
    const y = yn;
    maxx = typeof maxx == "undefined" ? x : max(x, maxx);
    maxy = typeof maxy == "undefined" ? y : max(y, maxy);
    minx = typeof minx == "undefined" ? x : min(x, minx);
    miny = typeof miny == "undefined" ? y : min(y, miny);
  }
  return {
    "min-x": minx,
    "max-x": maxx,
    "min-y": miny,
    "max-y": maxy
  };
}
function boundingboxwh(boundingbox) {
  return {
    "width": boundingbox["max-x"] - boundingbox["min-x"],
    "height": boundingbox["max-y"] - boundingbox["min-y"]
  };
}
function createcanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", `${w}px`);
  canvas.setAttribute("height", `${h}px`);
  return [canvas, canvas.getContext("2d", {willReadFrequently: true})];
}
function avgrgb(cubescontext, carboncopycontext, w, h) {
  let sumr = 0;
  let sumg = 0;
  let sumb = 0;
  let len = 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const rgbacubes = cubescontext.getImageData(x, y, 1, 1).data;
      const rgbacarboncopy = carboncopycontext.getImageData(x, y, 1, 1).data;
      if (rgbacarboncopy[0] == 0 && rgbacarboncopy[1] == 0 && rgbacarboncopy[2] == 0 && rgbacarboncopy[3] == 255) {
        sumr += rgbacubes[0];
        sumg += rgbacubes[1];
        sumb += rgbacubes[2];
        len += 1;
      }
    }
  }
  return [ceil(sumr / len), ceil(sumg / len), ceil(sumb / len)];
}
function avgfacergb(face) {
  const cubeunitscale = 2;
  const facescale = 1;
  const centroid = barycenter(face);
  let facecentered = face.map((p) => subxyz(p, centroid));
  facecentered = facecentered.map((p) => mulxyz(p, {"x": facescale, "y": facescale, "z": facescale}));
  const cubes = fillfacewcubes(facecentered);
  const canvassize = boundingboxwh(faceboundingbox(facecentered));
  const w = ceil(canvassize.width * cubeunitscale);
  const h = ceil(canvassize.height * cubeunitscale);
  const [canvascubes, canvascubescontext] = createcanvas(w, h);
  const [canvascarboncopy, canvascarboncopycontext] = createcanvas(w, h);
  drawcubes(canvascubescontext, cubeunitscale, cubes, w, h);
  drawcarboncopy(canvascarboncopycontext, cubeunitscale, facecentered, w, h);
  //const rendercanvaspreview = div();
  //rendercanvaspreview.appendChild(canvascubes);
  //rendercanvaspreview.appendChild(canvascarboncopy);
  //renderwindow.document.body.appendChild(rendercanvaspreview);
  const rgb = avgrgb(canvascubescontext, canvascarboncopycontext, w, h);
  return rgb;
}
function getfaces(plane) {
  const faces = [];
  for (let w = 0; w < plane["wide"]; w++) {
    const wi = w / plane["wide"];
    const winext = (w + 1) / plane["wide"];
    const wa = bezier(wi, plane["points"][0], plane["points"][1], plane["points"][2], plane["points"][3]);
    const wanext = bezier(winext, plane["points"][0], plane["points"][1], plane["points"][2], plane["points"][3]);
    const wb = bezier(wi, plane["points"][4], plane["points"][5], plane["points"][6], plane["points"][7]);
    const wbnext = bezier(winext, plane["points"][4], plane["points"][5], plane["points"][6], plane["points"][7]);
    const wc = bezier(wi, plane["points"][8], plane["points"][9], plane["points"][10], plane["points"][11]);
    const wcnext = bezier(winext, plane["points"][8], plane["points"][9], plane["points"][10], plane["points"][11]);
    const wd = bezier(wi, plane["points"][12], plane["points"][13], plane["points"][14], plane["points"][15]);
    const wdnext = bezier(winext, plane["points"][12], plane["points"][13], plane["points"][14], plane["points"][15]);
    for (let f = 0; f < plane["fall"]; f++) {
      const fi = f / plane["fall"];
      const finext = (f + 1) / plane["fall"];
      const a = bezier(fi, wa, wb, wc, wd);
      const b = bezier(fi, wanext, wbnext, wcnext, wdnext);
      const c = bezier(finext, wanext, wbnext, wcnext, wdnext);
      const d = bezier(finext, wa, wb, wc, wd);
      faces.push([a, b, c, d]);
    }
  }
  return faces;
}
function clearrendercanvas() {
  rendercanvascontext.clearRect(0, 0, viewport["width"] * viewport["render-dpi"], viewport["height"] * viewport["render-dpi"]);
}
let facesdrawn;
function paintrendercanvas() {
  let groupid = null;
  facesdrawn = [];
  const planes = findplaneids(groupid);
  for (const planeid of planes) {
    const plane = getobjbyid(planeid);
    const faces = getfaces(plane);
    for (const face of faces) {
      facesdrawn.push([avgfacergb(face), face]);
    }
  }
}
function avgzabcd(abcd) {
  let sumz = 0;
  const l = abcd.length;
  for (const xyz of abcd) {
    const xyzrotated = rotatexyz(xyz.x, xyz.y, xyz.z, viewport["rotate-horizontal"], viewport["rotate-vertical"]);
    sumz += xyzrotated[2];
  }
  return sumz / l;
}
function drawrendercanvas() {
  clearrendercanvas();
  facesdrawn.sort((a, b) => {
    return avgzabcd(a[1]) - avgzabcd(b[1]);
  });
  for (const [rgb, [a, b, c, d]] of facesdrawn) {
    const path2d = new Path2D();
    const [ax, ay] = xyzonrendercanvas(a);
    const [bx, by] = xyzonrendercanvas(b);
    const [cx, cy] = xyzonrendercanvas(c);
    const [dx, dy] = xyzonrendercanvas(d);
    path2d.moveTo(ax, ay);
    path2d.lineTo(bx, by);
    path2d.lineTo(cx, cy);
    path2d.lineTo(dx, dy);
    
    rendercanvascontext.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    rendercanvascontext.fill(path2d);
  }
}
function xyzonrendercanvas(xyz) {
  const xyzrot = rotatexyz(
    (viewport["move"].x + xyz.x) * viewport["zoom"],
    (viewport["move"].y + xyz.y) * viewport["zoom"],
    (viewport["move"].z + xyz.z) * viewport["zoom"],
    viewport["rotate-horizontal"],
    viewport["rotate-vertical"]
  );
  return [
    viewport["width"] * viewport["render-dpi"] / 2 + xyzrot[0] * viewport["render-dpi"],
    viewport["height"] * viewport["render-dpi"] / 2 - xyzrot[1] * viewport["render-dpi"]
  ];
}