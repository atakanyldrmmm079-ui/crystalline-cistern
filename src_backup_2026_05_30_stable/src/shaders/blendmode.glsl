float blendScreen(float base, float blend) {
  return 1.0 - ((1.0 - base) * (1.0 - blend));
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return vec3(
    blendScreen(base.r, blend.r),
    blendScreen(base.g, blend.g),
    blendScreen(base.b, blend.b)
  );
}

vec3 blendScreen(vec3 base, vec3 blend, float opacity) {
  return blendScreen(base, blend) * opacity + base * (1.0 - opacity);
}

vec3 blendAdd(vec3 base, vec3 blend, float opacity) {
  return min(base + blend * opacity, vec3(1.0));
}

vec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {
  vec3 result = mix(
    2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
    sqrt(max(base, 0.0)) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
    step(0.5, blend)
  );

  return result * opacity + base * (1.0 - opacity);
}