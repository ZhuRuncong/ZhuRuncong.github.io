/* Allen's Portfolio — hero typewriter, terminal playback, scroll reveal,
   and the screenshot lightbox for the closed-source project.

   Every line of text lives in the markup. This script reads it out, blanks
   the element and types it back in, so the page is complete and readable
   with JavaScript switched off. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- helpers */

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* Empties `el` of its own text, keeping any caret, and hands back what it
     held. Only direct text children count, so the caret's own space is not
     swept up and typed back in. */
  function drain(el) {
    var text = '';

    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) { return; }
      text += node.nodeValue;
      el.removeChild(node);
    });

    return text;
  }

  /* Types `text` into `el` one character at a time, in front of the caret. */
  function type(el, text, speed) {
    var caret = el.querySelector('.caret');
    var i = 0;

    return new Promise(function (resolve) {
      (function step() {
        if (i >= text.length) { resolve(); return; }
        var ch = document.createTextNode(text.charAt(i));
        if (caret) { el.insertBefore(ch, caret); } else { el.appendChild(ch); }
        i += 1;
        setTimeout(step, speed);
      })();
    });
  }

  /* Every caret runs the same 1s blink, but a caret inside a statement that
     was display:none only starts its timeline when the statement appears —
     so it lands out of phase with the hero's, which began at load. Pinning
     each one to the hero animation's startTime blinks them in step. */
  function syncCarets(attempt) {
    var carets = document.querySelectorAll('.caret');
    if (carets.length < 2 || !carets[0].getAnimations) { return; }

    var reference = carets[0].getAnimations()[0];
    if (!reference) { return; }

    /* startTime is null until the animation is ready; wait a frame for it. */
    if (reference.startTime === null) {
      if ((attempt || 0) < 5) {
        requestAnimationFrame(function () { syncCarets((attempt || 0) + 1); });
      }
      return;
    }

    Array.prototype.slice.call(carets, 1).forEach(function (caret) {
      caret.getAnimations().forEach(function (animation) {
        animation.startTime = reference.startTime;
      });
    });
  }

  /* ------------------------------------------------------- hero + terminal */

  function play() {
    var title = document.querySelector('.hero-title');
    var statements = Array.prototype.slice.call(
      document.querySelectorAll('.statement')
    );

    if (reduceMotion) { return; }

    var name = title ? drain(title) : '';

    /* Stash each terminal line, then hide the whole block until its turn. */
    var lines = statements.map(function (statement) {
      var input = statement.querySelector('.input-statement');
      var output = statement.querySelector('.return-statement');
      var text = input ? drain(input) : '';
      if (output) { output.hidden = true; }
      statement.hidden = true;
      return { statement: statement, input: input, output: output, text: text };
    });

    var chain = title ? type(title, name, 70) : Promise.resolve();

    chain.then(function () {
      return lines.reduce(function (previous, line, idx) {
        return previous
          .then(function () { return wait(idx === 0 ? 320 : 170); })
          .then(function () {
            line.statement.hidden = false;
            requestAnimationFrame(function () { syncCarets(0); });
            if (!line.input) { return wait(120); }
            return type(line.input, line.text, 26);
          })
          .then(function () {
            if (!line.output) { return null; }
            return wait(130).then(function () { line.output.hidden = false; });
          });
      }, Promise.resolve());
    });
  }

  /* ------------------------------------------------------------ scroll reveal */

  function watchReveals() {
    var targets = document.querySelectorAll('.reveal');

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -80px 0px', threshold: 0.05 });

    Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
  }

  /* ----------------------------------------------------------------- lightbox */

  function setUpLightbox() {
    var box = document.getElementById('lightbox');
    if (!box) { return; }

    var img = box.querySelector('.lightbox-figure img');
    var caption = box.querySelector('.lightbox-caption');
    var counter = box.querySelector('.lightbox-counter');
    var shots = [];
    var index = 0;
    var lastFocus = null;

    function render() {
      var shot = shots[index];
      if (!shot) { return; }
      img.src = shot.src;
      img.alt = shot.alt;
      caption.textContent = shot.alt;
      counter.textContent = (index + 1) + ' / ' + shots.length;
    }

    function open(trigger) {
      try {
        shots = JSON.parse(trigger.getAttribute('data-shots'));
      } catch (err) {
        return;
      }
      index = 0;
      lastFocus = trigger;
      render();
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      box.querySelector('.lightbox-close').focus();
    }

    function close() {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) { lastFocus.focus(); }
    }

    function step(delta) {
      if (!shots.length) { return; }
      index = (index + delta + shots.length) % shots.length;
      render();
    }

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-shots]'),
      function (trigger) {
        trigger.addEventListener('click', function (event) {
          event.preventDefault();
          open(trigger);
        });
      }
    );

    box.addEventListener('click', function (event) {
      if (event.target === box || event.target.closest('[data-close]')) { close(); return; }
      if (event.target.closest('[data-prev]')) { step(-1); return; }
      if (event.target.closest('[data-next]')) { step(1); }
    });

    document.addEventListener('keydown', function (event) {
      if (!box.classList.contains('open')) { return; }
      if (event.key === 'Escape') { close(); }
      if (event.key === 'ArrowLeft') { step(-1); }
      if (event.key === 'ArrowRight') { step(1); }
    });
  }

  /* --------------------------------------------------------------------- go */

  function start() {
    var year = document.getElementById('year');
    if (year) { year.textContent = String(new Date().getFullYear()); }
    play();
    watchReveals();
    setUpLightbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
