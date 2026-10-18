/* Design Hours Estimator: application (Preact + htm). */
(function () {
  'use strict';
  var P = window.preact, H = window.preactHooks, E = window.Engine;
  var mount = document.getElementById('app');
  if (!P || !H || !window.htm || !E) {
    mount.innerHTML = '<div class="notice"><h1>The estimator could not load</h1><p>A required script did not load. Check your connection and reload the page.</p></div>';
    return;
  }
  var h = P.h, render = P.render;
  var useState = H.useState, useEffect = H.useEffect, useMemo = H.useMemo, useRef = H.useRef, useCallback = H.useCallback, useLayoutEffect = H.useLayoutEffect || H.useEffect;
  var html = window.htm.bind(h);
