vec2 rotateUV(vec2 uv, float r, vec2 origin) {
  float c = cos(r);
  float s = sin(r);
  mat2 m = mat2(c, -s, s, c);
  vec2 st = uv - origin;
  st = m * st;
  return st + origin;
}

vec2 rotateUV(vec2 uv, float r) {
  return rotateUV(uv, r, vec2(0.5));
}

vec2 scaleUV(vec2 uv, vec2 scale, vec2 origin) {
  vec2 st = uv - origin;
  st /= scale;
  return st + origin;
}

vec2 scaleUV(vec2 uv, vec2 scale) {
  return scaleUV(uv, scale, vec2(0.5));
}
