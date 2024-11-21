const links = document.querySelectorAll<HTMLAnchorElement>('.sublink');

links.forEach(s => {
  s.addEventListener('click', (e) => {
    e.preventDefault();
    const section = document.querySelector(s.hash);
      section?.scrollIntoView({
        behavior: 'smooth'
      });
  })
})