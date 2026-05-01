import * as THREE from 'three';

export class RaycastManager {
  private raycaster: THREE.Raycaster;
  private groundPlane: THREE.Plane;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  private getNDC(event: MouseEvent): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  getGroundIntersection(event: MouseEvent): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.getNDC(event), this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    return hit ? target : null;
  }

  getSceneIntersections(event: MouseEvent, objects: THREE.Object3D[]): THREE.Intersection[] {
    this.raycaster.setFromCamera(this.getNDC(event), this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }
}
