type EnvMap = {
  name: string;
  url: string;
};

import puresky from "./puresky_2k.jpg";

export const envMaps: {
  [key: string]: EnvMap;
} = {
  puresky: {
    name: "Pure Sky",
    url: puresky,
  },
};
