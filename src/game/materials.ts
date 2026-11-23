import * as THREE from 'three';
import type { GothicTextures } from './textures';

export interface StylizedShaderUniforms {
  uTime: { value: number };
  uCrimsonSense: { value: number };
  uWindDir: { value: THREE.Vector2 };
  uWindStrength: { value: number };
}

export function applyPs2GothicShader(
  material: THREE.MeshStandardMaterial,
  sharedUniforms: StylizedShaderUniforms,
  options: {
    rimColor?: number;
    rimStrength?: number;
    celBands?: number;
    bloodPulseColor?: number;
    windSway?: boolean;
    vertexJitter?: boolean;
  } = {},
): THREE.MeshStandardMaterial {
  const rimCol = new THREE.Color(options.rimColor ?? 0x6b8cff);
  const rimStrength = options.rimStrength ?? 0.32;
  const celBands = options.celBands ?? 4.0;
  const bloodPulse = options.bloodPulseColor ? new THREE.Color(options.bloodPulseColor) : null;
  const windSway = Boolean(options.windSway);
  const vertexJitter = options.vertexJitter !== false;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uCrimsonSense = sharedUniforms.uCrimsonSense;
    shader.uniforms.uWindDir = sharedUniforms.uWindDir;
    shader.uniforms.uWindStrength = sharedUniforms.uWindStrength;
    shader.uniforms.uRimColor = { value: rimCol };
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.uniforms.uCelBands = { value: celBands };
    shader.uniforms.uHasBloodPulse = { value: bloodPulse ? 1.0 : 0.0 };
    shader.uniforms.uBloodPulseColor = { value: bloodPulse ?? new THREE.Color(0x000000) };

    let vs =
      `uniform float uTime;\nuniform vec2 uWindDir;\nuniform float uWindStrength;\nvarying vec3 vCustomWorldNormal;\nvarying vec3 vCustomViewDir;\n` +
      shader.vertexShader;

    if (windSway) {
      vs = vs.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Dynamic cloth sway pinned at top edge (uv.y = 1.0)
        float clothSlack = clamp(1.0 - uv.y, 0.0, 1.0);
        vec4 worldPivot = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float phase = worldPivot.x * 0.45 + worldPivot.z * 0.35;
        float gustWave = sin(uTime * 3.1 + phase + transformed.y * 2.2) * 0.55
                       + cos(uTime * 5.4 + phase * 1.7 + transformed.x * 3.8) * 0.45;
        float billow = (0.38 + gustWave * 0.62) * uWindStrength * clothSlack * clothSlack;
        vec2 localWind = (vec4(uWindDir.x, 0.0, uWindDir.y, 0.0) * modelMatrix).xz;
        transformed.x += localWind.x * billow * 0.72 + gustWave * 0.08 * clothSlack * uWindStrength;
        transformed.z += localWind.y * billow * 0.72 + sin(uTime * 4.2 + phase + uv.x * 5.0) * 0.14 * clothSlack * uWindStrength;`,
      );
    }

    if (vertexJitter) {
      vs = vs.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        // PS2 Emotion Engine / GTE fixed-point clip-space vertex snap
        if (gl_Position.w > 0.01) {
          vec2 ps2Grid = vec2(360.0, 270.0);
          vec2 ndc = gl_Position.xy / gl_Position.w;
          ndc = floor(ndc * ps2Grid + 0.5) / ps2Grid;
          gl_Position.xy = ndc * gl_Position.w;
        }`,
      );
    }

    shader.vertexShader = vs.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
        vCustomWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        vec4 customWorldPos = modelMatrix * vec4(transformed, 1.0);
        vCustomViewDir = normalize(cameraPosition - customWorldPos.xyz);`,
    );

    shader.fragmentShader =
      `uniform float uTime;
      uniform float uCrimsonSense;
      uniform vec3 uRimColor;
      uniform float uRimStrength;
      uniform float uCelBands;
      uniform float uHasBloodPulse;
      uniform vec3 uBloodPulseColor;
      varying vec3 vCustomWorldNormal;
      varying vec3 vCustomViewDir;

      float ps2Bayer4x4(vec2 pos) {
        int x = int(mod(pos.x, 4.0));
        int y = int(mod(pos.y, 4.0));
        int idx = x + y * 4;
        if (idx == 0) return 0.0 / 16.0;
        if (idx == 1) return 8.0 / 16.0;
        if (idx == 2) return 2.0 / 16.0;
        if (idx == 3) return 10.0 / 16.0;
        if (idx == 4) return 12.0 / 16.0;
        if (idx == 5) return 4.0 / 16.0;
        if (idx == 6) return 14.0 / 16.0;
        if (idx == 7) return 6.0 / 16.0;
        if (idx == 8) return 3.0 / 16.0;
        if (idx == 9) return 11.0 / 16.0;
        if (idx == 10) return 1.0 / 16.0;
        if (idx == 11) return 9.0 / 16.0;
        if (idx == 12) return 15.0 / 16.0;
        if (idx == 13) return 7.0 / 16.0;
        if (idx == 14) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }\n` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        // PS2-era stylized tonal quantization & moonlight rim
        float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        float stepped = floor(luma * uCelBands + 0.35) / uCelBands;
        float bandBlend = mix(luma, stepped, 0.56);
        if (luma > 0.002) {
          gl_FragColor.rgb *= (bandBlend / luma);
        }

        float fresnel = pow(1.0 - max(0.0, dot(normalize(vCustomViewDir), normalize(vCustomWorldNormal))), 3.0);
        gl_FragColor.rgb += uRimColor * fresnel * uRimStrength;

        // Soft 16-bit PS2 ordered dithering weighted gently across shadow regions
        float shadowDitherWeight = mix(0.42, 1.15, smoothstep(0.45, 0.04, luma));
        float dither = ((ps2Bayer4x4(gl_FragCoord.xy) - 0.5) / 26.0) * shadowDitherWeight;
        gl_FragColor.rgb = clamp(floor((gl_FragColor.rgb + dither) * 31.0 + 0.5) / 31.0, 0.0, 1.0);

        // Crimson Sense spectral predator filter
        if (uCrimsonSense > 0.01) {
          if (uHasBloodPulse > 0.5) {
            float pulse = 0.72 + 0.28 * sin(uTime * 5.0);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uBloodPulseColor * (0.6 + fresnel * 1.4) * pulse, uCrimsonSense * 0.85);
          } else {
            float gray = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 coldWorld = vec3(gray * 0.45, gray * 0.52, gray * 0.85);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, coldWorld, uCrimsonSense * 0.72);
          }
        }
        #include <dithering_fragment>`,
      );
  };
  material.customProgramCacheKey = () =>
    `ps2-gothic-${rimCol.getHexString()}-${rimStrength}-${celBands}-${bloodPulse ? bloodPulse.getHexString() : 'none'}-${windSway ? 'wind' : 'still'}-${vertexJitter ? 'jitter' : 'nojitter'}`;
  return material;
}

export interface GothicMaterialLibrary {
  cobble: THREE.MeshStandardMaterial;
  puddle: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  darkStone: THREE.MeshStandardMaterial;
  brick: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  hedge: THREE.MeshStandardMaterial;
  vitrine: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  stainedGlass: THREE.MeshStandardMaterial;
  roseWindow: THREE.MeshStandardMaterial;
  vampireCoat: THREE.MeshStandardMaterial;
  vampireCoatSway: THREE.MeshStandardMaterial;
  vampireCrimson: THREE.MeshStandardMaterial;
  vampireCrimsonSway: THREE.MeshStandardMaterial;
  vampireSkin: THREE.MeshStandardMaterial;
  vampireHair: THREE.MeshStandardMaterial;
  vampireEye: THREE.MeshBasicMaterial;
  treeBark: THREE.MeshStandardMaterial;
  bloodAltarGlow: THREE.MeshStandardMaterial;
  clothCrimson: THREE.MeshStandardMaterial;
  clothIndigo: THREE.MeshStandardMaterial;
  memoryGlow: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createGothicMaterialLibrary(
  textures: GothicTextures,
  sharedUniforms: StylizedShaderUniforms,
): GothicMaterialLibrary {
  const cobble = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      map: textures.cobbleMap,
      bumpMap: textures.cobbleBump,
      bumpScale: 0.13,
      roughnessMap: textures.cobbleRoughness,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.012,
    }),
    sharedUniforms,
    { rimColor: 0x3b4d7a, rimStrength: 0.01, celBands: 6.0, vertexJitter: false },
  );

  // Isolated street/alley puddles with subtle specular glints from streetlamps & moonlight
  const puddle = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    roughness: 0.09,
    metalness: 0.14,
    envMapIntensity: 0.42,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const stone = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      map: textures.stoneMap,
      color: 0x677087,
      roughness: 0.93,
      metalness: 0.03,
      envMapIntensity: 0.08,
    }),
    sharedUniforms,
    { rimColor: 0x5872ad, rimStrength: 0.16, celBands: 4.0 },
  );

  const darkStone = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      map: textures.stoneMap,
      color: 0x353b4d,
      roughness: 0.95,
      metalness: 0.04,
      envMapIntensity: 0.06,
    }),
    sharedUniforms,
    { rimColor: 0x4b5f8f, rimStrength: 0.14, celBands: 4.0 },
  );

  const brick = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      map: textures.stoneMap,
      color: 0x4d2a2f,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.05,
    }),
    sharedUniforms,
    { rimColor: 0x6272ab, rimStrength: 0.12, celBands: 4.0 },
  );

  const wood = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x3b261d,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.08,
    }),
    sharedUniforms,
    { rimColor: 0x627ab5, rimStrength: 0.15, celBands: 3.0 },
  );

  const hedge = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x162921,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.04,
    }),
    sharedUniforms,
    { rimColor: 0x3f6b58, rimStrength: 0.18, celBands: 3.0 },
  );

  const vitrine = new THREE.MeshStandardMaterial({
    color: 0x472f18,
    emissive: 0xff9f38,
    emissiveIntensity: 2.15,
    roughness: 0.25,
    metalness: 0.15,
    toneMapped: false,
  });

  const roof = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      map: textures.roofMap,
      color: 0x3b4459,
      roughness: 0.87,
      metalness: 0.1,
      envMapIntensity: 0.08,
    }),
    sharedUniforms,
    { rimColor: 0x6783c7, rimStrength: 0.18, celBands: 4.0 },
  );

  const iron = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x262b36,
      roughness: 0.42,
      metalness: 0.85,
      envMapIntensity: 0.45,
    }),
    sharedUniforms,
    { rimColor: 0x8ea6e6, rimStrength: 0.35, celBands: 3.0 },
  );

  const brass = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0xb88b4a,
      roughness: 0.32,
      metalness: 0.88,
      envMapIntensity: 0.5,
    }),
    sharedUniforms,
    { rimColor: 0xffcf87, rimStrength: 0.3, celBands: 3.0 },
  );

  const stainedGlass = new THREE.MeshStandardMaterial({
    map: textures.stainedGlassMap,
    emissiveMap: textures.stainedGlassMap,
    emissive: 0xff6b35,
    emissiveIntensity: 2.25,
    roughness: 0.25,
    metalness: 0.1,
    toneMapped: false,
  });

  const roseWindow = new THREE.MeshStandardMaterial({
    map: textures.roseWindowMap,
    emissiveMap: textures.roseWindowMap,
    emissive: 0xff5733,
    emissiveIntensity: 2.45,
    roughness: 0.2,
    metalness: 0.1,
    toneMapped: false,
  });

  const vampireCoat = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x161925,
      roughness: 0.74,
      metalness: 0.14,
    }),
    sharedUniforms,
    { rimColor: 0x8ea8ff, rimStrength: 0.44, celBands: 3.0 },
  );

  const vampireCoatSway = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x161925,
      roughness: 0.74,
      metalness: 0.14,
      side: THREE.DoubleSide,
    }),
    sharedUniforms,
    { rimColor: 0x8ea8ff, rimStrength: 0.44, celBands: 3.0, windSway: true },
  );

  const vampireCrimson = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x881320,
      roughness: 0.42,
      metalness: 0.18,
    }),
    sharedUniforms,
    { rimColor: 0xef4444, rimStrength: 0.38, celBands: 3.0 },
  );

  const vampireCrimsonSway = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x881320,
      roughness: 0.42,
      metalness: 0.18,
      side: THREE.DoubleSide,
    }),
    sharedUniforms,
    { rimColor: 0xef4444, rimStrength: 0.38, celBands: 3.0, windSway: true },
  );

  const vampireSkin = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0xc9cedc,
      roughness: 0.65,
      metalness: 0.02,
    }),
    sharedUniforms,
    { rimColor: 0xa5b4fc, rimStrength: 0.3, celBands: 3.0 },
  );

  const vampireHair = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x0b0d14,
      roughness: 0.55,
      metalness: 0.2,
    }),
    sharedUniforms,
    { rimColor: 0x6366f1, rimStrength: 0.35, celBands: 3.0 },
  );

  const vampireEye = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.0, 0.22, 0.3),
    toneMapped: false,
  });

  const treeBark = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x221d26,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.1,
    }),
    sharedUniforms,
    { rimColor: 0x5c6f9e, rimStrength: 0.2, celBands: 3.0 },
  );

  const bloodAltarGlow = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
    roughness: 0.3,
    metalness: 0.4,
    toneMapped: false,
  });

  const clothCrimson = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x6b141a,
      roughness: 0.86,
      metalness: 0.06,
      side: THREE.DoubleSide,
      envMapIntensity: 0.18,
    }),
    sharedUniforms,
    { rimColor: 0xf87171, rimStrength: 0.32, celBands: 3.0, windSway: true },
  );

  const clothIndigo = applyPs2GothicShader(
    new THREE.MeshStandardMaterial({
      color: 0x1e2542,
      roughness: 0.88,
      metalness: 0.08,
      side: THREE.DoubleSide,
      envMapIntensity: 0.18,
    }),
    sharedUniforms,
    { rimColor: 0x93c5fd, rimStrength: 0.36, celBands: 3.0, windSway: true },
  );

  const memoryGlow = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    emissive: 0x818cf8,
    emissiveIntensity: 2.1,
    roughness: 0.22,
    metalness: 0.45,
    toneMapped: false,
  });

  const all = [
    cobble,
    puddle,
    stone,
    darkStone,
    brick,
    wood,
    hedge,
    vitrine,
    roof,
    iron,
    brass,
    stainedGlass,
    roseWindow,
    vampireCoat,
    vampireCoatSway,
    vampireCrimson,
    vampireCrimsonSway,
    vampireSkin,
    vampireHair,
    vampireEye,
    treeBark,
    bloodAltarGlow,
    clothCrimson,
    clothIndigo,
    memoryGlow,
  ];

  return {
    cobble,
    puddle,
    stone,
    darkStone,
    brick,
    wood,
    hedge,
    vitrine,
    roof,
    iron,
    brass,
    stainedGlass,
    roseWindow,
    vampireCoat,
    vampireCoatSway,
    vampireCrimson,
    vampireCrimsonSway,
    vampireSkin,
    vampireHair,
    vampireEye,
    treeBark,
    bloodAltarGlow,
    clothCrimson,
    clothIndigo,
    memoryGlow,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}
