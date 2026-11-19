import * as THREE from 'three';
import type { GothicMaterialLibrary } from './materials';
import {
  createAlarmBell,
  createBloodAltar,
  createBreakableProp,
  createCathedral,
  createDeadTree,
  createDrapedCurtain,
  createFountain,
  createGothicBanner,
  createGothicBuilding,
  createGothicPlatform,
  createGravestone,
  createMausoleum,
  createMemoryFragment,
  createScaffoldingStack,
  createSewerGrate,
  createSidewalkCurb,
  createSmokeChimney,
  createStoneArchway,
  createStoneStaircase,
  createStreetLamp,
  createVampireCoffin,
  createVictorianBuilding,
  createVictorianCarriage,
  createVictorianManor,
  createWaterPuddle,
  createWroughtIronFence,
  type AlarmBellInstance,
  type BreakablePropInstance,
  type MemoryFragmentInstance,
  type StreetLampInstance,
} from './models';
import type { GothicTextures } from './textures';
import { MEMORY_FRAGMENTS } from './types';

export interface WorldVolume {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  blocksSight: boolean;
  walkableTop: boolean;
}

export interface ShadowZone {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface CityWorldData {
  volumes: WorldVolume[];
  lamps: StreetLampInstance[];
  bells: AlarmBellInstance[];
  breakables: BreakablePropInstance[];
  memories: MemoryFragmentInstance[];
  smokeSources: THREE.Vector3[];
  shadowZones: ShadowZone[];
  altarPos: THREE.Vector3;
  coffinPos: THREE.Vector3;
  safeSpawnPos: THREE.Vector3;
  cryptBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  altarGroup: THREE.Group;
  citizenRoutes: THREE.Vector3[][];
  beggarRoutes: THREE.Vector3[][];
  cultistRoutes: THREE.Vector3[][];
  nobleRoutes: THREE.Vector3[][];
  guardRoutes: THREE.Vector3[][];
  hunterRoutes: THREE.Vector3[][];
  playableBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function buildGothicCity(
  scene: THREE.Scene,
  mats: GothicMaterialLibrary,
  textures: GothicTextures,
): CityWorldData {
  const volumes: WorldVolume[] = [];
  const lamps: StreetLampInstance[] = [];
  const bells: AlarmBellInstance[] = [];
  const breakables: BreakablePropInstance[] = [];
  const memories: MemoryFragmentInstance[] = [];
  const smokeSources: THREE.Vector3[] = [];
  const shadowZones: ShadowZone[] = [];

  const addVolume = (
    cx: number,
    minY: number,
    maxY: number,
    cz: number,
    w: number,
    d: number,
    blocksSight = true,
    walkableTop = true,
  ) => {
    volumes.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY,
      maxY,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      blocksSight,
      walkableTop,
    });
  };

  const addStairVolumes = (
    cx: number,
    cz: number,
    w: number,
    totalHeight: number,
    length: number,
    steps: number,
    dir: 'north' | 'south' | 'east' | 'west',
  ) => {
    const stepH = totalHeight / steps;
    const stepD = length / steps;
    for (let i = 0; i < steps; i++) {
      const topY = stepH * (i + 1);
      const localZ = -length / 2 + stepD * (i + 0.5);
      let sx = cx;
      let sz = cz;
      let sw = w;
      let sd = stepD + 0.12;
      if (dir === 'south') {
        sz = cz + localZ;
      } else if (dir === 'north') {
        sz = cz - localZ;
      } else if (dir === 'east') {
        sx = cx + localZ;
        sw = stepD + 0.12;
        sd = w;
      } else {
        sx = cx - localZ;
        sw = stepD + 0.12;
        sd = w;
      }
      addVolume(sx, 0, topY, sz, sw, sd, false, true);
    }
  };

  // Vast matte cobblestone city ground tiled around the subterranean Crypt opening (x: 19..25, z: -51..-34)
  const addGroundStrip = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    segX: number,
    segZ: number,
  ) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const worldX = cx + posAttr.getX(i);
      const worldZ = cz - posAttr.getY(i); // rotated -PI/2 around X later
      uvAttr.setXY(i, (worldX + 190) / 380, (190 - worldZ) / 380);
    }
    uvAttr.needsUpdate = true;
    const strip = new THREE.Mesh(geo, mats.cobble);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(cx, 0, cz);
    strip.receiveShadow = true;
    scene.add(strip);
  };

  addGroundStrip(-190, 19, -190, 190, 30, 56);
  addGroundStrip(25, 190, -190, 190, 26, 56);
  addGroundStrip(19, 25, -190, -51, 2, 22);
  addGroundStrip(19, 25, -34, 190, 2, 34);

  // Moon disc high in northern sky
  const moonMesh = new THREE.Mesh(
    new THREE.CircleGeometry(17, 16),
    new THREE.MeshBasicMaterial({ color: 0xdbeafe, fog: false }),
  );
  moonMesh.position.set(-64, 102, -148);
  moonMesh.lookAt(0, 0, 0);
  scene.add(moonMesh);

  // =========================================================================
  // SECTOR 1: ADRO DA CATEDRAL NORTE (z < -22)
  // =========================================================================
  const cathedral = createCathedral(mats);
  cathedral.position.set(0, 0, -52);
  scene.add(cathedral);
  addVolume(0, 0, 18, -52, 16.8, 25, true, false);

  // Cathedral flanking elevated stone terraces (y = 3.6m, z in [-56, -40]) + staircases
  [-11.5, 11.5].forEach((tx) => {
    const terrace = createGothicPlatform(6.2, 3.6, 16, mats, { withRailings: true });
    terrace.position.set(tx, 0, -48);
    scene.add(terrace);
    addVolume(tx, 3.05, 3.6, -48, 6.2, 16, false, true);

    const stair = createStoneStaircase(3.4, 3.6, 7.2, 9, mats, 'north');
    stair.position.set(tx, 0, -36.4);
    scene.add(stair);
    addStairVolumes(tx, -36.4, 3.4, 3.6, 7.2, 9, 'north');
  });

  // Elevated Cathedral Balcony connecting West & East terraces at z = -38.0
  const cathBridge = createGothicPlatform(16.8, 3.6, 4.0, mats, { withRailings: false, pillars: true });
  cathBridge.position.set(0, 0, -38.0);
  scene.add(cathBridge);
  addVolume(0, 3.05, 3.6, -38.0, 16.8, 4.0, false, true);

  // North Cloister Flanking Buildings & Side Gothic Wings
  const cathedralBlocks: Array<{ x: number; z: number; w: number; h: number; d: number; spire?: boolean; roofDeckY?: number }> = [
    { x: -30, z: -58, w: 12, h: 10.5, d: 11, spire: true },
    { x: 30, z: -58, w: 12, h: 10.5, d: 11, spire: true },
    { x: -54, z: -48, w: 12, h: 6.2, d: 11, roofDeckY: 6.2 },
    { x: 54, z: -48, w: 12, h: 6.2, d: 11, roofDeckY: 6.2 },
    { x: -72, z: -56, w: 12, h: 11, d: 12 },
    { x: 72, z: -56, w: 12, h: 11, d: 12 },
  ];
  cathedralBlocks.forEach((b) => {
    if (b.roofDeckY) {
      const tower = createGothicPlatform(b.w, b.roofDeckY, b.d, mats, { withRailings: true, pillars: false });
      tower.position.set(b.x, 0, b.z);
      scene.add(tower);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.45, 0.65, b.d + 0.45), mats.darkStone);
      plinth.position.set(b.x, 0.325, b.z);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      const core = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.3, b.roofDeckY - 0.5, b.d - 0.3), mats.stone);
      core.position.set(b.x, (b.roofDeckY - 0.5) / 2, b.z);
      core.castShadow = true;
      core.receiveShadow = true;
      scene.add(plinth, core);
      addVolume(b.x, 0, b.roofDeckY, b.z, b.w, b.d, true, true);
    } else {
      const mesh = createGothicBuilding(b.w, b.h, b.d, mats, { hasSpire: b.spire });
      mesh.position.set(b.x, 0, b.z);
      scene.add(mesh);
      addVolume(b.x, 0, b.h + 4, b.z, b.w + 0.6, b.d + 0.6, true, false);
    }
  });

  // Monumental Stone Archways linking Cathedral North Plaza to Alleys (West) and Cemetery (East)
  const archPlaces: Array<[number, number, number]> = [
    [-25, -24, 0],
    [40, -24, 0],
    [-18, 45, 0],
    [22, 45, 0],
  ];
  archPlaces.forEach(([ax, az, rot]) => {
    const arch = createStoneArchway(10.5, 5.4, 2.4, mats);
    arch.position.set(ax, 0, az);
    arch.rotation.y = rot;
    scene.add(arch);
    addVolume(ax - 4.3, 0, 5.8, az, 1.8, 2.4, true, false);
    addVolume(ax + 4.3, 0, 5.8, az, 1.8, 2.4, true, false);
    addVolume(ax, 5.4, 7.2, az, 10.6, 2.5, true, true);
  });

  // =========================================================================
  // SECTOR 2 & 3 SHARED SPINE: FOUNTAIN PLAZA & SKYBRIDGES
  // =========================================================================
  const fountain = createFountain(mats);
  fountain.position.set(0, 0, 0);
  scene.add(fountain);
  addVolume(0, 0, 0.85, 0, 6.8, 6.8, false, true);
  addVolume(0, 0.85, 3.2, 0, 1.8, 1.8, false, true);

  // North Plaza Skybridge (y = 4.0m) spanning x in [-14, +14], z = -14.0
  const northBridge = createGothicPlatform(28, 4.0, 4.0, mats, { withRailings: false, pillars: true });
  northBridge.position.set(0, 0, -14.0);
  scene.add(northBridge);
  addVolume(0, 3.45, 4.0, -14.0, 28, 4.0, false, true);
  shadowZones.push({ x: 0, y: 4.0, z: -14.0, radius: 5.5 });

  [-11.2, 11.2].forEach((sx) => {
    const stair = createStoneStaircase(3.2, 4.0, 8.0, 10, mats, 'south');
    stair.position.set(sx, 0, -20.0);
    scene.add(stair);
    addStairVolumes(sx, -20.0, 3.2, 4.0, 8.0, 10, 'south');
  });

  // South Overpass Bridge (y = 4.0m) at z = 24.0
  const southBridge = createGothicPlatform(28, 4.0, 4.0, mats, { withRailings: false, pillars: true });
  southBridge.position.set(0, 0, 24.0);
  scene.add(southBridge);
  addVolume(0, 3.45, 4.0, 24.0, 28, 4.0, false, true);

  [-11.2, 11.2].forEach((sx) => {
    const stair = createStoneStaircase(3.2, 4.0, 8.0, 10, mats, 'north');
    stair.position.set(sx, 0, 30.0);
    scene.add(stair);
    addStairVolumes(sx, 30.0, 3.2, 4.0, 8.0, 10, 'north');
  });

  // =========================================================================
  // SECTOR 2: BECOS E VIELAS ESTREITAS (x in [-84, -16], z in [-22, 44])
  // =========================================================================
  const alleyBuildings: Array<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    brick?: boolean;
    roofDeckY?: number;
    hasBalcony?: boolean;
    roofStyle?: 'pitched' | 'mansard' | 'flat';
  }> = [
    // Inner West Tenements (x = -21)
    { x: -21, z: -2, w: 8.5, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: -21, z: 16, w: 8.5, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: -21, z: 34, w: 9.5, h: 9.5, d: 10, brick: true, hasBalcony: true, roofStyle: 'pitched' },

    // Mid West Tenement Row (x = -42)
    { x: -42, z: -8, w: 10, h: 9.0, d: 11, brick: true, roofStyle: 'pitched' },
    { x: -42, z: 10, w: 10, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: -42, z: 30, w: 10, h: 9.8, d: 11, brick: true, hasBalcony: true, roofStyle: 'mansard' },

    // Far West Old Quarter (x = -66)
    { x: -66, z: -12, w: 11, h: 10.0, d: 12, brick: true, roofStyle: 'pitched' },
    { x: -66, z: 12, w: 10.5, h: 6.2, d: 12, roofDeckY: 6.2 },
    { x: -66, z: 34, w: 11, h: 10.5, d: 12, roofStyle: 'mansard' },
  ];

  alleyBuildings.forEach((b) => {
    if (b.roofDeckY) {
      const tower = createGothicPlatform(b.w, b.roofDeckY, b.d, mats, { withRailings: true, pillars: false });
      tower.position.set(b.x, 0, b.z);
      scene.add(tower);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.45, 0.65, b.d + 0.45), mats.darkStone);
      plinth.position.set(b.x, 0.325, b.z);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      const core = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.3, b.roofDeckY - 0.5, b.d - 0.3), mats.brick);
      core.position.set(b.x, (b.roofDeckY - 0.5) / 2, b.z);
      core.castShadow = true;
      core.receiveShadow = true;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), mats.stainedGlass);
      win.position.set(b.x, 2.8, b.z + b.d / 2 - 0.1);
      scene.add(plinth, core, win);
      addVolume(b.x, 0, b.roofDeckY, b.z, b.w, b.d, true, true);
      shadowZones.push({ x: b.x, y: b.roofDeckY, z: b.z, radius: b.w * 0.55 });
    } else {
      const mesh = createVictorianBuilding(b.w, b.h, b.d, mats, {
        brick: b.brick,
        hasBalcony: b.hasBalcony,
        roofStyle: b.roofStyle ?? 'pitched',
        chimney: true,
      });
      mesh.position.set(b.x, 0, b.z);
      scene.add(mesh);
      addVolume(b.x, 0, b.h + 4, b.z, b.w + 0.6, b.d + 0.6, true, false);
    }
  });

  // Interconnected Alley Rooftop Catwalks (y = 6.2m)
  const westRoofCatwalk = createGothicPlatform(4.2, 6.2, 8.4, mats, { withRailings: true, pillars: false });
  westRoofCatwalk.position.set(-21, 0, 7.0);
  scene.add(westRoofCatwalk);
  addVolume(-21, 5.65, 6.2, 7.0, 4.2, 8.4, false, true);

  const midAlleyBridge = createGothicPlatform(12.5, 6.2, 4.2, mats, { withRailings: false, pillars: true });
  midAlleyBridge.position.set(-31.5, 0, 11.5);
  scene.add(midAlleyBridge);
  addVolume(-31.5, 5.65, 6.2, 11.5, 12.5, 4.2, false, true);
  shadowZones.push({ x: -31.5, y: 0, z: 11.5, radius: 5.2 });

  const farAlleyBridge = createGothicPlatform(14.5, 6.2, 4.2, mats, { withRailings: false, pillars: true });
  farAlleyBridge.position.set(-54.0, 0, 11.0);
  scene.add(farAlleyBridge);
  addVolume(-54.0, 5.65, 6.2, 11.0, 14.5, 4.2, false, true);
  shadowZones.push({ x: -54.0, y: 0, z: 11.0, radius: 5.2 });

  // Climbable Alley Crates & Scaffolding Steps flush against flat roofs
  const scaffoldSpots: Array<[number, number, number, number]> = [
    [-26.5, 14.5, 0, 1.4],
    [-48.3, 10.0, Math.PI, 1.4],
    [-59.5, 12.0, 0, -1.4],
    [25.6, -2.0, Math.PI, -1.4],
    [25.6, 16.0, Math.PI, -1.4],
  ];
  scaffoldSpots.forEach(([sx, sz, rot, stepOffsetX]) => {
    const stack = createScaffoldingStack(mats);
    stack.position.set(sx, 0, sz);
    stack.rotation.y = rot;
    scene.add(stack);
    addVolume(sx, 0, 1.5, sz, 2.2, 2.2, false, true);
    addVolume(sx + (rot === 0 ? 0.25 : -0.25), 1.5, 2.9, sz, 1.6, 1.6, false, true);

    const stepPlatform = createGothicPlatform(2.6, 4.6, 2.6, mats, { withRailings: false, pillars: true });
    const px = sx + stepOffsetX;
    stepPlatform.position.set(px, 0, sz + 2.1);
    scene.add(stepPlatform);
    addVolume(px, 4.05, 4.6, sz + 2.1, 2.6, 2.6, false, true);
  });

  // Steaming Sewer Grates in Becos e Vielas & Avenida Vitoriana
  const sewerSpots: Array<[number, number]> = [
    [-31.0, 22.0],
    [-31.0, -4.0],
    [-54.0, 2.0],
    [-54.0, 26.0],
    [10.2, 18.0],
    [-10.2, 34.0],
  ];
  sewerSpots.forEach(([gx, gz]) => {
    const grate = createSewerGrate(mats);
    grate.position.set(gx, 0, gz);
    scene.add(grate);
    smokeSources.push(new THREE.Vector3(gx, 0.25, gz));
  });

  // Small isolated rain puddles (the ONLY specular ground spots, keeping cobblestones matte)
  const puddleSpots: Array<[number, number, number]> = [
    [-4.8, -22.5, 1.45],
    [5.4, -21.0, 1.2],
    [-10.0, 4.5, 1.35],
    [10.1, 14.0, 1.55],
    [-6.4, 14.5, 1.25],
    [7.2, -5.5, 1.3],
    [-29.5, -1.5, 1.5],
    [-32.5, 19.5, 1.65],
    [-52.5, 5.5, 1.4],
    [-55.2, 23.5, 1.35],
    [25.2, 4.5, 1.2],
    [-18.0, 56.5, 1.7],
    [16.0, 62.5, 1.5],
    [-42.0, 60.5, 1.45],
    [40.0, 6.0, 1.35],
    [47.5, -12.0, 1.4],
    [-14.5, -62.0, 1.3],
    [14.5, -62.0, 1.3],
  ];
  puddleSpots.forEach(([px, pz, rad], idx) => {
    const puddle = createWaterPuddle(rad, idx + 1, mats);
    puddle.position.set(px, 0.016, pz);
    scene.add(puddle);
  });

  // =========================================================================
  // SECTOR 3: AVENIDA VITORIANA (Central North-South + Southern East-West)
  // =========================================================================
  // Raised curbed sidewalks (height = 0.24m -> smoothly walkable up & down!)
  const sidewalkSpecs: Array<[number, number, number, number]> = [
    [-12.8, 11.0, 4.2, 54], // West central boulevard sidewalk
    [12.8, 11.0, 4.2, 54],  // East central boulevard sidewalk
    [28.5, 11.0, 4.2, 54],  // Eastern shopfront sidewalk
    [0, 48.0, 128, 3.8],    // North sidewalk of Southern Avenue
    [0, 68.5, 128, 4.2],    // South sidewalk of Southern Avenue
  ];
  sidewalkSpecs.forEach(([cx, cz, sw, sd]) => {
    const curb = createSidewalkCurb(sw, sd, mats, 0.24);
    curb.position.set(cx, 0, cz);
    scene.add(curb);
    addVolume(cx, 0, 0.24, cz, sw, sd, false, true);
  });

  // Victorian Avenue Shopfronts (glowing warm vitrines + balconies + mansards)
  const avenueBuildings: Array<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    rotY?: number;
    brick?: boolean;
    hasVitrine?: boolean;
    hasBalcony?: boolean;
    roofDeckY?: number;
    roofStyle?: 'pitched' | 'mansard' | 'flat';
  }> = [
    // East Central Avenue strip (x = 20.5)
    { x: 20.5, z: -20, w: 9, h: 10.5, d: 11, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: 20.5, z: -2, w: 9, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: 20.5, z: 16, w: 9, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: 20.5, z: 34, w: 9.5, h: 10.0, d: 11, brick: false, hasVitrine: true, hasBalcony: true, roofStyle: 'pitched' },

    // Southern Avenue South Front (z = 76) facing North (rotY = Math.PI)
    { x: -52, z: 76, w: 15, h: 10.5, d: 10, rotY: Math.PI, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: -24, z: 76, w: 14, h: 11.2, d: 10, rotY: Math.PI, brick: false, hasVitrine: true, hasBalcony: true, roofStyle: 'pitched' },
    { x: 0, z: 77, w: 14, h: 12.0, d: 10, rotY: Math.PI, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: 24, z: 76, w: 14, h: 10.8, d: 10, rotY: Math.PI, brick: false, hasVitrine: true, hasBalcony: true, roofStyle: 'pitched' },
    { x: 52, z: 76, w: 15, h: 10.5, d: 10, rotY: Math.PI, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },

    // Southern Gatehouse Bastions framing Southern Boulevard
    { x: -32, z: 58, w: 6.5, h: 10.0, d: 6.5, roofStyle: 'pitched' },
    { x: 32, z: 58, w: 6.5, h: 10.0, d: 6.5, roofStyle: 'pitched' },
  ];

  avenueBuildings.forEach((b) => {
    if (b.roofDeckY) {
      const tower = createGothicPlatform(b.w, b.roofDeckY, b.d, mats, { withRailings: true, pillars: false });
      tower.position.set(b.x, 0, b.z);
      scene.add(tower);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.45, 0.65, b.d + 0.45), mats.darkStone);
      plinth.position.set(b.x, 0.325, b.z);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      const core = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.3, b.roofDeckY - 0.5, b.d - 0.3), mats.stone);
      core.position.set(b.x, (b.roofDeckY - 0.5) / 2, b.z);
      core.castShadow = true;
      core.receiveShadow = true;
      const vitrine = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), mats.vitrine);
      vitrine.position.set(b.x - b.w / 2 - 0.02, 1.8, b.z);
      vitrine.rotation.y = -Math.PI / 2;
      scene.add(plinth, core, vitrine);
      addVolume(b.x, 0, b.roofDeckY, b.z, b.w, b.d, true, true);
      shadowZones.push({ x: b.x, y: b.roofDeckY, z: b.z, radius: b.w * 0.55 });
    } else {
      const mesh = createVictorianBuilding(b.w, b.h, b.d, mats, {
        brick: b.brick,
        hasVitrine: b.hasVitrine,
        hasBalcony: b.hasBalcony,
        roofStyle: b.roofStyle ?? 'pitched',
        chimney: true,
      });
      mesh.position.set(b.x, 0, b.z);
      if (b.rotY) mesh.rotation.y = b.rotY;
      scene.add(mesh);
      addVolume(b.x, 0, b.h + 4, b.z, b.w + 0.6, b.d + 0.6, true, false);
    }
  });

  // East Avenue Rooftop Catwalk connecting (20.5, -2) to (20.5, 16)
  const eastRoofCatwalk = createGothicPlatform(4.2, 6.2, 8.4, mats, { withRailings: true, pillars: false });
  eastRoofCatwalk.position.set(20.5, 0, 7.0);
  scene.add(eastRoofCatwalk);
  addVolume(20.5, 5.65, 6.2, 7.0, 4.2, 8.4, false, true);

  // North Bridge -> Flat Roofs step-up landings (y = 4.6m)
  [-12.6, 12.6].forEach((wx) => {
    const sideLanding = createGothicPlatform(2.8, 4.6, 6.5, mats, { withRailings: false, pillars: true });
    sideLanding.position.set(wx, 0, -7.8);
    scene.add(sideLanding);
    addVolume(wx, 4.05, 4.6, -7.8, 2.8, 6.5, false, true);
  });

  // South Gatehouse Overpass Bridge (y = 4.2m, z = 60.0) + Flush Staircases
  const southGateBridge = createGothicPlatform(28, 4.2, 3.6, mats, { withRailings: false, pillars: true });
  southGateBridge.position.set(0, 0, 60.0);
  scene.add(southGateBridge);
  addVolume(0, 3.65, 4.2, 60.0, 28, 3.6, false, true);

  [-12.4, 12.4].forEach((sx) => {
    const stair = createStoneStaircase(3.2, 4.2, 8.0, 10, mats, 'south');
    stair.position.set(sx, 0, 54.2);
    scene.add(stair);
    addStairVolumes(sx, 54.2, 3.2, 4.2, 8.0, 10, 'south');
  });

  // Parked Victorian Carriages along Avenida Vitoriana
  const carriageSpecs: Array<[number, number, number]> = [
    [6.0, 14.0, 0],
    [-6.0, 35.0, Math.PI],
    [-16.0, 57.5, Math.PI / 2],
    [8.0, 63.5, -Math.PI / 2],
    [25.8, -8.0, 0],
  ];
  carriageSpecs.forEach(([cx, cz, rot]) => {
    const car = createVictorianCarriage(mats);
    car.position.set(cx, 0, cz);
    car.rotation.y = rot;
    scene.add(car);
    const isEW = Math.abs(Math.sin(rot)) > 0.7;
    addVolume(cx, 0, 2.45, cz, isEW ? 3.5 : 2.3, isEW ? 2.3 : 3.5, true, true);
  });

  // =========================================================================
  // CRIPTA DO VAMPIRO (Subterranean Sanctuary & Interactive Coffin in Adro Norte)
  // =========================================================================
  const cryptBounds = { minX: 18.2, maxX: 25.8, minZ: -51.6, maxZ: -33.2 };
  const cryptCx = 22.0;
  const coffinPos = new THREE.Vector3(cryptCx, -2.4, -47.8);
  const safeSpawnPos = new THREE.Vector3(cryptCx, -2.4, -43.8);

  // Descending Stone Stairwell (z = -34.0 down to z = -41.5, y = 0 down to -2.4)
  const cryptSteps = 10;
  const cryptDepth = 2.4;
  const cryptStepH = cryptDepth / cryptSteps;
  const cryptStepD = 0.75;
  for (let i = 0; i < cryptSteps; i++) {
    const topY = -cryptStepH * (i + 1);
    const sz = -34.0 - cryptStepD * (i + 0.5);
    const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.38, cryptStepD + 0.06), mats.stone);
    stepMesh.position.set(cryptCx, topY - 0.19, sz);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    scene.add(stepMesh);
    addVolume(cryptCx, topY - 0.65, topY, sz, 5.5, cryptStepD + 0.14, false, true);
  }

  // Subterranean Crypt Floor & Vaulted North Coffin Canopy
  const cryptFloor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.5, 10.2), mats.darkStone);
  cryptFloor.position.set(cryptCx, -2.65, -46.4);
  cryptFloor.receiveShadow = true;
  scene.add(cryptFloor);
  addVolume(cryptCx, -2.95, -2.4, -46.4, 7.2, 10.2, false, true);

  // Subterranean Retaining Stone Walls + Street-Level Parapets & Wrought-Iron Guardrails
  const sideWallGeo = new THREE.BoxGeometry(0.6, 2.85, 17.6);
  [-3.25, 3.25].forEach((ox) => {
    const wall = new THREE.Mesh(sideWallGeo, mats.darkStone);
    wall.position.set(cryptCx + ox, -1.25, -42.5);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    const sideFence = createWroughtIronFence(17.0, mats, 1.05);
    sideFence.position.set(cryptCx + ox, 0, -42.5);
    sideFence.rotation.y = Math.PI / 2;
    scene.add(sideFence);
    addVolume(cryptCx + ox, -2.8, 0.95, -42.5, 0.75, 17.6, true, false);
  });

  const northRetain = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.0, 0.7), mats.darkStone);
  northRetain.position.set(cryptCx, -1.3, -51.25);
  northRetain.castShadow = true;
  northRetain.receiveShadow = true;
  scene.add(northRetain);
  const northFence = createWroughtIronFence(6.8, mats, 1.15);
  northFence.position.set(cryptCx, 0, -51.25);
  scene.add(northFence);
  addVolume(cryptCx, -2.8, 1.25, -51.25, 7.2, 0.75, true, false);

  // Entrance Gothic Archway & Twin Crimson Braziers at Street Level (z = -33.6)
  const cryptArch = createStoneArchway(7.2, 4.1, 1.4, mats);
  cryptArch.position.set(cryptCx, 0, -33.6);
  scene.add(cryptArch);
  addVolume(cryptCx - 3.0, 0, 4.4, -33.6, 1.1, 1.4, true, false);
  addVolume(cryptCx + 3.0, 0, 4.4, -33.6, 1.1, 1.4, true, false);
  addVolume(cryptCx, 4.1, 5.7, -33.6, 7.2, 1.5, true, true);

  const brazierFlameMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.4, 0.55, 0.35),
    toneMapped: false,
  });
  [-2.6, 2.6].forEach((bx) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.05, 6), mats.iron);
    stand.position.set(cryptCx + bx, 0.525, -32.4);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 0.25, 6), mats.darkStone);
    bowl.position.set(cryptCx + bx, 1.12, -32.4);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), brazierFlameMat);
    flame.position.set(cryptCx + bx, 1.38, -32.4);
    scene.add(stand, bowl, flame);
  });
  const cryptBeacon = new THREE.PointLight(0xdc2626, 14, 15, 1.8);
  cryptBeacon.position.set(cryptCx, 2.2, -33.6);
  scene.add(cryptBeacon);

  // Far-North Shrine Canopy over the Coffin (leaves stairwell camera unobstructed)
  const canopyDeck = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.45, 4.2), mats.darkStone);
  canopyDeck.position.set(cryptCx, 1.55, -49.0);
  canopyDeck.castShadow = true;
  const canopySpire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 4), mats.roof);
  canopySpire.position.set(cryptCx, 2.85, -49.0);
  canopySpire.rotation.y = Math.PI / 4;
  scene.add(canopyDeck, canopySpire);
  [
    [-2.7, -47.2],
    [2.7, -47.2],
    [-2.7, -50.6],
    [2.7, -50.6],
  ].forEach(([px, pz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.8, 0.55), mats.stone);
    p.position.set(cryptCx + px, -0.5, pz);
    p.castShadow = true;
    scene.add(p);
    addVolume(cryptCx + px, -2.4, 1.5, pz, 0.65, 0.65, true, false);
  });

  // Interactive Vampire Coffin inside Subterranean Crypt
  const coffin = createVampireCoffin(mats);
  coffin.position.copy(coffinPos);
  scene.add(coffin);
  addVolume(coffinPos.x, -2.4, -1.2, coffinPos.z, 2.0, 3.1, false, true);
  shadowZones.push({ x: cryptCx, y: -2.4, z: -44.0, radius: 11.0 });

  // =========================================================================
  // SECTOR 4: CEMITÉRIO E MANSÃO (x in [34, 86], z in [-22, 44])
  // =========================================================================
  // Secondary Crimson Blood Altar inside Cemetery Sector
  const altarPos = new THREE.Vector3(44, 0, 24);
  const altarGroup = createBloodAltar(mats);
  altarGroup.position.copy(altarPos);
  scene.add(altarGroup);
  addVolume(altarPos.x, 0, 1.5, altarPos.z, 4.2, 4.2, false, true);
  shadowZones.push({ x: altarPos.x, y: 0, z: altarPos.z, radius: 10.5 });

  // Gothic Mausoleums in Cemetery
  const mausoleumCoords: Array<[number, number, number]> = [
    [42.0, -9.0, 0],
    [54.5, -11.0, Math.PI / 2],
    [54.5, 34.0, Math.PI],
  ];
  mausoleumCoords.forEach(([mx, mz, rot]) => {
    const m = createMausoleum(mats);
    m.position.set(mx, 0, mz);
    m.rotation.y = rot;
    scene.add(m);
    const isEW = Math.abs(Math.sin(rot)) > 0.7;
    addVolume(mx, 0, 6.2, mz, isEW ? 7.6 : 6.4, isEW ? 6.4 : 7.6, true, false);
  });

  // Gravestones arranged neatly in cemetery lawn rows
  const gravePositions: Array<[number, number]> = [
    [39, 4], [44, 4], [49, 4],
    [39, 11], [44, 11], [49, 11],
    [38, 18], [50, 18],
    [38, 36], [49, 38],
    [39, -18], [48, -18],
  ];
  gravePositions.forEach(([gx, gz], idx) => {
    const g = createGravestone(mats, idx);
    g.position.set(gx, 0, gz);
    g.rotation.y = ((idx % 3) - 1) * 0.1;
    scene.add(g);
    addVolume(gx, 0, 1.2, gz, 1.0, 0.7, false, true);
  });

  // Wrought-iron interior cemetery divider fences & Cathedral Plaza flanking ironwork
  const ironFenceSpecs: Array<[number, number, number, number]> = [
    [34.5, -14, 11, Math.PI / 2],
    [34.5, 14, 11, Math.PI / 2],
    [34.5, 36, 10, Math.PI / 2],
    [-19.5, -34.0, 8.5, 0],
    [33.5, -34.0, 8.5, 0],
  ];
  ironFenceSpecs.forEach(([fx, fz, len, rot]) => {
    const fence = createWroughtIronFence(len, mats, 1.95);
    fence.position.set(fx, 0, fz);
    fence.rotation.y = rot;
    scene.add(fence);
    const isNS = Math.abs(Math.sin(rot)) > 0.7;
    addVolume(fx, 0, 2.1, fz, isNS ? 0.65 : len, isNS ? len : 0.65, false, false);
  });

  // Grand Noble Victorian Manor (East side of Cemetery & Manor Sector)
  const manor = createVictorianManor(mats);
  manor.position.set(76, 0, 2);
  scene.add(manor);
  addVolume(76, 0, 14, 2, 19.5, 15.0, true, false);

  // Hedged Aristocratic Garden Maze & Elevated Garden Terrace (x in [58, 69])
  const hedgeBlocks: Array<[number, number, number, number]> = [
    [62.5, -14, 7.5, 1.8],
    [62.5, -4, 7.5, 1.8],
    [62.5, 10, 7.5, 1.8],
    [62.5, 28, 7.5, 1.8],
  ];
  hedgeBlocks.forEach(([hx, hz, hw, hd]) => {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(hw, 1.7, hd), mats.hedge);
    hedge.position.set(hx, 0.85, hz);
    hedge.castShadow = true;
    hedge.receiveShadow = true;
    scene.add(hedge);
    addVolume(hx, 0, 1.7, hz, hw, hd, true, true);
  });

  // Manor Garden Elevated Terrace (y = 4.0m) + Staircase
  const gardenTerrace = createGothicPlatform(6.0, 4.0, 6.0, mats, { withRailings: true, pillars: true });
  gardenTerrace.position.set(63.0, 0, 20.0);
  scene.add(gardenTerrace);
  addVolume(63.0, 3.45, 4.0, 20.0, 6.0, 6.0, false, true);

  const gardenStair = createStoneStaircase(2.8, 4.0, 6.4, 8, mats, 'north');
  gardenStair.position.set(63.0, 0, 26.2);
  scene.add(gardenStair);
  addStairVolumes(63.0, 26.2, 2.8, 4.0, 6.4, 8, 'north');

  // Extra Shadow Alley Pockets across the 4 districts
  shadowZones.push(
    { x: -21, y: 0, z: 7, radius: 4.5 },
    { x: -31, y: 0, z: -2, radius: 5.5 },
    { x: -31, y: 0, z: 22, radius: 5.5 },
    { x: -54, y: 0, z: 2, radius: 5.5 },
    { x: -54, y: 0, z: 26, radius: 5.5 },
    { x: 20.5, y: 0, z: 7, radius: 4.5 },
    { x: 48, y: 0, z: 0, radius: 6.0 },
    { x: 60, y: 0, z: 18, radius: 5.0 },
    { x: 0, y: 0, z: -72, radius: 6.5 },
  );

  // =========================================================================
  // INTERACTIVE GAS STREETLAMPS (placed cleanly beside curbs & plazas)
  // =========================================================================
  const lampCoords: Array<[number, number]> = [
    [-9.5, -18], [9.5, -18],
    [-13.5, 4.0], [13.5, 4.0],
    [-13.5, 36.0], [13.5, 36.0],
    [0, -29.0],
    [-28.0, -14.0], [-28.0, 14.0],
    [-49.5, -12.0], [-49.5, 20.0],
    [28.5, -16.0], [28.5, 6.0], [28.5, 28.0],
    [-48.0, 48.0], [-20.0, 48.0], [20.0, 48.0], [48.0, 48.0],
    [-36.0, 68.5], [0, 68.5], [36.0, 68.5],
    [54.0, 14.0], [58.0, -20.0],
    [-22.0, -68.0], [22.0, -68.0],
  ];
  lampCoords.forEach(([lx, lz], idx) => {
    const lamp = createStreetLamp(idx, lx, lz, mats, textures);
    scene.add(lamp.group);
    lamps.push(lamp);
    addVolume(lx, 0, 5.2, lz, 0.7, 0.7, false, false);
  });

  // =========================================================================
  // INTERACTIVE GOTHIC ALARM BELLS (5 across the 4 districts)
  // =========================================================================
  const bellSpecs: Array<[string, number, number]> = [
    ['Sino da Praça da Fonte', -4.5, -6.5],
    ['Sino do Adro da Catedral', 4.8, -26.2],
    ['Sino dos Becos Oeste', -34.5, 38.0],
    ['Sino da Avenida Vitoriana', 25.2, 10.5],
    ['Sino dos Jardins da Mansão', 59.5, 6.0],
  ];
  bellSpecs.forEach(([name, bx, bz], idx) => {
    const bell = createAlarmBell(idx, name, bx, bz, mats);
    scene.add(bell.group);
    bells.push(bell);
    addVolume(bx, 0, 4.5, bz, 1.3, 1.3, false, false);
  });

  // =========================================================================
  // BREAKABLE BARRELS & CERAMIC URNS
  // =========================================================================
  const breakableSpecs: Array<['barrel' | 'urn', number, number, number]> = [
    ['urn', -4.2, 0, -2.5],
    ['urn', 4.2, 0, 2.5],
    ['barrel', -14.8, 0.24, -14.0],
    ['barrel', 14.8, 0.24, -14.0],
    ['urn', -28.0, 0, -5.0],
    ['barrel', -33.0, 0, 24.0],
    ['urn', -51.5, 0, 4.0],
    ['barrel', -51.5, 0, 24.0],
    ['barrel', 26.5, 0.24, -4.0],
    ['urn', 26.5, 0.24, 18.0],
    ['urn', -4.0, 0, -25.0],
    ['barrel', 4.0, 0, -25.0],
    ['barrel', -22.0, 0, 50.2],
    ['urn', 18.0, 0, 50.2],
    ['urn', 57.5, 0, -2.0],
    ['barrel', 57.5, 0, 14.0],
    ['urn', -15.0, 0, -64.0],
    ['barrel', 15.0, 0, -64.0],
  ];
  breakableSpecs.forEach(([kind, px, py, pz], idx) => {
    const prop = createBreakableProp(idx + 1, kind, px, py, pz, mats);
    scene.add(prop.group);
    breakables.push(prop);
  });

  // =========================================================================
  // MEMORY FRAGMENTS (8 lore notes matched to the 4 districts)
  // =========================================================================
  const memoryCoords: Record<string, [number, number, number]> = {
    'mem-1': [41.5, 0, 21.5],     // Cemitério — Próximo à Cripta Segura
    'mem-2': [-4.4, 0, 3.8],       // Avenida Vitoriana — Praça da Fonte
    'mem-3': [0, 4.0, -14.0],      // Adro da Catedral Norte — Ponte Suspensa
    'mem-4': [63.0, 4.0, 20.0],    // Cemitério e Mansão — Terraço dos Jardins
    'mem-5': [-21.0, 6.2, 7.0],    // Becos e Vielas Estreitas — Passarela Superior
    'mem-6': [-29.5, 0, 24.5],     // Becos e Vielas Estreitas — Bueiro Sul
    'mem-7': [0, 3.6, -38.0],      // Adro da Catedral Norte — Balcão do Vitral
    'mem-8': [4.2, 0, 60.5],       // Avenida Vitoriana — Carruagem do Portão Sul
  };
  MEMORY_FRAGMENTS.forEach((def) => {
    const coords = memoryCoords[def.id];
    if (!coords) return;
    const frag = createMemoryFragment(def.id, def.title, coords[0], coords[1], coords[2], mats);
    scene.add(frag.group);
    memories.push(frag);
  });

  // =========================================================================
  // WIND-REACTIVE BANNERS, CURTAINS & SMOKE CHIMNEYS
  // =========================================================================
  const bannerSpecs: Array<[number, number, number, number, number, number, 'crimson' | 'indigo']> = [
    [-5.2, 11.2, -39.2, 1.5, 4.6, 0, 'crimson'],
    [5.2, 11.2, -39.2, 1.5, 4.6, 0, 'crimson'],
    [-7.5, 3.9, -11.8, 1.25, 3.1, 0, 'indigo'],
    [7.5, 3.9, -11.8, 1.25, 3.1, 0, 'indigo'],
    [-7.5, 3.9, 21.8, 1.25, 3.1, Math.PI, 'crimson'],
    [7.5, 3.9, 21.8, 1.25, 3.1, Math.PI, 'crimson'],
    [-7.5, 7.8, 61.8, 1.4, 3.8, Math.PI, 'crimson'],
    [7.5, 7.8, 61.8, 1.4, 3.8, Math.PI, 'crimson'],
    [66.2, 9.2, 2.0, 1.5, 4.2, -Math.PI / 2, 'crimson'],
    [-42.0, 9.2, 24.2, 1.35, 3.8, 0, 'indigo'],
  ];
  bannerSpecs.forEach(([bx, by, bz, bw, bh, rotY, colorKind]) => {
    const clothMat = colorKind === 'crimson' ? mats.clothCrimson : mats.clothIndigo;
    const banner = createGothicBanner(bw, bh, clothMat, mats);
    banner.position.set(bx, by, bz);
    banner.rotation.y = rotY;
    scene.add(banner);
  });

  const curtainSpecs: Array<[number, number, number, number, number, number, 'crimson' | 'indigo']> = [
    [0, 7.6, -39.4, 3.2, 3.6, 0, 'crimson'],
    [-21.0, 5.9, 2.9, 2.6, 3.2, 0, 'indigo'],
    [20.5, 5.9, 2.9, 2.6, 3.2, 0, 'crimson'],
    [-21.0, 5.9, 11.1, 2.6, 3.2, Math.PI, 'indigo'],
    [20.5, 5.9, 11.1, 2.6, 3.2, Math.PI, 'crimson'],
  ];
  curtainSpecs.forEach(([cx, cy, cz, cw, ch, rotY, colorKind]) => {
    const clothMat = colorKind === 'crimson' ? mats.clothCrimson : mats.clothIndigo;
    const curtain = createDrapedCurtain(cw, ch, clothMat, mats);
    curtain.position.set(cx, cy, cz);
    curtain.rotation.y = rotY;
    scene.add(curtain);
  });

  const chimneySpots: Array<[number, number, number]> = [
    [-23.0, 6.2, -4.5],
    [22.5, 6.2, -4.5],
    [-23.0, 6.2, 18.5],
    [22.5, 6.2, 18.5],
    [-44.0, 6.2, 12.5],
    [-68.0, 6.2, 14.0],
  ];
  chimneySpots.forEach(([sx, sy, sz]) => {
    const ch = createSmokeChimney(mats);
    ch.position.set(sx, sy, sz);
    scene.add(ch);
    smokeSources.push(new THREE.Vector3(sx, sy + 2.35, sz));
  });

  // =========================================================================
  // PERIMETER CLIFFS, DEAD TREES & IRON FENCING
  // =========================================================================
  const perimeterTrees: Array<[number, number]> = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const rad = 96 + (i % 4) * 7;
    perimeterTrees.push([Math.cos(angle) * rad, Math.sin(angle) * rad]);
  }
  // Cemetery & Manor interior twisted trees (kept clear of walk lanes)
  perimeterTrees.push([38, -2], [51, 22], [37, 29], [58, 39], [68, -22], [68, 30]);
  perimeterTrees.forEach(([tx, tz], idx) => {
    const tree = createDeadTree(mats, idx + 1);
    tree.position.set(tx, 0, tz);
    scene.add(tree);
  });

  const rockGeo = new THREE.DodecahedronGeometry(7.2, 0);
  const rockInst = new THREE.InstancedMesh(rockGeo, mats.darkStone, 44);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const r = 106 + (i % 3) * 8;
    dummy.position.set(Math.cos(a) * r, 2.2, Math.sin(a) * r);
    dummy.rotation.set(i * 0.4, i * 0.7, 0);
    dummy.scale.set(1.2 + (i % 3) * 0.4, 1.5 + (i % 4) * 0.6, 1.1);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);

  const postGeo = new THREE.BoxGeometry(0.35, 2.8, 0.35);
  const railGeo = new THREE.BoxGeometry(5.5, 0.14, 0.14);
  const bound = 90;
  for (let p = -bound; p <= bound; p += 5.5) {
    const spots: Array<[number, number, number]> = [
      [p, -bound, 0],
      [p, bound, 0],
      [-bound, p, Math.PI / 2],
      [bound, p, Math.PI / 2],
    ];
    for (const [fx, fz, rot] of spots) {
      if (fz < -89) continue;
      const post = new THREE.Mesh(postGeo, mats.iron);
      post.position.set(fx, 1.4, fz);
      const rail = new THREE.Mesh(railGeo, mats.iron);
      rail.position.set(fx, 2.1, fz);
      rail.rotation.y = rot;
      scene.add(post, rail);
    }
  }

  // =========================================================================
  // AUDITED UNOBSTRUCTED PATROL ROUTES BY DISTRICT & ARCHETYPE
  // =========================================================================
  const v = (x: number, z: number, y = 0) => new THREE.Vector3(x, y, z);

  // Civilians stroll along raised Avenida Vitoriana sidewalks & plaza perimeters
  const citizenRoutes = [
    // East Central Sidewalk (y=0.24)
    [v(12.8, -12, 0.24), v(12.8, 34, 0.24), v(11.6, 34, 0.24), v(11.6, -12, 0.24)],
    // West Central Sidewalk (y=0.24)
    [v(-12.8, 34, 0.24), v(-12.8, -12, 0.24), v(-11.6, -12, 0.24), v(-11.6, 34, 0.24)],
    // Eastern Shopfront Sidewalk (y=0.24)
    [v(28.5, -14, 0.24), v(28.5, 36, 0.24), v(27.5, 36, 0.24), v(27.5, -14, 0.24)],
    // Southern Boulevard North Sidewalk (y=0.24)
    [v(-56, 48.0, 0.24), v(56, 48.0, 0.24), v(56, 46.8, 0.24), v(-56, 46.8, 0.24)],
    // Southern Boulevard South Sidewalk (y=0.24)
    [v(56, 68.5, 0.24), v(-56, 68.5, 0.24), v(-56, 67.2, 0.24), v(56, 67.2, 0.24)],
    // Central Fountain Square Perimeter
    [v(-6.2, 16), v(-6.2, -10), v(6.2, -10), v(6.2, 16)],
    // Alleys South Walk
    [v(-56, 42.5), v(-16, 42.5), v(-16, 45.0), v(-56, 45.0)],
    // North Cathedral Plaza Crosswalk
    [v(-18, -30.5), v(18, -30.5), v(18, -26.5), v(-18, -26.5)],
  ];

  // Beggars linger in Becos e Vielas & under arches
  const beggarRoutes = [
    [v(-33.5, 2.0), v(-29.0, 2.0), v(-29.0, 14.0), v(-33.5, 14.0)],
    [v(-56.5, -2.0), v(-51.5, -2.0), v(-51.5, 14.0), v(-56.5, 14.0)],
    [v(-35.5, 24.0), v(-29.0, 24.0), v(-29.0, 34.0), v(-35.5, 34.0)],
    [v(-10.0, 52.0), v(10.0, 52.0), v(10.0, 54.5), v(-10.0, 54.5)],
  ];

  // Cultists patrol Cathedral North Cloisters & Outer Cemetery Mausoleums (avoiding Safe Crypt!)
  const cultistRoutes = [
    [v(-18, -68), v(18, -68), v(18, -73), v(-18, -73)],
    [v(-8.5, -34.5), v(8.5, -34.5), v(8.5, -28.0), v(-8.5, -28.0)],
    [v(-56.0, -34.0), v(-38.0, -34.0), v(-38.0, -24.0), v(-56.0, -24.0)],
    [v(38.0, -22.0), v(58.0, -22.0), v(58.0, -16.0), v(38.0, -16.0)],
  ];

  // Isolated Nobles stroll Manor Hedged Gardens, North Avenue & Cathedral Terrace
  const nobleRoutes = [
    [v(56.5, -18.0), v(62.5, -18.0), v(62.5, -8.5), v(56.5, -8.5)],
    [v(56.5, 2.0), v(62.5, 2.0), v(62.5, 16.0), v(56.5, 16.0)],
    [v(28.5, -12, 0.24), v(32.5, -12), v(32.5, 24), v(28.5, 24, 0.24)],
    [v(-6.8, -28.0), v(6.8, -28.0), v(6.8, -19.0), v(-6.8, -19.0)],
    [v(-10.0, 68.5, 0.24), v(18.0, 68.5, 0.24), v(18.0, 66.0), v(-10.0, 66.0)],
  ];

  // Patrol Guards keep streets watched while leaving Safe Crypt (44, 0, 29.5) unpatrolled!
  const guardRoutes = [
    [v(-7.5, -26), v(7.5, -26), v(7.5, 10), v(-7.5, 10)],
    [v(-34.5, -16), v(-28.5, -16), v(-28.5, 22), v(-34.5, 22)],
    [v(-57.0, -18), v(-51.5, -18), v(-51.5, 28), v(-57.0, 28)],
    [v(26.5, -22), v(31.5, -22), v(31.5, 34), v(26.5, 34)],
    [v(-11, -14, 4.0), v(11, -14, 4.0)], // Elevated North Skybridge Sentinel
    [v(-44, 52.5), v(44, 52.5), v(44, 62.5), v(-44, 62.5)],
    [v(53.0, -24), v(59.0, -24), v(59.0, 12), v(53.0, 12)], // Manor West Garden Watch (stops north of Crypt)
    [v(-20, -69), v(20, -69), v(20, -65.5), v(-20, -65.5)],
    [v(-24, 42.5), v(24, 42.5), v(24, 46.0), v(-24, 46.0)],
  ];

  // Vampire Hunters spawn and patrol Avenida Vitoriana & Main Crossroads as Infamy climbs
  const hunterRoutes = [
    [v(-48, 56.0), v(48, 56.0), v(48, 64.0), v(-48, 64.0)],
    [v(-7.5, 42.0), v(7.5, 42.0), v(7.5, -18.0), v(-7.5, -18.0)],
    [v(26.5, -18.0), v(32.0, -18.0), v(32.0, 44.0), v(26.5, 44.0)],
    [v(-34.0, -26.0), v(34.0, -26.0), v(34.0, -20.0), v(-34.0, -20.0)],
  ];

  return {
    volumes,
    lamps,
    bells,
    breakables,
    memories,
    smokeSources,
    shadowZones,
    altarPos,
    coffinPos,
    safeSpawnPos,
    cryptBounds,
    altarGroup,
    citizenRoutes,
    beggarRoutes,
    cultistRoutes,
    nobleRoutes,
    guardRoutes,
    hunterRoutes,
    playableBounds: { minX: -88, maxX: 88, minZ: -82, maxZ: 84 },
  };
}
