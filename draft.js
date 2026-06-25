function loaddraft() {
  return Promise.resolve([]);
  return fetch("/draft.json").then(function (r) {return r.json()});
}
function getobjbyid(objid) {
  for (let i = 0; i < draft.length; i++) {
    const obj = draft[i];
    if (obj.id == objid) {
      return obj;
    }
  }
}
function transformpoints(apply) {
  const objids = Object.keys(selectionmap).map(idstr => Number(idstr));
  for (const objid of objids) {
    const obj = getobjbyid(objid);
    const pointindexes = selectionmap[objid];
    for (const pointindex of pointindexes) {
      apply(obj.points[pointindex], obj);
    }
  }
}
function getselectedobjids() {
  return Object.keys(selectionmap).map(idstr => Number(idstr));
}
function getnewid() {
  let maxid = 0;
  for (let i = 0; i < draft.length; i++) {
    const obj = draft[i];
    if (typeof maxid == "undefined" || maxid < obj["id"]) {
      maxid = obj["id"];
    }
  }
  return maxid + 1;
}
function findplaneids(groupid) {
  const ids = [];
  for (const obj of draft) {
    if (["plane", "group"].includes(obj["type"]) && obj["group-id"] == groupid) {
      if (obj["type"] == "group") {
        ids.push(...findplaneids(obj["id"]));
      } else if (obj["type"] == "plane") {
        ids.push(obj["id"]);
      }
    }
  }
  return ids;
}
function findgroupids(groupid) {
  const ids = [];
  for (const obj of draft) {
    if (obj["type"] == "group" && obj["group-id"] == groupid) {
      ids.push(obj["id"]);
      ids.push(...findgroupids(obj["id"]));
    }
  }
  return ids;
}
function objpointindexes(obj) {
  const indexes = [];
  for (let i = 0; i < obj.points.length; i++) {
    indexes.push(i);
  }
  return indexes;
}
function originpoints(origins) {
  const sum = {x: 0, y: 0, z: 0};
  if (origins.length == 0) {
    return sum;
  }
  let len = 0;
  for (const point of origins) {
    sum.x += point.x;
    sum.y += point.y;
    sum.z += point.z;
    len += 1;
  }
  return {x: Math.floor(sum.x/len), y: Math.floor(sum.y/len), z: Math.floor(sum.z/len)};
}
function pivotpoints(pointindexesall) {
  const origins = [];
  for (const [objid, pointindexes] of pointindexesall) {
    const obj = getobjbyid(objid);
    for (const pointindex of pointindexes) {
      const point = obj.points[pointindex];
      origins.push(point);
    }
  }
  return originpoints(origins);
}
function centerselected() {
  let center;
  if (view == "transform") {
    center = pivotselectedpoints();
  } else {
    center = pivotboundingboxes();
  }
  return center;
}
function pivotselected() {
  const pivot = centerselected();
  if (viewport["pivot-to-selection-defaults"].x) {
    viewport["pivot"].x = pivot.x;
  }
  if (viewport["pivot-to-selection-defaults"].y) {
    viewport["pivot"].y = pivot.y;
  }
  if (viewport["pivot-to-selection-defaults"].z) {
    viewport["pivot"].z = pivot.z;
  }
}
function boundingboxorigin(boundingbox) {
  return {
    "x": Math.floor((boundingbox["max-x"] + boundingbox["min-x"])/2),
    "y": Math.floor((boundingbox["max-y"] + boundingbox["min-y"])/2),
    "z": Math.floor((boundingbox["max-z"] + boundingbox["min-z"])/2),
  }
}
function pivotboundingboxes() {
  const origins = [];
  for (const objid in selectionmap) {
    const obj = getobjbyid(objid);
    origins.push(objorigin(obj));
  }
  return originpoints(origins);
}
function pivotselectedpoints() {
  const points = [];
  for (const objid in selectionmap) {
    const pointindexes = selectionmap[objid];
    for (const pointindex of pointindexes) {
      points.push(getobjbyid(objid).points[pointindex]);
    }
  }
  return originpoints(points);
}
function duplicateobj(obj) {
  const newid = getnewid();
  draft.push({...obj, "id": newid});
  if (obj["type"] == "group") {
    const idmap = {};
    idmap[obj["id"]] = newid;
    const ids = [
      ...findgroupids(obj["id"]),
      ...findplaneids(obj["id"])
    ];
    const fillids = [];
    draft.forEach(function (obj) {
      if (obj["type"] == "fill") {
        if (ids.includes(obj["object-id"])) {
          fillids.push(obj["id"]);
        }
      }
    });
    let currentid = newid + 1;
    const objstoreplaceids = [];
    ids.forEach(function (id) {
      const obj = getobjbyid(id);
      idmap[obj["id"]] = currentid;
      const objnew = {...obj, "id": currentid};
      if (obj["type"] == "plane") {
        obj.points = obj.points.map((point) => ({"x": point.x, "y": point.y, "z": point.z}));
      }
      objstoreplaceids.push(objnew);
      draft.push(objnew);
      currentid += 1;
    });
    fillids.forEach(function (id) {
      const obj = getobjbyid(id);
      const objnew = {...obj, id: currentid};
      objstoreplaceids.push(objnew);
      draft.push(objnew);
      currentid += 1;
    });
    objstoreplaceids.forEach(function (obj) {
      if (VISIBLE_OBJ_TYPES.includes(obj["type"])) {
        obj["group-id"] = idmap[obj["group-id"]];
      }
      if (obj["type"] == "fill") {
        obj["object-id"] = idmap[obj["object-id"]];
      }
    });
  } else if (obj["type"] == "plane") {
    obj.points = obj.points.map((point) => ({"x": point.x, "y": point.y, "z": point.z}));
  }
  return newid;
}
function extrudeobj(objid) {
  const obj = getobjbyid(objid);
  const leftid = getnewid();
  const left = {
    ...obj,
    "id": leftid,
    "points": [
      0, 0, 0, 0,
      4, 4, 4, 4,
      8, 8, 8, 8,
      12, 12, 12, 12
    ].map((i) => ({...obj.points[i]}))
  };
  draft.push(left);
  const topid = getnewid();
  const top = {
    ...obj,
    "id": topid,
    "points": [
      0, 1, 2, 3,
      0, 1, 2, 3,
      0, 1, 2, 3,
      0, 1, 2, 3
    ].map((i) => ({...obj.points[i]}))
  };
  draft.push(top);
  const rightid = getnewid();
  const right = {
    ...obj,
    "id": rightid,
    "points": [
      3, 3, 3, 3,
      7, 7, 7, 7,
      11, 11, 11, 11,
      15, 15, 15, 15
    ].map((i) => ({...obj.points[i]}))
  };
  draft.push(right);
  const bottomid = getnewid();
  const bottom = {
    ...obj,
    "id": bottomid,
    "points": [
      12, 13, 14, 15,
      12, 13, 14, 15,
      12, 13, 14, 15,
      12, 13, 14, 15
    ].map((i) => ({...obj.points[i]}))
  };
  draft.push(bottom);
  const extruderesult = {};
  extruderesult[obj["id"]] = obj.points.map((_, index) => index);
  extruderesult[leftid] = [2, 3, 6, 7, 10, 11, 14, 15];
  extruderesult[topid] = [8, 9, 10, 11, 12, 13, 14, 15];
  extruderesult[rightid] = [2, 3, 6, 7, 10, 11, 14, 15];
  extruderesult[bottomid] = [8, 9, 10, 11, 12, 13, 14, 15];
  return extruderesult;
}
function sliceobj(obj, slicewide, slicefall) {
  const selectionmap = {[obj.id]: []};
  let slicecurrentwide = slicewide;
  const slices = [obj];
  while (slicecurrentwide > 1) {
    const t = (obj["wide"] / slicecurrentwide) * (slicecurrentwide-1) / obj["wide"];
    const [halfa, enda] = splitbezier(t, obj.points[0], obj.points[1], obj.points[2], obj.points[3]);
    const [halfb, endb] = splitbezier(t, obj.points[4], obj.points[5], obj.points[6], obj.points[7]);
    const [halfc, endc] = splitbezier(t, obj.points[8], obj.points[9], obj.points[10], obj.points[11]);
    const [halfd, endd] = splitbezier(t, obj.points[12], obj.points[13], obj.points[14], obj.points[15]);
    obj.points[0] = halfa[0];
    obj.points[1] = halfa[1];
    obj.points[2] = halfa[2];
    obj.points[3] = halfa[3];
    obj.points[4] = halfb[0];
    obj.points[5] = halfb[1];
    obj.points[6] = halfb[2];
    obj.points[7] = halfb[3];
    obj.points[8] = halfc[0];
    obj.points[9] = halfc[1];
    obj.points[10] = halfc[2];
    obj.points[11] = halfc[3];
    obj.points[12] = halfd[0];
    obj.points[13] = halfd[1];
    obj.points[14] = halfd[2];
    obj.points[15] = halfd[3];
    const objnew = {
      "id": getnewid(),
      "wide": Math.ceil((1 - t) * obj["wide"]),
      "fall": obj["fall"],
      "type": "plane",
      "group-id": obj["group-id"],
      "points": [
        enda[0], enda[1], enda[2], enda[3],
        endb[0], endb[1], endb[2], endb[3],
        endc[0], endc[1], endc[2], endc[3],
        endd[0], endd[1], endd[2], endd[3]
      ]
    };
    selectionmap[objnew.id] = [];
    draft.push(objnew);
    slices.push(objnew);
    obj["wide"] *= t;
    slicecurrentwide -= 1;
  }
  obj["wide"] = Math.ceil(obj["wide"]);
  for (const slice of slices) {
    let slicecurrentfall = slicefall;
    while (slicecurrentfall > 1) {
      // const t = ((slice["fall"] / slicecurrentfall) * (slicecurrentfall - 1)) / slice["fall"];
      const t = 1 - (1 / slicecurrentfall);
      // const t = (1 / slicecurrentfall) * (slicecurrentfall - 1)
      const [halfa, enda] = splitbezier(t, slice.points[0], slice.points[4], slice.points[8], slice.points[12]);
      const [halfb, endb] = splitbezier(t, slice.points[1], slice.points[5], slice.points[9], slice.points[13]);
      const [halfc, endc] = splitbezier(t, slice.points[2], slice.points[6], slice.points[10], slice.points[14]);
      const [halfd, endd] = splitbezier(t, slice.points[3], slice.points[7], slice.points[11], slice.points[15]);
      slice.points[0] = halfa[0];
      slice.points[4] = halfa[1];
      slice.points[8] = halfa[2];
      slice.points[12] = halfa[3];
      slice.points[1] = halfb[0];
      slice.points[5] = halfb[1];
      slice.points[9] = halfb[2];
      slice.points[13] = halfb[3];
      slice.points[2] = halfc[0];
      slice.points[6] = halfc[1];
      slice.points[10] = halfc[2];
      slice.points[14] = halfc[3];
      slice.points[3] = halfd[0];
      slice.points[7] = halfd[1];
      slice.points[11] = halfd[2];
      slice.points[15] = halfd[3];
      slicecurrentfall -= 1;
      slice["fall"] *= t;
      const objnew = {
        "id": getnewid(),
        "wide": slice["wide"],
        "fall": Math.ceil((1 - t) * slice["fall"]),
        "type": "plane",
        "group-id": obj["group-id"],
        "points": [
          enda[0], endb[0], endc[0], endd[0],
          enda[1], endb[1], endc[1], endd[1],
          enda[2], endb[2], endc[2], endd[2],
          enda[3], endb[3], endc[3], endd[3]
        ]
      };
      draft.push(objnew);
      selectionmap[objnew.id] = [];
    }
    slice["fall"] = Math.ceil(slice["fall"]);
  }
  return selectionmap;
}
function repeattorange(repeat) {
  let sum = 0;
  for (const v of repeat) {
    sum += v;
  }
  const range = [];
  let p = 0;
  for (const v of repeat) {
    const slice = v / sum;
    range.push(slice + p);
    p += slice;
  }
  range.pop()
  return range;
}
function splitrange(obj, ts, widefall) {
  const range = repeattorange(ts);
  const newobjs = [];
  let prev;
  while (range.length) {
    const tpopped = range.pop();
    let t = tpopped;
    if (typeof prev != "undefined") {
      t *= (1/prev);
    }
    const objnew = splitobj(obj, t, widefall);
    newobjs.push(objnew);
    prev = tpopped;
  }
  return newobjs;
}
function splitobj(obj, t, widefall) {
  let objnew;
  if (widefall == "wide") {
    const [halfa, enda] = splitbezier(t, obj.points[0], obj.points[1], obj.points[2], obj.points[3]);
    const [halfb, endb] = splitbezier(t, obj.points[4], obj.points[5], obj.points[6], obj.points[7]);
    const [halfc, endc] = splitbezier(t, obj.points[8], obj.points[9], obj.points[10], obj.points[11]);
    const [halfd, endd] = splitbezier(t, obj.points[12], obj.points[13], obj.points[14], obj.points[15]);
    obj.points[0] = halfa[0];
    obj.points[1] = halfa[1];
    obj.points[2] = halfa[2];
    obj.points[3] = halfa[3];
    obj.points[4] = halfb[0];
    obj.points[5] = halfb[1];
    obj.points[6] = halfb[2];
    obj.points[7] = halfb[3];
    obj.points[8] = halfc[0];
    obj.points[9] = halfc[1];
    obj.points[10] = halfc[2];
    obj.points[11] = halfc[3];
    obj.points[12] = halfd[0];
    obj.points[13] = halfd[1];
    obj.points[14] = halfd[2];
    obj.points[15] = halfd[3];
    objnew = {
      "id": getnewid(),
      "wide": parseInt((1 - t) * obj["wide"]),
      "fall": obj["fall"],
      "type": "plane",
      "group-id": obj["group-id"],
      "points": [
        enda[0], enda[1], enda[2], enda[3],
        endb[0], endb[1], endb[2], endb[3],
        endc[0], endc[1], endc[2], endc[3],
        endd[0], endd[1], endd[2], endd[3]
      ]
    };
    obj["wide"] = parseInt(obj["wide"] * t);
  } else if (widefall == "fall") {
    const [halfa, enda] = splitbezier(t, obj.points[0], obj.points[4], obj.points[8], obj.points[12]);
    const [halfb, endb] = splitbezier(t, obj.points[1], obj.points[5], obj.points[9], obj.points[13]);
    const [halfc, endc] = splitbezier(t, obj.points[2], obj.points[6], obj.points[10], obj.points[14]);
    const [halfd, endd] = splitbezier(t, obj.points[3], obj.points[7], obj.points[11], obj.points[15]);
    obj.points[0] = halfa[0];
    obj.points[4] = halfa[1];
    obj.points[8] = halfa[2];
    obj.points[12] = halfa[3];
    obj.points[1] = halfb[0];
    obj.points[5] = halfb[1];
    obj.points[9] = halfb[2];
    obj.points[13] = halfb[3];
    obj.points[2] = halfc[0];
    obj.points[6] = halfc[1];
    obj.points[10] = halfc[2];
    obj.points[14] = halfc[3];
    obj.points[3] = halfd[0];
    obj.points[7] = halfd[1];
    obj.points[11] = halfd[2];
    obj.points[15] = halfd[3];
    objnew = {
      "id": getnewid(),
      "wide": obj["wide"],
      "fall": parseInt((1 - t) * obj["fall"]),
      "type": "plane",
      "group-id": obj["group-id"],
      "points": [
        enda[0], endb[0], endc[0], endd[0],
        enda[1], endb[1], endc[1], endd[1],
        enda[2], endb[2], endc[2], endd[2],
        enda[3], endb[3], endc[3], endd[3]
      ]
    };
    obj["fall"] = parseInt(obj["fall"] * t)
  }
  draft.push(objnew);
  return objnew;
}
function makegroup(objids, parent) {
  const newid = getnewid();
  draft.push({"id": newid, "type": "group", "group-id": parent, "visible": true});
  for (const selectedId of objids) {
    getobjbyid(selectedId)["group-id"] = newid;
  }
  return newid;
}
function deleteobj(objid) {
  const obj = getobjbyid(objid);
  const idsdelete = [objid];
  if (obj["type"] == "group") {
    idsdelete.push(...findgroupids(objid), ...findplaneids(objid));
  }
  for (let i = 0; i < draft.length; i++) {
    const obj = draft[i];
    if (obj["type"] == "fill") {
      if (idsdelete.includes(obj["object-id"])) {
        idsdelete.push(obj["id"]);
      }
    }
  }
  draft = draft.filter(function (obj) {
    return !idsdelete.includes(obj["id"]);
  });
  draft = draft.filter((obj) => {
    if (obj["type"] != "group") {
      return true;
    }
    return findplaneids(obj["id"]).length > 0;
  });
}
function create(center, parent) {
  const newid = getnewid();
  draft.push({
    "id": newid,
    "type": "plane",
    "group-id": parent, "tickness": 1,
    "wide": 18, "wide-start": -1, "wide-end": -1,
    "fall": 18, "fall-start": -1, "fall-end": -1,
    "points": [
      {"x": center["x"]-9, "y":center["y"]+9, "z": center["z"]},
      {"x": center["x"]-3, "y":center["y"]+9, "z": center["z"]},
      {"x": center["x"]+3, "y":center["y"]+9, "z": center["z"]},
      {"x": center["x"]+9, "y":center["y"]+9, "z": center["z"]},
      {"x": center["x"]-9, "y":center["y"]+3, "z": center["z"]},
      {"x": center["x"]-3, "y":center["y"]+3, "z": center["z"]},
      {"x": center["x"]+3, "y":center["y"]+3, "z": center["z"]},
      {"x": center["x"]+9, "y":center["y"]+3, "z": center["z"]},
      {"x": center["x"]-9, "y":center["y"]-3, "z": center["z"]},
      {"x": center["x"]-3, "y":center["y"]-3, "z": center["z"]},
      {"x": center["x"]+3, "y":center["y"]-3, "z": center["z"]},
      {"x": center["x"]+9, "y":center["y"]-3, "z": center["z"]},
      {"x": center["x"]-9, "y":center["y"]-9, "z": center["z"]},
      {"x": center["x"]-3, "y":center["y"]-9, "z": center["z"]},
      {"x": center["x"]+3, "y":center["y"]-9, "z": center["z"]},
      {"x": center["x"]+9, "y":center["y"]-9, "z": center["z"]}
    ]
  });
  return newid;
}
function paste() {
  selectionmap = {};
  const groupids = new Set();
  for (const objid of viewport["cut"]) {
    const obj = getobjbyid(objid);
    groupids.add(obj["group-id"]);
    obj["group-id"] = viewport["group-id"];
    selectionmap[objid] = [];
  }
  viewport["cut"] = [];
  for (const groupid of groupids) {
    if (draft.filter((obj) => VISIBLE_OBJ_TYPES.includes(obj["type"]) && obj["group-id"] == groupid).length == 0) {
      deleteobj(groupid);
    }
  }
}
function findrgb(objid) {
  for (const obj of draft) {
    if (obj["type"] == "fill" && obj["object-id"] == objid) {
      const rgb = getobjbyid(obj["rgb-id"]);
      return {r: rgb["r"], g: rgb["g"], b: rgb["b"]};
    }
  }
  return {r: 0, g: 0, b: 0};
}
function torgbstring(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
function objboundingbox(obj) {
  if (obj["type"] == "plane") {
    const bbox = {
      "min-x": undefined, "max-x": undefined,
      "min-y": undefined, "max-y": undefined,
      "min-z": undefined, "max-z": undefined,
    };
    for (const point of obj["points"]) {
      if (typeof bbox["min-x"] == "undefined" || point["x"] < bbox["min-x"]) {bbox["min-x"] = point["x"];}
      if (typeof bbox["max-x"] == "undefined" || point["x"] > bbox["max-x"]) {bbox["max-x"] = point["x"];}
      if (typeof bbox["min-y"] == "undefined" || point["y"] < bbox["min-y"]) {bbox["min-y"] = point["y"];}
      if (typeof bbox["max-y"] == "undefined" || point["y"] > bbox["max-y"]) {bbox["max-y"] = point["y"];}
      if (typeof bbox["min-z"] == "undefined" || point["z"] < bbox["min-z"]) {bbox["min-z"] = point["z"];}
      if (typeof bbox["max-z"] == "undefined" || point["z"] > bbox["max-z"]) {bbox["max-z"] = point["z"];}
    }
    const boundingbox = {
      "min-x": bbox["min-x"], "max-x": bbox["max-x"],
      "min-y": bbox["min-y"], "max-y": bbox["max-y"],
      "min-z": bbox["min-z"], "max-z": bbox["max-z"]
    };
    return boundingbox;
  }
}
function groupboundingbox(groupId) {
  let minx;
  let maxx;
  let miny;
  let maxy;
  let minz;
  let maxz;
  for (let i = 0; i < draft.length; i++) {
    const obj = draft[i];
    if (VISIBLE_OBJ_TYPES.includes(obj["type"]) && obj["group-id"] == groupId) {
      let boundingbox;
      if (obj["type"] == "group") {
        boundingbox = groupboundingbox(obj["id"]);
      } else {
        boundingbox = objboundingbox(obj);
      }
      if (typeof minx == "undefined" || boundingbox["min-x"] < minx) {
        minx = boundingbox["min-x"];
      }
      if (typeof maxx == "undefined" || boundingbox["max-x"] > maxx) {
        maxx = boundingbox["max-x"];
      }
      if (typeof miny == "undefined" || boundingbox["min-y"] < miny) {
        miny = boundingbox["min-y"];
      }
      if (typeof maxy == "undefined" || boundingbox["max-y"] > maxy) {
        maxy = boundingbox["max-y"];
      }
      if (typeof minz == "undefined" || boundingbox["min-z"] < minz) {
        minz = boundingbox["min-z"];
      }
      if (typeof maxz == "undefined" || boundingbox["max-z"] > maxz) {
        maxz = boundingbox["max-z"];
      }
    }
  }
  return {
    "min-x": minx, "max-x": maxx,
    "min-y": miny, "max-y": maxy,
    "min-z": minz, "max-z": maxz
  };
}
function objorigin(obj) {
  const boundingbox = obj["type"] == "group" ? groupboundingbox(obj["id"]): objboundingbox(obj);
  return boundingboxorigin(boundingbox);
}