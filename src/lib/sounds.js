export function playSound(type = "click") {
  const sounds = {
    pick: "/sounds/pick.mp3",
    reveal: "/sounds/reveal.mp3",
    warning: "/sounds/warning.mp3",
    start: "/sounds/start.mp3",
  };

  const src = sounds[type];
  if (!src) return;

  try {
    const audio = new Audio(src);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}