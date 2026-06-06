float getFresnel(vec3 normal, vec3 viewDir, float power) {
  float d = dot(normalize(normal), normalize(viewDir));
  return 1.0 - pow(abs(d), power);
}
