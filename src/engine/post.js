// Post-processing: scene cross-fades → bloom → a final "lens" pass
// (chromatic aberration, glitch slices, tone mapping, grain, vignette, flash, fade).

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export const POST_DEFAULTS = {
  bloom: 0.6, bloomRadius: 0.45, bloomThreshold: 0.7,
  exposure: 1.0, ca: 0.0012, glitch: 0, glitchSeed: 0, flash: 0, fade: 0, invert: 0,
  grain: 0.05, vignette: 0.45, scan: 0.06, saturation: 1.0, tint: [1, 1, 1], barrel: 0, shake: 0,
};

const MIX_SHADER = {
  uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uType: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 16 / 9 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tA, tB; uniform float uMix, uType, uTime, uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    void main(){
      vec2 uv = vUv;
      if (uType < 0.5) { // dissolve through a noise field, with a hot edge
        float n = vn(uv * vec2(uAspect, 1.) * 9.) * .6 + vn(uv * vec2(uAspect, 1.) * 31.) * .4;
        float k = uMix * 1.2 - .1; // run slightly past both ends so the frames are clean at 0 and 1
        float m = smoothstep(k - .015, k + .015, 1. - n);
        float edge = smoothstep(.02, 0., abs((1. - n) - k)) * step(.01, uMix) * step(uMix, .99);
        vec4 a = texture2D(tA, uv), b = texture2D(tB, uv);
        gl_FragColor = mix(a, b, 1. - m) + vec4(vec3(1.2, .35, .5) * edge * .9, 0.);
      } else { // glitch: horizontal bands flip between the two frames
        float band = floor(uv.y * 24.) + floor(uTime * 30.) * 7.;
        float r = h(vec2(band, 3.));
        float sel = step(r, uMix * 1.15 - .075);
        float off = (h(vec2(band, 9.)) - .5) * .12 * sin(uMix * 3.14159);
        vec2 u2 = vec2(fract(uv.x + off), uv.y);
        vec4 a = texture2D(tA, u2), b = texture2D(tB, u2);
        vec4 c = mix(a, b, sel);
        c.r = mix(texture2D(tA, u2 + vec2(.01, 0)).r, texture2D(tB, u2 + vec2(.01, 0)).r, sel);
        gl_FragColor = c;
      }
    }`,
};

// Renders one scene, or two scenes mixed together, into the composer's read buffer.
class SceneMixPass extends Pass {
  constructor(w, h) {
    super();
    this.needsSwap = false;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.rtA = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtB = new THREE.WebGLRenderTarget(w, h, opts);
    this.mat = new THREE.ShaderMaterial({ ...MIX_SHADER, uniforms: THREE.UniformsUtils.clone(MIX_SHADER.uniforms), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.mat);
    this.a = null; this.b = null; this.mix = 0; this.type = 0; this.time = 0;
  }
  setSize(w, h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); this.mat.uniforms.uAspect.value = w / h; }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setClearColor(0x000000, 1);
    if (!this.b || this.mix <= 0.0001) {
      renderer.setRenderTarget(readBuffer); renderer.clear(); renderer.render(this.a.scene, this.a.camera);
      return;
    }
    renderer.setRenderTarget(this.rtA); renderer.clear(); renderer.render(this.a.scene, this.a.camera);
    renderer.setRenderTarget(this.rtB); renderer.clear(); renderer.render(this.b.scene, this.b.camera);
    const u = this.mat.uniforms;
    u.tA.value = this.rtA.texture; u.tB.value = this.rtB.texture; u.uMix.value = this.mix; u.uType.value = this.type; u.uTime.value = this.time;
    renderer.setRenderTarget(readBuffer); this.quad.render(renderer);
  }
}

const FINAL_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 16 / 9 },
    uExposure: { value: 1 }, uCA: { value: 0 }, uGlitch: { value: 0 }, uSeed: { value: 0 },
    uFlash: { value: 0 }, uFade: { value: 0 }, uInvert: { value: 0 }, uGrain: { value: 0 },
    uVignette: { value: 0 }, uScan: { value: 0 }, uSat: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uBarrel: { value: 0 }, uShake: { value: new THREE.Vector2() }, uHeight: { value: 1080 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    uniform float uTime, uAspect, uExposure, uCA, uGlitch, uSeed, uFlash, uFade, uInvert, uGrain, uVignette, uScan, uSat, uBarrel, uHeight;
    uniform vec3 uTint; uniform vec2 uShake;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){
      vec2 uv = vUv + uShake;
      vec2 c = uv - .5;
      uv = .5 + c * (1. + uBarrel * dot(c, c));
      // glitch: displaced slices + blocks
      if (uGlitch > 0.001) {
        float row = floor(uv.y * mix(14., 60., h(vec2(uSeed, 1.))));
        float r = h(vec2(row, uSeed));
        if (r < uGlitch * .6) uv.x += (h(vec2(row, uSeed + 3.)) - .5) * .25 * uGlitch;
        vec2 blk = floor(uv * vec2(18., 10.));
        if (h(blk + uSeed) < uGlitch * .12) uv = fract(uv + (vec2(h(blk + 7.), h(blk + 9.)) - .5) * .2);
      }
      float ca = uCA + uGlitch * .012;
      vec2 dir = (uv - .5) * ca * 2.;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;
      col *= uTint;
      col = aces(col * uExposure);
      float l = dot(col, vec3(.2126, .7152, .0722));
      col = mix(vec3(l), col, uSat);
      // scanlines + vignette + grain
      col *= 1. - uScan * (.5 + .5 * sin(vUv.y * uHeight * 3.14159));
      vec2 vc = (vUv - .5) * vec2(uAspect, 1.);
      col *= 1. - uVignette * smoothstep(.35, 1.1, length(vc));
      col = toSRGB(clamp(col, 0., 1.));
      col += (h(vUv * 931.7 + fract(uTime * 13.37)) - .5) * uGrain;
      col = mix(col, 1. - col, uInvert);
      col = mix(col, vec3(1.), clamp(uFlash, 0., 1.));
      col *= 1. - clamp(uFade, 0., 1.);
      gl_FragColor = vec4(col, 1.);
    }`,
};

class FinalPass extends Pass {
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({ ...FINAL_SHADER, uniforms: THREE.UniformsUtils.clone(FINAL_SHADER.uniforms), depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.mat);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.mat.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

export class Post {
  constructor(renderer, w, h) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
    this.mix = new SceneMixPass(w, h);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.5, 0.6);
    this.final = new FinalPass();
    this.composer.addPass(this.mix);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.final);
    this.setSize(w, h);
  }
  setSize(w, h) {
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);
    this.mix.setSize(w, h);
    this.final.mat.uniforms.uAspect.value = w / h;
    this.final.mat.uniforms.uHeight.value = h;
  }
  render(t, a, b, mix, mixType, p) {
    this.mix.a = a; this.mix.b = b; this.mix.mix = mix; this.mix.type = mixType; this.mix.time = t;
    this.bloom.strength = p.bloom; this.bloom.radius = p.bloomRadius; this.bloom.threshold = p.bloomThreshold;
    const u = this.final.mat.uniforms;
    u.uTime.value = t; u.uExposure.value = p.exposure; u.uCA.value = p.ca; u.uGlitch.value = p.glitch; u.uSeed.value = p.glitchSeed;
    u.uFlash.value = p.flash; u.uFade.value = p.fade; u.uInvert.value = p.invert; u.uGrain.value = p.grain; u.uVignette.value = p.vignette;
    u.uScan.value = p.scan; u.uSat.value = p.saturation; u.uTint.value.set(...p.tint); u.uBarrel.value = p.barrel;
    const s = p.shake;
    u.uShake.value.set(s ? Math.sin(t * 91.3) * s * 0.01 : 0, s ? Math.cos(t * 77.7) * s * 0.01 : 0);
    this.composer.render();
  }
}
