uniform float uTime;
uniform vec3 uColor;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);
  vec3 lightDir = normalize(vec3(0.4, 0.8, 0.5));

  // ラップライティングで擬似SSS（ゲルの内側で光が回り込む感じ）
  float wrap = clamp((dot(n, lightDir) + 0.6) / 1.6, 0.0, 1.0);
  // フレネルで縁を明るく（ゲルの厚み感）
  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  // てかり
  vec3 h = normalize(lightDir + v);
  float spec = pow(max(dot(n, h), 0.0), 60.0);

  vec3 deep = uColor * 0.45;
  vec3 color = mix(deep, uColor, wrap);
  color += fresnel * uColor * 0.9;
  color += spec * vec3(1.0);

  // 縁ほど不透明に見えるゲルの透け感
  float alpha = clamp(0.62 + fresnel * 0.38, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
