// src/env-maps/puresky_2k.jpg
var puresky_2k_default = "./puresky_2k-WS2HEI54.jpg";

// src/env-maps/index.ts
var envMaps = {
  puresky: {
    name: "Pure Sky",
    url: puresky_2k_default
  }
};

// src/parseXYZ.ts
function parseXYZ(str) {
  const asNumbers = str.split(",").slice(0, 3).map(parseFloat).map((v) => isNaN(v) ? 0 : v);
  return [asNumbers[0] || 0, asNumbers[1] || 0, asNumbers[2] || 0];
}

export {
  envMaps,
  parseXYZ
};
//# sourceMappingURL=chunk-XAJMD57L.js.map
