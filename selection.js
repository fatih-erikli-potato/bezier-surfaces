function getselectedobjids() {
  return Object.keys(selectionmap).map(idstr => Number(idstr));
}
function hasselection() {
  return Object.keys(selectionmap).length > 0;
}
function selectwhole() {
  const selectedobjids = getselectedobjids();
  selectionmap = {};
  for (const objid of selectedobjids) {
    const obj = getobjbyid(objid);
    if (obj["type"] == "plane") {
      selectionmap[objid] = objpointindexes(obj);
    }
  }
}
function deselectpoints() {
  for (const key in selectionmap) {
    selectionmap[key] = [];
  }
}
function allplane(selectedobjids) {
  return selectedobjids.every((objid) => getobjbyid(objid)["type"] == "plane");
}
function selectobjs(selectmode, objids) {
  switch (selectmode) {
    case "new": {
      selectionmap = {};
      for (const objid of objids) {
        selectionmap[objid] = [];
      }
      break;
    }
    case "add": {
      for (const objid of objids) {
        if (objid in selectionmap) {
        } else {
          selectionmap[objid] = [];
        }
      }
      break;
    }
    case "del": {
      for (const objid of objids) {
        if (objid in selectionmap) {
          delete selectionmap[objid];
        }
      }
      break;
    }
  }
}
function selectall(groupid) {
  const objids = [];
  selectionmap = {};
  for (const obj of draft) {
    if (VISIBLE_OBJ_TYPES.includes(obj["type"]) && obj["group-id"] == groupid) {
      objids.push(obj["id"]);
    }
  }
  for (const objid of objids) {
    selectionmap[objid] = [];
  }
}
function selectallpointindexes(groupid) {
  const planeids = findgroupobjids(groupid);
  for (const planeid of planeids) {
    const plane = getobjbyid(planeid);
    selectionmap[planeid] = objpointindexes(plane);
  }
}
function haspointselection() {
  for (const key in selectionmap) {
    if (selectionmap[key].length > 0) {
      return true;
    }
  }
  return false;
}
function toggleselection(objid, pointindex) {
  const selectedobjids = getselectedobjids();
  if (selectedobjids.includes(objid)) {
    togglearrayelement(selectionmap[objid], pointindex);
    if (selectionmap[objid].length == 0) {
      delete selectionmap[objid];
    }
  } else {
    selectionmap[objid] = [pointindex];
  }
}
function addtoselection(objid, pointindex) {
  const selectedobjids = getselectedobjids();
  if (selectedobjids.includes(objid)) {
    if (selectionmap[objid].includes(pointindex)) {
    } else {
      selectionmap[objid].push(pointindex);
    }
  } else {
    selectionmap[objid] = [pointindex];
  }
}
function deleteselection(objid, pointindex) {
  const selectedobjids = getselectedobjids();
  if (selectedobjids.includes(objid)) {
    if (selectionmap[objid].includes(pointindex)) {
      deletearrayelement(selectionmap[objid], pointindex);
    }
    if (selectionmap[objid].length == 0) {
      delete selectionmap[objid];
    }
  }
}