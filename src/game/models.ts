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
  sharedUniforms: StylizedShaderUniforms,
): VampireRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Clone & re-apply PS2 Gothic shader per stealth material so Obfuscate translucency
  // works cleanly without breaking shader effects or windSway
  const coatMat = applyPs2GothicShader(mats.vampireCoat.clone(), sharedUniforms, {
    rimColor: 0x8ea8ff,
    rimStrength: 0.44,
    celBands: 3.0,
  });
  const coatHemMat = applyPs2GothicShader(mats.vampireCoatSway.clone(), sharedUniforms, {
    rimColor: 0x8ea8ff,
    rimStrength: 0.44,
    celBands: 3.0,
    windSway: true,
  });
  const crimsonMat = applyPs2GothicShader(mats.vampireCrimson.clone(), sharedUniforms, {
    rimColor: 0xef4444,
    rimStrength: 0.38,
    celBands: 3.0,
  });
  const scarfTailMat = applyPs2GothicShader(mats.vampireCrimsonSway.clone(), sharedUniforms, {
    rimColor: 0xef4444,
    rimStrength: 0.38,
    celBands: 3.0,
    windSway: true,
  });
  const vestMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x26131c,
      roughness: 0.62,
      metalness: 0.12,
    }),
    sharedUniforms,
    { rimColor: 0xc084fc, rimStrength: 0.25, celBands: 3.0 },
  );
  const skinMat = applyPs2GothicShader(mats.vampireSkin.clone(), sharedUniforms, {
    rimColor: 0xa5b4fc,
    rimStrength: 0.3,
    celBands: 3.0,
  });
  const hairMat = applyPs2GothicShader(mats.vampireHair.clone(), sharedUniforms, {
    rimColor: 0x6366f1,
    rimStrength: 0.35,
    celBands: 3.0,
  });
  const ironMat = applyPs2GothicShader(mats.iron.clone(), sharedUniforms, {
    rimColor: 0x8ea6e6,
    rimStrength: 0.35,
    celBands: 3.0,
  });
  const brassMat = applyPs2GothicShader(mats.brass.clone(), sharedUniforms, {
    rimColor: 0xffcf87,
    rimStrength: 0.3,
    celBands: 3.0,
  });

  const stealthMats: THREE.MeshStandardMaterial[] = [
    coatMat,
    coatHemMat,
    crimsonMat,
    scarfTailMat,
    vestMat,
    skinMat,
    hairMat,
    ironMat,
    brassMat,
  ];
  const stealthMatDefaults = stealthMats.map((mat) => ({
    mat,
    baseColor: mat.color.getHex(),
  }));
  for (const m of stealthMats) {
    m.transparent = true;
    m.opacity = 1.0;
  }

  // Contact shadow grounded at y=0.02
  const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
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

  // Articulated Slender Victorian Legs: Hip (y=0.94) -> Faceted Thigh -> Knee -> Shin + Sleek Boot
  const thighGeo = new THREE.CapsuleGeometry(0.072, 0.28, 2, 7);
  const shinGeo = new THREE.CapsuleGeometry(0.056, 0.25, 2, 7);
  const bootShaftGeo = new THREE.CylinderGeometry(0.066, 0.06, 0.16, 7);
  const bootFootGeo = new THREE.BoxGeometry(0.11, 0.085, 0.23);

  const makeLeg = (xOff: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOff, 0.94, 0);

    const thighMesh = new THREE.Mesh(thighGeo, coatMat);
    thighMesh.position.y = -0.22;
    thighMesh.castShadow = true;

    const shinGroup = new THREE.Group();
    shinGroup.position.set(0, -0.45, 0);

    const shinMesh = new THREE.Mesh(shinGeo, coatMat);
    shinMesh.position.y = -0.21;
    shinMesh.castShadow = true;

    const bootShaft = new THREE.Mesh(bootShaftGeo, ironMat);
    bootShaft.position.set(0, -0.34, 0);
    bootShaft.castShadow = true;

    const bootMesh = new THREE.Mesh(bootFootGeo, ironMat);
    bootMesh.position.set(0, -0.44, 0.048);
    bootMesh.castShadow = true;

    shinGroup.add(shinMesh, bootShaft, bootMesh);
    legGroup.add(thighMesh, shinGroup);
    return { legGroup, shinGroup };
  };

  const leftLegBuilt = makeLeg(-0.125);
  const rightLegBuilt = makeLeg(0.125);
  const leftLeg = leftLegBuilt.legGroup;
  const rightLeg = rightLegBuilt.legGroup;
  const leftShin = leftLegBuilt.shinGroup;
  const rightShin = rightLegBuilt.shinGroup;
  bodyPivot.add(leftLeg, rightLeg);

  // Articulated Spine Pivot at slender waist/hip (y=0.94)
  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.94, 0);
  bodyPivot.add(spinePivot);

  // Slender Victorian Upper Torso & Tailored Waistcoat Layer
  const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.162, 0.66, 8), coatMat);
  torsoMesh.position.y = 0.34;
  torsoMesh.castShadow = true;
  spinePivot.add(torsoMesh);

  // Inner fitted waistcoat visible through front coat opening + brass buttons
  const vestPanel = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.34, 2, 7), vestMat);
  vestPanel.scale.set(0.82, 1.0, 0.72);
  vestPanel.position.set(0, 0.34, 0.065);
  vestPanel.castShadow = true;
  spinePivot.add(vestPanel);

  for (let b = 0; b < 3; b++) {
    const btn = new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), brassMat);
    btn.position.set(0, 0.22 + b * 0.1, 0.172);
    spinePivot.add(btn);
  }

  // Tailored Frock Coat Lapels framing the crimson cravat/scarf
  const lapelGeo = new THREE.BoxGeometry(0.055, 0.34, 0.035);
  const lapelL = new THREE.Mesh(lapelGeo, coatMat);
  lapelL.position.set(-0.075, 0.43, 0.165);
  lapelL.rotation.set(-0.08, 0.28, -0.22);
  const lapelR = new THREE.Mesh(lapelGeo, coatMat);
  lapelR.position.set(0.075, 0.43, 0.165);
  lapelR.rotation.set(-0.08, -0.28, 0.22);
  spinePivot.add(lapelL, lapelR);

  // Tailored Waist Sash / Coat Belt
  const coatBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.172, 0.06, 8), ironMat);
  coatBelt.position.set(0, 0.08, 0);
  const beltClasp = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.03), brassMat);
  beltClasp.position.set(0, 0.08, 0.168);
  spinePivot.add(coatBelt, beltClasp);

  // High Fitted Victorian Standing Collar (gola alta, clean aristocratic wrap, no bat-wing tips)
  const collarOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.166, 0.165, 8, 1, true, Math.PI * 0.18, Math.PI * 1.64),
    coatHemMat,
  );
  collarOuter.position.set(0, 0.67, -0.01);
  collarOuter.castShadow = true;
  const collarInnerRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.141, 0.16, 0.135, 8, 1, true, Math.PI * 0.22, Math.PI * 1.56),
    crimsonMat,
  );
  collarInnerRim.position.set(0, 0.665, -0.008);
  spinePivot.add(collarOuter, collarInnerRim);

  // Crimson Silk Scarf (lenço carmesim): fitted neck wrap + folded knot + wind-swaying draped tail
  const scarfWrap = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.036, 5, 10), crimsonMat);
  scarfWrap.rotation.x = Math.PI / 2;
  scarfWrap.position.set(0, 0.635, 0.01);

  const scarfKnot = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), crimsonMat);
  scarfKnot.scale.set(1.05, 1.15, 0.72);
  scarfKnot.position.set(0, 0.585, 0.142);

  // Draped scarf tail pinned at top (uv.y = 1.0) so bottom tip sways smoothly via windSway
  const scarfTailGeo = new THREE.PlaneGeometry(0.095, 0.34, 1, 4);
  scarfTailGeo.translate(0, -0.17, 0);
  const scarfTail = new THREE.Mesh(scarfTailGeo, scarfTailMat);
  scarfTail.position.set(0.025, 0.57, 0.168);
  scarfTail.rotation.set(-0.12, 0.18, -0.14);
  scarfTail.castShadow = true;
  spinePivot.add(scarfWrap, scarfKnot, scarfTail);

  // Long Tailored Victorian Overcoat Lower Skirt (pinned at waist uv.y=1, lower hem reacts via windSway)
  // Assigned to `cape` on VampireRig so existing dash/jump/combat tilt animations drive the coattails smoothly
  const coatSkirtGeo = new THREE.CylinderGeometry(
    0.172,
    0.265,
    0.84,
    10,
    4,
    true,
    Math.PI * 0.14,
    Math.PI * 1.72,
  );
  coatSkirtGeo.translate(0, -0.42, 0);
  const cape = new THREE.Mesh(coatSkirtGeo, coatHemMat);
  cape.position.set(0, 0.08, 0);
  cape.rotation.x = 0.06;
  cape.castShadow = true;
  spinePivot.add(cape);

  // Slender Articulated Arms: Fitted Shoulder Seam (y=0.60) -> Capsule Upper Arm -> Forearm + Coat Cuff + Claws
  const shoulderCapGeo = new THREE.SphereGeometry(0.068, 6, 5);
  const upperArmGeo = new THREE.CapsuleGeometry(0.055, 0.23, 2, 6);
  const forearmGeo = new THREE.CapsuleGeometry(0.045, 0.21, 2, 6);
  const cuffGeo = new THREE.CylinderGeometry(0.056, 0.062, 0.095, 7);
  const palmGeo = new THREE.BoxGeometry(0.072, 0.085, 0.078);
  const clawGeo = new THREE.ConeGeometry(0.013, 0.115, 4);

  const makeArm = (xOff: number) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(xOff, 0.6, 0);

    const shoulderCap = new THREE.Mesh(shoulderCapGeo, coatMat);
    shoulderCap.position.y = -0.02;

    const upperMesh = new THREE.Mesh(upperArmGeo, coatMat);
    upperMesh.position.y = -0.16;
    upperMesh.castShadow = true;

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.32, 0);

    const forearmMesh = new THREE.Mesh(forearmGeo, coatMat);
    forearmMesh.position.y = -0.15;
    forearmMesh.castShadow = true;

    const cuffMesh = new THREE.Mesh(cuffGeo, crimsonMat);
    cuffMesh.position.y = -0.26;
    cuffMesh.castShadow = true;

    const palmMesh = new THREE.Mesh(palmGeo, skinMat);
    palmMesh.position.y = -0.34;

    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(clawGeo, mats.vampireEye);
      claw.position.set(c * 0.024, -0.43, 0.026);
      claw.rotation.x = Math.PI + 0.28;
      forearmGroup.add(claw);
    }

    forearmGroup.add(forearmMesh, cuffMesh, palmMesh);
    armGroup.add(shoulderCap, upperMesh, forearmGroup);
    return { armGroup, forearmGroup };
  };

  const leftArmBuilt = makeArm(-0.255);
  const rightArmBuilt = makeArm(0.255);
  const leftArm = leftArmBuilt.armGroup;
  const rightArm = rightArmBuilt.armGroup;
  const leftForearm = leftArmBuilt.forearmGroup;
  const rightForearm = rightArmBuilt.forearmGroup;
  spinePivot.add(leftArm, rightArm);

  // Refined Victorian Head + Swept Hair + Glowing Crimson Eyes (relative to spinePivot y=0.83)
  const head = new THREE.Group();
  head.position.set(0, 0.83, 0.02);
  const cranium = new THREE.Mesh(new THREE.OctahedronGeometry(0.165, 1), skinMat);
  cranium.scale.set(0.84, 1.08, 0.92);
  cranium.castShadow = true;
  head.add(cranium);

  const hairCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.16, 0.14, 7), hairMat);
  hairCrown.position.set(0, 0.09, -0.02);
  hairCrown.rotation.x = -0.2;
  const hairBack = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.28, 6), hairMat);
  hairBack.position.set(0, 0.07, -0.08);
  hairBack.rotation.x = -0.62;
  head.add(hairCrown, hairBack);

  const eyeGeo = new THREE.BoxGeometry(0.044, 0.018, 0.036);
  const eyeL = new THREE.Mesh(eyeGeo, mats.vampireEye);
  eyeL.position.set(-0.056, 0.018, 0.142);
  const eyeR = new THREE.Mesh(eyeGeo, mats.vampireEye);
  eyeR.position.set(0.056, 0.018, 0.142);
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

export interface VampireFirstPersonRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  stealthMatDefaults: Array<{ mat: THREE.MeshStandardMaterial; baseColor: number }>;
}

export function createVampireFirstPersonArms(
  mats: GothicMaterialLibrary,
  sharedUniforms: StylizedShaderUniforms,
): VampireFirstPersonRig {
  const root = new THREE.Group();

  const coatMat = applyPs2GothicShader(mats.vampireCoat.clone(), sharedUniforms, {
    rimColor: 0x8ea8ff,
    rimStrength: 0.42,
    celBands: 3.0,
  });
  const crimsonMat = applyPs2GothicShader(mats.vampireCrimson.clone(), sharedUniforms, {
    rimColor: 0xef4444,
    rimStrength: 0.38,
    celBands: 3.0,
  });
  const skinMat = applyPs2GothicShader(mats.vampireSkin.clone(), sharedUniforms, {
    rimColor: 0xa5b4fc,
    rimStrength: 0.3,
    celBands: 3.0,
  });
  const brassMat = applyPs2GothicShader(mats.brass.clone(), sharedUniforms, {
    rimColor: 0xffcf87,
    rimStrength: 0.34,
    celBands: 3.0,
  });
  const clawMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0x991b1b,
      emissiveIntensity: 0.42,
      roughness: 0.32,
      metalness: 0.25,
    }),
    sharedUniforms,
    { rimColor: 0xf87171, rimStrength: 0.45, celBands: 3.0 },
  );

  const fpMats = [coatMat, crimsonMat, skinMat, brassMat, clawMat];
  const stealthMatDefaults = fpMats.map((mat) => ({
    mat,
    baseColor: mat.color.getHex(),
  }));
  for (const m of fpMats) {
    m.transparent = true;
    m.opacity = 1.0;
  }

  // Oriented in camera-local space (-Z forward, +Y up, +X right)
  const sleeveGeo = new THREE.CylinderGeometry(0.044, 0.056, 0.26, 8);
  sleeveGeo.rotateX(Math.PI / 2);

  const cuffFlairGeo = new THREE.CylinderGeometry(0.05, 0.046, 0.075, 8);
  cuffFlairGeo.rotateX(Math.PI / 2);

  const innerRuffleGeo = new THREE.CylinderGeometry(0.041, 0.041, 0.025, 8);
  innerRuffleGeo.rotateX(Math.PI / 2);

  const wristGeo = new THREE.CylinderGeometry(0.026, 0.03, 0.055, 7);
  wristGeo.rotateX(Math.PI / 2);

  const palmGeo = new THREE.BoxGeometry(0.058, 0.024, 0.074);
  const fingerGeo = new THREE.CapsuleGeometry(0.0085, 0.032, 2, 5);
  fingerGeo.rotateX(Math.PI / 2);
  const clawTipGeo = new THREE.ConeGeometry(0.008, 0.052, 4);
  clawTipGeo.rotateX(-Math.PI / 2);
  const cufflinkGeo = new THREE.OctahedronGeometry(0.0095, 0);

  const buildHand = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    const forearmGroup = new THREE.Group();
    armGroup.add(forearmGroup);

    // Tailored dark Victorian frock sleeve
    const sleeve = new THREE.Mesh(sleeveGeo, coatMat);
    sleeve.position.set(0, 0, -0.04);
    forearmGroup.add(sleeve);

    // Folded crimson silk cuff + pale subtle inner linen trim + antique brass cufflink
    const cuff = new THREE.Mesh(cuffFlairGeo, crimsonMat);
    cuff.position.set(0, 0.002, -0.175);
    const innerTrim = new THREE.Mesh(innerRuffleGeo, skinMat);
    innerTrim.position.set(0, 0.002, -0.215);
    const cufflink = new THREE.Mesh(cufflinkGeo, brassMat);
    cufflink.position.set(side * 0.047, 0.004, -0.18);
    forearmGroup.add(cuff, innerTrim, cufflink);

    // Slender wrist & aristocrat palm tilted slightly inward like a predator
    const handGroup = new THREE.Group();
    handGroup.position.set(0, 0.004, -0.245);
    handGroup.rotation.z = side * -0.46;
    handGroup.rotation.x = 0.08;
    forearmGroup.add(handGroup);

    const wrist = new THREE.Mesh(wristGeo, skinMat);
    wrist.position.set(0, 0, 0.015);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0, 0, -0.036);
    handGroup.add(wrist, palm);

    // 4 articulated slender fingers + sharp crimson-tipped claws (3 prominent talon claws + pinky)
    for (let f = 0; f < 4; f++) {
      const xSpread = (f - 1.5) * 0.0145 * side;
      const fingerPivot = new THREE.Group();
      fingerPivot.position.set(xSpread, 0.002, -0.072);
      fingerPivot.rotation.x = -0.26 - f * 0.04;
      fingerPivot.rotation.y = side * (0.08 - f * 0.05);

      const seg = new THREE.Mesh(fingerGeo, skinMat);
      seg.position.set(0, -0.004, -0.02);
      fingerPivot.add(seg);

      const claw = new THREE.Mesh(clawTipGeo, clawMat);
      claw.position.set(0, -0.008, -0.058);
      claw.rotation.x = -0.24;
      if (f === 3) claw.scale.setScalar(0.8);
      fingerPivot.add(claw);

      handGroup.add(fingerPivot);
    }

    // Opposable thumb on inner edge with curved talon
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-side * 0.031, -0.006, -0.028);
    thumbPivot.rotation.set(-0.22, -side * 0.42, side * 0.25);
    const thumbSeg = new THREE.Mesh(fingerGeo, skinMat);
    thumbSeg.scale.set(1.05, 1.05, 0.78);
    thumbSeg.position.set(0, 0, -0.016);
    const thumbClaw = new THREE.Mesh(clawTipGeo, clawMat);
    thumbClaw.scale.setScalar(0.75);
    thumbClaw.position.set(0, -0.004, -0.046);
    thumbClaw.rotation.x = -0.2;
    thumbPivot.add(thumbSeg, thumbClaw);
    handGroup.add(thumbPivot);

    return { armGroup, forearmGroup };
  };

  const left = buildHand(-1);
  const right = buildHand(1);
  left.armGroup.position.set(-0.24, -0.23, -0.18);
  right.armGroup.position.set(0.24, -0.23, -0.18);

  root.add(left.armGroup, right.armGroup);

  return {
    root,
    leftArm: left.armGroup,
    rightArm: right.armGroup,
    leftForearm: left.forearmGroup,
    rightForearm: right.forearmGroup,
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
      roughness: archetype === 'noble' ? 0.56 : isCultist || isHunter ? 0.68 : 0.86,
      metalness: hasGuardGear ? 0.24 : 0.05,
    }),
    sharedUniforms,
    { rimColor: isCultist ? 0xa855f7 : isHunter ? 0xfb923c : isBodyguard ? 0xf87171 : 0x6b82b8, rimStrength: 0.28, celBands: 3.0, bloodPulseColor: pulseColor },
  );

  const coatSwayMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: coatColor,
      roughness: archetype === 'noble' ? 0.56 : isCultist || isHunter ? 0.68 : 0.86,
      metalness: hasGuardGear ? 0.24 : 0.05,
      side: THREE.DoubleSide,
    }),
    sharedUniforms,
    { rimColor: isCultist ? 0xa855f7 : isHunter ? 0xfb923c : isBodyguard ? 0xf87171 : 0x6b82b8, rimStrength: 0.28, celBands: 3.0, bloodPulseColor: pulseColor, windSway: true },
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

  const darkBootMat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x161820,
      roughness: 0.42,
      metalness: 0.35,
    }),
    sharedUniforms,
    { rimColor: 0x64748b, rimStrength: 0.2, celBands: 3.0, bloodPulseColor: pulseColor },
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

  // Faceted Low-Poly Capsule Legs pivoted at Hip (y=0.84) with Boot Shafts & +Z Boots
  const legGeo = new THREE.CapsuleGeometry(0.082, 0.44, 2, 7);
  legGeo.translate(0, -0.32, 0);
  const bootShaftGeo = new THREE.CylinderGeometry(0.088, 0.074, 0.24, 7);
  const bootFootGeo = new THREE.BoxGeometry(0.125, 0.095, 0.22);

  const makeNpcLeg = (xOff: number) => {
    const legMesh = new THREE.Mesh(legGeo, coatMat);
    legMesh.position.set(xOff, 0.84, 0);
    legMesh.castShadow = true;

    const bootShaft = new THREE.Mesh(bootShaftGeo, darkBootMat);
    bootShaft.position.set(0, -0.64, 0);
    const bootFoot = new THREE.Mesh(bootFootGeo, darkBootMat);
    bootFoot.position.set(0, -0.78, 0.042);
    legMesh.add(bootShaft, bootFoot);
    return legMesh;
  };

  const leftLeg = makeNpcLeg(-0.125);
  const rightLeg = makeNpcLeg(0.125);
  bodyGroup.add(leftLeg, rightLeg);

  // Faceted Capsule Torso + Layered Victorian Clothing
  const torsoRadius = isBlacksmith || isHalberdier || isBodyguard || isHunter ? 0.245 : 0.21;
  const torso = isCountess
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.42, 1.08, 8, 2), coatMat)
    : isCultist
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 0.96, 8, 2), coatMat)
    : new THREE.Mesh(new THREE.CapsuleGeometry(torsoRadius, 0.46, 2, 7), coatMat);
  torso.scale.set(1.0, 1.0, 0.86);
  torso.position.y = isCountess || isCultist ? 0.96 : 1.18;
  if (isBeggarRole) torso.rotation.x = 0.16;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Subtle Victorian Collar & Waist Belt Layer shared across silhouettes
  if (!isBeggarRole) {
    const baseBelt = new THREE.Mesh(new THREE.CylinderGeometry(torsoRadius * 0.96, torsoRadius * 0.98, 0.07, 7), darkBootMat);
    baseBelt.scale.set(1.0, 1.0, 0.88);
    baseBelt.position.y = 0.91;
    const baseCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.185, 0.12, 7, 1, true, Math.PI * 0.18, Math.PI * 1.64),
      coatMat,
    );
    baseCollar.position.set(0, 1.56, -0.01);
    bodyGroup.add(baseBelt, baseCollar);
  }

  // Secondary Silhouettes & Layered Victorian Vestments
  if (isHunter) {
    // Long Victorian hunter trenchcoat skirt with windSway + silver stake bandolier + high collar
    const coatSkirtGeo = new THREE.CylinderGeometry(0.22, 0.34, 0.68, 8, 3, true, Math.PI * 0.15, Math.PI * 1.7);
    coatSkirtGeo.translate(0, -0.34, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatSwayMat);
    coatSkirt.position.y = 0.96;
    const bandolier = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 7), trimMat);
    bandolier.position.set(0, 1.24, 0);
    bandolier.rotation.z = 0.56;
    const stakeGeo = new THREE.CylinderGeometry(0.016, 0.008, 0.22, 5);
    for (let s = -1; s <= 1; s++) {
      const stake = new THREE.Mesh(stakeGeo, trimMat);
      stake.position.set(s * 0.075, 1.24 + s * 0.045, 0.22);
      stake.rotation.z = -0.32;
      bodyGroup.add(stake);
    }
    const hunterCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.18, 7, 1, true, Math.PI * 0.28, Math.PI * 1.44), coatMat);
    hunterCollar.position.set(0, 1.58, -0.02);
    bodyGroup.add(coatSkirt, bandolier, hunterCollar);
  } else if (isBodyguard) {
    const breastplate = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.32, 2, 7), trimMat);
    breastplate.scale.set(1.02, 1.0, 0.88);
    breastplate.position.y = 1.26;
    breastplate.castShadow = true;
    const pGeo = new THREE.SphereGeometry(0.15, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const pL = new THREE.Mesh(pGeo, trimMat);
    pL.position.set(-0.31, 1.5, 0);
    const pR = new THREE.Mesh(pGeo, trimMat);
    pR.position.set(0.31, 1.5, 0);
    const capeletGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.58, 7, 2, true, Math.PI * 0.45, Math.PI * 1.1);
    capeletGeo.translate(0, -0.29, 0);
    const capelet = new THREE.Mesh(capeletGeo, coatSwayMat);
    capelet.position.set(0, 1.52, -0.04);
    bodyGroup.add(breastplate, pL, pR, capelet);
  } else if (isCultist) {
    const stole = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.64, 7, 1, true, -0.28, 0.56), trimMat);
    stole.position.y = 1.2;
    const talisman = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 0),
      new THREE.MeshBasicMaterial({ color: isApothecary ? 0x34d399 : 0xa855f7 }),
    );
    talisman.position.set(0, 1.38, 0.23);
    const shoulderShawl = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.35, 0.28, 7), coatMat);
    shoulderShawl.position.y = 1.47;
    bodyGroup.add(stole, talisman, shoulderShawl);
  } else if (isBeggarRole) {
    const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.32, 0.3, 6), trimMat);
    shawl.position.set(0, 1.42, 0.03);
    shawl.rotation.x = 0.16;
    const tatteredHemGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.36, 7, 2, true, Math.PI * 0.2, Math.PI * 1.6);
    tatteredHemGeo.translate(0, -0.18, 0);
    const tatteredHem = new THREE.Mesh(tatteredHemGeo, coatSwayMat);
    tatteredHem.position.y = 0.96;
    bodyGroup.add(shawl, tatteredHem);
  } else if (isHalberdier) {
    const breastplate = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.3, 2, 7), trimMat);
    breastplate.scale.set(1.02, 1.0, 0.88);
    breastplate.position.y = 1.26;
    breastplate.castShadow = true;
    const pGeo = new THREE.SphereGeometry(0.145, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const pL = new THREE.Mesh(pGeo, trimMat);
    pL.position.set(-0.3, 1.49, 0);
    const pR = new THREE.Mesh(pGeo, trimMat);
    pR.position.set(0.3, 1.49, 0);
    bodyGroup.add(breastplate, pL, pR);
  } else if (isInquisitor) {
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.39, 0.32, 7), trimMat);
    mantle.position.y = 1.44;
    const coatSkirtGeo = new THREE.CylinderGeometry(0.21, 0.3, 0.56, 7, 2, true, Math.PI * 0.16, Math.PI * 1.68);
    coatSkirtGeo.translate(0, -0.28, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatSwayMat);
    coatSkirt.position.y = 0.94;
    const chestCross = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), trimMat);
    chestCross.position.set(0, 1.32, 0.22);
    bodyGroup.add(mantle, coatSkirt, chestCross);
  } else if (isSentinel) {
    const tabard = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.25, 0.68, 7, 1, true, -0.35, 0.7), trimMat);
    tabard.position.y = 1.14;
    bodyGroup.add(tabard);
  } else if (archetype === 'guard') {
    // Victorian Constable Frock Coat Skirt + Brass Buckle + Waist Belt
    const coatSkirtGeo = new THREE.CylinderGeometry(0.21, 0.27, 0.42, 7, 2, true, Math.PI * 0.14, Math.PI * 1.72);
    coatSkirtGeo.translate(0, -0.21, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatMat);
    coatSkirt.position.y = 0.94;
    const chestPlastron = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.36, 7, 1, true, -0.42, 0.84), trimMat);
    chestPlastron.position.set(0, 1.28, 0.01);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.035), trimMat);
    buckle.position.set(0, 0.91, 0.21);
    bodyGroup.add(coatSkirt, chestPlastron, buckle);
  } else if (isPatriarch) {
    const capeletGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.44, 8, 2, true, Math.PI * 0.35, Math.PI * 1.3);
    capeletGeo.translate(0, -0.22, 0);
    const capelet = new THREE.Mesh(capeletGeo, coatSwayMat);
    capelet.position.set(0, 1.54, -0.02);
    const waistcoat = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.32, 2, 7), trimMat);
    waistcoat.scale.set(0.86, 1.0, 0.8);
    waistcoat.position.set(0, 1.2, 0.04);
    const coatSkirtGeo = new THREE.CylinderGeometry(0.21, 0.3, 0.56, 8, 2, true, Math.PI * 0.15, Math.PI * 1.7);
    coatSkirtGeo.translate(0, -0.28, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatSwayMat);
    coatSkirt.position.y = 0.94;
    bodyGroup.add(capelet, waistcoat, coatSkirt);
  } else if (isCountess) {
    const goldNeck = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 5, 10), trimMat);
    goldNeck.rotation.x = Math.PI / 2;
    goldNeck.position.y = 1.55;
    const bustle = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.16, 2, 6), trimMat);
    bustle.scale.set(1.2, 1.0, 0.75);
    bustle.position.set(0, 0.96, -0.18);
    const laceCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 0.16, 8), trimMat);
    laceCollar.position.y = 1.44;
    bodyGroup.add(goldNeck, bustle, laceCollar);
  } else if (isMagistrate) {
    const robeGeo = new THREE.CylinderGeometry(0.22, 0.36, 0.86, 8, 3, true, Math.PI * 0.12, Math.PI * 1.76);
    robeGeo.translate(0, -0.43, 0);
    const robe = new THREE.Mesh(robeGeo, coatSwayMat);
    robe.position.y = 1.06;
    const jabot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 5), trimMat);
    jabot.rotation.x = Math.PI;
    jabot.position.set(0, 1.42, 0.2);
    bodyGroup.add(robe, jabot);
  } else if (archetype === 'noble') {
    const waistcoat = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.32, 2, 7), trimMat);
    waistcoat.scale.set(0.84, 1.0, 0.78);
    waistcoat.position.set(0, 1.2, 0.04);
    const coatSkirtGeo = new THREE.CylinderGeometry(0.2, 0.29, 0.52, 8, 2, true, Math.PI * 0.15, Math.PI * 1.7);
    coatSkirtGeo.translate(0, -0.26, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatSwayMat);
    coatSkirt.position.y = 0.94;
    const capelet = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.24, 7), coatMat);
    capelet.position.y = 1.48;
    bodyGroup.add(waistcoat, coatSkirt, capelet);
  } else if (isApothecary) {
    const coatSkirtGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.44, 7, 2, true, Math.PI * 0.14, Math.PI * 1.72);
    coatSkirtGeo.translate(0, -0.22, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatMat);
    coatSkirt.position.y = 0.94;
    const satchel = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.14, 2, 6), trimMat);
    satchel.position.set(-0.24, 0.98, 0.06);
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
    vial.position.set(-0.28, 1.12, 0.11);
    bodyGroup.add(coatSkirt, satchel, vial);
  } else if (isBlacksmith) {
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.28, 0.68, 7, 1, true, -0.55, 1.1), trimMat);
    apron.position.set(0, 1.04, 0.02);
    bodyGroup.add(apron);
  } else {
    // Citizen layered Victorian waistcoat + short coat tail
    const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.3, 2, 7), trimMat);
    vest.scale.set(0.84, 1.0, 0.78);
    vest.position.set(0, 1.18, 0.03);
    const coatSkirtGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.36, 7, 2, true, Math.PI * 0.15, Math.PI * 1.7);
    coatSkirtGeo.translate(0, -0.18, 0);
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatMat);
    coatSkirt.position.y = 0.94;
    bodyGroup.add(vest, coatSkirt);
  }

  // Head
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 1), skinMat);
  head.position.set(0, 1.72, isBeggarRole ? 0.08 : 0);
  head.castShadow = true;
  bodyGroup.add(head);

  // Hats / Helmets / Hoods with clear front-facing (+Z) directional silhouettes
  if (isHunter) {
    // Wide-brimmed gothic witch-hunter hat with silver front buckle & forward peak
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.045, 8), coatMat);
    brim.position.set(0, 1.85, 0.03);
    brim.rotation.x = 0.08;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.34, 8), coatMat);
    crown.position.y = 2.02;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), trimMat);
    buckle.position.set(0, 1.9, 0.22);
    const frontMask = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.08), coatMat);
    frontMask.position.set(0, 1.66, 0.15);
    bodyGroup.add(brim, crown, buckle, frontMask);
  } else if (isBodyguard) {
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 8), trimMat);
    helm.position.y = 1.8;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.22), coatMat);
    visor.position.set(0, 1.74, 0.15);
    visor.rotation.x = 0.18;
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 5), coatMat);
    plume.position.set(0, 2.02, -0.05);
    plume.rotation.x = -0.22;
    bodyGroup.add(helm, visor, plume);
  } else if (isCultist) {
    // Open ritual hood (capuz aberto) revealing shadowed front face & brow sigil
    const hoodBack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.27, 0.36, 8, 1, true, Math.PI * 0.25, Math.PI * 1.5),
      coatMat,
    );
    hoodBack.position.set(0, 1.77, -0.03);
    const hoodPeak = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.4, 6), coatMat);
    hoodPeak.position.set(0, 1.98, -0.07);
    hoodPeak.rotation.x = -0.38;
    const hoodArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.036, 5, 8, Math.PI * 1.15),
      trimMat,
    );
    hoodArch.position.set(0, 1.74, 0.13);
    hoodArch.rotation.x = 0.18;
    const eyeMat = new THREE.MeshBasicMaterial({ color: name === 'Boticário' ? 0x34d399 : 0xc084fc });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.04), eyeMat);
    eyeL.position.set(-0.055, 1.73, 0.16);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, 0.04), eyeMat);
    eyeR.position.set(0.055, 1.73, 0.16);
    bodyGroup.add(hoodBack, hoodPeak, hoodArch, eyeL, eyeR);
  } else if (isHalberdier) {
    // Iron Sallet Visor Helmet with protruding front nasal/visor peak
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), trimMat);
    helm.position.y = 1.78;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.24), trimMat);
    visor.position.set(0, 1.76, 0.15);
    visor.rotation.x = 0.16;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.04), coatMat);
    slit.position.set(0, 1.72, 0.24);
    bodyGroup.add(helm, visor, slit);
  } else if (isSentinel) {
    // Tall Bronze-crested Tower Helm with front visor peak
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.26, 7), trimMat);
    helm.position.y = 1.82;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.34), coatMat);
    crest.position.set(0, 1.98, 0.02);
    const frontPeak = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), trimMat);
    frontPeak.position.set(0, 1.75, 0.16);
    frontPeak.rotation.x = 0.2;
    bodyGroup.add(helm, crest, frontPeak);
  } else if (isInquisitor) {
    // Tall Pointed Inquisitor Hat with silver front clasp & forward brim dip
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.41, 0.04, 8), coatMat);
    brim.position.set(0, 1.85, 0.02);
    brim.rotation.x = 0.08;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.42, 7), coatMat);
    crown.position.y = 2.04;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 7), trimMat);
    band.position.y = 1.88;
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), trimMat);
    clasp.position.set(0, 1.9, 0.21);
    bodyGroup.add(brim, crown, band, clasp);
  } else if (archetype === 'guard') {
    // Victorian Constable Police Helmet with protruding front visor (capacete policial com pala)
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.21, 0.28, 8), coatMat);
    dome.position.y = 1.91;
    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.26), trimMat);
    comb.position.set(0, 2.06, -0.01);
    const frontPala = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.036, 0.19), coatMat);
    frontPala.position.set(0, 1.78, 0.16);
    frontPala.rotation.x = 0.24;
    const frontBadge = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.045), trimMat);
    frontBadge.position.set(0, 1.88, 0.2);
    const rearGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.08), coatMat);
    rearGuard.position.set(0, 1.76, -0.17);
    bodyGroup.add(dome, comb, frontPala, frontBadge, rearGuard);
  } else if (isCountess) {
    // Feathered Noble Fascinator + Front Diadem & Monocle/Lace Crest
    const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 10, Math.PI), trimMat);
    tiara.position.set(0, 1.84, 0.08);
    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), trimMat);
    jewel.position.set(0, 1.88, 0.18);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 5), trimMat);
    plume.position.set(0.12, 1.96, -0.05);
    plume.rotation.set(-0.25, 0, -0.55);
    bodyGroup.add(tiara, jewel, plume);
  } else if (isMagistrate) {
    // Tall Judicial Top Hat (Cartola) with front crimson cockade
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.032, 8), coatMat);
    brim.position.set(0, 1.84, 0.02);
    brim.rotation.x = 0.06;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.34, 8), coatMat);
    hat.position.y = 2.01;
    const cockade = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), trimMat);
    cockade.position.set(0, 1.91, 0.19);
    bodyGroup.add(brim, hat, cockade);
  } else if (archetype === 'noble') {
    // Victorian Top Hat (Cartola) with forward brim dip, gold front buckle & monocle
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.032, 8), coatMat);
    brim.position.set(0, 1.84, 0.02);
    brim.rotation.x = 0.08;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.17, isPatriarch ? 0.38 : 0.33, 8), coatMat);
    hat.position.y = isPatriarch ? 2.03 : 2.0;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.182, 0.182, 0.055, 8), trimMat);
    band.position.y = 1.88;
    const frontClasp = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.04), trimMat);
    frontClasp.position.set(0, 1.88, 0.19);
    const monocle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.01, 5, 8), trimMat);
    monocle.position.set(0.06, 1.74, 0.17);
    bodyGroup.add(brim, hat, band, frontClasp, monocle);
    if (isPatriarch) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), trimMat);
      feather.position.set(-0.18, 2.06, -0.04);
      feather.rotation.set(-0.2, 0, 0.45);
      bodyGroup.add(feather);
    }
  } else if (isBeggarRole) {
    // Tattered open hood with forward cowl peak
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 6), coatMat);
    hood.position.set(0, 1.8, 0.02);
    hood.rotation.x = -0.22;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.14), trimMat);
    peak.position.set(0, 1.8, 0.16);
    peak.rotation.x = 0.24;
    bodyGroup.add(hood, peak);
  } else {
    // Citizen Victorian peaked cap (quepe com pala frontal)
    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.14, 7), coatMat);
    capCrown.position.set(0, 1.84, -0.01);
    const capBill = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.032, 0.16), trimMat);
    capBill.position.set(0, 1.79, 0.15);
    capBill.rotation.x = 0.2;
    bodyGroup.add(capCrown, capBill);
  }

  // Left arm (faceted capsule + Victorian cuff + hand + pilgrim staff / beggar crutch)
  const npcArmGeo = new THREE.CapsuleGeometry(0.062, 0.42, 2, 6);
  const npcCuffGeo = new THREE.CylinderGeometry(0.072, 0.078, 0.11, 7);
  const npcHandGeo = new THREE.OctahedronGeometry(0.048, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.275, 1.48, 0);
  const leftArmMesh = new THREE.Mesh(npcArmGeo, coatMat);
  leftArmMesh.position.y = -0.26;
  const leftCuff = new THREE.Mesh(npcCuffGeo, trimMat);
  leftCuff.position.y = -0.46;
  const leftHand = new THREE.Mesh(npcHandGeo, skinMat);
  leftHand.position.y = -0.54;
  leftArm.add(leftArmMesh, leftCuff, leftHand);
  if (isPilgrim || isBeggarRole) {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 1.5, 5), trimMat);
    staff.position.set(-0.04, -0.6, 0.14);
    staff.rotation.x = 0.14;
    leftArm.add(staff);
  }
  bodyGroup.add(leftArm);

  // Right arm (faceted capsule + Victorian cuff + hand + prop)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.275, 1.48, 0);
  const armMesh = new THREE.Mesh(npcArmGeo, coatMat);
  armMesh.position.y = -0.26;
  const rightCuff = new THREE.Mesh(npcCuffGeo, trimMat);
  rightCuff.position.y = -0.46;
  const rightHand = new THREE.Mesh(npcHandGeo, skinMat);
  rightHand.position.y = -0.54;
  rightArm.add(armMesh, rightCuff, rightHand);

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

  // Subtle ground vision cone for ALL NPCs (visible when sneaking, nearby, or Crimson Sense is active)
  const coneHalfFov = hasGuardGear ? GUARD_HALF_FOV : Math.acos(0.42);
  const coneDefaultRange = hasGuardGear ? GUARD_VISION_RANGE : isBeggarRole ? 6.5 : 9.5;
  const vertCount = VISION_CONE_RAYS + 2;
  const conePositions = new Float32Array(vertCount * 3);
  const coneColors = new Float32Array(vertCount * 3);
  const coneIndices: number[] = [];

  conePositions[0] = 0;
  conePositions[1] = 0.045;
  conePositions[2] = 0.16;
  coneColors[0] = 1.0;
  coneColors[1] = 1.0;
  coneColors[2] = 1.0;

  for (let i = 0; i <= VISION_CONE_RAYS; i++) {
    const t = i / VISION_CONE_RAYS;
    const a = -coneHalfFov + t * (coneHalfFov * 2);
    const idx = (i + 1) * 3;
    conePositions[idx] = Math.sin(a) * coneDefaultRange;
    conePositions[idx + 1] = 0.045;
    conePositions[idx + 2] = Math.cos(a) * coneDefaultRange;

    const edgeFade = 1.0 - Math.pow(Math.abs(t - 0.5) * 2, 2.0) * 0.65;
    coneColors[idx] = 0.34 * edgeFade;
    coneColors[idx + 1] = 0.34 * edgeFade;
    coneColors[idx + 2] = 0.34 * edgeFade;
  }

  for (let i = 1; i <= VISION_CONE_RAYS; i++) {
    coneIndices.push(0, i + 1, i);
  }

  visionConeGeo = new THREE.BufferGeometry();
  visionConeGeo.setAttribute('position', new THREE.BufferAttribute(conePositions, 3));
  visionConeGeo.setAttribute('color', new THREE.BufferAttribute(coneColors, 3));
  visionConeGeo.setIndex(coneIndices);

  visionConeMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  visionCone = new THREE.Mesh(visionConeGeo, visionConeMat);
  visionCone.frustumCulled = false;
  visionCone.visible = false;
  root.add(visionCone);

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
    opacity: 0.19,
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
    opacity: 0.68,
  });
  const poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), poolMat);
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.y = 0.03;

  const pointLight = new THREE.PointLight(0xff9436, 36, 19.0, 1.85);
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

export function createAlleyClutterCluster(
  mats: GothicMaterialLibrary,
  variant: 0 | 1 | 2 = 0,
): THREE.Group {
  const group = new THREE.Group();

  if (variant === 0) {
    // Stacked timber cargo crates + iron-banded barrel + leaning drainage pipe
    const crateA = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.95), mats.wood);
    crateA.position.set(-0.38, 0.425, 0);
    crateA.castShadow = true;
    crateA.receiveShadow = true;

    const crateB = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.68, 0.72), mats.wood);
    crateB.position.set(-0.34, 1.19, 0.04);
    crateB.rotation.y = 0.24;
    crateB.castShadow = true;
    crateB.receiveShadow = true;

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.92, 8), mats.treeBark);
    barrel.position.set(0.48, 0.46, 0.08);
    barrel.castShadow = true;
    barrel.receiveShadow = true;

    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.028, 5, 10), mats.iron);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(0.48, 0.68, 0.08);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.55, 6), mats.iron);
    pipe.position.set(0.06, 0.72, -0.34);
    pipe.rotation.z = 0.22;
    pipe.castShadow = true;

    group.add(crateA, crateB, barrel, hoop, pipe);
  } else if (variant === 1) {
    // Low pallet + bundled sacks + weathered crate + leaning timber plank
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 1.05), mats.treeBark);
    pallet.position.set(0, 0.07, 0);
    pallet.receiveShadow = true;

    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.78, 0.82), mats.wood);
    crate.position.set(-0.36, 0.53, 0);
    crate.castShadow = true;
    crate.receiveShadow = true;

    const sackA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), mats.darkStone);
    sackA.scale.set(1.1, 0.85, 0.95);
    sackA.position.set(0.42, 0.36, 0.08);
    sackA.castShadow = true;

    const sackB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mats.roof);
    sackB.scale.set(1.0, 0.78, 1.1);
    sackB.position.set(0.32, 0.68, -0.1);
    sackB.castShadow = true;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.06), mats.wood);
    plank.position.set(-0.84, 0.64, 0.14);
    plank.rotation.z = -0.26;
    plank.castShadow = true;

    group.add(pallet, crate, sackA, sackB, plank);
  } else {
    // Industrial cast-iron utility pipes + stone block + small supply chest
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.18, 0.92), mats.darkStone);
    slab.position.set(0, 0.09, 0);
    slab.receiveShadow = true;

    [-0.52, -0.24].forEach((px, idx) => {
      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.2 - idx * 0.45, 6), mats.iron);
      conduit.position.set(px, (2.2 - idx * 0.45) * 0.5 + 0.18, -0.22);
      conduit.castShadow = true;
      group.add(conduit);
    });

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.56, 0.62), mats.wood);
    chest.position.set(0.32, 0.46, 0.05);
    chest.castShadow = true;
    chest.receiveShadow = true;

    const band = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.65), mats.iron);
    band.position.set(0.32, 0.68, 0.05);

    group.add(slab, chest, band);
  }

  return group;
}

export function createVictorianStreetFurniture(
  mats: GothicMaterialLibrary,
  variant: 'bench' | 'kiosk' | 'planter',
): THREE.Group {
  const group = new THREE.Group();

  if (variant === 'bench') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.54), mats.wood);
    seat.position.set(0, 0.46, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.44, 0.08), mats.wood);
    back.position.set(0, 0.78, -0.22);
    back.rotation.x = -0.14;
    back.castShadow = true;

    [-0.78, 0.78].forEach((lx) => {
      const legF = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.48), mats.iron);
      legF.position.set(lx, 0.23, 0);
      legF.castShadow = true;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.48), mats.iron);
      arm.position.set(lx, 0.58, -0.02);
      group.add(legF, arm);
    });
    group.add(seat, back);
  } else if (variant === 'kiosk') {
    // Victorian newsstand / apothecary kiosk with glowing warm vitrine & peaked roof
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.24, 1.35), mats.darkStone);
    plinth.position.y = 0.12;
    plinth.receiveShadow = true;

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.05, 1.12), mats.wood);
    body.position.y = 1.26;
    body.castShadow = true;
    body.receiveShadow = true;

    const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 1.05), mats.vitrine);
    windowPane.position.set(0, 1.48, 0.57);

    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 0.34), mats.darkStone);
    counter.position.set(0, 0.92, 0.66);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.1, 0.72), mats.clothCrimson);
    awning.position.set(0, 2.15, 0.74);
    awning.rotation.x = 0.34;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.52, 0.95, 4), mats.roof);
    roof.position.y = 2.75;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.15, 1, 0.78);
    roof.castShadow = true;

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mats.brass);
    finial.position.y = 3.28;

    group.add(plinth, body, windowPane, counter, awning, roof, finial);
  } else {
    // Stone Victorian street planter with trimmed evergreen hedge
    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.52, 0.85), mats.darkStone);
    trough.position.y = 0.26;
    trough.castShadow = true;
    trough.receiveShadow = true;

    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.1, 0.96), mats.stone);
    rim.position.y = 0.54;

    const hedge = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.56, 0.62), mats.hedge);
    hedge.position.y = 0.82;
    hedge.castShadow = true;

    [-0.78, 0.78].forEach((bx) => {
      const knob = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), mats.brass);
      knob.position.set(bx, 0.62, 0.42);
      group.add(knob);
    });

    group.add(trough, rim, hedge);
  }

  return group;
}

export function createCemeteryMonument(
  mats: GothicMaterialLibrary,
  variant: 'obelisk' | 'urn' | 'shrine' = 'obelisk',
): THREE.Group {
  const group = new THREE.Group();

  if (variant === 'obelisk') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.36, 1.55), mats.darkStone);
    base.position.y = 0.18;
    base.castShadow = true;
    base.receiveShadow = true;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.72, 1.12), mats.stone);
    plinth.position.y = 0.72;
    plinth.castShadow = true;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.44, 2.35, 4), mats.stone);
    shaft.position.y = 2.25;
    shaft.rotation.y = Math.PI / 4;
    shaft.castShadow = true;

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.46, 4), mats.brass);
    cap.position.y = 3.65;
    cap.rotation.y = Math.PI / 4;

    group.add(base, plinth, shaft, cap);
  } else if (variant === 'urn') {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 1.3), mats.darkStone);
    plinth.position.y = 0.16;
    plinth.receiveShadow = true;

    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.92, 0.76), mats.stone);
    ped.position.y = 0.78;
    ped.castShadow = true;

    const urnPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.18, 0.0),
      new THREE.Vector2(0.3, 0.34),
      new THREE.Vector2(0.24, 0.62),
      new THREE.Vector2(0.12, 0.78),
      new THREE.Vector2(0.22, 0.92),
    ];
    const urn = new THREE.Mesh(new THREE.LatheGeometry(urnPoints, 10), mats.darkStone);
    urn.position.y = 1.24;
    urn.castShadow = true;

    [
      [-0.56, -0.56],
      [0.56, -0.56],
      [-0.56, 0.56],
      [0.56, 0.56],
    ].forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.68, 6), mats.iron);
      post.position.set(px, 0.5, pz);
      group.add(post);
    });

    group.add(plinth, ped, urn);
  } else {
    // Gothic stone memorial tabernacle shrine
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.28, 1.35), mats.darkStone);
    step.position.y = 0.14;
    step.receiveShadow = true;

    [-0.52, 0.52].forEach((cx) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.65, 6), mats.stone);
      col.position.set(cx, 1.1, 0);
      col.castShadow = true;
      group.add(col);
    });

    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.24, 1.05), mats.darkStone);
    slab.position.y = 2.02;
    slab.castShadow = true;

    const gable = new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.95, 4), mats.roof);
    gable.position.y = 2.6;
    gable.rotation.y = Math.PI / 4;
    gable.castShadow = true;

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.58, 0.1), mats.iron);
    crossV.position.set(0, 1.12, 0);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.09), mats.iron);
    crossH.position.set(0, 1.24, 0);

    group.add(step, slab, gable, crossV, crossH);
  }

  return group;
}

export function createThresholdBollards(
  mats: GothicMaterialLibrary,
  spanWidth: number,
  accent: 'amber' | 'crimson' | 'iron' = 'amber',
): THREE.Group {
  const group = new THREE.Group();

  // Flush walkable stone threshold curb marking district transition
  const strip = new THREE.Mesh(new THREE.BoxGeometry(spanWidth, 0.04, 0.68), mats.darkStone);
  strip.position.y = 0.02;
  strip.receiveShadow = true;
  group.add(strip);

  const half = spanWidth / 2;
  [-half, half].forEach((bx) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 6), mats.darkStone);
    base.position.set(bx, 0.15, 0);
    base.castShadow = true;

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.88, 6), mats.iron);
    post.position.set(bx, 0.74, 0);
    post.castShadow = true;

    const capMat =
      accent === 'crimson' ? mats.vampireCrimson : accent === 'amber' ? mats.vitrine : mats.brass;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), capMat);
    cap.position.set(bx, 1.26, 0);

    group.add(base, post, cap);
  });

  return group;
}

