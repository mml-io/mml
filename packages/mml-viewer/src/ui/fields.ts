import { FieldDefinition, GroupDefinition } from "./FieldDefinition";

export const sourceGroup: GroupDefinition = {
  name: "source",
  label: "Source",
};

export const rendererGroup: GroupDefinition = {
  name: "renderer",
  label: "Renderer",
};

export const environmentGroup: GroupDefinition = {
  name: "environment",
  label: "Environment",
};

export const cameraGroup: GroupDefinition = {
  name: "camera",
  label: "Camera",
};

export const lightGroup: GroupDefinition = {
  name: "light",
  label: "Light",
};

export const characterGroup: GroupDefinition = {
  name: "character",
  label: "Character",
};

export const loadingGroup: GroupDefinition = {
  name: "loading",
  label: "Loading",
};

export const developerGroup: GroupDefinition = {
  name: "developer",
  label: "Developer",
};

export const allGroups = [
  sourceGroup,
  rendererGroup,
  cameraGroup,
  lightGroup,
  environmentGroup,
  characterGroup,
  loadingGroup,
  developerGroup,
];

export const cameraModeField: FieldDefinition = {
  name: "cameraMode",
  label: "Camera Mode",
  type: "string",
  options: ["orbit", "drag-fly", "none"],
  defaultValue: "drag-fly",
  groupDefinition: cameraGroup,
};

export const cameraOrbitSpeedField: FieldDefinition = {
  name: "cameraOrbitSpeed",
  label: "Camera Orbit Speed (degrees per second)",
  type: "number",
  defaultValue: 10,
  groupDefinition: cameraGroup,
};

export const cameraOrbitDistanceField: FieldDefinition = {
  name: "cameraOrbitDistance",
  label: "Camera Orbit Distance",
  type: "number",
  defaultValue: 10,
  groupDefinition: cameraGroup,
};

export const cameraOrbitPitchField: FieldDefinition = {
  name: "cameraOrbitPitch",
  label: "Camera Orbit Pitch",
  type: "number",
  defaultValue: 60,
  groupDefinition: cameraGroup,
};

export const cameraFitContents: FieldDefinition = {
  name: "cameraFitContents",
  label: "Camera Fit Contents",
  type: "string",
  options: ["true", "false"],
  defaultValue: "false",
  groupDefinition: cameraGroup,
};

export const cameraLookAtField: FieldDefinition = {
  name: "cameraLookAt",
  label: "Camera Look At",
  type: "x,y,z",
  defaultValue: "0,0,0",
  groupDefinition: cameraGroup,
};

export const cameraPositionField: FieldDefinition = {
  name: "cameraPosition",
  label: "Camera Position",
  type: "x,y,z",
  defaultValue: "0,5,10",
  groupDefinition: cameraGroup,
};

export const cameraFovField: FieldDefinition = {
  name: "cameraFov",
  label: "Camera FOV",
  type: "number",
  defaultValue: 75,
  groupDefinition: cameraGroup,
};

export const urlField: FieldDefinition = {
  name: "url",
  label: "URL",
  type: "string",
  defaultValue: "",
  requireSubmission: true,
  groupDefinition: sourceGroup,
};

export const loadingStyleField: FieldDefinition = {
  name: "loadingStyle",
  label: "Loading Style",
  type: "string",
  options: ["bar", "spinner"],
  defaultValue: "bar",
  groupDefinition: loadingGroup,
};

export const hideUntilLoadedField: FieldDefinition = {
  name: "hideUntilLoaded",
  label: "Hide Until Loaded",
  type: "boolean",
  defaultValue: false,
  groupDefinition: loadingGroup,
};

export const rendererField: FieldDefinition = {
  name: "renderer",
  label: "Renderer",
  type: "string",
  options: ["threejs", "playcanvas", "tags"],
  defaultValue: "threejs",
  groupDefinition: rendererGroup,
};

export const backgroundColorField: FieldDefinition = {
  name: "backgroundColor",
  label: "Background Color",
  type: "color",
  defaultValue: "rgba(255, 255, 255, 0)",
  groupDefinition: rendererGroup,
};

export const environmentMapField: FieldDefinition = {
  name: "environmentMap",
  label: "Environment Map",
  type: "string",
  defaultValue: "",
  requireSubmission: true,
  groupDefinition: environmentGroup,
};

export const ambientLightField: FieldDefinition = {
  name: "ambientLight",
  label: "Ambient Light",
  type: "number",
  defaultValue: 0,
  groupDefinition: lightGroup,
};

export const ambientLightColorField: FieldDefinition = {
  name: "ambientLightColor",
  label: "Ambient Light Color",
  type: "color",
  defaultValue: "white",
  groupDefinition: lightGroup,
};

export const characterAnimationField: FieldDefinition = {
  name: "charAnim",
  label: "m-character Animation",
  type: "string",
  defaultValue: "",
  groupDefinition: characterGroup,
};

export const allFields = [
  characterAnimationField,
  cameraModeField,
  cameraFitContents,
  cameraLookAtField,
  cameraOrbitDistanceField,
  cameraOrbitPitchField,
  cameraOrbitSpeedField,
  cameraPositionField,
  cameraFovField,
  environmentMapField,
  urlField,
  loadingStyleField,
  rendererField,
  backgroundColorField,
  ambientLightField,
  ambientLightColorField,
];
