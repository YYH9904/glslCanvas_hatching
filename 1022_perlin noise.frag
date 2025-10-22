// Perlin-noise-driven material presets: clouds, lava, marble, wood
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_scale;
uniform float u_octaves;
uniform float u_material; // 0: clouds, 1: lava, 2: marble, 3: wood

const float TAU = 6.28318530718;
const int MAX_OCTAVES = 8;

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

float fbm(vec2 p, float octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    float total = 0.0;

    for (int i = 0; i < MAX_OCTAVES; ++i) {
        if (float(i) >= octaves) break;
        value += perlin(p * frequency) * amplitude;
        total += amplitude;
        frequency *= lacunarity;
        amplitude *= gain;
    }

    return value / max(total, 0.0001);
}

float turbulence(vec2 p, float octaves, float lacunarity, float gain) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    float total = 0.0;

    for (int i = 0; i < MAX_OCTAVES; ++i) {
        if (float(i) >= octaves) break;
        value += abs(perlin(p * frequency)) * amplitude;
        total += amplitude;
        frequency *= lacunarity;
        amplitude *= gain;
    }

    return value / max(total, 0.0001);
}

float to01(float v) {
    return 0.5 + 0.5 * v;
}

vec3 shadeClouds(vec2 uv, vec2 p, float scale, float octaves) {
    vec2 drift = vec2(u_time * 0.03, u_time * 0.015);
    float base = turbulence(p * scale + drift, octaves, 2.0, 0.55);
    float detail = turbulence(p * scale * 2.2 - drift * 0.7, min(octaves + 1.0, float(MAX_OCTAVES)), 2.4, 0.5);
    float density = smoothstep(0.35, 0.85, base + detail * 0.35);
    vec3 sky = vec3(0.25, 0.35, 0.6);
    vec3 cloud = vec3(0.92, 0.94, 1.0);
    return mix(sky, cloud, density);
}

vec3 shadeLava(vec2 uv, vec2 p, float scale, float octaves) {
    vec2 flow = vec2(u_time * 0.4, u_time * -0.2);
    float molten = turbulence(p * scale + flow, octaves, 2.0, 0.65);
    float veins = to01(fbm(p * scale * 1.6 - flow * 0.2, octaves, 2.3, 0.55));
    float glow = smoothstep(0.45, 0.85, molten + veins * 0.5);

    vec3 rock = vec3(0.12, 0.03, 0.01);
    vec3 ember = vec3(0.8, 0.2, 0.0);
    vec3 core = vec3(1.0, 0.75, 0.25);

    vec3 color = mix(rock, ember, glow);
    color = mix(color, core, pow(clamp(glow, 0.0, 1.0), 3.0));
    return color;
}

vec3 shadeMarble(vec2 uv, vec2 p, float scale, float octaves) {
    float swirl = fbm(p * scale * 1.5 + vec2(0.0, u_time * 0.1), octaves, 2.1, 0.55);
    float veins = sin((p.x + p.y * 0.2) * scale * 2.5 + swirl * 4.0);
    float tone = smoothstep(0.0, 1.0, to01(veins));

    vec3 base = vec3(0.88, 0.88, 0.85);
    vec3 vein = vec3(0.25, 0.25, 0.28);
    vec3 tint = vec3(0.94, 0.93, 0.9);

    vec3 color = mix(vein, base, tone);
    color = mix(color, tint, 0.4);
    return color;
}

vec3 shadeWood(vec2 uv, vec2 p, float scale, float octaves) {
    vec2 offset = vec2(0.3, 0.1) * u_time * 0.05;
    vec2 woodUV = (uv - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    float dist = length(woodUV) * scale * 0.3;
    float grain = fbm(p * scale * vec2(0.6, 1.8) + offset, octaves, 2.2, 0.55);
    float rings = sin(dist * 12.0 + grain * 3.5);
    float tone = smoothstep(0.2, 0.8, to01(rings));

    vec3 lightWood = vec3(0.65, 0.43, 0.2);
    vec3 darkWood = vec3(0.38, 0.22, 0.09);
    vec3 highlight = vec3(0.8, 0.55, 0.28);

    vec3 color = mix(darkWood, lightWood, tone);
    color += highlight * pow(clamp(1.0 - tone, 0.0, 1.0), 2.0) * 0.2;
    return color;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
    vec2 p = (uv - 0.5) * aspect;

    float scale = max(u_scale, 0.0001);
    float octaves = clamp(u_octaves, 1.0, float(MAX_OCTAVES));
    int material = int(floor(u_material + 0.5));

    vec3 color;
    if (material == 1) {
        color = shadeLava(uv, p, scale, octaves);
    } else if (material == 2) {
        color = shadeMarble(uv, p, scale, octaves);
    } else if (material == 3) {
        color = shadeWood(uv, p, scale, octaves);
    } else {
        color = shadeClouds(uv, p, scale, octaves);
    }

    gl_FragColor = vec4(color, 1.0);
}
