import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const PS2_INTERNAL_SCALE = 0.6;

export const ShadowImmersionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uShadowDepth: { value: 0 },
    uCrimsonSense: { value: 0 },
    uKillCam: { value: 0 },
    uResolution: { value: new THREE.Vector2(512, 384) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uShadowDepth;
    uniform float uCrimsonSense;
    uniform float uKillCam;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float bayer4x4(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
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
    }

    float filmHash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      // Virtual PS2 reduced internal framebuffer pixel grid (~480x270 scaled)
      vec2 ps2Grid = max(vec2(320.0, 224.0), floor(uResolution));
      vec2 snappedUv = (floor(vUv * ps2Grid) + 0.5) / ps2Grid;

      vec2 centered = snappedUv - 0.5;
      float dist = length(centered);
      vec2 dir = dist > 0.0001 ? centered / dist : vec2(0.0);

      // Keep center focal vision crisp while gently warping peripheral vision in deep shadows
      float edgeMask = smoothstep(0.18, 0.72, dist);
      float wave = sin(snappedUv.y * 13.0 + uTime * 2.0) * cos(snappedUv.x * 10.5 - uTime * 1.5);
      float warp = (0.011 + 0.0038 * wave) * uShadowDepth * edgeMask;

      vec2 baseUv = clamp(
        snappedUv - dir * warp + vec2(wave * 0.0022, -wave * 0.0018) * uShadowDepth * edgeMask,
        0.001,
        0.999
      );

      // Subtle peripheral chromatic refraction in deep shadow & kill-cam
      float chroma = (0.0032 * uShadowDepth + 0.0042 * uKillCam) * edgeMask;
      vec2 uvR = clamp(baseUv + dir * chroma, 0.001, 0.999);
      vec2 uvB = clamp(baseUv - dir * chroma, 0.001, 0.999);

      float r = texture2D(tDiffuse, uvR).r;
      vec4 centerSample = texture2D(tDiffuse, baseUv);
      float b = texture2D(tDiffuse, uvB).b;
      vec3 color = vec3(r, centerSample.g, b);

      // Subtle nocturnal contrast & cool indigo moon-shadow grading when immersed in deep shadow
      float contrastBoost = 1.0 + 0.24 * uShadowDepth;
      color = max(vec3(0.0), (color - 0.14) * contrastBoost + 0.14);
      vec3 shadowTint = mix(vec3(1.0), vec3(0.90, 0.95, 1.14), uShadowDepth * 0.65);
      color *= shadowTint;

      // Subtle crimson peripheral resonance when Sentido Carmesim is active
      color.r += uCrimsonSense * edgeMask * 0.045;

      // High-priority stealth kill slow-mo old film grain, scratches & gothic silver-crimson grading
      if (uKillCam > 0.005) {
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        float redDominance = clamp((color.r - max(color.g, color.b)) * 2.6, 0.0, 1.0);
        vec3 agedSepia = vec3(luma * 1.04, luma * 0.89, luma * 0.74);
        vec3 crimsonPop = vec3(color.r * 1.24, color.g * 0.62, color.b * 0.62);
        vec3 graded = mix(agedSepia, crimsonPop, redDominance * 0.82);
        graded = max(vec3(0.0), (graded - 0.12) * 1.26 + 0.12);

        // Coarse animated silver-halide film grain + subtle vertical projector scratches + gate flicker
        float frameTick = floor(uTime * 24.0);
        float grain = (filmHash(floor(gl_FragCoord.xy * 0.65) + frameTick * 17.3) - 0.5) * 0.16;
        float scratchLine = step(0.994, filmHash(vec2(floor(vUv.x * 260.0), frameTick * 0.7)));
        float scratchMask = smoothstep(0.15, 0.85, filmHash(vec2(vUv.y * 4.0, frameTick)));
        float flicker = 0.95 + 0.05 * sin(uTime * 37.0);

        graded = (graded + grain - scratchLine * scratchMask * 0.12) * flicker;
        float killVignette = 1.0 - smoothstep(0.22, 0.74, dist) * 0.58;
        graded *= killVignette;

        color = mix(color, clamp(graded, 0.0, 1.0), uKillCam);
      }

      // Creeping deep-shadow peripheral vignette
      float vignette = 1.0 - smoothstep(0.30, 0.78, dist) * (0.48 * uShadowDepth);
      color *= vignette;

      // PS2 Emotion Engine / GS 16-bit soft shadow-weighted ordered dither & CRT interlace scanline
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      float shadowMask = smoothstep(0.50, 0.03, lum);
      vec2 ps2Pixel = floor(vUv * ps2Grid);
      float ditherAmt = mix(0.35, 1.25, shadowMask);
      float dither = ((bayer4x4(ps2Pixel) - 0.5) / 22.0) * ditherAmt;
      color = clamp(floor((color + dither) * 31.0 + 0.5) / 31.0, 0.0, 1.0);
      // Softened CRT scanline texture restricted subtly to screen-edge vignette (clean center viewport)
      float edgeGridMask = smoothstep(0.34, 0.82, dist);
      float scan = mix(1.0, 0.972 + 0.028 * sin(ps2Pixel.y * 3.14159), edgeGridMask);
      color *= scan;

      gl_FragColor = vec4(color, centerSample.a);
    }
  `,
};

export interface ShadowComposerRig {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  shadowPass: ShaderPass;
}

export function createShadowComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): ShadowComposerRig {
  const composer = new EffectComposer(renderer);
  const size = new THREE.Vector2();
  renderer.getSize(size);
  composer.setPixelRatio(PS2_INTERNAL_SCALE);
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Subtle selective bloom affecting only bright HDR emissive sources (lamps, windows, blood/magic)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(256, size.x), Math.max(256, size.y)),
    0.42, // subtle strength
    0.36, // tight radius
    0.92, // high threshold so non-emissive stone/cobbles stay crisp
  );
  composer.addPass(bloomPass);

  const shadowPass = new ShaderPass(ShadowImmersionShader);
  shadowPass.uniforms.uResolution.value.set(
    Math.max(360, Math.round(size.x * 0.5)),
    Math.max(240, Math.round(size.y * 0.5)),
  );
  composer.addPass(shadowPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return { composer, bloomPass, shadowPass };
}
