import * as THREE from 'three';
import type { GothicMaterialLibrary } from './materials';
import {
  createAlarmBell,
  createAlleyClutterCluster,
  createBloodAltar,
  createBreakableProp,
  createCathedral,
  createCemeteryMonument,
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
  createThresholdBollards,
  createVampireCoffin,
  createVictorianBuilding,
  createVictorianCarriage,
  createVictorianManor,
  createVictorianStreetFurniture,
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
  cemeteryBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
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
      const isTopStep = i === steps - 1;
      const topExtra = isTopStep ? 0.28 : 0;
      const localZ = -length / 2 + stepD * (i + 0.5) + topExtra * 0.5;
      let sx = cx;
      let sz = cz;
      let sw = w;
      let sd = stepD + 0.22 + topExtra;
      if (dir === 'south') {
        sz = cz + localZ;
      } else if (dir === 'north') {
        sz = cz - localZ;
      } else if (dir === 'east') {
        sx = cx + localZ;
        sw = stepD + 0.22 + topExtra;
        sd = w;
      } else {
        sx = cx - localZ;
        sw = stepD + 0.22 + topExtra;
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

  // North Cloister Flanking Buildings, Rear Abbey Row & Labyrinthine Priory Wings
  const cathedralBlocks: Array<{ x: number; z: number; w: number; h: number; d: number; spire?: boolean; roofDeckY?: number }> = [
    { x: -30, z: -58, w: 12, h: 10.5, d: 11, spire: true },
    { x: 30, z: -58, w: 12, h: 10.5, d: 11, spire: true },
    { x: -54, z: -48, w: 12, h: 6.2, d: 11, roofDeckY: 6.2 },
    { x: 54, z: -48, w: 12, h: 6.2, d: 11, roofDeckY: 6.2 },
    { x: -72, z: -56, w: 12, h: 11, d: 12 },
    { x: 72, z: -56, w: 12, h: 11, d: 12 },
    // Rear Abbey Row (north of -73 cultist route)
    { x: -15.5, z: -79.2, w: 11, h: 10.2, d: 6.2 },
    { x: 0, z: -79.5, w: 12, h: 11.5, d: 6.4, spire: true },
    { x: 15.5, z: -79.2, w: 11, h: 10.2, d: 6.2 },
    // North-West Cloister Labyrinth (clear of -51.4..-54.8 scaffold & -56..-38 cultists)
    { x: -41.5, z: -45.0, w: 7.4, h: 8.8, d: 8.0 },
    { x: -39.0, z: -68.0, w: 9.5, h: 9.8, d: 9.0 },
    { x: -58.0, z: -71.0, w: 10.0, h: 9.5, d: 8.5 },
    { x: -74.0, z: -72.0, w: 10.0, h: 10.4, d: 9.0 },
    { x: -78.0, z: -39.0, w: 8.5, h: 9.2, d: 9.5 },
    { x: -65.0, z: -37.2, w: 7.0, h: 7.8, d: 6.2 },
    // North-East Priory Quarter (clear of cryptBounds, 54.8 scaffold & 59..74 cultists)
    { x: 41.5, z: -45.5, w: 7.4, h: 8.8, d: 8.2 },
    { x: 39.0, z: -68.0, w: 9.5, h: 9.8, d: 9.0 },
    { x: 58.0, z: -71.0, w: 10.0, h: 9.5, d: 8.5 },
    { x: 75.0, z: -72.0, w: 10.0, h: 10.4, d: 9.0 },
    { x: 75.0, z: -39.5, w: 9.0, h: 9.4, d: 7.5 },
    { x: 64.5, z: -38.5, w: 6.8, h: 8.0, d: 6.6 },
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

  // Gothic Iron-and-Stone Transition Gateways framing sector entries cleanly without blocking routes
  const addIronGateTransition = (
    cx: number,
    cz: number,
    spanWidth: number,
    height: number,
    rotY: number,
  ) => {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(cx, 0, cz);
    gateGroup.rotation.y = rotY;

    const halfSpan = spanWidth / 2;
    [-halfSpan, halfSpan].forEach((px) => {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 1.15), mats.darkStone);
      plinth.position.set(px, 0.275, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.86, height - 0.55, 0.86), mats.stone);
      shaft.position.set(px, 0.55 + (height - 0.55) / 2, 0);
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.26, 1.06), mats.darkStone);
      cap.position.set(px, height + 0.13, 0);
      const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mats.iron);
      finial.position.set(px, height + 0.48, 0);
      gateGroup.add(plinth, shaft, cap, finial);
    });

    const ironBeam = new THREE.Mesh(new THREE.BoxGeometry(spanWidth + 0.4, 0.18, 0.22), mats.iron);
    ironBeam.position.set(0, height - 0.08, 0);
    const ironCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mats.brass);
    ironCrest.position.set(0, height + 0.24, 0);
    gateGroup.add(ironBeam, ironCrest);
    scene.add(gateGroup);

    const isRotatedNS = Math.abs(Math.sin(rotY)) > 0.7;
    [-halfSpan, halfSpan].forEach((px) => {
      const worldX = cx + (isRotatedNS ? 0 : px);
      const worldZ = cz + (isRotatedNS ? -px : 0);
      addVolume(worldX, 0, height + 0.5, worldZ, 1.05, 1.05, true, false);
    });
  };

  // Cemetery & Manor Wrought-Iron Gateways (aligned flush with fence gaps along x = 34.5)
  addIronGateTransition(34.5, 0.0, 9.2, 4.3, Math.PI / 2);
  addIronGateTransition(34.5, 25.0, 8.0, 4.3, Math.PI / 2);

  // Alleyway Brick-and-Iron Gateways framing Becos e Vielas entrances along x = -16.5
  addIronGateTransition(-16.5, 7.0, 7.4, 4.2, Math.PI / 2);
  addIronGateTransition(-16.5, 25.0, 7.4, 4.2, Math.PI / 2);

  // Cathedral <-> Avenue Threshold Piers (z = -23.0)
  [-15.5, 15.5].forEach((px) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3.6, 0.95), mats.darkStone);
    pier.position.set(px, 1.8, -23.0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.75, 4), mats.iron);
    cap.position.set(px, 3.95, -23.0);
    cap.rotation.y = Math.PI / 4;
    scene.add(pier, cap);
    addVolume(px, 0, 4.1, -23.0, 0.95, 0.95, true, false);
  });

  // Visual Threshold Bollards & Stone Aprons bridging all 4 city sectors
  const sectorThresholds: Array<[number, number, number, number, 'amber' | 'crimson' | 'iron']> = [
    [0, -23.0, 14.5, 0, 'amber'],                  // Adro da Catedral <-> Avenida Vitoriana
    [-25.0, -24.0, 7.6, 0, 'iron'],                // Adro da Catedral <-> Becos Oeste
    [40.0, -24.0, 7.6, 0, 'iron'],                 // Adro da Catedral <-> Cemitério Leste
    [-16.5, 7.0, 6.2, Math.PI / 2, 'amber'],       // Avenida <-> Becos (Passagem Norte)
    [-16.5, 25.0, 6.2, Math.PI / 2, 'amber'],      // Avenida <-> Becos (Passagem Sul)
    [34.5, 0.0, 7.4, Math.PI / 2, 'crimson'],      // Avenida <-> Cemitério (Portão Norte)
    [34.5, 25.0, 6.4, Math.PI / 2, 'crimson'],     // Avenida <-> Cemitério (Portão Sul)
    [-18.0, 45.0, 7.6, 0, 'amber'],                // Avenida Sul <-> Becos Oeste
    [22.0, 45.0, 7.6, 0, 'amber'],                 // Avenida Sul <-> Avenida Leste
  ];
  sectorThresholds.forEach(([tx, tz, span, rotY, accent]) => {
    const threshold = createThresholdBollards(mats, span, accent);
    threshold.position.set(tx, 0, tz);
    threshold.rotation.y = rotY;
    scene.add(threshold);
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
    { x: -21.2, z: -14.5, w: 8.2, h: 9.4, d: 6.0, brick: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: -21, z: -2, w: 8.5, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: -21, z: 16, w: 8.5, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: -21, z: 34, w: 9.5, h: 9.5, d: 10, brick: true, hasBalcony: true, roofStyle: 'pitched' },

    // Mid West Tenement Row (x = -42) + interlocking alley annexes
    { x: -42, z: -18.2, w: 9.2, h: 8.6, d: 4.0, brick: true, roofStyle: 'mansard' },
    { x: -42, z: -8, w: 10, h: 9.0, d: 11, brick: true, roofStyle: 'pitched' },
    { x: -42, z: 10, w: 10, h: 6.2, d: 10, roofDeckY: 6.2 },
    { x: -42, z: 30, w: 10, h: 9.8, d: 11, brick: true, hasBalcony: true, roofStyle: 'mansard' },

    // Far West Old Quarter (x = -66) + staggered cross-alley infill
    { x: -66, z: -23.2, w: 10.0, h: 9.4, d: 4.6, brick: true, roofStyle: 'pitched' },
    { x: -66, z: -12, w: 11, h: 10.0, d: 12, brick: true, roofStyle: 'pitched' },
    { x: -66, z: 0.0, w: 10.0, h: 8.8, d: 5.4, brick: false, hasBalcony: true, roofStyle: 'mansard' },
    { x: -66, z: 12, w: 10.5, h: 6.2, d: 12, roofDeckY: 6.2 },
    { x: -66, z: 23.0, w: 9.8, h: 9.6, d: 4.4, brick: true, roofStyle: 'pitched' },
    { x: -66, z: 34, w: 11, h: 10.5, d: 12, roofStyle: 'mansard' },

    // Outer West Slum & Watchtower Row (x = -80, separated by x = -73 smuggling alley)
    { x: -80, z: -12, w: 9.0, h: 7.8, d: 11, roofDeckY: 7.8 },
    { x: -79.5, z: 0.2, w: 8.0, h: 7.4, d: 5.0, brick: true, roofStyle: 'pitched' },
    { x: -80, z: 12, w: 9.0, h: 4.6, d: 11, roofDeckY: 4.6 },
    { x: -79.5, z: 23.2, w: 8.0, h: 8.2, d: 4.4, brick: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: -80, z: 34, w: 9.0, h: 10.2, d: 11, brick: true, hasBalcony: true, roofStyle: 'pitched' },
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
      win.position.set(b.x, Math.min(2.8, b.roofDeckY - 1.4), b.z + b.d / 2 - 0.1);
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

  // Interconnected Alley Rooftop Catwalks, Stepped Balconies & High Ambush Overlooks
  const addElevatedWalkway = (
    cx: number,
    height: number,
    cz: number,
    w: number,
    d: number,
    options: { withRailings?: boolean; pillars?: boolean } = {},
  ) => {
    const plat = createGothicPlatform(w, height, d, mats, {
      withRailings: options.withRailings ?? false,
      pillars: options.pillars ?? false,
    });
    plat.position.set(cx, 0, cz);
    scene.add(plat);
    addVolume(cx, height - 0.55, height, cz, w, d, false, true);
  };

  addElevatedWalkway(-21, 6.2, 7.0, 4.2, 8.4, { withRailings: true });
  addElevatedWalkway(-31.5, 6.2, 11.5, 12.5, 4.2, { pillars: true });
  shadowZones.push({ x: -31.5, y: 0, z: 11.5, radius: 5.2 });

  addElevatedWalkway(-54.0, 6.2, 11.0, 14.5, 4.2, { pillars: true });
  shadowZones.push({ x: -54.0, y: 0, z: 11.0, radius: 5.2 });

  // Far-West x = -73 stepped aerial network (4.6m -> 5.4m -> 6.2m and 4.6m -> 5.6m -> 6.7m -> 7.8m)
  addElevatedWalkway(-73.4, 4.6, 12.0, 7.2, 3.6, { withRailings: false });
  addElevatedWalkway(-70.2, 5.4, 12.0, 2.8, 3.6, { withRailings: false });
  addElevatedWalkway(-80.0, 5.6, 3.2, 4.4, 6.6, { withRailings: true });
  addElevatedWalkway(-80.0, 6.7, -3.2, 4.4, 6.6, { withRailings: true });
  shadowZones.push({ x: -80.0, y: 7.8, z: -12.0, radius: 5.5 });

  // Low-altitude Alley Ambush Beams (y = 3.2m, clear of ground patrol routes)
  addElevatedWalkway(-31.5, 3.2, 26.0, 12.0, 2.8, { withRailings: false });
  addElevatedWalkway(-54.0, 3.2, 24.5, 13.8, 2.8, { withRailings: false });

  // High Observation Perches (y = 7.0m, 7.3m, 7.8m, 8.4m)
  addElevatedWalkway(-21.0, 7.3, 22.8, 4.2, 3.6, { withRailings: true });
  addElevatedWalkway(-21.0, 8.4, 26.8, 5.8, 4.6, { withRailings: true });
  addElevatedWalkway(-42.0, 7.0, 3.0, 4.6, 4.0, { withRailings: true });
  addElevatedWalkway(-42.0, 7.8, -0.5, 6.4, 4.4, { withRailings: true });

  // Cantilevered Street-Facing Ambush Balconies overlooking Avenida Vitoriana
  addElevatedWalkway(-15.2, 4.6, -2.0, 3.4, 6.4, { withRailings: true });
  addElevatedWalkway(-15.2, 3.2, 16.0, 3.4, 6.4, { withRailings: true });
  addElevatedWalkway(14.5, 4.6, -2.0, 3.4, 6.4, { withRailings: true });
  addElevatedWalkway(14.5, 3.2, 16.0, 3.4, 6.4, { withRailings: true });
  addElevatedWalkway(20.5, 7.3, 22.8, 4.2, 3.6, { withRailings: true });
  addElevatedWalkway(20.5, 7.8, 26.8, 5.6, 4.4, { withRailings: true });

  // Climbable Alley Crates & Two-Stage Scaffolding Steps flush OUTSIDE flat-roof colliders (zero edge snagging)
  // Step progression: ground (0m) -> crate1 (1.5m) -> crate2 (2.9m) -> midDeck (3.45m) -> upperStep (5.05m) -> roof (6.2m)
  const scaffoldSpots: Array<{
    sx: number;
    sz: number;
    rot: number;
    px: number;
    pz: number;
    midX: number;
    midZ: number;
  }> = [
    // West Alley inner roof (-21, 16, minX=-25.25)
    { sx: -26.8, sz: 13.0, rot: 0, midX: -26.55, midZ: 14.5, px: -26.55, pz: 16.5 },
    // Mid Alley roof (-42, 10, minX=-47.0)
    { sx: -48.55, sz: 7.0, rot: 0, midX: -48.3, midZ: 8.5, px: -48.3, pz: 10.5 },
    // Far Alley roof (-66, 12, maxX=-60.75)
    { sx: -59.2, sz: 9.0, rot: Math.PI, midX: -59.45, midZ: 10.5, px: -59.45, pz: 12.5 },
    // East Avenue roof (20.5, -2, maxX=25.0)
    { sx: 26.55, sz: -4.8, rot: Math.PI, midX: 26.3, midZ: -3.2, px: 26.3, pz: -1.2 },
    // East Avenue roof (20.5, 16, maxX=25.0)
    { sx: 26.55, sz: 13.2, rot: Math.PI, midX: 26.3, midZ: 14.8, px: 26.3, pz: 16.8 },
    // Far West x = -80 mid-deck access (y = 4.6m)
    { sx: -75.0, sz: 18.8, rot: 0, midX: -76.5, midZ: 19.0, px: -78.8, pz: 19.0 },
    // North Cloister West & East flat roofs (-54, -48) and (54, -48) (south face maxZ=-42.5)
    { sx: -51.4, sz: -40.95, rot: 0, midX: -52.8, midZ: -41.2, px: -54.8, pz: -41.2 },
    { sx: 51.4, sz: -40.95, rot: Math.PI, midX: 52.8, midZ: -41.2, px: 54.8, pz: -41.2 },
  ];
  scaffoldSpots.forEach(({ sx, sz, rot, midX, midZ, px, pz }) => {
    const stack = createScaffoldingStack(mats);
    stack.position.set(sx, 0, sz);
    stack.rotation.y = rot;
    scene.add(stack);
    addVolume(sx, 0, 1.5, sz, 2.2, 2.2, false, true);
    addVolume(sx + (rot === 0 ? 0.25 : -0.25), 1.5, 2.9, sz, 1.65, 1.65, false, true);

    const midPlatform = createGothicPlatform(2.2, 3.45, 2.2, mats, { withRailings: false, pillars: true });
    midPlatform.position.set(midX, 0, midZ);
    scene.add(midPlatform);
    addVolume(midX, 2.9, 3.45, midZ, 2.2, 2.2, false, true);

    const upperPlatform = createGothicPlatform(2.6, 5.05, 2.8, mats, { withRailings: false, pillars: true });
    upperPlatform.position.set(px, 0, pz);
    scene.add(upperPlatform);
    addVolume(px, 4.5, 5.05, pz, 2.6, 2.8, false, true);
  });

  // Steaming Sewer Grates in Becos e Vielas, Avenida Vitoriana & Sector Transitions
  const sewerSpots: Array<[number, number]> = [
    [-31.0, 22.0],
    [-31.0, -4.0],
    [-54.0, 2.0],
    [-54.0, 26.0],
    [-73.0, -6.0],
    [-73.0, 6.0],
    [-73.0, 24.0],
    [-42.0, 20.0],
    [-42.0, -21.0],
    [10.2, 18.0],
    [-10.2, 34.0],
    [-25.0, -20.5],
    [-16.0, 7.0],
    [-16.0, 25.0],
    [33.5, 0.0],
    [0.0, 44.5],
    [-42.85, 76.5],
    [42.85, 76.5],
    [-72.8, 59.0],
    [72.8, 59.0],
    [-48.0, -45.0],
    [48.0, -45.0],
    [75.0, 11.5],
  ];
  sewerSpots.forEach(([gx, gz]) => {
    const grate = createSewerGrate(mats);
    grate.position.set(gx, 0, gz);
    scene.add(grate);
    smokeSources.push(new THREE.Vector3(gx, 0.25, gz));
  });

  // Thief-Style Alley Cargo Clusters & Line-of-Sight Flank Alcoves (strictly hugging walls off patrol lanes)
  const alleyClutterSpecs: Array<[number, number, number, 0 | 1 | 2, boolean]> = [
    [-36.1, -8.0, Math.PI / 2, 0, false],
    [-36.1, 10.0, Math.PI / 2, 1, false],
    [-36.1, 23.0, Math.PI / 2, 0, true],   // Climbable flank crate corner
    [-36.1, 30.0, Math.PI / 2, 2, false],
    [-26.3, -3.5, -Math.PI / 2, 1, false],
    [-26.3, 34.0, -Math.PI / 2, 0, false],
    [-59.6, -12.0, Math.PI / 2, 2, false],
    [-59.6, 22.0, Math.PI / 2, 0, true],   // Climbable flank crate corner
    [-59.6, 34.0, Math.PI / 2, 1, false],
    [-72.8, -11.5, -Math.PI / 2, 0, false],
    [-72.8, 12.0, -Math.PI / 2, 1, true],
    [-72.8, 34.0, -Math.PI / 2, 2, false],
    [-48.0, 41.2, 0, 1, false],            // South alley escape threshold clutter
  ];
  alleyClutterSpecs.forEach(([ax, az, rot, variant, climbable]) => {
    const clutter = createAlleyClutterCluster(mats, variant);
    clutter.position.set(ax, 0, az);
    clutter.rotation.y = rot;
    scene.add(clutter);
    const isNS = Math.abs(Math.sin(rot)) > 0.7;
    addVolume(
      ax,
      0,
      climbable ? 1.45 : 1.35,
      az,
      isNS ? 1.15 : 1.95,
      isNS ? 1.95 : 1.15,
      true,
      climbable,
    );
  });

  // Western Alleyway Bypass Arches, Tight First-Person Overpasses & Semi-Enclosed Courtyards
  const alleyArchSpecs: Array<[number, number, number, number, number, number]> = [
    // Main alley bypasses
    [-54.0, 39.2, 8.8, 4.8, 2.0, 0],
    [-73.2, -24.0, 7.6, 4.8, 2.0, 0],
    [-73.2, 41.4, 7.6, 4.8, 2.0, 0],
    // First-person overhead framing arches along Becos e Vielas (piers tucked flush outside patrol lanes)
    [-31.5, -9.5, 10.6, 4.1, 2.0, 0],
    [-31.5, 3.2, 10.6, 4.1, 2.0, 0],
    [-31.5, 20.0, 10.6, 4.1, 2.0, 0],
    [-54.0, -7.5, 11.4, 4.2, 2.0, 0],
    [-54.0, 19.5, 11.4, 4.2, 2.0, 0],
    [-73.2, 1.5, 7.6, 4.1, 1.8, 0],
    [-73.2, 24.5, 7.6, 4.1, 1.8, 0],
    [-73.2, -12.0, 7.6, 4.1, 1.8, 0],
    [-73.2, 34.0, 7.6, 4.1, 1.8, 0],
    [-42.0, -56.0, 9.6, 4.2, 2.0, 0],
    [41.5, -56.0, 9.6, 4.2, 2.0, 0],
    // Covered East-West Cross-Passage Arcades linking Avenue & Alleys (clear 4.7m floor path under y=6.2 catwalk)
    [-21.0, 7.0, 7.4, 3.85, 2.4, Math.PI / 2],
    [20.5, 7.0, 7.4, 3.85, 2.4, Math.PI / 2],
  ];
  alleyArchSpecs.forEach(([ax, az, aw, ah, ad, rot]) => {
    const arch = createStoneArchway(aw, ah, ad, mats);
    arch.position.set(ax, 0, az);
    arch.rotation.y = rot;
    scene.add(arch);
    const pierOffset = aw * 0.5 - 0.75;
    const isEW = Math.abs(Math.sin(rot)) > 0.7;
    if (isEW) {
      addVolume(ax, 0, ah + 0.4, az - pierOffset, ad, 1.5, true, false);
      addVolume(ax, 0, ah + 0.4, az + pierOffset, ad, 1.5, true, false);
      addVolume(ax, ah, ah + 1.35, az, ad + 0.1, aw, true, true);
    } else {
      addVolume(ax - pierOffset, 0, ah + 0.4, az, 1.5, ad, true, false);
      addVolume(ax + pierOffset, 0, ah + 0.4, az, 1.5, ad, true, false);
      addVolume(ax, ah, ah + 1.35, az, aw, ad + 0.1, true, true);
    }
  });

  // Semi-Enclosed Courtyard 1: Pátio dos Cortiços (between (-42,10) and (-42,30), x in [-47..-37], z in [15.5..24.5])
  const courtyardEntryFrames: Array<[number, number, number, number]> = [
    [-46.6, 20.0, 7.8, 3.85],
    [-37.4, 20.0, 7.8, 3.85],
    [-46.2, 1.2, 6.4, 3.85],
    [-37.8, 1.2, 6.4, 3.85],
  ];
  courtyardEntryFrames.forEach(([cx, cz, span, h]) => {
    const gate = createStoneArchway(span, h, 1.4, mats);
    gate.position.set(cx, 0, cz);
    gate.rotation.y = Math.PI / 2;
    scene.add(gate);
    const off = span * 0.5 - 0.65;
    addVolume(cx, 0, h + 0.35, cz - off, 1.4, 1.3, true, false);
    addVolume(cx, 0, h + 0.35, cz + off, 1.4, 1.3, true, false);
    addVolume(cx, h, h + 1.1, cz, 1.5, span, true, true);
  });
  // Overhead timber/stone courtyard gallery roofs framing sky view in first-person
  addElevatedWalkway(-42.0, 4.2, 20.0, 8.6, 3.4, { withRailings: true });
  addElevatedWalkway(-42.0, 4.0, 1.2, 8.0, 4.0, { withRailings: false });

  shadowZones.push(
    { x: -54.0, y: 0, z: 39.2, radius: 5.0 },
    { x: -42.0, y: 0, z: 20.0, radius: 5.2 },
    { x: -42.0, y: 0, z: 1.2, radius: 4.8 },
    { x: -73.0, y: 0, z: -6.0, radius: 5.5 },
    { x: -73.0, y: 0, z: 12.0, radius: 5.5 },
    { x: -73.0, y: 0, z: 24.0, radius: 5.5 },
    { x: -73.0, y: 0, z: 34.0, radius: 5.5 },
  );

  // Small isolated rain puddles (the ONLY specular ground spots, distributed cleanly across transitions)
  const puddleSpots: Array<[number, number, number]> = [
    [-4.8, -22.5, 1.45],
    [5.4, -21.0, 1.2],
    [-24.5, -24.0, 1.4],
    [39.5, -24.0, 1.45],
    [-15.5, 7.0, 1.35],
    [-15.5, 25.0, 1.4],
    [34.5, 0.5, 1.45],
    [34.5, 25.0, 1.35],
    [-18.0, 45.5, 1.4],
    [22.0, 45.5, 1.4],
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

    // Southern Avenue South Front (z = 76) facing North (rotY = Math.PI) + dense back-alley townhouses
    { x: -52, z: 76, w: 15, h: 10.5, d: 10, rotY: Math.PI, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: -37.8, z: 77.5, w: 6.8, h: 9.6, d: 8.6, rotY: Math.PI, brick: false, hasVitrine: true, roofStyle: 'pitched' },
    { x: -24, z: 76, w: 14, h: 11.2, d: 10, rotY: Math.PI, brick: false, hasVitrine: true, hasBalcony: true, roofStyle: 'pitched' },
    { x: -12.0, z: 77.8, w: 4.4, h: 9.2, d: 8.2, rotY: Math.PI, brick: true, roofStyle: 'mansard' },
    { x: 0, z: 77, w: 14, h: 12.0, d: 10, rotY: Math.PI, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: 12.0, z: 77.8, w: 4.4, h: 9.2, d: 8.2, rotY: Math.PI, brick: true, roofStyle: 'mansard' },
    { x: 24, z: 76, w: 14, h: 10.8, d: 10, rotY: Math.PI, brick: false, hasVitrine: true, hasBalcony: true, roofStyle: 'pitched' },
    { x: 37.8, z: 77.5, w: 6.8, h: 9.6, d: 8.6, rotY: Math.PI, brick: false, hasVitrine: true, roofStyle: 'pitched' },
    { x: 52, z: 76, w: 15, h: 10.5, d: 10, rotY: Math.PI, brick: true, hasVitrine: true, hasBalcony: true, roofStyle: 'mansard' },

    // West & East Flanking Quarters off Southern Boulevard (creating tight 3.2m-4.5m side warrens)
    { x: -66.5, z: 53.5, w: 8.2, h: 9.8, d: 7.6, brick: true, roofStyle: 'pitched' },
    { x: -66.5, z: 64.5, w: 8.2, h: 10.4, d: 7.6, brick: false, hasBalcony: true, roofStyle: 'mansard' },
    { x: -67.0, z: 76.5, w: 8.6, h: 10.0, d: 8.8, rotY: Math.PI, brick: true, hasVitrine: true, roofStyle: 'pitched' },
    { x: -79.5, z: 53.0, w: 8.8, h: 9.4, d: 8.0, brick: false, roofStyle: 'mansard' },
    { x: -79.5, z: 65.0, w: 8.8, h: 10.8, d: 8.0, brick: true, hasBalcony: true, roofStyle: 'pitched' },
    { x: -79.5, z: 76.5, w: 8.8, h: 9.8, d: 8.6, rotY: Math.PI, brick: false, roofStyle: 'mansard' },
    { x: 66.5, z: 53.5, w: 8.2, h: 9.8, d: 7.6, brick: true, roofStyle: 'pitched' },
    { x: 66.5, z: 64.5, w: 8.2, h: 10.4, d: 7.6, brick: false, hasBalcony: true, roofStyle: 'mansard' },
    { x: 67.0, z: 76.5, w: 8.6, h: 10.0, d: 8.8, rotY: Math.PI, brick: true, hasVitrine: true, roofStyle: 'pitched' },
    { x: 79.5, z: 53.0, w: 8.8, h: 9.4, d: 8.0, brick: false, roofStyle: 'mansard' },
    { x: 79.5, z: 65.0, w: 8.8, h: 10.8, d: 8.0, brick: true, hasBalcony: true, roofStyle: 'pitched' },
    { x: 79.5, z: 76.5, w: 8.8, h: 9.8, d: 8.6, rotY: Math.PI, brick: false, roofStyle: 'mansard' },

    // Manor Rear Outbuildings & Servants' Quarters (East Sector)
    { x: 77.5, z: -15.5, w: 11.0, h: 9.0, d: 9.0, brick: true, roofStyle: 'mansard' },
    { x: 77.5, z: 18.0, w: 11.0, h: 9.2, d: 9.0, brick: false, roofStyle: 'pitched' },
    { x: 77.5, z: 33.5, w: 11.0, h: 9.8, d: 9.5, brick: true, hasBalcony: true, roofStyle: 'mansard' },
    { x: 64.5, z: 38.5, w: 7.6, h: 8.8, d: 7.6, brick: false, roofStyle: 'pitched' },

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

  // Overhead Roof-to-Roof Street Bridges framing First-Person Sightlines Across Narrow Back-Alleys
  [
    [-21.2, 4.2, -9.2, 4.0, 4.6],
    [-66.0, 4.2, -4.4, 3.8, 3.8],
    [-66.0, 4.2, 4.4, 3.8, 3.8],
    [-48.0, 4.4, -45.0, 6.2, 3.2],
    [48.0, 4.4, -45.0, 6.2, 3.2],
    [-42.85, 4.2, 77.5, 3.6, 3.2],
    [42.85, 4.2, 77.5, 3.6, 3.2],
    [-15.6, 4.2, 77.5, 3.0, 2.8],
    [15.6, 4.2, 77.5, 3.0, 2.8],
    [-72.8, 4.4, 59.0, 4.8, 3.4],
    [72.8, 4.4, 59.0, 4.8, 3.4],
    [-72.8, 4.6, 76.5, 4.2, 3.2],
    [72.8, 4.6, 76.5, 4.2, 3.2],
  ].forEach(([bx, bh, bz, bw, bd]) => {
    addElevatedWalkway(bx, bh, bz, bw, bd, { withRailings: true });
    shadowZones.push({ x: bx, y: 0, z: bz, radius: 4.5 });
  });

  // North Bridge (y=4.0) -> Flat Roofs (y=6.2) flush step-up connectors (y = 5.05m)
  [-15.35, 14.6].forEach((wx) => {
    const sideLanding = createGothicPlatform(3.1, 5.05, 7.4, mats, { withRailings: false, pillars: true });
    sideLanding.position.set(wx, 0, -8.5);
    scene.add(sideLanding);
    addVolume(wx, 4.5, 5.05, -8.5, 3.1, 7.4, false, true);
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

  // Coherent Avenida Vitoriana Sidewalk Micro-Scenes (kiosks, benches & hedge planters off walk lanes)
  const streetFurnitureSpecs: Array<['bench' | 'kiosk' | 'planter', number, number, number, number]> = [
    // Central Fountain Square benches facing fountain
    ['bench', -4.5, 0, 0.0, Math.PI / 2],
    ['bench', 4.5, 0, 0.0, -Math.PI / 2],
    // West & East Central raised sidewalks (y = 0.24, outer edges away from x = ±11.6..12.8 paths)
    ['planter', -14.25, 0.24, -10.0, Math.PI / 2],
    ['bench', -14.25, 0.24, 2.0, Math.PI / 2],
    ['kiosk', -15.4, 0, 15.8, Math.PI / 2],
    ['planter', -14.25, 0.24, 21.0, Math.PI / 2],
    ['bench', -14.25, 0.24, 32.0, Math.PI / 2],
    ['planter', 14.25, 0.24, -8.0, -Math.PI / 2],
    ['bench', 14.25, 0.24, 6.0, -Math.PI / 2],
    ['planter', 14.25, 0.24, 20.0, -Math.PI / 2],
    ['bench', 14.25, 0.24, 32.0, -Math.PI / 2],
    // Eastern Shopfront strip (between building east face x=25 and walk path x=27.5..28.5)
    ['kiosk', 25.75, 0.24, 26.5, Math.PI / 2],
    ['planter', 29.85, 0.24, 10.0, -Math.PI / 2],
    // Southern Boulevard shopfront kiosks, benches & planters (z = 69.8..70.5, facing North)
    ['kiosk', -36.0, 0.24, 70.15, Math.PI],
    ['kiosk', 12.0, 0.24, 70.15, Math.PI],
    ['kiosk', 38.0, 0.24, 70.15, Math.PI],
    ['bench', -48.0, 0.24, 69.85, Math.PI],
    ['planter', -24.0, 0.24, 69.85, Math.PI],
    ['bench', -8.0, 0.24, 69.85, Math.PI],
    ['planter', 24.0, 0.24, 69.85, Math.PI],
    ['bench', 48.0, 0.24, 69.85, Math.PI],
  ];
  streetFurnitureSpecs.forEach(([variant, fx, fy, fz, rotY]) => {
    const prop = createVictorianStreetFurniture(mats, variant);
    prop.position.set(fx, fy, fz);
    prop.rotation.y = rotY;
    scene.add(prop);
    const isNS = Math.abs(Math.sin(rotY)) > 0.7;
    const w = variant === 'kiosk' ? 2.0 : 1.75;
    const d = variant === 'kiosk' ? 1.25 : 0.75;
    const h = variant === 'kiosk' ? 2.75 : 0.95;
    addVolume(fx, fy, fy + h, fz, isNS ? d : w, isNS ? w : d, variant === 'kiosk', variant !== 'kiosk');
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
  // SECTOR 4: CEMITÉRIO (ZONA SEGURA DE RESPIRO) E MANSÃO (x in [34, 86])
  // =========================================================================
  const cemeteryBounds = { minX: 34.5, maxX: 57.5, minZ: -22.5, maxZ: 44.5 };

  // Secondary Crimson Blood Altar inside Cemetery Safe Respite Sector + Semi-Enclosed Stone Cloister
  const altarPos = new THREE.Vector3(44, 0, 24);
  const altarGroup = createBloodAltar(mats);
  altarGroup.position.copy(altarPos);
  scene.add(altarGroup);
  addVolume(altarPos.x, 0, 1.5, altarPos.z, 4.2, 4.2, false, true);
  shadowZones.push({ x: altarPos.x, y: 0, z: altarPos.z, radius: 10.5 });

  // Semi-enclosed Gothic stone cloister wings framing the Cemetery Altar Sanctuary (wide N/S/E/W entries)
  const cloisterCorners: Array<[number, number]> = [
    [altarPos.x - 5.2, altarPos.z - 5.2],
    [altarPos.x + 5.2, altarPos.z - 5.2],
    [altarPos.x - 5.2, altarPos.z + 5.2],
    [altarPos.x + 5.2, altarPos.z + 5.2],
  ];
  cloisterCorners.forEach(([px, pz]) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 1.1), mats.darkStone);
    col.position.set(px, 1.8, pz);
    col.castShadow = true;
    col.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.85, 4), mats.stone);
    cap.position.set(px, 4.0, pz);
    cap.rotation.y = Math.PI / 4;
    scene.add(col, cap);
    addVolume(px, 0, 4.0, pz, 1.1, 1.1, true, false);
  });
  [-5.2, 5.2].forEach((ox) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 10.8), mats.stone);
    beam.position.set(altarPos.x + ox, 3.45, altarPos.z);
    beam.castShadow = true;
    scene.add(beam);
    addVolume(altarPos.x + ox, 3.1, 3.85, altarPos.z, 0.8, 10.8, true, true);
  });

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

  // Coherent Cemetery & Manor Funerary Monuments & Veranda Urns
  const cemeteryMonumentSpecs: Array<['obelisk' | 'urn' | 'shrine', number, number, number]> = [
    ['urn', 39.0, 14.5, 0],
    ['obelisk', 49.5, -3.0, 0],
    ['shrine', 43.0, 34.5, Math.PI],
    ['urn', 50.5, 29.0, 0],
    ['urn', 65.6, -6.5, -Math.PI / 2],
    ['urn', 65.6, 10.5, -Math.PI / 2],
  ];
  cemeteryMonumentSpecs.forEach(([variant, mx, mz, rotY]) => {
    const monument = createCemeteryMonument(mats, variant);
    monument.position.set(mx, 0, mz);
    monument.rotation.y = rotY;
    scene.add(monument);
    addVolume(mx, 0, variant === 'urn' ? 2.2 : 3.4, mz, 1.45, 1.45, true, false);
  });

  // Southern Cemetery <-> Southern Boulevard Wrought-Iron Escape Gate & Flanking Railings (z = 44.5)
  addIronGateTransition(44.0, 44.5, 7.6, 4.1, 0);
  const southCemThreshold = createThresholdBollards(mats, 6.4, 'crimson');
  southCemThreshold.position.set(44.0, 0, 44.5);
  scene.add(southCemThreshold);
  [37.4, 50.6].forEach((fx) => {
    const f = createWroughtIronFence(5.0, mats, 1.95);
    f.position.set(fx, 0, 44.5);
    scene.add(f);
    addVolume(fx, 0, 2.1, 44.5, 5.0, 0.65, false, false);
  });

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
    { x: 75, y: 0, z: -9, radius: 4.8 },
    { x: 75, y: 0, z: 11.5, radius: 4.8 },
    { x: 75, y: 0, z: 25.5, radius: 5.0 },
    { x: -72.8, y: 0, z: 59.0, radius: 5.2 },
    { x: 72.8, y: 0, z: 59.0, radius: 5.2 },
    { x: -42.85, y: 0, z: 77.5, radius: 4.5 },
    { x: 42.85, y: 0, z: 77.5, radius: 4.5 },
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

  // Cultists patrol Cathedral North Cloisters & Outer Manor Perimeters (leaving Cemetery Safe Zone clear)
  const cultistRoutes = [
    [v(-18, -68), v(18, -68), v(18, -73), v(-18, -73)],
    [v(-8.5, -34.5), v(8.5, -34.5), v(8.5, -28.0), v(-8.5, -28.0)],
    [v(-56.0, -34.0), v(-38.0, -34.0), v(-38.0, -24.0), v(-56.0, -24.0)],
    [v(59.0, -34.0), v(74.0, -34.0), v(74.0, -24.0), v(59.0, -24.0)],
  ];

  // Isolated Nobles stroll Manor Hedged Gardens, North Avenue & Cathedral Terrace (outside Cemetery)
  const nobleRoutes = [
    [v(58.4, -18.0), v(62.8, -18.0), v(62.8, -8.5), v(58.4, -8.5)],
    [v(58.4, 2.0), v(62.8, 2.0), v(62.8, 16.0), v(58.4, 16.0)],
    [v(28.5, -12, 0.24), v(32.5, -12), v(32.5, 24), v(28.5, 24, 0.24)],
    [v(-6.8, -28.0), v(6.8, -28.0), v(6.8, -19.0), v(-6.8, -19.0)],
    [v(-10.0, 68.5, 0.24), v(18.0, 68.5, 0.24), v(18.0, 66.0), v(-10.0, 66.0)],
  ];

  // Patrol Guards keep streets & Manor gardens watched while leaving Cemetery Safe Zone completely unpatrolled
  const guardRoutes = [
    [v(-7.5, -26), v(7.5, -26), v(7.5, 10), v(-7.5, 10)],
    [v(-34.5, -16), v(-28.5, -16), v(-28.5, 22), v(-34.5, 22)],
    [v(-57.0, -18), v(-51.5, -18), v(-51.5, 28), v(-57.0, 28)],
    [v(26.5, -22), v(31.5, -22), v(31.5, 34), v(26.5, 34)],
    [v(-11, -14, 4.0), v(11, -14, 4.0)], // Elevated North Skybridge Sentinel
    [v(-44, 52.5), v(44, 52.5), v(44, 62.5), v(-44, 62.5)],
    [v(58.5, -24), v(61.5, -24), v(61.5, 12), v(58.5, 12)], // Manor West Garden Watch (strictly east of Cemetery)
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
    cemeteryBounds,
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
