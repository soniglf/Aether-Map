export const BASIC_VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vTextureCoord;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    vTextureCoord = aUV;
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`;

export const FEEDBACK_SMOKE_FRAG = `
precision highp float;
in vec2 vTextureCoord;
out vec4 outColor;

uniform float uTime;
uniform float uSpeed;
uniform float uDensity;

// Simplex 2D noise helper
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = vTextureCoord;
    float t = uTime * uSpeed;
    float n1 = snoise(uv * 3.0 + t * 0.1);
    float n2 = snoise(uv * 6.0 - t * 0.2 + n1);
    float val = 0.5 + 0.5 * snoise(uv * 4.0 + n2 * 2.0 + vec2(0.0, -t));
    val = smoothstep(1.0 - uDensity, 1.0, val);
    
    vec3 colorA = vec3(0.1, 0.0, 0.2);
    vec3 colorB = vec3(0.0, 0.5, 1.0);
    vec3 colorC = vec3(1.0, 0.0, 0.5);
    
    vec3 finalColor = mix(colorA, colorB, val);
    finalColor = mix(finalColor, colorC, n2 * val);
    outColor = vec4(finalColor * val, 1.0);
}
`;

export const VORONOI_FLOW_FRAG = `
precision highp float;
in vec2 vTextureCoord;
out vec4 outColor;
uniform float uTime;
uniform float uSpeed;
uniform float uDensity;

vec2 hash2( vec2 p ) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

void main() {
    vec2 uv = vTextureCoord;
    uv.x *= 1.77; // Aspect correction
    float t = uTime * uSpeed * 0.5;
    
    vec2 n = floor(uv * 5.0);
    vec2 f = fract(uv * 5.0);
    
    float m_dist = 1.0;
    
    for (int y= -1; y <= 1; y++) {
        for (int x= -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x),float(y));
            vec2 point = hash2(n + neighbor);
            point = 0.5 + 0.5*sin(t + 6.2831*point);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            m_dist = min(m_dist, dist);
        }
    }
    
    vec3 col = vec3(m_dist);
    col = pow(col, vec3(uDensity * 2.0)); // Contrast/Density
    col = 1.0 - col; // Invert
    
    vec3 tint = vec3(0.2, 0.8, 0.9) * col;
    outColor = vec4(tint, 1.0);
}
`;

export const SCANLINE_GRID_FRAG = `
precision highp float;
in vec2 vTextureCoord;
out vec4 outColor;
uniform float uTime;
uniform float uSpeed;
uniform float uDensity;

void main() {
    vec2 uv = vTextureCoord;
    float t = uTime * uSpeed;
    
    // Grid
    float gridScale = 20.0 + (uDensity * 30.0);
    vec2 g = fract(uv * gridScale + vec2(0.0, t));
    float lines = smoothstep(0.95, 1.0, max(g.x, g.y));
    
    // Scanline
    float scan = smoothstep(0.4, 0.6, sin(uv.y * 100.0 - t * 5.0));
    
    // Distort
    float d = length(uv - 0.5);
    vec3 col = vec3(lines) * vec3(1.0, 0.2, 0.5);
    col += vec3(scan) * 0.1;
    col *= (1.0 - d * 0.5); // Vignette
    
    outColor = vec4(col, 1.0);
}
`;
