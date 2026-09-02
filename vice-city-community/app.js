const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => item.addEventListener('click', e => {
  e.preventDefault();
  navItems.forEach(i => i.classList.remove('active'));
  item.classList.add('active');
  const label = item.textContent.replace(/\d+/g,'').trim();
  const channel = document.querySelector('.topbar strong');
  if (channel) channel.textContent = label.replace(/^#\s*/, '');
}));

document.querySelectorAll('.post-actions button').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.style.transform = 'scale(.96)';
    setTimeout(() => btn.style.transform = '', 120);
  });
});
