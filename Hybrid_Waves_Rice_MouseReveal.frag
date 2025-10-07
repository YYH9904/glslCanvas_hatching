#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;      // 滑鼠位置
uniform sampler2D u_tex0;  // Waves：低頻層（海）
uniform sampler2D u_tex1;  // Rice：高頻層（稻）
varying vec2 v_texcoord;

// --- sRGB <-> Linear ---
vec3  toLinear(vec3 c){ return pow(c, vec3(2.2)); }
vec3  toSRGB  (vec3 c){ return pow(c, vec3(1.0/2.2)); }
float luminance(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

// --- Gaussian ---
vec3 gauss2D_rgb(sampler2D tex, vec2 uv, float sigma){
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int ix=-10; ix<=10; ix++){
        for (int iy=-10; iy<=10; iy++){
            vec2 o = vec2(float(ix), float(iy));
            float w = exp(-(dot(o,o)) / (2.0 * sigma * sigma));
            acc += toLinear(texture2D(tex, uv + o / u_resolution).rgb) * w;
            wsum += w;
        }
    }
    return acc / max(wsum, 1e-6);
}

float gauss2D_lum(sampler2D tex, vec2 uv, float sigma){
    float acc = 0.0;
    float wsum = 0.0;
    for (int ix=-10; ix<=10; ix++){
        for (int iy=-10; iy<=10; iy++){
            vec2 o = vec2(float(ix), float(iy));
            float w = exp(-(dot(o,o)) / (2.0 * sigma * sigma));
            vec3 rgb = toLinear(texture2D(tex, uv + o / u_resolution).rgb);
            acc += luminance(rgb) * w;
            wsum += w;
        }
    }
    return acc / max(wsum, 1e-6);
}

void main(){
    vec2 uv = v_texcoord;

    // --- Normalize mouse position ---
    vec2 mouseNorm = u_mouse / u_resolution;

    // 計算與滑鼠的距離
    float dist = distance(uv, mouseNorm);

    // 控制近距離顯示範圍（半徑）
    const float RADIUS = 0.25;      // 影響區域（0~1）
    const float EDGE_SMOOTH = 0.15; // 邊緣過渡
    float nearWeight = 1.0 - smoothstep(RADIUS - EDGE_SMOOTH, RADIUS, dist);
    // nearWeight: 滑鼠中心=1 → 外圍=0

    // --- 低頻：海（遠距離基底） ---
    const float SIGMA_LOW = 18.0;
    vec3 seaLow = gauss2D_rgb(u_tex0, uv, SIGMA_LOW);
    float seaLum = luminance(seaLow);

    // --- 高頻：稻（細節） ---
    const float SIGMA_HIGH = 1.2;
    float riceLum     = luminance(toLinear(texture2D(u_tex1, uv).rgb));
    float riceLumBlur = gauss2D_lum(u_tex1, uv, SIGMA_HIGH);
    float riceHigh    = riceLum - riceLumBlur;

    // 細節強度與對比（可調）
    const float DETAIL_GAIN     = 1.5;
    const float DETAIL_CONTRAST = 1.1;
    riceHigh *= DETAIL_GAIN * nearWeight;
    riceHigh  = riceHigh * DETAIL_CONTRAST;

    // --- 亮度混合 ---
    float hybridLum = clamp(seaLum + riceHigh, 0.0, 1.0);

    // --- 安全亮度重建 ---
    float eps = 1e-2;
    float safeLum = mix(seaLum, 0.3, step(seaLum, 0.02));
    float scale = clamp(hybridLum / max(safeLum, eps), 0.6, 1.4);

    vec3 hybridLin = clamp(seaLow * scale, 0.0, 1.0);
    gl_FragColor = vec4(toSRGB(hybridLin), 1.0);
}

