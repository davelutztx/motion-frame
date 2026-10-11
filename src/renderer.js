'use strict';
const $ = id => document.getElementById(id);
let photo = null;
let selected = 0;
let original = false;
let busy = false;
let saving = false;
let playing = false;
let timer;
let dragDepth = 0;
let previewReady = false;
let lastWheel = 0;
const api = window.motionFrame;

function timecode(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
function notify(message, error = false, reveal = false) {
  $('notice-text').textContent = message;
  $('notice').classList.toggle('error', error);
  $('reveal').hidden = !reveal;
  $('notice').hidden = false;
}
function controls() {
  const hasFrames = photo?.count > 0 && !original;
  $('save').disabled = !hasFrames || busy || saving || !previewReady;
  $('previous').disabled = !hasFrames || selected === 0;
  $('next').disabled = !hasFrames || selected === photo.count - 1;
  $('play').disabled = !hasFrames || photo.count < 2;
  $('scrubber').disabled = !hasFrames;
  $('jump').disabled = !hasFrames;
  $('open').disabled = busy || saving;
  $('dropzone').disabled = busy || saving;
  $('play').textContent = playing ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', playing ? 'Pause motion' : 'Play motion');
}
function stop() { playing = false; clearTimeout(timer); controls(); }
function render(scroll = true) {
  if (!photo) return;
  const source = original ? photo.original : photo.frames[selected];
  if ($('preview').getAttribute('src') !== source) {
    previewReady = false;
    $('preview').src = source;
  }
  $('preview').alt = original ? 'Original still photo' : `Motion photo frame ${selected + 1} of ${photo.count}`;
  $('preview-badge').textContent = original ? 'ORIGINAL STILL' : `FRAME ${String(selected + 1).padStart(3, '0')}`;
  $('motion-tab').classList.toggle('active', !original);
  $('original-tab').classList.toggle('active', original);
  $('selection-title').textContent = original ? 'Original photo' : `Frame ${selected + 1}`;
  $('selection-description').textContent = original
    ? (photo.kind === 'still' ? 'This JPG has no embedded motion clip. Try the original file from your phone.' : 'The original still image. Choose Motion frames to save a moment from the clip.')
    : 'A single moment from your motion photo.';
  $('dimensions').textContent = original ? 'Original resolution' : `${photo.width} × ${photo.height}`;
  $('timecode').textContent = original ? 'ORIGINAL STILL' : timecode(photo.timestamps[selected]);
  $('position').textContent = original ? '—' : `${photo.timestamps[selected].toFixed(3)} s`;
  $('frame-counter').textContent = original ? 'STILL PHOTO' : `${selected + 1} / ${photo.count}`;
  $('jump').value = selected + 1;
  $('scrubber').value = selected;
  const active = $('filmstrip').querySelector('.active');
  active?.classList.remove('active');
  active?.setAttribute('aria-pressed', 'false');
  if (!original) {
    const button = $('filmstrip').children[selected];
    button?.classList.add('active');
    button?.setAttribute('aria-pressed', 'true');
    if (scroll && button) {
      const strip = $('filmstrip');
      const left = button.offsetLeft - strip.offsetLeft;
      if (left < strip.scrollLeft || left + button.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = left - strip.clientWidth / 2 + button.offsetWidth / 2;
    }
  }
  controls();
}
function select(index, pause = true) {
  if (!photo?.count || busy) return;
  if (pause) stop();
  original = false;
  selected = Math.max(0, Math.min(photo.count - 1, Math.round(index)));
  render();
}
function install(result) {
  photo = result;
  selected = 0;
  original = !photo.count;
  if (photo.presentationSeconds !== null && photo.count) {
    selected = photo.timestamps.reduce((best, time, index) => Math.abs(time - photo.presentationSeconds) < Math.abs(photo.timestamps[best] - photo.presentationSeconds) ? index : best, 0);
  }
  $('empty').hidden = true;
  $('workspace').hidden = false;
  $('filename').textContent = photo.name;
  $('filename').title = photo.name;
  $('kind').textContent = photo.kind === 'motion' ? 'MOTION PHOTO' : photo.kind === 'video' ? 'VIDEO' : 'STILL PHOTO';
  const end = photo.timestamps.at(-1) || 0;
  const lastDelta = photo.count > 1 ? Math.max(0, end - photo.timestamps.at(-2)) : 0;
  $('summary').textContent = photo.count ? `${photo.count} frames · ${(end + lastDelta).toFixed(2)} s` : 'No motion clip found';
  $('original-tab').hidden = !photo.original;
  $('motion-tab').disabled = !photo.count;
  $('timeline').hidden = !photo.count;
  $('jump').max = photo.count;
  $('jump-total').textContent = `/ ${photo.count}`;
  $('scrubber').max = Math.max(0, photo.count - 1);
  const fragment = document.createDocumentFragment();
  photo.frames.forEach((source, index) => {
    const button = document.createElement('button');
    button.className = 'thumbnail';
    button.setAttribute('aria-label', `Frame ${index + 1}, ${photo.timestamps[index].toFixed(3)} seconds`);
    button.setAttribute('aria-pressed', 'false');
    const img = document.createElement('img');
    img.src = source;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = String(index + 1).padStart(3, '0');
    button.append(img, label);
    button.addEventListener('click', () => select(index));
    fragment.append(button);
  });
  $('filmstrip').replaceChildren(fragment);
  $('footer-status').textContent = photo.count ? 'ALL FRAMES READY · ORIGINAL PRESERVED' : 'STILL PHOTO · NO EMBEDDED MOTION';
  render();
}
async function load(action) {
  if (busy || saving) return;
  stop();
  busy = true;
  controls();
  $('notice').hidden = true;
  $('loading-progress').textContent = 'Reading your photo…';
  $('loading').hidden = false;
  try {
    const result = await action();
    if (!result.ok) throw new Error(result.error);
    if (result.value) install(result.value);
  } catch (error) {
    if (error.message !== 'Loading cancelled.') notify(error.message || 'Unable to open this file.', true);
  } finally {
    busy = false;
    $('loading').hidden = true;
    controls();
  }
}
function togglePlay() {
  if (!photo?.count || original || busy) return;
  if (playing) return stop();
  if (selected === photo.count - 1) select(0);
  playing = true;
  controls();
  function schedule() {
    if (!playing) return;
    if (selected >= photo.count - 1) return stop();
    const delay = Math.max(10, (photo.timestamps[selected + 1] - photo.timestamps[selected]) * 1000);
    timer = setTimeout(() => { if (playing) { select(selected + 1, false); schedule(); } }, delay);
  }
  schedule();
}
async function save() {
  if ($('save').disabled) return;
  stop();
  saving = true;
  controls();
  try {
    const result = await api.save(photo.id, selected);
    if (!result.ok) throw new Error(result.error);
    if (result.value) notify(`Saved ${result.value.name}`, false, true);
  } catch (error) { notify(error.message || 'Unable to save the frame.', true); }
  finally { saving = false; controls(); }
}
$('preview').addEventListener('load', () => {
  previewReady = true;
  if (original) $('dimensions').textContent = `${$('preview').naturalWidth} × ${$('preview').naturalHeight}`;
  controls();
});
$('preview').addEventListener('error', () => { previewReady = false; controls(); notify('This image could not be displayed. Try opening the original file again.', true); });
$('open').addEventListener('click', () => load(() => api.choose()));
$('dropzone').addEventListener('click', () => load(() => api.choose()));
$('cancel').addEventListener('click', () => api.cancel());
$('save').addEventListener('click', save);
$('reveal').addEventListener('click', () => api.reveal());
$('dismiss').addEventListener('click', () => { $('notice').hidden = true; });
$('previous').addEventListener('click', () => select(selected - 1));
$('next').addEventListener('click', () => select(selected + 1));
$('play').addEventListener('click', togglePlay);
$('scrubber').addEventListener('input', event => select(Number(event.target.value)));
$('jump').addEventListener('change', event => { const value = Number(event.target.value); if (Number.isFinite(value)) select(value - 1); });
$('motion-tab').addEventListener('click', () => select(selected));
$('original-tab').addEventListener('click', () => { stop(); original = true; render(); });
$('viewer').addEventListener('wheel', event => {
  if (!photo?.count || original || busy) return;
  event.preventDefault();
  if (performance.now() - lastWheel < 55 || event.deltaY === 0) return;
  lastWheel = performance.now();
  select(selected + Math.sign(event.deltaY));
}, { passive: false });
document.addEventListener('keydown', event => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'o') { event.preventDefault(); load(() => api.choose()); return; }
  if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); save(); return; }
  if (busy || saving || !photo?.count || event.target.tagName === 'INPUT') return;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePlay(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); select(selected - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); select(selected + 1); }
  if (event.key === 'Home') { event.preventDefault(); select(0); }
  if (event.key === 'End') { event.preventDefault(); select(photo.count - 1); }
});
window.addEventListener('dragenter', event => {
  event.preventDefault();
  if (event.dataTransfer.types.includes('Files') && !busy && !saving) { dragDepth++; $('drop-overlay').hidden = false; }
});
window.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = busy || saving ? 'none' : 'copy'; });
window.addEventListener('dragleave', event => { event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop-overlay').hidden = true; });
window.addEventListener('drop', event => {
  event.preventDefault();
  dragDepth = 0;
  $('drop-overlay').hidden = true;
  const files = event.dataTransfer.files;
  if (files.length > 1) return notify('Drop one photo at a time.', true);
  if (files.length === 1) load(() => api.drop(files[0]));
});
window.addEventListener('blur', () => { dragDepth = 0; $('drop-overlay').hidden = true; });
api.onProgress(count => { $('loading-progress').textContent = `${count} frames found…`; });
