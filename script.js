(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;
  const gsapReady =
    typeof gsap !== 'undefined' &&
    typeof ScrollTrigger !== 'undefined';

  /* ========================================
     PRELOADER
  ======================================== */

  window.addEventListener('load', () => {
    setTimeout(() => {
      $('#preloader')?.classList.add('is-hidden');
    }, 350);
  });

  setTimeout(() => {
    $('#preloader')?.classList.add('is-hidden');
  }, 2400);


  /* ========================================
     SMOOTH SCROLL
  ======================================== */

  let lenis = null;

  if (!reduce && typeof Lenis !== 'undefined') {

    lenis = new Lenis({
      duration: 1.18,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.05
    });

    window.luluLenis = lenis;

    const raf = time => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };

    requestAnimationFrame(raf);
  }


  /* ========================================
     HEADER / MENU
  ======================================== */

  const menu = $('#menuPanel');
  const menuBtn = $('#menuBtn');

  const setMenu = open => {

    document.body.classList.toggle('menu-open', open);

    menu?.classList.toggle('is-open', open);
    menu?.setAttribute('aria-hidden', String(!open));

    menuBtn?.setAttribute('aria-expanded', String(open));

    if (lenis) {
      open ? lenis.stop() : lenis.start();
    }

    if (gsapReady) {

      gsap.to('.menu__bg', {
        scaleY: open ? 1 : 0,
        duration: 0.7,
        ease: 'power4.inOut',
        transformOrigin: open ? 'top' : 'bottom'
      });

      gsap.to('.menu nav a', {
        opacity: open ? 1 : 0,
        y: open ? 0 : 18,
        stagger: open ? 0.035 : 0,
        duration: open ? 0.5 : 0.2,
        delay: open ? 0.22 : 0,
        ease: 'power3.out'
      });
    }
  };


  menuBtn?.addEventListener('click', () => {

    setMenu(
      !document.body.classList.contains('menu-open')
    );

  });


  $$('.js-scroll').forEach(link => {

    link.addEventListener('click', event => {

      event.preventDefault();

      setMenu(false);

      const element = $(link.getAttribute('href'));

      if (!element) return;

      if (lenis) {

        lenis.scrollTo(element, {
          offset: 0,
          duration: 1.5
        });

      } else {

        element.scrollIntoView({
          behavior: 'smooth'
        });

      }

    });

  });


  /* ========================================
     CUSTOM CURSOR
  ======================================== */

  if (fine && !reduce) {

    const cursor = $('#cursor');

    let mouseX = innerWidth / 2;
    let mouseY = innerHeight / 2;

    let cursorX = mouseX;
    let cursorY = mouseY;


    addEventListener('mousemove', event => {

      mouseX = event.clientX;
      mouseY = event.clientY;

      cursor?.classList.add('is-visible');

    });


    addEventListener('mouseout', event => {

      if (!event.relatedTarget) {
        cursor?.classList.remove('is-visible');
      }

    });


    $$(
      'a,button,.facility-card,.metric,.why-grid article'
    ).forEach(element => {

      element.addEventListener('mouseenter', () => {
        cursor?.classList.add('is-active');
      });

      element.addEventListener('mouseleave', () => {
        cursor?.classList.remove('is-active');
      });

    });


    const cursorLoop = () => {

      cursorX += (mouseX - cursorX) * 0.16;
      cursorY += (mouseY - cursorY) * 0.16;

      if (cursor) {
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
      }

      requestAnimationFrame(cursorLoop);

    };

    cursorLoop();
  }


  /* ========================================
     PAGE PROGRESS / SECTION INDEX
  ======================================== */

  const header = $('#header');
  const pageProgress = $('#pageProgress');
  const activeIndex = $('#activeIndex');

  let lastY = 0;


  const updateChrome = () => {

    const y = scrollY;

    const max =
      document.documentElement.scrollHeight -
      innerHeight;


    if (pageProgress) {

      pageProgress.style.width =
        ((max ? y / max : 0) * 100) + '%';

    }


    header?.classList.toggle(
      'is-scrolled',
      y > 80
    );


    if (
      y > 260 &&
      y > lastY + 7 &&
      !document.body.classList.contains('menu-open')
    ) {

      header?.classList.add('is-hidden');

    } else if (
      y < lastY - 4 ||
      y < 260
    ) {

      header?.classList.remove('is-hidden');

    }


    lastY = y;


    let active = '01';

    $$('.section-anchor').forEach(element => {

      const rect =
        element.getBoundingClientRect();

      if (
        rect.top <= innerHeight * 0.55 &&
        rect.bottom >= innerHeight * 0.35
      ) {

        active =
          element.dataset.section ||
          active;

      }

    });


    if (activeIndex) {
      activeIndex.textContent = active;
    }

  };


  addEventListener(
    'scroll',
    updateChrome,
    { passive: true }
  );

  updateChrome();


  /* ========================================
     NUMBER COUNTERS
  ======================================== */

  const counted = new WeakSet();


  const countUp = element => {

    if (counted.has(element)) return;

    counted.add(element);

    const end =
      Number(element.dataset.count || 0);

    const start =
      performance.now();

    const duration = 1200;


    const step = now => {

      const progress =
        clamp(
          (now - start) / duration
        );

      const easing =
        1 -
        Math.pow(
          1 - progress,
          3
        );


      element.textContent =
        Math.round(
          end * easing
        ).toLocaleString('en-US');


      if (progress < 1) {
        requestAnimationFrame(step);
      }

    };


    requestAnimationFrame(step);
  };


  /* ========================================
     GSAP
  ======================================== */

  if (gsapReady && !reduce) {

    gsap.registerPlugin(ScrollTrigger);


    if (lenis) {
      lenis.on(
        'scroll',
        ScrollTrigger.update
      );
    }


    gsap.ticker.add(time => {
      lenis?.raf(time * 1000);
    });


    gsap.ticker.lagSmoothing(0);


    /* ========================================
       OPENING
    ======================================== */

    const opening =
      gsap.timeline({

        scrollTrigger: {
          trigger: '#openingStory',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.15
        }

      });


    opening

      .to(
        '.opening-hero__media img',
        {
          scale: 1.34,
          yPercent: -2,
          ease: 'none',
          duration: 1.25
        },
        0
      )

      .to(
        '.opening-hero__copy',
        {
          y: -120,
          scale: 0.9,
          opacity: 0,
          ease: 'power2.in',
          duration: 0.65
        },
        0.35
      )

      .to(
        '.scroll-hint',
        {
          opacity: 0,
          y: 20,
          duration: 0.25
        },
        0.18
      )

      .fromTo(
        '.opening-welcome',
        {
          clipPath:
            'inset(46% 45% round 32px)',
          scale: 0.62,
          opacity: 0.01
        },
        {
          clipPath:
            'inset(0% 0% round 0px)',
          scale: 1,
          opacity: 1,
          ease: 'power3.inOut',
          duration: 1
        },
        0.72
      )

      .fromTo(
        '.opening-welcome__media img',
        {
          scale: 1.2
        },
        {
          scale: 1.04,
          ease: 'none',
          duration: 1
        },
        0.72
      )

      .fromTo(
        '.opening-welcome__copy',
        {
          opacity: 0,
          y: 70
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out'
        },
        1.08
      )

      .fromTo(
        '.welcome-stats div',
        {
          opacity: 0,
          y: 25
        },
        {
          opacity: 1,
          y: 0,
          stagger: 0.08,
          duration: 0.45
        },
        1.22
      );


    /* ========================================
       REVEALS
    ======================================== */

    gsap.utils
      .toArray('.reveal')
      .forEach(element => {

        gsap.to(element, {

          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',

          scrollTrigger: {
            trigger: element,
            start: 'top 86%',
            once: true
          }

        });

      });


    gsap.utils
      .toArray('.reveal-card')
      .forEach(element => {

        gsap.to(element, {

          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',

          scrollTrigger: {
            trigger: element,
            start: 'top 90%',
            once: true
          }

        });

      });


    gsap.utils
      .toArray('.reveal-list')
      .forEach(list => {

        gsap.to(
          [...list.children],
          {

            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',

            scrollTrigger: {
              trigger: list,
              start: 'top 86%',
              once: true
            }

          }
        );

      });


    gsap.utils
      .toArray('.reveal-media')
      .forEach(wrapper => {

        const image =
          $('img', wrapper);

        if (!image) return;


        gsap.to(image, {

          scale: 1,
          duration: 1.25,
          ease: 'power3.out',

          scrollTrigger: {
            trigger: wrapper,
            start: 'top 88%',
            once: true
          }

        });

      });


    $$('[data-count]')
      .forEach(element => {

        ScrollTrigger.create({

          trigger: element,
          start: 'top 92%',
          once: true,

          onEnter: () =>
            countUp(element)

        });

      });


    gsap.to(
      '.property-orbit--1',
      {

        rotation: 80,
        y: 90,

        scrollTrigger: {
          trigger: '#property',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    gsap.to(
      '.property-orbit--2',
      {

        rotation: -70,
        y: -70,

        scrollTrigger: {
          trigger: '#property',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    /* ========================================
       EXPERIENCE
    ======================================== */

    const experience =
      gsap.timeline({

        scrollTrigger: {
          trigger: '#experienceStory',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.1
        }

      });


    experience

      .fromTo(
        '.exp-copy',
        {
          opacity: 0,
          y: 55
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.35
        },
        0
      )

      .fromTo(
        '.exp-card--a',
        {
          xPercent: -30,
          yPercent: 18,
          rotation: -10,
          scale: 0.78
        },
        {
          xPercent: 0,
          yPercent: 0,
          rotation: -4,
          scale: 1,
          duration: 0.55,
          ease: 'power3.out'
        },
        0
      )

      .fromTo(
        '.exp-card--b',
        {
          yPercent: 40,
          scale: 0.72
        },
        {
          yPercent: 0,
          scale: 1,
          duration: 0.62,
          ease: 'power3.out'
        },
        0.05
      )

      .fromTo(
        '.exp-card--c',
        {
          xPercent: 30,
          yPercent: 18,
          rotation: 10,
          scale: 0.78
        },
        {
          xPercent: 0,
          yPercent: 0,
          rotation: 4,
          scale: 1,
          duration: 0.55,
          ease: 'power3.out'
        },
        0
      )

      .to(
        '.exp-cards',
        {
          scale: 1.12,
          yPercent: -5,
          duration: 0.5,
          ease: 'power2.in'
        },
        0.62
      )

      .to(
        '.exp-copy',
        {
          opacity: 0,
          y: -55,
          duration: 0.35
        },
        0.64
      )

      .to(
        '.experience-panel',
        {
          opacity: 0.25,
          duration: 0.35
        },
        0.72
      )

      .fromTo(
        '.why-panel',
        {
          clipPath:
            'inset(50% 50% round 34px)',
          scale: 0.72,
          opacity: 0.01
        },
        {
          clipPath:
            'inset(0% 0% round 0px)',
          scale: 1,
          opacity: 1,
          duration: 0.75,
          ease: 'power4.inOut'
        },
        0.73
      )

      .fromTo(
        '.why-panel__media img',
        {
          scale: 1.22
        },
        {
          scale: 1.04,
          duration: 0.75,
          ease: 'none'
        },
        0.73
      )

      .fromTo(
        '.why-panel__inner',
        {
          opacity: 0,
          y: 50
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.4
        },
        1.02
      )

      .fromTo(
        '.why-grid article',
        {
          opacity: 0,
          y: 22
        },
        {
          opacity: 1,
          y: 0,
          stagger: 0.045,
          duration: 0.33
        },
        1.08
      );


    /* ========================================
       FLOOR PARALLAX
    ======================================== */

    gsap.to(
      '#ground .floor-media img',
      {

        yPercent: -9,
        ease: 'none',

        scrollTrigger: {
          trigger: '#ground',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    gsap.to(
      '#first .floor-media img',
      {

        yPercent: -9,
        ease: 'none',

        scrollTrigger: {
          trigger: '#first',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    /* ========================================
       RETAIL STORY
    ======================================== */

    const retail =
      gsap.timeline({

        scrollTrigger: {
          trigger: '#retailStory',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.1
        }

      });


    retail

      .to(
        '.retail-scene--hyper .retail-scene__media img',
        {
          scale: 1.28,
          yPercent: -3,
          duration: 1,
          ease: 'none'
        },
        0
      )

      .to(
        '.retail-scene--hyper .retail-scene__copy',
        {
          x: -60,
          opacity: 0.2,
          duration: 0.38
        },
        0.62
      )

      .fromTo(
        '.retail-scene--tenant',
        {
          clipPath:
            'inset(0 100% 0 0)'
        },
        {
          clipPath:
            'inset(0 0% 0 0)',
          duration: 0.62,
          ease: 'power4.inOut'
        },
        0.7
      )

      .fromTo(
        '.retail-scene--tenant .retail-scene__media img',
        {
          scale: 1.18,
          xPercent: 7
        },
        {
          scale: 1.02,
          xPercent: 0,
          duration: 0.7,
          ease: 'none'
        },
        0.7
      )

      .fromTo(
        '.retail-scene--tenant .retail-scene__copy',
        {
          opacity: 0,
          x: -70
        },
        {
          opacity: 1,
          x: 0,
          duration: 0.4
        },
        0.96
      )

      .to(
        '.retail-scene--tenant .retail-scene__copy',
        {
          opacity: 0.2,
          x: -45,
          duration: 0.35
        },
        1.55
      )

      .fromTo(
        '.retail-scene--food',
        {
          clipPath:
            'circle(0% at 50% 50%)'
        },
        {
          clipPath:
            'circle(78% at 50% 50%)',
          duration: 0.7,
          ease: 'power4.inOut'
        },
        1.62
      )

      .fromTo(
        '.retail-scene--food .retail-scene__media img',
        {
          scale: 1.34
        },
        {
          scale: 1.04,
          duration: 0.74,
          ease: 'none'
        },
        1.62
      )

      .fromTo(
        '.retail-scene--food .retail-scene__copy',
        {
          opacity: 0,
          y: 65
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.42
        },
        1.9
      )

      .to(
        '.retail-scene--food .retail-scene__media img',
        {
          scale: 1.13,
          duration: 0.55,
          ease: 'none'
        },
        2.35
      );


    /* ========================================
       3D WALKTHROUGH

       IMPORTANT:
       NO scale / zoom is applied to the video.
       This prevents JS from cropping the video.
    ======================================== */

    const walkthrough =
      gsap.timeline({

        scrollTrigger: {

          trigger: '#walkthrough',

          start: 'top top',

          end: 'bottom bottom',

          scrub: 1.2

        }

      });


    walkthrough

      .fromTo(
        '#walkthroughBackgroundVideo',
        {
          opacity: 0.9
        },
        {
          opacity: 1,
          duration: 0.35,
          ease: 'none'
        },
        0
      )

      .fromTo(
        '.walkthrough-ring',
        {
          scale: 0.7,
          opacity: 0
        },
        {
          scale: 1,
          opacity: 1,
          duration: 0.35
        },
        0
      )

      .to(
        '.walkthrough-ring',
        {
          scale: 2.2,
          opacity: 0,
          duration: 0.58,
          ease: 'power2.in'
        },
        0.43
      )

      .to(
        '.walkthrough-copy',
        {
          scale: 1.06,
          y: -70,
          opacity: 0,
          duration: 0.45,
          ease: 'power2.in'
        },
        0.58
      )

      .to(
        '.walkthrough-veil',
        {
          backgroundColor:
            'rgba(12,10,8,.76)',
          duration: 0.35
        },
        0.66
      );


    /* ========================================
       ACCESS / FUTURE / FOOTER
    ======================================== */

    gsap.to(
      '#access .access-media img',
      {

        yPercent: -7,
        ease: 'none',

        scrollTrigger: {
          trigger: '#access',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    gsap.to(
      '#future .future__image img',
      {

        yPercent: -8,
        ease: 'none',

        scrollTrigger: {
          trigger: '#future',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    gsap.to(
      '.footer__media img',
      {

        scale: 1.08,
        ease: 'none',

        scrollTrigger: {
          trigger: '#contact',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }

      }
    );


    ScrollTrigger.refresh();

  } else {

    /* ========================================
       NO GSAP FALLBACK
    ======================================== */

    const observer =
      new IntersectionObserver(
        entries => {

          entries.forEach(entry => {

            if (!entry.isIntersecting) return;

            entry.target.style.opacity = 1;
            entry.target.style.transform = 'none';

            if (
              entry.target.matches(
                '[data-count]'
              )
            ) {

              countUp(entry.target);

            }

          });

        },
        {
          threshold: 0.12
        }
      );


    $$(
      '.reveal,.reveal-card,[data-count]'
    ).forEach(element => {

      observer.observe(element);

    });

  }


  /* ========================================
     WALKTHROUGH MODAL / FULLSCREEN
  ======================================== */

  const walkthroughUrl = '';

  const modal =
    $('#walkthroughModal');

  const modalVideo =
    $('#walkthroughModalVideo');


  $('#walkthroughBtn')
    ?.addEventListener(
      'click',
      () => {

        if (walkthroughUrl) {

          window.open(
            walkthroughUrl,
            '_blank',
            'noopener'
          );

          return;
        }


        document.body.classList.add(
          'modal-open'
        );


        modal?.classList.add(
          'is-open'
        );


        modal?.setAttribute(
          'aria-hidden',
          'false'
        );


        lenis?.stop();


        if (!modalVideo) return;


        modalVideo.currentTime = 0;

        modalVideo.muted = false;

        modalVideo.controls = true;


        modalVideo
          .play()
          .catch(() => {});


        if (
          modalVideo.requestFullscreen
        ) {

          modalVideo
            .requestFullscreen()
            .catch(() => {});

        }

        else if (
          modalVideo.webkitRequestFullscreen
        ) {

          modalVideo
            .webkitRequestFullscreen();

        }

        else if (
          modalVideo.webkitEnterFullscreen
        ) {

          modalVideo
            .webkitEnterFullscreen();

        }

      }
    );


  /* ========================================
     CLOSE MODAL
  ======================================== */

  const closeModal = () => {

    if (modalVideo) {

      modalVideo.pause();

      modalVideo.currentTime = 0;

    }


    document.body.classList.remove(
      'modal-open'
    );


    modal?.classList.remove(
      'is-open'
    );


    modal?.setAttribute(
      'aria-hidden',
      'true'
    );


    if (
      !document.body.classList.contains(
        'menu-open'
      )
    ) {

      lenis?.start();

    }

  };


  $('#walkthroughClose')
    ?.addEventListener(
      'click',
      closeModal
    );


  modal?.addEventListener(
    'click',
    event => {

      if (event.target === modal) {
        closeModal();
      }

    }
  );


  addEventListener(
    'keydown',
    event => {

      if (event.key === 'Escape') {

        closeModal();

        setMenu(false);

      }

    }
  );

})();