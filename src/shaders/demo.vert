uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalMatrix * normal;
  vec3 pos = position + normal * sin(uTime * 2.0 + position.y * 4.0) * 0.08;
  vPosition = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
