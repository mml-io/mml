import convert from "convert-units";

type Category = {
  name: string;
  from: string;
  to: string;
  values: number[];
};

const categories: Category[] = [
  { name: "Length", from: "m", to: "ft", values: [1, 5, 10, 100] },
  { name: "Mass", from: "kg", to: "lb", values: [1, 5, 25, 100] },
  { name: "Temperature", from: "C", to: "F", values: [0, 20, 37, 100] },
];

const PANEL_WIDTH = 8;
const ROW_HEIGHT = 0.6;
const TITLE_HEIGHT = 0.8;
const DESC_HEIGHT = 0.6;
const GAP = 0.05;

// Calculate total panel height so we can position the bottom at y=0
const totalRows = categories.length + categories.reduce((sum, c) => sum + c.values.length, 0);
const panelHeight =
  TITLE_HEIGHT + GAP + DESC_HEIGHT + GAP + totalRows * ROW_HEIGHT + (totalRows - 1) * GAP;

// Position so that the top of the title is at panelHeight and the bottom of the last row is at 0
const PANEL_Y = panelHeight - TITLE_HEIGHT / 2;

// Lighting
const light = document.createElement("m-light");
light.setAttribute("type", "point");
light.setAttribute("intensity", "600");
light.setAttribute("x", "5");
light.setAttribute("y", "8");
light.setAttribute("z", "8");
document.body.appendChild(light);

// Title
const title = document.createElement("m-label");
title.setAttribute("content", "Unit Converter");
title.setAttribute("width", String(PANEL_WIDTH));
title.setAttribute("height", String(TITLE_HEIGHT));
title.setAttribute("alignment", "center");
title.setAttribute("font-size", "50");
title.setAttribute("color", "#1a1a2e");
title.setAttribute("font-color", "white");
title.setAttribute("x", "0");
title.setAttribute("y", String(PANEL_Y));
document.body.appendChild(title);

// Description
const desc = document.createElement("m-label");
desc.setAttribute(
  "content",
  "Bundled TypeScript example using the convert-units npm package. Click a row to swap units.",
);
desc.setAttribute("width", String(PANEL_WIDTH));
desc.setAttribute("height", String(DESC_HEIGHT));
desc.setAttribute("alignment", "center");
desc.setAttribute("font-size", "20");
desc.setAttribute("color", "#16213e");
desc.setAttribute("font-color", "#aaaaaa");
desc.setAttribute("x", "0");
desc.setAttribute("y", String(PANEL_Y - TITLE_HEIGHT / 2 - GAP - DESC_HEIGHT / 2));
document.body.appendChild(desc);

let yOffset = PANEL_Y - TITLE_HEIGHT / 2 - GAP - DESC_HEIGHT - GAP - ROW_HEIGHT / 2;

for (const category of categories) {
  // Category header
  const header = document.createElement("m-label");
  header.setAttribute("content", category.name);
  header.setAttribute("width", String(PANEL_WIDTH));
  header.setAttribute("height", String(ROW_HEIGHT));
  header.setAttribute("alignment", "center");
  header.setAttribute("font-size", "28");
  header.setAttribute("color", "#0f3460");
  header.setAttribute("font-color", "#e0e0e0");
  header.setAttribute("x", "0");
  header.setAttribute("y", String(yOffset));
  document.body.appendChild(header);
  yOffset -= ROW_HEIGHT + GAP;

  // Conversion rows
  for (const value of category.values) {
    let fromUnit = category.from;
    let toUnit = category.to;
    let swapped = false;

    const label = document.createElement("m-label");

    function updateContent() {
      const converted = convert(value).from(fromUnit).to(toUnit);
      label.setAttribute("content", `${value} ${fromUnit}  =  ${converted.toFixed(2)} ${toUnit}`);
    }

    updateContent();
    label.setAttribute("width", String(PANEL_WIDTH));
    label.setAttribute("height", String(ROW_HEIGHT));
    label.setAttribute("alignment", "center");
    label.setAttribute("font-size", "24");
    label.setAttribute("color", "#1a1a2e");
    label.setAttribute("font-color", "white");
    label.setAttribute("x", "0");
    label.setAttribute("y", String(yOffset));

    label.addEventListener("click", () => {
      swapped = !swapped;
      if (swapped) {
        fromUnit = category.to;
        toUnit = category.from;
      } else {
        fromUnit = category.from;
        toUnit = category.to;
      }
      updateContent();
    });

    document.body.appendChild(label);
    yOffset -= ROW_HEIGHT + GAP;
  }
}
