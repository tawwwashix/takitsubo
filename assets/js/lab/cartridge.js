// Shared cartridge geometry and stable episode colors (scene, catalogue and PNG).
export const FALLBACK = "assets/img/artwork_320.jpg";
export const CASE_COLORS = {
  gray: ["#b9bab8", "#e7e7df", "#747e7c", "#455452"],
  black: ["#414c55", "#71818a", "#202d37", "#d9e3df"],
  amber: ["#e9bc46", "#fff0a0", "#ac7932", "#685024"],
  coral: ["#dc8079", "#ffbcb1", "#9d4950", "#6d363e"],
  mint: ["#77baa0", "#bcebd1", "#3d8173", "#285f56"],
  blue: ["#759bc9", "#beddf4", "#446c9e", "#294d74"],
  violet: ["#b094c8", "#dfcaf0", "#78609c", "#51406a"],
  ivory: ["#e6d9ae", "#fff9df", "#a89c72", "#6d664b"]
};
// Frozen v1 mapping: do not change the mixer or palette order when episodes grow.
export function cartridgeTone(number) {
  let n = (number ^ 0x54b1f2a7) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  n = (n ^ (n >>> 16)) >>> 0;
  const bucket = n % 10000;
  return bucket < 7000 ? "gray" : bucket < 9000 ? "black" : ["amber", "coral", "mint", "blue", "violet", "ivory"][Math.floor(n / 10000) % 6];
}

export function createCartridge(ep, miniature = false) {
  const art = document.createElement("span"); art.className = "lab-art" + (miniature ? " lab-miniature" : "");
  art.dataset.tone = cartridgeTone(ep.number);
  CASE_COLORS[art.dataset.tone].forEach((color, i) => art.style.setProperty(["--case-body", "--case-light", "--case-dark", "--case-ink"][i], color));
  const front = `<span class="lab-cart-front">
    <svg class="lab-cart-shell" viewBox="0 0 240 280" aria-hidden="true">
      <path fill="var(--case-body)" stroke="var(--case-dark)" stroke-width="3" d="M7 2h204l9 10v10h13q5 0 5 5v246q0 5-5 5H7q-5 0-5-5V7q0-5 5-5Z"/>
      <path fill="none" stroke="var(--case-light)" stroke-width="3" d="M7 272V7h202l8 9M223 26h10v244"/>
      <rect x="33" y="15" width="172" height="34" rx="12" fill="var(--case-dark)" opacity=".24"/>
      <path fill="none" stroke="var(--case-dark)" stroke-width="2" d="M46 15h146q13 0 13 13M33 37q0 12 13 12h146"/>
      <path fill="none" stroke="var(--case-light)" stroke-width="2" d="M35 37q0 11 12 11h143M9 23h20m-20 8h20m-20 8h20m-20 8h20M210 29h21m-21 8h21m-21 8h21m-21 8h21"/>
      <path fill="none" stroke="var(--case-dark)" stroke-width="2" d="M9 21h20m-20 8h20m-20 8h20m-20 8h20M210 27h21m-21 8h21m-21 8h21m-21 8h21"/>
      <text x="119" y="36" text-anchor="middle" fill="var(--case-light)" font-family="Arial,sans-serif" font-size="10.5" font-weight="bold" textLength="157" lengthAdjust="spacingAndGlyphs">GAME NO TAKITSUBO</text>
      <text x="119" y="35" text-anchor="middle" fill="var(--case-ink)" font-family="Arial,sans-serif" font-size="10.5" font-weight="bold" textLength="157" lengthAdjust="spacingAndGlyphs">GAME NO TAKITSUBO</text>
      <rect x="15" y="59" width="210" height="210" rx="6" fill="var(--case-dark)"/>
      <path fill="none" stroke="var(--case-light)" stroke-width="2" d="M18 264q0 5 5 5h195q7 0 7-7V65"/>
      <path fill="var(--case-dark)" d="M120 270q-8 7 0 7t0-7Z"/>
    </svg><span class="lab-cart-picture"></span></span>`;
  const sides = miniature ? "" : `<span class="lab-cart-back"></span><span class="lab-cart-side lab-cart-left"></span><span class="lab-cart-side lab-cart-right"></span><span class="lab-cart-top"></span><span class="lab-cart-step"></span><span class="lab-cart-step-top"></span><span class="lab-cart-bottom"></span>`;
  art.innerHTML = `<span class="lab-float"><span class="lab-cartridge">${sides}${front}</span></span>`;
  const img = document.createElement("img"); img.src = ep.image || FALLBACK; img.alt = ""; img.draggable = false;
  if (miniature) img.loading = "lazy";
  img.onerror = () => { img.onerror = null; img.src = FALLBACK; };
  art.querySelector(".lab-cart-picture").append(img);
  return art;
}

