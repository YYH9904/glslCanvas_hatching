#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform vec2      u_resolution;
uniform sampler2D u_tex0;   // 你的原始照片

// =================== 工具函式 ===================

// 旋轉 2x2
mat2 rot(float a){
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// 簡單且穩定的 hash
float hash12(vec2 p){
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p){
  float n = hash12(p);
  return vec2(n, hash12(p + n + 7.23));
}

// 點到線段距離（畫筆粗細要用）
float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// 亮度
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

// 取影像梯度 → 轉成「等亮線方向」（= 梯度法向）
float gradAngle(vec2 uv){
  vec2 texel = 1.0 / u_resolution;
  float cL   = luma(texture2D(u_tex0, uv).rgb);
  float Lx   = luma(texture2D(u_tex0, uv + vec2(texel.x, 0.0)).rgb)
             - luma(texture2D(u_tex0, uv - vec2(texel.x, 0.0)).rgb);
  float Ly   = luma(texture2D(u_tex0, uv + vec2(0.0, texel.y)).rgb)
             - luma(texture2D(u_tex0, uv - vec2(0.0, texel.y)).rgb);
  // 筆觸沿等亮線 → 與梯度垂直（+90°）
  return atan(Ly, Lx) + 1.5707963;
}

// 單層「Scribble/Curved-Contour」筆觸：回傳覆蓋度(0..1)
float scribbleLayer(vec2 uv, float density, float segLen, float width, float bend){
  // 以螢幕尺度計算，讓筆觸粗細不受解析度影響
  vec2 p = (uv * u_resolution) / max(u_resolution.x, u_resolution.y);

  // 密度 → cell 數：數值越大 cell 越小 → 筆觸越密（可依喜好調）
  float cell = mix(18.0, 6.0, density);
  vec2 gp = p * cell;
  vec2 id = floor(gp);
  vec2 fu = fract(gp) - 0.5;      // cell 內局部座標（中心為 0,0）

  // 每個 cell 的穩定隨機
  vec2  rnd = hash22(id);
  float aImg = gradAngle(uv);                 // 影像導向角（沿等亮線）
  float ang  = aImg + (rnd.x - 0.5) * 0.35;   // 少量噪聲避免太整齊
  fu += (rnd.y - 0.5) * 0.25;                 // 輕微位移抖動

  // 直線端點（segLen = 筆觸長）；再做中段微彎
  vec2 dir = normalize(rot(ang) * vec2(1.0, 0.0));
  vec2 a = -0.5 * segLen * dir;
  vec2 b =  0.5 * segLen * dir;

  float t   = clamp(dot(fu - a, dir) / max(segLen, 1e-4), 0.0, 1.0);
  vec2  mid = mix(a, b, t);
  vec2  nrm = vec2(-dir.y, dir.x);
  float curv = bend * sin(3.14159 * (t - 0.5));  // 中央較彎、兩端較直
  vec2  cpt  = mid + nrm * curv;

  // 距離到彎曲中心線（以兩段近似）
  float d = min(sdSegment(fu, a, cpt), sdSegment(fu, cpt, b));

  // 距離→墨水覆蓋（線內=黑）；width 決定線粗
  float ink = smoothstep(width, width * 0.6, d);
  return ink;
}

// =================== 主程式 ===================
void main(){
  vec2 uv  = gl_FragCoord.xy / u_resolution;
  vec3 src = texture2D(u_tex0, uv).rgb;
  float L  = luma(src);                       // 0=黑 1=白

  // ---- 亮度分段（10 等級，與你原來的結構一致）----
  float stepv = 1.0 / 10.0;
  float density, segLen, width, bend;

 if      (L <= 1.0*stepv){ density=0.95; segLen=0.60; width=0.032; bend=0.060; }
  else if (L <= 2.0*stepv){ density=0.85; segLen=0.55; width=0.030; bend=0.060; }
  else if (L <= 3.0*stepv){ density=0.75; segLen=0.50; width=0.028; bend=0.055; }
  else if (L <= 4.0*stepv){ density=0.65; segLen=0.45; width=0.026; bend=0.055; }
  else if (L <= 5.0*stepv){ density=0.55; segLen=0.40; width=0.024; bend=0.050; }
  else if (L <= 6.0*stepv){ density=0.45; segLen=0.35; width=0.022; bend=0.045; }
  else if (L <= 7.0*stepv){ density=0.35; segLen=0.30; width=0.020; bend=0.040; }
  else if (L <= 8.0*stepv){ density=0.25; segLen=0.25; width=0.018; bend=0.035; }
  else if (L <= 9.0*stepv){ density=0.18; segLen=0.20; width=0.016; bend=0.030; }
  else                    { density=0.10; segLen=0.15; width=0.014; bend=0.025; }

  // ---- 主筆觸層 + 兩個淡淡的疊加層（更自然）----
  float cov  = 0.70 * scribbleLayer(uv, density,        segLen,        width,        bend);
        cov += 0.20 * scribbleLayer(uv + vec2( 0.37, 0.11), mix(0.9,0.2,L), segLen*0.82, width*0.63, bend*0.83);
        cov += 0.10 * scribbleLayer(uv + vec2(-0.21, 0.29), mix(0.8,0.15,L), segLen*1.10, width*0.53, bend*1.15);
  cov = clamp(cov, 0.0, 1.0);

  // ---- 邊緣加強（Sobel）----
  vec2 texel = 1.0 / u_resolution;
  float c00 = luma(texture2D(u_tex0, uv + texel*vec2(-1,-1)).rgb);
  float c10 = luma(texture2D(u_tex0, uv + texel*vec2( 0,-1)).rgb);
  float c20 = luma(texture2D(u_tex0, uv + texel*vec2( 1,-1)).rgb);
  float c01 = luma(texture2D(u_tex0, uv + texel*vec2(-1, 0)).rgb);
  float c21 = luma(texture2D(u_tex0, uv + texel*vec2( 1, 0)).rgb);
  float c02 = luma(texture2D(u_tex0, uv + texel*vec2(-1, 1)).rgb);
  float c12 = luma(texture2D(u_tex0, uv + texel*vec2( 0, 1)).rgb);
  float c22 = luma(texture2D(u_tex0, uv + texel*vec2( 1, 1)).rgb);

  float gx = -c00 - 2.0*c01 - c02 + c20 + 2.0*c21 + c22;
  float gy =  c00 + 2.0*c10 + c20 - c02 - 2.0*c12 - c22;
  float edge = clamp(length(vec2(gx, gy)) * 1.2, 0.0, 1.0);

  cov = max(cov, edge * 0.5); // 邊緣可視化：0.5 可調

  // ---- 亮度連續調整（暗更濃、亮更淡）----
  float gamma = 1.4;
  float tone  = 1.0 - pow(L, gamma); // 暗→大、亮→小
  cov *= mix(0.7, 1.2, tone);
  cov = clamp(cov, 0.0, 1.0);

  // ---- 上色（原圖顏色當筆色）----
  vec3 ink = normalize(src) * 0.8;
  vec3 paper = vec3(1.0);
  vec3 outRGB = mix(paper, ink, cov);

  gl_FragColor = vec4(outRGB, 1.0);
}
