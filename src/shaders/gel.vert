#include <common>
#include <skinning_pars_vertex>

uniform float uTime;
uniform float uMelt;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>

  // ゲルのぷるぷる: 周波数の異なる揺れを法線方向に重ねる（融解中は大きく揺れる）
  float wobbleAmp = 1.0 + uMelt * 2.5;
  float wobble = sin(uTime * 6.0 + transformed.y * 9.0) * 0.012 +
    sin(uTime * 9.3 + transformed.x * 11.0 + transformed.z * 7.0) * 0.008;
  transformed += normalize(objectNormal) * wobble * wobbleAmp;

  // どろどろ融解: 高い所ほど垂れ、床際は横に広がって水たまり化する
  if (uMelt > 0.001) {
    float h = clamp(transformed.y / 1.4, 0.0, 1.0);
    float drip = max(0.0, sin(transformed.x * 12.0 + uTime * 1.6) *
      sin(transformed.z * 11.0 - uTime * 1.2));
    float squish = 1.0 - uMelt * 0.78;
    float y = transformed.y * squish - uMelt * drip * 0.22 * h;
    float spread = 1.0 + uMelt * (1.0 - h) * 1.1;
    transformed = vec3(transformed.x * spread, max(y, 0.015), transformed.z * spread);
  }

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  vNormal = normalize(normalMatrix * objectNormal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
