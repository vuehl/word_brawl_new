// Self-contained fonts: no system installation or external font service needed.
export const GAME_FONT_FAMILY = 'Ziling Swei';
export const gameFontsReady = typeof document === 'undefined' ? Promise.resolve() : (async () => {
  const style=document.createElement('style');
  style.textContent=`
    @font-face{font-family:'Ziling Swei';src:url('/fonts/swei/SweiGothicCJKsc-Regular.ttf') format('truetype');font-style:normal;font-weight:100 500;font-display:swap}
    @font-face{font-family:'Ziling Swei';src:url('/fonts/swei/SweiGothicCJKsc-Bold.ttf') format('truetype');font-style:normal;font-weight:600 900;font-display:swap}
    html,body,body *,button,input,select,textarea{font-family:'Ziling Swei',sans-serif!important}
  `;
  document.head.append(style);
  await Promise.all([document.fonts.load('400 16px "Ziling Swei"'),document.fonts.load('700 16px "Ziling Swei"')]);
})();
