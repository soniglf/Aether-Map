export const FEEDBACK_SMOKE_FRAG = `
precision highp float;
in vec2 vTextureCoord;
out vec4 outColor;

uniform float uTime;
uniform float uSeed;
uniform float uSpeed;
uniform float uDensity;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
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
    
    // Time evolution
    float t = uTime * uSpeed;
    
    // Domain warping
    float n1 = snoise(uv * 3.0 + t * 0.1);
    float n2 = snoise(uv * 6.0 - t * 0.2 + n1);
    
    // Color bands
    float val = 0.5 + 0.5 * snoise(uv * 4.0 + n2 * 2.0 + vec2(0.0, -t));
    
    val = smoothstep(1.0 - uDensity, 1.0, val);
    
    // Electric Palette
    vec3 colorA = vec3(0.1, 0.0, 0.2);
    vec3 colorB = vec3(0.0, 0.5, 1.0);
    vec3 colorC = vec3(1.0, 0.0, 0.5);
    
    vec3 finalColor = mix(colorA, colorB, val);
    finalColor = mix(finalColor, colorC, n2 * val);

    outColor = vec4(finalColor * val, 1.0);
}
`;

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
