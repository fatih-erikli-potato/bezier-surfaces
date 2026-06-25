const VISIBLE_OBJ_TYPES = ["group", "plane"];
const viewport = {
  "width": 512, "height": 512, "zoom": 1, "dpi": 2, "render-dpi": 1,
  "move": {"x": 0, "y": 0, "z": 0},
  "pivot": {"x": 0, "y": 0, "z": 0},
  "rotate-horizontal": -20, "rotate-vertical": 20, "group-id": null,
  "scale-defaults": {"x": true, "y": true, "z": true},
  "pivot-to-selection-defaults": {"x": true, "y": true, "z": true},
  "move-to-pivot-defaults": {"x": true, "y": true, "z": true},
  "scale-by": 2, "rotate-axis": "xy", "rotate-by": 90,
  "split-wide-fall": "wide", "split-at": [2, 2], "slice-wide": 2, "slice-fall": 2,
  "cut": [],
  "visible-obj-types": [...VISIBLE_OBJ_TYPES],
  "show-group-content": [],
  "select-mode": "new"
};
let draft;
let view = "create";
let container;
let canvaselement;
let canvascontainer;
let selectionmap = {};
let canvascontext;
let statusbarelement;
let menuelement;
let toolselement;
let saving = false;
let rendercanvas;
let rendercanvascontext;
function calclayout() {
  const innerw = window.innerWidth;
  const innerh = window.innerHeight;
  const toolsw = toolselement.getBoundingClientRect().width;
  const menuh = menuelement.getBoundingClientRect().height + 12;
  viewport.width = innerw - toolsw;
  viewport.height = innerh - menuh - menuh;
  container.style.width = `${innerw - toolsw}px`;
  container.style.height = `${innerh}px`;
  canvascontainer.style.height = `${viewport.height}px`;
  canvaselement.setAttribute("width", viewport.width * viewport["dpi"]);
  canvaselement.setAttribute("height", viewport.height * viewport["dpi"]);
  canvaselement.style.width = `${viewport.width}px`;
  canvaselement.style.height = `${viewport.height}px`;
  rendercanvaselement.setAttribute("width", viewport.width);
  rendercanvaselement.setAttribute("height", viewport.height);
}
window.addEventListener("resize", () => {
  calclayout();
  render();
});
window.addEventListener("load", () => {
  container = document.getElementById("container");
  menuelement = document.getElementById("menu");
  toolselement = document.getElementById("tools");
  canvascontainer = document.getElementById("canvas-container");
  canvaselement = document.createElement("canvas");
  canvaselement.classList.add("viewport-canvas");
  rendercanvaselement = document.createElement("canvas");
  rendercanvaselement.classList.add("render-canvas");
  canvascontainer.appendChild(rendercanvaselement);
  canvascontainer.appendChild(canvaselement);
  calclayout();
  rendercanvascontext = rendercanvaselement.getContext("2d");
  canvascontext = canvaselement.getContext("2d");
  canvaselement.addEventListener("click", oncanvasclick);
  canvaselement.addEventListener("mousedown", oncanvasmousedown);
  canvaselement.addEventListener("mousemove", oncanvasmousemove);
  canvaselement.addEventListener("mouseup", oncanvasmouseup);
  statusbarelement = document.getElementById("status-bar");
  loaddraft().then(_draft => {
    draft = _draft;
    render();
  });
  menuelement.parentNode.addEventListener("wheel", (event) => {event.preventDefault();})
  canvaselement.addEventListener("wheel", function (event) {
    event.preventDefault();
    viewport["rotate-horizontal"] += (event.deltaX / 6);
    viewport["rotate-vertical"] -= (event.deltaY / 6);
    draw(viewport["visible-obj-types"]);
  });
  let restoreselectmode;
  let keydown = new Set();
  document.body.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "Alt":
      case "Shift": {
        const addordel = event.key == "Alt" ? "add": "del";
        if (viewport["select-mode"] != addordel) {
          restoreselectmode = viewport["select-mode"];
          viewport["select-mode"] = addordel;
          render();
        }
        break;
      }
      case "Escape": {
        keydown.clear();
        break;
      }
      default: {
        keydown.add(event.key);
        break;
      }
    }
  });
  document.body.addEventListener("keyup", (event) => {
    switch (event.key) {
      case "Alt":
      case "Shift": {
        if (typeof restoreselectmode != "undefined") {
          viewport["select-mode"] = restoreselectmode;
          render();
          restoreselectmode = undefined;
        }
        break;
      }
      case "Escape": {
        break;
      }
      case "p": {
        if (keydown.has("p")) {
          pivotselected();
          render();
          keydown.delete(event.key);
        }
        break;
      }
      case "a": {
        if (keydown.has("a")) {
          if (view == "create") {
            selectall(viewport["group-id"]);
          } else if (view == "transform") {
            selectallpointindexes(viewport["group-id"]);
          }
          render();
          keydown.delete(event.key);
        }
        break;
      }
      case "m": {
        if (keydown.has("m")) {
          transformpoints((point) => {
            if (viewport["move-to-pivot-defaults"].x) {
              point.x = viewport.pivot.x;
            }
            if (viewport["move-to-pivot-defaults"].y) {
              point.y = viewport.pivot.y;
            }
            if (viewport["move-to-pivot-defaults"].z) {
              point.z = viewport.pivot.z;
            }
          });
          render();
          keydown.delete(event.key);
        }
        break;
      }
      case "x":
      case "y":
      case "z": {
        if (keydown.has("p")) {
          toggleboolean(viewport["pivot-to-selection-defaults"], event.key);
        } else if (keydown.has("m")) {
          toggleboolean(viewport["move-to-pivot-defaults"], event.key);
        }
        render();
        break;
      }
      default: {
        keydown.delete(event.key);
        break;
      }
    }
  });
  document.body.addEventListener("keypress", (event) => {
    switch (event.key) {
      case "s": {
        selectwhole();
        render();
        break;
      }
      case "t": {
        selectwhole();
        if (view == "transform") {
          view = "create";
        } else {
          view = "transform";
        }
        render();
        break;
      }
      case "d": {
        selectionmap = {};
        render();
        break;
      }
      case "D": {
        view = "create";
        deselectpoints();
        render();
        break;
      }
    }
  });
});
function ispointwithinradius(x, y, rx, ry, r) {
  const circlex = rx - x;
  const circley = ry - y;
  return circlex ** 2 + circley ** 2 < r ** 2;
}
let dragstartedat;
let dragcurrent;
let showselectionrectangle = false;
let preventclick = false;
function oncanvasmousedown(event) {
  if (view == "transform") {
    const {x, y} = getxyfrommousevent(event);
    dragstartedat = {x, y};
  }
}
function oncanvasmousemove(event) {
  if (view == "transform") {
    if (event.buttons == 1) {
      showselectionrectangle = true;
      const {x, y} = getxyfrommousevent(event);
      dragcurrent = {x, y};
      preventclick = true;
      draw();
    }
  }
}
function oncanvasmouseup() {}
function getselectionrectangle() {
  const xmin = Math.min(dragstartedat.x, dragcurrent.x);
  const xmax = Math.max(dragstartedat.x, dragcurrent.x);
  const ymin = Math.min(dragstartedat.y, dragcurrent.y);
  const ymax = Math.max(dragstartedat.y, dragcurrent.y);
  return {
    x: xmin,
    y: ymin,
    width: xmax - xmin,
    height: ymax - ymin
  };
}
function getxyfrommousevent(event) {
  const canvas = event.target;
  const canvasboundingclientrect = canvas.getBoundingClientRect();
  const x = (event.clientX - canvasboundingclientrect.left) * viewport["dpi"];
  const y = (event.clientY - canvasboundingclientrect.top) * viewport["dpi"];
  return {x, y};
}
function oncanvasclick(event) {
  if (showselectionrectangle) {
    const selectionrectangle = getselectionrectangle();
    const visibleobjs = getgroupcontent(["plane"], viewport["group-id"]);
    if (viewport["select-mode"] == "new") {
      selectionmap = {};
    }
    for (const obj of visibleobjs) {
      for (let i = 0; i < obj["points"].length; i++) {
        const point = obj["points"][i];
        const [x, y] = xyzoncanvas(point);
        if (
          x > selectionrectangle.x && x < selectionrectangle.x + selectionrectangle.width &&
          y > selectionrectangle.y && y < selectionrectangle.y + selectionrectangle.height
        ) {
          if (viewport["select-mode"] == "add" || viewport["select-mode"] == "new") {
            addtoselection(obj["id"], i);
          } else {
            deleteselection(obj["id"], i);
          }
        }
      }
    }
    preventclick = false;
    dragstartedat = undefined;
    dragcurrent = undefined;
    showselectionrectangle = false;
    render();
    return;
  }
  const {x: xoncanvas, y: yoncanvas} = getxyfrommousevent(event);
  switch (view) {
    case "create": {
      const clickedobjids = new Set();
      const visibleobjs = getgroupcontent(viewport["visible-obj-types"], viewport["group-id"]);
      for (const obj of visibleobjs) {
        if (VISIBLE_OBJ_TYPES.includes(obj["type"]) && !viewport["cut"].includes(obj["id"])) {
          const path2ds = boundingboxtopath2ds(obj["bounding-box"]);
          for (const path2d of path2ds) {
            if (canvascontext.isPointInPath(path2d, xoncanvas, yoncanvas)) {
              clickedobjids.add(obj.id);
            }
          }
        }
      }
      selectobjs(viewport["select-mode"], clickedobjids);
      render();
      break;
    }
    case "transform": {
      const visibleobjs = getgroupcontent(["plane"], viewport["group-id"]);
      let clickedpoint;
      for (const obj of visibleobjs) {
        for (let i = 0; i < obj["points"].length; i++) {
          const point = obj["points"][i];
          const [x, y] = xyzoncanvas(point);
          if (ispointwithinradius(xoncanvas, yoncanvas, x, y, getpointradius())) {
            clickedpoint = [obj["id"], i];
            break;
          }
        }
        if (typeof clickedpoint != "undefined") {
          break;
        }
      }
      if (typeof clickedpoint != "undefined") {
        selectionmap = {
          [clickedpoint[0]]: [clickedpoint[1]]
        };
        render();
      }
      break;
    }
  }
}
function getpointradius() {
  return 2.2 * viewport["dpi"];
}
function boundingboxpreview(boundingbox) {
  const s = viewport["zoom"];
  const w = viewport["width"];
  const h = viewport["height"];
  const rh = viewport["rotate-horizontal"];
  const rv = viewport["rotate-vertical"];
  const minx = boundingbox["min-x"];
  const maxx = boundingbox["max-x"];
  const miny = boundingbox["min-y"];
  const maxy = boundingbox["max-y"];
  const minz = boundingbox["min-z"];
  const maxz = boundingbox["max-z"];
  const blb = {"x": minx, "y": miny, "z": minz};
  const blt = {"x": minx, "y": maxy, "z": minz};
  const brb = {"x": maxx, "y": miny, "z": minz};
  const brt = {"x": maxx, "y": maxy, "z": minz};
  const flb = {"x": minx, "y": miny, "z": maxz};
  const flt = {"x": minx, "y": maxy, "z": maxz};
  const frb = {"x": maxx, "y": miny, "z": maxz};
  const frt = {"x": maxx, "y": maxy, "z": maxz};
  return [
    [blb, brb, brt, blt, blb],
    [blb, brb, frb, flb, blb],
    [blt, brt, frt, flt, blt],
    [flb, flt, frt, frb, flb],
    [blb, blt, flt, flb, blb],
    [brb, brt, frt, frb, brb],
  ];
}
function xyzoncanvas(xyz) {
  const xyzrot = rotatexyz(
    (viewport["move"].x + xyz.x) * viewport["zoom"],
    (viewport["move"].y + xyz.y) * viewport["zoom"],
    (viewport["move"].z + xyz.z) * viewport["zoom"],
    viewport["rotate-horizontal"],
    viewport["rotate-vertical"]
  );
  return [
    viewport["width"] * viewport["dpi"] / 2 + xyzrot[0] * viewport["dpi"],
    viewport["height"] * viewport["dpi"] / 2 - xyzrot[1] * viewport["dpi"]
  ];
}
function boundingboxtopath2ds(boundingbox) {
  const polygons = boundingboxpreview(boundingbox);
  const path2ds = [];
  for (const polygon of polygons) {
    const path2d = new Path2D();
    const xys = polygon.map((xyz) => xyzoncanvas(xyz));
    path2d.moveTo(xys[0][0], xys[0][1]);
    for (const xy of xys.slice(1)) {
      path2d.lineTo(xy[0], xy[1]);
    }
    path2ds.push(path2d);
  }
  return path2ds;
}
const controlpointindexes = [4, 1, 2, 7, 11, 10, 13, 14, 9, 5, 6, 8];
function objpreview(obj, stroke, highligtedpointindexes) {
  canvascontext.lineWidth = viewport["dpi"] * 1.4;
  if (view == "create") {
    canvascontext.strokeStyle = stroke;
    const path2ds = boundingboxtopath2ds(obj["bounding-box"]);
    for (const path2d of path2ds) {
      canvascontext.stroke(path2d);
    }
  }
  if (obj["type"] == "plane") {
    if (view == "transform") {
      let path2ds;
      canvascontext.strokeStyle = "lightgray";
      path2ds = getplanecontrolpointlines(obj);
      for (const path2d of path2ds) {
        canvascontext.stroke(path2d);
      }
      canvascontext.strokeStyle = "gray";
      path2ds = getplanelines(obj);
      for (const path2d of path2ds) {
        canvascontext.stroke(path2d);
      }
      for (let i = 0; i < obj["points"].length; i++) {
        let fillcolor;
        if (highligtedpointindexes.includes(i)) {
          fillcolor = "blue";
        } else if (controlpointindexes.includes(i)) {
          fillcolor = "red";
        } else {
          fillcolor = "black";
        }
        const point = obj["points"][i];
        const path2d = new Path2D();
        const [x, y] = xyzoncanvas(point);
        path2d.arc(x, y, getpointradius(), 0, 2 * Math.PI);
        canvascontext.fillStyle = fillcolor;
        canvascontext.fill(path2d);
      }
    } else {
      canvascontext.strokeStyle = stroke;
      let path2ds = getplaneoutline(obj);
      for (const path2d of path2ds) {
        canvascontext.stroke(path2d);
      }
    }
  }
}
function getcurve(p1, p2, p3, p4, segments) {
  const curve = [];
  for (let i = 0; i < 1; i+= 1/segments) {
    curve.push(bezier(i, p1, p2, p3, p4));
  }
  curve.push(p4);
  return curve;
}
function getplanecontrolpointlines(plane) {
  const lines = [
    [xyzoncanvas(plane["points"][0]), xyzoncanvas(plane["points"][1])],
    [xyzoncanvas(plane["points"][2]), xyzoncanvas(plane["points"][3])],
    [xyzoncanvas(plane["points"][4]), xyzoncanvas(plane["points"][5])],
    [xyzoncanvas(plane["points"][6]), xyzoncanvas(plane["points"][7])],
    [xyzoncanvas(plane["points"][8]), xyzoncanvas(plane["points"][9])],
    [xyzoncanvas(plane["points"][10]), xyzoncanvas(plane["points"][11])],
    [xyzoncanvas(plane["points"][12]), xyzoncanvas(plane["points"][13])],
    [xyzoncanvas(plane["points"][14]), xyzoncanvas(plane["points"][15])],
    [xyzoncanvas(plane["points"][0]), xyzoncanvas(plane["points"][4])],
    [xyzoncanvas(plane["points"][12]), xyzoncanvas(plane["points"][8])],
    [xyzoncanvas(plane["points"][1]), xyzoncanvas(plane["points"][5])],
    [xyzoncanvas(plane["points"][13]), xyzoncanvas(plane["points"][9])],
    [xyzoncanvas(plane["points"][6]), xyzoncanvas(plane["points"][2])],
    [xyzoncanvas(plane["points"][14]), xyzoncanvas(plane["points"][10])],
    [xyzoncanvas(plane["points"][7]), xyzoncanvas(plane["points"][3])],
    [xyzoncanvas(plane["points"][15]), xyzoncanvas(plane["points"][11])],
  ];
  const path2ds = [];
  for (const [a, b] of lines) {
    const path2d = new Path2D();
    path2d.moveTo(a[0], a[1]);
    path2d.lineTo(b[0], b[1]);
    path2ds.push(path2d);
  }
  return path2ds;
}
function getplaneoutline(plane) {
  const wideminmax = Math.min(plane["wide"], 20);
  const fallminmax = Math.min(plane["fall"], 20);
  const a = getcurve(plane["points"][0], plane["points"][1], plane["points"][2], plane["points"][3], wideminmax);
  const b = getcurve(plane["points"][3], plane["points"][7], plane["points"][11], plane["points"][15], fallminmax);
  const c = getcurve(plane["points"][12], plane["points"][13], plane["points"][14], plane["points"][15], wideminmax);
  const d = getcurve(plane["points"][0], plane["points"][4], plane["points"][8], plane["points"][12], fallminmax);
  const path2ds = [];
  for (const line of [a, b, c, d]) {
    const path2d = new Path2D();
    for (let i = 0; i < line.length; i++) {
      const point = line[i];
      const xyz = xyzoncanvas(point);
      if (i == 0) {
        path2d.moveTo(xyz[0], xyz[1]);
      } else {
        path2d.lineTo(xyz[0], xyz[1]);
      }
    }
    path2ds.push(path2d);
  }
  return path2ds;
}
function getplanelines(plane) {
  const wideminmax = Math.min(plane["wide"], 20);
  const fallminmax = Math.min(plane["fall"], 20);
  const wa = getcurve(plane["points"][0], plane["points"][1], plane["points"][2], plane["points"][3], wideminmax);
  const wb = getcurve(plane["points"][4], plane["points"][5], plane["points"][6], plane["points"][7], wideminmax);
  const wc = getcurve(plane["points"][8], plane["points"][9], plane["points"][10], plane["points"][11], wideminmax);
  const wd = getcurve(plane["points"][12], plane["points"][13], plane["points"][14], plane["points"][15], wideminmax);
  const fa = getcurve(plane["points"][0], plane["points"][4], plane["points"][8], plane["points"][12], fallminmax);
  const fb = getcurve(plane["points"][1], plane["points"][5], plane["points"][9], plane["points"][13], fallminmax);
  const fc = getcurve(plane["points"][2], plane["points"][6], plane["points"][10], plane["points"][14], fallminmax);
  const fd = getcurve(plane["points"][3], plane["points"][7], plane["points"][11], plane["points"][15], fallminmax);
  const path2ds = [];
  for (const line of [wa, wb, wc, wd, fa, fb, fc, fd]) {
    const path2d = new Path2D();
    for (let i = 0; i < line.length; i++) {
      const point = line[i];
      const xyz = xyzoncanvas(point);
      if (i == 0) {
        path2d.moveTo(xyz[0], xyz[1]);
      } else {
        path2d.lineTo(xyz[0], xyz[1]);
      }
    }
    path2ds.push(path2d);
  }
  return path2ds;
}
function clearcanvas() {
  canvascontext.clearRect(0, 0, viewport["width"] * viewport["dpi"], viewport["height"] * viewport["dpi"]);
}
function getpivotpath2d() {
  const path2d = new Path2D();
  const [x, y] = xyzoncanvas(viewport.pivot);
  path2d.arc(x, y, getpointradius(), 0, 2 * Math.PI);
  return path2d;
}
function draw(visibleobjtypes=VISIBLE_OBJ_TYPES) {
  clearcanvas();
  const visibleobjs = getgroupcontent(visibleobjtypes, viewport["group-id"]);
  for (const obj of visibleobjs) {
    let stroke;
    let highligtedpointindexes;
    if (viewport["cut"].includes(obj["id"])) {
      stroke = "red";
    } else if (obj["id"] in selectionmap) {
      if (view == "transform") {
        stroke = "black";
        highligtedpointindexes = selectionmap[obj["id"]];
      } else {
        stroke = "blue";
        highligtedpointindexes = [];
      }
    } else {
      stroke = "black";
      highligtedpointindexes = []
    }
    objpreview(obj, stroke, highligtedpointindexes);
  }
  canvascontext.fillStyle = "red";
  canvascontext.fill(getpivotpath2d());
  if (showselectionrectangle) {
    const {x, y, width, height} = getselectionrectangle();
    canvascontext.strokeStyle = "black";
    canvascontext.strokeRect(x, y, width, height);
  }
  if (typeof facesdrawn != "undefined") {
    drawrendercanvas();
  }
}
function dpigroup() {
  const spantag = span("dpi");
  spantag.appendChild(text(viewport["dpi"].toString()));
  return [
    "dpi",
    spantag,
    {
      "readonly": viewport["dpi"] == 1,
      "label": "-",
      "callback": () => {
        viewport["dpi"] = 1;
        calclayout();
        render();
      }
    },
    {
      "readonly": viewport["dpi"] == 2,
      "label": "+",
      "callback": () => {
        viewport["dpi"] = 2;
        calclayout();
        render();
      }
    } 
  ];
}
function rendergroup() {
  return [
    ["render", () => {
      paintrendercanvas();
      render();  
    }], {
      readonly: typeof facesdrawn == "undefined",
      label: "clear",
      callback() {
        facesdrawn = undefined;
        clearrendercanvas();
        render();
      }
    }
  ];
}
function savegroup() {
  const group = [
  ];
  if (saving) {
    group.push("saving");
  } else {
    group.push(["save", () => {
      saving = true;
      render();
      fetch("/draft.json", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(draft)
      }).then(function () {
        saving = false;
        render();
      });
    }]);
  }
  return group;
}
function createstatusbarelementwgroup() {
  const menuelement = div("#status-bar");
  const left = [
    viewportmovegroup(),
    viewportrotategroup(),
    pivotgroup()
  ];
  if (hasselection()) {
    left.push(pivotmovetoselectiongroup());
  }
  left.push(selectmodegroup());
  const right = [
    dpigroup(),
    //rendergroup(),
    //savegroup()
  ];
  leftrightwgroups(menuelement, left, right);
  return menuelement;
}
function pivotgroup() {
  return [
    "pivot",
    ["west", (step) => {
      viewport.pivot.x -= step;
      render();
    }],
    ["east", (step) => {
      viewport.pivot.x += step;
      render();
    }],
    ["north", (step) => {
      viewport.pivot.z -= step;
      render();
    }],
    ["south", (step) => {
      viewport.pivot.z += step;
      render();
    }],
    ["ceil", (step) => {
      viewport.pivot.y += step;
      render();
    }],
    ["floor", (step) => {
      viewport.pivot.y -= step;
      render();
    }]
  ];
}
function selectmodegroup() {
  const group = ["select"];
  for (const transformselect of ["new", "add", "del"]) {
    if (transformselect == viewport["select-mode"]) {
      group.push(transformselect);
    } else {
      group.push([transformselect, () => {
        viewport["select-mode"] = transformselect;
        render();
      }]);
    }
  }
  return group;
}
function viewportrotategroup() {
  return [
    "rotate h",
    ["-", (step) => {
      viewport["rotate-horizontal"] -= step;
      render();
    }],
    ["+", (step) => {
      viewport["rotate-horizontal"] += step;
      render();
    }],
    ["0", () => {
      viewport["rotate-horizontal"] = 0;
      render();
    }],
    ["90", () => {
      viewport["rotate-horizontal"] = 90;
      render();
    }],
    "v",
    ["-", (step) => {
      viewport["rotate-vertical"] -= step;
      render();
    }],
    ["+", (step) => {
      viewport["rotate-vertical"] += step;
      render();
    }],
    ["0", () => {
      viewport["rotate-vertical"] = 0;
      render();
    }],
    ["90", () => {
      viewport["rotate-vertical"] = 90;
      render();
    }]
  ];
}
function viewportmovegroup() {
  return [
    "move",
    ["west", (step) => {
      viewport.move.x -= step;
      render();
    }],
    ["east", (step) => {
      viewport.move.x += step;
      render();
    }],
    ["north", (step) => {
      viewport.move.z -= step;
      render();
    }],
    ["south", (step) => {
      viewport.move.z += step;
      render();
    }],
    ["ceil", (step) => {
      viewport.move.y += step;
      render();
    }],
    ["floor", (step) => {
      viewport.move.y -= step;
      render();
    }],
    spacer(),
    ["selection", () => {
      const center = centerselected();
      viewport.move = {"x": -center.x, "y": -center.y, "z": -center.z};
      render();
    }],
    ["pivot", () => {
      viewport.move = {"x": -viewport.pivot.x, "y": -viewport.pivot.y, "z": -viewport.pivot.z};
      render();
    }]
  ];
}
function pivotmovetoselectiongroup() {
  const pivottoselection = [
    "pivot"
  ];
  for (const key of ["x", "y", "z"]) {
    pivottoselection.push({
      "label": key,
      "callback": () => {
        toggleboolean(viewport["pivot-to-selection-defaults"], [key]);
        render();
      },
      "underline": viewport["pivot-to-selection-defaults"][key]
    });
  }
  pivottoselection.push(["apply", () => {
    pivotselected();
    render();
  }]);
  return pivottoselection;
}
function glabelorlink(w) {
  const isarray = Array.isArray(w);
  if (w instanceof HTMLElement) {
    return w;
  } else if (typeof w == "object" && !isarray) {
    if (w.readonly) {
      return glabelorlink(w.label);
    }
    if (w.underline) {
      return glabelorlink([w.label, w.callback, "underline"]);
    }
    return glabelorlink([w.label, w.callback]);
  } else if (isarray) {
    const atag = a(w[0], "/", w[1]);
    if (typeof w[2] != "undefined") {
      if (w[2]) {
        atag.classList.add(w[2]);
      }
    }
    return atag;
  } else if (typeof w == "string") {
    const spantag = span();
    spantag.appendChild(text(w));
    return spantag;
  }
}
function spacer(array) {
  return span("spacer");
}
function leftright(container, left, right) {
  const leftdiv = div("left");
  const rightdiv = div("right");
  for (const labelorlink of space(left)) {
    leftdiv.appendChild(glabelorlink(labelorlink))
  }
  for (const labelorlink of space(right)) {
    rightdiv.appendChild(glabelorlink(labelorlink))
  }
  container.appendChild(leftdiv);
  container.appendChild(rightdiv);
  container.appendChild(div("clear"));
}
function leftrightwgroups(container, left, right) {
  const leftdiv = div("left");
  const rightdiv = div("right");
  leftdiv.classList.add("w-groups");
  rightdiv.classList.add("w-groups");
  for (const group of left) {
    const groupdiv = div("group");
    for (const labelorlink of group) {
      groupdiv.appendChild(glabelorlink(labelorlink))
    }
    leftdiv.appendChild(groupdiv);
  }
  for (const group of right) {
    const groupdiv = div("group");
    for (const labelorlink of group) {
      groupdiv.appendChild(glabelorlink(labelorlink))
    }
    rightdiv.appendChild(groupdiv);
  }
  container.appendChild(leftdiv);
  container.appendChild(rightdiv);
  container.appendChild(div("clear"));
}
function createsplitmenuelementwgroup() {
  const menuelement = div("#menu");
  const left = [];
  const right = [];
  leftrightwgroups(menuelement, left, right);
  return menuelement;
}
function splitgroup() {
  const splits = [];
  const readonly = !allplane(getselectedobjids());
  for (let splitindex = 0; splitindex < viewport["split-at"].length; splitindex += 1) {
    const split = viewport["split-at"][splitindex];
    splits.push(
      viewport["split-at"][splitindex].toString(),
      // viewport["split-at"][splitindex].toFixed(2).toString(),
      {
        "readonly": readonly,
        "label": "-",
        "callback": (step) => {
          viewport["split-at"][splitindex] -= 1;
          // viewport["split-at"][splitindex] -= 0.1/step;
          render();
        }
      },
      {
        "readonly": readonly,
        "label": "+",
        "callback": (step) => {
          viewport["split-at"][splitindex] += 1;
          // viewport["split-at"][splitindex] += 0.1/step;
          render();
        }
      }
    )
  }
  return [
    "split",
    {
      "readonly": readonly || viewport["split-wide-fall"] == "wide",
      "label": "wide",
      "callback": () => {
        viewport["split-wide-fall"] = "wide";
        render();
      }
    },
    {
      "readonly": readonly || viewport["split-wide-fall"] == "fall",
      "label": "fall",
      "callback": () => {
        viewport["split-wide-fall"] = "fall";
        render();
      }
    },
    ...splits,
    {
      "readonly": readonly,
      "label": "apply",
      "callback": () => {
        let selectionmapnew = {};
        for (const objid of getselectedobjids()) {
          const newobjs = splitrange(getobjbyid(objid), viewport["split-at"], viewport["split-wide-fall"]);
          for (const objnew of newobjs) {
            selectionmapnew = {
              ...selectionmapnew,
              [objnew.id]: []
            };  
          }
        }
        selectionmap = selectionmapnew;
        view = "create";
        render();
      }
    },
    "stops",
    {
      "readonly": readonly,
      "label": "add",
      "callback": () => {
        let splitlast = 0;
        for (const split of viewport["split-at"]) {
          splitlast = split;
        }
        viewport["split-at"].push(splitlast);
        // viewport["split-at"].push(splitlast+(1-splitlast)/2);
        render();
      }
    },
    {
      "readonly": readonly || viewport["split-at"].length == 1,
      "label": "pop",
      "callback": () => {
        viewport["split-at"].pop();
        render();
      }
    }
  ];
}
function createsplitmenuelement() {
  const menuelement = div("#menu");
  leftright(menuelement, [
    "split",
    viewport["split-wide-fall"] == "wide" ? "wide": ["wide", () => {
      viewport["split-wide-fall"] = "wide";
      render();
    }, "underline"],
    viewport["split-wide-fall"] == "fall" ? "fall": ["fall", () => {
      viewport["split-wide-fall"] = "fall";
      render();
    }, "underline"],
    viewport["split-at"].toFixed(2).toString(),
    ["-", (step) => {
      viewport["split-at"] -= 0.1/step;
      render();
    }],
    ["+", (step) => {
      viewport["split-at"] += 0.1/step;
      render();
    }]
  ], [
    ["cancel", () => {
      view = "create";
      render();
    }],
    ["done", () => {
      let selectionmapnew = {};
      for (const objid of getselectedobjids()) {
        const selectionresult = splitobj(getobjbyid(objid), viewport["split-at"], viewport["split-wide-fall"]);
        selectionmapnew = {...selectionmapnew, ...selectionresult};
      }
      selectionmap = selectionmapnew;
      view = "create";
      render();
    }]
  ]);
  return menuelement;
}
function slicegroup() {
  return [
    "slice",
    "wide",
    viewport["slice-wide"].toString(),
    ["-", () => {
      viewport["slice-wide"] -= 1;
      render();
    }],
    ["+", () => {
      viewport["slice-wide"] += 1;
      render();
    }],
    "fall",
    viewport["slice-fall"].toString(),
    ["-", () => {
      viewport["slice-fall"] -= 1;
      render();
    }],
    ["+", () => {
      viewport["slice-fall"] += 1;
      render();
    }],
    ["apply", () => {
      let selectionmapnew = {};
      for (const objid of getselectedobjids()) {
        const selectionresult = sliceobj(getobjbyid(objid), viewport["slice-wide"], viewport["slice-fall"]);
        selectionmapnew = {...selectionmapnew, ...selectionresult};
      }
      selectionmap = selectionmapnew;
      view = "create";
      render();
    }]
  ];
}
function createslicemenuelement() {
  const menuelement = div("#menu");
  leftright(menuelement, [
    "slice",
    "wide",
    viewport["slice-wide"].toString(),
    ["-", () => {
      viewport["slice-wide"] -= 1;
      render();
    }],
    ["+", () => {
      viewport["slice-wide"] += 1;
      render();
    }],
    "fall",
    viewport["slice-fall"].toString(),
    ["-", () => {
      viewport["slice-fall"] -= 1;
      render();
    }],
    ["+", () => {
      viewport["slice-fall"] += 1;
      render();
    }]
  ], [
    ["cancel", () => {
      view = "create";
      render();
    }],
    ["done", () => {
      let selectionmapnew = {};
      for (const objid of getselectedobjids()) {
        const selectionresult = sliceobj(getobjbyid(objid), viewport["slice-wide"], viewport["slice-fall"]);
        selectionmapnew = {...selectionmapnew, ...selectionresult};
      }
      selectionmap = selectionmapnew;
      view = "create";
      render();
    }]
  ]);
  return menuelement;
}
function movegroup() {
  return [
    "move",
    ["west", (step) => {
      transformpoints((point) => {
        point.x -= step;
      });
      render();
    }],
    ["east", (step) => {
      transformpoints((point) => {
        point.x += step;
      });
      render();
    }],
    ["north", (step) => {
      transformpoints((point) => {
        point.z -= step;
      });
      render();
    }],
    ["south", (step) => {
      transformpoints((point) => {
        point.z += step;
      });
      render();
    }],
    ["ceil", (step) => {
      transformpoints((point) => {
        point.y += step;
      });
      render();
    }],
    ["floor", (step) => {
      transformpoints((point) => {
        point.y -= step;
      });
      render();
    }]
  ];
}
function flipgroup() {
  return [
    "flip",
    ["x", () => {
      transformpoints((point) => {
        point.x = viewport.pivot.x + (point.x - viewport.pivot.x) * -1;
      });
      render();
    }],
    ["y", () => {
      transformpoints((point) => {
        point.y = viewport.pivot.y + (point.y - viewport.pivot.y) * -1;
      });
      render();
    }],
    ["z", () => {
      transformpoints((point) => {
        point.z = viewport.pivot.z + (point.z - viewport.pivot.z) * -1;
      });
      render();
    }]
  ];
}
function toggleboolean(obj, key) {
  if (obj[key]) {
    obj[key] = false;
  } else {
    obj[key] = true;
  }
}
function movetopivotgroup() {
  const xyz = [];
  for (const a of ["x", "y", "z"]) {
    xyz.push({
      "label": a,
      "callback": () => {
        toggleboolean(viewport["move-to-pivot-defaults"], a);
        render();
      },
      "underline": viewport["move-to-pivot-defaults"][a],
    });
  }
  return [
    "move to pivot",
    ...xyz,
    ["apply", () => {
      transformpoints((point) => {
        if (viewport["move-to-pivot-defaults"].x) {
          point.x = viewport.pivot.x;
        }
        if (viewport["move-to-pivot-defaults"].y) {
          point.y = viewport.pivot.y;
        }
        if (viewport["move-to-pivot-defaults"].z) {
          point.z = viewport.pivot.z;
        }
      });
      render();
    }]
  ];
}
function rotategroup() {
  return [
    "rotate",
    ["xy", () => {
      viewport["rotate-axis"] = "xy";
      render();
    }, viewport["rotate-axis"] == "xy" && "underline"],
    ["xz", () => {
      viewport["rotate-axis"] = "xz";
      render();
    }, viewport["rotate-axis"] == "xz" && "underline"],
    ["zy", () => {
      viewport["rotate-axis"] = "zy";
      render();
    }, viewport["rotate-axis"] == "zy" && "underline"],
    "by",
    ["-", (m) => {
      viewport["rotate-by"] -= m;
      render();
    }],
    ["+", (m) => {
      viewport["rotate-by"] += m;
      render();
    }],
    viewport["rotate-by"].toString(),
    "degrees",
    ["-", () => {
      transformpoints((point) => {
        if (viewport["rotate-axis"] == "xy") {
          const pn = rotate(point.x - viewport.pivot.x, point.y - viewport.pivot.y, -viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "zy") {
          const pn = rotate(point.z - viewport.pivot.z, point.y - viewport.pivot.y, -viewport["rotate-by"]);
          point.z = (viewport.pivot.z + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "xz") {
          const pn = rotate(point.x - viewport.pivot.x, point.z - viewport.pivot.z, -viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.z = (viewport.pivot.z + pn[1]);
        }
      });
      render();
    }],
    ["+", () => {
      transformpoints((point) => {
        if (viewport["rotate-axis"] == "xy") {
          const pn = rotate(point.x - viewport.pivot.x, point.y - viewport.pivot.y, viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "zy") {
          const pn = rotate(point.z - viewport.pivot.z, point.y - viewport.pivot.y, viewport["rotate-by"]);
          point.z = (viewport.pivot.z + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "xz") {
          const pn = rotate(point.x - viewport.pivot.x, point.z - viewport.pivot.z, viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.z = (viewport.pivot.z + pn[1]);
        }
      });
      render();
    }]
  ];
}
function scalegroup() {
  return [
    "scale",
    ["x", () => {
      toggleboolean(viewport["scale-defaults"], "x");
      render();
    }, viewport["scale-defaults"].x && "underline"],
    ["y", () => {
      toggleboolean(viewport["scale-defaults"], "y");
      render();
    }, viewport["scale-defaults"].y && "underline"],
    ["z", () => {
      toggleboolean(viewport["scale-defaults"], "z");
      render();
    }, viewport["scale-defaults"].z && "underline"],
    "by",
    ["-", (m) => {
      viewport["scale-by"] -= (0.1/m);
      render();
    }],
    ["+", (m) => {
      viewport["scale-by"] += (0.1/m);
      render();
    }],
    viewport["scale-by"].toFixed(2).toString(),
    ["-", () => {
      transformpoints((point) => {
        if (viewport["scale-defaults"].x) {point.x = viewport.pivot.x + (point.x - viewport.pivot.x) / viewport["scale-by"]};
        if (viewport["scale-defaults"].y) {point.y = viewport.pivot.y + (point.y - viewport.pivot.y) / viewport["scale-by"]};
        if (viewport["scale-defaults"].z) {point.z = viewport.pivot.z + (point.z - viewport.pivot.z) / viewport["scale-by"]};
      });
      render();
    }],
    ["+", () => {
      transformpoints((point) => {
        if (viewport["scale-defaults"].x) {point.x = viewport.pivot.x + (point.x - viewport.pivot.x) * viewport["scale-by"]};
        if (viewport["scale-defaults"].y) {point.y = viewport.pivot.y + (point.y - viewport.pivot.y) * viewport["scale-by"]};
        if (viewport["scale-defaults"].z) {point.z = viewport.pivot.z + (point.z - viewport.pivot.z) * viewport["scale-by"]};
      });
      render();
    }]
  ];
}
function selectnavigategroup() {
  return [
    "select",
    ["all", () => {
      selectallpointindexes(viewport["group-id"]);
      render();
    }],
    ["whole", () => {
      selectwhole();
      render();
    }],
    ["none", () => {
      selectionmap = {};
      render();
    }]
  ];
}
function createtransformmenuelementwgroups() {
  const menuelement = div("#menu");
  const left = [
    movegroup(),
    movetopivotgroup(),
    flipgroup(),
    rotategroup(),
    scalegroup()
  ];
  const right = [
    selectnavigategroup()
  ];
  leftrightwgroups(menuelement, left, right);
  return menuelement;
}
function createtransformmenuelement() {
  const menuelement = div("#menu");
  const left = [
    ["to pivot", () => {
      transformpoints((point) => {
        if (viewport["move-to-pivot-defaults"].x) {
          point.x = viewport.pivot.x;
        }
        if (viewport["move-to-pivot-defaults"].y) {
          point.y = viewport.pivot.y;
        }
        if (viewport["move-to-pivot-defaults"].z) {
          point.z = viewport.pivot.z;
        }
      });
      render();
    }],
    ["x", () => {
      viewport["move-to-pivot-defaults"].x = !viewport["move-to-pivot-defaults"].x;
      render();
    }, viewport["move-to-pivot-defaults"].x && "underline"],
    ["y", () => {
      viewport["move-to-pivot-defaults"].y = !viewport["move-to-pivot-defaults"].y;
      render();
    }, viewport["move-to-pivot-defaults"].y && "underline"],
    ["z", () => {
      viewport["move-to-pivot-defaults"].z = !viewport["move-to-pivot-defaults"].z;
      render();
    }, viewport["move-to-pivot-defaults"].z && "underline"],
    
    "rotate",
    ["xy", () => {
      viewport["rotate-axis"] = "xy";
      render();
    }, viewport["rotate-axis"] == "xy" && "underline"],
    ["xz", () => {
      viewport["rotate-axis"] = "xz";
      render();
    }, viewport["rotate-axis"] == "xz" && "underline"],
    ["zy", () => {
      viewport["rotate-axis"] = "zy";
      render();
    }, viewport["rotate-axis"] == "zy" && "underline"],
    ["-", () => {
      transformpoints((point) => {
        if (viewport["rotate-axis"] == "xy") {
          const pn = rotate(point.x - viewport.pivot.x, point.y - viewport.pivot.y, -viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "zy") {
          const pn = rotate(point.z - viewport.pivot.z, point.y - viewport.pivot.y, -viewport["rotate-by"]);
          point.z = (viewport.pivot.z + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "xz") {
          const pn = rotate(point.x - viewport.pivot.x, point.z - viewport.pivot.z, -viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.z = (viewport.pivot.z + pn[1]);
        }
      });
      render();
    }],
    ["+", () => {
      transformpoints((point) => {
        if (viewport["rotate-axis"] == "xy") {
          const pn = rotate(point.x - viewport.pivot.x, point.y - viewport.pivot.y, viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "zy") {
          const pn = rotate(point.z - viewport.pivot.z, point.y - viewport.pivot.y, viewport["rotate-by"]);
          point.z = (viewport.pivot.z + pn[0]);
          point.y = (viewport.pivot.y + pn[1]);
        } else if (viewport["rotate-axis"] == "xz") {
          const pn = rotate(point.x - viewport.pivot.x, point.z - viewport.pivot.z, viewport["rotate-by"]);
          point.x = (viewport.pivot.x + pn[0]);
          point.z = (viewport.pivot.z + pn[1]);
        }
      });
      render();
    }],
    "by",
    ["-", (m) => {
      viewport["rotate-by"] -= m;
      render();
    }],
    ["+", (m) => {
      viewport["rotate-by"] += m;
      render();
    }],
    viewport["rotate-by"],
    "degrees",
    "scale",
    ["x", () => {
      viewport["scale-defaults"].x = !viewport["scale-defaults"].x;
      render();
    }, viewport["scale-defaults"].x && "underline"],
    ["y", () => {
      viewport["scale-defaults"].y = !viewport["scale-defaults"].y;
      render();
    }, viewport["scale-defaults"].y && "underline"],
    ["z", () => {
      viewport["scale-defaults"].z = !viewport["scale-defaults"].z;
      render();
    }, viewport["scale-defaults"].z && "underline"],
    ["-", () => {
      transformpoints((point) => {
        if (viewport["scale-defaults"].x) {point.x = viewport.pivot.x + (point.x - viewport.pivot.x) / viewport["scale-by"]};
        if (viewport["scale-defaults"].y) {point.y = viewport.pivot.y + (point.y - viewport.pivot.y) / viewport["scale-by"]};
        if (viewport["scale-defaults"].z) {point.z = viewport.pivot.z + (point.z - viewport.pivot.z) / viewport["scale-by"]};
      });
      render();
    }],
    ["+", () => {
      transformpoints((point) => {
        if (viewport["scale-defaults"].x) {point.x = viewport.pivot.x + (point.x - viewport.pivot.x) * viewport["scale-by"]};
        if (viewport["scale-defaults"].y) {point.y = viewport.pivot.y + (point.y - viewport.pivot.y) * viewport["scale-by"]};
        if (viewport["scale-defaults"].z) {point.z = viewport.pivot.z + (point.z - viewport.pivot.z) * viewport["scale-by"]};
      });
      render();
    }],
    "by",
    ["-", (m) => {
      viewport["scale-by"] -= (0.1/m);
      render();
    }],
    ["+", (m) => {
      viewport["scale-by"] += (0.1/m);
      render();
    }],
    viewport["scale-by"].toFixed(3).toString()
  ];
  const right = [
    "select",
    ["all", () => {
      selectallpointindexes(viewport["group-id"]);
      render();
    }],
    ["whole", () => {
      selectwhole();
      render();
    }],
    ["none", () => {
      selectionmap = {};
      render();
    }]
  ];
  leftright(menuelement, left, right);
  return menuelement;
}
function deletearrayelement(array, element) {
  const arrayn = [];
  while (array.length) {
    const v = array.pop();
    if (v == element) {
    } else {
      arrayn.push(v);
    }
  }
  for (const v of arrayn) {
    array.push(v);
  }
}
function togglearrayelement(array, element) {
  if (array.includes(element)) {
    deletearrayelement(array, element);
  } else {
    array.push(element);
  }
}
function createtoolselement() {
  const toolselement = div("#tools");
  const views = [
    ["/pointer.png", () => {
      view = "create";
      render();
    }, () => view == "create"],
    ["/transform.png", () => {
      view = "transform";
      render();
    }, () => view == "transform"],
    ["/zoom-in.png", () => {
      viewport["zoom"] *= 2;
      render();
    }, () => false],
    ["/zoom-out.png", () => {
      viewport["zoom"] /= 2;
      render();
    }, () => false]
  ];
  for (const [imgsrc, callback, iscurrent] of views) {
    const atag = document.createElement("a");
    if (iscurrent()) {
      atag.classList.add("current");
    }
    const imgtag = new Image();
    imgtag.src = imgsrc;
    imgtag.setAttribute("width", "16px");
    imgtag.setAttribute("height", "16px");
    atag.appendChild(imgtag);
    atag.setAttribute("href", "#");
    atag.addEventListener("click", (event) => {
      event.preventDefault();
      callback();
    });
    toolselement.appendChild(atag);
  }
  return toolselement;
}
function cutpastegroup() {
  const selectedobjids = getselectedobjids();
  return [
    ["group", () => {
      const newgroupid = makegroup(selectedobjids, viewport["group-id"]);
      selectionmap = {[newgroupid]: []};
      render();
    }],
    {
      "label": "paste",
      "readonly": viewport["cut"].length == 0,
      "callback": () => {
        paste();
        render();
      }
    },
    {
      "label": "cut",
      "readonly": viewport["cut"].length > 0 || !hasselection(),
      "callback": () => {
        viewport["cut"] = selectedobjids;
        selectionmap = {};
        render();
      }
    },
    ["duplicate", () => {
      selectionmap = {};
      for (const objid of selectedobjids) {
        const newid = duplicateobj(getobjbyid(objid));
        selectionmap[newid] = [];
      }
      render();
    }],
    ["delete", () => {
      for (const objid of selectedobjids) {
        deleteobj(objid);
      }
      selectionmap = {};
      render();
    }]
  ];
}
function objtypefiltergroup() {
  const group = ["filter"];
  for (const objtype of VISIBLE_OBJ_TYPES) {
    group.push([objtype, () => {
      togglearrayelement(viewport["visible-obj-types"], objtype);
      render();
    }, viewport["visible-obj-types"].includes(objtype) && "underline"]);
  }
  return group;
}
function creategroup() {
  return [
    "create",
    ["plane", () => {
      const newid = create(viewport["pivot"], viewport["group-id"]);
      selectionmap = {[newid]: []};
      render();
    }]
  ];
}
function showallgroup() {
  const selectedobjids = getselectedobjids();
  const group = [];
  const selectedobjs = selectedobjids.map(getobjbyid);
  if (selectedobjs.every((obj) => obj["type"] == "group")) {
    if (selectedobjids.some((objid) => !viewport["show-group-content"].includes(objid))) {
      group.push(["show", () => {
        for (const objid of selectedobjids) {
          if (!viewport["show-group-content"].includes(objid)) {
            viewport["show-group-content"].push(objid);
          }
        }
        render();
      }]);
    } else {
      group.push("show");
    }
    if (selectedobjids.some((objid) => viewport["show-group-content"].includes(objid))) {
      group.push(["hide", () => {
        for (const objid of selectedobjids) {
          if (viewport["show-group-content"].includes(objid)) {
            deletearrayelement(viewport["show-group-content"], objid);
          }
        }
        render();
      }]);
    } else {
      group.push("hide")
    }
  } else {
    group.push("hide", "show");
  }
  return group;
}
function groupnavigategroup() {
  const group = [
    ["select all", () => {
      selectall(viewport["group-id"]);
      render();
    }]
  ];
  if (viewport["group-id"] == null) {
    group.push("up");
  } else {
    const obj = getobjbyid(viewport["group-id"]);
    group.push(["up", () => {
      viewport["group-id"] = obj["group-id"];
      render();
    }]);
  }
  return group;
}
function selectedgroupgroup() {
  const selectedobjids = getselectedobjids();
  const obj = getobjbyid(selectedobjids[0]);
  return [
    "group",
    ["expand", () => {
      viewport["group-id"] = obj["id"];
      selectionmap = {};
      render();
    }]
  ];
}
function selectedplanegroup() {
  const selectedobjids = getselectedobjids();
  const obj = getobjbyid(selectedobjids[0]);
  return [
    "plane",
    "wide",
    obj["wide"].toString(),
    ["-", (step) => {
      obj["wide"] -= step;
      render();
    }],
    ["+", (step) => {
      obj["wide"] += step;
      render();
    }],
    "fall",
    obj["fall"].toString(),
    ["-", (step) => {
      obj["fall"] -= step;
      render();
    }],
    ["+", (step) => {
      obj["fall"] += step;
      render();
    }]
  ];
}
function selectedobjsnavigategroup() {
  return [
    ["deselect", () => {
      selectionmap = {};
      render();
    }]
  ];
}
function extrudetransformgroup() {
  const selectedobjids = getselectedobjids();
  const readonly = !allplane(selectedobjids);
  return [
    {
      readonly,
      "label": "extrude",
      callback() {
        selectionmap = {};
        for (const objid of selectedobjids) {
          selectionmap = {...selectionmap, ...extrudeobj(objid)};
        }
        view = "transform";
        render();
      }
    },
    {
      readonly,
      "label": "transform",
      callback() {
        view = "transform";
        selectionmap = {};
        for (const objid of selectedobjids) {
          selectionmap[objid] = objpointindexes(getobjbyid(objid));
        }
        render();
      }
    }
  ];
}
function createmenuelementwgroups() {
  const menuelement = div("#menu");
  let left;
  let right;
  const selectedobjids = getselectedobjids();
  if (selectedobjids.length == 0) {
    left = [
      creategroup(),
      cutpastegroup(),
      objtypefiltergroup()
    ];
    right = [
      groupnavigategroup()
    ];
  } else if (selectedobjids.length == 1) {
    const obj = getobjbyid(selectedobjids[0]);
    if (obj["type"] == "group") {
      left = [
        selectedgroupgroup(),
        showallgroup(),
        cutpastegroup()
      ];
    } else if (obj["type"] == "plane") {
      left = [
        selectedplanegroup(),
        cutpastegroup(),
        extrudetransformgroup(),
        splitgroup(),
        slicegroup()
      ];
    }
    right = [selectedobjsnavigategroup()];
  } else {
    left = [
      cutpastegroup(),
      showallgroup(),
      extrudetransformgroup(),
      splitgroup()
    ];
    right = [selectedobjsnavigategroup()];
  }
  leftrightwgroups(menuelement, left, right);
  return menuelement;
}
function render() {
  statusbarelementnew = createstatusbarelementwgroup();
  statusbarelement.replaceWith(statusbarelementnew);
  statusbarelement = statusbarelementnew;
  toolselementnew = createtoolselement();
  toolselement.replaceWith(toolselementnew);
  toolselement = toolselementnew;
  switch (view) {
    case "create": {
      menuelementnew = createmenuelementwgroups();
      menuelement.replaceWith(menuelementnew);
      menuelement = menuelementnew;
      draw(viewport["visible-obj-types"]);
      break;
    }
    case "transform": {
      menuelementnew = createtransformmenuelementwgroups();
      menuelement.replaceWith(menuelementnew);
      menuelement = menuelementnew;
      draw(["plane"]);
      break;
    }
  }
}
function getgroupcontent(objectTypes, groupid) {
  const objects = [];
  const subgroupids = findgroupids(groupid);
  const showgroupcontent = [];
  for (const includedgroupid of viewport["show-group-content"]) {
    if (subgroupids.includes(includedgroupid)) {
      showgroupcontent.push(includedgroupid);
    }
  }
  for (let i = 0; i < draft.length; i++) {
    const obj = draft[i];
    const hasvisibleobjtype = objectTypes.includes(obj["type"]);
    const isincurrentgroup = obj["group-id"] == groupid;
    const isingrouppreview = showgroupcontent.includes(obj["group-id"]);
    if (hasvisibleobjtype && (isincurrentgroup || isingrouppreview)) {
      let boundingbox;
      if (obj["type"] == "group") {
        boundingbox = groupboundingbox(obj["id"]);
      } else {
        boundingbox = objboundingbox(obj);
      }
      objects.push({...obj, "bounding-box": boundingbox});
    }
  }
  return objects;
}
function rotate(x, y, deg) {
  const cos = Math.cos(deg * Math.PI / 180);
  const sin = Math.sin(deg * Math.PI / 180);
  return [cos * x - sin * y, cos * y + sin * x];
}
function rotatexyz(x, y, z, rx, ry) {
  let xn, zn, yn;
  const rotatexz = rotate(x, z, rx);
  xn = rotatexz[0];
  zn = rotatexz[1];
  const rotateyz = rotate(y, zn, ry);
  yn = rotateyz[0];
  zn = rotateyz[1];
  return [xn, yn, zn];
}
function originnewobj() {
  if (viewport["group-id"] == null) {
    return {"x": 0, "y": 0, "z": 0};
  }
  let any = false;
  for (let i = 0; i < draft.length; i++) {
    const obj = draft[i];
    if (VISIBLE_OBJ_TYPES.includes(obj["type"]) && obj["group-id"] == viewport["group-id"]) {
      any = true;
      break;
    }
  }
  if (any) {
    return boundingboxorigin(groupboundingbox(viewport["group-id"]));
  }
  return {"x": 0, "y": 0, "z": 0};
}