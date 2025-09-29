import blockTowerMML from "./block-tower.html";

export const blockTower = {
  name: "Block Tower",
  description: "Simple scene a tower of blocks and physics",
  content: {
    "scene.mml": blockTowerMML,
  },
  systems: [
    {
      name: "physics",
      config: {
        gravity: 9.81,
      },
    },
  ],
};
