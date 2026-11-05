// 지도별 빛과 공기
import * as THREE from 'three';
import type { MapData } from '@shared/mapdata';

export interface Atmos {
  sunDir: THREE.Vector3;
  sun: THREE.Color;
  sky: THREE.Color;
  gnd: THREE.Color;
  fog: THREE.Color;
  fogAmt: number;
  cloud: number;
  lamp: THREE.Color;
  lampK: number;
  halo: number;
  sunShadow: boolean;
  shadowTint: THREE.Color;
  highTint: THREE.Color;
  sat: number;
}

const C = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

export function atmosphereOf(map: MapData): Atmos {
  const base: Atmos = {
    // 해 질 녘: 왼쪽 앞에서 낮게 들어오는 금빛
    sunDir: new THREE.Vector3(-0.6, 0.62, 0.5),
    sun: C(1.02, 0.78, 0.5),
    sky: C(0.42, 0.5, 0.72),
    gnd: C(0.3, 0.25, 0.33),
    fog: C(0.2, 0.22, 0.3),
    fogAmt: 1,
    cloud: 1,
    lamp: C(1.0, 0.66, 0.3),
    lampK: 1,
    halo: 0.55,
    sunShadow: true,
    shadowTint: C(0.92, 0.95, 1.08),
    highTint: C(1.04, 1.0, 0.94),
    sat: 1.12,
  };
  switch (map.name) {
    case 'woods':
      return { ...base, sunDir: new THREE.Vector3(-0.45, 0.72, 0.38), sun: C(0.72, 0.72, 0.5), sky: C(0.3, 0.42, 0.42), gnd: C(0.16, 0.2, 0.18), fog: C(0.13, 0.2, 0.2), lamp: C(0.95, 0.72, 0.36), halo: 0.8, sat: 1.05 };
    case 'hollow':
      return { ...base, sun: C(0, 0, 0), sky: C(0.15, 0.22, 0.24), gnd: C(0.07, 0.09, 0.11), fog: C(0.03, 0.05, 0.06), cloud: 0, lamp: C(0.72, 0.95, 0.56), lampK: 1.25, halo: 1, sunShadow: false, shadowTint: C(0.9, 1, 1.05), sat: 1.05 };
    case 'ashfield':
      return { ...base, sunDir: new THREE.Vector3(-0.3, 0.55, 0.6), sun: C(0.72, 0.42, 0.26), sky: C(0.34, 0.27, 0.3), gnd: C(0.22, 0.13, 0.13), fog: C(0.18, 0.1, 0.09), lamp: C(1, 0.55, 0.22), halo: 0.8, cloud: 0.7, sat: 1.04 };
    case 'furnace':
      return { ...base, sun: C(0, 0, 0), sky: C(0.2, 0.13, 0.13), gnd: C(0.13, 0.06, 0.05), fog: C(0.06, 0.03, 0.02), cloud: 0, lamp: C(1, 0.5, 0.2), lampK: 1.3, halo: 1, sunShadow: false, sat: 1.08 };
    case 'rift':
      return { ...base, sun: C(0, 0, 0), sky: C(0.2, 0.18, 0.34), gnd: C(0.08, 0.06, 0.15), fog: C(0.04, 0.02, 0.08), cloud: 0, lamp: C(0.72, 0.52, 1), lampK: 1.2, halo: 1, sunShadow: false, sat: 1.1 };
    default:
      return base;
  }
}
