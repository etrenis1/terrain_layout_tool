import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private animationId = 0;
  private resizeObserver: ResizeObserver;

  private panKeys = new Set<string>();
  private onPanKeyDown: (e: KeyboardEvent) => void;
  private onPanKeyUp: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2a2a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.set(0, 300, 400);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.screenSpacePanning = false;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(200, 400, 200);
    directional.castShadow = true;
    directional.shadow.mapSize.set(2048, 2048);
    this.scene.add(directional);

    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    this.onPanKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing in an input field
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ('wasd'.includes(e.key.toLowerCase()) && e.key.length === 1) {
        this.panKeys.add(e.key.toLowerCase());
      }
    };
    this.onPanKeyUp = (e: KeyboardEvent) => {
      this.panKeys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', this.onPanKeyDown);
    window.addEventListener('keyup', this.onPanKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas.parentElement!);
    this.handleResize();
  }

  private handleResize(): void {
    const parent = this.renderer.domElement.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyPan(): void {
    if (this.panKeys.size === 0) return;

    // Project camera's look direction onto the XZ plane for world-space panning.
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Scale speed with camera height so panning feels consistent at any zoom level.
    const speed = Math.max(1, this.camera.position.y * 0.018);

    const delta = new THREE.Vector3();
    if (this.panKeys.has('w')) delta.addScaledVector(forward, speed);
    if (this.panKeys.has('s')) delta.addScaledVector(forward, -speed);
    if (this.panKeys.has('a')) delta.addScaledVector(right, -speed);
    if (this.panKeys.has('d')) delta.addScaledVector(right, speed);

    this.camera.position.add(delta);
    this.controls.target.add(delta);
  }

  startLoop(onFrame?: () => void): void {
    const tick = () => {
      this.animationId = requestAnimationFrame(tick);
      this.applyPan();
      this.controls.update();
      onFrame?.();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stopLoop(): void {
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onPanKeyDown);
    window.removeEventListener('keyup', this.onPanKeyUp);
    this.renderer.dispose();
  }
}
