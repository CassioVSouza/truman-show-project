import { WORLD_CONFIG } from "@truman/world";
import * as THREE from "three";
import type { FireVisualState } from "../state/timeline";

const FIRE_APPEARANCE = {
  out: { scale: 0, intensity: 0 },
  dying: { scale: 0.45, intensity: 0.7 },
  lit: { scale: 0.75, intensity: 1.4 },
  burning: { scale: 1, intensity: 2.2 },
} satisfies Record<FireVisualState["state"], { scale: number; intensity: number }>;

export class FireProps {
  readonly root = new THREE.Group();
  private readonly flames = new THREE.Group();
  private readonly light: THREE.PointLight;

  constructor(hearth: boolean) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.46, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8a2b }),
    );
    flame.position.y = 0.17;
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.34, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd15c }),
    );
    core.position.set(0.05, 0.13, -0.04);
    this.flames.position.y = hearth ? 0.42 : 0.13;
    this.flames.add(flame, core);
    this.light = new THREE.PointLight(0xff9438, 0, hearth ? 9.5 : 8, 1.8);
    this.light.position.y = hearth ? 0.85 : 0.5;
    this.root.add(this.flames, this.light);

    if (!hearth) {
      const ash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.02, 8),
        new THREE.MeshStandardMaterial({ color: 0x2e231c, roughness: 1 }),
      );
      ash.position.y = 0.011;
      const stones = new THREE.MeshStandardMaterial({ color: 0x726d63, roughness: 0.95 });
      const rock = new THREE.DodecahedronGeometry(0.1, 0);
      const ringRadius = WORLD_CONFIG.fire.campRadius - 0.1;
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4;
        const stone = new THREE.Mesh(rock, stones);
        stone.scale.y = index % 2 === 0 ? 0.65 : 0.8;
        stone.rotation.y = angle + 0.4;
        stone.position.set(Math.cos(angle) * ringRadius, 0.047, Math.sin(angle) * ringRadius);
        stone.castShadow = true;
        this.root.add(stone);
      }
      const wood = new THREE.MeshStandardMaterial({ color: 0x573b28, roughness: 0.95 });
      const branch = new THREE.CylinderGeometry(0.054, 0.064, 0.47, 6);
      for (const [index, angle] of [0.3, 1.64, 2.53].entries()) {
        const log = new THREE.Mesh(branch, wood);
        log.rotation.set(0, angle, Math.PI / 2, "YXZ");
        log.position.y = 0.06 + 0.04 * index;
        log.castShadow = true;
        this.root.add(log);
      }
      this.root.add(ash);
    }
  }

  applyState(state: FireVisualState["state"]): void {
    const { scale, intensity } = FIRE_APPEARANCE[state];
    this.flames.visible = scale > 0;
    this.flames.scale.setScalar(scale);
    this.light.visible = intensity > 0;
    this.light.intensity = intensity;
  }

  flicker(time: number): void {
    if (!this.flames.visible) return;
    this.flames.rotation.y = time * 1.8;
    this.flames.scale.y = this.flames.scale.x * (0.92 + Math.sin(time * 15) * 0.1);
  }

  dispose(): void {
    this.root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.light.dispose();
  }
}
