// Author: Github Copliot
// Title: Procedural Camouflage 

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
float u_scale=5.5;       // base scale (suggest 2.0..8.0)
int   u_octaves=4;     // fbm octaves (1..8)
float u_persistence=0.4; // fbm persistence (0.3..0.8)
float u_lacunarity=1.8;  // fbm lacunarity (1.8..2.5)
float u_contrast=0.7;    // global contrast (0.5..2.0)
int   u_levels=4;      // number of color blobs (2..6)
float u_edgeSoft=0.1;    // softness of blob edges (0.01..0.15)
float u_seed=0.312;        // random seed/animation offset
vec2  u_offset=vec2(0.);      // optional sample offset
float u_gamma=1.0;       // final gamma correction (0.8..1.2)

//
// Improved camo shader: multi-scale fbm + better soft quantization,
// subtle color variation, local contrast and film grain for visual quality.
//

// --- hash / grad ---
float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
vec2 grad2(vec2 p){ float a = hash21(p)*6.28318530718; return vec2(cos(a),sin(a)); }
vec2 fade2(vec2 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }

// classic perlin noise
float perlin(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 g00 = grad2(i+vec2(0.0,0.0)), g10 = grad2(i+vec2(1.0,0.0));
    vec2 g01 = grad2(i+vec2(0.0,1.0)), g11 = grad2(i+vec2(1.0,1.0));
    vec2 d00 = f - vec2(0.0,0.0), d10 = f - vec2(1.0,0.0);
    vec2 d01 = f - vec2(0.0,1.0), d11 = f - vec2(1.0,1.0);
    float n00 = dot(g00,d00), n10 = dot(g10,d10), n01 = dot(g01,d01), n11 = dot(g11,d11);
    vec2 u = fade2(f);
    float nx0 = mix(n00,n10,u.x), nx1 = mix(n01,n11,u.x);
    return mix(nx0,nx1,u.y);
}

// robust fbm with amplitude normalization
float fbm(vec2 p){
    int oct = 8; //int(u_octaves); //clamp(u_octaves, 1, 8);
    float pers = (u_persistence <= 0.0) ? 0.5 : u_persistence;
    float lac = (u_lacunarity <= 0.0) ? 2.0 : u_lacunarity;
    float amp = 1.0;
    float freq = 1.0;
    float sum = 0.0;
    float maxA = 0.0;
    for(int i=0;i<8;i++){
        if(i >= oct) break;
        sum += amp * perlin(p * freq);
        maxA += amp;
        amp *= pers;
        freq *= lac;
    }
    return sum / maxA;
}

// turbulence (abs)
float turb(vec2 p){
    int oct = 6; //int(u_octaves); //;clamp(u_octaves,1,8);
    float pers = (u_persistence <= 0.0) ? 0.5 : u_persistence;
    float lac = (u_lacunarity <= 0.0) ? 2.0 : u_lacunarity;
    float amp = 1.0; float freq = 1.0;
    float sum = 0.0; float maxA = 0.0;
    for(int i=0;i<8;i++){
        if(i >= oct) break;
        sum += amp * abs(perlin(p * freq));
        maxA += amp;
        amp *= pers;
        freq *= lac;
    }
    return sum / maxA;
}

// palettes: woodland with subtle variation per position
vec3 camoPalette(float t, float variation){
    // base colors
    vec3 c0 = vec3(0.04,0.06,0.03);
    vec3 c1 = vec3(0.12,0.20,0.07);
    vec3 c2 = vec3(0.34,0.45,0.18);
    vec3 c3 = vec3(0.52,0.40,0.22);
    // slightly perturb hues using variation
    c1 += variation * 0.03;
    c2 += variation * 0.02;
    c3 += variation * 0.015;
    if(t < 0.25) return mix(c0,c1, smoothstep(0.0,0.25, t));
    if(t < 0.5)  return mix(c1,c2, smoothstep(0.25,0.5, t));
    if(t < 0.75) return mix(c2,c3, smoothstep(0.5,0.75, t));
    return mix(c3,c0, smoothstep(0.75,1.0, t));
}

// small helper for contrast curve (S-curve)
float contrastCurve(float x, float c){
    // c = 1 -> identity, c>1 increases contrast
    float k = pow(0.5, c);
    return (x - k) / (1.0 - 2.0 * k);
}

void main(){
    // safe defaults
    float scale = (u_scale <= 0.0) ? 4.0 : u_scale;
    int levelsInt = 5; //int(u_levels); //max(2, u_levels);
    float edgeSoft = max(0.001, u_edgeSoft);
    float seed = u_seed;
    float gamma = (u_gamma <= 0.0) ? 1.0 : u_gamma;
    float contrast = (u_contrast <= 0.0) ? 1.0 : u_contrast;

    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    // scaling and optional offset
    vec2 p = (uv - 0.5) * aspect * scale + u_offset;

    // add slow organic motion via seed/time
    p += vec2(seed * 10.0, seed * -7.0) + vec2(u_time * 0.01, -u_time * 0.006);

    // multi-scale composition with improved weights
    float b1 = fbm(p * 0.9);
    float b2 = fbm(p * 2.8 + vec2(5.2,3.7)) * 0.6;
    float b3 = turb(p * 6.5 + vec2(12.1,9.4)) * 0.28;
    float mask = b1 * 0.5 + b2 * 0.35 + b3 * 0.15;
    // normalize and apply gentle contrast
    mask = clamp(mask * 0.5 + 0.5, 0.0, 1.0);
    mask = clamp(contrastCurve(mask, clamp(contrast, 0.6, 1.8)), 0.0, 1.0);

    // quantize into soft levels
    float levels = float(levelsInt);
    float q = clamp(mask, 0.0, 0.9999);
    float scaled = q * levels;
    float idx = floor(scaled);
    float frac = fract(scaled);

    // soften edges using screen-space local noise and edgeSoft adjusted by levels
    float localVar = fbm(p * 12.0 + vec2(seed*2.3)) * 0.5;
    float soft = smoothstep(0.0, edgeSoft * 1.5, frac + (localVar - 0.25) * 0.5) *
                 (1.0 - smoothstep(1.0 - edgeSoft * 1.5, 1.0, frac + (localVar - 0.25) * 0.5));

    float t = (idx + soft) / max(1.0, levels - 1.0); //check
    t = clamp(t, 0.0, 1.0);

    // color variation per-patch
    float variation = fbm(p * 4.0 + vec2(9.1,4.7));

    vec3 color = camoPalette(t, variation);
    //gl_FragColor = vec4(camoPalette(t, variation), 1.0); //for debug

    // add subtle micro-grain for texture and to break banding
    float grain = fbm((uv * u_resolution.xy) * 0.5 + vec2(seed * 3.1)) * 0.035;
    color += grain;

    // slight local contrast boost using unsharp-ish technique (approx)
    float detail = turb(p * 20.0) * 0.25;
    color = mix(color, color + detail * 0.08, 0.5);

    // final color adjustments: desaturate slightly and gamma
    float lum = dot(color, vec3(0.299,0.587,0.114));
    color = mix(color, vec3(lum), 0.06); // slight desat
    color = pow(clamp(color, 0.0, 1.0), vec3(gamma));

    // subtle vignetting to focus center (optional, mild)
    float d = distance(uv, vec2(0.5));
    color *= smoothstep(0.9, 0.35, d) * 0.12 + 0.88;

    gl_FragColor = vec4(color, 1.0);
}