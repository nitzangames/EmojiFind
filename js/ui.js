// Settings modal controller. Reads/writes via save.js.
function initSettings() {
  const backdrop = document.getElementById('settings-backdrop');
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('settings-close');
  const sound = document.getElementById('settings-sound');
  const haptics = document.getElementById('settings-haptics');
  const reset = document.getElementById('settings-reset');
  const confirm = document.getElementById('settings-reset-confirm');
  const yes = document.getElementById('settings-reset-yes');
  const no = document.getElementById('settings-reset-no');

  function refresh() {
    const s = getSave();
    sound.checked = !!s.settings.sound;
    haptics.checked = !!s.settings.haptics;
    confirm.hidden = true;
  }
  function show() {
    state.priorMode = state.mode;
    state.mode = 'settings';
    refresh();
    backdrop.hidden = false; modal.hidden = false;
  }
  function hide() {
    backdrop.hidden = true; modal.hidden = true;
    if (state.priorMode) { state.mode = state.priorMode; state.priorMode = null; }
    else if (state.levelData) { state.mode = 'inGame'; }
    else { state.mode = 'loading'; }
  }

  backdrop.addEventListener('click', hide);
  closeBtn.addEventListener('click', hide);
  sound.addEventListener('change', () => { getSave().settings.sound = sound.checked; writeSave(); });
  haptics.addEventListener('change', () => { getSave().settings.haptics = haptics.checked; writeSave(); });
  reset.addEventListener('click', () => { confirm.hidden = false; });
  no.addEventListener('click', () => { confirm.hidden = true; });
  yes.addEventListener('click', () => {
    resetSave();
    hide();
    startLevel(1);
  });

  // Expose `openSettings` to input.js.
  window.openSettings = show;
}
