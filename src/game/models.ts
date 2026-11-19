import * as THREE from 'three';
import { applyPs2GothicShader, type GothicMaterialLibrary, type StylizedShaderUniforms } from './materials';
import type { GothicTextures } from './textures';
import type { NpcArchetype } from './types';

export interface VampireRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  spinePivot: THREE.Group;
  cape: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  head: THREE.Group;
  contactShadow: THREE.Mesh;
  batRing: THREE.Group;
  stealthMats: THREE.MeshStandardMaterial[];
  stealthMatDefaults: Array<{ mat: THREE.MeshStandardMaterial; baseColor: number }>;
}

export function createVampireModel(
  mats: GothicMaterialLibrary,
  textures: GothicTextures,
): VampireRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Clone vampire materials so Obfuscate translucency never turns city architecture transparent
  const coatMat = mats.vampireCoat.clone();
  const crimsonMat = mats.vampireCrimson.clone();
  const skinMat = mats.vampireSkin.clone();
  const hairMat = mats.vampireHair.clone();
  const ironMat = mats.iron.clone();
  const capeMat = mats.vampireCoat.clone();
  capeMat.side = THREE.DoubleSide;
  const stealthMats: THREE.MeshStandardMaterial[] = [coatMat, crimsonMat, skinMat, hairMat, ironMat, capeMat];
  const stealthMatDefaults = stealthMats.map((mat) => ({
    mat,
    baseColor: mat.color.getHex(),
  }));
  for (const m of stealthMats) {
    m.transparent = true;
    m.opacity = 1.0;
  }

  // Contact shadow grounded at y=0.02
  const shadowGeo = new THREE.PlaneGeometry(1.7, 1.7);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Articulated Legs: Hip (y=0.92) -> Thigh -> Knee (y=-0.44) -> Shin + Boot
  const thighGeo = new THREE.CylinderGeometry(0.112, 0.092, 0.46, 7);
  const shinGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.44, 7);
  const bootGeo = new THREE.BoxGeometry(0.16, 0.16, 0.28);

  const makeLeg = (xOff: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOff, 0.92, 0);

    const thighMesh = new THREE.Mesh(thighGeo, coatMat);
    thighMesh.position.y = -0.22;
    thighMesh.castShadow = true;

    const shinGroup = new THREE.Group();
    shinGroup.position.set(0, -0.44, 0);

    const shinMesh = new THREE.Mesh(shinGeo, coatMat);
    shinMesh.position.y = -0.22;
    shinMesh.castShadow = true;

    const bootMesh = new THREE.Mesh(bootGeo, ironMat);
    bootMesh.position.set(0, -0.41, 0.055);
    bootMesh.castShadow = true;

    shinGroup.add(shinMesh, bootMesh);
    legGroup.add(thighMesh, shinGroup);
    return { legGroup, shinGroup };
  };

  const leftLegBuilt = makeLeg(-0.15);
  const rightLegBuilt = makeLeg(0.15);
  const leftLeg = leftLegBuilt.legGroup;
  const rightLeg = rightLegBuilt.legGroup;
  const leftShin = leftLegBuilt.shinGroup;
  const rightShin = rightLegBuilt.shinGroup;
  bodyPivot.add(leftLeg, rightLeg);

  // Articulated Spine Pivot at hip (y=0.92) for torso twist, lean, and breathing
  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.92, 0);
  bodyPivot.add(spinePivot);

  // Torso (noble armored vest + crimson sash, relative to spinePivot y=0)
  const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.21, 0.72, 8), coatMat);
  torsoMesh.position.y = 0.36;
  torsoMesh.castShadow = true;
  spinePivot.add(torsoMesh);

  const cravat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.25), crimsonMat);
  cravat.position.set(0, 0.44, 0.06);
  cravat.castShadow = true;
  spinePivot.add(cravat);

  // Pauldrons (accent armor)
  const pauldronGeo = new THREE.SphereGeometry(0.16, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const pLeft = new THREE.Mesh(pauldronGeo, ironMat);
  pLeft.position.set(-0.31, 0.64, 0);
  pLeft.rotation.z = 0.35;
  const pRight = new THREE.Mesh(pauldronGeo, ironMat);
  pRight.position.set(0.31, 0.64, 0);
  pRight.rotation.z = -0.35;
  spinePivot.add(pLeft, pRight);

  // High gothic vampire collar (ExtrudeGeometry)
  const collarShape = new THREE.Shape();
  collarShape.moveTo(-0.32, 0);
  collarShape.lineTo(-0.42, 0.36);
  collarShape.lineTo(0, 0.24);
  collarShape.lineTo(0.42, 0.36);
  collarShape.lineTo(0.32, 0);
  collarShape.closePath();
  const collarGeo = new THREE.ExtrudeGeometry(collarShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  const collar = new THREE.Mesh(collarGeo, crimsonMat);
  collar.position.set(0, 0.62, -0.18);
  collar.rotation.x = -0.25;
  collar.castShadow = true;
  spinePivot.add(collar);

  // Flowing cloak (pivoted at shoulders relative to spinePivot y=0.64)
  const capeGeo = new THREE.CylinderGeometry(0.24, 0.58, 1.38, 7, 1, true, Math.PI * 0.2, Math.PI * 1.6);
  capeGeo.translate(0, -0.69, 0);
  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 0.64, -0.04);
  cape.rotation.x = 0.14;
  cape.castShadow = true;
  spinePivot.add(cape);

  // Articulated Arms: Shoulder (y=0.62) -> Upper Arm -> Elbow (y=-0.34) -> Forearm + 3 Claws
  const upperArmGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.35, 6);
  const forearmGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.34, 6);
  const palmGeo = new THREE.BoxGeometry(0.085, 0.1, 0.09);
  const clawGeo = new THREE.ConeGeometry(0.016, 0.13, 4);

  const makeArm = (xOff: number) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(xOff, 0.62, 0);

    const upperMesh = new THREE.Mesh(upperArmGeo, coatMat);
    upperMesh.position.y = -0.17;
    upperMesh.castShadow = true;

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.34, 0);

    const forearmMesh = new THREE.Mesh(forearmGeo, coatMat);
    forearmMesh.position.y = -0.17;
    forearmMesh.castShadow = true;

    const palmMesh = new THREE.Mesh(palmGeo, skinMat);
    palmMesh.position.y = -0.36;

    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(clawGeo, mats.vampireEye);
      claw.position.set(c * 0.028, -0.46, 0.03);
      claw.rotation.x = Math.PI + 0.28;
      forearmGroup.add(claw);
    }

    forearmGroup.add(forearmMesh, palmMesh);
    armGroup.add(upperMesh, forearmGroup);
    return { armGroup, forearmGroup };
  };

  const leftArmBuilt = makeArm(-0.34);
  const rightArmBuilt = makeArm(0.34);
  const leftArm = leftArmBuilt.armGroup;
  const rightArm = rightArmBuilt.armGroup;
  const leftForearm = leftArmBuilt.forearmGroup;
  const rightForearm = rightArmBuilt.forearmGroup;
  spinePivot.add(leftArm, rightArm);

  // Head + angular hair + glowing crimson eyes (relative to spinePivot y=0.84)
  const head = new THREE.Group();
  head.position.set(0, 0.84, 0.02);
  const cranium = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 1), skinMat);
  cranium.scale.set(0.86, 1.08, 0.94);
  cranium.castShadow = true;
  head.add(cranium);

  const hair = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.34, 6), hairMat);
  hair.position.set(0, 0.12, -0.04);
  hair.rotation.x = -0.45;
  head.add(hair);

  const eyeGeo = new THREE.BoxGeometry(0.05, 0.022, 0.04);
  const eyeL = new THREE.Mesh(eyeGeo, mats.vampireEye);
  eyeL.position.set(-0.065, 0.02, 0.16);
  const eyeR = new THREE.Mesh(eyeGeo, mats.vampireEye);
  eyeR.position.set(0.065, 0.02, 0.16);
  head.add(eyeL, eyeR);
  spinePivot.add(head);

  // Bat swarm ring (hidden unless Bat Form active)
  const batRing = new THREE.Group();
  batRing.visible = false;
  const wingGeo = new THREE.BufferGeometry();
  const wingVerts = new Float32Array([
    0, 0, 0, -0.26, 0.08, -0.06, -0.1, -0.02, 0.1,
    0, 0, 0, 0.1, -0.02, 0.1, 0.26, 0.08, -0.06,
  ]);
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
  wingGeo.computeVertexNormals();
  const batMat = new THREE.MeshBasicMaterial({ color: 0x11131d, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const bat = new THREE.Mesh(wingGeo, batMat);
    const angle = (i / 12) * Math.PI * 2;
    const rad = 0.65 + (i % 3) * 0.28;
    bat.position.set(Math.cos(angle) * rad, 0.8 + (i % 4) * 0.26, Math.sin(angle) * rad);
    bat.rotation.y = -angle;
    batRing.add(bat);
  }
  root.add(batRing);

  return {
    root,
    bodyPivot,
    spinePivot,
    cape,
    leftArm,
    rightArm,
    leftForearm,
    rightForearm,
    leftLeg,
    rightLeg,
    leftShin,
    rightShin,
    head,
    contactShadow,
    batRing,
    stealthMats,
    stealthMatDefaults,
  };
}

export const GUARD_VISION_RANGE = 13.5;
export const GUARD_HALF_FOV = Math.PI * 0.22; // 39.6 deg half-angle (~79 deg cone)
export const VISION_CONE_RAYS = 22;

export interface NpcModelRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  lanternMat?: THREE.MeshBasicMaterial;
  visionCone?: THREE.Mesh;
  visionConeGeo?: THREE.BufferGeometry;
  visionConeMat?: THREE.MeshBasicMaterial;
  crimsonPulseMesh: THREE.Mesh;
  crimsonPulseMat: THREE.MeshBasicMaterial;
  alertSpriteMesh: THREE.Mesh;
  alertMat: THREE.MeshBasicMaterial;
  hpBarGroup: THREE.Group;
  hpBarFill: THREE.Mesh;
  contactShadow: THREE.Mesh;
  bloodGlowMat: THREE.MeshStandardMaterial;
}

export function createNpcModel(
  archetype: NpcArchetype,
  name: string,
  textures: GothicTextures,
  sharedUniforms: StylizedShaderUniforms,
): NpcModelRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  const isPatriarch = name === 'Lorde Valerius';
  const isCountess = name === 'Condessa Eleanor';
  const isMagistrate = name === 'Magistrado Vance';
  const isBaron = name === 'Barão Thorne';
  const isBodyguard = archetype === 'bodyguard';
  const isHunter = archetype === 'hunter';
  const isCultist = archetype === 'cultist';
  const isBeggarRole = archetype === 'beggar' || name === 'Mendigo das Ruas';
  const isInquisitor = name === 'Inquisidor de Prata';
  const isSentinel = name === 'Sentinela Sacra';
  const isHalberdier = name === 'Alabardeiro';
  const isApothecary = name === 'Boticário';
  const isBlacksmith = name === 'Ferreiro Tardio';
  const isPilgrim = name === 'Peregrino';
  const hasGuardGear = archetype === 'guard' || isBodyguard || isHunter;

  const pulseColor = isPatriarch
    ? 0xff1144
    : archetype === 'noble'
    ? 0xff2b55
    : isHunter
    ? 0xfb923c
    : isCultist
    ? 0xa855f7
    : isBodyguard
    ? 0xf43f5e
    : isInquisitor || isHalberdier
    ? 0xf59e0b
    : archetype === 'guard'
    ? 0xd97706
    : isBeggarRole
    ? 0x7f1d1d
    : 0xb91c1c;

  const coatColor = isPatriarch
    ? 0x561028
    : isCountess
    ? 0x4b1847
    : isMagistrate
    ? 0x1b1526
    : isBaron
    ? 0x3b1222
    : isHunter
    ? 0x221a24
    : isBodyguard
    ? 0x2a0f18
    : isCultist
    ? 0x2d123d
    : isInquisitor
    ? 0x30162b
    : isSentinel
    ? 0x1a2848
    : isHalberdier
    ? 0x262d3d
    : archetype === 'guard'
    ? 0x1c2233
    : isApothecary
    ? 0x1b342b
    : isBlacksmith
    ? 0x3f2a20
    : isBeggarRole
    ? 0x2e2a27
    : isPilgrim
    ? 0x293242
    : 0x312c27;

  const trimColor = isPatriarch
    ? 0xeab308
    : isCountess
    ? 0xe2c785
    : isMagistrate
    ? 0xc83e4d
    : isBaron
    ? 0xd4a348
    : isHunter
    ? 0xe2e8f0
    : isBodyguard
    ? 0xf59e0b
    : isCultist
    ? 0xc084fc
    : isInquisitor
    ? 0xcbd5e1
    : isSentinel
    ? 0xd99b38
    : isHalberdier
    ? 0xa3b2cc
    : archetype === 'guard'
    ? 0x8e9bb5
    : isBlacksmith
    ? 0x6b7280
    : isApothecary
    ? 0x34d399
    : isBeggarRole
    ? 0x57534e
    : 0x57534e;

  const coatMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: coatColor,
      roughness: archetype === 'noble' ? 0.52 : isCultist || isHunter ? 0.65 : 0.84,
      metalness: hasGuardGear ? 0.28 : 0.05,
    }),
    sharedUniforms,
    { rimColor: isCultist ? 0xa855f7 : isHunter ? 0xfb923c : isBodyguard ? 0xf87171 : 0x6b82b8, rimStrength: 0.28, celBands: 3.0, bloodPulseColor: pulseColor },
  );

  const trimMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: (archetype === 'citizen' || isBeggarRole) && !isApothecary ? 0.78 : 0.32,
      metalness: (archetype === 'citizen' || isBeggarRole) && !isBlacksmith ? 0.12 : 0.82,
    }),
    sharedUniforms,
    { rimColor: 0x94a3b8, rimStrength: 0.25, celBands: 3.0, bloodPulseColor: pulseColor },
  );

  const skinMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: isBeggarRole ? 0xb59886 : isCultist ? 0xc2b4c8 : 0xd8b8a4,
      roughness: 0.72,
      metalness: 0.0,
    }),
    sharedUniforms,
    { rimColor: 0x94a3b8, rimStrength: 0.2, celBands: 3.0, bloodPulseColor: pulseColor },
  );

  // Subtle status-based body scale
  if (isPatriarch || isHalberdier || isBodyguard || isHunter) {
    bodyGroup.scale.set(1.06, 1.05, 1.06);
  } else if (isBeggarRole) {
    bodyGroup.scale.set(0.94, 0.91, 0.94);
  } else if (isCountess) {
    bodyGroup.scale.set(0.96, 1.0, 0.96);
  }

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.095, 0.075, 0.84, 6);
  const leftLeg = new THREE.Mesh(legGeo, coatMat);
  leftLeg.position.set(-0.13, 0.42, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, coatMat);
  rightLeg.position.set(0.13, 0.42, 0);
  rightLeg.castShadow = true;
  bodyGroup.add(leftLeg, rightLeg);

  // Torso (Countess gets flared noble gown, Cultist full ritual cassock, Blacksmith/Bodyguard broader chest, Beggar stooped)
  const torso = isCountess
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.42, 1.15, 8), coatMat)
    : isCultist
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 1.05, 8), coatMat)
    : new THREE.Mesh(
        new THREE.CylinderGeometry(isBlacksmith || isHalberdier || isBodyguard || isHunter ? 0.28 : 0.24, 0.28, 0.76, 7),
        coatMat,
      );
  torso.position.y = isCountess || isCultist ? 0.98 : 1.2;
  if (isBeggarRole) torso.rotation.x = 0.16;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Secondary Silhouettes & Status Vestments
  if (isHunter) {
    // Long Victorian hunter trenchcoat + silver stake bandolier + high collar
    const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.38, 0.72, 7, 1, true), coatMat);
    coatSkirt.position.y = 0.76;
    const bandolier = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.74, 0.46), trimMat);
    bandolier.position.set(0, 1.24, 0);
    bandolier.rotation.z = 0.46;
    const stakeGeo = new THREE.CylinderGeometry(0.018, 0.008, 0.22, 5);
    for (let s = -1; s <= 1; s++) {
      const stake = new THREE.Mesh(stakeGeo, trimMat);
      stake.position.set(s * 0.08, 1.24 + s * 0.05, 0.24);
      stake.rotation.z = -0.3;
      bodyGroup.add(stake);
    }
    const hunterCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.18, 7, 1, true, Math.PI * 0.3, Math.PI * 1.4), coatMat);
    hunterCollar.position.set(0, 1.56, -0.02);
    bodyGroup.add(coatSkirt, bandolier, hunterCollar);
  } else if (isBodyguard) {
    const breastplate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.54, 7), trimMat);
    breastplate.position.y = 1.32;
    breastplate.castShadow = true;
    const pGeo = new THREE.SphereGeometry(0.18, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const pL = new THREE.Mesh(pGeo, trimMat);
    pL.position.set(-0.34, 1.54, 0);
    const pR = new THREE.Mesh(pGeo, trimMat);
    pR.position.set(0.34, 1.54, 0);
    const capelet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.66, 0.12), coatMat);
    capelet.position.set(0, 1.22, -0.24);
    bodyGroup.add(breastplate, pL, pR, capelet);
  } else if (isCultist) {
    const stole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.78, 0.46), trimMat);
    stole.position.y = 1.2;
    const talisman = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08, 0),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
    );
    talisman.position.set(0, 1.38, 0.27);
    const shoulderShawl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.28, 7), coatMat);
    shoulderShawl.position.y = 1.48;
    bodyGroup.add(stole, talisman, shoulderShawl);
  } else if (isBeggarRole) {
    const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.3, 6), trimMat);
    shawl.position.set(0, 1.44, 0.03);
    shawl.rotation.x = 0.16;
    bodyGroup.add(shawl);
  } else if (isHalberdier) {
    const breastplate = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.24, 0.52, 7), trimMat);
    breastplate.position.y = 1.32;
    breastplate.castShadow = true;
    const pGeo = new THREE.SphereGeometry(0.17, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const pL = new THREE.Mesh(pGeo, trimMat);
    pL.position.set(-0.33, 1.52, 0);
    const pR = new THREE.Mesh(pGeo, trimMat);
    pR.position.set(0.33, 1.52, 0);
    bodyGroup.add(breastplate, pL, pR);
  } else if (isInquisitor) {
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.36, 7), trimMat);
    mantle.position.y = 1.46;
    const chestCross = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.46), trimMat);
    chestCross.position.y = 1.28;
    bodyGroup.add(mantle, chestCross);
  } else if (isSentinel) {
    const tabard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.76, 0.46), trimMat);
    tabard.position.y = 1.18;
    bodyGroup.add(tabard);
  } else if (archetype === 'guard') {
    const breastplate = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.44, 7), trimMat);
    breastplate.position.y = 1.32;
    breastplate.castShadow = true;
    bodyGroup.add(breastplate);
  } else if (isPatriarch) {
    const capelet = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 0.52, 8), coatMat);
    capelet.position.set(0, 1.38, -0.05);
    const goldSash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.48), trimMat);
    goldSash.position.y = 1.24;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.22, 7, 1, true, Math.PI * 0.35, Math.PI * 1.3), trimMat);
    collar.position.set(0, 1.62, -0.04);
    bodyGroup.add(capelet, goldSash, collar);
  } else if (isCountess) {
    const goldNeck = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 6, 12), trimMat);
    goldNeck.rotation.x = Math.PI / 2;
    goldNeck.position.y = 1.56;
    const bustle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.22), trimMat);
    bustle.position.set(0, 0.94, -0.2);
    bodyGroup.add(goldNeck, bustle);
  } else if (isMagistrate) {
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.95, 8), coatMat);
    robe.position.y = 0.75;
    const jabot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.12), trimMat);
    jabot.position.set(0, 1.44, 0.22);
    bodyGroup.add(robe, jabot);
  } else if (archetype === 'noble') {
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.48), trimMat);
    sash.position.y = 1.24;
    const capelet = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, 0.32, 7), coatMat);
    capelet.position.y = 1.46;
    bodyGroup.add(sash, capelet);
  } else if (isApothecary) {
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.22), trimMat);
    satchel.position.set(-0.28, 1.0, 0.06);
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
    vial.position.set(-0.32, 1.15, 0.12);
    bodyGroup.add(satchel, vial);
  } else if (isBlacksmith) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.82, 0.1), trimMat);
    apron.position.set(0, 1.05, 0.24);
    bodyGroup.add(apron);
  }

  // Head
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 1), skinMat);
  head.position.set(0, 1.72, isBeggarRole ? 0.08 : 0);
  head.castShadow = true;
  bodyGroup.add(head);

  // Hats / Helmets / Hoods by status & role
  if (isHunter) {
    // Wide-brimmed gothic witch-hunter hat with silver buckle
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.045, 8), coatMat);
    brim.position.y = 1.85;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.34, 8), coatMat);
    crown.position.y = 2.02;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.06), trimMat);
    buckle.position.set(0, 1.9, 0.21);
    bodyGroup.add(brim, crown, buckle);
  } else if (isBodyguard) {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 8), trimMat);
    helm.position.y = 1.8;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.22), coatMat);
    visor.position.set(0, 1.74, 0.11);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), coatMat);
    plume.position.set(0, 2.02, -0.04);
    bodyGroup.add(helm, visor, plume);
  } else if (isCultist) {
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.56, 7), coatMat);
    cowl.position.set(0, 1.92, -0.02);
    cowl.rotation.x = -0.18;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.03), eyeMat);
    eyeL.position.set(-0.055, 1.73, 0.15);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.03), eyeMat);
    eyeR.position.set(0.055, 1.73, 0.15);
    bodyGroup.add(cowl, eyeL, eyeR);
  } else if (isHalberdier) {
    // Iron Sallet Visor Helmet
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), trimMat);
    helm.position.y = 1.78;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.24), trimMat);
    visor.position.set(0, 1.74, 0.1);
    bodyGroup.add(helm, visor);
  } else if (isSentinel) {
    // Tall Bronze-crested Tower Helm
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.26, 7), trimMat);
    helm.position.y = 1.82;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.34), coatMat);
    crest.position.y = 1.98;
    bodyGroup.add(helm, crest);
  } else if (isInquisitor) {
    // Tall Pointed Inquisitor Hat with silver band
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.41, 0.04, 8), coatMat);
    brim.position.y = 1.85;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.42, 7), coatMat);
    crown.position.y = 2.04;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 7), trimMat);
    band.position.y = 1.88;
    bodyGroup.add(brim, crown, band);
  } else if (archetype === 'guard') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.04, 8), coatMat);
    brim.position.y = 1.84;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 7), coatMat);
    crown.position.y = 1.98;
    bodyGroup.add(brim, crown);
  } else if (isCountess) {
    // Feathered Noble Fascinator / Tiara
    const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 10, Math.PI), trimMat);
    tiara.position.set(0, 1.84, 0.06);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 5), trimMat);
    plume.position.set(0.12, 1.96, -0.02);
    plume.rotation.z = -0.55;
    bodyGroup.add(tiara, plume);
  } else if (isMagistrate) {
    // Bicorne Judicial Cap
    const bicorne = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.22), coatMat);
    bicorne.position.y = 1.89;
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), trimMat);
    badge.position.set(0, 1.9, 0.12);
    bodyGroup.add(bicorne, badge);
  } else if (archetype === 'noble') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 8), coatMat);
    brim.position.y = 1.84;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, isPatriarch ? 0.34 : 0.28, 8), coatMat);
    hat.position.y = isPatriarch ? 2.01 : 1.98;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.05, 8), trimMat);
    band.position.y = 1.88;
    bodyGroup.add(brim, hat, band);
    if (isPatriarch) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), trimMat);
      feather.position.set(-0.18, 2.06, -0.02);
      feather.rotation.z = 0.45;
      bodyGroup.add(feather);
    }
  } else {
    // Citizen / Beggar ragged hood
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 6), coatMat);
    hood.position.set(0, 1.78, isBeggarRole ? 0.04 : -0.04);
    hood.rotation.x = -0.25;
    bodyGroup.add(hood);
  }

  // Left arm (+ citizen pilgrim staff / beggar crutch)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.3, 1.48, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.62, 6), coatMat);
  leftArmMesh.position.y = -0.28;
  leftArm.add(leftArmMesh);
  if (isPilgrim || isBeggarRole) {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 1.5, 5), trimMat);
    staff.position.set(-0.04, -0.6, 0.14);
    staff.rotation.x = 0.14;
    leftArm.add(staff);
  }
  bodyGroup.add(leftArm);

  // Right arm + prop (guard halberd/lantern, cultist censer, noble cane/scepter/fan, blacksmith hammer)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.3, 1.48, 0);
  const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.62, 6), coatMat);
  armMesh.position.y = -0.28;
  rightArm.add(armMesh);

  let lanternMat: THREE.MeshBasicMaterial | undefined;
  let visionCone: THREE.Mesh | undefined;
  let visionConeGeo: THREE.BufferGeometry | undefined;
  let visionConeMat: THREE.MeshBasicMaterial | undefined;

  if (hasGuardGear) {
    if (isHunter) {
      // Heavy repeating silver crossbow in right hand + crimson-amber hunter lantern in left
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.72), coatMat);
      stock.position.set(0, -0.45, 0.34);
      const bowArm = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.08), trimMat);
      bowArm.position.set(0, -0.45, 0.58);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), trimMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(0, -0.39, 0.44);
      rightArm.add(stock, bowArm, bolt);
    } else {
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, isHalberdier || isBodyguard ? 2.15 : 1.85, 5), trimMat);
      staff.position.set(0, -0.08, 0.26);
      staff.rotation.x = 0.2;
      const blade = new THREE.Mesh(
        isInquisitor ? new THREE.BoxGeometry(0.24, 0.07, 0.06) : new THREE.ConeGeometry(isHalberdier || isBodyguard ? 0.13 : 0.08, 0.36, 4),
        trimMat,
      );
      blade.position.set(0, 0.85, 0.44);
      blade.rotation.x = 0.2;
      rightArm.add(staff, blade);
    }
    lanternMat = new THREE.MeshBasicMaterial({
      color: isHunter ? 0xff7b29 : isBodyguard ? 0xf87171 : isInquisitor ? 0xfde68a : 0xffb347,
      toneMapped: false,
    });
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), lanternMat);
    lantern.position.set(-0.14, -0.62, 0.24);
    leftArm.add(lantern);

    // Dynamic local-XZ fan geometry centered along +Z (0..VISION_CONE_RAYS)
    const vertCount = VISION_CONE_RAYS + 2;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indices: number[] = [];

    positions[0] = 0;
    positions[1] = 0.06;
    positions[2] = 0.15;
    colors[0] = 1.0;
    colors[1] = 1.0;
    colors[2] = 1.0;

    for (let i = 0; i <= VISION_CONE_RAYS; i++) {
      const t = i / VISION_CONE_RAYS;
      const a = -GUARD_HALF_FOV + t * (GUARD_HALF_FOV * 2);
      const idx = (i + 1) * 3;
      positions[idx] = Math.sin(a) * GUARD_VISION_RANGE;
      positions[idx + 1] = 0.06;
      positions[idx + 2] = Math.cos(a) * GUARD_VISION_RANGE;

      const edgeFade = 1.0 - Math.pow(Math.abs(t - 0.5) * 2, 2.2) * 0.55;
      colors[idx] = 0.52 * edgeFade;
      colors[idx + 1] = 0.52 * edgeFade;
      colors[idx + 2] = 0.52 * edgeFade;
    }

    for (let i = 1; i <= VISION_CONE_RAYS; i++) {
      indices.push(0, i + 1, i);
    }

    visionConeGeo = new THREE.BufferGeometry();
    visionConeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    visionConeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    visionConeGeo.setIndex(indices);

    visionConeMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      vertexColors: true,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    visionCone = new THREE.Mesh(visionConeGeo, visionConeMat);
    visionCone.frustumCulled = false;
    visionCone.visible = false; // Shown cleanly on the ground when Sentido Carmesim is active
    root.add(visionCone);
  } else if (isCultist) {
    // Handheld occult/alchemical lantern in leftArm + swinging censer in rightArm
    const isApothecary = name === 'Boticário';
    const lanternHex = isApothecary ? 0x34d399 : 0xb366ff;
    lanternMat = new THREE.MeshBasicMaterial({
      color: lanternHex,
      toneMapped: false,
    });
    const lanternFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), trimMat);
    lanternFrame.position.set(-0.12, -0.62, 0.22);
    const lanternCore = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.11), lanternMat);
    lanternCore.position.set(-0.12, -0.62, 0.22);
    leftArm.add(lanternFrame, lanternCore);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), trimMat);
    chain.position.set(0, -0.72, 0.16);
    const censer = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: lanternHex }),
    );
    censer.position.set(0, -0.92, 0.16);
    rightArm.add(chain, censer);
  } else if (archetype === 'noble') {
    if (isCountess) {
      const fan = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.24, 5), trimMat);
      fan.position.set(0, -0.58, 0.16);
      fan.rotation.x = Math.PI * 0.72;
      rightArm.add(fan);
    } else {
      const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.015, 0.94, 5), trimMat);
      cane.position.set(0, -0.56, 0.18);
      cane.rotation.x = 0.15;
      rightArm.add(cane);
      if (isPatriarch) {
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), trimMat);
        orb.position.set(0, -0.1, 0.25);
        rightArm.add(orb);
      }
    }
  } else if (isBlacksmith) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), coatMat);
    handle.position.set(0, -0.54, 0.18);
    handle.rotation.x = Math.PI / 2.2;
    const headHammer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.2), trimMat);
    headHammer.position.set(0, -0.46, 0.36);
    rightArm.add(handle, headHammer);
  }
  bodyGroup.add(rightArm);

  // Overhead diegetic Eye Visibility billboard marker
  const alertMat = new THREE.MeshBasicMaterial({
    map: textures.eyeClosedMap,
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const alertSpriteMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.39), alertMat);
  alertSpriteMesh.position.y = 2.45;
  alertSpriteMesh.visible = false;
  root.add(alertSpriteMesh);

  // Diegetic guard HP bar above head (only visible in combat)
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.y = 2.15;
  hpBarGroup.visible = false;
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x11131d, side: THREE.DoubleSide }),
  );
  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.065),
    new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }),
  );
  hpBarFill.position.z = 0.005;
  hpBarGroup.add(hpBg, hpBarFill);
  root.add(hpBarGroup);

  // Through-wall crimson heartbeat pulse aura for Sentido Carmesim (Auspícios)
  const crimsonPulseMat = new THREE.MeshBasicMaterial({
    color: archetype === 'noble' ? 0xff2b55 : hasGuardGear ? 0xf59e0b : 0xdc2626,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const crimsonPulseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 1.36, 7),
    crimsonPulseMat,
  );
  crimsonPulseMesh.position.y = 1.1;
  crimsonPulseMesh.renderOrder = 4;
  crimsonPulseMesh.visible = false;
  bodyGroup.add(crimsonPulseMesh);

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    lanternMat,
    visionCone,
    visionConeGeo,
    visionConeMat,
    crimsonPulseMesh,
    crimsonPulseMat,
    alertSpriteMesh,
    alertMat,
    hpBarGroup,
    hpBarFill,
    contactShadow,
    bloodGlowMat: coatMat,
  };
}

export function createGothicBuilding(
  width: number,
  height: number,
  depth: number,
  mats: GothicMaterialLibrary,
  options: { hasSpire?: boolean; windowSide?: 'front' | 'all' } = {},
): THREE.Group {
  const group = new THREE.Group();

  // Base stone plinth (grounded at y=0)
  const plinthH = 0.7;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.5, plinthH, depth + 0.5),
    mats.darkStone,
  );
  plinth.position.y = plinthH / 2;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  // Main masonry body
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats.stone);
  body.position.y = plinthH + height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Corner buttress pilasters (secondary silhouette)
  const pilasterGeo = new THREE.BoxGeometry(0.65, height + 0.3, 0.65);
  const corners = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ];
  for (const [cx, cz] of corners) {
    const p = new THREE.Mesh(pilasterGeo, mats.darkStone);
    p.position.set(cx, plinthH + height / 2, cz);
    p.castShadow = true;
    group.add(p);
  }

  // Pitched slate roof (4-sided pyramid/gable)
  const roofH = Math.min(width, depth) * 0.45 + 1.2;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.74, roofH, 4),
    mats.roof,
  );
  roof.position.y = plinthH + height + roofH / 2 - 0.05;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
  roof.castShadow = true;
  group.add(roof);

  // Glowing gothic stained-glass windows (accent detail)
  const winW = 1.1;
  const winH = 2.2;
  const winGeo = new THREE.PlaneGeometry(winW, winH);
  const rows = Math.max(1, Math.floor((height - 2) / 4));
  const colsZ = Math.max(1, Math.floor(width / 4.2));
  for (let r = 0; r < rows; r++) {
    const wy = plinthH + 2.4 + r * 3.8;
    for (let c = 0; c < colsZ; c++) {
      const wx = -((colsZ - 1) * 3.2) / 2 + c * 3.2;
      const wFront = new THREE.Mesh(winGeo, mats.stainedGlass);
      wFront.position.set(wx, wy, depth / 2 + 0.03);
      group.add(wFront);

      if (options.windowSide !== 'front') {
        const wBack = new THREE.Mesh(winGeo, mats.stainedGlass);
        wBack.position.set(wx, wy, -depth / 2 - 0.03);
        wBack.rotation.y = Math.PI;
        group.add(wBack);
      }
    }
  }

  if (options.hasSpire) {
    const spireBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 2.2), mats.darkStone);
    spireBase.position.y = plinthH + height + roofH * 0.55;
    spireBase.castShadow = true;
    const spireTip = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.2, 4), mats.roof);
    spireTip.position.y = plinthH + height + roofH * 0.55 + 4.5;
    spireTip.rotation.y = Math.PI / 4;
    group.add(spireBase, spireTip);
  }

  return group;
}

export function createCathedral(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  // Grand nave
  const nave = new THREE.Mesh(new THREE.BoxGeometry(16, 15, 24), mats.stone);
  nave.position.y = 7.5;
  nave.castShadow = true;
  nave.receiveShadow = true;
  group.add(nave);

  // Stepped entry stairs
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(10 - i * 0.9, 0.35, 2.6 - i * 0.6),
      mats.darkStone,
    );
    step.position.set(0, 0.175 + i * 0.35, 13.0 - i * 0.55);
    step.receiveShadow = true;
    group.add(step);
  }

  // Twin bell towers
  [-6.2, 6.2].forEach((tx) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4, 24, 4.8), mats.darkStone);
    tower.position.set(tx, 12, 10.2);
    tower.castShadow = true;
    tower.receiveShadow = true;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.0, 9.5, 4), mats.roof);
    spire.position.set(tx, 28.7, 10.2);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    group.add(tower, spire);
  });

  // Central pitched roof
  const naveRoof = new THREE.Mesh(new THREE.ConeGeometry(11.5, 7, 4), mats.roof);
  naveRoof.position.set(0, 18.4, -1);
  naveRoof.rotation.y = Math.PI / 4;
  naveRoof.scale.set(1.0, 1, 1.5);
  naveRoof.castShadow = true;
  group.add(naveRoof);

  // Rose window above cathedral doors
  const rose = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), mats.roseWindow);
  rose.position.set(0, 10.8, 12.06);
  group.add(rose);

  // Dark arched cathedral portal
  const portal = new THREE.Mesh(new THREE.BoxGeometry(3.8, 5.2, 0.4), mats.iron);
  portal.position.set(0, 3.6, 12.0);
  group.add(portal);

  // Side flying buttresses & lancet windows
  for (let z = -8; z <= 6; z += 4.5) {
    [-8.3, 8.3].forEach((bx) => {
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(1.1, 11, 1.2), mats.darkStone);
      buttress.position.set(bx, 5.5, z);
      buttress.castShadow = true;
      group.add(buttress);
    });
    const wL = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), mats.stainedGlass);
    wL.position.set(-8.04, 8.2, z + 2.2);
    wL.rotation.y = -Math.PI / 2;
    const wR = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), mats.stainedGlass);
    wR.position.set(8.04, 8.2, z + 2.2);
    wR.rotation.y = Math.PI / 2;
    group.add(wL, wR);
  }

  return group;
}

export interface StreetLampInstance {
  id: number;
  group: THREE.Group;
  position: THREE.Vector3;
  pointLight: THREE.PointLight;
  flameMesh: THREE.Mesh;
  poolMesh: THREE.Mesh;
  lightConeMesh: THREE.Mesh;
  isLit: boolean;
  extinguishTimer: number;
}

export function createStreetLamp(
  id: number,
  x: number,
  z: number,
  mats: GothicMaterialLibrary,
  textures: GothicTextures,
): StreetLampInstance {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Stepped iron base + fluted pole + lantern cage
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.55, 6), mats.iron);
  base.position.y = 0.275;
  base.castShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 4.1, 6), mats.iron);
  pole.position.y = 2.55;
  pole.castShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.2, 6), mats.brass);
  collar.position.y = 4.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.45, 6), mats.iron);
  cap.position.y = 5.25;

  const flameMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.15, 1.32, 0.42),
    toneMapped: false,
  });
  const flameMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), flameMat);
  flameMesh.position.y = 4.86;

  // Warm volumetric light cone with soft vertical vertex-color attenuation
  const coneGeo = new THREE.CylinderGeometry(0.35, 3.85, 4.85, 14, 1, true);
  const conePos = coneGeo.attributes.position as THREE.BufferAttribute;
  const coneColors = new Float32Array(conePos.count * 3);
  for (let i = 0; i < conePos.count; i++) {
    const vy = conePos.getY(i);
    // Top vertices (+2.425) glow warmer; bottom ground vertices (-2.425) attenuate smoothly to zero
    const tTop = THREE.MathUtils.clamp((vy + 2.425) / 4.85, 0, 1);
    const atten = Math.pow(tTop, 1.85);
    coneColors[i * 3] = 1.0 * atten;
    coneColors[i * 3 + 1] = 0.62 * atten;
    coneColors[i * 3 + 2] = 0.24 * atten;
  }
  coneGeo.setAttribute('color', new THREE.BufferAttribute(coneColors, 3));
  const lightConeMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lightConeMesh = new THREE.Mesh(coneGeo, lightConeMat);
  lightConeMesh.position.y = 2.45;

  // Ground light pool
  const poolMat = new THREE.MeshBasicMaterial({
    map: textures.lampPoolMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.62,
  });
  const poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 14.5), poolMat);
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.y = 0.03;

  const pointLight = new THREE.PointLight(0xff9b3d, 28, 17.5, 2.0);
  pointLight.position.set(0, 4.8, 0);

  group.add(base, pole, collar, cap, flameMesh, lightConeMesh, poolMesh, pointLight);

  return {
    id,
    group,
    position: new THREE.Vector3(x, 0, z),
    pointLight,
    flameMesh,
    poolMesh,
    lightConeMesh,
    isLit: true,
    extinguishTimer: 0,
  };
}

export function createBloodAltar(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.45, 8), mats.darkStone);
  dais.position.y = 0.225;
  dais.receiveShadow = true;
  group.add(dais);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.35, 6), mats.stone);
  pedestal.position.y = 1.1;
  pedestal.castShadow = true;
  group.add(pedestal);

  const chalice = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), mats.bloodAltarGlow);
  chalice.position.y = 2.25;
  chalice.name = 'altarCrystal';
  group.add(chalice);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 6, 16), mats.brass);
  ring.position.y = 2.25;
  ring.rotation.x = Math.PI / 3;
  ring.name = 'altarRing';
  group.add(ring);

  const light = new THREE.PointLight(0xef4444, 10, 10, 1.8);
  light.position.y = 2.4;
  group.add(light);

  return group;
}

export function createFountain(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, 0.75, 10), mats.darkStone);
  basin.position.y = 0.375;
  basin.castShadow = true;
  basin.receiveShadow = true;

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.0, 0.62, 10),
    new THREE.MeshStandardMaterial({ color: 0x0e1d30, roughness: 0.15, metalness: 0.7 }),
  );
  water.position.y = 0.38;

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 2.5, 8), mats.stone);
  spire.position.y = 1.5;
  spire.castShadow = true;

  const gargoyleTop = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), mats.darkStone);
  gargoyleTop.position.y = 2.95;

  group.add(basin, water, spire, gargoyleTop);
  return group;
}

export function createDeadTree(mats: GothicMaterialLibrary, seed = 1): THREE.Group {
  const group = new THREE.Group();
  const scaleH = 0.85 + (seed % 5) * 0.12;

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 3.8 * scaleH, 6), mats.treeBark);
  trunk.position.y = 1.9 * scaleH;
  trunk.rotation.z = ((seed % 3) - 1) * 0.06;
  trunk.castShadow = true;
  group.add(trunk);

  const branchGeo = new THREE.CylinderGeometry(0.05, 0.14, 2.2, 5);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(branchGeo, mats.treeBark);
    const angle = (i / 4) * Math.PI * 2 + seed * 0.7;
    b.position.set(Math.cos(angle) * 0.55, 3.1 * scaleH, Math.sin(angle) * 0.55);
    b.rotation.z = Math.cos(angle) * 0.75;
    b.rotation.x = -Math.sin(angle) * 0.75;
    b.castShadow = true;
    group.add(b);
  }
  return group;
}

export function createGravestone(mats: GothicMaterialLibrary, variant = 0): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.45), mats.darkStone);
  base.position.y = 0.125;
  group.add(base);

  if (variant % 2 === 0) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.15, 0.22), mats.stone);
    slab.position.y = 0.8;
    slab.rotation.z = ((variant % 5) - 2) * 0.04;
    slab.castShadow = true;
    group.add(slab);
  } else {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.2), mats.stone);
    post.position.y = 0.85;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.2), mats.stone);
    arm.position.y = 1.15;
    post.castShadow = true;
    group.add(post, arm);
  }
  return group;
}

export function createGothicPlatform(
  width: number,
  height: number,
  depth: number,
  mats: GothicMaterialLibrary,
  options: { withRailings?: boolean; pillars?: boolean } = {},
): THREE.Group {
  const group = new THREE.Group();

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, depth), mats.darkStone);
  deck.position.y = height - 0.275;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  if (options.pillars !== false) {
    const pGeo = new THREE.BoxGeometry(0.7, height - 0.55, 0.7);
    const px = Math.max(0.5, width / 2 - 0.45);
    const pz = Math.max(0.5, depth / 2 - 0.45);
    [
      [-px, -pz],
      [px, -pz],
      [-px, pz],
      [px, pz],
    ].forEach(([cx, cz]) => {
      const p = new THREE.Mesh(pGeo, mats.stone);
      p.position.set(cx, (height - 0.55) / 2, cz);
      p.castShadow = true;
      p.receiveShadow = true;
      group.add(p);
    });
  }

  if (options.withRailings) {
    const postGeo = new THREE.BoxGeometry(0.24, 0.9, 0.24);
    const barZ = new THREE.BoxGeometry(0.1, 0.1, depth - 0.4);
    [-width / 2 + 0.2, width / 2 - 0.2].forEach((rx) => {
      const rail = new THREE.Mesh(barZ, mats.iron);
      rail.position.set(rx, height + 0.72, 0);
      group.add(rail);
      for (let z = -depth / 2 + 0.4; z <= depth / 2 - 0.4; z += 2.4) {
        const post = new THREE.Mesh(postGeo, mats.darkStone);
        post.position.set(rx, height + 0.45, z);
        group.add(post);
      }
    });
  }

  return group;
}

export function createStoneStaircase(
  width: number,
  totalHeight: number,
  length: number,
  steps: number,
  mats: GothicMaterialLibrary,
  direction: 'north' | 'south' | 'east' | 'west',
): THREE.Group {
  const group = new THREE.Group();
  const stepH = totalHeight / steps;
  const stepD = length / steps;

  for (let i = 0; i < steps; i++) {
    const h = stepH * (i + 1);
    const box = new THREE.Mesh(new THREE.BoxGeometry(width, h, stepD + 0.04), mats.stone);
    box.position.set(0, h / 2, -length / 2 + stepD * (i + 0.5));
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }

  // Side parapet walls along stairs
  const wallGeo = new THREE.BoxGeometry(0.32, 0.75, length);
  [-width / 2 + 0.16, width / 2 - 0.16].forEach((wx) => {
    const wall = new THREE.Mesh(wallGeo, mats.darkStone);
    wall.position.set(wx, totalHeight * 0.5 + 0.35, 0);
    wall.rotation.x = -Math.atan2(totalHeight, length);
    group.add(wall);
  });

  // Local +Z is the upward/exit direction (top step is at +length/2)
  if (direction === 'north') group.rotation.y = Math.PI;
  else if (direction === 'south') group.rotation.y = 0;
  else if (direction === 'east') group.rotation.y = Math.PI / 2;
  else if (direction === 'west') group.rotation.y = -Math.PI / 2;

  return group;
}

export function createScaffoldingStack(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  // Bottom heavy crate + upper crate + iron bands
  const crate1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), mats.treeBark);
  crate1.position.set(0, 0.75, 0);
  crate1.castShadow = true;
  crate1.receiveShadow = true;

  const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), mats.treeBark);
  crate2.position.set(0.25, 2.2, -0.2);
  crate2.castShadow = true;
  crate2.receiveShadow = true;

  const ironBand = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.16, 2.26), mats.iron);
  ironBand.position.set(0, 1.38, 0);

  group.add(crate1, crate2, ironBand);
  return group;
}

export interface AlarmBellInstance {
  id: number;
  name: string;
  group: THREE.Group;
  bellPivot: THREE.Group;
  beaconMat: THREE.MeshBasicMaterial;
  ropeMesh: THREE.Mesh;
  position: THREE.Vector3;
  sabotaged: boolean;
  ringTimer: number;
  cooldown: number;
}

export function createAlarmBell(
  id: number,
  name: string,
  x: number,
  z: number,
  mats: GothicMaterialLibrary,
): AlarmBellInstance {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Stone belfry plinth + twin iron posts + pitched canopy + swinging bronze bell
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.3), mats.darkStone);
  base.position.y = 0.225;
  base.castShadow = true;
  base.receiveShadow = true;

  const postGeo = new THREE.BoxGeometry(0.2, 3.6, 0.2);
  const postL = new THREE.Mesh(postGeo, mats.iron);
  postL.position.set(-0.5, 2.0, 0);
  postL.castShadow = true;
  const postR = new THREE.Mesh(postGeo, mats.iron);
  postR.position.set(0.5, 2.0, 0);
  postR.castShadow = true;

  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.22, 0.35), mats.darkStone);
  beam.position.y = 3.8;
  beam.castShadow = true;

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.85, 4), mats.roof);
  roof.position.y = 4.3;
  roof.rotation.y = Math.PI / 4;

  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 3.62, 0);
  const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.65, 10), mats.brass);
  bellBody.position.y = -0.35;
  bellBody.castShadow = true;
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), mats.iron);
  clapper.position.y = -0.7;
  bellPivot.add(bellBody, clapper);

  const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 5), mats.brass);
  ropeMesh.position.set(0.32, 1.65, 0);

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), beaconMat);
  beacon.position.y = 4.9;

  group.add(base, postL, postR, beam, roof, bellPivot, ropeMesh, beacon);

  return {
    id,
    name,
    group,
    bellPivot,
    beaconMat,
    ropeMesh,
    position: new THREE.Vector3(x, 0, z),
    sabotaged: false,
    ringTimer: 0,
    cooldown: 0,
  };
}

export interface BreakablePropInstance {
  id: number;
  kind: 'barrel' | 'urn';
  group: THREE.Group;
  position: THREE.Vector3;
  broken: boolean;
}

export function createBreakableProp(
  id: number,
  kind: 'barrel' | 'urn',
  x: number,
  y: number,
  z: number,
  mats: GothicMaterialLibrary,
): BreakablePropInstance {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  if (kind === 'barrel') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.02, 10), mats.treeBark);
    body.position.y = 0.51;
    body.castShadow = true;
    body.receiveShadow = true;

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 10), mats.darkStone);
    lid.position.y = 1.03;

    const hoopGeo = new THREE.TorusGeometry(0.415, 0.032, 6, 12);
    const hoopLow = new THREE.Mesh(hoopGeo, mats.iron);
    hoopLow.rotation.x = Math.PI / 2;
    hoopLow.position.y = 0.28;

    const hoopHigh = new THREE.Mesh(hoopGeo, mats.iron);
    hoopHigh.rotation.x = Math.PI / 2;
    hoopHigh.position.y = 0.76;

    group.add(body, lid, hoopLow, hoopHigh);
  } else {
    // Gothic ceramic urn via LatheGeometry (bottom at y=0)
    const points = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.22, 0.0),
      new THREE.Vector2(0.36, 0.36),
      new THREE.Vector2(0.32, 0.68),
      new THREE.Vector2(0.16, 0.88),
      new THREE.Vector2(0.24, 1.02),
      new THREE.Vector2(0.19, 1.04),
    ];
    const urnMesh = new THREE.Mesh(new THREE.LatheGeometry(points, 12), mats.stone);
    urnMesh.castShadow = true;
    urnMesh.receiveShadow = true;

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 6, 12), mats.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.02;

    group.add(urnMesh, rim);
  }

  return {
    id,
    kind,
    group,
    position: new THREE.Vector3(x, y, z),
    broken: false,
  };
}

export interface MemoryFragmentInstance {
  id: string;
  title: string;
  group: THREE.Group;
  crystalPivot: THREE.Group;
  position: THREE.Vector3;
  collected: boolean;
}

export function createMemoryFragment(
  id: string,
  title: string,
  x: number,
  y: number,
  z: number,
  mats: GothicMaterialLibrary,
): MemoryFragmentInstance {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // Subtle carved stone base + glowing sigil ring on floor
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.24, 6), mats.darkStone);
  plinth.position.y = 0.12;
  plinth.castShadow = true;
  plinth.receiveShadow = true;

  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.56, 20),
    new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.03;

  // Hovering crystal & brass astrolabe halo
  const crystalPivot = new THREE.Group();
  crystalPivot.position.y = 0.92;

  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mats.memoryGlow);
  shard.scale.set(0.72, 1.35, 0.72);
  shard.castShadow = true;

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 18), mats.brass);
  halo.rotation.x = Math.PI / 3;

  crystalPivot.add(shard, halo);
  group.add(plinth, groundRing, crystalPivot);

  return {
    id,
    title,
    group,
    crystalPivot,
    position: new THREE.Vector3(x, y, z),
    collected: false,
  };
}

export function createGothicBanner(
  width: number,
  height: number,
  clothMat: THREE.MeshStandardMaterial,
  mats: GothicMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();

  // Iron crossbar with brass finials at y=0 (banner hangs downward)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, width + 0.34, 6), mats.iron);
  bar.rotation.z = Math.PI / 2;
  group.add(bar);

  [-width / 2 - 0.18, width / 2 + 0.18].forEach((fx) => {
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), mats.brass);
    finial.position.x = fx;
    group.add(finial);
  });

  // Subdivided cloth mesh pinned at top UV (uv.y = 1.0)
  const clothGeo = new THREE.PlaneGeometry(width, height, 4, 8);
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.y = -height / 2;
  cloth.castShadow = true;
  group.add(cloth);

  // Brass emblem trim near top
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(width * 0.16, 0), mats.brass);
  emblem.scale.set(1, 1.4, 0.25);
  emblem.position.set(0, -height * 0.22, 0.03);
  group.add(emblem);

  return group;
}

export function createDrapedCurtain(
  width: number,
  height: number,
  clothMat: THREE.MeshStandardMaterial,
  mats: GothicMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width + 0.3, 6), mats.iron);
  rod.rotation.z = Math.PI / 2;
  group.add(rod);

  const panelW = width * 0.44;
  [-width * 0.28, width * 0.28].forEach((px) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(panelW, height, 4, 8), clothMat);
    panel.position.set(px, -height / 2, 0);
    panel.castShadow = true;
    group.add(panel);
  });

  return group;
}

export function createSmokeChimney(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const stack = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.6, 0.95), mats.darkStone);
  stack.position.y = 0.8;
  stack.castShadow = true;
  stack.receiveShadow = true;

  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 1.18), mats.stone);
  rim.position.y = 1.68;
  rim.castShadow = true;

  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.55, 6), mats.iron);
  cowl.position.y = 2.02;

  group.add(stack, rim, cowl);
  return group;
}

export function createVictorianBuilding(
  width: number,
  height: number,
  depth: number,
  mats: GothicMaterialLibrary,
  opts: {
    brick?: boolean;
    hasVitrine?: boolean;
    hasBalcony?: boolean;
    roofStyle?: 'pitched' | 'mansard' | 'flat';
    chimney?: boolean;
  } = {},
): THREE.Group {
  const group = new THREE.Group();
  const wallMat = opts.brick ? mats.brick : mats.stone;

  // Heavy ground floor plinth
  const plinthH = 0.65;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.45, plinthH, depth + 0.45), mats.darkStone);
  plinth.position.y = plinthH / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Ground floor & upper story bodies separated by molded stringcourse cornice
  const groundH = Math.min(3.6, height * 0.42);
  const groundBody = new THREE.Mesh(new THREE.BoxGeometry(width, groundH, depth), mats.darkStone);
  groundBody.position.y = plinthH + groundH / 2;
  groundBody.castShadow = true;
  groundBody.receiveShadow = true;
  group.add(groundBody);

  const upperH = Math.max(2.6, height - groundH);
  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(width - 0.14, upperH, depth - 0.14), wallMat);
  upperBody.position.y = plinthH + groundH + upperH / 2;
  upperBody.castShadow = true;
  upperBody.receiveShadow = true;
  group.add(upperBody);

  // Horizontal stone stringcourse cornices
  const corniceMid = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.28, depth + 0.32), mats.stone);
  corniceMid.position.y = plinthH + groundH;
  const corniceTop = new THREE.Mesh(new THREE.BoxGeometry(width + 0.46, 0.34, depth + 0.46), mats.darkStone);
  corniceTop.position.y = plinthH + groundH + upperH;
  group.add(corniceMid, corniceTop);

  // Shopfront glowing vitrines or carved arched door on front (+Z) & back (-Z)
  if (opts.hasVitrine) {
    const vitrineCount = Math.max(1, Math.floor((width - 2.2) / 3.4));
    const vitrineGeo = new THREE.PlaneGeometry(2.1, 2.2);
    const frameGeo = new THREE.BoxGeometry(2.34, 2.42, 0.16);
    for (let i = 0; i < vitrineCount; i++) {
      const vx = -((vitrineCount - 1) * 3.1) / 2 + i * 3.1;
      const frameF = new THREE.Mesh(frameGeo, mats.wood);
      frameF.position.set(vx, plinthH + 1.45, depth / 2 + 0.04);
      const glassF = new THREE.Mesh(vitrineGeo, mats.vitrine);
      glassF.position.set(vx, plinthH + 1.45, depth / 2 + 0.13);
      group.add(frameF, glassF);
    }
    // Slanted cloth/iron shop awning over vitrines
    const awning = new THREE.Mesh(new THREE.BoxGeometry(width - 0.8, 0.18, 1.35), mats.clothCrimson);
    awning.position.set(0, plinthH + 2.95, depth / 2 + 0.58);
    awning.rotation.x = 0.28;
    group.add(awning);
  } else {
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.55, 0.2), mats.wood);
    doorFrame.position.set(0, plinthH + 1.28, depth / 2 + 0.04);
    group.add(doorFrame);
  }

  // Upper floor mullioned windows
  const cols = Math.max(1, Math.floor((width - 1.5) / 3.2));
  const rows = Math.max(1, Math.floor((upperH - 0.8) / 3.3));
  const winGeo = new THREE.PlaneGeometry(1.05, 1.85);
  for (let r = 0; r < rows; r++) {
    const wy = plinthH + groundH + 1.7 + r * 3.1;
    for (let c = 0; c < cols; c++) {
      const wx = -((cols - 1) * 2.8) / 2 + c * 2.8;
      const wf = new THREE.Mesh(winGeo, mats.stainedGlass);
      wf.position.set(wx, wy, depth / 2 - 0.04);
      const wb = new THREE.Mesh(winGeo, mats.stainedGlass);
      wb.position.set(wx, wy, -depth / 2 + 0.04);
      wb.rotation.y = Math.PI;
      group.add(wf, wb);
    }
  }

  // Optional wrought-iron balcony along +Z face
  if (opts.hasBalcony) {
    const balcY = plinthH + groundH + 0.06;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.22, 1.45), mats.darkStone);
    slab.position.set(0, balcY, depth / 2 + 0.72);
    slab.castShadow = true;
    const railFront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.08, 0.08), mats.iron);
    railFront.position.set(0, balcY + 0.85, depth / 2 + 1.38);
    group.add(slab, railFront);
    for (let bx = -width * 0.34; bx <= width * 0.34; bx += 0.9) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.07), mats.iron);
      post.position.set(bx, balcY + 0.44, depth / 2 + 1.38);
      group.add(post);
    }
  }

  // Roof style
  const topY = plinthH + groundH + upperH + 0.16;
  const style = opts.roofStyle ?? 'pitched';
  if (style === 'mansard') {
    const mansard = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(width, depth) * 0.56, Math.max(width, depth) * 0.72, 2.3, 4), mats.roof);
    mansard.position.y = topY + 1.15;
    mansard.rotation.y = Math.PI / 4;
    mansard.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    mansard.castShadow = true;
    group.add(mansard);
  } else if (style === 'pitched') {
    const roofH = Math.min(width, depth) * 0.42 + 1.0;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.72, roofH, 4), mats.roof);
    roof.position.y = topY + roofH / 2 - 0.05;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    roof.castShadow = true;
    group.add(roof);
  }

  if (opts.chimney !== false && style !== 'flat') {
    const ch = createSmokeChimney(mats);
    ch.position.set(width * 0.25, topY + 0.8, -depth * 0.18);
    group.add(ch);
  }

  return group;
}

export function createVictorianCarriage(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  // Lacquered carriage cabin
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.55, 2.75), mats.wood);
  cab.position.set(0, 1.48, 0);
  cab.castShadow = true;
  cab.receiveShadow = true;
  group.add(cab);

  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.22, 2.9), mats.iron);
  cabRoof.position.set(0, 2.34, 0);
  cabRoof.castShadow = true;
  group.add(cabRoof);

  // Brass window trim & glowing warm interior slits
  const winMat = mats.vitrine;
  [-1.04, 1.04].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.65), winMat);
    win.position.set(wx, 1.65, 0);
    win.rotation.y = wx > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(win);
  });

  // Coachman bench at front (+Z)
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 0.72), mats.darkStone);
  bench.position.set(0, 1.32, 1.68);
  bench.castShadow = true;
  group.add(bench);

  // Twin brass carriage lanterns flanking coachbox
  const lanternGeo = new THREE.OctahedronGeometry(0.11, 0);
  [-0.95, 0.95].forEach((lx) => {
    const lamp = new THREE.Mesh(lanternGeo, mats.vitrine);
    lamp.position.set(lx, 1.75, 1.44);
    group.add(lamp);
  });

  // 4 Spoked iron/wood wheels
  const wheelGeoFront = new THREE.TorusGeometry(0.46, 0.075, 6, 12);
  const wheelGeoRear = new THREE.TorusGeometry(0.62, 0.085, 6, 14);
  const axleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.32, 6);
  [1.25, -1.05].forEach((wz, idx) => {
    const axle = new THREE.Mesh(axleGeo, mats.iron);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, idx === 0 ? 0.52 : 0.68, wz);
    group.add(axle);

    [-1.12, 1.12].forEach((wx) => {
      const wheel = new THREE.Mesh(idx === 0 ? wheelGeoFront : wheelGeoRear, mats.iron);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(wx, idx === 0 ? 0.52 : 0.68, wz);
      wheel.castShadow = true;
      group.add(wheel);
    });
  });

  return group;
}

export function createMausoleum(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 7.6), mats.darkStone);
  plinth.position.y = 0.25;
  plinth.receiveShadow = true;
  group.add(plinth);

  const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.2, 6.8), mats.stone);
  body.position.y = 2.6;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Corner Gothic columns
  [
    [-2.85, -3.45],
    [2.85, -3.45],
    [-2.85, 3.45],
    [2.85, 3.45],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.5, 6), mats.darkStone);
    col.position.set(cx, 2.6, cz);
    col.castShadow = true;
    group.add(col);
  });

  // Pitched stone roof + cross finial
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.4, 4), mats.roof);
  roof.position.y = 5.9;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 1.18);
  roof.castShadow = true;
  group.add(roof);

  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), mats.iron);
  crossV.position.set(0, 7.25, 0);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.14), mats.iron);
  crossH.position.set(0, 7.45, 0);
  group.add(crossV, crossH);

  // Iron tomb gate on +Z
  const gate = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.1, 0.22), mats.iron);
  gate.position.set(0, 2.05, 3.42);
  group.add(gate);

  return group;
}

export function createVictorianManor(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  // Grand stone terrace base
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(21, 0.8, 15), mats.darkStone);
  plinth.position.y = 0.4;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Central aristocratic hall + flanking wings
  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(11, 10.5, 13), mats.brick);
  mainHall.position.y = 6.05;
  mainHall.castShadow = true;
  mainHall.receiveShadow = true;
  group.add(mainHall);

  [-7.2, 7.2].forEach((wx) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 8.2, 11.4), mats.stone);
    wing.position.set(wx, 4.9, 0.2);
    wing.castShadow = true;
    wing.receiveShadow = true;
    const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.6, 4), mats.roof);
    wingRoof.position.set(wx, 10.3, 0.2);
    wingRoof.rotation.y = Math.PI / 4;
    wingRoof.scale.set(0.85, 1, 1.8);
    group.add(wing, wingRoof);
  });

  // Grand mansard roof + twin chimneys
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 9.2, 3.4, 4), mats.roof);
  roof.position.y = 13.0;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.0, 1, 1.15);
  roof.castShadow = true;
  group.add(roof);

  [-3.8, 3.8].forEach((cx) => {
    const ch = createSmokeChimney(mats);
    ch.position.set(cx, 13.8, -2.2);
    group.add(ch);
  });

  // Glowing crimson manor windows & veranda portico on West (-X) facing cemetery/gardens
  const winGeo = new THREE.PlaneGeometry(1.3, 2.4);
  for (let z = -4.2; z <= 4.2; z += 4.2) {
    const wLow = new THREE.Mesh(winGeo, mats.stainedGlass);
    wLow.position.set(-9.65, 3.0, z);
    wLow.rotation.y = -Math.PI / 2;
    const wHigh = new THREE.Mesh(winGeo, mats.stainedGlass);
    wHigh.position.set(-9.65, 6.4, z);
    wHigh.rotation.y = -Math.PI / 2;
    group.add(wLow, wHigh);
  }

  return group;
}

export function createStoneArchway(
  width: number,
  height: number,
  depth: number,
  mats: GothicMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  const pillarW = Math.max(1.2, width * 0.16);
  const openingW = width - pillarW * 2;

  [-openingW / 2 - pillarW / 2, openingW / 2 + pillarW / 2].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, height, depth), mats.darkStone);
    pillar.position.set(px, height / 2, 0);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  });

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 1.6, depth + 0.4), mats.stone);
  lintel.position.y = height + 0.8;
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  group.add(lintel);

  const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.6, depth + 0.5), mats.darkStone);
  parapet.position.y = height + 1.9;
  group.add(parapet);

  return group;
}

export function createSewerGrate(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 1.75), mats.darkStone);
  frame.position.y = 0.04;
  group.add(frame);

  const barGeo = new THREE.BoxGeometry(1.45, 0.1, 0.11);
  for (let b = -0.55; b <= 0.55; b += 0.275) {
    const bar = new THREE.Mesh(barGeo, mats.iron);
    bar.position.set(0, 0.06, b);
    group.add(bar);
  }
  return group;
}

export function createSidewalkCurb(
  width: number,
  depth: number,
  mats: GothicMaterialLibrary,
  height = 0.24,
): THREE.Group {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats.darkStone);
  slab.position.y = height / 2;
  slab.receiveShadow = true;
  group.add(slab);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.04, depth + 0.08), mats.stone);
  cap.position.y = height - 0.02;
  cap.receiveShadow = true;
  group.add(cap);
  return group;
}

export function createWaterPuddle(
  radius: number,
  seed: number,
  mats: GothicMaterialLibrary,
): THREE.Mesh {
  const shape = new THREE.Shape();
  const pts = 11;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const jitter = 0.72 + Math.abs(Math.sin(seed * 3.1 + i * 2.3)) * 0.42;
    const px = Math.cos(a) * radius * jitter;
    const py = Math.sin(a) * radius * (0.78 + Math.abs(Math.cos(seed * 1.9 + i * 1.7)) * 0.36);
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape, 10);
  const mesh = new THREE.Mesh(geo, mats.puddle);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.016;
  mesh.receiveShadow = true;
  return mesh;
}

export function createWroughtIronFence(
  length: number,
  mats: GothicMaterialLibrary,
  height = 1.95,
): THREE.Group {
  const group = new THREE.Group();

  // Low dark stone plinth wall anchoring fence to the ground
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(length, 0.42, 0.38), mats.darkStone);
  plinth.position.y = 0.21;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.1), mats.iron);
  topRail.position.y = height - 0.18;
  const midRail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.07, 0.09), mats.iron);
  midRail.position.y = 0.65;
  group.add(topRail, midRail);

  const count = Math.max(2, Math.floor(length / 0.55));
  const picketGeo = new THREE.BoxGeometry(0.06, height - 0.42, 0.06);
  const spearGeo = new THREE.ConeGeometry(0.055, 0.18, 4);
  for (let i = 0; i <= count; i++) {
    const px = -length / 2 + (i / count) * length;
    const picket = new THREE.Mesh(picketGeo, mats.iron);
    picket.position.set(px, 0.42 + (height - 0.42) / 2, 0);
    picket.castShadow = true;
    const tip = new THREE.Mesh(spearGeo, mats.iron);
    tip.position.set(px, height + 0.06, 0);
    group.add(picket, tip);
  }

  // Stone end piers
  [-length / 2, length / 2].forEach((ex) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.46, height + 0.25, 0.46), mats.stone);
    pier.position.set(ex, (height + 0.25) / 2, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);
  });

  return group;
}

export function createVampireCoffin(mats: GothicMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  // Heavy carved dark stone bier base
  const bier = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.44, 3.0), mats.darkStone);
  bier.position.y = 0.22;
  bier.castShadow = true;
  bier.receiveShadow = true;
  group.add(bier);

  // Lacquered mahogany/ebony coffin hull
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.56, 2.38), mats.wood);
  body.position.y = 0.72;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Crimson velvet interior lining visible slightly around beveled lid
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 2.18), mats.vampireCrimson);
  velvet.position.y = 1.01;
  group.add(velvet);

  // Carved beveled coffin lid (slightly ajar in anticipation of rest)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.14, 2.42), mats.wood);
  lid.position.set(0.14, 1.08, 0);
  lid.rotation.y = 0.08;
  lid.castShadow = true;
  group.add(lid);

  // Brass Gothic cross & corner fittings on the coffin lid
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.35), mats.brass);
  crossV.position.set(0.14, 1.16, 0);
  crossV.rotation.y = 0.08;
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.1), mats.brass);
  crossH.position.set(0.11, 1.16, -0.32);
  crossH.rotation.y = 0.08;
  group.add(crossV, crossH);

  // Twin crimson-candle iron candelabra flanking the coffin head
  const candleFlameMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.2, 0.5, 0.3),
    toneMapped: false,
  });
  [-0.95, 0.95].forEach((cx) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 1.15, 6), mats.iron);
    stand.position.set(cx, 0.575, -1.25);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 6), mats.stone);
    candle.position.set(cx, 1.26, -1.25);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), candleFlameMat);
    flame.position.set(cx, 1.46, -1.25);
    group.add(stand, candle, flame);
  });

  const coffinLight = new THREE.PointLight(0xdc2626, 12, 11, 1.8);
  coffinLight.position.set(0, 1.85, -0.4);
  group.add(coffinLight);

  return group;
}
