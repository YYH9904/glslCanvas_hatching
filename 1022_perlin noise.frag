// Classic 2D Perlin noise rendered as animated grayscale
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

const float TAU = 6.28318530718;

vec2 gradient(vec2 p) {
    float angle = TAU * fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    return vec2(cos(angle), sin(angle));
}

float perlin(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = fract(p);

    vec2 w = pf * pf * pf * (pf * (pf * 6.0 - 15.0) + 10.0);

    float x0 = dot(gradient(pi + vec2(0.0, 0.0)), pf - vec2(0.0, 0.0));
    float x1 = dot(gradient(pi + vec2(1.0, 0.0)), pf - vec2(1.0, 0.0));
    float x2 = dot(gradient(pi + vec2(0.0, 1.0)), pf - vec2(0.0, 1.0));
    float x3 = dot(gradient(pi + vec2(1.0, 1.0)), pf - vec2(1.0, 1.0));

    float xa = mix(x0, x1, w.x);
    float xb = mix(x2, x3, w.x);
    return mix(xa, xb, w.y);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.x *= u_resolution.x / max(u_resolution.y, 1.0);

    vec2 p = uv * 5.0 + u_time * 0.25;
    float n = perlin(p);

    gl_FragColor = vec4(vec3(0.5 + 0.5 * n), 1.0);
}
