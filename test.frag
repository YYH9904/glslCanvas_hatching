#ifdef GL_ES
precision mediump float;
#endif

uniform vec2  u_resolution;
uniform float u_time;
uniform sampler2D u_tex0;        // A：海浪（低通來源）
uniform sampler2D u_tex1;        // B：稻浪/細紋理（高通來源）
uniform sampler2D u_backbuffer;  // 可能存在（若 HTML 有啟用 data-backbuffer="true"）

// ---------- 可調參數 ----------
const float SIGMA_LP   = 3.0;    // 低通強度（海）
const float SIGMA_HP   = 2.2;    // 高通中的低通核（稻）
const float HP_GAIN    = 1.8;    // 高通增益
const float FEEDBACK   = 0.80;   // 回授量（有 backbuffer 時才生效）

const float EDGE_START = 0.40;   // 遮罩起點（中心=近）
const float EDGE_WIDTH = 0.25;   // 遮罩柔邊

// ---------- 工具 ----------
vec3 blur1D(sampler2D tex, vec2 uv, vec2 dir, float sigma) {
    vec2 texel = 1.0 / max(u_resolution, vec2(1.0)); // 防 0
    float w0 = 0.227027;
    float w1 = 0.194594;
    float w2 = 0.121621;
    float w3 = 0.054054;

    vec2 s1 = dir * texel * 1.0 * sigma;
    vec2 s2 = dir * texel * 2.0 * sigma;
    vec2 s3 = dir * texel * 3.0 * sigma;

    vec3 c = texture2D(tex, uv).rgb * w0;
    c += (texture2D(tex, uv + s1).rgb + texture2D(tex, uv - s1).rgb) * w1;
    c += (texture2D(tex, uv + s2).rgb + texture2D(tex, uv - s2).rgb) * w2;
    c += (texture2D(tex, uv + s3).rgb + texture2D(tex, uv - s3).rgb) * w3;
    return c;
}

vec3 gaussian2D(sampler2D tex, vec2 uv, float sigma) {
    vec3 h = blur1D(tex, uv, vec2(1.0, 0.0), sigma);
    vec3 v = blur1D(tex, uv, vec2(0.0, 1.0), sigma);
    return 0.5 * (h + v);
}

vec3 highPass(sampler2D tex, vec2 uv, float sigma, float gain) {
    vec3 src = texture2D(tex, uv).rgb;
    vec3 low = gaussian2D(tex, uv, sigma);
    return (src - low) * gain;
}

// 徑向遮罩（0=近、1=遠）
float radialMask(vec2 uv) {
    vec2 p = uv - 0.5;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    float r = length(p * vec2(aspect, 1.0));
    return smoothstep(EDGE_START, EDGE_START + EDGE_WIDTH, r);
}

void main() {
    // 防止解析度為 0 的極端初始化狀態
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec2 uv = gl_FragCoord.xy / u_resolution;

    // A：海 → 低通
    vec3 ocean_src = texture2D(u_tex0, uv).rgb;
    vec3 ocean_lp  = gaussian2D(u_tex0, uv, SIGMA_LP);

    // 低通支路回授（若 backbuffer 沒啟用/為黑，會自動退化成純低通）
    vec3 low_accum = ocean_lp;
    if (u_time > 0.02) {
        vec3 prev = texture2D(u_backbuffer, uv).rgb;   // 若未啟用可能是(0,0,0)
        // 判斷 prev 是否接近黑，若是則等同無回授
        float prevMag = max(max(prev.r, prev.g), prev.b);
        float fbAmt = (prevMag > 0.0001) ? FEEDBACK : 0.0;
        low_accum = mix(ocean_lp, prev, fbAmt);
    }

    // B：稻 → 高通（細節）
    vec3 rice_hp = highPass(u_tex1, uv, SIGMA_HP, HP_GAIN);

    // 合成：近（原海 + 稻細節），遠（回授後低通海）
    float m = radialMask(uv);
    vec3 nearCol = clamp(ocean_src + rice_hp, 0.0, 1.0);
    vec3 farCol  = low_accum;

    vec3 color = mix(nearCol, farCol, m);
    gl_FragColor = vec4(color, 1.0);
}
