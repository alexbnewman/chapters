import { useEffect, useRef } from 'react'
import { blend, energy, reducedMotion } from './theme'

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform float u_time, u_scroll, u_mix, u_energy;
uniform vec2 u_res, u_pointer;
uniform vec3 u_a[4], u_b[4];
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.65 + vnoise(p * 2.1 + 7.3) * 0.35; }
vec3 stop(int i) { return mix(u_a[i], u_b[i], u_mix); }

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / s;
  uv.y += u_scroll * 0.0004;
  float t = u_time * (1.0 + 1.5 * u_energy);

  // Five metaballs on Lissajous paths, summed into one soft field.
  float field = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float per = 23.0 + fi * 4.5;
    float r = 0.18 + fi * 0.035;
    vec2 c = vec2(sin(t * 6.2832 / per + fi * 1.7) * 0.45 * u_res.x / s,
                  cos(t * 6.2832 / (per * 0.73) + fi * 2.3) * 0.4);
    vec2 d = uv - c;
    field += r * r / (dot(d, d) + r * r * 0.5);
  }
  field = 1.0 - exp(-field * 0.6);

  // Domain-warped noise gives the blobs ragged ink edges instead of clean circles.
  float amp = 0.35 + 0.3 * u_energy;
  vec2 p = uv * 3.0 + (u_pointer - 0.5) * 0.03 * 3.0;
  vec2 w = vec2(fbm(p + t * 0.04), fbm(p + 5.2 - t * 0.03));
  float n = fbm(p + amp * (w * 2.0 - 1.0));
  field = clamp(field * 0.95 + (n - 0.5) * 0.6, 0.0, 1.0);

  float x = field * 3.0;
  int i = int(min(floor(x), 2.0));
  vec3 col = mix(stop(i), stop(i + 1), x - float(i));
  col *= 0.5 + 0.25 * u_energy;

  vec2 q = gl_FragCoord.xy / u_res - 0.5;
  col *= 1.0 - smoothstep(0.38, 0.74, length(q));
  col = pow(max(col, 0.0), vec3(1.0 / 2.2)) + vec3(0.04, 0.04, 0.047);
  col += (hash(gl_FragCoord.xy + fract(u_time) * 100.0) - 0.5) * 0.03;
  outColor = vec4(col, 1.0);
}`

export function Background() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('webgl2', { preserveDrawingBuffer: true })
    // Without this, a browser with no WebGL2 throws below and React blanks the whole page.
    if (!ctx) return
    const gl = ctx
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
    let raf = 0
    let u: Record<string, WebGLUniformLocation | null> = {}

    function setup() {
      const prog = gl.createProgram()!
      for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
        const sh = gl.createShader(type)!
        gl.shaderSource(sh, src)
        gl.compileShader(sh)
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader')
        gl.attachShader(prog, sh)
      }
      gl.bindAttribLocation(prog, 0, 'p')
      gl.linkProgram(prog)
      gl.useProgram(prog)
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      u = {}
      for (const name of ['u_time', 'u_scroll', 'u_mix', 'u_energy', 'u_res', 'u_pointer', 'u_a', 'u_b'])
        u[name] = gl.getUniformLocation(prog, name)
      resize()
    }

    function resize() {
      // Half-res render (0.35 on phones) keeps the per-pixel noise cheap; CSS scales it back up.
      const scale = Math.min(devicePixelRatio, 1.5) * (innerWidth < 600 ? 0.35 : 0.5)
      canvas.width = Math.round(innerWidth * scale)
      canvas.height = Math.round(innerHeight * scale)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u.u_res, canvas.width, canvas.height)
    }

    let uploaded: typeof blend.a | undefined
    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const still = reducedMotion.matches
      if (!still) {
        pointer.x += (pointer.tx - pointer.x) * 0.05
        pointer.y += (pointer.ty - pointer.y) * 0.05
      }
      // Palettes only hit the GPU when the store swaps them; the crossfade itself is u_mix.
      if (uploaded !== blend.a) {
        gl.uniform3fv(u.u_a, blend.a.flat())
        gl.uniform3fv(u.u_b, blend.b.flat())
        uploaded = blend.a
      }
      gl.uniform1f(u.u_time, still ? 7 : now / 1000)
      gl.uniform1f(u.u_scroll, still ? 0 : scrollY)
      gl.uniform1f(u.u_mix, blend.mix)
      gl.uniform1f(u.u_energy, still ? 0 : energy.value)
      gl.uniform2f(u.u_pointer, pointer.x, pointer.y)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX / innerWidth
      pointer.ty = 1 - e.clientY / innerHeight
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      cancelAnimationFrame(raf)
    }
    const onRestored = () => {
      uploaded = undefined
      setup()
      raf = requestAnimationFrame(frame)
    }

    setup()
    raf = requestAnimationFrame(frame)
    addEventListener('resize', resize)
    addEventListener('pointermove', onPointer)
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [])

  return <canvas ref={ref} className="bg" aria-hidden />
}
