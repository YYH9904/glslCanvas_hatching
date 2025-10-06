// HW2_LowHigh_Combine.frag
// Author: YH + ChatGPT
// Goal: A(海)=Low-pass(+FBO回授)  ×  B(稻)=High-pass  →  近遠遮罩混合
// Env: GlslCanvas (u_time, u_resolution, u_backbuffer, u_tex0, u_tex1)

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2  u_resolution;
uniform float u_time;
uniform vec2  u_mouse;
uniform sampler2D u_tex0;        // 海浪 (低通來源)
uniform sampler2D u_tex1;        // 稻浪 (高通來源)
uniform sampler2D u_backbuffer;  // 上一幀 (data-backbuffer="true")

// ================== Dials (feel free to tweak) ==================
// Far/Near separation strength
const float SIGMA_LP_NEAR = 2.5;   // 近景低通 (小一點, 保留一些結構)
const float SIGMA_LP_FAR  = 5.5;   // 遠景低通 (大很多, 明顯更糊)
const float SIGMA_HP      = 2.2;   // 稻紋的高通底層模糊
const float HP_GAIN_NEAR  = 2.2;   // 近景細節強度 (更銳)
const float HP_GAIN_FAR   = 0.2;   // 遠景細節強度 (幾乎無, 拉大遠近差)

// temporal feedback (拖尾/空氣感): 只在遠景強
const float FEEDBACK_NEAR = 0.10;
const float FEEDBACK_FAR  = 0.88;

// boundary (mask) base
const float EDGE_BASE   = 0.40;    // 基準交界位置
const float EDGE_WIDTH  = 0.24;    // 柔邊寬度
// breathing
const float DRIFT_AMPL  = 0.04;    // 呼吸幅度
const float DRIFT_SPEED = 0.60;    // 呼吸速度 (Hz-ish)
// mouse influence (0=off, 1=full)
const float MOUSE_BLEND = 0.75;    // 越大越跟著滑鼠
const float MOUSE_WIDTH = 0.06;    // 滑鼠邊界的半寬

// ================== Core utils ==================
vec3 blur1D(sampler2D tex, vec2 uv, vec2 dir, float sigma){
    vec2 texel = 1.0 / max(u_resolution, vec2(1.0));
    float w0=0.227027, w1=0.194594, w2=0.121621, w3=0.054054;
    vec2 s1 = dir * texel * 1.0 * sigma;
    vec2 s2 = dir * texel * 2.0 * sigma;
    vec2 s3 = dir * texel * 3.0 * sigma;
    vec3 c = texture2D(tex, uv).rgb * w0;
    c += (texture2D(tex, uv + s1).rgb + texture2D(tex, uv - s1).rgb) * w1;
    c += (texture2D(tex, uv + s2).rgb + texture2D(tex, uv - s2).rgb) * w2;
    c += (texture2D(tex, uv + s3).rgb + texture2D(tex, uv - s3).rgb) * w3;
    return c;
}
vec3 gaussian2D(sampler2D tex, vec2 uv, float sigma){
    return 0.5 * (blur1D(tex, uv, vec2(1.0,0.0), sigma)
                + blur1D(tex, uv, vec2(0.0,1.0), sigma));
}
vec3 highPass(sampler2D tex, vec2 uv, float sigma, float gain){
    vec3 src = texture2D(tex, uv).rgb;
    vec3 low = gaussian2D(tex, uv, sigma);
    return (src - low) * gain;
}

// ================== Interactive breathing mask ==================
// 0 = near, 1 = far
float radialMask(vec2 uv, float start, float width){
    vec2 p = uv - 0.5;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    float r = length(p * vec2(aspect, 1.0));
    return smoothstep(start, start + width, r);
}
float horizonMaskMouse(vec2 uv, float yCenter, float width){
    // y < yCenter = near; y > yCenter = far
    return smoothstep(yCenter - width, yCenter + width, uv.y);
}

float hybridMask(vec2 uv){
    // breathing
    float drift = DRIFT_AMPL * sin(u_time * DRIFT_SPEED*6.2831853);
    float start = EDGE_BASE + drift;

    // base radial
    float mR = radialMask(uv, start, EDGE_WIDTH);

    // mouse horizon (normalized; if mouse.x/y is 0 when untouched it’s fine)
    float my = u_mouse.y / max(u_resolution.y, 1.0);
    // clamp to [0,1] to be safe
    my = clamp(my, 0.0, 1.0);
    float mH = horizonMaskMouse(uv, my, MOUSE_WIDTH);

    // blend: when MOUSE_BLEND=0 -> pure radial; 1 -> pure mouse horizon
    return mix(mR, mH, MOUSE_BLEND);
}

// ================== Main ==================
void main(){
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0){
        gl_FragColor = vec4(0.0);
        return;
    }
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // Source
    vec3 ocean_src = texture2D(u_tex0, uv).rgb;

    // Two-level low-pass (stronger blur in far)
    vec3 ocean_lp_near = gaussian2D(u_tex0, uv, SIGMA_LP_NEAR);
    vec3 ocean_lp_far  = gaussian2D(u_tex0, uv, SIGMA_LP_FAR);

    // Distance mask
    float m = hybridMask(uv);                   // 0 near → 1 far

    // Distance-aware feedback amount
    float fb = mix(FEEDBACK_NEAR, FEEDBACK_FAR, m);

    // Far branch with temporal feedback (only if backbuffer is valid)
    vec3 far_base = ocean_lp_far;
    if (u_time > 0.02){
        vec3 prev = texture2D(u_backbuffer, uv).rgb;
        float prevMag = max(max(prev.r, prev.g), prev.b);
        float fbAmt = (prevMag > 0.0001) ? fb : 0.0;
        far_base = mix(ocean_lp_far, prev, fbAmt);
    }

    // High-pass detail with distance-aware gain (strong near, almost none far)
    float hpGain = mix(HP_GAIN_NEAR, HP_GAIN_FAR, m);
    vec3 rice_hp = highPass(u_tex1, uv, SIGMA_HP, hpGain);

    // Compose:
    // - Near: more original ocean + detail, just a touch of lp to keep it cohesive
    vec3 nearCol = clamp(mix(ocean_src, ocean_lp_near, 0.18) + rice_hp, 0.0, 1.0);
    // - Far: just the (feedbacked) strong low-pass
    vec3 farCol  = far_base;

    vec3 color = mix(nearCol, farCol, m);
    gl_FragColor = vec4(color, 1.0);
}
