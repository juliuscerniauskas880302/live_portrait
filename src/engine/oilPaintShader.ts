import * as THREE from 'three'

/**
 * Full-screen oil / canvas grade applied after the 3D scene render.
 * Keeps the furniture-painting fantasy without a heavy post stack.
 */
export const OilPaintShader = {
  name: 'OilPaintShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uStrength: { value: 0.85 },
    uNight: { value: 0 },
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
    uniform vec2 uRes;
    uniform float uStrength;
    uniform float uNight;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      // Soft brush warp
      vec2 px = 1.0 / max(uRes, vec2(1.0));
      float n = hash(floor(uv * uRes * 0.35) + floor(uTime * 0.4));
      vec2 warp = (vec2(hash(uv * 12.0), hash(uv * 19.0 + 2.3)) - 0.5) * px * 2.2 * uStrength;
      vec4 col = texture2D(tDiffuse, uv + warp);

      // Mild posterize (paint planes)
      float levels = mix(28.0, 18.0, uStrength);
      col.rgb = floor(col.rgb * levels + 0.5) / levels;

      // Warm oil grade
      col.rgb = mix(col.rgb, col.rgb * vec3(1.08, 0.98, 0.88), 0.35 * uStrength);
      // Canvas grain
      float g = hash(uv * uRes + uTime * 0.7) * 0.07 * uStrength;
      col.rgb += g - 0.03 * uStrength;

      // Vignette
      float d = distance(uv, vec2(0.5));
      col.rgb *= smoothstep(0.95, 0.35, d + 0.08 * uNight);

      // Night cool shadows
      if (uNight > 0.5) {
        col.rgb *= vec3(0.92, 0.94, 1.05);
        col.rgb = mix(col.rgb, col.rgb * vec3(1.15, 0.75, 0.45), 0.08);
      }

      gl_FragColor = vec4(col.rgb, 1.0);
    }
  `,
}
