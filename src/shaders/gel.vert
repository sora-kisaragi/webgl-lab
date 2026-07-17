#include <common>
#include <skinning_pars_vertex>

uniform float uTime;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>

  // ゲルのぷるぷる: 周波数の異なる揺れを法線方向に重ねる
  float wobble = sin(uTime * 6.0 + transformed.y * 9.0) * 0.012 +
    sin(uTime * 9.3 + transformed.x * 11.0 + transformed.z * 7.0) * 0.008;
  transformed += normalize(objectNormal) * wobble;

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vNormal = normalize(normalMatrix * objectNormal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
