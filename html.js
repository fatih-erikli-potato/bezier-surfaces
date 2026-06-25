function text(text) {
  return document.createTextNode(text);
}
function span(classname) {
  const spanelement = document.createElement("span");
  if (typeof classname != "undefined") {
    spanelement.classList.add(classname);
  }
  return spanelement;
}
function div(classname) {
  const divelement = document.createElement("div");
  if (typeof classname != "undefined") {
    if (classname.startsWith("#")) {
      divelement.setAttribute("id", classname.slice(1));
    } else {
      divelement.classList.add(classname);
    }
  }
  return divelement;
}
function a(label, href, onclick) {
  const el = document.createElement("a");
  el.setAttribute("href", href);
  el.appendChild(text(label));
  el.addEventListener("click", (event) => {
    event.preventDefault();
    let step;
    if (event.shiftKey && event.metaKey) {
      step = 90;
    } else if (event.shiftKey) {
      step = 10;
    } else {
      step = 1;
    }
    onclick(step);
  });
  return el;
}