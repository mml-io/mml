import React, { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface GlbSceneRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: OrbitControls | null;
  clock: THREE.Clock;
}

export interface UseGlbSceneResult {
  containerRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  sceneRefs: React.MutableRefObject<GlbSceneRefs>;
  resetCamera: (model: THREE.Group | null) => void;
}

export function useGlbScene(
  mixerRef: React.RefObject<THREE.AnimationMixer | null>,
): UseGlbSceneResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRefs = useRef<GlbSceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    clock: new THREE.Clock(),
  });

  const resetCamera = useCallback((model: THREE.Group | null) => {
    const { camera, controls } = sceneRefs.current;
    if (!camera || !controls || !model) return;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraDistance = (maxDim / (2 * Math.tan(fov / 2))) * 1.5;

    camera.position.set(
      center.x + cameraDistance * 0.5,
      center.y + cameraDistance * 0.3,
      center.z + cameraDistance,
    );
    controls.target.copy(center);
    controls.update();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x252526);
    sceneRefs.current.scene = scene;

    // Grid helper with better visibility
    const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x3a3a3a);
    scene.add(gridHelper);

    // Smaller axis helper
    const axisHelper = new THREE.AxesHelper(0.5);
    scene.add(axisHelper);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      1000,
    );
    camera.position.set(3, 2, 3);
    sceneRefs.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    sceneRefs.current.renderer = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    sceneRefs.current.controls = controls;

    // Improved lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Key light - main directional light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);

    // Fill light - softer, from the side
    const fillLight = new THREE.DirectionalLight(0xb4c6e0, 0.8);
    fillLight.position.set(-5, 5, -3);
    scene.add(fillLight);

    // Rim light - from behind for edge definition
    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.6);
    rimLight.position.set(0, 3, -10);
    scene.add(rimLight);

    // Ground bounce light
    const bounceLight = new THREE.HemisphereLight(0x8899aa, 0x443322, 0.5);
    scene.add(bounceLight);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = sceneRefs.current.clock.getDelta();

      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, [mixerRef]);

  return {
    containerRef,
    canvasRef,
    sceneRefs,
    resetCamera,
  };
}
