// HW2_LowHigh_Combine.frag
// Author: YH + ChatGPT
// Goal: A(海)=Low-pass(+FBO回授)  ×  B(稻)=High-pass  →  近遠遮罩混合
// Env: GlslCanvas (u_time, u_resolution, u_backbuffer, u_tex0, u_tex1)

gl_FragColor = vec4(1.,0.,0.,1.); return;

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2  u_resolution;
uniform float u_time;
uniform sampler2D u_tex0;        // 圖A：海浪（低通來源）
uniform sampler2D u_tex1;        // 圖B：稻浪/細紋理（高通來源）
uniform sampler2D u_backbuffer;  // 上一幀畫面（FBO 回授）

// ===================== 調參 =====================
const float SIGMA_LP   = 3.0;    // 低通強度：海的模糊程度（2.5~6.0）
const float SIGMA_HP   = 2.2;    // 高通低通核：稻紋理的平滑半徑（2.0~3.0）
const float HP_GAIN    = 1.8;    // 高通增益：細節強度（1.3~2.5）
const float FEEDBACK   = 0.80;   // 回授量：越大越拖尾/空氣感（0.7~0.9）

// 遮罩（近遠切換）：選一種
#define MASK_RADIAL     1        // 徑向：中心近、邊緣遠（勾稻田→海的「聚焦」感）
#define MASK_HORIZON    0        // 地平線：由下往上過門（稻田在前、海天在遠）

const float EDGE_START = 0.40;   // 近遠交界起點（0~1）
const float EDGE_WIDTH = 0.25;   // 柔邊寬度

// ===================== 工具函式 =====================

// 一維高斯近似（對稱 3 階 + 中心）
vec3 blur1D(sampler2D tex, vec2 uv, vec2 dir, float sigma) {
    vec2 texel = 1.0 / max(u_resolution, vec2(1.0));

    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    // 常用近似權重（可視為固定核，sigma 當作伸縮係數）
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

// 二維高斯 = 1D (X) + 1D (Y)
vec3 gaussian2D(sampler2D tex, vec2 uv, float sigma) {
    vec3 h = blur1D(tex, uv, vec2(1.0, 0.0), sigma);
    vec3 v = blur1D(tex, uv, vec2(0.0, 1.0), sigma);
    return 0.5 * (h + v);
}

// 高通：原圖 - 低通（再乘增益）
vec3 highPass(sampler2D tex, vec2 uv, float sigma, float gain) {
    vec3 src = texture2D(tex, uv).rgb;
    vec3 low = gaussian2D(tex, uv, sigma);
    return (src - low) * gain;
}

// 遮罩（0=近、1=遠）
float distanceMask(vec2 uv) {
#if MASK_RADIAL
    vec2 p = uv - 0.5;
    float aspect = u_resolution.x / u_resolution.y;
    float r = length(p * vec2(aspect, 1.0));
    return smoothstep(EDGE_START, EDGE_START + EDGE_WIDTH, r);
#elif MASK_HORIZON
    // 自下而上：y 越大越遠（可依需求反相）
    return smoothstep(EDGE_START, EDGE_START + EDGE_WIDTH, uv.y);
#else
    return 0.0;
#endif
}

// 安全夾取
vec3 saturate(vec3 x){ return clamp(x, 0.0, 1.0); }

// ===================== 主流程 =====================
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // --- A: 海浪 → 低通 ---
    vec3 ocean_src = texture2D(u_tex0, uv).rgb;
    vec3 ocean_lp  = gaussian2D(u_tex0, uv, SIGMA_LP);

    // 低通支路加 FBO 回授（教材重點：上一幀與本幀混合，形成時間上的累積/拖尾）
    vec3 low_accum = ocean_lp;
    if (u_time > 0.02) { // 避免第一幀讀到黑色 backbuffer
        vec3 prev = texture2D(u_backbuffer, uv).rgb;
        float prevMag = max(max(prev.r, prev.g), prev.b);
        float fbAmt = (prevMag > 0.0001) ? FEEDBACK : 0.0; // 沒內容就別回授
        // 只對低頻支路做回授：遠處更「空氣感」
        low_accum = mix(ocean_lp, prev, fbAmt);
}

