#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform vec2      u_resolution;
uniform sampler2D u_tex0;   // 你的原始照片：用它取亮度

// =============== [1] 工具函式：放在 main() 之前 =================

// 旋轉 2x2 矩陣
mat2 rot(float a){ 
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// 穩定隨機數（同一個 cell 固定）
float hash12(vec2 p){
  p = fract(p * vec2(443.8975, 397.2973));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p){
  float n = hash12(p);
  return vec2(n, hash12(p + n + 7.23));
}

// 點到線段 (a->b) 的最近距離（畫筆粗細需要）
float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// =============== [2] Scribble 筆觸層：放在 main() 之前 =================
// 回傳值：0..1 的「墨水覆蓋度」(1=很黑)。參數：密度、筆觸長、粗細、彎曲量
float scribbleLayer(vec2 uv, float density, float segLen, float width, float bend){
  // 用螢幕尺度，讓筆觸粗細不因解析度改變
  vec2 p = (uv * u_resolution) / max(u_resolution.x, u_resolution.y);

  // 密度轉 cell 大小（越密 cell 越小）
  float cell = mix(18.0, 6.0, density);
  vec2 gp = p * cell;
  vec2 id = floor(gp);
  vec2 fu = fract(gp) - 0.5;     // 以 cell 中心為原點

  // 為每個 cell 生成穩定參數
  vec2  rnd = hash22(id);
  float ang = radians(180.0) * (rnd.x - 0.5); // 約 ±90° 的隨機角度
  float j   = (rnd.y - 0.5) * 0.25;          // 小抖動
  fu += j;

  // 直線方向與端點（segLen = 筆觸長度）
  vec2 dir = normalize(rot(ang) * vec2(1.0, 0.0));
  vec2 a = -0.5 * segLen * dir;
  vec2 b =  0.5 * segLen * dir;

  // 讓線段中段稍微彎（像你給的參考圖）
  float t   = clamp(dot(fu - a, dir) / segLen, 0.0, 1.0);
  vec2  mid = mix(a, b, t);
  vec2  nrm = vec2(-dir.y, dir.x);
  float curv = bend * sin(3.14159 * (t - 0.5)); // 中央最彎、兩端較直
  vec2  cpt  = mid + nrm * curv;

  // 取到彎曲中心線的距離：用 (a->cpt) 與 (cpt->b) 兩段近似
  float d = min(sdSegment(fu, a, cpt), sdSegment(fu, cpt, b));

  // 距離轉成墨水覆蓋度（小於寬度=線內，越黑）
  float ink = smoothstep(width, width * 0.6, d);
  return ink;
}

// =============== [3] main：在這裡呼叫上面函式 =================
void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution;

  // 取亮度：比只用藍色通道更可靠（你也可改回 .b）
  vec3 src = texture2D(u_tex0, uv).rgb;
  float L  = dot(src, vec3(0.299, 0.587, 0.114));  // 0=黑 1=白

  // 你原本的 10 等分概念（0~1 分 10 段）
  float stepv = 1.0 / 10.0;

  // 依亮度決定 scribble 參數（越暗越密/越粗/越彎）
  float density, segLen, width, bend;

  if      (L <= 1.0*stepv){ density=0.95; segLen=0.22; width=0.060; bend=0.060; }
  else if (L <= 2.0*stepv){ density=0.85; segLen=0.22; width=0.058; bend=0.060; }
  else if (L <= 3.0*stepv){ density=0.75; segLen=0.20; width=0.055; bend=0.055; }
  else if (L <= 4.0*stepv){ density=0.65; segLen=0.20; width=0.052; bend=0.055; }
  else if (L <= 5.0*stepv){ density=0.55; segLen=0.18; width=0.050; bend=0.050; }
  else if (L <= 6.0*stepv){ density=0.45; segLen=0.18; width=0.047; bend=0.045; }
  else if (L <= 7.0*stepv){ density=0.35; segLen=0.16; width=0.045; bend=0.040; }
  else if (L <= 8.0*stepv){ density=0.25; segLen=0.16; width=0.042; bend=0.035; }
  else if (L <= 9.0*stepv){ density=0.18; segLen=0.14; width=0.040; bend=0.030; }
  else                    { density=0.10; segLen=0.12; width=0.035; bend=0.025; }

  // 主層 + 兩個淡淡的疊加層，讓質感更自然
  float cov  = 0.70 * scribbleLayer(uv, density, segLen, width, bend);
        cov += 0.20 * scribbleLayer(uv + vec2(0.37, 0.11),
                                    mix(0.9, 0.2, L), segLen*0.82, width*0.63, bend*0.83);
        cov += 0.10 * scribbleLayer(uv + vec2(-0.21, 0.29),
                                    mix(0.8, 0.15, L), segLen*1.10, width*0.53, bend*1.15);
  cov = clamp(cov, 0.0, 1.0);

  // 你原本的色彩邏輯（藍墨 on 白紙）
  vec4 inkColor = vec4(0.0, 0.0, 1.0, 1.0);
  // 把 cov 當作 coverage，模擬紙/墨混合
  vec4 paper   = vec4(1.0);
  vec4 hatch   = mix(paper, inkColor, cov);

  gl_FragColor = hatch;
}
