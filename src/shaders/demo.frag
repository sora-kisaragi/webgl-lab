uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 n = normalize(vNormal);
  float fresnel = pow(1.0 - abs(n.z), 2.0);
  vec3 base = 0.5 + 0.5 * cos(uTime + vPosition.xyx * 2.0 + vec3(0.0, 2.0, 4.0));
  vec3 color = mix(base * 0.6, vec3(0.9, 0.95, 1.0), fresnel);
  gl_FragColor = vec4(color, 1.0);
}
