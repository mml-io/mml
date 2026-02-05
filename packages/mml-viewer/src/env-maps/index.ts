type EnvMap = {
  name: string;
  url: string;
};

import cloudysky from "./cloudysky_2k.jpg";

export const envMaps: {
  [key: string]: EnvMap;
} = {
  cloudysky: {
    name: "Cloudy Sky",
    url: cloudysky,
  },
};
