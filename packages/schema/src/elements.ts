/**
 * MML Element Schema Definitions
 *
 * This file defines the schema for all MML elements.
 * It is the source of truth for generating XSD, markdown docs, and JSON schema.
 */

import { builtinAttributeGroups, ElementSchema, SchemaRegistry } from "./elementSchema";

// ============================================================================
// Geometry Elements
// ============================================================================

/**
 * m-cube - A 3D cube primitive with configurable dimensions.
 * @element m-cube
 */
export const cubeSchema: ElementSchema = {
  tagName: "m-cube",
  description: "A 3D cube primitive with configurable dimensions.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    width: {
      type: "number",
      default: "1",
      description: "Width of the cube in meters along the X-axis.",
      animatable: true,
    },
    height: {
      type: "number",
      default: "1",
      description: "Height of the cube in meters along the Y-axis.",
      animatable: true,
    },
    depth: {
      type: "number",
      default: "1",
      description: "Depth of the cube in meters along the Z-axis.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the cube. Supports CSS color values.",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the cube, from 0 (transparent) to 1 (opaque).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Basic cube",
      description: "A simple red cube",
      code: '<m-cube width="2" height="2" depth="2" color="red"/>',
    },
    {
      title: "Physics-enabled cube",
      description: "A cube that responds to physics",
      code: '<m-cube collide="true" width="1" height="1" depth="1"/>',
    },
  ],
};

/**
 * m-sphere - A 3D sphere primitive.
 * @element m-sphere
 */
export const sphereSchema: ElementSchema = {
  tagName: "m-sphere",
  description: "A 3D sphere primitive with configurable radius.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    radius: {
      type: "number",
      default: "0.5",
      description: "The radius of the sphere in meters.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the sphere. Supports CSS color values.",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the sphere, from 0 (transparent) to 1 (opaque).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Basic sphere",
      code: '<m-sphere radius="1" color="blue"/>',
    },
  ],
};

/**
 * m-cylinder - A 3D cylinder primitive.
 * @element m-cylinder
 */
export const cylinderSchema: ElementSchema = {
  tagName: "m-cylinder",
  description: "A 3D cylinder primitive with configurable radius and height.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    radius: {
      type: "number",
      default: "0.5",
      description: "The radius of the cylinder in meters.",
      animatable: true,
    },
    height: {
      type: "number",
      default: "1",
      description: "The height of the cylinder in meters.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the cylinder. Supports CSS color values.",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the cylinder, from 0 (transparent) to 1 (opaque).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Basic cylinder",
      code: '<m-cylinder radius="0.5" height="2" color="green"/>',
    },
  ],
};

/**
 * m-capsule - A 3D capsule primitive (cylinder with hemispherical caps).
 * @element m-capsule
 */
export const capsuleSchema: ElementSchema = {
  tagName: "m-capsule",
  description:
    "A 3D capsule primitive consisting of a cylinder with hemispherical caps at each end.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    radius: {
      type: "number",
      default: "0.5",
      description: "The radius of the capsule in meters.",
      animatable: true,
    },
    height: {
      type: "number",
      default: "1",
      description: "The total height of the capsule in meters, including the hemispherical caps.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the capsule. Supports CSS color values.",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the capsule, from 0 (transparent) to 1 (opaque).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Player capsule",
      description: "A capsule commonly used for player collision",
      code: '<m-capsule id="player" radius="0.35" height="1.8" y="0.9"/>',
    },
  ],
};

/**
 * m-plane - A flat rectangular 3D plane.
 * @element m-plane
 */
export const planeSchema: ElementSchema = {
  tagName: "m-plane",
  description: "A flat rectangular 3D plane, useful for floors, walls, and surfaces.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    width: {
      type: "number",
      default: "1",
      description: "The width of the plane in meters.",
      animatable: true,
    },
    height: {
      type: "number",
      default: "1",
      description: "The height of the plane in meters.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the plane. Supports CSS color values.",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the plane, from 0 (transparent) to 1 (opaque).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Floor plane",
      code: '<m-plane width="20" height="20" rx="-90" color="gray"/>',
    },
  ],
};

// ============================================================================
// Composite Elements
// ============================================================================

/**
 * m-group - A container element for grouping child elements.
 * @element m-group
 */
export const groupSchema: ElementSchema = {
  tagName: "m-group",
  description:
    "A container element for grouping child elements. Transformations applied to the group affect all children.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {},
  examples: [
    {
      title: "Grouped objects",
      description: "Group multiple objects that move together",
      code: `<m-group x="5" ry="45">
  <m-cube y="0.5"/>
  <m-sphere y="1.5"/>
</m-group>`,
    },
  ],
};

/**
 * m-model - Load and display a 3D model file.
 * @element m-model
 */
export const modelSchema: ElementSchema = {
  tagName: "m-model",
  description:
    "Loads and displays a 3D model file (GLTF/GLB format). Supports animations and states.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    src: {
      type: "uri",
      description: "The URL of the 3D model file to load. Supports .glb and .gltf formats.",
    },
    anim: {
      type: "string",
      description: "The name of the animation to play from the model.",
    },
    "anim-enabled": {
      type: "boolean",
      default: "true",
      description: "Whether the animation is enabled.",
    },
    "anim-loop": {
      type: "boolean",
      default: "true",
      description: "Whether the animation should loop.",
    },
    "anim-start-time": {
      type: "number",
      default: "0",
      description:
        "The document time (in milliseconds) at which the animation should start playing.",
    },
    "anim-pause-time": {
      type: "number",
      description: "The document time at which to pause the animation.",
    },
    state: {
      type: "string",
      description: "The named state of the model (for multi-state models).",
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization for the model (skeleton, bounds).",
    },
  },
  examples: [
    {
      title: "Load a model",
      code: '<m-model src="./assets/robot.glb"/>',
    },
    {
      title: "Animated model",
      code: '<m-model src="./assets/character.glb" anim="walk" anim-loop="true"/>',
    },
  ],
};

/**
 * m-character - An animated humanoid character with bone structure.
 * @element m-character
 */
export const characterSchema: ElementSchema = {
  tagName: "m-character",
  description:
    "An animated humanoid character element. Supports skeletal animation and character-specific features.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    src: {
      type: "uri",
      description: "The URL of the character model file to load.",
    },
    anim: {
      type: "string",
      description: "The name of the animation to play.",
    },
    "anim-enabled": {
      type: "boolean",
      default: "true",
      description: "Whether the animation is enabled.",
    },
    "anim-loop": {
      type: "boolean",
      default: "true",
      description: "Whether the animation should loop.",
    },
  },
  examples: [
    {
      title: "Character with animation",
      code: '<m-character src="./assets/avatar.glb" anim="idle"/>',
    },
  ],
};

/**
 * m-frame - An embedded MML document frame.
 * @element m-frame
 */
export const frameSchema: ElementSchema = {
  tagName: "m-frame",
  description:
    "Embeds another MML document within the current document, similar to an HTML iframe.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    src: {
      type: "uri",
      description: "The URL of the MML document to embed.",
    },
    "min-x": {
      type: "number",
      description: "Minimum X boundary for the embedded content.",
    },
    "max-x": {
      type: "number",
      description: "Maximum X boundary for the embedded content.",
    },
    "min-y": {
      type: "number",
      description: "Minimum Y boundary for the embedded content.",
    },
    "max-y": {
      type: "number",
      description: "Maximum Y boundary for the embedded content.",
    },
    "min-z": {
      type: "number",
      description: "Minimum Z boundary for the embedded content.",
    },
    "max-z": {
      type: "number",
      description: "Maximum Z boundary for the embedded content.",
    },
  },
  examples: [
    {
      title: "Embed another MML document",
      code: '<m-frame src="./room.html"/>',
    },
  ],
};

/**
 * m-remote-document - A remote document host element.
 * @element m-remote-document
 */
export const remoteDocumentSchema: ElementSchema = {
  tagName: "m-remote-document",
  description:
    "Hosts a remote MML document within the scene. Typically created by the runtime when loading remote content.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {},
  examples: [],
};

// ============================================================================
// Media Elements
// ============================================================================

/**
 * m-audio - An audio source element.
 * @element m-audio
 */
export const audioSchema: ElementSchema = {
  tagName: "m-audio",
  description: "An audio source that plays sound in 3D space with spatial audio support.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    src: {
      type: "uri",
      description: "The URL of the audio file to play.",
    },
    volume: {
      type: "number",
      default: "1",
      description: "The volume of the audio, from 0 (silent) to 1 (full volume).",
      animatable: true,
    },
    loop: {
      type: "boolean",
      default: "false",
      description: "Whether the audio should loop when it reaches the end.",
    },
    enabled: {
      type: "boolean",
      default: "true",
      description: "Whether the audio is enabled and should play.",
    },
    "start-time": {
      type: "number",
      default: "0",
      description: "The document time at which the audio should start playing.",
    },
    "pause-time": {
      type: "number",
      description: "The document time at which to pause the audio.",
    },
    "cone-angle": {
      type: "number",
      description: "The angle of the audio cone for directional sound.",
    },
    "cone-falloff-angle": {
      type: "number",
      description: "The falloff angle outside the cone.",
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization for the audio source.",
    },
  },
  examples: [
    {
      title: "Background music",
      code: '<m-audio src="./assets/music.mp3" loop="true" volume="0.5"/>',
    },
  ],
};

/**
 * m-image - A 2D image displayed in 3D space.
 * @element m-image
 */
export const imageSchema: ElementSchema = {
  tagName: "m-image",
  description: "Displays a 2D image in 3D space as a textured plane.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    src: {
      type: "uri",
      description: "The URL of the image file to display.",
    },
    width: {
      type: "number",
      description: "The width of the image plane in meters. If not set, uses aspect ratio.",
      animatable: true,
    },
    height: {
      type: "number",
      description: "The height of the image plane in meters. If not set, uses aspect ratio.",
      animatable: true,
    },
    opacity: {
      type: "number",
      default: "1",
      description: "The opacity of the image, from 0 (transparent) to 1 (opaque).",
      animatable: true,
    },
    emissive: {
      type: "number",
      default: "0",
      description: "The emissive intensity of the image (makes it glow).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Display an image",
      code: '<m-image src="./assets/poster.png" width="2" height="3"/>',
    },
  ],
};

/**
 * m-video - A video player displayed in 3D space.
 * @element m-video
 */
export const videoSchema: ElementSchema = {
  tagName: "m-video",
  description: "Plays video content on a plane in 3D space.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    src: {
      type: "uri",
      description: "The URL of the video file to play.",
    },
    width: {
      type: "number",
      description: "The width of the video plane in meters.",
      animatable: true,
    },
    height: {
      type: "number",
      description: "The height of the video plane in meters.",
      animatable: true,
    },
    loop: {
      type: "boolean",
      default: "false",
      description: "Whether the video should loop.",
    },
    enabled: {
      type: "boolean",
      default: "true",
      description: "Whether the video is enabled and should play.",
    },
    volume: {
      type: "number",
      default: "1",
      description: "The audio volume of the video, from 0 to 1.",
      animatable: true,
    },
    "start-time": {
      type: "number",
      default: "0",
      description: "The document time at which the video should start playing.",
    },
    "pause-time": {
      type: "number",
      description: "The document time at which to pause the video.",
    },
  },
  examples: [
    {
      title: "Video player",
      code: '<m-video src="./assets/intro.mp4" width="16" height="9" loop="true"/>',
    },
  ],
};

/**
 * m-label - A 3D text label.
 * @element m-label
 */
export const labelSchema: ElementSchema = {
  tagName: "m-label",
  description: "Displays text as a 3D label on a rectangular background.",
  attributeGroups: ["coreattrs", "transformable", "collideable", "clickable", "shadows"],
  attributes: {
    content: {
      type: "string",
      default: "",
      description: "The text content to display.",
    },
    alignment: {
      type: "enum",
      default: "left",
      enumValues: ["left", "center", "right"],
      description: "The horizontal alignment of the text.",
    },
    width: {
      type: "number",
      default: "1",
      description: "The width of the label background in meters.",
      animatable: true,
    },
    height: {
      type: "number",
      default: "1",
      description: "The height of the label background in meters.",
      animatable: true,
    },
    "font-size": {
      type: "number",
      default: "24",
      description: "The font size in pixels.",
      animatable: true,
    },
    padding: {
      type: "number",
      default: "8",
      description: "The padding around the text in pixels.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The background color of the label.",
      animatable: true,
    },
    "font-color": {
      type: "color",
      default: "black",
      description: "The color of the text.",
      animatable: true,
    },
    emissive: {
      type: "number",
      default: "0",
      description: "The emissive intensity (makes the label glow).",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Simple label",
      code: '<m-label content="Hello World" font-size="32" color="blue" font-color="white"/>',
    },
  ],
};

// ============================================================================
// Lighting Elements
// ============================================================================

/**
 * m-light - A light source element.
 * @element m-light
 */
export const lightSchema: ElementSchema = {
  tagName: "m-light",
  description:
    "A light source that illuminates the scene. Supports spotlight and point light types.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    type: {
      type: "enum",
      default: "spotlight",
      enumValues: ["spotlight", "point"],
      description: "The type of light: spotlight (directional cone) or point (omnidirectional).",
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the light.",
      animatable: true,
    },
    intensity: {
      type: "number",
      default: "1",
      description: "The intensity of the light.",
      animatable: true,
    },
    angle: {
      type: "number",
      default: "45",
      description: "The angle of the spotlight cone in degrees (spotlight only).",
      animatable: true,
    },
    distance: {
      type: "number",
      description:
        "The maximum distance the light reaches. If not set, the light has infinite range.",
      animatable: true,
    },
    enabled: {
      type: "boolean",
      default: "true",
      description: "Whether the light is enabled.",
    },
    "cast-shadows": {
      type: "boolean",
      default: "true",
      description: "Whether this light casts shadows.",
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization for the light.",
    },
  },
  examples: [
    {
      title: "Spotlight",
      code: '<m-light type="spotlight" intensity="2" angle="30" y="5" rx="-90"/>',
    },
    {
      title: "Point light",
      code: '<m-light type="point" color="orange" intensity="1.5" y="2"/>',
    },
  ],
};

// ============================================================================
// Interaction Elements
// ============================================================================

/**
 * m-interaction - Detects user proximity and interaction.
 * @element m-interaction
 */
export const interactionSchema: ElementSchema = {
  tagName: "m-interaction",
  description:
    "Detects when users are within a specified range and can interact with an interaction prompt.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    range: {
      type: "number",
      default: "5",
      description: "The interaction range in meters.",
    },
    "in-focus": {
      type: "boolean",
      default: "false",
      description: "Whether the user is currently looking at this interaction.",
    },
    priority: {
      type: "number",
      default: "0",
      description: "The priority when multiple interactions are in range.",
    },
    prompt: {
      type: "string",
      description: 'The prompt text to display (e.g., "Press E to interact").',
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization for the interaction range.",
    },
  },
  examples: [
    {
      title: "Interaction trigger",
      code: '<m-interaction range="3" prompt="Press E to open"/>',
    },
  ],
};

/**
 * m-position-probe - Detects user positions within an area.
 * @element m-position-probe
 */
export const positionProbeSchema: ElementSchema = {
  tagName: "m-position-probe",
  description: "Detects when users enter, move within, or leave a defined area.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    range: {
      type: "number",
      default: "10",
      description: "The detection range in meters.",
    },
    interval: {
      type: "number",
      default: "100",
      description: "The minimum interval in milliseconds between position events.",
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization for the probe area.",
    },
  },
  examples: [
    {
      title: "Position tracking",
      code: '<m-position-probe range="5" interval="500"/>',
    },
  ],
};

/**
 * m-chat-probe - Captures chat messages from users.
 * @element m-chat-probe
 */
export const chatProbeSchema: ElementSchema = {
  tagName: "m-chat-probe",
  description: "Captures chat messages from users within a specified range.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    range: {
      type: "number",
      default: "10",
      description: "The range within which to capture chat messages.",
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization for the probe range.",
    },
  },
  examples: [
    {
      title: "Chat listener",
      code: '<m-chat-probe range="15"/>',
    },
  ],
};

/**
 * m-prompt - A user input prompt.
 * @element m-prompt
 */
export const promptSchema: ElementSchema = {
  tagName: "m-prompt",
  description: "Displays a prompt that allows users to input text.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    message: {
      type: "string",
      description: "The prompt message to display to the user.",
    },
    placeholder: {
      type: "string",
      description: "Placeholder text for the input field.",
    },
    "prefill-value": {
      type: "string",
      description: "Pre-filled value for the input field.",
    },
    debug: {
      type: "boolean",
      default: "false",
      description: "Enable debug visualization.",
    },
  },
  examples: [
    {
      title: "Name input prompt",
      code: '<m-prompt message="Enter your name:" placeholder="Your name"/>',
    },
  ],
};

/**
 * m-link - A navigation link to another location or URL.
 * @element m-link
 */
export const linkSchema: ElementSchema = {
  tagName: "m-link",
  description: "A link that navigates users to another location or URL when activated.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    href: {
      type: "uri",
      description: "The destination URL or location.",
    },
  },
  examples: [
    {
      title: "Navigation link",
      code: '<m-link href="https://example.com"/>',
    },
  ],
};

/**
 * m-mouse-behavior - Control mouse pointer behavior.
 * @element m-mouse-behavior
 */
export const mouseBehaviorSchema: ElementSchema = {
  tagName: "m-mouse-behavior",
  description:
    "Controls pointer lock behavior for the scene, enabling locked or unlocked mouse modes.",
  attributeGroups: ["coreattrs"],
  attributes: {
    mode: {
      type: "enum",
      default: "unlocked",
      enumValues: ["unlocked", "locked"],
      description: "Pointer mode: unlocked for normal cursor, locked for pointer lock.",
    },
  },
  examples: [
    {
      title: "Enable pointer lock",
      code: '<m-mouse-behavior mode="locked"/>',
    },
  ],
};

// ============================================================================
// Animation Elements
// ============================================================================

/**
 * m-animation - A weighted animation clip for models/characters.
 * @element m-animation
 */
export const animationSchema: ElementSchema = {
  tagName: "m-animation",
  description:
    "A weighted animation clip for m-model or m-character elements. Multiple animations can be mixed together using weight or state.",
  attributeGroups: ["coreattrs"],
  attributes: {
    src: {
      type: "uri",
      description: "The source URI of the animation file to load.",
    },
    state: {
      type: "string",
      description:
        "Optional state name to match against the parent model/character state for automatic weighting.",
    },
    weight: {
      type: "number",
      description:
        "Blend weight for this animation. If omitted, the effective weight is derived from the state/parent state.",
    },
    loop: {
      type: "boolean",
      default: "true",
      description: "Whether the animation should loop.",
    },
    "start-time": {
      type: "number",
      default: "0",
      description: "The document time (ms) at which the animation should start.",
    },
    "pause-time": {
      type: "number",
      description: "The document time (ms) at which to pause the animation.",
    },
    speed: {
      type: "number",
      default: "1",
      description: "Playback speed multiplier.",
    },
    ratio: {
      type: "number",
      description: "Optional playback ratio (0-1) to scrub the animation.",
    },
  },
  examples: [
    {
      title: "State-based animation mixing",
      code: `<m-model src="./assets/character.glb" state="idle">
  <m-animation src="./assets/anim_idle.glb" state="idle"/>
  <m-animation src="./assets/anim_run.glb" state="run"/>
</m-model>`,
    },
  ],
};

/**
 * m-attr-anim - Animates an attribute over time.
 * @element m-attr-anim
 */
export const attrAnimSchema: ElementSchema = {
  tagName: "m-attr-anim",
  description: "Animates a parent element attribute over time between start and end values.",
  attributeGroups: ["coreattrs"],
  attributes: {
    attr: {
      type: "string",
      description: "The name of the attribute to animate on the parent element.",
    },
    start: {
      type: "string",
      description: "The starting value of the animation.",
    },
    end: {
      type: "string",
      description: "The ending value of the animation.",
    },
    duration: {
      type: "number",
      default: "1000",
      description: "The duration of the animation in milliseconds.",
    },
    loop: {
      type: "boolean",
      default: "true",
      description: "Whether the animation should loop.",
    },
    "ping-pong": {
      type: "boolean",
      default: "false",
      description: "Whether the animation should reverse direction at each end.",
    },
    easing: {
      type: "enum",
      default: "linear",
      enumValues: ["linear", "easeInQuad", "easeOutQuad", "easeInOutQuad"],
      description: "The easing function for the animation.",
    },
    "start-time": {
      type: "number",
      description: "The document time at which to start the animation.",
    },
    "pause-time": {
      type: "number",
      description: "The document time at which to pause the animation.",
    },
  },
  examples: [
    {
      title: "Rotating cube",
      code: `<m-cube>
  <m-attr-anim attr="ry" start="0" end="360" duration="3000" loop="true"/>
</m-cube>`,
    },
    {
      title: "Color animation",
      code: `<m-sphere>
  <m-attr-anim attr="color" start="red" end="blue" duration="2000" ping-pong="true"/>
</m-sphere>`,
    },
  ],
};

/**
 * m-attr-lerp - Smoothly interpolates an attribute toward a target value.
 * @element m-attr-lerp
 */
export const attrLerpSchema: ElementSchema = {
  tagName: "m-attr-lerp",
  description:
    "Smoothly interpolates a parent element attribute toward a target value using linear interpolation.",
  attributeGroups: ["coreattrs"],
  attributes: {
    attr: {
      type: "string",
      description: "The name of the attribute to interpolate on the parent element.",
    },
    duration: {
      type: "number",
      default: "1000",
      description: "The duration of the interpolation in milliseconds.",
    },
    easing: {
      type: "enum",
      default: "linear",
      enumValues: ["linear", "easeInQuad", "easeOutQuad", "easeInOutQuad"],
      description: "The easing function for the interpolation.",
    },
  },
  examples: [
    {
      title: "Smooth position changes",
      description: "Makes position changes animate smoothly",
      code: `<m-cube id="target" x="0">
  <m-attr-lerp attr="x" duration="500"/>
</m-cube>`,
    },
  ],
};

// ============================================================================
// UI Elements
// ============================================================================

/**
 * m-font - Register a font for labels and overlays.
 * @element m-font
 */
export const fontSchema: ElementSchema = {
  tagName: "m-font",
  description:
    "Registers a font for use in labels and overlays. Can optionally set the default overlay font.",
  attributeGroups: ["coreattrs"],
  attributes: {
    family: {
      type: "string",
      description: "Font-family name to register.",
    },
    src: {
      type: "uri",
      description: "URL or data URI of the font file.",
    },
    format: {
      type: "enum",
      enumValues: ["opentype", "truetype", "woff", "woff2"],
      description: "Font format override. If omitted, inferred from filename when possible.",
    },
    filename: {
      type: "string",
      description: "Optional filename hint used to infer font format.",
    },
    default: {
      type: "boolean",
      default: "false",
      description: "Whether to set this font as the default for overlays/labels.",
    },
  },
  examples: [
    {
      title: "Register a font",
      code: '<m-font family="Inter" src="./assets/fonts/Inter.woff2" format="woff2" default="true"/>',
    },
  ],
};

/**
 * m-overlay - A 2D UI overlay.
 * @element m-overlay
 */
export const overlaySchema: ElementSchema = {
  tagName: "m-overlay",
  description: "A 2D overlay that renders on top of the 3D scene.",
  attributeGroups: ["coreattrs"],
  attributes: {},
  examples: [],
};

// ============================================================================
// Game Engine Elements (from mml-game-engine-client)
// ============================================================================

/**
 * m-sun - A sun/sky lighting system.
 * @element m-sun
 */
export const sunSchema: ElementSchema = {
  tagName: "m-sun",
  description:
    "A sun lighting system with directional light and procedural sky. Controls scene lighting and atmosphere.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    intensity: {
      type: "number",
      default: "1.2",
      description: "The intensity of the sun light.",
      animatable: true,
    },
    color: {
      type: "color",
      default: "white",
      description: "The color of the sun light.",
      animatable: true,
    },
    "azimuthal-angle": {
      type: "number",
      default: "180",
      description: "The horizontal angle of the sun in degrees.",
      animatable: true,
    },
    "polar-angle": {
      type: "number",
      default: "-45",
      description: "The vertical angle of the sun in degrees (negative = above horizon).",
      animatable: true,
    },
    priority: {
      type: "number",
      default: "1",
      description: "Priority when multiple suns exist.",
    },
    resolution: {
      type: "number",
      default: "2048",
      description: "Shadow map resolution.",
    },
    frustum: {
      type: "number",
      default: "50",
      description: "Shadow camera frustum size.",
    },
    turbidity: {
      type: "number",
      default: "1.2",
      description: "Sky turbidity (haziness).",
    },
    rayleigh: {
      type: "number",
      default: "0.7",
      description: "Rayleigh scattering coefficient.",
    },
    "mie-coefficient": {
      type: "number",
      default: "0.02",
      description: "Mie scattering coefficient.",
    },
    "mie-directional-g": {
      type: "number",
      default: "0.99",
      description: "Mie directional G parameter.",
    },
  },
  examples: [
    {
      title: "Sun with sky",
      code: '<m-sun intensity="1.5" azimuthal-angle="135" polar-angle="-30"/>',
    },
  ],
};

/**
 * m-camera - A camera viewpoint.
 * @element m-camera
 */
export const cameraSchema: ElementSchema = {
  tagName: "m-camera",
  description: "A camera viewpoint that can be used for rendering the scene.",
  attributeGroups: ["coreattrs", "transformable"],
  attributes: {
    fov: {
      type: "number",
      default: "50",
      description: "Field of view in degrees.",
      animatable: true,
    },
    priority: {
      type: "number",
      default: "1",
      description: "Camera priority when multiple cameras exist.",
    },
  },
  examples: [
    {
      title: "Camera viewpoint",
      code: '<m-camera x="0" y="2" z="10" rx="-10"/>',
    },
  ],
};

/**
 * m-character-controller - First/third person character controller.
 * @element m-character-controller
 */
export const characterControllerSchema: ElementSchema = {
  tagName: "m-character-controller",
  description:
    "A character controller that provides movement, jumping, and camera control. Must be placed inside an m-capsule.",
  attributeGroups: ["coreattrs"],
  attributes: {
    "movement-speed": {
      type: "number",
      default: "1",
      description: "Movement speed multiplier.",
    },
    gravity: {
      type: "number",
      default: "60",
      description: "Gravity strength.",
    },
    "jump-force": {
      type: "number",
      default: "25",
      description: "Initial jump force.",
    },
    "double-jump-force": {
      type: "number",
      default: "18",
      description: "Double jump force.",
    },
    "camera-distance": {
      type: "number",
      default: "7",
      description: "Third-person camera distance.",
    },
    "camera-height": {
      type: "number",
      default: "1.8",
      description: "Camera height offset.",
    },
    "update-interval": {
      type: "number",
      default: "100",
      description: "Position update interval in ms.",
    },
    "rotate-with-camera": {
      type: "boolean",
      default: "false",
      description: "Whether character rotates with camera movement.",
    },
  },
  examples: [
    {
      title: "Player with controller",
      code: `<m-capsule id="player" height="1.8" radius="0.35" y="0.9">
  <m-character-controller movement-speed="1.2"/>
</m-capsule>`,
    },
  ],
};

/**
 * m-top-down-shooter-controller - Top-down shooter style controller.
 * @element m-top-down-shooter-controller
 */
export const topDownShooterControllerSchema: ElementSchema = {
  tagName: "m-top-down-shooter-controller",
  description:
    "A top-down shooter style controller with WASD movement and mouse aiming. Must be placed inside an m-capsule.",
  attributeGroups: ["coreattrs"],
  attributes: {
    "movement-speed": {
      type: "number",
      default: "1",
      description: "Movement speed multiplier.",
    },
    "camera-height": {
      type: "number",
      default: "15",
      description: "Camera height above the player.",
    },
    "camera-angle": {
      type: "number",
      default: "60",
      description: "Camera angle in degrees.",
    },
  },
  examples: [
    {
      title: "Top-down player",
      code: `<m-capsule id="player" height="1.8" radius="0.35">
  <m-top-down-shooter-controller/>
</m-capsule>`,
    },
  ],
};

/**
 * m-environment-light - Environment/ambient lighting.
 * @element m-environment-light
 */
export const environmentLightSchema: ElementSchema = {
  tagName: "m-environment-light",
  description: "Provides ambient/environment lighting to the scene.",
  attributeGroups: ["coreattrs"],
  attributes: {
    intensity: {
      type: "number",
      default: "1",
      description: "Environment light intensity.",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Ambient lighting",
      code: '<m-environment-light intensity="0.5"/>',
    },
  ],
};

/**
 * m-fog - Atmospheric fog effect.
 * @element m-fog
 */
export const fogSchema: ElementSchema = {
  tagName: "m-fog",
  description: "Adds atmospheric fog to the scene.",
  attributeGroups: ["coreattrs"],
  attributes: {
    color: {
      type: "color",
      default: "white",
      description: "Fog color.",
      animatable: true,
    },
    near: {
      type: "number",
      default: "10",
      description: "Distance at which fog starts.",
      animatable: true,
    },
    far: {
      type: "number",
      default: "100",
      description: "Distance at which fog is fully opaque.",
      animatable: true,
    },
  },
  examples: [
    {
      title: "Atmospheric fog",
      code: '<m-fog color="#cccccc" near="20" far="80"/>',
    },
  ],
};

/**
 * m-environment-map - Environment/reflection map.
 * @element m-environment-map
 */
export const environmentMapSchema: ElementSchema = {
  tagName: "m-environment-map",
  description: "Provides an environment map for reflections and ambient lighting.",
  attributeGroups: ["coreattrs"],
  attributes: {
    src: {
      type: "uri",
      description: "URL of the HDR environment map.",
    },
  },
  examples: [
    {
      title: "HDR environment",
      code: '<m-environment-map src="./assets/environment.hdr"/>',
    },
  ],
};

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * All element schemas
 */
export const elementSchemas: Record<string, ElementSchema> = {
  // Geometry
  "m-cube": cubeSchema,
  "m-sphere": sphereSchema,
  "m-cylinder": cylinderSchema,
  "m-capsule": capsuleSchema,
  "m-plane": planeSchema,
  // Composite
  "m-group": groupSchema,
  "m-model": modelSchema,
  "m-character": characterSchema,
  "m-frame": frameSchema,
  "m-remote-document": remoteDocumentSchema,
  // Media
  "m-audio": audioSchema,
  "m-image": imageSchema,
  "m-video": videoSchema,
  "m-label": labelSchema,
  // Lighting
  "m-light": lightSchema,
  "m-sun": sunSchema,
  "m-environment-light": environmentLightSchema,
  "m-fog": fogSchema,
  "m-environment-map": environmentMapSchema,
  // Interaction
  "m-interaction": interactionSchema,
  "m-position-probe": positionProbeSchema,
  "m-chat-probe": chatProbeSchema,
  "m-prompt": promptSchema,
  "m-link": linkSchema,
  "m-mouse-behavior": mouseBehaviorSchema,
  // Animation
  "m-animation": animationSchema,
  "m-attr-anim": attrAnimSchema,
  "m-attr-lerp": attrLerpSchema,
  // UI
  "m-font": fontSchema,
  "m-overlay": overlaySchema,
  // Controllers
  "m-camera": cameraSchema,
  "m-character-controller": characterControllerSchema,
  "m-top-down-shooter-controller": topDownShooterControllerSchema,
};

/**
 * Complete schema registry
 */
export const schemaRegistry: SchemaRegistry = {
  elements: elementSchemas,
  attributeGroups: builtinAttributeGroups,
};
