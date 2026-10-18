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

  // ------------------------------------------------------------------ icons
  var ICONS = {
    sun: '<path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/>',
    moon: '<path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"/>',
    monitor: '<path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z"/>',
    globe: '<path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/>',
    smartphone: '<path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z"/>',
    layout: '<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V88H40V56Zm0,144H40V104H216v96Z"/>',
    pen: '<path d="M248,92.68a15.86,15.86,0,0,0-4.69-11.31L174.63,12.68a16,16,0,0,0-22.63,0L123.57,41.11l-58,21.77A16.06,16.06,0,0,0,55.35,75.23L32.11,214.68A8,8,0,0,0,40,224a8.4,8.4,0,0,0,1.32-.11l139.44-23.24a16,16,0,0,0,12.35-10.17l21.77-58L243.31,104A15.87,15.87,0,0,0,248,92.68Zm-69.87,92.19L63.32,204l47.37-47.37a28,28,0,1,0-11.32-11.32L52,192.7,71.13,77.86,126,57.29,198.7,130ZM112,132a12,12,0,1,1,12,12A12,12,0,0,1,112,132Zm96-15.32L139.31,48l24-24L232,92.68Z"/>',
    film: '<path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,88h80v80H40Zm96-16V56h32V72Zm-16,0H88V56h32Zm0,112v16H88V184Zm16,0h32v16H136Zm0-16V88h80v80Zm80-96H184V56h32ZM72,56V72H40V56ZM40,184H72v16H40Zm176,16H184V184h32v16Z"/>',
    box: '<path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/>',
    palette: '<path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Zm13,93.71A15.89,15.89,0,0,1,198.21,160H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,194.3,40,164,40,128a88,88,0,0,1,87.09-88h.9a88.35,88.35,0,0,1,88,87.25A88.86,88.86,0,0,1,213.81,147.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76ZM96,100A12,12,0,1,1,84,88,12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z"/>',
    chart: '<path d="M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z"/>',
    plus: '<path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>',
    minus: '<path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"/>',
    x: '<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>',
    check: '<path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>',
    logout: '<path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/>',
    users: '<path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z"/>',
    upload: '<path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z"/>',
    chevD: '<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/>',
    chevR: '<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/>',
    arrowL: '<path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/>',
    arrowR: '<path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>',
    arrowUR: '<path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/>',
    up: '<path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z"/>',
    down: '<path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,11.32-11.32L120,196.69V40a8,8,0,0,1,16,0V196.69l58.34-58.35a8,8,0,0,1,11.32,11.32Z"/>',
    info: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/>',
    bulb: '<path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z"/>',
    download: '<path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>',
    copy: '<path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/>',
    trash: '<path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"/>',
    search: '<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>',
    sliders: '<path d="M64,105V40a8,8,0,0,0-16,0v65a32,32,0,0,0,0,62v49a8,8,0,0,0,16,0V167a32,32,0,0,0,0-62Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,56,152Zm80-95V40a8,8,0,0,0-16,0V57a32,32,0,0,0,0,62v97a8,8,0,0,0,16,0V119a32,32,0,0,0,0-62Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,128,104Zm104,64a32.06,32.06,0,0,0-24-31V40a8,8,0,0,0-16,0v97a32,32,0,0,0,0,62v17a8,8,0,0,0,16,0V199A32.06,32.06,0,0,0,232,168Zm-32,16a16,16,0,1,1,16-16A16,16,0,0,1,200,184Z"/>',
    book: '<path d="M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z"/>',
    list: '<path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"/>',
    lock: '<path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z"/>',
    refresh: '<path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/>',
    alert: '<path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z"/>',
    eye: '<path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>',
    eyeOff: '<path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z"/>',
    pack: '<path d="M224,48H32A16,16,0,0,0,16,64V88a16,16,0,0,0,16,16v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48V104H208ZM224,88H32V64H224V88ZM96,136a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,136Z"/>',
    file: '<path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"/>',
    devices: '<path d="M224,72H208V64a24,24,0,0,0-24-24H40A24,24,0,0,0,16,64v96a24,24,0,0,0,24,24H152v8a24,24,0,0,0,24,24h48a24,24,0,0,0,24-24V96A24,24,0,0,0,224,72ZM40,168a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8v8H176a24,24,0,0,0-24,24v72Zm192,24a8,8,0,0,1-8,8H176a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Zm-96,16a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h40A8,8,0,0,1,136,208Zm80-96a8,8,0,0,1-8,8H192a8,8,0,0,1,0-16h16A8,8,0,0,1,216,112Z"/>',
    languages: '<path d="M247.15,212.42l-56-112a8,8,0,0,0-14.31,0l-21.71,43.43A88,88,0,0,1,108,126.93,103.65,103.65,0,0,0,135.69,64H160a8,8,0,0,0,0-16H104V32a8,8,0,0,0-16,0V48H32a8,8,0,0,0,0,16h87.63A87.76,87.76,0,0,1,96,116.35a87.74,87.74,0,0,1-19-31,8,8,0,1,0-15.08,5.34A103.63,103.63,0,0,0,84,127a87.55,87.55,0,0,1-52,17,8,8,0,0,0,0,16,103.46,103.46,0,0,0,64-22.08,104.18,104.18,0,0,0,51.44,21.31l-26.6,53.19a8,8,0,0,0,14.31,7.16L148.94,192h70.11l13.79,27.58A8,8,0,0,0,240,224a8,8,0,0,0,7.15-11.58ZM156.94,176,184,121.89,211.05,176Z"/>',
    theme: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,16.37a86.4,86.4,0,0,1,16,3V212.67a86.4,86.4,0,0,1-16,3Zm32,9.26a87.81,87.81,0,0,1,16,10.54V195.83a87.81,87.81,0,0,1-16,10.54ZM40,128a88.11,88.11,0,0,1,80-87.63V215.63A88.11,88.11,0,0,1,40,128Zm160,50.54V77.46a87.82,87.82,0,0,1,0,101.08Z"/>',
    sparkles: '<path d="M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z"/>',
    shield: '<path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"/>',
    gauge: '<path d="M207.06,72.67A111.24,111.24,0,0,0,128,40h-.4C66.07,40.21,16,91,16,153.13V176a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V152A111.25,111.25,0,0,0,207.06,72.67ZM224,176H119.71l54.76-75.3a8,8,0,0,0-12.94-9.42L99.92,176H32V153.13c0-3.08.15-6.12.43-9.13H56a8,8,0,0,0,0-16H35.27c10.32-38.86,44-68.24,84.73-71.66V80a8,8,0,0,0,16,0V56.33A96.14,96.14,0,0,1,221,128H200a8,8,0,0,0,0,16h23.67c.21,2.65.33,5.31.33,8Z"/>',
    layers: '<path d="M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z"/>',
    table: '<path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM40,112H80v32H40Zm56,0H216v32H96ZM216,64V96H40V64ZM40,160H80v32H40Zm176,32H96V160H216v32Z"/>',
    checkCircle: '<path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>',
    xCircle: '<path d="M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>',
    link: '<path d="M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,16,.45A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z"/>',
    folder: '<path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z"/>',
    clock: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/>',
  };
  // Duotone filled icons for services (reference: category table with two-tone icons).
  var DUO = {
    globe: '<path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z" opacity="0.2"/><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/>',
    smartphone: '<path d="M192,56V200H64V56Z" opacity="0.2"/><path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z"/>',
    layout: '<path d="M224,56V96H32V56a8,8,0,0,1,8-8H216A8,8,0,0,1,224,56Z" opacity="0.2"/><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V88H40V56Zm0,144H40V104H216v96Z"/>',
    pen: '<path d="M128,48,68.32,70.38a8,8,0,0,0-5.08,6.17L40,216l139.45-23.24a8,8,0,0,0,6.17-5.08L208,128Zm-4,104a20,20,0,1,1,20-20A20,20,0,0,1,124,152Z" opacity="0.2"/><path d="M248,92.68a15.86,15.86,0,0,0-4.69-11.31L174.63,12.68a16,16,0,0,0-22.63,0L123.57,41.11l-58,21.77A16.06,16.06,0,0,0,55.35,75.23L32.11,214.68A8,8,0,0,0,40,224a8.4,8.4,0,0,0,1.32-.11l139.44-23.24a16,16,0,0,0,12.35-10.17l21.77-58L243.31,104A15.87,15.87,0,0,0,248,92.68Zm-69.87,92.19L63.32,204l47.37-47.37a28,28,0,1,0-11.32-11.32L52,192.7,71.13,77.86,126,57.29,198.7,130ZM112,132a12,12,0,1,1,12,12A12,12,0,0,1,112,132Zm96-15.32L139.31,48l24-24L232,92.68Z"/>',
    film: '<path d="M32,176H224v24a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8ZM216,48H40a8,8,0,0,0-8,8V80H224V56A8,8,0,0,0,216,48Z" opacity="0.2"/><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,88h80v80H40Zm96-16V56h32V72Zm-16,0H88V56h32Zm0,112v16H88V184Zm16,0h32v16H136Zm0-16V88h80v80Zm80-96H184V56h32ZM72,56V72H40V56ZM40,184H72v16H40Zm176,16H184V184h32v16Z"/>',
    palette: '<path d="M224,127.17a96.48,96.48,0,0,1-2.39,22.18A24,24,0,0,1,198.21,168H152a24,24,0,0,0-24,24,24,24,0,0,1-32,22.61C58.73,201.44,32,169.81,32,128a96,96,0,0,1,95-96C179.84,31.47,223.55,74.35,224,127.17Z" opacity="0.2"/><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Zm13,93.71A15.89,15.89,0,0,1,198.21,160H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,194.3,40,164,40,128a88,88,0,0,1,87.09-88h.9a88.35,88.35,0,0,1,88,87.25A88.86,88.86,0,0,1,213.81,147.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76ZM96,100A12,12,0,1,1,84,88,12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z"/>',
    chart: '<path d="M208,40V208H152V40Z" opacity="0.2"/><path d="M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z"/>',
    box: '<path d="M128,129.09V232a8,8,0,0,1-3.84-1l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,.7-3.25Z" opacity="0.2"/><path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/>',
  };
  var SERVICE_ICONS = ['globe', 'smartphone', 'layout', 'pen', 'film', 'palette', 'chart', 'box'];
  var COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'teal', 'red', 'yellow'];
  var ICON_COLOR = { globe: 'blue', smartphone: 'green', layout: 'purple', pen: 'pink', film: 'orange', palette: 'pink', chart: 'teal', box: 'yellow' };
  var GROUP_STYLE = { responsive: ['devices', 'blue'], platforms: ['devices', 'blue'], localization: ['languages', 'green'], theming: ['theme', 'purple'], deliverables: ['sparkles', 'orange'], quality: ['shield', 'teal'], concepts: ['sparkles', 'orange'], applications: ['layers', 'pink'] };
  var REG_STYLE = { assumptions: ['checkCircle', 'green'], exclusions: ['xCircle', 'red'], dependencies: ['link', 'blue'], risks: ['alert', 'orange'] };
  function svcColor(s) { return s && COLORS.indexOf(s.color) >= 0 ? s.color : (ICON_COLOR[(s && s.icon) || 'box'] || 'blue'); }
  function groupStyle(g, i) { var s = GROUP_STYLE[g.id]; return s ? { icon: s[0], color: s[1] } : { icon: 'sliders', color: COLORS[(i || 0) % COLORS.length] }; }
  function catColor(i) { return ['blue', 'green', 'orange', 'pink', 'purple', 'teal'][i % 6]; }

  var STEPS = [
    { id: 'service', n: 1, name: 'Service' }, { id: 'scope', n: 2, name: 'Scope' },
    { id: 'build', n: 3, name: 'Build' }, { id: 'review', n: 4, name: 'Review' },
  ];
  var FALLBACK_SETTINGS = { agencyName: '', bufferPercent: 10, complexity: E.DEFAULT_COMPLEXITY, overhead: [], phases: ['Phase 1'], defaultAssumptions: [], defaultExclusions: [] };
  var RULES = [
    { value: 'none', label: 'No extra hours' }, { value: 'percent', label: '% of base design' },
    { value: 'fixed', label: 'Fixed hours' }, { value: 'perItem', label: 'Hours per item' },
  ];
  var VENDOR = window.DHE_VENDOR || null;
  var EXCEL_URLS = VENDOR ? [VENDOR.exceljs] : ['https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'];

  // ------------------------------------------------------------------ helpers
  var local = {
    get: function (k, d) { try { var v = localStorage.getItem('dhe:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dhe:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  function clean(o) { var c = JSON.parse(JSON.stringify(o)); delete c.id; return c; }
  function newId(prefix) { return (prefix || 'est') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function uniqueId(base, taken) { var b = E.slug(base), id = b, i = 2; while (taken.indexOf(id) >= 0) id = b + '-' + (i++); return id; }
  function ago(ts) {
    if (!ts) return '';
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 86400 * 7) { var d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago'); }
    var dt = new Date(ts);
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: dt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function plural(n, one, many) { return (n === 1 ? one : many); }
  function lower(s) { return String(s || '').toLowerCase(); }
  function loadScript(urls) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      (function next() {
        if (i >= urls.length) { reject(new Error('The spreadsheet library did not load. Check your connection and try again.')); return; }
        var s = document.createElement('script');
        s.src = urls[i++]; s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { s.remove(); next(); };
        document.head.appendChild(s);
      })();
    });
  }
  var DOCX_URLS = VENDOR ? [VENDOR.docx] : ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', 'https://unpkg.com/docx@8.5.0/build/index.umd.js'];
  function loadDocx() { return window.docx ? Promise.resolve(window.docx) : loadScript(DOCX_URLS).then(function () { if (!window.docx) throw new Error('The document library did not load. Check your connection and try again.'); return window.docx; }); }
  function loadExcel() { return window.ExcelJS ? Promise.resolve(window.ExcelJS) : loadScript(EXCEL_URLS).then(function () { return window.ExcelJS; }); }
  function useProfiles(user, ids) {
    var key = ids.slice().sort().join(',');
    var st = useState({}), map = st[0], setMap = st[1];
    useEffect(function () {
      if (!user || !ids.length) return;
      var live = true;
      user.profiles(ids).then(function (m) { if (live) setMap(m || {}); }).catch(function () { /* reads never reject */ });
      return function () { live = false; };
    }, [user, key]);
    return map;
  }

  // ------------------------------------------------------------------ small components
  function Icon(p) {
    var size = p.size || 16;
    return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[p.name] || ICONS.box }}></svg>`;
  }
  function Duo(p) {
    var size = p.size || 18;
    return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: DUO[p.name] || DUO.box }}></svg>`;
  }
  function Tile(p) {
    var cls = 'tile' + (p.size ? ' ' + p.size : '') + ' t-' + (p.color || 'gray');
    var px = p.size === 'sm' ? 14 : p.size === 'lg' ? 20 : 17;
    return html`<span class=${cls} aria-hidden="true">${p.duo ? html`<${Duo} name=${p.icon} size=${px + 2} />` : html`<${Icon} name=${p.icon} size=${px} />`}</span>`;
  }
  function SvcTile(p) { var s = p.svc || {}; return html`<${Tile} duo icon=${s.icon || 'box'} color=${s.icon ? svcColor(s) : 'gray'} size=${p.size} />`; }
  function CardHead(p) {
    return html`<div class="panel-head">
      ${p.icon ? html`<${Tile} icon=${p.icon} color=${p.color} duo=${p.duo} />` : null}
      <div><h2>${p.title}</h2>${p.desc ? html`<p>${p.desc}</p>` : null}</div>
      ${p.right || null}
    </div>`;
  }
  function BrandLogo(p) {
    var size = p && p.size;
    return html`<span class="brand-logo" style=${size ? 'font-size:' + size + 'px' : ''} aria-label="Revin">Revin</span>`;
  }
  function BrandMark(p) {
    return BrandLogo(p);
  }
  // Display text from data: trimmed, with a fallback when blank (a name of only spaces reads as missing).
  function nm(v, fb) { var t = String(v == null ? '' : v).trim(); return t || fb; }
  function statusOf(id) {
    var k = id || 'draft';
    return E.STATUSES.filter(function (x) { return x.id === k; })[0] || { id: 'other', name: String(k).charAt(0).toUpperCase() + String(k).slice(1) };
  }
  // Initials from whole characters (grapheme clusters), first + last word, ignoring Jr/III suffixes and emoji.
  function firstChar(w) {
    w = w.replace(/^[^\p{L}\p{N}]+/u, '');
    try { var it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(w)[Symbol.iterator]().next(); return it.done ? '' : it.value.segment; } catch (e) { return Array.from(w)[0] || ''; }
  }
  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); });
    if (words.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(words[words.length - 1])) words.pop();
    if (!words.length) return '?';
    return (firstChar(words[0]) + (words.length > 1 ? firstChar(words[words.length - 1]) : '')).toUpperCase();
  }
  // Avatar with an initials fallback for a missing or failing image.
  function Avatar(p) {
    var sf = useState(false), failed = sf[0], setFailed = sf[1];
    var cls = 'av' + (p.sm ? ' sm' : '');
    if (!p.url || failed) return html`<span class=${cls + ' ini'} title=${p.title || null} aria-hidden="true">${initials(p.name)}</span>`;
    return html`<img class=${cls} src=${p.url} alt="" title=${p.title || null} onError=${function () { setFailed(true); }} />`;
  }
  // A title field that wraps instead of hiding the end of a long name.
  function TitleText(p) {
    var ref = useRef(null);
    function fit() { var el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    useEffect(fit, [p.value]);
    useEffect(function () { window.addEventListener('resize', fit); return function () { window.removeEventListener('resize', fit); }; }, []);
    return html`<textarea ref=${ref} rows="1" class=${p.cls} id=${p.id} maxlength=${p.max} aria-label=${p.label} placeholder=${p.placeholder} value=${p.value}
      onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
      onInput=${function (e) { var v = e.target.value.replace(/[\r\n]+/g, ' '); if (v !== e.target.value) e.target.value = v; fit(); p.onInput(v); }}></textarea>`;
  }
  function Hrs(p) {
    var cls = 'hrs' + (p.ghost ? ' ghost' : '') + (p.soft ? ' soft' : '') + (p.lg ? ' lg' : '');
    return html`<span class=${cls}>${E.fmtHours(p.v)}</span>`;
  }
  function Stepper(p) {
    var step = p.step || 0.5, min = p.min === undefined ? 0 : p.min, max = p.max === undefined ? 1000 : p.max;
    var whole = p.whole !== undefined ? p.whole : (step === 1 && p.unit !== '%');
    var value = E.num(p.value);
    var st = useState(E.plainNum(value)), text = st[0], setText = st[1];
    var focused = useRef(false);
    // Outside changes (steppers, other viewers) update the field, but never while someone is typing in it.
    useEffect(function () { if (!focused.current) setText(E.plainNum(value)); }, [value]);
    function parse(raw) { var n = parseFloat(String(raw).replace(',', '.')); return isFinite(n) ? (whole ? Math.round(n) : Math.round(n * 100) / 100) : null; }
    function live(raw) { var n = parse(raw); if (n !== null && n >= min && n <= max && n !== value) p.onChange(n); }
    function commit(raw) {
      var n = parse(raw);
      if (n === null) n = value;
      n = Math.min(max, Math.max(min, n));
      setText(E.plainNum(n));
      if (n !== value) p.onChange(n);
    }
    function bump(d) { p.onChange(Math.min(max, Math.max(min, Math.round((value + d) * 100) / 100))); }
    return html`<span class="stepper">
      <button type="button" aria-label=${'Decrease ' + (p.label || '')} disabled=${p.disabled || value <= min} onClick=${function () { bump(-step); }}><${Icon} name="minus" size=${12} /></button>
      <span class="stepper-val">
        <input id=${p.id} inputmode="decimal" aria-label=${p.label || 'Value'} value=${text} disabled=${p.disabled}
          style=${{ width: Math.max(1, (text || '').length) + 'ch' }}
          onFocus=${function () { focused.current = true; }}
          onInput=${function (e) { setText(e.target.value); live(e.target.value); }}
          onBlur=${function (e) { focused.current = false; commit(e.target.value); }}
          onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(e.target.value); } }} />
        ${p.unit ? html`<span class="unit">${p.unit}</span>` : null}
      </span>
      <button type="button" aria-label=${'Increase ' + (p.label || '')} disabled=${p.disabled || value >= max} onClick=${function () { bump(step); }}><${Icon} name="plus" size=${12} /></button>
    </span>`;
  }
  function Switch(p) {
    return html`<span class="switch"><input type="checkbox" role="switch" id=${p.id} aria-label=${p.label} checked=${!!p.checked} disabled=${p.disabled} onChange=${function (e) { p.onChange(e.target.checked); }} /></span>`;
  }
  function Seg(p) {
    return html`<div class=${'seg ' + (p.cls || '')} role="group" aria-label=${p.label}>
      ${p.options.map(function (o) {
        return html`<button type="button" key=${o.value} data-v=${o.value} title=${o.title || ''} aria-pressed=${o.value === p.value ? 'true' : 'false'} onClick=${function () { p.onChange(o.value); }}>${o.label}</button>`;
      })}
    </div>`;
  }
  // A textarea that grows with its text, so long lines are never clipped.
  function AutoText(p) {
    var ref = useRef(null);
    function fit() { var el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
    useEffect(fit, [p.value]);
    return html`<textarea ref=${ref} class="input auto-text" rows="1" maxlength="1000" id=${p.id} aria-label=${p.label} placeholder=${p.placeholder || ''} value=${p.value} onInput=${function (e) { fit(); p.onInput(e); }}></textarea>`;
  }
  function StringList(p) {
    var st = useState(''), text = st[0], setText = st[1];
    var se = useState(''), err = se[0], setErr = se[1];
    var values = p.values || [];
    function dup(t, skip) { return p.unique && values.some(function (v, j) { return j !== skip && String(v).trim().toLowerCase() === t.toLowerCase(); }); }
    return html`<div class="str-list">
      ${values.map(function (v, i) {
        return html`<div class="str-row" key=${i}>
          <${AutoText} id=${p.idPrefix + '-' + i} label=${p.label + ' ' + (i + 1)} value=${v} onInput=${function (e) { var n = values.slice(); n[i] = e.target.value; p.onChange(n); }} />
          <button type="button" class="icon-btn danger" aria-label=${'Remove ' + p.label + ' ' + (i + 1)} onClick=${function () { p.onChange(values.filter(function (_, j) { return j !== i; })); }}><${Icon} name="trash" /></button>
        </div>`;
      })}
      <form class="str-row" onSubmit=${function (e) { e.preventDefault(); var t = text.trim(); if (!t) return; if (dup(t)) { setErr(t + ' is already in the list.'); return; } setErr(''); p.onChange(values.concat(t)); setText(''); }}>
        <input class="input" id=${p.idPrefix + '-new'} maxlength="1000" placeholder=${p.placeholder} value=${text} onInput=${function (e) { setText(e.target.value); setErr(''); }} />
        <button class="btn" type="submit"><${Icon} name="plus" /> Add</button>
      </form>
      ${err ? html`<span class="hint" role="alert" style="color:var(--red-fg)">${err}</span>` : null}
      ${p.unique && values.some(function (v, i) { return v.trim() && dup(v.trim(), i); }) ? html`<span class="hint" role="alert" style="color:var(--red-fg)">The same name appears twice. Duplicates are merged when you save.</span>` : null}
    </div>`;
  }
  function Modal(p) {
    // the opener is captured during the first render and focus moves in before the browser paints,
    // so even an instant second key press lands inside the dialog
    var box = useRef(null), ok = useRef(null), opener = useRef(document.activeElement);
    var sc = useState(false), closing = sc[0], setClosing = sc[1];
    // Dismissal plays a short exit; confirming acts at once.
    var dismiss = useRef(null);
    dismiss.current = function () { if (closing) return; setClosing(true); setTimeout(p.onClose, 140); };
    useLayoutEffect(function () {
      var prev = opener.current;
      if (ok.current) ok.current.focus();
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); dismiss.current(); return; }
        if (e.key !== 'Tab' || !box.current) return;
        var f = Array.prototype.slice.call(box.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1], act = document.activeElement;
        if (!box.current.contains(act)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && act === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
      }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ } };
    }, []);
    return html`<div class=${'modal-scrim' + (closing ? ' closing' : '')} onClick=${function (e) { if (e.target === e.currentTarget) dismiss.current(); }}>
      <div class="modal" ref=${box} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${p.title}</h2>
        ${p.body ? html`<p>${p.body}</p>` : null}
        <div class="row">
          <button class="btn ghost" type="button" onClick=${function () { dismiss.current(); }}>Cancel</button>
          <button ref=${ok} class=${'btn ' + (p.danger ? 'danger solid' : 'primary')} type="button" onClick=${function () { p.onClose(); p.onConfirm(); }}>${p.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>`;
  }
  function Notice(p) {
    return html`<div class="notice">
      <div class="brand-mark"><${BrandMark} /></div>
      <h1>${p.title}</h1>
      <p>${p.children}</p>
    </div>`;
  }

  // ------------------------------------------------------------------ files
  async function saveFile(ctx, filename, blob) {
    var dl = ctx.caps && ctx.caps.downloads;
    if (dl) {
      try { await dl.save({ filename: filename, data: blob }); ctx.toast('Saved ' + filename); }
      catch (e) {
        var code = e && e.code;
        if (code === 'declined') return;
        if (code === 'rate_limited') ctx.toast('A save prompt is already open. Finish it, then try again.', 'bad');
        else if (code === 'extension_not_enabled') ctx.toast('This file type is turned off here. Try the other export format.', 'bad');
        else ctx.toast('The file could not be saved here. Open the estimator in claude.ai and try again.', 'bad');
      }
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var fileBase = E.fileBase;
  var DOC_LIMIT = 262144;
  var EST_PAGE = 500;
  function byteSize(o) { try { return new TextEncoder().encode(JSON.stringify(o)).length; } catch (e) { return 0; } }
  function norm(d) { return E.clone(E.normalize(d)); }

  // Three-way merge for when a teammate saves while you have unsaved edits: anything you changed
  // since the last stored version wins, everything you did not touch takes their version.
  // Lists of rows with a key/id (items, deliverables, register entries) merge row by row.
  function sameJ(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function isPlain(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function rowKey(x) { return isPlain(x) ? ((typeof x.key === 'string' && x.key) || (typeof x.id === 'string' && x.id) || null) : null; }
  function keyedRows(a) { return Array.isArray(a) && a.every(function (x) { return rowKey(x) !== null; }); }
  function merge3(b, l, r) {
    if (sameJ(l, b)) return r;
    if (sameJ(r, b) || sameJ(r, l)) return l;
    if (isPlain(b) && isPlain(l) && isPlain(r)) {
      var out = {}, ks = Object.create(null);
      Object.keys(l).concat(Object.keys(r)).forEach(function (k) { ks[k] = 1; });
      Object.keys(ks).forEach(function (k) { var v = merge3(b[k], l[k], r[k]); if (v !== undefined) out[k] = v; });
      return out;
    }
    if (keyedRows(b) && keyedRows(l) && keyedRows(r)) {
      var bm = Object.create(null), rm = Object.create(null), seenK = Object.create(null), res = [];
      b.forEach(function (x) { bm[rowKey(x)] = x; });
      r.forEach(function (x) { rm[rowKey(x)] = x; });
      l.forEach(function (x) {
        var k = rowKey(x);
        if (seenK[k]) return;
        if (bm[k] && !rm[k] && sameJ(x, bm[k])) return; // they removed a row you did not touch
        seenK[k] = 1;
        res.push(bm[k] && rm[k] ? merge3(bm[k], x, rm[k]) : x);
      });
      r.forEach(function (x) { var k = rowKey(x); if (!seenK[k] && !bm[k]) { seenK[k] = 1; res.push(x); } }); // rows they added
      return res;
    }
    return l;
  }

  // ================================================================== App
  function App() {
    var s1 = useState('loading'), phase = s1[0], setPhase = s1[1];
    var s2 = useState(null), caps = s2[0], setCaps = s2[1];
    var s3 = useState(null), me = s3[0], setMe = s3[1];
    var s4 = useState('estimator'), role = s4[0], setRole = s4[1];
    var s5 = useState(false), readOnly = s5[0], setReadOnly = s5[1];
    var s6 = useState(null), services = s6[0], setServices = s6[1];
    var s7 = useState(null), settingsDoc = s7[0], setSettingsDoc = s7[1];
    var s8 = useState(null), estimates = s8[0], setEstimates = s8[1];
    var s9 = useState(function () { var r = local.get('route', null); return r && r.view ? r : { view: 'estimates' }; }), route = s9[0], setRouteState = s9[1];
    var s10 = useState([]), toasts = s10[0], setToasts = s10[1];
    var s11 = useState(null), dialog = s11[0], setDialog = s11[1];
    var s14 = useState(null), sampleFn = s14[0], setSampleFn = s14[1];
    var sTheme = useState(function () { try { return localStorage.getItem('dhe_theme') || 'system'; } catch (e) { return 'system'; } }), theme = sTheme[0], setTheme = sTheme[1];
    var roleRef = useRef(role); roleRef.current = role;

    useEffect(function () {
      if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('dhe_theme', theme); } catch (e) {}
    }, [theme]);
    useEffect(function () {
      function onExtChange() {
        var t = localStorage.getItem('dhe_theme') || 'system';
        setTheme(function (cur) { return cur === t ? cur : t; });
      }
      window.addEventListener('themechange', onExtChange);
      window.addEventListener('storage', onExtChange);
      return function () {
        window.removeEventListener('themechange', onExtChange);
        window.removeEventListener('storage', onExtChange);
      };
    }, []);
    var toggleTheme = useCallback(function () {
      setTheme(function (cur) {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        return isDark ? 'light' : 'dark';
      });
    }, []);

    var toast = useCallback(function (text, kind, action) {
      var id = Math.random();
      setToasts(function (t) { if (!action && t.some(function (x) { return x.text === text; })) return t; return t.concat({ id: id, text: text, kind: kind, action: action }).slice(-3); });
      var life = kind === 'bad' ? 6500 : action ? 6000 : 3200;
      setTimeout(function () { setToasts(function (t) { return t.map(function (x) { return x.id === id ? Object.assign({}, x, { leaving: true }) : x; }); }); }, life - 180);
      setTimeout(function () { setToasts(function (t) { return t.filter(function (x) { return x.id !== id; }); }); }, life);
    }, []);
    var setRoute = useCallback(function (r) {
      setRouteState(r);
      local.set('route', { view: r.view, id: r.id, step: r.step, serviceId: r.serviceId, tab: r.tab });
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    }, []);

    // A listener the platform ends with "unavailable" only comes back by subscribing again,
    // so each live query re-subscribes with back-off before telling the person to reload.
    function watch(make, onData) {
      var tries = 0, un = null, t = null, stopped = false;
      function start() {
        if (stopped) return;
        try { un = make().onSnapshot(function (snap) { tries = 0; onData(snap); }, onErr); } catch (e) { onErr(e); }
      }
      function onErr(e) {
        var code = e && e.code;
        if (stopped) return;
        if (code === 'revoked') { setPhase('revoked'); return; }
        try { if (un) un(); } catch (x) { /* already ended */ }
        un = null;
        if (tries < 5 && code !== 'invalid_argument' && code !== 'not_granted' && code !== 'capability_disabled' && code !== 'capability_removed') {
          tries++; t = setTimeout(start, Math.min(16000, 1000 * Math.pow(2, tries - 1)));
        } else toast('Lost the connection to the data store. Reload the page to reconnect.', 'bad');
      }
      start();
      return function () { stopped = true; clearTimeout(t); try { if (un) un(); } catch (e) { /* ignore */ } };
    }
    useEffect(function () {
      var unsubs = [], live = true;
      (async function () {
        if (!window.claude || typeof window.claude.use !== 'function') { setPhase('outside'); return; }
        var got = await Promise.all(['db', 'user', 'downloads', 'team'].map(function (n) { return window.claude.use(n).catch(function () { return null; }); }));
        if (!live) return;
        var db = got[0], user = got[1], downloads = got[2], team = got[3];
        if (!db) { setPhase('signedout'); return; }
        var meV = null, isAdmin = false, canWrite = null;
        if (user) {
          var r = await Promise.all([user.me(), user.canEdit(), user.can('data.write')]);
          meV = r[0]; isAdmin = !!r[1]; canWrite = r[2];
        }
        var rl = isAdmin ? 'admin' : (canWrite === false ? 'none' : 'estimator');
        setCaps({ db: db, user: user, downloads: downloads, team: team }); setMe(meV); setRole(rl); setPhase('ready');
        // Claude in the page (brief analyzer). Resolved on its own so a slow "no" never delays the app.
        window.claude.use('sample').then(function (sm) { if (live && sm) setSampleFn(function () { return sm; }); }).catch(function () { /* hidden */ });
        if (rl === 'none') return;
        unsubs.push(watch(function () { return db.collection('services'); }, function (snap) {
          var m = {}; snap.docs.forEach(function (d) { m[d.id] = E.normalizeService(d.data()); }); setServices(m);
        }));
        unsubs.push(watch(function () { return db.doc('config/settings'); }, function (snap) { setSettingsDoc(snap.exists ? snap.data() : false); }));
      })();
      return function () { live = false; unsubs.forEach(function (u) { try { u(); } catch (e) { /* ignore */ } }); };
    }, []);

    // Estimates load newest first, a page at a time; "Show more" raises the limit.
    var s12 = useState(EST_PAGE), estLimit = s12[0], setEstLimit = s12[1];
    var s13 = useState(false), hasMore = s13[0], setHasMore = s13[1];
    useEffect(function () {
      if (!caps || !caps.db || role === 'none') return;
      return watch(function () { return caps.db.collection('estimates').orderBy('updatedAt', 'desc').limit(estLimit + 1); }, function (snap) {
        setHasMore(snap.docs.length > estLimit);
        setEstimates(snap.docs.slice(0, estLimit).map(function (d) { return Object.assign({}, d.data(), { id: d.id }); }));
      });
    }, [caps, role, estLimit]);

    var api = useMemo(function () {
      if (!caps) return null;
      var chains = {};
      function report(e, size) {
        var code = e && e.code;
        if (code === 'invalid_argument' || code === 'transform_error') {
          if (size > DOC_LIMIT * 0.9) toast('This could not be saved because it is close to the 256 KB size limit (' + Math.ceil(size / 1024) + ' KB). Remove some items or long notes.', 'bad');
          else if (roleRef.current !== 'admin') { setReadOnly(true); toast('Your access level does not allow saving changes. Ask the owner for Contributor access.', 'bad'); }
          else toast('That change could not be saved. Reload the page and try again.', 'bad');
        } else if (code === 'quota_exceeded') toast('Storage is full. Delete old estimates to make room.', 'bad');
        else if (code === 'resource_exhausted') toast('Saving is busy right now. Your latest changes will be saved on your next edit.', 'bad');
        else if (code === 'revoked') setPhase('revoked');
        else toast('Changes could not be saved. Check your connection and try again.', 'bad');
      }
      async function attempt(fn, size) {
        try { await fn(); return true; } catch (e) {
          var code = e && e.code;
          if (code === 'unavailable' || code === 'resource_exhausted' || !code) {
            await new Promise(function (r) { setTimeout(r, (code === 'resource_exhausted' ? 1500 : 400) + Math.random() * 600); });
            try { await fn(); return true; } catch (e2) { report(e2, size); return false; }
          }
          report(e, size); return false;
        }
      }
      return {
        set: function (path, data) {
          var size = byteSize(data);
          if (size > DOC_LIMIT) {
            var kb = Math.ceil(size / 1024);
            toast(path.indexOf('estimates/') === 0 ? 'This estimate is too large to save (' + kb + ' KB of 256 KB). Remove some items or long notes, or split it into two estimates.' : 'This is too large to save (' + kb + ' KB of 256 KB). Remove some content and try again.', 'bad');
            return Promise.resolve(false);
          }
          var p = (chains[path] || Promise.resolve()).then(function () { return attempt(function () { return caps.db.doc(path).set(data); }, size); });
          chains[path] = p.catch(function () { return false; });
          return p;
        },
        del: function (path) { return attempt(function () { return caps.db.doc(path).delete(); }); },
      };
    }, [caps]);

    var serviceList = useMemo(function () {
      if (!services) return null;
      return Object.keys(services).map(function (id) { return Object.assign({}, services[id], { id: id }); })
        .sort(function (a, b) { return (E.num(a.order) - E.num(b.order)) || String(a.name).localeCompare(String(b.name)); });
    }, [services]);

    var confirm = useCallback(function (d) { setDialog(d); }, []);
    var settings = useMemo(function () { return E.normalizeSettings(settingsDoc || FALLBACK_SETTINGS); }, [settingsDoc]);

    async function startEstimate(svc, name, client) {
      var est = E.createEstimate(svc, svc.id, settings, { name: String(name || '').trim() || (svc.name + ' estimate'), client: String(client || '').trim(), userId: me && me.id });
      var id = newId();
      var ok = await api.set('estimates/' + id, clean(est));
      if (ok) setRoute({ view: 'estimate', id: id, step: 'scope', initial: est });
      return ok;
    }
    async function duplicateEstimate(src) {
      var id = newId(), now = Date.now();
      var copy = clean(src);
      Object.assign(copy, { name: (src.name || 'Untitled estimate') + ' (copy)', status: 'draft', createdAt: now, updatedAt: now, createdBy: (me && me.id) || null, updatedBy: (me && me.id) || null });
      var ok = await api.set('estimates/' + id, copy);
      if (ok) toast('Duplicated ' + (src.name || 'estimate'));
    }
    function deleteEstimate(est) {
      confirm({
        title: 'Delete ' + nm(est.name, 'this estimate') + '?', body: 'This removes it for everyone and cannot be undone.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: async function () {
          var ok = await api.del('estimates/' + est.id);
          if (ok) {
            toast('Deleted ' + nm(est.name, 'estimate'));
            try { var vs = await caps.db.collection('estimates/' + est.id + '/versions').get(); vs.docs.forEach(function (d) { api.del('estimates/' + est.id + '/versions/' + d.id); }); } catch (e) { /* versions are best effort */ }
          }
        },
      });
    }

    var ctx = {
      caps: caps, api: api, me: me, role: role, readOnly: readOnly, services: services, serviceList: serviceList,
      settings: settings, settingsDoc: settingsDoc, estimates: estimates, toast: toast, confirm: confirm,
      theme: theme, setTheme: setTheme, toggleTheme: toggleTheme,
      route: route, setRoute: setRoute, hasMore: hasMore, sample: sampleFn, moreEstimates: function () { setEstLimit(function (n) { return n + EST_PAGE; }); }, startEstimate: startEstimate, duplicateEstimate: duplicateEstimate, deleteEstimate: deleteEstimate,
    };

    if (phase === 'loading') return html`<${Loading} />`;
    if (phase === 'outside') return html`<${Notice} title="Open the estimator in Claude">The estimator keeps its library and estimates in Claude, so it works when opened from claude.ai or the Claude app.<//>`;
    if (phase === 'signedout') return html`<${Notice} title="Sign in to use the estimator">Sign in to claude.ai, then open this page again. Your library and estimates load once you're signed in.<//>`;
    if (phase === 'revoked') return html`<${Notice} title="Access to the estimator changed">Reload the page to continue.<//>`;
    if (role === 'none') return html`<${Notice} title="You have view-only access">Ask the owner for Contributor access to create estimates, or Editor access to manage the library.<//>`;

    var view;
    var isAdmin = role === 'admin';
    if (route.view === 'new') view = html`<${NewEstimate} ctx=${ctx} />`;
    else if (route.view === 'estimate' && route.id) view = html`<${EstimateEditor} key=${route.id} ctx=${ctx} />`;
    else if (route.view === 'library' && isAdmin) view = html`<${LibraryView} ctx=${ctx} />`;
    else if (route.view === 'settings' && isAdmin) view = html`<${SettingsView} ctx=${ctx} />`;
    else view = html`<${EstimatesView} ctx=${ctx} />`;

    return html`
      <div class="shell">
        <${Sidebar} ctx=${ctx} />
        <main class="main"><div class="wrap">
          ${readOnly ? html`<div class="banner bad" style="margin-bottom:16px"><${Icon} name="lock" /><div class="grow"><b>View only.</b> Your changes are not being saved. Ask the owner for Contributor access.</div></div>` : null}
          <${Boundary} resetKey=${route.view + ':' + (route.id || route.serviceId || '')} onHome=${function () { setRoute({ view: 'estimates' }); }}>${view}<//>
        </div></main>
      </div>
      ${dialog ? html`<${Modal} ...${dialog} onClose=${function () { setDialog(null); }} />` : null}
      <div class="toasts" role="status" aria-live="polite">
        ${toasts.map(function (t) {
          return html`<div class=${'toast ' + (t.kind || '') + (t.leaving ? ' leaving' : '')} key=${t.id}><span>${t.text}</span>${t.action ? html`<button class="btn sm light" style="height:26px" onClick=${function () { t.action.fn(); setToasts(function (x) { return x.filter(function (q) { return q.id !== t.id; }); }); }}>${t.action.label}</button>` : null}</div>`;
        })}
      </div>`;
  }

  function Boundary(p) {
    var eb = H.useErrorBoundary ? H.useErrorBoundary(function (err) { try { console.warn('Estimator view error:', err); } catch (e) { /* ignore */ } }) : [null, function () {}];
    var err = eb[0], reset = eb[1];
    // clear the error when the person navigates elsewhere, without remounting (and resetting) the view's state
    var last = useRef(p.resetKey);
    useEffect(function () { if (last.current !== p.resetKey) { last.current = p.resetKey; if (err) reset(); } }, [p.resetKey]);
    if (err) return html`<div class="panel"><div class="empty">
      <${Tile} size="lg" icon="alert" color="red" />
      <h2>Something went wrong showing this page</h2>
      <p>${String((err && err.message) || err).slice(0, 160)}</p>
      <div class="row" style="justify-content:center"><button class="btn" onClick=${function () { reset(); p.onHome(); }}>Back to estimates</button><button class="btn primary" onClick=${reset}>Try again</button></div>
    </div></div>`;
    return p.children;
  }

  function Loading() {
    return html`<div class="notice" aria-busy="true">
      <div class="brand-mark"><${BrandMark} /></div>
      <h1>Loading estimates and library</h1>
      <p>Connecting to your workspace.</p>
    </div>`;
  }

  // ------------------------------------------------------------------ theme switcher
  function ThemeSwitcher(p) {
    var ctx = p.ctx, current = ctx.theme || 'system';
    var options = [
      { id: 'system', icon: 'monitor', label: 'Match system' },
      { id: 'light', icon: 'sun', label: 'Light mode' },
      { id: 'dark', icon: 'moon', label: 'Dark mode' },
    ];
    return html`<div class="theme-switcher" role="radiogroup" aria-label="Color theme">
      ${options.map(function (opt) {
        var active = current === opt.id;
        return html`<button
          key=${opt.id}
          type="button"
          role="radio"
          aria-checked=${active ? 'true' : 'false'}
          aria-label=${opt.label}
          data-tooltip=${opt.label}
          title=${opt.label}
          onClick=${function () { ctx.setTheme(opt.id); }}>
          <${Icon} name=${opt.icon} size=${14} />
        </button>`;
      })}
    </div>`;
  }

  // ------------------------------------------------------------------ sidebar
  function Sidebar(p) {
    var ctx = p.ctx, route = ctx.route, me = ctx.me || {};
    var estActive = route.view === 'estimates' || route.view === 'new' || route.view === 'estimate';
    var recent = (ctx.estimates || []).slice(0, 5);
    var svcById = ctx.services || {};
    function tab(view, label, icon, color, active, count) {
      return html`<button class="navtab" aria-current=${active ? 'page' : null} onClick=${function () { ctx.setRoute({ view: view }); }}>
        <${Tile} size="sm" icon=${icon} color=${color} /><span class="lbl">${label}</span>${count !== undefined ? html`<span class="count">${count}</span>` : null}
      </button>`;
    }
    return html`<aside class="side" aria-label="Sidebar">
      <button class="side-brand" onClick=${function () { ctx.setRoute({ view: 'estimates' }); }} aria-label="Revin home">
        <${BrandLogo} size=${23} />
      </button>
      <button class="btn primary side-new" onClick=${function () { ctx.setRoute({ view: 'new' }); }}><${Icon} name="plus" /> New estimate</button>
      <div>
        <div class="side-label">Workspace</div>
        <nav class="side-nav" aria-label="Main">
          ${tab('estimates', 'Estimates', 'list', 'blue', estActive, ctx.estimates ? E.fmtNum(ctx.estimates.length) + (ctx.hasMore ? '+' : '') : undefined)}
          ${ctx.role === 'admin' ? tab('library', 'Library', 'book', 'purple', route.view === 'library', ctx.serviceList ? ctx.serviceList.length : undefined) : null}
          ${ctx.role === 'admin' ? tab('settings', 'Settings', 'sliders', 'orange', route.view === 'settings') : null}
        </nav>
      </div>
      ${recent.length ? html`<div class="recent">
        <div class="side-label">Recent</div>
        ${recent.map(function (e) {
          return html`<button class="recent-item" key=${e.id} title=${nm(e.name, 'Untitled estimate')} onClick=${function () { ctx.setRoute({ view: 'estimate', id: e.id, step: 'review' }); }}>
            <${SvcTile} size="sm" svc=${svcById[e.serviceId]} /><span><bdi>${nm(e.name, 'Untitled estimate')}</bdi></span>
          </button>`;
        })}
      </div>` : null}
      <div class="side-theme">
        <${ThemeSwitcher} ctx=${ctx} />
      </div>
      <div class="side-foot">
        <${Avatar} key=${me.avatarUrl || 'none'} url=${me.avatarUrl} name=${me.name || 'You'} />
        <div class="who-text"><div class="who-name" title=${nm(me.name, 'You')}><bdi>${nm(me.name, 'You')}</bdi></div></div>
        <span class=${'role ' + (ctx.role === 'admin' ? 'admin' : '')}>${ctx.role === 'admin' ? 'Admin' : 'Estimator'}</span>
        ${ctx.caps && ctx.caps.team ? html`<button class="icon-btn signout" aria-label="Sign out" title="Sign out" onClick=${function () { ctx.caps.team.signOut(); }}><${Icon} name="logout" /></button>` : null}
      </div>
    </aside>`;
  }

  // ------------------------------------------------------------------ estimates dashboard
  function StartCard(p) {
    var ctx = p.ctx;
    var sb = useState(null), busy = sb[0], setBusy = sb[1];
    var active = (ctx.serviceList || []).filter(function (s) { return s.active; });
    if (!active.length) return null;
    async function quick(svc) { if (busy) return; setBusy(svc.id); await ctx.startEstimate(svc); setBusy(null); }
    return html`<section class="panel hero-card">
      <button class="start-card" onClick=${function () { ctx.setRoute({ view: 'new' }); }}>
        <span class="pill new">${active.length} ${plural(active.length, 'service', 'services')}</span>
        <h2>Start an estimate</h2>
        <p>Pick a service, set the scope and tick what's in. The hours add up as you go.</p>
        <span class="go">Name it first <${Icon} name="arrowR" size=${14} /></span>
      </button>
      <div class="svc-menu">${active.map(function (svc) {
        return html`<button class="menu-item" key=${svc.id} disabled=${!!busy} onClick=${function () { quick(svc); }}>
          <${SvcTile} svc=${svc} />
          <span class="t"><b><bdi>${svc.name}</bdi></b><span>${busy === svc.id ? 'Creating estimate…' : svc.description}</span></span>
        </button>`;
      })}</div>
      <div class="menu-foot">
        <button class="link-arrow" onClick=${function () { ctx.setRoute({ view: 'new' }); }}>Name and start <${Icon} name="arrowUR" size=${13} /></button>
        ${ctx.role === 'admin' ? html`<button class="link-arrow" onClick=${function () { ctx.setRoute({ view: 'library' }); }}>Edit the library <${Icon} name="arrowUR" size=${13} /></button>` : null}
        ${ctx.role === 'admin' ? html`<button class="link-arrow" onClick=${function () { ctx.setRoute({ view: 'settings' }); }}>Overhead & buffer <${Icon} name="arrowUR" size=${13} /></button>` : null}
      </div>
    </section>`;
  }
  function EstimatesView(p) {
    var ctx = p.ctx, estimates = ctx.estimates;
    var sq = useState(local.get('q', '')), q = sq[0], setQ = sq[1];
    var ss = useState(local.get('status', 'all')), status = ss[0], setStatus = ss[1];
    var ids = useMemo(function () {
      var m = {}; (estimates || []).forEach(function (e) { if (e.createdBy) m[e.createdBy] = 1; }); return Object.keys(m);
    }, [estimates]);
    var profiles = useProfiles(ctx.caps && ctx.caps.user, ids);
    var svcById = ctx.services || {};

    var head = html`<div class="page-head">
      <div><h1>Estimates</h1><p>Every quote your team has scoped, with its hours, status and owner.</p></div>
      <button class="btn primary only-narrow" onClick=${function () { ctx.setRoute({ view: 'new' }); }}><${Icon} name="plus" /> New estimate</button>
    </div>`;
    if (estimates === null) {
      return html`${head}<div class="panel panel-pad stack" aria-busy="true"><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:55%"></div></div>`;
    }
    var noServices = ctx.serviceList && !ctx.serviceList.some(function (s) { return s.active; });
    if (!estimates.length) {
      return html`${head}<${StartCard} ctx=${ctx} /><div class="panel"><div class="empty first">
        <${Tile} size="lg" icon="list" color="blue" />
        <h2>No estimates yet</h2>
        <p>Pick a service, set the scope, tick the pages or features in scope and the hours add up as you go. Export to CSV or Excel when you're done.</p>
        ${noServices && ctx.role === 'admin' ? html`<button class="btn" onClick=${function () { ctx.setRoute({ view: 'library' }); }}><${Icon} name="book" /> Set up the library first</button>`
          : html`<button class="btn primary" onClick=${function () { ctx.setRoute({ view: 'new' }); }}><${Icon} name="plus" /> Create your first estimate</button>`}
      </div></div>`;
    }
    var counts = { all: estimates.length };
    E.STATUSES.forEach(function (s) { counts[s.id] = estimates.filter(function (e) { return (e.status || 'draft') === s.id; }).length; });
    var ql = q.trim().toLowerCase();
    var list = estimates.filter(function (e) {
      if (status !== 'all' && (e.status || 'draft') !== status) return false;
      if (!ql) return true;
      return lower(e.name).indexOf(ql) >= 0 || lower(e.client).indexOf(ql) >= 0 || lower(e.serviceName).indexOf(ql) >= 0;
    });
    var sum = list.reduce(function (s, e) { return s + E.num(e.totalHours); }, 0);
    return html`${head}
      <${StartCard} ctx=${ctx} />
      <section class="panel est-table">
        <div class="toolbar">
          <label class="search"><span class="sr">Search estimates</span><${Icon} name="search" />
            <input class="input" id="est-search" maxlength="100" placeholder="Search by name, client or service" value=${q} onInput=${function (e) { setQ(e.target.value); local.set('q', e.target.value); }} />
          </label>
          <div class="chips" role="group" aria-label="Filter by status">
            ${[{ id: 'all', name: 'All' }].concat(E.STATUSES).map(function (s) {
              return html`<button class="chip" key=${s.id} aria-pressed=${status === s.id ? 'true' : 'false'} onClick=${function () { setStatus(s.id); local.set('status', s.id); }}>${s.name} <span class="count">${E.fmtNum(counts[s.id])}</span></button>`;
            })}
          </div>
        </div>
        <div class="est-head" aria-hidden="true"><span>Estimate</span><span>Service</span><span>Status</span><span style="text-align:right">Hours</span><span>Updated</span><span></span><span></span></div>
        ${list.length ? list.map(function (e) {
          var svc = svcById[e.serviceId];
          var prof = e.createdBy ? profiles[e.createdBy] : null;
          var st = statusOf(e.status), ename = nm(e.name, 'Untitled estimate'), client = nm(e.client, '');
          function open() { ctx.setRoute({ view: 'estimate', id: e.id, step: 'review' }); }
          return html`<div class="est-row" key=${e.id} onClick=${function (ev) { if (!ev.target.closest('.est-actions, .est-open')) open(); }}>
            <div class="est-main"><${SvcTile} svc=${svc} /><button type="button" class="est-open est-name" title=${ename + (client ? ' (' + client + ')' : '')} onClick=${open}><bdi>${ename}</bdi>${client ? html` <span class="paren">(<bdi>${client}</bdi>)</span>` : null}</button></div>
            <div class="est-svc"><span title=${e.serviceName || ''}><bdi>${e.serviceName || ''}</bdi></span></div>
            <div><span class=${'pill s-' + st.id}>${st.name}</span></div>
            <div style="text-align:right"><${Hrs} v=${e.totalHours || 0} ghost=${!e.totalHours} /></div>
            <div class="est-when">${ago(e.updatedAt)}</div>
            <div>${prof ? html`<${Avatar} sm key=${prof.avatarUrl || 'none'} url=${prof.avatarUrl} name=${prof.name} title=${'Created by ' + nm(prof.name, 'a teammate')} />` : null}</div>
            <div class="est-actions">
              <button class="icon-btn" aria-label=${'Duplicate ' + ename} title="Duplicate" onClick=${function (ev) { ev.stopPropagation(); ctx.duplicateEstimate(e); }}><${Icon} name="copy" /></button>
              <button class="icon-btn danger" aria-label=${'Delete ' + ename} title="Delete" onClick=${function (ev) { ev.stopPropagation(); ctx.deleteEstimate(e); }}><${Icon} name="trash" /></button>
            </div>
          </div>`;
        }) : html`<div class="empty"><h2>No matching estimates</h2><p>Try another search or status.</p></div>`}
        ${ctx.hasMore ? html`<div class="est-more"><span class="muted" style="font-size:13px;margin-right:12px">Showing the ${E.fmtNum(estimates.length)} most recent estimates.</span><button class="btn sm" onClick=${ctx.moreEstimates}>Show ${E.fmtNum(500)} more</button></div>` : null}
        <div class="list-foot"><span>${E.fmtNum(list.length)} ${plural(list.length, 'estimate', 'estimates')}</span><span>Total <b class="tnum" style="color:var(--ink);font-weight:600">${E.fmtHours(sum)}</b></span></div>
      </section>`;
  }

  // ------------------------------------------------------------------ new estimate (step 1)
  function serviceStats(svc) {
    var l = Object.assign({}, E.DEFAULT_LABELS, svc.labels || {});
    var ni = (svc.items || []).length, ns = (svc.subItems || []).length;
    var out = [ni + ' ' + lower(plural(ni, l.item, l.items))];
    if (ns) out.push(ns + ' ' + lower(plural(ns, l.sub, l.subs)));
    return out;
  }
  function NewEstimate(p) {
    var ctx = p.ctx;
    var sn = useState(''), name = sn[0], setName = sn[1];
    var sc = useState(''), client = sc[0], setClient = sc[1];
    var sb = useState(null), busy = sb[0], setBusy = sb[1];
    var active = (ctx.serviceList || []).filter(function (s) { return s.active; });
    async function start(svc) {
      if (busy) return;
      setBusy(svc.id);
      await ctx.startEstimate(svc, name, client);
      setBusy(null);
    }
    return html`<div class="crumbs"><button onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}>Estimates</button><${Icon} name="chevR" size=${12} /><span>New estimate</span></div>
      <div class="page-head"><div><h1>New estimate</h1><p>Name it, then choose what you're estimating.</p></div></div>
      <div class="stack">
        <section class="panel panel-pad">
          <${CardHead} icon="file" color="blue" title="Details" desc="Shown on the dashboard and at the top of exports." />
          <div class="grid-2">
            <label class="field"><span>Estimate name</span><input class="input" id="new-name" maxlength="200" placeholder="e.g. Acme website redesign" value=${name} onInput=${function (e) { setName(e.target.value); }} /></label>
            <label class="field"><span>Client</span><input class="input" id="new-client" maxlength="200" placeholder="e.g. Acme Ltd" value=${client} onInput=${function (e) { setClient(e.target.value); }} /></label>
          </div>
        </section>
        <section class="panel panel-pad">
          <${CardHead} icon="layers" color="green" title="What are you estimating?" desc="The service decides which scope options and building blocks you get." />
          ${ctx.serviceList === null ? html`<div class="skeleton" style="width:50%"></div>`
          : active.length ? html`<div class="svc-grid">${active.map(function (svc) {
              return html`<button class="svc-card" key=${svc.id} disabled=${!!busy} onClick=${function () { start(svc); }}>
                <${SvcTile} svc=${svc} size="lg" />
                <span class="t">
                  <span class="svc-name">${svc.name}</span>
                  <span class="svc-desc">${busy === svc.id ? 'Creating estimate…' : svc.description}</span>
                  <span class="svc-stats">${serviceStats(svc).map(function (t) { return html`<span class="tag" key=${t}>${t}</span>`; })}</span>
                </span>
              </button>`;
            })}</div>`
          : html`<div class="empty"><h2>No services are set up yet</h2>
              ${ctx.role === 'admin' ? html`<p>Add a service such as Website or Mobile app in the library, with its pages or features and their hours.</p><button class="btn primary" onClick=${function () { ctx.setRoute({ view: 'library' }); }}><${Icon} name="book" /> Open the library</button>`
                : html`<p>Ask an admin to add services in the library.</p>`}
            </div>`}
        </section>
      </div>`;
  }

  // ================================================================== estimate editor
  function EstimateEditor(p) {
    var ctx = p.ctx, route = ctx.route, id = route.id;
    var remote = ctx.estimates ? ctx.estimates.filter(function (e) { return e.id === id; })[0] : null;
    var sd = useState(function () { return remote ? Object.assign(norm(remote), { id: id }) : (route.initial ? Object.assign(norm(route.initial), { id: id }) : null); });
    var raw = sd[0], setDraft = sd[1];
    var draft = useMemo(function () { return raw ? E.normalize(raw) : null; }, [raw]);
    var sv = useState('saved'), save = sv[0], setSave = sv[1];
    var sx = useState(null), exporting = sx[0], setExporting = sx[1];
    var sg = useState(false), gone = sg[0], setGone = sg[1];
    // latest: what you see; base: the last version known to be in the store (for merging a teammate's save);
    // mine: updatedAt stamps of our own writes, so their echo is not mistaken for someone else's change.
    var latest = useRef(raw), base = useRef(raw ? E.clone(raw) : null), mine = useRef([]);
    var timer = useRef(null), dirty = useRef(false), seen = useRef(!!remote), paused = useRef(false), goneRef = useRef(false);

    function schedule() {
      dirty.current = true; setSave('pending');
      clearTimeout(timer.current); timer.current = setTimeout(function () { flushRef.current(); }, 650);
    }
    var flushRef = useRef(null);

    useEffect(function () {
      if (!remote) {
        if (!seen.current || ctx.estimates === null || goneRef.current) return;
        // It left the live list. Hold autosave and check the store before treating it as deleted,
        // so an edit can never silently bring back an estimate a teammate removed.
        paused.current = true;
        var alive = true;
        Promise.resolve().then(function () { return ctx.caps.db.doc('estimates/' + id).get(); }).then(function (snap) {
          if (!alive) return;
          if (snap && snap.exists) { paused.current = false; if (dirty.current && !timer.current) schedule(); return; }
          clearTimeout(timer.current); timer.current = null;
          goneRef.current = true; setGone(true);
        }, function () { if (alive) { paused.current = false; if (dirty.current && !timer.current) schedule(); } });
        return function () { alive = false; };
      }
      seen.current = true;
      var resumed = paused.current || goneRef.current;
      paused.current = false;
      if (goneRef.current) { goneRef.current = false; setGone(false); }
      var r = Object.assign(norm(remote), { id: id });
      if (!latest.current) { latest.current = r; base.current = E.clone(r); setDraft(r); return; }
      if (mine.current.indexOf(r.updatedAt) >= 0) { base.current = r; if (resumed && dirty.current && !timer.current) schedule(); return; }
      if (base.current && sameJ(r, base.current)) { if (resumed && dirty.current && !timer.current) schedule(); return; }
      if (!dirty.current) { latest.current = r; base.current = E.clone(r); setDraft(r); return; }
      // You have unsaved edits and a teammate saved: keep everything you changed, take the rest from them.
      var m = merge3(base.current || {}, latest.current, r);
      if (!isPlain(m)) m = E.clone(latest.current);
      base.current = r;
      m.id = id; m.updatedAt = Date.now(); m.updatedBy = (ctx.me && ctx.me.id) || m.updatedBy || null;
      latest.current = m; setDraft(m); schedule();
    }, [remote]);

    var flush = useCallback(async function () {
      timer.current = null;
      var d = latest.current; if (!d || goneRef.current || paused.current) return;
      setSave('saving');
      var data = clean(Object.assign({}, d, { totalHours: E.round(E.compute(d).total, 1) }));
      mine.current.push(data.updatedAt); if (mine.current.length > 40) mine.current.shift();
      var ok = await ctx.api.set('estimates/' + id, data);
      if (!timer.current) {
        if (ok && latest.current === d) dirty.current = false;
        setSave(ok ? (dirty.current ? 'pending' : 'saved') : 'error');
      }
    }, [id, ctx.api]);
    flushRef.current = flush;
    useEffect(function () {
      // save straight away when the tab is hidden or closed, and when leaving the editor
      function onHide(e) { if ((e.type === 'pagehide' || document.visibilityState === 'hidden') && timer.current) { clearTimeout(timer.current); flush(); } }
      document.addEventListener('visibilitychange', onHide); window.addEventListener('pagehide', onHide);
      return function () {
        document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide);
        if (timer.current) { clearTimeout(timer.current); flush(); }
      };
    }, [flush]);

    var change = useCallback(function (fn) {
      if (ctx.readOnly) { ctx.toast('You have view-only access, so changes are not saved.', 'bad'); return; }
      if (!latest.current) return;
      var n = E.clone(latest.current);
      fn(n);
      n.updatedAt = Date.now(); n.updatedBy = (ctx.me && ctx.me.id) || n.updatedBy || null;
      latest.current = n; setDraft(n);
      if (goneRef.current) { dirty.current = true; return; }
      schedule();
    }, [flush, ctx.readOnly, ctx.me]);

    function restore() {
      if (!latest.current) return;
      goneRef.current = false; paused.current = false; setGone(false);
      var n = E.clone(latest.current); n.updatedAt = Date.now();
      latest.current = n; setDraft(n); dirty.current = true;
      clearTimeout(timer.current); timer.current = null; flush();
    }

    if (!draft) {
      if (ctx.estimates === null) return html`<div class="panel panel-pad" aria-busy="true"><div class="skeleton" style="width:40%"></div></div>`;
      return html`<div class="panel"><div class="empty"><h2>This estimate isn't available</h2><p>It may have been deleted, or you no longer have access to it.</p>
        <button class="btn" onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}><${Icon} name="arrowL" /> Back to estimates</button></div></div>`;
    }

    var step = route.step === 'proposal' || STEPS.some(function (s) { return s.id === route.step; }) ? route.step : 'scope';
    var service = ctx.services ? ctx.services[draft.serviceId] : null;
    var labels = E.labelsOf(draft);
    var res = E.compute(draft);
    function goStep(s) { ctx.setRoute({ view: 'estimate', id: id, step: s }); }

    async function doExport(kind) {
      if (exporting) return;
      setExporting(kind);
      try {
        if (kind === 'csv') await saveFile(ctx, fileBase(draft) + '.csv', new Blob([E.buildCsv(draft)], { type: 'text/csv' }));
        else if (kind === 'docx') {
          var D = await loadDocx();
          var blob = await E.buildDocx(D, draft, { agency: ctx.settings.agencyName || '', preparedBy: (ctx.me && ctx.me.name) || '', date: today() });
          await saveFile(ctx, fileBase(draft).replace(/-hours$/, '') + '-proposal.docx', blob);
        } else {
          var X = await loadExcel();
          var buf = await E.buildXlsx(X, draft, { agency: ctx.settings.agencyName || '', preparedBy: (ctx.me && ctx.me.name) || '', date: today() });
          await saveFile(ctx, fileBase(draft) + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        }
      } catch (e) { ctx.toast((e && e.message) || 'The file could not be created.', 'bad'); }
      finally { setExporting(null); }
    }

    var stepIdx = step === 'proposal' ? STEPS.length : STEPS.findIndex(function (s) { return s.id === step; });
    var body;
    if (step === 'service') body = html`<${ServiceStep} ctx=${ctx} draft=${draft} change=${change} goStep=${goStep} />`;
    else if (step === 'scope') body = html`<${ScopeStep} draft=${draft} res=${res} change=${change} labels=${labels} />`;
    else if (step === 'build') body = html`<${BuildStep} ctx=${ctx} draft=${draft} res=${res} change=${change} service=${service} labels=${labels} />`;
    else if (step === 'proposal') body = html`<${ProposalView} ctx=${ctx} draft=${draft} change=${change} onExport=${doExport} exporting=${exporting} goStep=${goStep} />`;
    else body = html`<${ReviewStep} ctx=${ctx} id=${id} draft=${draft} res=${res} change=${change} service=${service} labels=${labels} onExport=${doExport} exporting=${exporting} goStep=${goStep} />`;

    var saveLabel = gone ? 'Not saved' : save === 'saving' || save === 'pending' ? 'Saving…' : save === 'error' ? 'Not saved' : 'Saved';
    return html`<div class="editor">
      <h1 class="sr">${nm(draft.name, 'Untitled estimate')}</h1>
      ${gone ? html`<div class="banner bad with-actions" role="alert" style="margin-bottom:16px"><${Icon} name="alert" />
        <div class="grow"><b>This estimate was deleted by someone else.</b> Edits you make here are not being saved. Restore it to keep working on it.</div>
        <div class="banner-actions"><button class="btn sm" onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}>Back to estimates</button><button class="btn sm primary" onClick=${restore}>Restore it</button></div>
      </div>` : null}
      <div class="crumbs"><button onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}>Estimates</button><${Icon} name="chevR" size=${12} /><span><bdi>${draft.serviceName}</bdi></span></div>
      <div class="ed-head">
        <div class="ed-title">
          <${TitleText} cls="title-input" id="est-name" max="200" label="Estimate name" value=${draft.name} placeholder="Untitled estimate" onInput=${function (v) { change(function (n) { n.name = v; }); }} />
          <input class="client-input" id="est-client" maxlength="200" aria-label="Client" value=${draft.client} placeholder="Add client name" onInput=${function (e) { var v = e.target.value; change(function (n) { n.client = v; }); }} />
        </div>
        <div class="ed-meta">
          <span class=${'savestate ' + (save === 'error' || gone ? 'error' : '')} aria-live="polite"><${Icon} name=${save === 'error' || gone ? 'alert' : save === 'saved' ? 'check' : 'refresh'} size=${14} />${saveLabel}</span>
          <label class="sr" for="est-status">Status</label>
          <select class="select status-select" id="est-status" value=${draft.status || 'draft'} onChange=${function (e) { var v = e.target.value; change(function (n) { n.status = v; }); }}>
            ${E.STATUSES.map(function (s) { return html`<option value=${s.id}>${s.name}</option>`; })}
            ${statusOf(draft.status).id === 'other' ? html`<option value=${draft.status}>${statusOf(draft.status).name}</option>` : null}
          </select>
        </div>
      </div>
      <nav class="steps" aria-label="Estimate steps">
        ${STEPS.map(function (s, i) {
          return html`<button class=${'step' + (i < stepIdx ? ' done' : '')} key=${s.id} aria-current=${s.id === step ? 'step' : null} onClick=${function () { goStep(s.id); }}><span class="n">${i < stepIdx ? html`<${Icon} name="check" size=${12} sw=${2.4} />` : s.n}</span>${s.name}</button>`;
        })}
      </nav>
      ${step === 'proposal' ? html`<div class="ed-main">${body}</div>` : html`<div class="ed-body">
        <div class="ed-main">${body}</div>
        <${Inspector} draft=${draft} res=${res} step=${step} goStep=${goStep} onExport=${doExport} exporting=${exporting} labels=${labels} />
      </div>`}
    </div>`;
  }

  // ------------------------------------------------------------------ inspector
  function Inspector(p) {
    var so = useState(false), open = so[0], setOpen = so[1];
    var res = p.res, draft = p.draft;
    var idx = STEPS.findIndex(function (s) { return s.id === p.step; });
    var prev = STEPS[idx - 1], next = STEPS[idx + 1];
    var dl = E.deliverables(draft, res);
    return html`<aside class=${'inspector' + (open ? ' open' : '')} aria-label="Estimate summary">
      <div class="panel insp-card">
        <div class="insp-head">
          <div class="eyebrow insp-label">Total estimate</div>
          <div class="insp-total"><span class="num">${E.fmtNum(E.round(res.total, 1))}</span><span class="u">h</span></div>
          <div class="insp-sub">About ${E.fmtNum(E.round(res.total / 40, 1))} designer-weeks at 40h a week</div>
        </div>
        <button class="btn sm ghost insp-toggle" aria-expanded=${open ? 'true' : 'false'} onClick=${function () { setOpen(!open); }}>${open ? 'Hide' : 'Details'}</button>
        <dl class="insp-lines">
          <dt>Base design</dt><dd>${E.fmtHours(E.round(res.base, 1))}</dd>
          <dt>Adaptations & add-ons</dt><dd>${E.fmtHours(E.round(res.adaptations, 1))}</dd>
          <dt>Project overhead</dt><dd>${E.fmtHours(E.round(res.overhead, 1))}</dd>
          <dt>Buffer ${E.fmtNum(res.bufferPercent)}%</dt><dd>${E.fmtHours(E.round(res.buffer, 1))}</dd>
        </dl>
        <div class="insp-count">${dl[0] ? dl[0].text : ''}</div>
        <div class="insp-nav">
          ${prev ? html`<button class="btn" onClick=${function () { p.goStep(prev.id); }}><${Icon} name="arrowL" /><span>${prev.name}</span></button>` : null}
          ${next ? html`<button class="btn primary" onClick=${function () { p.goStep(next.id); }}><span>${next.name}</span><${Icon} name="arrowR" /></button>` : null}
        </div>
        <div class="insp-export">
          <button class="btn sm" disabled=${!!p.exporting} onClick=${function () { p.onExport('csv'); }}><${Icon} name="download" size=${14} />${p.exporting === 'csv' ? 'Exporting…' : 'CSV'}</button>
          <button class="btn sm" disabled=${!!p.exporting} onClick=${function () { p.onExport('xlsx'); }}><${Icon} name="download" size=${14} />${p.exporting === 'xlsx' ? 'Exporting…' : 'XLSX'}</button>
        </div>
      </div>
    </aside>`;
  }

  // ------------------------------------------------------------------ step: service
  function ServiceStep(p) {
    var ctx = p.ctx, draft = p.draft;
    var active = (ctx.serviceList || []).filter(function (s) { return s.active || s.id === draft.serviceId; });
    function pick(svc) {
      if (svc.id === draft.serviceId) { p.goStep('scope'); return; }
      ctx.confirm({
        title: 'Switch to ' + svc.name + '?',
        body: 'This clears the scope options and the ' + lower(E.labelsOf(draft).items) + ' you have added. Custom deliverables, overhead, buffer and the assumptions register stay.',
        confirmLabel: 'Switch service', danger: true,
        onConfirm: function () {
          var fresh = E.createEstimate(svc, svc.id, ctx.settings, {});
          p.change(function (n) {
            n.serviceId = svc.id; n.serviceName = svc.name; n.snapshot = fresh.snapshot; n.scope = fresh.scope;
            n.items = []; n.dismissedSuggestions = []; n.hiddenAuto = [];
          });
          p.goStep('scope');
        },
      });
    }
    return html`<section class="panel panel-pad">
        <${CardHead} icon="layers" color="green" title="Service" desc="The service decides which scope options and building blocks are available." />
        <div class="svc-grid">${active.map(function (svc) {
          var on = svc.id === draft.serviceId;
          return html`<button class="svc-card" key=${svc.id} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { pick(svc); }}>
            <${SvcTile} svc=${svc} size="lg" />
            <span class="t"><span class="svc-name">${svc.name}</span><span class="svc-desc">${svc.description}</span>
              <span class="svc-stats">${on ? html`<span class="hrs">Selected</span>` : serviceStats(svc).map(function (t) { return html`<span class="tag" key=${t}>${t}</span>`; })}</span>
            </span>
          </button>`;
        })}</div>
        ${!ctx.services || ctx.services[draft.serviceId] ? null : html`<div class="banner warn" style="margin-top:14px"><${Icon} name="alert" /><div class="grow">${draft.serviceName} is no longer in the library. This estimate keeps its own copy of the rates and items.</div></div>`}
      </section>`;
  }

  // ------------------------------------------------------------------ step: scope
  function ScopeStep(p) {
    var draft = p.draft, res = p.res, labels = p.labels;
    var groups = (draft.snapshot && draft.snapshot.optionGroups) || [];
    function lineFor(oid) { return res.optionLines.filter(function (l) { return l.optionId === oid; })[0]; }
    function setVal(oid, v) { p.change(function (n) { n.scope = n.scope || {}; n.scope.values = n.scope.values || {}; n.scope.values[oid] = v; }); }
    function setChoice(gid, oid) { p.change(function (n) { n.scope = n.scope || {}; n.scope.choice = n.scope.choice || {}; n.scope.choice[gid] = oid; }); }

    function single(g) {
      var chosen = E.chosenOption(g, draft.scope);
      var opts = g.options || [];
      function onKey(e) {
        var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d || !opts.length) return;
        e.preventDefault();
        var i = Math.max(0, opts.findIndex(function (o) { return o.id === chosen; }));
        var nx = opts[(i + d + opts.length) % opts.length], el = e.currentTarget;
        setChoice(g.id, nx.id);
        setTimeout(function () { var b = el.querySelector('[data-id="' + nx.id + '"]'); if (b) b.focus(); }, 30);
      }
      return html`<div class="choice-list" role="radiogroup" aria-label=${g.name} onKeyDown=${onKey}>
        ${opts.map(function (o) {
          var on = chosen === o.id, l = lineFor(o.id), hint = E.ruleHint(o, labels, true);
          return html`<button type="button" class="choice" key=${o.id} data-id=${o.id} role="radio" aria-checked=${on ? 'true' : 'false'} tabindex=${on ? '0' : '-1'} onClick=${function () { setChoice(g.id, o.id); }}>
            <span class="dot"></span>
            <span class="opt-main"><span class="opt-name">${o.name}</span>${hint ? html`<span class="opt-hint">${hint}</span>` : null}</span>
            ${on && l && l.hours > 0 ? html`<${Hrs} v=${l.hours} />` : null}
          </button>`;
        })}
      </div>`;
    }
    function multi(g) {
      return html`<div class="opt-list">
        ${(g.options || []).map(function (o) {
          var v = E.optionValue(g, o, draft.scope), l = lineFor(o.id), hint = E.ruleHint(o, labels, false);
          var ctl;
          if (o.locked && o.input !== 'quantity') ctl = html`<span class="locked"><${Icon} name="lock" size=${13} />Always included</span>`;
          else if (o.input === 'quantity') ctl = html`<${Stepper} id=${'opt-' + o.id} step=${1} min=${E.num(o.min, 0)} max=${E.num(o.max, 99)} value=${v} label=${o.name} onChange=${function (n) { setVal(o.id, n); }} />`;
          else ctl = html`<${Switch} id=${'opt-' + o.id} label=${o.name} checked=${v} onChange=${function (n) { setVal(o.id, n); }} />`;
          return html`<div class="opt-row" key=${o.id}>
            <div class="opt-main">
              <div class="opt-name">${o.name}${l && l.hours > 0 ? html`<${Hrs} v=${l.hours} />` : null}</div>
              ${hint ? html`<div class="opt-hint">${hint}</div>` : null}
              ${o.description ? html`<div class="opt-desc">${o.description}</div>` : null}
            </div>
            ${ctl}
          </div>`;
        })}
      </div>`;
    }
    var cds = draft.customDeliverables || [];
    function updCd(key, fn) { p.change(function (n) { var c = (n.customDeliverables || []).filter(function (x) { return x.key === key; })[0]; if (c) fn(c); }); }
    return html`<div class="scope-grid">
      ${groups.map(function (g, gi) {
        var gs = groupStyle(g, gi);
        return html`<section class="panel panel-pad" key=${g.id}>
          <${CardHead} icon=${gs.icon} color=${gs.color} title=${g.name} desc=${g.description} />
          ${g.selection === 'single' ? single(g) : multi(g)}
        </section>`;
      })}
      <section class="panel panel-pad">
        <${CardHead} icon="plus" color="pink" title="Custom deliverables" desc="Anything not listed above, with your own hours." />
        <div class="custom-rows">
          ${cds.map(function (c) {
            return html`<div class="custom-row" key=${c.key}>
              <input class="input sm" id=${'cd-' + c.key} maxlength="200" aria-label="Deliverable name" placeholder="e.g. Brand workshop" value=${c.name} autofocus=${!c.name}
                onInput=${function (e) { var v = e.target.value; updCd(c.key, function (x) { x.name = v; }); }} />
              <${Stepper} step=${1} min=${1} max=${99} value=${E.num(c.qty, 1)} label="Quantity" unit="×" onChange=${function (v) { updCd(c.key, function (x) { x.qty = v; }); }} />
              <${Stepper} value=${E.num(c.hours)} label="Hours each" unit="h" onChange=${function (v) { updCd(c.key, function (x) { x.hours = v; }); }} />
              <button type="button" class="icon-btn danger" aria-label=${'Remove ' + (c.name || 'deliverable')} onClick=${function () { p.change(function (n) { n.customDeliverables = n.customDeliverables.filter(function (x) { return x.key !== c.key; }); }); }}><${Icon} name="trash" /></button>
            </div>`;
          })}
          <div><button type="button" class="btn sm" onClick=${function () { p.change(function (n) { n.customDeliverables = (n.customDeliverables || []).concat({ key: E.uid('c'), name: '', qty: 1, hours: 4 }); }); }}><${Icon} name="plus" /> Add custom deliverable</button></div>
        </div>
      </section>
    </div>`;
  }

  // ------------------------------------------------------------------ step: build
  function BuildStep(p) {
    var ctx = p.ctx, draft = p.draft, res = p.res, service = p.service, labels = p.labels;
    var sq = useState(''), q = sq[0], setQ = sq[1];
    var so = useState(false), onlySel = so[0], setOnlySel = so[1];
    var se = useState({}), open = se[0], setOpen = se[1];
    var si = useState({}), info = si[0], setInfo = si[1];
    var sa = useState(false), allSugg = sa[0], setAllSugg = sa[1];
    var sc = useState({ name: '', hours: 4, cat: 'custom' }), cform = sc[0], setCform = sc[1];

    var byLib = {}; draft.items.forEach(function (it) { if (it.libId) byLib[it.libId] = it; });
    var resByKey = {}; res.items.forEach(function (x) { resByKey[x.item.key] = x; });
    var cats = service ? (service.categories || []) : [];
    var catIds = cats.map(function (c) { return c.id; });
    var suggestions = E.gapSuggestions(draft, service);
    var ql = q.trim().toLowerCase();
    var isAdmin = ctx.role === 'admin';

    function addLib(li) {
      var it = E.copyItem(service, li, draft);
      p.change(function (n) { n.items.push(it); });
      if (it.subs.length) setOpen(function (o) { var c = Object.assign({}, o); c[it.key] = true; return c; });
    }
    function removeItem(it) {
      var snapshot = E.clone(it), idx = draft.items.findIndex(function (x) { return x.key === it.key; });
      p.change(function (n) { n.items = n.items.filter(function (x) { return x.key !== it.key; }); });
      ctx.toast('Removed ' + it.name, null, { label: 'Undo', fn: function () { p.change(function (n) { if (!n.items.some(function (x) { return x.key === snapshot.key; })) n.items.splice(Math.min(idx, n.items.length), 0, snapshot); }); } });
    }
    function addPack(pack) {
      var added = 0;
      p.change(function (n) {
        (pack.items || []).forEach(function (lid) {
          if (n.items.some(function (i) { return i.libId === lid; })) return;
          var li = (service.items || []).filter(function (x) { return x.id === lid; })[0];
          if (li) { n.items.push(E.copyItem(service, li, n)); added++; }
        });
      });
      ctx.toast(added ? 'Added ' + added + ' ' + lower(plural(added, labels.item, labels.items)) + ' from ' + pack.name : 'Everything in ' + pack.name + ' is already added');
    }
    function acceptSuggestion(s) {
      if (s.kind === 'item') { var li = (service.items || []).filter(function (x) { return x.id === s.ref; })[0]; if (li) addLib(li); return; }
      p.change(function (n) {
        var g = n.snapshot.optionGroups.filter(function (x) { return x.id === s.group; })[0];
        var o = g && g.options.filter(function (x) { return x.id === s.ref; })[0];
        if (!g || !o) return;
        if (g.selection === 'single') { n.scope.choice = n.scope.choice || {}; n.scope.choice[g.id] = o.id; }
        else if (o.input === 'quantity') { n.scope.values[o.id] = Math.max(E.num(n.scope.values[o.id]), E.num(o.free) + 1); }
        else n.scope.values[o.id] = true;
      });
      ctx.toast('Turned on ' + s.label);
    }
    function dismiss(s) { p.change(function (n) { n.dismissedSuggestions = (n.dismissedSuggestions || []).concat(s.id); }); }

    async function saveToLibrary(it) {
      var live = ctx.services && ctx.services[draft.serviceId];
      if (!live) { ctx.toast('This service is no longer in the library.', 'bad'); return; }
      var svc = E.clone(live);
      var cat = (svc.categories || []).some(function (c) { return c.id === it.categoryId; }) ? it.categoryId : null;
      if (!cat) { if (!(svc.categories || []).some(function (c) { return c.id === 'custom'; })) svc.categories.push({ id: 'custom', name: 'Custom' }); cat = 'custom'; }
      var newLib = uniqueId(it.name, svc.items.map(function (x) { return x.id; }));
      var defaultSubs = [];
      (it.subs || []).forEach(function (s) {
        if (s.libId && svc.subItems.some(function (x) { return x.id === s.libId; })) { defaultSubs.push(s.libId); return; }
        var sid = uniqueId(s.name, svc.subItems.map(function (x) { return x.id; }));
        svc.subItems.push({ id: sid, name: s.name, hours: E.num(s.hours), description: '', includes: '', excludes: '' });
        defaultSubs.push(sid);
      });
      svc.items.push({ id: newLib, categoryId: cat, name: it.name, hours: E.num(it.hours), defaultSubs: defaultSubs, allowMultiple: !!it.allowMultiple, description: it.description || '', includes: it.includes || '', excludes: it.excludes || '' });
      var ok = await ctx.api.set('services/' + draft.serviceId, clean(svc));
      if (ok) {
        p.change(function (n) {
          var t = n.items.filter(function (x) { return x.key === it.key; })[0];
          if (t) { t.libId = newLib; t.custom = false; t.categoryId = cat; t.categoryName = E.categoryName(svc, cat); (t.subs || []).forEach(function (s, i) { if (!s.libId) s.libId = defaultSubs[i]; }); }
        });
        ctx.toast('Added ' + it.name + ' to the ' + svc.name + ' library');
      }
    }

    function matches(name, catName) { return !ql || lower(name).indexOf(ql) >= 0 || lower(catName).indexOf(ql) >= 0; }
    function row(li, it) {
      var key = it ? it.key : li.id, src = it || li, selected = !!it;
      var x = it ? resByKey[it.key] : null;
      var hours = selected ? (x ? x.total : 0) : E.libItemHours(service, li);
      var nsub = selected ? (it.subs || []).length : (li.defaultSubs || []).length;
      var wont = selected && it.priority === 'wont';
      var expanded = selected && !!open[it.key];
      var hasDef = src.description || src.includes || src.excludes;
      var phases = draft.snapshot.phases || [];
      var badges = [];
      if (selected) {
        if (it.complexity && it.complexity !== 'standard') { var cxn = (draft.snapshot.complexity || []).filter(function (c) { return c.id === it.complexity; }).map(function (c) { return c.name; })[0] || it.complexity; badges.push(html`<span class="mini cx" key="cx" title=${cxn}>${cxn}</span>`); }
        if (it.priority && it.priority !== 'must') badges.push(html`<span class=${'mini ' + it.priority} key="pr">${(E.PRIORITIES.filter(function (q2) { return q2.id === it.priority; })[0] || {}).short}</span>`);
        if (E.packagesOf(draft).enabled && E.tierOf(it) > 0) badges.push(html`<span class="mini pk" key="pk" title=${'From the ' + E.packagesOf(draft).names[E.tierOf(it)] + ' package'}>${E.packagesOf(draft).names[E.tierOf(it)]}${E.tierOf(it) < 2 ? '+' : ''}</span>`);
        if ((it.reqs || []).length) badges.push(html`<span class="mini rq" key="rq" title=${(it.reqs || []).join(', ')}>${(it.reqs || []).length === 1 ? it.reqs[0] : it.reqs.length + ' reqs'}</span>`);
        if (it.phase && phases.length > 1 && it.phase !== phases[0]) badges.push(html`<span class="mini ph" key="ph" title=${it.phase}>${it.phase}</span>`);
      }
      var detail = [];
      if (nsub) detail.push(nsub + ' ' + lower(plural(nsub, labels.sub, labels.subs)));
      if (it && it.custom) detail.push('custom');
      return html`<div key=${key}>
        <div class=${'lib-row' + (selected ? ' sel' : '') + (wont ? ' wont' : '')}>
          <label class="lib-main">
            <input type="checkbox" class="cb" id=${'pick-' + key} checked=${selected} onChange=${function () { if (selected) removeItem(it); else addLib(li); }} />
            <span class="lib-text">
              <span class="lib-name"><bdi>${src.name}</bdi>${it && it.qty > 1 ? html`<span class="qty-badge">×${it.qty}</span>` : null}${detail.length ? html`<span class="lib-sub"> (${detail.join(', ')})</span>` : null}</span>
              ${badges.length ? html`<span class="lib-meta">${badges}</span>` : null}
            </span>
          </label>
          ${hasDef ? html`<button type="button" class="icon-btn" aria-label=${'What ' + src.name + ' covers'} aria-expanded=${info[key] ? 'true' : 'false'} onClick=${function () { setInfo(function (s) { var c = Object.assign({}, s); c[key] = !s[key]; return c; }); }}><${Icon} name="info" /></button>` : null}
          <${Hrs} v=${hours} ghost=${!selected || wont} />
          ${selected ? html`<button type="button" class="icon-btn chev" aria-label=${(expanded ? 'Close ' : 'Edit ') + src.name} aria-expanded=${expanded ? 'true' : 'false'} onClick=${function () { setOpen(function (o) { var c = Object.assign({}, o); c[it.key] = !o[it.key]; return c; }); }}><${Icon} name="chevD" /></button>` : html`<span class="icon-btn" aria-hidden="true"></span>`}
        </div>
        ${info[key] ? html`<div class="def">
          ${src.description ? html`<span>${src.description}</span>` : null}
          ${E.lines(src.includes).length ? html`<span><b>Includes:</b> ${E.lines(src.includes).join('; ')}</span>` : null}
          ${E.lines(src.excludes).length ? html`<span><b>Excludes:</b> ${E.lines(src.excludes).join('; ')}</span>` : null}
        </div>` : null}
        ${expanded ? html`<${ItemPanel} it=${it} x=${x} draft=${draft} service=${service} labels=${labels} change=${p.change} onRemove=${function () { removeItem(it); }} isAdmin=${isAdmin} onSaveToLibrary=${saveToLibrary} />` : null}
      </div>`;
    }

    var sections = cats.map(function (c) {
      var libs = (service.items || []).filter(function (li) { return li.categoryId === c.id; });
      var customs = draft.items.filter(function (it) { return !it.libId && it.categoryId === c.id; });
      return { id: c.id, name: c.name, libs: libs, customs: customs };
    });
    var orphans = draft.items.filter(function (it) { return (it.libId && (!service || !(service.items || []).some(function (li) { return li.id === it.libId; }))) || (!it.libId && catIds.indexOf(it.categoryId) < 0); });
    if (orphans.length) sections.push({ id: '_other', name: service ? 'Custom' : 'In this estimate', libs: [], customs: orphans });

    var visibleSugg = allSugg ? suggestions : suggestions.slice(0, 3);
    var packs = service ? (service.starterPacks || []) : [];
    return html`
      ${!service ? html`<div class="banner warn"><${Icon} name="alert" /><div class="grow">${draft.serviceName} is no longer in the library, so only the ${lower(labels.items)} already in this estimate are shown.</div></div>` : null}
      ${ctx.sample && service ? html`<${BriefPanel} ctx=${ctx} draft=${draft} service=${service} change=${p.change} labels=${labels} />` : null}
      <div class="build-tools">
        <label class="search"><span class="sr">Search ${lower(labels.items)}</span><${Icon} name="search" />
          <input class="input" id="build-search" maxlength="100" placeholder=${'Search ' + lower(labels.items)} value=${q} onInput=${function (e) { setQ(e.target.value); }} />
        </label>
        <button class="chip" aria-pressed=${onlySel ? 'true' : 'false'} onClick=${function () { setOnlySel(!onlySel); }}>Selected only <span class="count">${draft.items.length}</span></button>
      </div>
      ${packs.length ? html`<div class="packs"><span class="eyebrow">Starter packs</span>${packs.map(function (pk) {
        return html`<button class="chip" key=${pk.id} title=${pk.description || ''} onClick=${function () { addPack(pk); }}><${Icon} name="pack" size=${14} />${pk.name}<span class="count">${(pk.items || []).length}</span></button>`;
      })}</div>` : null}
      ${suggestions.length ? html`<section class="panel suggest" aria-label="Suggestions">
        <div class="suggest-head"><${Tile} size="sm" icon="bulb" color="yellow" />${suggestions.length} ${plural(suggestions.length, 'suggestion', 'suggestions')} based on what you've added</div>
        <div class="suggest-list">${visibleSugg.map(function (s) {
          return html`<div class="suggest-item" key=${s.id}>
            <div class="suggest-text"><b>${s.label}</b> <span>(${s.message || ('Often goes with ' + s.trigger)})</span></div>
            <button class="btn sm" onClick=${function () { acceptSuggestion(s); }}><${Icon} name="plus" size=${14} />${s.kind === 'item' ? 'Add' : 'Turn on'}</button>
            <button class="btn sm ghost" onClick=${function () { dismiss(s); }}>Dismiss</button>
          </div>`;
        })}</div>
        ${suggestions.length > 3 ? html`<button class="link" style="margin-top:6px" onClick=${function () { setAllSugg(!allSugg); }}>${allSugg ? 'Show fewer' : 'Show all ' + suggestions.length}</button>` : null}
      </section>` : null}
      ${sections.map(function (sec, si2) {
        var rows = [];
        sec.libs.forEach(function (li) { var it = byLib[li.id]; if (onlySel && !it) return; if (!matches(li.name, sec.name)) return; rows.push(row(li, it || null)); });
        sec.customs.forEach(function (it) { if (!matches(it.name, sec.name)) return; rows.push(row(null, it)); });
        if (!rows.length) return null;
        var selItems = draft.items.filter(function (it) { return (it.libId && sec.libs.some(function (li) { return li.id === it.libId; })) || sec.customs.indexOf(it) >= 0; });
        var selHours = selItems.reduce(function (s, it) { var x = resByKey[it.key]; return s + (x && x.included ? x.total : 0); }, 0);
        return html`<section class="panel cat" key=${sec.id}>
          <div class="cat-head"><${Tile} size="sm" icon="folder" color=${sec.id === '_other' ? 'pink' : catColor(si2)} /><h2><bdi>${sec.name}</bdi> <span class="paren">(${selItems.length} of ${sec.libs.length + sec.customs.length})</span></h2><${Hrs} v=${selHours} ghost=${!selHours} /></div>
          ${rows}
        </section>`;
      })}
      ${(ql || onlySel) && !sections.some(function (sec) { return sec.libs.some(function (li) { return (!onlySel || byLib[li.id]) && matches(li.name, sec.name); }) || sec.customs.some(function (it) { return matches(it.name, sec.name); }); })
        ? html`<div class="panel"><div class="empty"><h2>Nothing matches</h2><p>${onlySel && !draft.items.length ? 'No ' + lower(labels.items) + ' added yet.' : 'Try another search, or add it as a custom ' + lower(labels.item) + ' below.'}</p></div></div>` : null}
      <section class="panel panel-pad">
        <${CardHead} icon="plus" color="pink" title=${'Add a custom ' + lower(labels.item)} desc=${"For anything the library doesn't have yet." + (isAdmin ? ' You can save it to the library afterwards.' : '')} />
        <form class="inline-form" onSubmit=${function (e) {
          e.preventDefault();
          var name = cform.name.trim(); if (!name) return;
          var catId = cform.cat || 'custom';
          var it = E.customItem(name, cform.hours, catId, service && catId !== 'custom' ? E.categoryName(service, catId) : 'Custom', draft);
          p.change(function (n) { n.items.push(it); });
          setCform({ name: '', hours: 4, cat: cform.cat });
          setOpen(function (o) { var c = Object.assign({}, o); c[it.key] = true; return c; });
          ctx.toast('Added ' + name);
        }}>
          <input class="input" id="custom-name" maxlength="200" aria-label=${'Custom ' + lower(labels.item) + ' name'} placeholder=${'Name, e.g. Loan calculator'} value=${cform.name} onInput=${function (e) { setCform(Object.assign({}, cform, { name: e.target.value })); }} />
          ${cats.length ? html`<select class="select" style="width:auto" aria-label=${labels.category} value=${cform.cat} onChange=${function (e) { setCform(Object.assign({}, cform, { cat: e.target.value })); }}><option value="custom">Custom group</option>${cats.map(function (c) { return html`<option value=${c.id}>${c.name}</option>`; })}</select>` : null}
          <${Stepper} value=${cform.hours} label="Hours" unit="h" onChange=${function (v) { setCform(Object.assign({}, cform, { hours: v })); }} />
          <button class="btn primary" type="submit"><${Icon} name="plus" /> Add</button>
        </form>
      </section>`;
  }

  function ItemPanel(p) {
    var it = p.it, draft = p.draft, labels = p.labels, service = p.service;
    var sm = useState(false), more = sm[0], setMore = sm[1];
    var sf = useState({ name: '', hours: 2 }), cs = sf[0], setCs = sf[1];
    var ss = useState((it.subs || []).length > 0), subsOpen = ss[0], setSubsOpen = ss[1];
    function upd(fn) { p.change(function (n) { var t = n.items.filter(function (i) { return i.key === it.key; })[0]; if (t) fn(t, n); }); }
    var cx = (draft.snapshot && draft.snapshot.complexity) || E.DEFAULT_COMPLEXITY;
    var phases = (draft.snapshot && draft.snapshot.phases) || ['Phase 1'];
    var used = {}; (it.subs || []).forEach(function (s) { if (s.libId) used[s.libId] = 1; });
    var avail = service ? (service.subItems || []).filter(function (s) { return !used[s.id]; }) : [];
    var subsTotal = (it.subs || []).reduce(function (s, x) { return s + E.num(x.hours); }, 0);
    var x = p.x;
    return html`<div class="item-panel">
      <div class="ip-controls">
        <div class="ctl"><span class="ctl-label">Complexity</span><${Seg} label="Complexity" options=${cx.map(function (c) { return { value: c.id, label: c.name, title: '×' + E.fmtNum(c.multiplier) + (c.description ? ' · ' + c.description : '') }; })} value=${it.complexity || 'standard'} onChange=${function (v) { upd(function (t) { t.complexity = v; }); }} /></div>
        <div class="ctl"><span class="ctl-label">Priority</span><${Seg} cls="pri" label="Priority" options=${E.PRIORITIES.map(function (q) { return { value: q.id, label: q.short, title: q.name }; })} value=${it.priority || 'must'} onChange=${function (v) { upd(function (t) { t.priority = v; }); }} /></div>
        ${phases.length > 1 ? html`<label class="ctl"><span class="ctl-label">Phase</span><select class="select sm" style="width:auto" value=${it.phase} onChange=${function (e) { var v = e.target.value; upd(function (t) { t.phase = v; }); }}>${phases.map(function (ph) { return html`<option value=${ph}>${ph}</option>`; })}</select></label>` : null}
        ${E.packagesOf(draft).enabled ? html`<div class="ctl"><span class="ctl-label">Package</span><${Seg} label="Package" options=${E.packagesOf(draft).names.map(function (n, i) { return { value: i, label: n, title: i ? 'In ' + n + (i < 2 ? ' and above' : '') : 'In every package' }; })} value=${E.tierOf(it)} onChange=${function (v) { upd(function (t) { t.tier = v; }); }} /></div>` : null}
        ${it.allowMultiple || it.qty > 1 ? html`<div class="ctl"><span class="ctl-label">Quantity</span><${Stepper} step=${1} min=${1} max=${99} value=${E.num(it.qty, 1)} label="Quantity" onChange=${function (v) { upd(function (t) { t.qty = v; }); }} /></div>` : null}
      </div>
      ${subsOpen ? html`<div class="ip-subs">
        <div class="ip-subs-head"><span class="ctl-label">${labels.subs}</span><span class="muted" style="font-size:12.5px">${E.fmtHours(subsTotal)} per ${lower(labels.item)}${x && (x.mult !== 1 || x.qty !== 1) ? ' · ×' + E.fmtNum(x.mult * x.qty) + ' = ' + E.fmtHours(x.total) : ''}</span></div>
        ${(it.subs || []).length ? html`<ul class="sub-list">${it.subs.map(function (s) {
          return html`<li class="sub-row" key=${s.key}>
            <span class="sub-name">${s.name}${s.libId ? null : html`<span class="lib-sub"> (custom)</span>`}</span>
            <${Stepper} value=${E.num(s.hours)} label=${s.name + ' hours'} unit="h" onChange=${function (v) { upd(function (t) { var q = t.subs.filter(function (z) { return z.key === s.key; })[0]; if (q) q.hours = v; }); }} />
            <button type="button" class="icon-btn danger" aria-label=${'Remove ' + s.name} onClick=${function () { upd(function (t) { t.subs = t.subs.filter(function (z) { return z.key !== s.key; }); }); }}><${Icon} name="x" /></button>
          </li>`;
        })}</ul>` : html`<p class="muted" style="font-size:13px">No ${lower(labels.subs)} yet. Add some below.</p>`}
        ${avail.length ? html`<div class="sub-add">
          ${(more ? avail : avail.slice(0, 8)).map(function (s) {
            return html`<button type="button" class="chip dashed" key=${s.id} onClick=${function () { upd(function (t) { t.subs.push(E.copySub(s)); }); }}><${Icon} name="plus" size=${13} />${s.name}<span class="count">${E.fmtHours(s.hours)}</span></button>`;
          })}
          ${avail.length > 8 ? html`<button type="button" class="link" onClick=${function () { setMore(!more); }}>${more ? 'Show fewer' : 'Show all ' + avail.length}</button>` : null}
        </div>` : null}
        <form class="inline-form" style="margin-top:10px" onSubmit=${function (e) {
          e.preventDefault(); var name = cs.name.trim(); if (!name) return;
          upd(function (t) { t.subs.push({ key: E.uid('s'), libId: null, name: name, hours: cs.hours, description: '', includes: '', excludes: '' }); });
          setCs({ name: '', hours: 2 });
        }}>
          <input class="input sm" id=${'cs-' + it.key} maxlength="200" aria-label=${'Custom ' + lower(labels.sub)} placeholder=${'Custom ' + lower(labels.sub)} value=${cs.name} onInput=${function (e) { setCs({ name: e.target.value, hours: cs.hours }); }} />
          <${Stepper} value=${cs.hours} label="Custom hours" unit="h" onChange=${function (v) { setCs({ name: cs.name, hours: v }); }} />
          <button class="btn sm" type="submit">Add</button>
        </form>
      </div>` : null}
      ${E.requirementsOf(draft).length ? html`<${ReqLinks} it=${it} draft=${draft} upd=${upd} />` : null}
      <div class="ip-foot">
        <label class="ctl"><span class="ctl-label">${(it.subs || []).length ? labels.item + ' base hours' : 'Hours'}</span><${Stepper} value=${E.num(it.hours)} label="Base hours" unit="h" onChange=${function (v) { upd(function (t) { t.hours = v; }); }} /></label>
        <label class="ctl note"><span class="ctl-label">Note</span><input class="input sm" id=${'note-' + it.key} maxlength="1000" placeholder="Shown in exports, e.g. client wants 3 hero variants" value=${it.note || ''} onInput=${function (e) { var v = e.target.value; upd(function (t) { t.note = v; }); }} /></label>
        <div class="row">
          ${!subsOpen ? html`<button type="button" class="btn sm ghost" onClick=${function () { setSubsOpen(true); }}><${Icon} name="plus" size=${14} /> ${labels.subs}</button>` : null}
          ${p.isAdmin && it.custom ? html`<button type="button" class="btn sm" onClick=${function () { p.onSaveToLibrary(it); }}><${Icon} name="book" size=${14} /> Save to library</button>` : null}
          <button type="button" class="btn sm ghost danger" onClick=${p.onRemove}><${Icon} name="trash" size=${14} /> Remove</button>
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ step: review
  function ReviewStep(p) {
    var ctx = p.ctx, draft = p.draft, res = p.res, labels = p.labels, service = p.service;
    var sb = useState(false), showSubs = sb[0], setShowSubs = sb[1];
    var sc = E.scenarios(draft);
    var maxSc = Math.max.apply(null, sc.map(function (s) { return s.total; }).concat([0.0001]));
    var phases = E.phaseBreakdown(draft, res).filter(function (ph, i) { return ph.base > 0 || i === 0; });
    var maxPh = Math.max.apply(null, phases.map(function (ph) { return ph.total; }).concat([0.0001]));
    var outdated = ctx.settingsDoc && service ? E.ratesOutdated(draft, service, ctx.settings) : false;
    var dl = E.deliverables(draft, res);
    var oos = E.outOfScope(draft);
    var hidden = draft.hiddenAuto || [];
    var groups = (draft.snapshot && draft.snapshot.optionGroups) || [];

    function why(o) {
      if (o.rule === 'percent') return E.fmtNum(o.value) + '% of base design' + (o.units > 1 ? ' × ' + E.fmtNum(o.units) : '');
      if (o.rule === 'fixed') return o.isQuantity ? E.fmtNum(o.units) + ' × ' + E.fmtHours(o.value) : 'Fixed';
      if (o.rule === 'perItem') return E.fmtHours(o.value) + ' × ' + E.fmtNum(o.itemCount) + ' ' + lower(labels.items);
      return '';
    }
    function delivTile(d, i) {
      if (i === 0) return html`<${SvcTile} svc=${service || { icon: 'box' }} />`;
      if (d.group === 'Custom deliverables') return html`<${Tile} icon="plus" color="pink" />`;
      var gi = groups.findIndex(function (g) { return g.name === d.group; });
      var gs = gi >= 0 ? groupStyle(groups[gi], gi) : { icon: 'sliders', color: 'gray' };
      return html`<${Tile} icon=${gs.icon} color=${gs.color} />`;
    }
    function regList(kind) {
      var reg = E.registerFor(draft, kind.id, true);
      var st = useState(''), text = st[0], setText = st[1];
      var rs = REG_STYLE[kind.id] || ['list', 'gray'];
      return html`<section class="panel panel-pad" key=${kind.id}>
        <${CardHead} icon=${rs[0]} color=${rs[1]} title=${kind.name} desc=${kind.hint} />
        <div class="reg-list">
          ${reg.auto.map(function (e) {
            var off = hidden.indexOf(e.id) >= 0;
            return html`<div class=${'reg-item' + (off ? ' hidden' : '')} key=${e.id}>
              <span class="src">Library</span><span class="txt">${e.text}</span>
              <button type="button" class="icon-btn" aria-label=${off ? 'Include this line' : 'Leave this line out'} title=${off ? 'Include' : 'Leave out'} onClick=${function () { p.change(function (n) { var hs = n.hiddenAuto || []; n.hiddenAuto = off ? hs.filter(function (z) { return z !== e.id; }) : hs.concat(e.id); }); }}><${Icon} name=${off ? 'eyeOff' : 'eye'} /></button>
            </div>`;
          })}
          ${((draft.register && draft.register[kind.id]) || []).map(function (e) {
            return html`<div class="reg-item" key=${e.id}>
              <${AutoText} id=${'reg-' + e.id} label=${kind.name} value=${e.text} onInput=${function (ev) { var v = ev.target.value; p.change(function (n) { var t = n.register[kind.id].filter(function (z) { return z.id === e.id; })[0]; if (t) t.text = v; }); }} />
              <button type="button" class="icon-btn danger" aria-label="Remove line" onClick=${function () { p.change(function (n) { n.register[kind.id] = n.register[kind.id].filter(function (z) { return z.id !== e.id; }); }); }}><${Icon} name="trash" /></button>
            </div>`;
          })}
          ${!reg.auto.length && !((draft.register && draft.register[kind.id]) || []).length ? html`<p class="muted" style="font-size:13px;padding:2px 0 8px">Nothing recorded yet.</p>` : null}
          <form class="str-row" style="margin-top:6px" onSubmit=${function (e) {
            e.preventDefault(); var t = text.trim(); if (!t) return;
            p.change(function (n) { n.register = n.register || {}; n.register[kind.id] = (n.register[kind.id] || []).concat({ id: E.uid('r'), text: t }); });
            setText('');
          }}>
            <input class="input" id=${'reg-new-' + kind.id} maxlength="1000" placeholder=${'Add ' + ({ assumptions: 'an assumption', exclusions: 'an exclusion', dependencies: 'a dependency', risks: 'a risk' }[kind.id] || lower(kind.name))} value=${text} onInput=${function (e) { setText(e.target.value); }} />
            <button class="btn" type="submit"><${Icon} name="plus" /> Add</button>
          </form>
        </div>
      </section>`;
    }

    var bufferPicks = [0, 5, 10, 12.5, 15, 20];
    var included = res.items.filter(function (x) { return x.included; });
    return html`
      ${outdated ? html`<div class="banner warn"><${Icon} name="refresh" /><div class="grow"><b>The library's rates have changed</b> since this estimate was created. Update to use the latest percentages, multipliers, phases and overhead. ${labels.items} you've already added keep their hours.</div>
        <button class="btn sm" onClick=${function () { p.change(function (n) { var r = E.refreshRates(n, service, ctx.settings); Object.keys(r).forEach(function (k) { n[k] = r[k]; }); }); ctx.toast('Updated to the latest rates'); }}>Update rates</button></div>` : null}
      <div class="review-top">
        <section class="panel total-card">
          <div class="eyebrow">Total estimate</div>
          <div class="total-big"><span class="measure"><span class="num">${E.fmtNum(E.round(res.total, 1))}</span><span class="u">h</span></span></div>
          <div class="total-meta">${dl[0] ? dl[0].text : ''} <span class="paren">(about ${E.fmtNum(E.round(res.total / 40, 1))} designer-weeks)</span></div>
          <dl class="summary-lines">
            <dt>Base design</dt><dd>${E.fmtHours(E.round(res.base, 1))}</dd>
            <dt>Adaptations & add-ons</dt><dd>${E.fmtHours(E.round(res.adaptations, 1))}</dd>
            <dt>Project overhead</dt><dd>${E.fmtHours(E.round(res.overhead, 1))}</dd>
            <dt>Buffer (${E.fmtNum(res.bufferPercent)}%)</dt><dd>${E.fmtHours(E.round(res.buffer, 1))}</dd>
            <dt class="tot">Total</dt><dd class="tot">${E.fmtHours(E.round(res.total, 1))}</dd>
          </dl>
        </section>
        <section class="panel panel-pad">
          <${CardHead} icon="gauge" color="teal" title="Scope scenarios" desc="What the total becomes if you trim to higher priorities only. Useful when the budget is tight." />
          <div class="bars">${sc.map(function (s, i) {
            return html`<div class="bar-row" key=${s.id}>
              <span class="bar-label">${s.label}<span>${s.count} ${lower(plural(s.count, labels.item, labels.items))}</span></span>
              <span class="bar-track"><span class=${'bar-fill' + (i === sc.length - 1 ? ' hl' : '')} style=${'display:block;width:' + Math.max(1, (s.total / maxSc) * 100).toFixed(1) + '%'}></span></span>
              <${Hrs} v=${s.total} ghost=${i !== sc.length - 1} />
            </div>`;
          })}</div>
        </section>
      </div>

      <section class="panel panel-pad">
        <${CardHead} icon="layers" color="purple" title="Hours by phase" desc=${'Each phase carries its own ' + lower(labels.items) + "; shared hours (scope options, overhead, buffer) are split by each phase's share of base design."} />
        <div class="bars">${phases.map(function (ph) {
          return html`<div class="bar-row" key=${ph.phase}>
            <span class="bar-label">${ph.phase}<span>${ph.count} ${lower(plural(ph.count, labels.item, labels.items))} · ${E.fmtHours(ph.base)} base</span></span>
            <span class="bar-track"><span class="bar-fill hl" style=${'display:block;width:' + Math.max(ph.total > 0 ? 1 : 0, (ph.total / maxPh) * 100).toFixed(1) + '%'}></span></span>
            <${Hrs} v=${ph.total} ghost=${!ph.total} />
          </div>`;
        })}</div>
      </section>

      <section class="panel flush">
        <${CardHead} icon="table" color="blue" title="Breakdown" desc="How every hour adds up."
          right=${html`<button class="btn sm ghost" aria-expanded=${showSubs ? 'true' : 'false'} onClick=${function () { setShowSubs(!showSubs); }}>${showSubs ? 'Hide ' : 'Show '}${lower(labels.subs)}</button>`} />
        <div class="table-wrap"><table class="bd">
          <thead><tr><th>Line</th><th>Basis</th><th class="n">Hours</th></tr></thead>
          <tbody>
            <tr class="grp"><td colspan="3">Base design · ${lower(labels.items)}</td></tr>
            ${included.length ? null : html`<tr><td colspan="3" class="muted">No ${lower(labels.items)} added yet.</td></tr>`}
            ${included.map(function (x) {
              var it = x.item, mult = x.mult * x.qty, subs = it.subs || [];
              var basis = [];
              if (x.qty !== 1) basis.push('×' + E.fmtNum(x.qty));
              if (x.mult !== 1) basis.push((draft.snapshot.complexity || []).filter(function (c) { return c.id === it.complexity; }).map(function (c) { return c.name; })[0] + ' ×' + E.fmtNum(x.mult));
              return [html`<tr key=${it.key}><td><bdi>${it.name}</bdi> <span class="paren">(<bdi>${it.categoryName}</bdi>${it.custom ? ', custom' : ''})</span></td><td class="why">${basis.join(' · ') || (subs.length ? subs.length + ' ' + lower(plural(subs.length, labels.sub, labels.subs)) : '')}</td><td class="n">${E.fmtHours(x.total)}</td></tr>`]
                .concat(showSubs && E.num(it.hours) > 0 && subs.length ? [html`<tr class="sub" key=${it.key + '-base'}><td>Base hours</td><td></td><td class="n">${E.fmtHours(E.num(it.hours) * mult)}</td></tr>`] : [])
                .concat(showSubs ? subs.map(function (s) { return html`<tr class="sub" key=${s.key}><td>${s.name}</td><td></td><td class="n">${E.fmtHours(E.num(s.hours) * mult)}</td></tr>`; }) : []);
            })}
            <tr class="subtotal"><td colspan="2">Base design</td><td class="n">${E.fmtHours(E.round(res.base, 1))}</td></tr>
            ${res.optionLines.filter(function (o) { return o.rule !== 'none'; }).length || res.customLines.length ? html`<tr class="grp"><td colspan="3">Adaptations & add-ons</td></tr>` : null}
            ${res.optionLines.filter(function (o) { return o.rule !== 'none'; }).map(function (o) {
              return html`<tr key=${o.optionId}><td>${o.name} <span class="paren">(${o.groupName})</span></td><td class="why">${why(o)}</td><td class="n">${E.fmtHours(o.hours)}</td></tr>`;
            })}
            ${res.customLines.map(function (c) { return html`<tr key=${c.key}><td>${c.name} <span class="paren">(custom deliverable)</span></td><td class="why">${E.fmtNum(c.qty)} × ${E.fmtHours(c.unit)}</td><td class="n">${E.fmtHours(c.hours)}</td></tr>`; })}
            <tr class="subtotal"><td colspan="2">Design subtotal</td><td class="n">${E.fmtHours(E.round(res.designSubtotal, 1))}</td></tr>
            ${res.overheadLines.length ? html`<tr class="grp"><td colspan="3">Project overhead</td></tr>` : null}
            ${res.overheadLines.map(function (o) { return html`<tr key=${o.id}><td>${o.name}</td><td class="why">${o.rule === 'percent' ? E.fmtNum(o.value) + '% of design subtotal' : 'Fixed'}</td><td class="n">${E.fmtHours(o.hours)}</td></tr>`; })}
            <tr class="subtotal"><td colspan="2">Subtotal</td><td class="n">${E.fmtHours(E.round(res.subtotal, 1))}</td></tr>
            <tr><td>Buffer</td><td class="why">${E.fmtNum(res.bufferPercent)}% of subtotal</td><td class="n">${E.fmtHours(E.round(res.buffer, 1))}</td></tr>
            <tr class="total"><td colspan="2">Total</td><td class="n">${E.fmtHours(E.round(res.total, 1))}</td></tr>
          </tbody>
        </table></div>
      </section>

      <section class="panel flush">
        <${CardHead} icon="pack" color="orange" title="Deliverables" desc="What the client receives, from the scope you set." />
        <div class="deliv-rows">${dl.map(function (d, i) {
          return html`<div class="deliv-row" key=${d.group}>${delivTile(d, i)}<div class="t"><b><bdi>${d.group}</bdi></b> <span class="paren">(<bdi>${d.text}</bdi>)</span></div></div>`;
        })}</div>
      </section>

      <section class="panel panel-pad">
        <${CardHead} icon="sliders" color="orange" title="Overhead & buffer" desc="Project-level time for this estimate. Defaults come from Settings." />
        <div class="adjust">
          ${(draft.overhead || []).map(function (o, i) {
            var line = res.overheadLines.filter(function (l) { return l.id === o.id; })[0];
            return html`<div class="adj-row" key=${o.id}>
              <${Switch} id=${'oh-' + o.id} label=${o.name} checked=${o.enabled} onChange=${function (v) { p.change(function (n) { n.overhead[i].enabled = v; }); }} />
              <div class="grow"><div>${o.name}</div><div class="opt-hint">${o.rule === 'percent' ? '% of design subtotal' : 'Fixed hours'}${o.description ? ' · ' + o.description : ''}</div></div>
              <${Stepper} value=${E.num(o.value)} step=${o.rule === 'percent' ? 1 : 0.5} max=${o.rule === 'percent' ? 100 : 1000} label=${o.name} unit=${o.rule === 'percent' ? '%' : 'h'} disabled=${!o.enabled} onChange=${function (v) { p.change(function (n) { n.overhead[i].value = v; }); }} />
              <${Hrs} v=${line ? line.hours : 0} ghost=${!o.enabled} />
            </div>`;
          })}
          <div class="adj-row">
            <div class="grow"><div>Buffer</div><div class="opt-hint">% of subtotal, for unknowns and risk</div></div>
            <${Seg} label="Buffer quick picks" options=${bufferPicks.map(function (v) { return { value: v, label: E.fmtNum(v) + '%' }; })} value=${E.num(draft.bufferPercent)} onChange=${function (v) { p.change(function (n) { n.bufferPercent = v; }); }} />
            <${Stepper} value=${E.num(draft.bufferPercent)} step=${1} max=${100} label="Buffer percent" unit="%" onChange=${function (v) { p.change(function (n) { n.bufferPercent = v; }); }} />
            <${Hrs} v=${res.buffer} />
          </div>
        </div>
      </section>

      <div>
        <div class="eyebrow" style="margin:4px 0 10px">Assumptions register</div>
        <div class="reg-grid">${E.REGISTER_KINDS.map(function (k) { return html`<${RegPanel} key=${k.id} render=${regList} kind=${k} />`; })}</div>
      </div>

      ${oos.length ? html`<section class="panel flush">
        <${CardHead} icon="xCircle" color="gray" title="Out of scope" desc="Marked Won't have. Listed in the export, not counted in the total." />
        <div class="table-wrap"><table class="bd"><tbody>${oos.map(function (o, i) { return html`<tr key=${i}><td><bdi>${o.name}</bdi> <span class="paren">(<bdi>${o.category}</bdi>)</span></td><td class="n">${E.fmtHours(o.hours)}</td></tr>`; })}</tbody></table></div>
      </section>` : null}

      <${PackagesPanel} draft=${draft} change=${p.change} labels=${labels} />
      <${TracePanel} draft=${draft} change=${p.change} labels=${labels} ctx=${ctx} />
      <${VersionsPanel} ctx=${ctx} id=${p.id} draft=${draft} change=${p.change} />
      <${ActualsPanel} ctx=${ctx} draft=${draft} res=${res} change=${p.change} labels=${labels} />

      <section class="panel panel-pad">
        <${CardHead} icon="download" color="green" title="Export" desc="Spreadsheets for your team (both import into Google Sheets and open in Excel), and a client-ready proposal." />
        <div class="export-grid">
          <button class="export-btn" onClick=${function () { p.goStep('proposal'); }}><${Tile} icon="file" color="purple" /><span class="t"><b>Client proposal</b><span>A Word document with scope, deliverables, timeline and assumptions, ready to send. Preview and adjust it first.</span></span></button>
          <button class="export-btn" disabled=${!!p.exporting} onClick=${function () { p.onExport('xlsx'); }}><${Tile} icon="table" color="green" /><span class="t"><b>${p.exporting === 'xlsx' ? 'Preparing workbook…' : 'Excel workbook'}</b><span>Summary, Breakdown and Assumptions sheets. Totals are live formulas, so changing a quantity recalculates everything.</span></span></button>
          <button class="export-btn" disabled=${!!p.exporting} onClick=${function () { p.onExport('csv'); }}><${Tile} icon="file" color="blue" /><span class="t"><b>${p.exporting === 'csv' ? 'Preparing file…' : 'CSV table'}</b><span>One flat table of every line, subtotal and the total. Works in any spreadsheet.</span></span></button>
        </div>
      </section>`;
  }
  // Wrapper so each register list keeps its own hook state.
  function RegPanel(p) { return p.render(p.kind); }

  // ================================================================== v2: packages, versions, traceability, briefs, proposal
  function PackagesPanel(p) {
    var d = p.draft, pk = E.packagesOf(d), labels = p.labels;
    var rows = pk.enabled ? E.packageBreakdown(d) : null;
    function setPk(fn) { p.change(function (n) { n.packages = Object.assign({ enabled: false, names: E.TIER_NAMES.slice() }, n.packages || {}); n.packages.names = E.packagesOf(n).names.slice(); fn(n.packages); }); }
    return html`<section class="panel panel-pad">
      <${CardHead} icon="pack" color="purple" title="Packages" desc="Offer the client Basic, Standard and Premium versions of this scope. Each item sits in the smallest package that includes it; set it in Build."
        right=${html`<label class="check-line" style="font-size:13px"><${Switch} id="pk-on" label="Offer packages" checked=${pk.enabled} onChange=${function (v) { setPk(function (x) { x.enabled = v; }); }} /> Offer packages</label>`} />
      ${pk.enabled ? html`<div class="pk-grid">${rows.map(function (r, i) {
        return html`<div class=${'pk-col' + (i === 2 ? ' top' : '')} key=${i}>
          <input class="input sm pk-name" maxlength="40" aria-label=${'Package ' + (i + 1) + ' name'} value=${pk.names[i]} onInput=${function (e) { var v = e.target.value; setPk(function (x) { x.names[i] = v; }); }} />
          <div class="pk-total"><span class="num">${E.fmtNum(E.round(r.total, 1))}</span><span class="u">h</span></div>
          <div class="pk-meta">${E.fmtNum(r.count)} ${lower(plural(r.count, labels.item, labels.items))}${i ? html` · <span class="up">+${E.fmtHours(E.round(r.total - rows[i - 1].total, 1))}</span>` : null}</div>
          <div class="pk-adds"><b>${i ? 'Adds' : 'Includes'}</b> ${r.added.length ? r.added.slice(0, 5).map(function (a) { return a.name; }).join(', ') + (r.added.length > 5 ? ' and ' + (r.added.length - 5) + ' more' : '') : html`<span class="muted">${i ? 'nothing yet. Open an item in Build and choose ' + pk.names[i] + '.' : 'nothing yet'}</span>`}</div>
        </div>`;
      })}</div>` : html`<p class="muted" style="font-size:13px">Off: the client sees one estimate with everything in scope.</p>`}
    </section>`;
  }

  function DiffView(p) {
    var d = p.diff;
    var sign = function (v) { var r = E.round(v, 1); return (r > 0 ? '+' : r < 0 ? '−' : '±') + E.fmtHours(Math.abs(r)); };
    return html`<div class="diff">
      <div class="diff-sum">
        <span class=${'delta ' + (d.delta > 0.05 ? 'up' : d.delta < -0.05 ? 'down' : '')}>${sign(d.delta)}</span>
        <span>${E.fmtHours(E.round(d.before, 1))} → ${E.fmtHours(E.round(d.after, 1))}</span>
        <span class="muted">${d.counts.added} added · ${d.counts.removed} removed · ${d.counts.changed} changed</span>
      </div>
      ${d.rows.length ? html`<div class="table-wrap"><table class="bd">
        <thead><tr><th>Line</th><th>What changed</th><th class="n">Before</th><th class="n">Now</th><th class="n">Change</th></tr></thead>
        <tbody>${d.rows.map(function (r, i) {
          return html`<tr key=${i} class=${'df-' + r.status}><td><span class=${'df-tag ' + r.status}>${r.status}</span> <bdi>${r.name}</bdi></td><td class="why">${r.notes.join(' · ')}</td><td class="n">${r.before ? E.fmtHours(E.round(r.before, 1)) : '—'}</td><td class="n">${r.after ? E.fmtHours(E.round(r.after, 1)) : '—'}</td><td class=${'n ' + (r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : '')}>${sign(r.delta)}</td></tr>`;
        })}
        ${d.lines.slice(1, 4).filter(function (l) { return Math.abs(l.delta) > 0.05; }).map(function (l) { return html`<tr class="subtotal" key=${l.label}><td colspan="2">${l.label}</td><td class="n">${E.fmtHours(E.round(l.before, 1))}</td><td class="n">${E.fmtHours(E.round(l.after, 1))}</td><td class=${'n ' + (l.delta > 0 ? 'up' : 'down')}>${sign(l.delta)}</td></tr>`; })}
        </tbody></table></div>` : html`<p class="muted" style="font-size:13px;padding:4px 0">No line changes${Math.abs(d.delta) > 0.05 ? '; the difference comes from scope options, overhead or buffer.' : '.'}</p>`}
    </div>`;
  }

  function VersionsPanel(p) {
    var ctx = p.ctx, id = p.id;
    var sl = useState(null), list = sl[0], setList = sl[1];
    var sc = useState(null), cmp = sc[0], setCmp = sc[1];
    var sn = useState(''), label = sn[0], setLabel = sn[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    useEffect(function () {
      if (!ctx.caps || !ctx.caps.db) return;
      var un = null;
      try { un = ctx.caps.db.collection('estimates/' + id + '/versions').orderBy('createdAt', 'desc').limit(50).onSnapshot(function (snap) { setList(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })); }, function () { setList([]); }); } catch (e) { setList([]); }
      return function () { try { if (un) un(); } catch (e) { /* ignore */ } };
    }, [id]);
    async function saveVersion(name) {
      if (busy) return false;
      setBusy(true);
      var data = clean(p.draft); delete data.updatedAt;
      var doc = { label: name, createdAt: Date.now(), createdBy: (ctx.me && ctx.me.id) || null, totalHours: E.round(E.compute(p.draft).total, 1), data: data };
      var ok = await ctx.api.set('estimates/' + id + '/versions/' + newId('ver'), doc);
      setBusy(false);
      return ok;
    }
    var next = 'v' + ((list ? list.length : 0) + 1);
    function restore(v) {
      ctx.confirm({ title: 'Restore ' + v.label + '?', body: 'The current state is saved as a version first, so you can come back to it.', confirmLabel: 'Restore',
        onConfirm: async function () {
          var ok = await saveVersion('Before restoring ' + v.label); if (!ok) return;
          p.change(function (n) { ['items', 'scope', 'customDeliverables', 'overhead', 'bufferPercent', 'register', 'hiddenAuto', 'dismissedSuggestions', 'packages', 'requirements', 'snapshot', 'serviceId', 'serviceName'].forEach(function (k) { if (v.data[k] !== undefined) n[k] = E.clone(v.data[k]); }); });
          setCmp(null); ctx.toast('Restored ' + v.label);
        } });
    }
    var cur = E.compute(p.draft).total;
    return html`<section class="panel panel-pad">
      <${CardHead} icon="clock" color="teal" title="Versions" desc="Save the estimate as it stands before sending it, then compare what changed between quotes." />
      <form class="str-row" onSubmit=${async function (e) { e.preventDefault(); var t = label.trim() || next; if (await saveVersion(t)) { setLabel(''); ctx.toast('Saved ' + t); } }}>
        <input class="input" id="ver-label" maxlength="80" placeholder=${next + ', e.g. Sent to client 18 Oct'} value=${label} onInput=${function (e) { setLabel(e.target.value); }} />
        <button class="btn" type="submit" disabled=${busy}><${Icon} name="plus" /> Save version</button>
      </form>
      ${list === null ? html`<div class="skeleton" style="width:40%;margin-top:12px"></div>` : list.length ? html`<div class="ver-list">${list.map(function (v) {
        var d = cur - E.num(v.totalHours), open = cmp === v.id;
        return html`<div key=${v.id}>
          <div class="ver-row">
            <div class="grow"><div class="ver-name"><bdi>${v.label}</bdi></div><div class="opt-hint">${ago(v.createdAt)} · ${E.fmtHours(E.num(v.totalHours))}${Math.abs(d) > 0.05 ? html` · <span class=${d > 0 ? 'up' : 'down'}>now ${d > 0 ? '+' : '−'}${E.fmtHours(E.round(Math.abs(d), 1))}</span>` : ' · same total'}</div></div>
            <button class="btn sm" aria-expanded=${open ? 'true' : 'false'} onClick=${function () { setCmp(open ? null : v.id); }}>${open ? 'Hide' : 'Compare'}</button>
            <button class="btn sm ghost" onClick=${function () { restore(v); }}>Restore</button>
            <button class="icon-btn danger" aria-label=${'Delete version ' + v.label} onClick=${function () { ctx.confirm({ title: 'Delete version ' + v.label + '?', body: 'The estimate itself is not affected.', confirmLabel: 'Delete', danger: true, onConfirm: function () { ctx.api.del('estimates/' + id + '/versions/' + v.id); } }); }}><${Icon} name="trash" /></button>
          </div>
          ${open ? html`<div class="ver-diff"><div class="eyebrow" style="margin-bottom:8px">Changes since ${v.label}</div><${DiffView} diff=${E.diffEstimates(v.data || {}, p.draft)} /></div>` : null}
        </div>`;
      })}</div>` : html`<p class="muted" style="font-size:13px;margin-top:10px">No versions yet. Save one when you send the estimate, so the next round shows what changed.</p>`}
    </section>`;
  }

  // An hours field that may be left blank (blank = not tracked yet).
  function OptHours(p) {
    var st = useState(p.value === null || p.value === undefined ? '' : E.plainNum(p.value)), text = st[0], setText = st[1];
    var focused = useRef(false);
    useEffect(function () { if (!focused.current) setText(p.value === null || p.value === undefined ? '' : E.plainNum(p.value)); }, [p.value]);
    function commit(raw) {
      var s = String(raw).trim();
      if (!s) { setText(''); if (p.value !== null && p.value !== undefined) p.onChange(null); return; }
      var n = parseFloat(s.replace(',', '.'));
      if (!isFinite(n) || n < 0) { setText(p.value === null || p.value === undefined ? '' : E.plainNum(p.value)); return; }
      n = Math.min(100000, Math.round(n * 100) / 100);
      setText(E.plainNum(n)); if (n !== p.value) p.onChange(n);
    }
    return html`<span class="opt-hours"><input class="input sm" id=${p.id} inputmode="decimal" aria-label=${p.label} placeholder=${p.placeholder || '—'} value=${text}
      onFocus=${function () { focused.current = true; }}
      onInput=${function (e) { setText(e.target.value); }}
      onBlur=${function (e) { focused.current = false; commit(e.target.value); }}
      onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(e.target.value); } }} /><span class="unit">h</span></span>`;
  }

  // F1: what the project actually took, line by line. Feeds Library → Calibrate hours.
  function ActualsPanel(p) {
    var d = p.draft, labels = p.labels, ctx = p.ctx;
    var s = E.actualsSummary(d, p.res);
    var won = d.status === 'won';
    var so = useState(false), open = so[0], setOpen = so[1];
    var sm = useState(''), sheet = sm[0], setSheet = sm[1];
    var si = useState(false), imp = si[0], setImp = si[1];
    var show = open || won || s.tracked > 0 || s.otherActual !== null;
    function setActual(key, v) { p.change(function (n) { var a = n.actuals = Object.assign({ items: {} }, n.actuals || {}); a.items = Object.assign({}, a.items || {}); if (v === null) delete a.items[key]; else a.items[key] = v; }); }
    function setOther(v) { p.change(function (n) { var a = n.actuals = Object.assign({ items: {} }, n.actuals || {}); if (v === null) delete a.other; else a.other = v; }); }
    function importSheet(t) {
      var m = E.matchActuals(d, E.parseCsv(t));
      if (!m.matched) { ctx.toast('No lines matched this estimate. Check that the first column names the ' + lower(labels.items) + '.', 'error'); return; }
      p.change(function (n) { var a = n.actuals = Object.assign({ items: {} }, n.actuals || {}); a.items = Object.assign({}, a.items || {}, m.items); if (m.unmatchedHours) a.other = E.round((a.other || 0) + m.unmatchedHours, 2); });
      ctx.toast('Filled ' + m.matched + ' ' + lower(plural(m.matched, labels.item, labels.items)) + (m.unmatched.length ? '; ' + E.fmtHours(m.unmatchedHours) + ' from ' + m.unmatched.length + ' other ' + plural(m.unmatched.length, 'line', 'lines') + ' went to project time' : ''));
      setSheet(''); setImp(false);
    }
    function pct(v) { if (v === null || !isFinite(v)) return '—'; var r = Math.round(v); return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r) + '%'; }
    function cls(v) { return v === null ? '' : v > 10 ? 'over' : v < -10 ? 'under' : 'ok'; }
    var head = html`<${CardHead} icon="gauge" color="pink" title="Actual hours" desc=${'Record what the project really took. Tracked estimates improve the library: Library → Calibrate hours reads them automatically.'}
      right=${s.tracked || s.otherActual !== null ? html`<span class=${'pill ' + (s.complete ? 's-won' : 's-review')}>${s.complete ? 'Tracked' : s.tracked + ' of ' + s.count + ' tracked'}</span>` : null} />`;
    if (!show) return html`<section class="panel panel-pad">${head}
      <div class="row" style="gap:10px"><p class="muted grow" style="font-size:13px">Usually filled in once the project is won and delivered.</p><button class="btn sm" onClick=${function () { setOpen(true); }}><${Icon} name="plus" size=${14} /> Track actual hours</button></div>
    </section>`;
    return html`<section class="panel flush act-panel">
      <div class="panel-pad" style="padding-bottom:0">${head}</div>
      ${s.tracked ? html`<div class="act-sum">
        <div><span class="eyebrow">Estimated</span><b>${E.fmtHours(E.round(s.complete ? s.estimated : s.itemsEstimated, 1))}</b></div>
        <div><span class="eyebrow">Actual</span><b>${E.fmtHours(E.round(s.complete ? s.actual : s.itemsActual, 1))}</b></div>
        <div><span class="eyebrow">Difference</span><b class=${'act-d ' + cls(s.complete ? s.pct : s.itemsPct)}>${pct(s.complete ? s.pct : s.itemsPct)}</b></div>
        <p class="opt-hint">${s.complete ? 'Whole project, including scope options, overhead and buffer.' : 'Tracked ' + lower(labels.items) + ' only. Fill every line and project time to compare the whole project.'}</p>
      </div>` : null}
      ${s.rows.length ? html`<div class="table-wrap"><table class="bd act">
        <thead><tr><th>${labels.item}</th><th class="n">Estimated</th><th class="n">Actual</th><th class="n">Difference</th></tr></thead>
        <tbody>
          ${s.rows.map(function (r) { return html`<tr key=${r.key}>
            <td><bdi>${r.name}</bdi> <span class="paren">(<bdi>${r.category}</bdi>${r.qty !== 1 ? ', ×' + E.fmtNum(r.qty) : ''})</span></td>
            <td class="n">${E.fmtHours(E.round(r.estimated, 1))}</td>
            <td class="n"><${OptHours} id=${'act-' + r.key} label=${'Actual hours for ' + r.name} value=${r.actual} onChange=${function (v) { setActual(r.key, v); }} /></td>
            <td class=${'n act-d ' + cls(r.pct)}>${r.actual === null ? '' : pct(r.pct)}</td>
          </tr>`; })}
          <tr class="subtotal"><td>Project time <span class="paren">(scope options, overhead, buffer: meetings, feedback, handoff)</span></td>
            <td class="n">${E.fmtHours(E.round(s.otherEstimated, 1))}</td>
            <td class="n"><${OptHours} id="act-other" label="Actual project time" value=${s.otherActual} onChange=${setOther} /></td>
            <td class=${'n act-d ' + cls(s.otherActual === null || !s.otherEstimated ? null : (s.otherActual - s.otherEstimated) / s.otherEstimated * 100)}>${s.otherActual === null ? '' : pct(s.otherEstimated ? (s.otherActual - s.otherEstimated) / s.otherEstimated * 100 : null)}</td>
          </tr>
        </tbody></table></div>` : html`<p class="muted panel-pad" style="font-size:13px">Add ${lower(labels.items)} in Build first.</p>`}
      <div class="panel-pad act-foot">
        ${imp ? html`<div class="stack" style="gap:8px">
          <label class="opt-hint" for="act-sheet">Paste a timesheet: one column naming the ${lower(labels.item)}, one with hours. Rows for the same ${lower(labels.item)} are added up; anything that doesn't match goes to project time.</label>
          <textarea class="textarea" id="act-sheet" rows="5" placeholder=${'Task,Hours\nHome,9\nHome,6.5\nClient call,1'} value=${sheet} onInput=${function (e) { setSheet(e.target.value); }}></textarea>
          <div class="row" style="gap:8px"><label class="btn sm ghost" style="cursor:pointer"><${Icon} name="file" size=${14} /> Open CSV<input type="file" accept=".csv,.txt,text/csv" class="sr" onChange=${function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; f.text().then(importSheet); e.target.value = ''; }} /></label>
            <span class="spacer"></span><button class="btn sm ghost" onClick=${function () { setImp(false); setSheet(''); }}>Cancel</button><button class="btn sm primary" disabled=${!sheet.trim()} onClick=${function () { importSheet(sheet); }}>Fill from timesheet</button></div>
        </div>` : html`<div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn sm" onClick=${function () { setImp(true); }}><${Icon} name="file" size=${14} /> Import timesheet</button>
          ${s.tracked || s.otherActual !== null ? html`<button class="btn sm ghost" onClick=${function () { ctx.confirm({ title: 'Clear actual hours?', body: 'Removes every actual hour recorded on this estimate.', confirmLabel: 'Clear', danger: true, onConfirm: function () { p.change(function (n) { delete n.actuals; }); setOpen(false); } }); }}>Clear</button>` : null}
          ${!won ? html`<span class="opt-hint" style="margin-left:auto">Tip: set the status to Won when the project goes ahead.</span>` : null}
        </div>`}
      </div>
    </section>`;
  }

  function nextReqId(reqs) { var n = 0; reqs.forEach(function (q) { var m = /^R(\d+)$/.exec(q.id); if (m) n = Math.max(n, +m[1]); }); return n + 1; }
  function TracePanel(p) {
    var d = p.draft, reqs = E.requirementsOf(d), tm = E.traceMatrix(d);
    var st = useState(''), text = st[0], setText = st[1];
    function add(t) { p.change(function (n) { var list = E.requirementsOf(n); list.push({ id: 'R' + nextReqId(list), text: t, source: 'Manual' }); n.requirements = list; }); }
    function covered(id) { return tm.rows.filter(function (r) { return r.req.id === id; })[0]; }
    var uncovered = tm.rows.filter(function (r) { return !r.items.some(function (i) { return i.included; }); }).length;
    return html`<section class="panel panel-pad">
      <${CardHead} icon="link" color="blue" title="Requirements" desc="What the client asked for, and which items cover it. Analyze a brief in Build, or add them here." right=${reqs.length ? html`<span class=${'pill ' + (uncovered ? 's-review' : 's-won')}>${uncovered ? uncovered + ' not covered' : 'All covered'}</span>` : null} />
      ${reqs.length ? html`<div class="req-list">${reqs.map(function (q) {
        var row = covered(q.id), items = row ? row.items : [];
        return html`<div class="req-row" key=${q.id}>
          <span class="req-id">${q.id}</span>
          <div class="grow"><div class="req-text"><bdi>${q.text}</bdi></div>
            <div class="opt-hint">${items.length ? items.map(function (i) { return i.name + (i.included ? '' : " (won't have)"); }).join(', ') : html`<span class="req-miss">Not covered</span>`}</div></div>
          ${items.length ? null : html`<button class="btn sm" onClick=${function () { p.change(function (n) { var it = E.customItem(q.text.length > 70 ? q.text.slice(0, 67) + '…' : q.text, 4, 'custom', 'Custom', n); it.reqs = [q.id]; n.items.push(it); }); p.ctx.toast('Added a custom ' + lower(p.labels.item) + ' for ' + q.id); }}><${Icon} name="plus" size=${14} /> Custom ${lower(p.labels.item)}</button>`}
          <button class="icon-btn danger" aria-label=${'Remove requirement ' + q.id} onClick=${function () { p.change(function (n) { n.requirements = E.requirementsOf(n).filter(function (x) { return x.id !== q.id; }); n.items.forEach(function (it) { if (it.reqs) it.reqs = it.reqs.filter(function (z) { return z !== q.id; }); }); }); }}><${Icon} name="trash" /></button>
        </div>`;
      })}</div>` : null}
      ${tm.unlinked.length && reqs.length ? html`<p class="opt-hint" style="margin-top:8px">${tm.unlinked.length} ${lower(plural(tm.unlinked.length, p.labels.item, p.labels.items))} not linked to a requirement. Link them from each item in Build.</p>` : null}
      <form class="str-row" style="margin-top:10px" onSubmit=${function (e) { e.preventDefault(); var t = text.trim(); if (!t) return; add(t); setText(''); }}>
        <input class="input" id="req-new" maxlength="300" placeholder="Add a requirement, e.g. Customers can track their order" value=${text} onInput=${function (e) { setText(e.target.value); }} />
        <button class="btn" type="submit"><${Icon} name="plus" /> Add</button>
      </form>
    </section>`;
  }
  function ReqLinks(p) {
    var reqs = E.requirementsOf(p.draft), mine = (p.it.reqs || []).filter(function (id) { return reqs.some(function (q) { return q.id === id; }); });
    var rest = reqs.filter(function (q) { return mine.indexOf(q.id) < 0; });
    return html`<div class="ctl"><span class="ctl-label">Requirements</span>
      <div class="chips">
        ${mine.map(function (id) { var q = reqs.filter(function (x) { return x.id === id; })[0]; return html`<span class="chip req-chip" key=${id} title=${q.text}><b>${id}</b> <span class="req-chip-t">${q.text}</span><button type="button" class="x" aria-label=${'Unlink ' + id} onClick=${function () { p.upd(function (t) { t.reqs = (t.reqs || []).filter(function (z) { return z !== id; }); }); }}><${Icon} name="x" size=${12} /></button></span>`; })}
        ${rest.length ? html`<select class="select sm" style="width:auto;max-width:100%" aria-label="Link a requirement" value="" onChange=${function (e) { var v = e.target.value; if (!v) return; p.upd(function (t) { t.reqs = (t.reqs || []).concat(v); }); }}>
          <option value="">Link a requirement…</option>${rest.map(function (q) { return html`<option value=${q.id}>${q.id} · ${q.text.length > 60 ? q.text.slice(0, 57) + '…' : q.text}</option>`; })}</select>` : null}
      </div></div>`;
  }

  // A1: Claude reads a brief and maps it onto this service's library. The person reviews every line before anything is added.
  function briefPrompt(draft, service, text) {
    var cats = {}; (service.categories || []).forEach(function (c) { cats[c.id] = c.name; });
    var libLines = (service.items || []).map(function (li) { return li.id + ' | ' + (cats[li.categoryId] || 'Other') + ' | ' + li.name + (li.description ? ' — ' + String(li.description).slice(0, 110) : ''); }).join('\n');
    var groups = ((draft.snapshot && draft.snapshot.optionGroups) || []).map(function (g) { return g.id + ' (' + g.name + (g.selection === 'single' ? ', pick one' : '') + '): ' + (g.options || []).map(function (o) { return o.id + '=' + o.name + (o.input === 'quantity' && g.selection !== 'single' ? ' [number]' : ''); }).join('; '); }).join('\n');
    return [
      'You help a design agency scope ' + (service.name || 'design') + ' work from a client brief. Map the brief onto the agency\'s library.',
      '', 'LIBRARY (id | group | name — definition):', libLines,
      '', 'GROUP IDS: ' + (service.categories || []).map(function (c) { return c.id + '=' + c.name; }).join('; '),
      '', 'SCOPE OPTIONS (group id: option id=name):', groups || '(none)',
      '', 'BRIEF:', '"""', text, '"""', '',
      'Reply with only JSON in this shape:',
      '{"requirements":[{"id":"R1","text":"short quote or close paraphrase of one need in the brief, max 160 characters"}],',
      ' "matches":[{"libId":"a library id from the list","qty":1,"reqs":["R1"],"why":"max 80 characters"}],',
      ' "custom":[{"name":"page or feature name","hours":4,"group":"a group id or custom","reqs":["R2"],"why":"max 80 characters"}],',
      ' "scope":[{"group":"option group id","option":"option id","value":true,"reqs":["R3"]}],',
      ' "questions":["a real ambiguity to ask the client"]}',
      'Rules: one requirement per distinct need (at most 40). Use only library ids from the list. Use custom only when nothing in the library fits, with hours similar to comparable library items. qty above 1 only when the brief names several of the same page or feature. For [number] options give a number. At most 6 questions. Write in the brief\'s language.',
    ].join('\n');
  }
  var SAMPLE_ERR = {
    not_granted: 'Claude was not allowed for this page. Allow it when asked, then try again.', not_declared: 'Claude is not available for this app yet.',
    sampling_disabled: 'Claude is not available for this account.', rate_limited: 'Too many requests right now. Wait a minute and try again.',
    prompt_too_large: 'That brief is too long. Paste the most relevant part (about 40 pages of text at most).', invalid_json: 'Claude\'s answer could not be read. Try again.',
    refused: 'Claude could not analyze this brief.', empty_completion: 'Claude returned nothing. Try again.', session_expired: 'Your session expired. Reload the page and try again.',
  };
  function BriefPanel(p) {
    var ctx = p.ctx, service = p.service, draft = p.draft, labels = p.labels;
    var so = useState(false), open = so[0], setOpen = so[1];
    var st = useState(''), text = st[0], setText = st[1];
    var ss = useState('idle'), state = ss[0], setState = ss[1];
    var se = useState(''), err = se[0], setErr = se[1];
    var sr = useState(null), result = sr[0], setResult = sr[1];
    var sp = useState({}), pick = sp[0], setPick = sp[1];
    var ctl = useRef(null);
    var libById = {}; (service.items || []).forEach(function (li) { libById[li.id] = li; });
    var have = {}; draft.items.forEach(function (it) { if (it.libId) have[it.libId] = it; });
    function tidy(raw) {
      var r = raw && typeof raw === 'object' ? raw : {};
      var reqs = (Array.isArray(r.requirements) ? r.requirements : []).filter(function (q) { return q && q.id && q.text; }).slice(0, 40).map(function (q) { return { id: String(q.id), text: String(q.text).slice(0, 300) }; });
      var ids = {}; reqs.forEach(function (q) { ids[q.id] = 1; });
      var rq = function (a) { return (Array.isArray(a) ? a : []).map(String).filter(function (x) { return ids[x]; }); };
      var seen = {};
      var matches = (Array.isArray(r.matches) ? r.matches : []).filter(function (m) { if (!m || !libById[m.libId] || seen[m.libId]) return false; seen[m.libId] = 1; return true; }).map(function (m) { return { libId: m.libId, qty: Math.min(99, Math.max(1, Math.round(E.num(m.qty, 1)))), reqs: rq(m.reqs), why: String(m.why || '').slice(0, 120) }; });
      var catIds = (service.categories || []).map(function (c) { return c.id; });
      var custom = (Array.isArray(r.custom) ? r.custom : []).filter(function (c) { return c && String(c.name || '').trim(); }).slice(0, 30).map(function (c) { return { name: String(c.name).trim().slice(0, 200), hours: Math.min(1000, Math.max(0, E.round(E.num(c.hours, 4), 2))), group: catIds.indexOf(c.group) >= 0 ? c.group : 'custom', reqs: rq(c.reqs), why: String(c.why || '').slice(0, 120) }; });
      var groups = (draft.snapshot && draft.snapshot.optionGroups) || [];
      var scope = (Array.isArray(r.scope) ? r.scope : []).map(function (x) { var g = groups.filter(function (gg) { return gg.id === (x && x.group); })[0]; var o = g && (g.options || []).filter(function (oo) { return oo.id === x.option; })[0]; if (!o) return null; var qty = g.selection !== 'single' && o.input === 'quantity'; var v = qty ? Math.min(E.num(o.max, 99), Math.max(E.num(o.min, 0), Math.round(E.num(x.value, 1)))) : true; return { group: g.id, option: o.id, value: v, label: qty ? g.name + ': ' + o.name + ' ' + v : g.name + ': ' + o.name, reqs: rq(x && x.reqs) }; }).filter(Boolean);
      var questions = (Array.isArray(r.questions) ? r.questions : []).map(function (q) { return String(q).trim().slice(0, 300); }).filter(Boolean).slice(0, 6);
      return { requirements: reqs, matches: matches, custom: custom, scope: scope, questions: questions };
    }
    async function analyze() {
      var t = text.trim(); if (!t || state === 'busy') return;
      setErr(''); setResult(null); setState('busy');
      ctl.current = new AbortController();
      try {
        var raw = await ctx.sample.json(briefPrompt(draft, service, t.slice(0, 120000)), { signal: ctl.current.signal });
        var res = tidy(raw);
        var pk = {};
        res.matches.forEach(function (m, i) { pk['m' + i] = true; }); res.custom.forEach(function (c, i) { pk['c' + i] = true; }); res.scope.forEach(function (x, i) { pk['s' + i] = true; }); res.questions.forEach(function (q, i) { pk['q' + i] = true; });
        setPick(pk); setResult(res); setState('done');
      } catch (e) {
        setState('idle');
        if (e && e.code === 'cancelled') return;
        setErr(SAMPLE_ERR[e && e.code] || 'The brief could not be analyzed. Try again in a moment.');
      }
    }
    function apply() {
      var r = result; if (!r) return;
      var n0 = 0;
      p.change(function (n) {
        var list = E.requirementsOf(n), base = nextReqId(list), map = {};
        r.requirements.forEach(function (q, i) { var nid = 'R' + (base + i); map[q.id] = nid; list.push({ id: nid, text: q.text, source: 'Brief' }); });
        n.requirements = list;
        var m2 = function (a) { return a.map(function (x) { return map[x]; }).filter(Boolean); };
        r.matches.forEach(function (m, i) {
          if (!pick['m' + i]) return;
          var ex = n.items.filter(function (it) { return it.libId === m.libId; })[0];
          if (ex) { ex.reqs = (ex.reqs || []).concat(m2(m.reqs)).filter(function (v, j, a) { return a.indexOf(v) === j; }); return; }
          var it = E.copyItem(service, libById[m.libId], n); if (m.qty > 1) it.qty = m.qty; it.reqs = m2(m.reqs); n.items.push(it); n0++;
        });
        r.custom.forEach(function (c, i) { if (!pick['c' + i]) return; var it = E.customItem(c.name, c.hours, c.group, c.group === 'custom' ? 'Custom' : E.categoryName(service, c.group), n); it.reqs = m2(c.reqs); n.items.push(it); n0++; });
        r.scope.forEach(function (x, i) {
          if (!pick['s' + i]) return;
          var g = n.snapshot.optionGroups.filter(function (gg) { return gg.id === x.group; })[0]; if (!g) return;
          n.scope = n.scope || { values: {}, choice: {} };
          if (g.selection === 'single') { n.scope.choice = n.scope.choice || {}; n.scope.choice[g.id] = x.option; } else { n.scope.values = n.scope.values || {}; n.scope.values[x.option] = x.value; }
        });
        r.questions.forEach(function (q, i) { if (!pick['q' + i]) return; n.register = n.register || {}; n.register.dependencies = (n.register.dependencies || []).concat({ id: E.uid('d'), text: 'Open question: ' + q }); });
      });
      ctx.toast('Added ' + r.requirements.length + ' ' + plural(r.requirements.length, 'requirement', 'requirements') + ' and the lines you kept. Each is linked in Review → Requirements.');
      setResult(null); setText(''); setState('idle'); setOpen(false);
    }
    function toggle(k) { setPick(function (x) { var c = Object.assign({}, x); c[k] = !x[k]; return c; }); }
    function line(k, title, meta, extra) { return html`<label class="brief-line" key=${k}><input type="checkbox" class="cb" checked=${!!pick[k]} onChange=${function () { toggle(k); }} /><span class="grow"><span class="brief-t"><bdi>${title}</bdi>${extra || null}</span>${meta ? html`<span class="opt-hint">${meta}</span>` : null}</span></label>`; }
    if (!open) return html`<button class="brief-cta" onClick=${function () { setOpen(true); }}><${Tile} icon="sparkles" color="purple" /><span class="t"><b>Analyze a client brief</b><span>Paste a brief, RFP or call notes. Claude suggests ${lower(labels.items)} from your library and links each to the line it came from.</span></span><${Icon} name="arrowR" /></button>`;
    var nsel = Object.keys(pick).filter(function (k) { return pick[k] && k[0] !== 'q'; }).length;
    return html`<section class="panel panel-pad brief" aria-label="Brief analyzer">
      <${CardHead} icon="sparkles" color="purple" title="Analyze a client brief" desc="Claude reads the brief against this service's library. Nothing is added until you review it." right=${html`<button class="icon-btn" aria-label="Close brief analyzer" onClick=${function () { if (ctl.current) ctl.current.abort(); setOpen(false); }}><${Icon} name="x" /></button>`} />
      ${!result ? html`<div class="stack" style="gap:10px">
        <textarea class="textarea brief-text" id="brief-text" maxlength="120000" placeholder="Paste the brief, RFP or meeting notes here" value=${text} onInput=${function (e) { setText(e.target.value); }} disabled=${state === 'busy'}></textarea>
        <div class="row" style="gap:10px;align-items:center">
          <label class="btn sm ghost" style="cursor:pointer"><${Icon} name="file" size=${14} /> Open a .txt or .md file<input type="file" accept=".txt,.md,.markdown,.csv,text/plain" class="sr" onChange=${function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 2e6) { setErr('That file is larger than 2 MB. Paste the relevant part instead.'); return; } f.text().then(function (t) { setText(t.slice(0, 120000)); }); e.target.value = ''; }} /></label>
          <span class="spacer"></span>
          ${state === 'busy' ? html`<span class="thinking"><span class="dotpulse"></span>Reading the brief…</span><button class="btn sm" onClick=${function () { if (ctl.current) ctl.current.abort(); }}>Stop</button>`
            : html`<button class="btn primary" disabled=${!text.trim()} onClick=${analyze}><${Icon} name="sparkles" size=${15} /> Analyze</button>`}
        </div>
        ${err ? html`<div class="banner bad"><${Icon} name="alert" /><div class="grow">${err}</div></div>` : null}
      </div>` : html`<div class="brief-res">
        <p class="opt-hint" style="margin-bottom:10px">Found ${result.requirements.length} ${plural(result.requirements.length, 'requirement', 'requirements')}. Untick anything that doesn't belong.</p>
        ${result.matches.length ? html`<div class="eyebrow">From your library</div>${result.matches.map(function (m, i) { var li = libById[m.libId]; return line('m' + i, li.name, (m.reqs.length ? m.reqs.join(', ') + ' · ' : '') + (have[m.libId] ? 'already in this estimate, will be linked' : m.why), m.qty > 1 ? html`<span class="qty-badge">×${m.qty}</span>` : null); })}` : null}
        ${result.custom.length ? html`<div class="eyebrow">New custom ${lower(labels.items)}</div>${result.custom.map(function (c, i) { return line('c' + i, c.name, (c.reqs.length ? c.reqs.join(', ') + ' · ' : '') + E.fmtHours(c.hours) + (c.why ? ' · ' + c.why : '')); })}` : null}
        ${result.scope.length ? html`<div class="eyebrow">Scope options</div>${result.scope.map(function (x, i) { return line('s' + i, x.label, x.reqs.join(', ')); })}` : null}
        ${result.questions.length ? html`<div class="eyebrow">Questions for the client <span class="paren">(added to dependencies)</span></div>${result.questions.map(function (q, i) { return line('q' + i, q, ''); })}` : null}
        <details class="brief-reqs"><summary>Requirements found (${result.requirements.length})</summary><ol>${result.requirements.map(function (q) { return html`<li key=${q.id}><b>${q.id}</b> <bdi>${q.text}</bdi></li>`; })}</ol></details>
        <div class="row" style="margin-top:12px;gap:8px"><button class="btn ghost" onClick=${function () { setResult(null); setState('idle'); }}>Back to the brief</button><span class="spacer"></span><button class="btn primary" onClick=${apply}><${Icon} name="check" size=${15} /> Add ${nsel} ${plural(nsel, 'line', 'lines')} and the requirements</button></div>
      </div>`}
    </section>`;
  }

  function ProposalView(p) {
    var ctx = p.ctx, d = p.draft, pr = d.proposal || {};
    var m = E.proposalModel(d, { agency: ctx.settings.agencyName || '', preparedBy: (ctx.me && ctx.me.name) || '', date: today() });
    function set(k, v) { p.change(function (n) { n.proposal = Object.assign({}, n.proposal || {}); n.proposal[k] = v; }); }
    var hrs = function (v) { return E.fmtHours(E.round(v, 1)); }, wk = function (v) { var r = E.round(v, 1); return E.fmtNum(r) + (r === 1 ? ' week' : ' weeks'); };
    return html`<div class="proposal-layout">
      <aside class="panel panel-pad prop-opts">
        <div class="crumbs" style="margin-bottom:6px"><button onClick=${function () { p.goStep('review'); }}><${Icon} name="arrowL" size=${12} /> Back to review</button></div>
        <h2 style="font-size:17px">Client proposal</h2>
        <p class="muted" style="font-size:13px;margin:2px 0 14px">What the client sees. Edits here change only the proposal.</p>
        <label class="field"><span>Introduction</span><textarea class="textarea" id="prop-intro" maxlength="2000" rows="5" placeholder=${m.intro} value=${pr.intro || ''} onInput=${function (e) { set('intro', e.target.value); }}></textarea></label>
        <label class="check-line" style="margin-top:12px"><${Switch} id="prop-hours" label="Show hours per line" checked=${pr.showLineHours !== false} onChange=${function (v) { set('showLineHours', v); }} /> Show hours per line</label>
        <label class="field" style="margin-top:12px"><span>Design hours per week (for durations)</span><${Stepper} id="prop-cap" value=${E.num(pr.capacity, 40)} step=${1} min=${1} max=${400} unit="h" label="Hours per week" onChange=${function (v) { set('capacity', v); }} /></label>
        <label class="field" style="margin-top:12px"><span>Valid for</span><${Stepper} id="prop-valid" value=${E.num(pr.validDays, 30)} step=${1} min=${0} max=${365} unit="days" label="Valid for days" onChange=${function (v) { set('validDays', v); }} /></label>
        <button class="btn primary" style="width:100%;margin-top:18px" disabled=${!!p.exporting} onClick=${function () { p.onExport('docx'); }}><${Icon} name="download" /> ${p.exporting === 'docx' ? 'Preparing document…' : 'Download Word document'}</button>
        <p class="opt-hint" style="margin-top:8px">Opens in Word, Pages and Google Docs, where you can add your letterhead and save as PDF.</p>
      </aside>
      <article class="paper" aria-label="Proposal preview">
        ${m.agency ? html`<div class="paper-eyebrow">${m.agency}</div>` : null}
        <h1 class="paper-title"><bdi>${m.title}</bdi></h1>
        <p class="paper-meta">${[m.client ? 'Prepared for ' + m.client : '', m.date, m.preparedBy ? 'by ' + m.preparedBy : ''].filter(Boolean).join(' · ')}</p>
        <p class="paper-intro">${m.intro}</p>
        <h2>Summary</h2>
        <table class="paper-table"><tbody>${m.summary.map(function (r) { return html`<tr key=${r[0]}><td>${r[0]}</td><td class="n">${hrs(r[1])}</td></tr>`; })}<tr class="tot"><td>Total</td><td class="n">${hrs(m.total)}</td></tr></tbody></table>
        <p class="paper-note">About ${wk(m.weeks)} at ${E.fmtNum(m.capacity)} design hours a week.</p>
        ${m.packages ? html`<h2>Packages</h2><div class="paper-pk">${m.packages.map(function (pk, i) { return html`<div key=${i}><b>${pk.name}</b><span class="n">${hrs(pk.total)}</span><span class="paper-note">${wk(pk.weeks)}${i ? ' · everything in ' + m.packageNames[i - 1] + (pk.added.length ? ', plus ' + pk.added.slice(0, 4).join(', ') + (pk.added.length > 4 ? ' and ' + (pk.added.length - 4) + ' more' : '') : '') : ''}</span></div>`; })}</div>` : null}
        <h2>Scope</h2>
        ${m.scope.map(function (c) { return html`<div class="paper-cat" key=${c.name}><h3><bdi>${c.name}</bdi>${m.showHours ? html`<span class="n">${hrs(c.hours)}</span>` : null}</h3><ul>${c.items.map(function (it, i) { return html`<li key=${i}><span class="li-head"><bdi>${it.name}</bdi>${it.qty > 1 ? ' ×' + E.fmtNum(it.qty) : ''}${m.packages && it.tier ? html` <span class="mini pk">${m.packageNames[it.tier]}</span>` : null}${m.showHours ? html`<span class="n">${hrs(it.hours)}</span>` : null}</span>${it.description || it.subs.length ? html`<span class="li-sub">${it.description}${it.subs.length ? (it.description ? ' ' : '') + m.labels.subs + ': ' + it.subs.join(', ') + '.' : ''}</span>` : null}</li>`; })}</ul></div>`; })}
        ${m.scope.length ? null : html`<p class="paper-note">No ${lower(m.labels.items)} in scope yet.</p>`}
        <h2>Deliverables</h2><ul>${m.deliverables.map(function (x) { return html`<li key=${x.group}><b><bdi>${x.group}</bdi>:</b> <bdi>${x.text}</bdi></li>`; })}</ul>
        ${m.timeline.length ? html`<h2>Timeline</h2><table class="paper-table"><tbody>${m.timeline.map(function (t) { return html`<tr key=${t.phase}><td>${t.phase}</td><td class="n">${hrs(t.hours)}</td><td class="n">${wk(t.weeks)}</td></tr>`; })}</tbody></table>` : null}
        ${E.REGISTER_KINDS.map(function (k) { var l = m.register[k.id]; return l.length ? html`<div key=${k.id}><h2>${k.name}</h2><ul>${l.map(function (t, i) { return html`<li key=${i}><bdi>${t}</bdi></li>`; })}</ul></div>` : null; })}
        ${m.outOfScope.length ? html`<h2>Not included</h2><ul>${m.outOfScope.map(function (t, i) { return html`<li key=${i}>${t}</li>`; })}</ul>` : null}
        <h2>Validity and acceptance</h2>
        <p>This estimate is valid for ${m.validDays} days from ${m.date}. Hours are estimates based on the scope above; changes to scope are estimated separately.</p>
        <div class="paper-sign"><span>Accepted for ${m.client || 'the client'}</span><span>Date</span></div>
      </article>
    </div>`;
  }

  // Calibrate the library from what past projects actually took.
  function CalibrateTab(p) {
    var svc = p.svc, labels = p.labels;
    var st = useState(''), text = st[0], setText = st[1];
    var sr = useState(null), res = sr[0], setRes = sr[1];
    var sv = useState({}), vals = sv[0], setVals = sv[1];
    var sf = useState(''), fmt = sf[0], setFmt = sf[1];
    var su = useState(true), useT = su[0], setUseT = su[1];
    var tracked = E.trackedRows(p.ctx.estimates, svc.id);
    var useTr = useT && tracked.projects > 0;
    function run(t, useTracked) {
      var parsed = t && t.trim() ? E.pastRows(E.parseCsv(t)) : { rows: [], format: 'none' };
      var rows = parsed.rows.concat(useTracked ? tracked.rows : []);
      var c = E.calibrate(svc, rows);
      var v = {}; c.items.forEach(function (x) { v[x.id] = { on: Math.abs(x.median - x.current) >= 0.5, base: x.suggestedBase }; });
      setFmt(parsed.format); setRes(Object.assign({ rows: parsed.rows.length, tracked: useTracked ? tracked.projects : 0 }, c)); setVals(v);
    }
    function apply() {
      var n = 0;
      p.mut(function (s) { s.items.forEach(function (it) { var v = vals[it.id]; if (v && v.on) { it.hours = v.base; n++; } }); });
      p.ctx.toast('Updated ' + n + ' ' + lower(plural(n, labels.item, labels.items)) + '. Review, then Save changes.');
      setRes(null); setText('');
    }
    var nOn = Object.keys(vals).filter(function (k) { return vals[k].on; }).length;
    return html`<div class="stack">
      <section class="panel panel-pad">
        <${CardHead} icon="gauge" color="teal" title="Calibrate from past projects" desc=${'Replace placeholder hours with what ' + lower(labels.items) + ' really took. Paste or open a CSV of past work: this tool\'s CSV export, or any sheet with a name column and an hours column (timesheets work too).'} />
        <textarea class="textarea" id="cal-text" rows="6" placeholder=${'Item,Actual hours\nHome,22\nContact,7.5'} value=${text} onInput=${function (e) { setText(e.target.value); }}></textarea>
        <div class="row" style="margin-top:10px;gap:10px">
          <label class="btn sm ghost" style="cursor:pointer"><${Icon} name="file" size=${14} /> Open CSV<input type="file" accept=".csv,.txt,text/csv" class="sr" onChange=${function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; f.text().then(function (t) { setText(t); run(t, useTr); }); e.target.value = ''; }} /></label>
          <span class="spacer"></span>
          <button class="btn primary" disabled=${!text.trim() && !useTr} onClick=${function () { run(text, useTr); }}>Compare with the library</button>
        </div>
      </section>
      <section class="panel panel-pad cal-tracked">
        <${CardHead} icon="check" color="green" title="Tracked estimates" desc=${tracked.projects ? tracked.projects + ' ' + plural(tracked.projects, 'estimate', 'estimates') + ' for this service ' + plural(tracked.projects, 'has', 'have') + ' actual hours (' + tracked.rows.length + ' ' + plural(tracked.rows.length, 'line', 'lines') + '). Actuals are scaled back to quantity 1 at Standard complexity before comparing.' : 'None yet. Record actual hours on an estimate (Review → Actual hours) and they show up here automatically.'}
          right=${tracked.projects ? html`<label class="check-line" style="font-size:13px"><${Switch} id="cal-use-tracked" label="Include tracked estimates" checked=${useT} onChange=${setUseT} /> Include</label>` : null} />
      </section>
      ${res ? html`<section class="panel flush">
        <${CardHead} icon="table" color="blue" title=${res.items.length + ' ' + lower(plural(res.items.length, labels.item, labels.items)) + ' matched'} desc=${(res.rows ? res.rows + ' rows read' + (fmt === 'estimator' ? ' from an estimator export' : '') : '') + (res.rows && res.tracked ? ' plus ' : '') + (res.tracked ? res.tracked + ' tracked ' + plural(res.tracked, 'estimate', 'estimates') : '') + '. Hours are per ' + lower(labels.item) + ', including its ' + lower(labels.subs) + '; the new value replaces the base hours.'} />
        ${res.items.length ? html`<div class="table-wrap"><table class="bd cal">
          <thead><tr><th></th><th>${labels.item}</th><th class="n">Library now</th><th class="n">Past median</th><th class="n">Range</th><th>New base hours</th></tr></thead>
          <tbody>${res.items.map(function (x) { var v = vals[x.id] || {}; var d = x.median - x.current; return html`<tr key=${x.id}>
            <td><input type="checkbox" class="cb" aria-label=${'Update ' + x.name} checked=${!!v.on} onChange=${function () { setVals(function (o) { var c = Object.assign({}, o); c[x.id] = Object.assign({}, v, { on: !v.on }); return c; }); }} /></td>
            <td><bdi>${x.name}</bdi> <span class="paren">(${x.samples} ${plural(x.samples, 'project', 'projects')})</span></td>
            <td class="n">${E.fmtHours(x.current)}</td>
            <td class=${'n ' + (d > 0.25 ? 'up' : d < -0.25 ? 'down' : '')}>${E.fmtHours(x.median)}</td>
            <td class="n muted">${x.samples > 1 ? E.fmtNum(E.round(x.min, 1)) + '–' + E.fmtHours(E.round(x.max, 1)) : '—'}</td>
            <td><${Stepper} value=${E.num(v.base)} label=${x.name + ' new base hours'} unit="h" onChange=${function (n) { setVals(function (o) { var c = Object.assign({}, o); c[x.id] = Object.assign({}, v, { base: n, on: true }); return c; }); }} />${x.subs ? html`<span class="hint">+ ${E.fmtHours(x.subs)} ${lower(labels.subs)}</span>` : null}</td>
          </tr>`; })}</tbody></table></div>` : null}
        ${res.unmatched.length ? html`<p class="opt-hint" style="padding:12px 20px">Not matched (${res.unmatched.length}): ${res.unmatched.slice(0, 12).join(', ')}${res.unmatched.length > 12 ? '…' : ''}. Rename them to match the library, or add them as ${lower(labels.items)} first.</p>` : null}
        <div class="row" style="padding:12px 20px;border-top:1px solid var(--line)"><span class="spacer"></span><button class="btn primary" disabled=${!nOn} onClick=${apply}>Update ${nOn} ${lower(plural(nOn, labels.item, labels.items))}</button></div>
      </section>` : null}
    </div>`;
  }

  // ================================================================== library (CMS)
  function LibraryView(p) {
    var ctx = p.ctx, list = ctx.serviceList || [];
    var dirtyRef = useRef(false);
    var sel = ctx.route.serviceId && ctx.services && ctx.services[ctx.route.serviceId] ? ctx.route.serviceId : (list[0] ? list[0].id : null);
    function select(id) {
      if (id === sel) return;
      var go = function () { dirtyRef.current = false; ctx.setRoute({ view: 'library', serviceId: id, tab: ctx.route.tab }); };
      if (dirtyRef.current) ctx.confirm({ title: 'Discard unsaved changes?', body: 'You have unsaved changes to this service.', confirmLabel: 'Discard changes', danger: true, onConfirm: go });
      else go();
    }
    async function addService() {
      var id = uniqueId('new-service', Object.keys(ctx.services || {}));
      var doc = {
        name: 'New service', description: '', icon: 'box', color: 'yellow', active: false,
        order: list.reduce(function (m, s) { return Math.max(m, E.num(s.order)); }, 0) + 1,
        labels: Object.assign({}, E.DEFAULT_LABELS), categories: [{ id: 'general', name: 'General' }],
        items: [], subItems: [], optionGroups: [], starterPacks: [], gapRules: [],
      };
      var ok = await ctx.api.set('services/' + id, doc);
      if (ok) { dirtyRef.current = false; ctx.setRoute({ view: 'library', serviceId: id, tab: 'overview' }); ctx.toast('Service created. Estimators see it once you mark it active.'); }
    }
    return html`<div class="page-head"><div><h1>Library</h1><p>The services, scope options and building blocks estimators pick from. Saved changes apply to new estimates; existing estimates can update their rates from the Review step.</p></div></div>
      ${ctx.services === null ? html`<div class="panel panel-pad"><div class="skeleton" style="width:50%"></div></div>` : html`<div class="cms">
        <nav class="panel svc-list" aria-label="Services">
          ${list.map(function (s) {
            return html`<button class="svc-item" key=${s.id} aria-current=${s.id === sel ? 'true' : 'false'} onClick=${function () { select(s.id); }}>
              <${SvcTile} svc=${s} />
              <span class="t"><b title=${s.name}><bdi>${s.name}</bdi></b><span>${s.active ? serviceStats(s)[0] : 'Inactive'}</span></span>
            </button>`;
          })}
          <button class="btn sm ghost" onClick=${addService}><${Icon} name="plus" /> Add service</button>
        </nav>
        <div style="min-width:0">${sel ? html`<${ServiceEditor} key=${sel} ctx=${ctx} id=${sel} dirtyRef=${dirtyRef} />`
          : html`<div class="panel"><div class="empty first"><${Tile} size="lg" icon="book" color="purple" /><h2>No services yet</h2><p>Add your first service, such as Website or Mobile app, then add its pages or features with default hours.</p><button class="btn primary" onClick=${addService}><${Icon} name="plus" /> Add service</button></div></div>`}</div>
      </div>`}`;
  }

  function useDocDraft(live) {
    var sb = useState(function () { return E.clone(live || {}); }), base = sb[0], setBase = sb[1];
    var sd = useState(function () { return E.clone(live || {}); }), draft = sd[0], setDraft = sd[1];
    var liveStr = JSON.stringify(live || {}), baseStr = JSON.stringify(base);
    var dirty = JSON.stringify(draft) !== baseStr;
    useEffect(function () { if (!dirty) { setBase(E.clone(live || {})); setDraft(E.clone(live || {})); } }, [liveStr]);
    return {
      base: base, draft: draft, dirty: dirty, conflict: dirty && liveStr !== baseStr,
      mut: function (fn) { setDraft(function (d) { var n = E.clone(d); fn(n); return n; }); },
      reset: function () { setDraft(E.clone(base)); },
      reload: function () { setBase(E.clone(live || {})); setDraft(E.clone(live || {})); },
      saved: function (d) { setBase(E.clone(d)); },
      restore: function (prev) { setBase(prev); },
    };
  }
  function SaveBar(p) {
    if (!p.dirty) return null;
    return html`<div class="savebar" role="region" aria-label="Unsaved changes">
      <span class="grow">Unsaved changes</span>
      <button class="btn sm ghost" onClick=${p.onDiscard}>Discard</button>
      <button class="btn sm light" disabled=${p.saving} onClick=${p.onSave}>${p.saving ? 'Saving…' : 'Save changes'}</button>
    </div>`;
  }

  function ServiceEditor(p) {
    var ctx = p.ctx, id = p.id, live = ctx.services[id];
    var d = useDocDraft(live);
    var ss = useState(false), saving = ss[0], setSaving = ss[1];
    p.dirtyRef.current = d.dirty;
    useEffect(function () { return function () { p.dirtyRef.current = false; }; }, []);
    var tab = ['overview', 'options', 'items', 'subs', 'packs', 'rules', 'calibrate'].indexOf(ctx.route.tab) >= 0 ? ctx.route.tab : 'items';
    var svc = d.draft, labels = Object.assign({}, E.DEFAULT_LABELS, svc.labels || {});
    async function save() {
      // Mark as saved before the write: our own write echoes back through the live subscription
      // before it confirms, and must not look like someone else's change.
      var prev = d.base;
      d.saved(svc); setSaving(true);
      var ok = await ctx.api.set('services/' + id, clean(svc));
      setSaving(false);
      if (ok) ctx.toast('Saved ' + (svc.name || 'service'));
      else d.restore(prev);
    }
    if (!live) return html`<div class="panel"><div class="empty"><h2>This service was deleted</h2></div></div>`;
    var tabs = [
      { id: 'items', name: labels.items, count: (svc.items || []).length },
      { id: 'subs', name: labels.subs, count: (svc.subItems || []).length },
      { id: 'options', name: 'Scope options', count: (svc.optionGroups || []).length },
      { id: 'packs', name: 'Starter packs', count: (svc.starterPacks || []).length },
      { id: 'rules', name: 'Gap rules', count: (svc.gapRules || []).length },
      { id: 'calibrate', name: 'Calibrate hours' },
      { id: 'overview', name: 'Service details' },
    ];
    var body;
    var tp = { ctx: ctx, svc: svc, mut: d.mut, labels: labels, id: id, base: d.base };
    if (tab === 'overview') body = html`<${OverviewTab} ...${tp} />`;
    else if (tab === 'options') body = html`<${OptionsTab} ...${tp} />`;
    else if (tab === 'subs') body = html`<${SubsTab} ...${tp} />`;
    else if (tab === 'packs') body = html`<${PacksTab} ...${tp} />`;
    else if (tab === 'rules') body = html`<${RulesTab} ...${tp} />`;
    else if (tab === 'calibrate') body = html`<${CalibrateTab} ...${tp} />`;
    else body = html`<${ItemsTab} ...${tp} />`;
    return html`<div>
      <div class="row" style="margin-bottom:14px;align-items:center;gap:14px">
        <${SvcTile} svc=${svc} size="lg" />
        <div style="min-width:0"><h2 style="font-size:20px">${svc.name || 'Untitled service'}</h2><div style="font-size:13px;color:var(--faint)">${svc.active ? 'Active (shown to estimators)' : 'Inactive (hidden from estimators)'}</div></div>
      </div>
      ${d.conflict ? html`<div class="banner warn" style="margin-bottom:12px"><${Icon} name="alert" /><div class="grow">Someone else saved this service while you were editing. Saving now replaces their changes.</div><button class="btn sm" onClick=${d.reload}>Load their version</button></div>` : null}
      <div class="cms-tabs" role="tablist">${tabs.map(function (t) {
        return html`<button class="cms-tab" role="tab" key=${t.id} aria-selected=${t.id === tab ? 'true' : 'false'} onClick=${function () { ctx.setRoute({ view: 'library', serviceId: id, tab: t.id }); }}>${t.name}${t.count !== undefined ? html`<span class="count">${t.count}</span>` : null}</button>`;
      })}</div>
      ${body}
      <${SaveBar} dirty=${d.dirty} saving=${saving} onSave=${save} onDiscard=${d.reset} />
    </div>`;
  }

  function OverviewTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    function setLabel(k, v) { mut(function (n) { n.labels = Object.assign({}, E.DEFAULT_LABELS, n.labels || {}); n.labels[k] = v; }); }
    async function duplicate() {
      var nid = uniqueId(svc.name + '-copy', Object.keys(ctx.services || {}));
      var copy = clean(p.base); copy.name = (copy.name || 'Service') + ' (copy)'; copy.active = false; copy.order = E.num(copy.order) + 1;
      var ok = await ctx.api.set('services/' + nid, copy);
      if (ok) { ctx.setRoute({ view: 'library', serviceId: nid, tab: 'overview' }); ctx.toast('Duplicated as ' + copy.name); }
    }
    function del() {
      ctx.confirm({
        title: 'Delete ' + (p.base.name || 'this service') + '?', body: "Estimators can no longer start estimates with it. Saved estimates keep their own copy of the rates and items.",
        confirmLabel: 'Delete service', danger: true,
        onConfirm: async function () { var ok = await ctx.api.del('services/' + p.id); if (ok) { ctx.setRoute({ view: 'library' }); ctx.toast('Deleted ' + p.base.name); } },
      });
    }
    var color = svcColor(svc);
    return html`<div class="stack">
      <section class="panel panel-pad stack">
        <div class="grid-2">
          <label class="field"><span>Service name</span><input class="input" id="svc-name" maxlength="200" value=${svc.name || ''} onInput=${function (e) { var v = e.target.value; mut(function (n) { n.name = v; }); }} /></label>
          <label class="field"><span>Position in lists</span><input class="input" id="svc-order" type="number" value=${E.num(svc.order)} onInput=${function (e) { var v = E.num(e.target.value); mut(function (n) { n.order = v; }); }} /></label>
        </div>
        <label class="field"><span>Description</span><input class="input" id="svc-desc" maxlength="300" value=${svc.description || ''} placeholder="Shown on the service card" onInput=${function (e) { var v = e.target.value; mut(function (n) { n.description = v; }); }} /></label>
        <div class="grid-2">
          <div class="field"><span>Icon</span><div class="icon-pick">${SERVICE_ICONS.map(function (ic) {
            return html`<button type="button" key=${ic} aria-label=${ic} aria-pressed=${svc.icon === ic ? 'true' : 'false'} onClick=${function () { mut(function (n) { n.icon = ic; }); }}><span class=${'tile sm t-' + color}><${Duo} name=${ic} size=${16} /></span></button>`;
          })}</div></div>
          <div class="field"><span>Colour</span><div class="swatches">${COLORS.map(function (c) {
            return html`<button type="button" key=${c} class=${'t-' + c} aria-label=${c} aria-pressed=${color === c ? 'true' : 'false'} onClick=${function () { mut(function (n) { n.color = c; }); }}><span style="width:14px;height:14px;border-radius:50%;background:currentColor;display:block"></span></button>`;
          })}</div></div>
        </div>
        <label class="check-line"><${Switch} id="svc-active" label="Active" checked=${!!svc.active} onChange=${function (v) { mut(function (n) { n.active = v; }); }} /> Active: estimators can choose this service for new estimates</label>
      </section>
      <section class="panel panel-pad">
        <${CardHead} icon="list" color="blue" title="Labels" desc="What this service calls its building blocks, such as Page and Section, or Feature and Screen." />
        <div class="grid-3">
          <label class="field"><span>Group</span><input class="input" id="lbl-category" maxlength="200" value=${labels.category} onInput=${function (e) { setLabel('category', e.target.value); }} /></label>
          <label class="field"><span>Item (one)</span><input class="input" id="lbl-item" maxlength="200" value=${labels.item} onInput=${function (e) { setLabel('item', e.target.value); }} /></label>
          <label class="field"><span>Items (many)</span><input class="input" id="lbl-items" maxlength="200" value=${labels.items} onInput=${function (e) { setLabel('items', e.target.value); }} /></label>
          <label class="field"><span>Sub-item (one)</span><input class="input" id="lbl-sub" maxlength="200" value=${labels.sub} onInput=${function (e) { setLabel('sub', e.target.value); }} /></label>
          <label class="field"><span>Sub-items (many)</span><input class="input" id="lbl-subs" maxlength="200" value=${labels.subs} onInput=${function (e) { setLabel('subs', e.target.value); }} /></label>
        </div>
      </section>
      <section class="panel panel-pad"><div class="row">
        <button class="btn" onClick=${duplicate}><${Icon} name="copy" /> Duplicate service</button>
        <span class="spacer"></span>
        <button class="btn danger" onClick=${del}><${Icon} name="trash" /> Delete service</button>
      </div></section>
    </div>`;
  }

  function EdRow(p) {
    return html`<div class="ed-row">
      <div class="ed-sum" role="button" tabindex="0" aria-expanded=${p.open ? 'true' : 'false'} onClick=${p.onToggle} onKeyDown=${function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onToggle(); } }}>
        <span class="t"><b>${p.title || 'Untitled'}</b>${p.meta ? html`<span>${p.meta}</span>` : null}</span>
        ${p.right}
        <span class="icon-btn chev" aria-hidden="true" aria-expanded=${p.open ? 'true' : 'false'}><${Icon} name="chevD" /></span>
      </div>
      ${p.open ? html`<div class="ed-form">${p.children}</div>` : null}
    </div>`;
  }
  function DefFields(p) {
    var x = p.x;
    return html`
      <label class="field"><span>Definition</span><input class="input" id=${p.idp + '-desc'} maxlength="500" value=${x.description || ''} placeholder="What it is, in one sentence" onInput=${function (e) { var v = e.target.value; p.set(function (t) { t.description = v; }); }} /></label>
      <div class="grid-2">
        <label class="field"><span>Includes</span><textarea class="textarea" id=${p.idp + '-inc'} maxlength="4000" placeholder="One per line. Feeds the estimate's assumptions." value=${x.includes || ''} onInput=${function (e) { var v = e.target.value; p.set(function (t) { t.includes = v; }); }}></textarea></label>
        <label class="field"><span>Excludes</span><textarea class="textarea" id=${p.idp + '-exc'} maxlength="4000" placeholder="One per line. Feeds the estimate's exclusions." value=${x.excludes || ''} onInput=${function (e) { var v = e.target.value; p.set(function (t) { t.excludes = v; }); }}></textarea></label>
      </div>`;
  }

  function ItemsTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    var so = useState(null), open = so[0], setOpen = so[1];
    var subs = svc.subItems || [];
    function setItem(iid, fn) { mut(function (n) { var t = n.items.filter(function (x) { return x.id === iid; })[0]; if (t) fn(t); }); }
    function addItem(catId) {
      var iid = uniqueId('new-' + labels.item, (svc.items || []).map(function (x) { return x.id; }));
      mut(function (n) { n.items.push({ id: iid, categoryId: catId, name: 'New ' + lower(labels.item), hours: 4, defaultSubs: [], allowMultiple: false, description: '', includes: '', excludes: '' }); });
      setOpen(iid);
    }
    function delItem(it) {
      var rules = (svc.gapRules || []).filter(function (r) { return (r.trigger.kind === 'item' && r.trigger.ref === it.id) || (r.suggest.kind === 'item' && r.suggest.ref === it.id); }).length;
      ctx.confirm({
        title: 'Delete ' + it.name + '?', body: 'It is removed from starter packs' + (rules ? ' and ' + rules + ' gap ' + plural(rules, 'rule', 'rules') : '') + '. Saved estimates keep their copy.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (n) {
          n.items = n.items.filter(function (x) { return x.id !== it.id; });
          (n.starterPacks || []).forEach(function (k) { k.items = k.items.filter(function (z) { return z !== it.id; }); });
          n.gapRules = (n.gapRules || []).filter(function (r) { return !((r.trigger.kind === 'item' && r.trigger.ref === it.id) || (r.suggest.kind === 'item' && r.suggest.ref === it.id)); });
        }); },
      });
    }
    function moveItem(it, dir) {
      mut(function (n) {
        var same = n.items.filter(function (x) { return x.categoryId === it.categoryId; });
        var i = same.findIndex(function (x) { return x.id === it.id; }), j = i + dir;
        if (j < 0 || j >= same.length) return;
        var a = n.items.indexOf(same[i]), b = n.items.indexOf(same[j]);
        var t = n.items[a]; n.items[a] = n.items[b]; n.items[b] = t;
      });
    }
    function moveCat(ci, dir) { mut(function (n) { var j = ci + dir; if (j < 0 || j >= n.categories.length) return; var t = n.categories[ci]; n.categories[ci] = n.categories[j]; n.categories[j] = t; }); }
    function delCat(c) {
      var count = (svc.items || []).filter(function (x) { return x.categoryId === c.id; }).length;
      var others = (svc.categories || []).filter(function (x) { return x.id !== c.id; });
      if (count && !others.length) { ctx.toast('Add another ' + lower(labels.category) + ' first, so its ' + lower(labels.items) + ' have somewhere to go.', 'bad'); return; }
      var go = function () { mut(function (n) { n.categories = n.categories.filter(function (x) { return x.id !== c.id; }); n.items.forEach(function (x) { if (x.categoryId === c.id) x.categoryId = others[0].id; }); }); };
      if (!count) { go(); return; }
      ctx.confirm({ title: 'Delete ' + c.name + '?', body: 'Its ' + count + ' ' + lower(plural(count, labels.item, labels.items)) + ' move to ' + others[0].name + '.', confirmLabel: 'Delete', danger: true, onConfirm: go });
    }
    function addCat() { mut(function (n) { n.categories.push({ id: uniqueId('group', n.categories.map(function (x) { return x.id; })), name: 'New ' + lower(labels.category) }); }); }

    return html`<div>
      ${(svc.categories || []).map(function (c, ci) {
        var items = (svc.items || []).filter(function (x) { return x.categoryId === c.id; });
        return html`<section class="panel cat-block" key=${c.id}>
          <div class="cat-block-head">
            <${Tile} size="sm" icon="folder" color=${catColor(ci)} />
            <input class="input sm" id=${'cat-' + c.id} maxlength="200" aria-label=${labels.category + ' name'} value=${c.name} onInput=${function (e) { var v = e.target.value; mut(function (n) { n.categories[ci].name = v; }); }} />
            <span class="paren" style="font-size:13px">(${items.length} ${lower(plural(items.length, labels.item, labels.items))})</span>
            <span class="spacer"></span>
            <button class="icon-btn" aria-label="Move group up" disabled=${ci === 0} onClick=${function () { moveCat(ci, -1); }}><${Icon} name="up" /></button>
            <button class="icon-btn" aria-label="Move group down" disabled=${ci === svc.categories.length - 1} onClick=${function () { moveCat(ci, 1); }}><${Icon} name="down" /></button>
            <button class="icon-btn danger" aria-label=${'Delete ' + c.name} onClick=${function () { delCat(c); }}><${Icon} name="trash" /></button>
          </div>
          ${items.map(function (it, ii) {
            var nsub = (it.defaultSubs || []).length;
            return html`<${EdRow} key=${it.id} title=${it.name} open=${open === it.id} onToggle=${function () { setOpen(open === it.id ? null : it.id); }}
              meta=${(nsub ? nsub + ' ' + lower(plural(nsub, labels.sub, labels.subs)) + ' · ' : '') + (it.allowMultiple ? 'quantity allowed' : 'single')}
              right=${html`<${Hrs} v=${E.libItemHours(svc, it)} ghost />`}>
              <div class="grid-3">
                <label class="field"><span>Name</span><input class="input" id=${'it-name-' + it.id} maxlength="200" value=${it.name} onInput=${function (e) { var v = e.target.value; setItem(it.id, function (t) { t.name = v; }); }} /></label>
                <label class="field"><span>${labels.category}</span><select class="select" id=${'it-cat-' + it.id} value=${it.categoryId} onChange=${function (e) { var v = e.target.value; setItem(it.id, function (t) { t.categoryId = v; }); }}>${svc.categories.map(function (cc) { return html`<option value=${cc.id}>${cc.name}</option>`; })}</select></label>
                <label class="field"><span>${nsub ? 'Base hours (added to ' + lower(labels.subs) + ')' : 'Hours'}</span><${Stepper} id=${'it-hours-' + it.id} value=${E.num(it.hours)} label="Hours" unit="h" onChange=${function (v) { setItem(it.id, function (t) { t.hours = v; }); }} /></label>
              </div>
              <label class="check-line"><input type="checkbox" class="cb" checked=${!!it.allowMultiple} onChange=${function (e) { var v = e.target.checked; setItem(it.id, function (t) { t.allowMultiple = v; }); }} /> Estimators can set a quantity (e.g. 3 × Service detail)</label>
              ${subs.length ? html`<div class="field"><span>Default ${lower(labels.subs)}</span><div class="chips">${subs.map(function (s) {
                var on = (it.defaultSubs || []).indexOf(s.id) >= 0;
                return html`<button type="button" class="chip" key=${s.id} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { setItem(it.id, function (t) { t.defaultSubs = on ? t.defaultSubs.filter(function (z) { return z !== s.id; }) : (t.defaultSubs || []).concat(s.id); }); }}>${s.name}<span class="count">${E.fmtHours(s.hours)}</span></button>`;
              })}</div><span class="hint">Added automatically when an estimator ticks this ${lower(labels.item)}.</span></div>` : null}
              <${DefFields} x=${it} idp=${'it-' + it.id} set=${function (fn) { setItem(it.id, fn); }} />
              <div class="ed-actions">
                <button class="btn sm" disabled=${ii === 0} onClick=${function () { moveItem(it, -1); }}><${Icon} name="up" size=${14} /> Up</button>
                <button class="btn sm" disabled=${ii === items.length - 1} onClick=${function () { moveItem(it, 1); }}><${Icon} name="down" size=${14} /> Down</button>
                <span class="spacer"></span>
                <button class="btn sm danger" onClick=${function () { delItem(it); }}><${Icon} name="trash" size=${14} /> Delete</button>
              </div>
            <//>`;
          })}
          <div class="add-custom"><button class="btn sm ghost" onClick=${function () { addItem(c.id); }}><${Icon} name="plus" /> Add ${lower(labels.item)}</button></div>
        </section>`;
      })}
      <button class="btn" onClick=${addCat}><${Icon} name="plus" /> Add ${lower(labels.category)}</button>
    </div>`;
  }

  function SubsTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    var so = useState(null), open = so[0], setOpen = so[1];
    function setSub(sid, fn) { mut(function (n) { var t = n.subItems.filter(function (x) { return x.id === sid; })[0]; if (t) fn(t); }); }
    function add() {
      var sid = uniqueId('new-' + labels.sub, (svc.subItems || []).map(function (x) { return x.id; }));
      mut(function (n) { n.subItems.push({ id: sid, name: 'New ' + lower(labels.sub), hours: 2, description: '', includes: '', excludes: '' }); });
      setOpen(sid);
    }
    function del(s) {
      var used = (svc.items || []).filter(function (it) { return (it.defaultSubs || []).indexOf(s.id) >= 0; }).length;
      ctx.confirm({ title: 'Delete ' + s.name + '?', body: used ? 'It is removed from ' + used + ' ' + lower(plural(used, labels.item, labels.items)) + ' that include it by default.' : 'No ' + lower(labels.items) + ' use it by default.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (n) { n.subItems = n.subItems.filter(function (x) { return x.id !== s.id; }); n.items.forEach(function (it) { it.defaultSubs = (it.defaultSubs || []).filter(function (z) { return z !== s.id; }); }); }); } });
    }
    return html`<section class="panel cat-block">
      <div class="cat-block-head"><${Tile} size="sm" icon="layers" color="teal" /><span style="font-weight:500">${labels.subs} library</span><span class="paren" style="font-size:13px">(reusable inside any ${lower(labels.item)})</span></div>
      ${(svc.subItems || []).length ? null : html`<div class="empty"><p>No ${lower(labels.subs)} yet.</p></div>`}
      ${(svc.subItems || []).map(function (s) {
        var used = (svc.items || []).filter(function (it) { return (it.defaultSubs || []).indexOf(s.id) >= 0; }).length;
        return html`<${EdRow} key=${s.id} title=${s.name} open=${open === s.id} onToggle=${function () { setOpen(open === s.id ? null : s.id); }}
          meta=${used ? 'Default in ' + used + ' ' + lower(plural(used, labels.item, labels.items)) : 'Not used by default'} right=${html`<${Hrs} v=${s.hours} ghost />`}>
          <div class="grid-2">
            <label class="field"><span>Name</span><input class="input" id=${'sub-name-' + s.id} maxlength="200" value=${s.name} onInput=${function (e) { var v = e.target.value; setSub(s.id, function (t) { t.name = v; }); }} /></label>
            <label class="field"><span>Hours</span><${Stepper} id=${'sub-hours-' + s.id} value=${E.num(s.hours)} label="Hours" unit="h" onChange=${function (v) { setSub(s.id, function (t) { t.hours = v; }); }} /></label>
          </div>
          <${DefFields} x=${s} idp=${'sub-' + s.id} set=${function (fn) { setSub(s.id, fn); }} />
          <div class="ed-actions"><span class="spacer"></span><button class="btn sm danger" onClick=${function () { del(s); }}><${Icon} name="trash" size=${14} /> Delete</button></div>
        <//>`;
      })}
      <div class="add-custom"><button class="btn sm ghost" onClick=${add}><${Icon} name="plus" /> Add ${lower(labels.sub)}</button></div>
    </section>`;
  }

  function OptionsTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    var so = useState(null), open = so[0], setOpen = so[1];
    var groups = svc.optionGroups || [];
    function setGroup(gi, fn) { mut(function (n) { fn(n.optionGroups[gi]); }); }
    function setOpt(gi, oi, fn) { mut(function (n) { fn(n.optionGroups[gi].options[oi], n.optionGroups[gi]); }); }
    function allOptIds() { var a = []; groups.forEach(function (g) { (g.options || []).forEach(function (o) { a.push(o.id); }); }); return a; }
    function addGroup() {
      var gid = uniqueId('options', groups.map(function (g) { return g.id; }));
      mut(function (n) { n.optionGroups.push({ id: gid, name: 'New option group', selection: 'multiple', description: '', options: [] }); });
    }
    function addOpt(gi) {
      var oid = uniqueId('option', allOptIds());
      mut(function (n) { n.optionGroups[gi].options.push({ id: oid, name: 'New option', input: 'toggle', rule: 'fixed', value: 4, default: false, locked: false, free: 0, min: 0, max: 99, unit: '', description: '' }); });
      setOpen(oid);
    }
    function refs(gid, oid) { return (svc.gapRules || []).filter(function (r) { return [r.trigger, r.suggest].some(function (x) { return x.kind === 'option' && x.group === gid && (!oid || x.ref === oid); }); }).length; }
    function delGroup(gi) {
      var g = groups[gi], n = refs(g.id);
      ctx.confirm({ title: 'Delete ' + g.name + '?', body: 'Its ' + g.options.length + ' ' + plural(g.options.length, 'option', 'options') + (n ? ' and ' + n + ' gap ' + plural(n, 'rule', 'rules') : '') + ' are removed. Saved estimates keep their copy.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (s) { s.optionGroups.splice(gi, 1); s.gapRules = (s.gapRules || []).filter(function (r) { return ![r.trigger, r.suggest].some(function (x) { return x.kind === 'option' && x.group === g.id; }); }); }); } });
    }
    function delOpt(gi, oi) {
      var g = groups[gi], o = g.options[oi], n = refs(g.id, o.id);
      ctx.confirm({ title: 'Delete ' + o.name + '?', body: n ? 'Also removes ' + n + ' gap ' + plural(n, 'rule', 'rules') + ' that use it.' : 'Saved estimates keep their copy.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (s) { s.optionGroups[gi].options.splice(oi, 1); s.gapRules = (s.gapRules || []).filter(function (r) { return ![r.trigger, r.suggest].some(function (x) { return x.kind === 'option' && x.group === g.id && x.ref === o.id; }); }); }); } });
    }
    function moveGroup(gi, dir) { mut(function (n) { var j = gi + dir; if (j < 0 || j >= n.optionGroups.length) return; var t = n.optionGroups[gi]; n.optionGroups[gi] = n.optionGroups[j]; n.optionGroups[j] = t; }); }
    return html`<div>
      <p class="muted" style="margin-bottom:14px;max-width:70ch">Step 2 of every estimate. Percentages apply to base design hours (the total of all ${lower(labels.items)}). Use a locked option for the primary version, like Desktop, so its hours are the base.</p>
      ${groups.map(function (g, gi) {
        var single = g.selection === 'single';
        var gs = groupStyle(g, gi);
        return html`<section class="panel cat-block" key=${g.id}>
          <div class="cat-block-head">
            <${Tile} size="sm" icon=${gs.icon} color=${gs.color} />
            <input class="input sm" id=${'grp-name-' + g.id} maxlength="200" aria-label="Group name" value=${g.name} onInput=${function (e) { var v = e.target.value; setGroup(gi, function (t) { t.name = v; }); }} />
            <select class="select sm" style="width:auto" aria-label="Selection type" value=${g.selection} onChange=${function (e) { var v = e.target.value; setGroup(gi, function (t) { t.selection = v; if (v === 'single') { var seen = false; t.options.forEach(function (o) { o.input = 'toggle'; o.locked = false; if (o.default && !seen) seen = true; else o.default = false; }); if (!seen && t.options[0]) t.options[0].default = true; } }); }}>
              <option value="multiple">Several can be chosen</option><option value="single">Exactly one is chosen</option>
            </select>
            <span class="spacer"></span>
            <button class="icon-btn" aria-label="Move group up" disabled=${gi === 0} onClick=${function () { moveGroup(gi, -1); }}><${Icon} name="up" /></button>
            <button class="icon-btn" aria-label="Move group down" disabled=${gi === groups.length - 1} onClick=${function () { moveGroup(gi, 1); }}><${Icon} name="down" /></button>
            <button class="icon-btn danger" aria-label=${'Delete ' + g.name} onClick=${function () { delGroup(gi); }}><${Icon} name="trash" /></button>
          </div>
          <div style="padding:10px 16px;border-bottom:1px solid var(--line)"><input class="input sm" id=${'grp-desc-' + g.id} maxlength="300" aria-label="Group description" placeholder="Short description shown to estimators" value=${g.description || ''} onInput=${function (e) { var v = e.target.value; setGroup(gi, function (t) { t.description = v; }); }} /></div>
          ${(g.options || []).map(function (o, oi) {
            var qty = !single && o.input === 'quantity';
            var flags = [];
            if (single && o.default) flags.push('default choice');
            if (!single && o.locked) flags.push('always included');
            if (!single && !o.locked && !qty && o.default) flags.push('on by default');
            if (qty) flags.push('quantity, default ' + E.fmtNum(o.default));
            return html`<${EdRow} key=${o.id} title=${o.name} open=${open === o.id} onToggle=${function () { setOpen(open === o.id ? null : o.id); }} meta=${[E.ruleHint(o, labels, single) || 'No extra hours'].concat(flags).join(' · ')}>
              <div class="grid-2">
                <label class="field"><span>Name</span><input class="input" id=${'opt-name-' + o.id} maxlength="200" value=${o.name} onInput=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.name = v; }); }} /></label>
                <label class="field"><span>Description</span><input class="input" id=${'opt-desc-' + o.id} maxlength="300" value=${o.description || ''} onInput=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.description = v; }); }} /></label>
              </div>
              <div class="opt-grid">
                ${single ? null : html`<label class="field"><span>Input</span><select class="select" id=${'opt-input-' + o.id} value=${o.input} onChange=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.input = v; t.default = v === 'quantity' ? 0 : false; if (v === 'quantity') t.locked = false; }); }}><option value="toggle">On / off</option><option value="quantity">Quantity</option></select></label>`}
                <label class="field"><span>Adds</span><select class="select" id=${'opt-rule-' + o.id} value=${o.rule} onChange=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.rule = v; }); }}>${RULES.map(function (r) { return html`<option value=${r.value}>${r.label}</option>`; })}</select></label>
                ${o.rule !== 'none' ? html`<label class="field"><span>${o.rule === 'percent' ? 'Percent' : 'Hours'}</span><${Stepper} id=${'opt-value-' + o.id} value=${E.num(o.value)} step=${o.rule === 'percent' ? 1 : 0.5} max=${o.rule === 'percent' ? 500 : 1000} label="Value" unit=${o.rule === 'percent' ? '%' : 'h'} onChange=${function (v) { setOpt(gi, oi, function (t) { t.value = v; }); }} /></label>` : null}
                ${qty ? html`<label class="field"><span>Default quantity</span><${Stepper} id=${'opt-def-' + o.id} value=${E.num(o.default)} step=${1} label="Default quantity" onChange=${function (v) { setOpt(gi, oi, function (t) { t.default = v; }); }} /></label>` : null}
                ${qty ? html`<label class="field"><span>Included free</span><${Stepper} id=${'opt-free-' + o.id} value=${E.num(o.free)} step=${1} label="Included free" onChange=${function (v) { setOpt(gi, oi, function (t) { t.free = v; }); }} /><span class="hint">e.g. 1 for the first language</span></label>` : null}
                ${qty ? html`<label class="field"><span>Minimum</span><${Stepper} id=${'opt-min-' + o.id} value=${E.num(o.min)} step=${1} label="Minimum" onChange=${function (v) { setOpt(gi, oi, function (t) { t.min = v; }); }} /></label>` : null}
                ${qty ? html`<label class="field"><span>Maximum</span><${Stepper} id=${'opt-max-' + o.id} value=${E.num(o.max, 99)} step=${1} label="Maximum" onChange=${function (v) { setOpt(gi, oi, function (t) { t.max = v; }); }} /></label>` : null}
              </div>
              <div class="row">
                ${single ? html`<label class="check-line"><input type="radio" class="cb" style="border-radius:50%" name=${'def-' + g.id} checked=${!!o.default} onChange=${function () { mut(function (n) { n.optionGroups[gi].options.forEach(function (z, zi) { z.default = zi === oi; }); }); }} /> Default choice</label>` : null}
                ${!single && !qty ? html`<label class="check-line"><input type="checkbox" class="cb" checked=${!!o.default} onChange=${function (e) { var v = e.target.checked; setOpt(gi, oi, function (t) { t.default = v; }); }} /> On by default</label>` : null}
                ${!single && !qty ? html`<label class="check-line"><input type="checkbox" class="cb" checked=${!!o.locked} onChange=${function (e) { var v = e.target.checked; setOpt(gi, oi, function (t) { t.locked = v; if (v) t.default = true; }); }} /> Always included (can't be turned off)</label>` : null}
                <span class="spacer"></span>
                <button class="btn sm danger" onClick=${function () { delOpt(gi, oi); }}><${Icon} name="trash" size=${14} /> Delete option</button>
              </div>
            <//>`;
          })}
          <div class="add-custom"><button class="btn sm ghost" onClick=${function () { addOpt(gi); }}><${Icon} name="plus" /> Add option</button></div>
        </section>`;
      })}
      <button class="btn" onClick=${addGroup}><${Icon} name="plus" /> Add option group</button>
    </div>`;
  }

  function PacksTab(p) {
    var svc = p.svc, mut = p.mut, labels = p.labels, ctx = p.ctx;
    var packs = svc.starterPacks || [];
    function setPack(ki, fn) { mut(function (n) { fn(n.starterPacks[ki]); }); }
    function add() { mut(function (n) { n.starterPacks = n.starterPacks || []; n.starterPacks.push({ id: uniqueId('pack', n.starterPacks.map(function (k) { return k.id; })), name: 'New starter pack', description: '', items: [] }); }); }
    return html`<div>
      <p class="muted" style="margin-bottom:14px;max-width:70ch">Bundles estimators add in one click, such as Standard auth or Corporate website.</p>
      ${packs.length ? null : html`<div class="panel" style="margin-bottom:16px"><div class="empty"><p>No starter packs yet.</p></div></div>`}
      ${packs.map(function (k, ki) {
        return html`<section class="panel panel-pad stack cat-block" key=${k.id}>
          <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
            <${Tile} icon="pack" color=${catColor(ki + 2)} />
            <div class="grid-2" style="flex:1">
              <label class="field"><span>Name</span><input class="input" id=${'pack-name-' + k.id} maxlength="200" value=${k.name} onInput=${function (e) { var v = e.target.value; setPack(ki, function (t) { t.name = v; }); }} /></label>
              <label class="field"><span>Description</span><input class="input" id=${'pack-desc-' + k.id} maxlength="300" value=${k.description || ''} onInput=${function (e) { var v = e.target.value; setPack(ki, function (t) { t.description = v; }); }} /></label>
            </div>
          </div>
          ${(svc.categories || []).map(function (c) {
            var items = (svc.items || []).filter(function (x) { return x.categoryId === c.id; });
            if (!items.length) return null;
            return html`<div class="field" key=${c.id}><span>${c.name}</span><div class="chips">${items.map(function (it) {
              var on = (k.items || []).indexOf(it.id) >= 0;
              return html`<button type="button" class="chip" key=${it.id} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { setPack(ki, function (t) { t.items = on ? t.items.filter(function (z) { return z !== it.id; }) : (t.items || []).concat(it.id); }); }}>${it.name}</button>`;
            })}</div></div>`;
          })}
          <div class="ed-actions"><span class="paren" style="font-size:13px">(${(k.items || []).length} ${lower(plural((k.items || []).length, labels.item, labels.items))})</span><span class="spacer"></span>
            <button class="btn sm danger" onClick=${function () { ctx.confirm({ title: 'Delete ' + k.name + '?', confirmLabel: 'Delete', danger: true, onConfirm: function () { mut(function (n) { n.starterPacks.splice(ki, 1); }); } }); }}><${Icon} name="trash" size=${14} /> Delete pack</button></div>
        </section>`;
      })}
      <button class="btn" onClick=${add}><${Icon} name="plus" /> Add starter pack</button>
    </div>`;
  }

  function RulesTab(p) {
    var svc = p.svc, mut = p.mut, labels = p.labels;
    var rules = svc.gapRules || [];
    function enc(x) { return x.kind === 'item' ? 'item:' + x.ref : 'option:' + x.group + ':' + x.ref; }
    function dec(v) { var a = v.split(':'); return a[0] === 'item' ? { kind: 'item', ref: a[1] } : { kind: 'option', group: a[1], ref: a[2] }; }
    function optionsEl() {
      return [].concat(
        (svc.categories || []).map(function (c) {
          var items = (svc.items || []).filter(function (x) { return x.categoryId === c.id; });
          return items.length ? html`<optgroup label=${labels.items + ' · ' + c.name} key=${'c-' + c.id}>${items.map(function (it) { return html`<option value=${'item:' + it.id}>${it.name}</option>`; })}</optgroup>` : null;
        }),
        (svc.optionGroups || []).map(function (g) {
          return (g.options || []).length ? html`<optgroup label=${'Scope · ' + g.name} key=${'g-' + g.id}>${g.options.map(function (o) { return html`<option value=${'option:' + g.id + ':' + o.id}>${o.name}</option>`; })}</optgroup>` : null;
        })
      );
    }
    function add() {
      var its = svc.items || [];
      if (its.length < 2) return;
      mut(function (n) { n.gapRules = n.gapRules || []; n.gapRules.push({ id: uniqueId('rule', n.gapRules.map(function (r) { return r.id; })), trigger: { kind: 'item', ref: its[0].id }, suggest: { kind: 'item', ref: its[1].id }, message: '' }); });
    }
    return html`<div>
      <p class="muted" style="margin-bottom:14px;max-width:70ch">Suggestions shown while estimating. When the first thing is in an estimate and the second isn't, the estimator sees the suggestion with your message.</p>
      <section class="panel cat-block">
        <div class="cat-block-head"><${Tile} size="sm" icon="bulb" color="yellow" /><span style="font-weight:500">Gap rules</span><span class="paren" style="font-size:13px">(${rules.length})</span></div>
        ${rules.length ? null : html`<div class="empty"><p>No gap rules yet.</p></div>`}
        ${rules.map(function (r, ri) {
          return html`<div class="rule-row" key=${r.id}>
            <label class="field"><span>When this is added</span><select class="select" id=${'rule-t-' + r.id} value=${enc(r.trigger)} onChange=${function (e) { var v = dec(e.target.value); mut(function (n) { n.gapRules[ri].trigger = v; }); }}>${optionsEl()}</select></label>
            <span class="arrow"><${Icon} name="arrowR" /></span>
            <label class="field"><span>Suggest</span><select class="select" id=${'rule-s-' + r.id} value=${enc(r.suggest)} onChange=${function (e) { var v = dec(e.target.value); mut(function (n) { n.gapRules[ri].suggest = v; }); }}>${optionsEl()}</select></label>
            <button class="icon-btn danger" style="align-self:end" aria-label="Delete rule" onClick=${function () { mut(function (n) { n.gapRules.splice(ri, 1); }); }}><${Icon} name="trash" /></button>
            <input class="input sm rule-msg" id=${'rule-m-' + r.id} maxlength="300" aria-label="Message" placeholder="Why it's suggested, e.g. A cart usually leads to a checkout flow." value=${r.message || ''} onInput=${function (e) { var v = e.target.value; mut(function (n) { n.gapRules[ri].message = v; }); }} />
          </div>`;
        })}
        <div class="add-custom"><button class="btn sm ghost" disabled=${(svc.items || []).length < 2} onClick=${add}><${Icon} name="plus" /> Add rule</button></div>
      </section>
    </div>`;
  }

  // ================================================================== settings
  // ------------------------------------------------------------------ team (standalone build only)
  var ROLE_LABEL = { admin: 'Admin', estimator: 'Estimator', pending: 'Waiting for approval', disabled: 'Removed' };
  function TeamPanel(p) {
    var ctx = p.ctx, team = ctx.caps.team;
    var sm = useState(null), members = sm[0], setMembers = sm[1];
    var si = useState([]), invites = si[0], setInvites = si[1];
    var sd = useState(null), ts = sd[0], setTs = sd[1];
    var se = useState(''), email = se[0], setEmail = se[1];
    var sr = useState('estimator'), irole = sr[0], setIrole = sr[1];
    var sdom = useState(''), dom = sdom[0], setDom = sdom[1];
    var sdr = useState('estimator'), domRole = sdr[0], setDomRole = sdr[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    async function load() {
      try {
        var r = await Promise.all([team.members(), team.invites(), team.settings()]);
        setMembers(r[0]); setInvites(r[1]); setTs(r[2]); setDom(r[2].allowed_domain || ''); setDomRole(r[2].domain_role || 'estimator');
      } catch (e) { setMembers([]); ctx.toast('Couldn’t load the team. Reload the page to try again.', 'bad'); }
    }
    useEffect(function () { load(); }, []);
    async function act(fn, done) {
      setBusy(true);
      try { await fn(); if (done) ctx.toast(done); await load(); }
      catch (e) { ctx.toast(/own role/i.test(e.message) ? 'You can’t change your own role. Ask another admin.' : 'That didn’t work: ' + String(e.message || e).slice(0, 120), 'bad'); }
      setBusy(false);
    }
    var mine = team.me.user_id;
    var pending = (members || []).filter(function (m) { return m.role === 'pending'; });
    var active = (members || []).filter(function (m) { return m.role === 'admin' || m.role === 'estimator'; });
    var removed = (members || []).filter(function (m) { return m.role === 'disabled'; });
    function who(m) { return html`<${Avatar} key=${m.avatar_url || 'none'} url=${m.avatar_url} name=${m.name || m.email} /><div class="grow team-who"><div class="team-name"><bdi>${nm(m.name, m.email)}</bdi>${m.user_id === mine ? html` <span class="paren">(you)</span>` : null}</div><div class="opt-hint"><bdi>${m.email}</bdi></div></div>`; }
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return html`<section class="panel panel-pad team">
      <${CardHead} icon="users" color="blue" title="Team" desc="Who can use the estimator. Admins manage the library, settings and team; estimators create and edit estimates." right=${pending.length ? html`<span class="pill s-review">${pending.length} waiting</span>` : null} />
      ${members === null ? html`<div class="skeleton" style="width:50%"></div>` : html`
        ${pending.length ? html`<div class="team-group"><div class="eyebrow">Waiting for approval</div>${pending.map(function (m) {
          return html`<div class="team-row pending" key=${m.user_id}>${who(m)}
            <button class="btn sm primary" disabled=${busy} onClick=${function () { act(function () { return team.setRole(m.user_id, 'estimator'); }, 'Approved ' + (m.name || m.email)); }}>Approve</button>
            <button class="btn sm ghost" disabled=${busy} onClick=${function () { act(function () { return team.setRole(m.user_id, 'disabled'); }, 'Declined ' + (m.name || m.email)); }}>Decline</button>
          </div>`; })}</div>` : null}
        <div class="team-group"><div class="eyebrow">Members</div>${active.map(function (m) {
          return html`<div class="team-row" key=${m.user_id}>${who(m)}
            ${m.user_id === mine ? html`<span class="role admin">Admin</span>` : html`<select class="select sm" aria-label=${'Role for ' + (m.name || m.email)} disabled=${busy} value=${m.role} onChange=${function (e) {
              var v = e.target.value;
              if (v === 'disabled') { e.target.value = m.role; ctx.confirm({ title: 'Remove ' + (m.name || m.email) + '?', body: 'They lose access straight away. Their estimates stay. You can restore them later.', confirmLabel: 'Remove', danger: true, onConfirm: function () { act(function () { return team.setRole(m.user_id, 'disabled'); }, 'Removed ' + (m.name || m.email)); } }); }
              else act(function () { return team.setRole(m.user_id, v); }, (m.name || m.email) + ' is now ' + (v === 'admin' ? 'an admin' : 'an estimator'));
            }}><option value="estimator">Estimator</option><option value="admin">Admin</option><option value="disabled">Remove…</option></select>`}
          </div>`; })}</div>
        ${removed.length ? html`<details class="team-removed"><summary>${removed.length} removed</summary>${removed.map(function (m) {
          return html`<div class="team-row" key=${m.user_id}>${who(m)}<button class="btn sm" disabled=${busy} onClick=${function () { act(function () { return team.setRole(m.user_id, 'estimator'); }, 'Restored ' + (m.name || m.email)); }}>Restore</button></div>`; })}</details>` : null}

        <div class="team-group"><div class="eyebrow">Invite</div>
          <form class="str-row team-invite" onSubmit=${function (e) { e.preventDefault(); if (!emailOk) return; var em = email.trim().toLowerCase(); act(function () { return team.invite(em, irole); }, 'Invited ' + em + '. They join as ' + (irole === 'admin' ? 'an admin' : 'an estimator') + ' when they sign up with this email.').then(function () { setEmail(''); }); }}>
            <input class="input" id="team-invite-email" type="email" placeholder="name@agency.com" aria-label="Email to invite" value=${email} onInput=${function (e) { setEmail(e.target.value); }} />
            <select class="select" aria-label="Role for the invite" value=${irole} onChange=${function (e) { setIrole(e.target.value); }}><option value="estimator">Estimator</option><option value="admin">Admin</option></select>
            <button class="btn" type="submit" disabled=${busy || !emailOk}><${Icon} name="plus" /> Invite</button>
          </form>
          <p class="opt-hint">They sign up at this page with that email (Google or password) and get access straight away. Share the link with them; no email is sent from here.</p>
          ${invites.length ? html`<div class="team-invites">${invites.map(function (iv) {
            return html`<div class="team-row" key=${iv.email}><div class="grow"><bdi>${iv.email}</bdi> <span class="paren">(${ROLE_LABEL[iv.role]}, not signed up yet)</span></div>
              <button class="icon-btn danger" aria-label=${'Cancel invite for ' + iv.email} disabled=${busy} onClick=${function () { act(function () { return team.cancelInvite(iv.email); }, 'Cancelled the invite for ' + iv.email); }}><${Icon} name="trash" /></button></div>`; })}</div>` : null}
        </div>

        <div class="team-group"><div class="eyebrow">Company domain</div>
          <form class="str-row team-domain" onSubmit=${function (e) { e.preventDefault(); act(function () { return team.saveSettings({ allowed_domain: dom.trim().replace(/^@/, '') || null, domain_role: domRole }); }, dom.trim() ? 'Saved the company domain' : 'Turned off automatic joining'); }}>
            <span class="team-at">@</span><input class="input" id="team-domain" placeholder="agency.com" aria-label="Company email domain" value=${dom} onInput=${function (e) { setDom(e.target.value); }} />
            <select class="select" aria-label="Role for people on this domain" value=${domRole} onChange=${function (e) { setDomRole(e.target.value); }}><option value="estimator">join as Estimator</option><option value="pending">need approval</option></select>
            <button class="btn" type="submit" disabled=${busy || ((ts && (ts.allowed_domain || '')) === dom.trim().replace(/^@/, '') && ts.domain_role === domRole)}>Save</button>
          </form>
          <p class="opt-hint">${dom.trim() ? 'Anyone who signs in with Google on @' + dom.trim().replace(/^@/, '') + (domRole === 'pending' ? ' waits for your approval.' : ' joins as an estimator automatically.') + ' Email-and-password sign-ups always need approval.' : 'Off: everyone who isn’t invited waits for approval.'}</p>
        </div>`}
    </section>`;
  }
  function BackupPanel(p) {
    var ctx = p.ctx, team = ctx.caps.team;
    var sb = useState(null), prog = sb[0], setProg = sb[1];
    async function exportAll() {
      setProg('Preparing backup…');
      try {
        var all = await team.exportAll();
        var blob = new Blob([JSON.stringify({ app: 'design-hours-estimator', version: 1, exportedAt: new Date().toISOString(), docs: all }, null, 1)], { type: 'application/json' });
        await saveFile(ctx, 'estimator-backup-' + today() + '.json', blob);
      } catch (e) { ctx.toast('The backup couldn’t be prepared. Try again.', 'bad'); }
      setProg(null);
    }
    function importFile(f) {
      f.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { ctx.toast('That file isn’t a backup (not valid JSON).', 'bad'); return; }
        var docs = j && j.docs && typeof j.docs === 'object' ? j.docs : j;
        var paths = Object.keys(docs || {}).filter(function (k) { return /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/.test(k) && k.split('/').length % 2 === 0; });
        if (!paths.length) { ctx.toast('No estimator data found in that file.', 'bad'); return; }
        var n = { s: 0, e: 0, v: 0, c: 0 };
        paths.forEach(function (k) { if (/^services\//.test(k)) n.s++; else if (/\/versions\//.test(k)) n.v++; else if (/^estimates\//.test(k)) n.e++; else n.c++; });
        ctx.confirm({ title: 'Import ' + paths.length + ' records?', body: n.s + ' services, ' + n.e + ' estimates, ' + n.v + ' versions and ' + n.c + ' other records. Records with the same name are replaced; everything else stays.', confirmLabel: 'Import',
          onConfirm: async function () {
            var sub = {}; paths.forEach(function (k) { sub[k] = docs[k]; });
            setProg('Importing 0 of ' + paths.length + '…');
            var r = await team.importAll(sub, function (d, t) { setProg('Importing ' + d + ' of ' + t + '…'); });
            setProg(null);
            ctx.toast(r.failed.length ? 'Imported ' + (r.total - r.failed.length) + ' of ' + r.total + '. ' + r.failed.length + ' couldn’t be saved (too large or invalid).' : 'Imported ' + r.total + ' records', r.failed.length ? 'bad' : null);
          } });
      });
    }
    return html`<section class="panel panel-pad">
      <${CardHead} icon="download" color="green" title="Backup" desc="Download everything (library, settings, estimates and versions) as one file, or load a backup, including one exported from the claude.ai version." />
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <button class="btn" disabled=${!!prog} onClick=${exportAll}><${Icon} name="download" /> Download backup</button>
        <label class=${'btn' + (prog ? ' disabled' : '')} style="cursor:pointer"><${Icon} name="upload" /> Import backup<input type="file" accept=".json,application/json" class="sr" disabled=${!!prog} onChange=${function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importFile(f); }} /></label>
        ${prog ? html`<span class="opt-hint" role="status">${prog}</span>` : null}
      </div>
    </section>`;
  }

  function SettingsView(p) {
    var ctx = p.ctx;
    var d = useDocDraft(ctx.settings);
    var ss = useState(false), saving = ss[0], setSaving = ss[1];
    var s = d.draft;
    async function save() {
      var prev = d.base;
      d.saved(s); setSaving(true);
      var out = clean(s); out.phases = E.normalizeSettings(out).phases;
      var ok = await ctx.api.set('config/settings', out);
      setSaving(false);
      if (ok) ctx.toast('Settings saved');
      else d.restore(prev);
    }
    if (ctx.settingsDoc === null) return html`<div class="panel panel-pad"><div class="skeleton" style="width:40%"></div></div>`;
    var cx = s.complexity || E.DEFAULT_COMPLEXITY, oh = s.overhead || [];
    return html`<div class="page-head"><div><h1>Settings</h1><p>Defaults for new estimates. Existing estimates keep their own values and can update their rates from the Review step.</p></div></div>
      <div class="stack">
        ${ctx.caps && ctx.caps.team && ctx.caps.team.isAdmin ? html`<${TeamPanel} ctx=${ctx} /><${BackupPanel} ctx=${ctx} />` : null}
        ${ctx.settingsDoc === false ? html`<div class="banner"><${Icon} name="info" /><div class="grow">No settings saved yet. These are starting values; save them to make them the defaults.</div></div>` : null}
        <section class="panel panel-pad">
          <${CardHead} icon="sliders" color="gray" title="General" desc="Shown on exports and used as the starting buffer." />
          <div class="grid-2">
            <label class="field"><span>Agency name</span><input class="input" id="set-agency" maxlength="200" value=${s.agencyName || ''} placeholder="Shown at the top of exported workbooks" onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.agencyName = v; }); }} /></label>
            <label class="field"><span>Default buffer</span><${Stepper} id="set-buffer" value=${E.num(s.bufferPercent)} step=${1} max=${100} unit="%" label="Default buffer" onChange=${function (v) { d.mut(function (n) { n.bufferPercent = v; }); }} /></label>
          </div>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="gauge" color="purple" title="Complexity levels" desc="Multipliers estimators apply per item. Standard is the default." />
          <div class="adjust">${cx.map(function (c, i) {
            return html`<div class="adj-row" key=${c.id}>
              <input class="input" style="max-width:180px" id=${'cx-name-' + c.id} maxlength="60" aria-label="Level name" value=${c.name} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.complexity = n.complexity || E.clone(cx); n.complexity[i].name = v; }); }} />
              <input class="input grow" id=${'cx-desc-' + c.id} maxlength="200" aria-label="Description" placeholder="When to use it" value=${c.description || ''} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.complexity = n.complexity || E.clone(cx); n.complexity[i].description = v; }); }} />
              <${Stepper} id=${'cx-mult-' + c.id} value=${E.num(c.multiplier, 1)} step=${0.05} min=${0.1} max=${5} unit="×" label=${c.name + ' multiplier'} onChange=${function (v) { d.mut(function (n) { n.complexity = n.complexity || E.clone(cx); n.complexity[i].multiplier = v; }); }} />
            </div>`;
          })}</div>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="clock" color="orange" title="Project overhead" desc="Added to every new estimate. Fixed hours, or a percentage of the design subtotal." />
          <div class="adjust">${oh.map(function (o, i) {
            return html`<div class="adj-row" key=${o.id}>
              <${Switch} id=${'ohs-' + o.id} label=${'Include ' + o.name + ' by default'} checked=${o.enabled !== false} onChange=${function (v) { d.mut(function (n) { n.overhead[i].enabled = v; }); }} />
              <div class="grow stack" style="gap:6px">
                <input class="input" id=${'oh-name-' + o.id} maxlength="120" aria-label="Overhead name" value=${o.name} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.overhead[i].name = v; }); }} />
                <input class="input sm" id=${'oh-desc-' + o.id} maxlength="300" aria-label="Description" placeholder="What it covers" value=${o.description || ''} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.overhead[i].description = v; }); }} />
              </div>
              <select class="select" style="width:auto" aria-label="Rule" value=${o.rule} onChange=${function (e) { var v = e.target.value; d.mut(function (n) { n.overhead[i].rule = v; }); }}><option value="fixed">Fixed hours</option><option value="percent">% of design subtotal</option></select>
              <${Stepper} id=${'oh-val-' + o.id} value=${E.num(o.value)} step=${o.rule === 'percent' ? 1 : 0.5} max=${o.rule === 'percent' ? 100 : 1000} unit=${o.rule === 'percent' ? '%' : 'h'} label=${o.name} onChange=${function (v) { d.mut(function (n) { n.overhead[i].value = v; }); }} />
              <button class="icon-btn danger" aria-label=${'Delete ' + o.name} onClick=${function () { d.mut(function (n) { n.overhead.splice(i, 1); }); }}><${Icon} name="trash" /></button>
            </div>`;
          })}</div>
          <button class="btn sm" style="margin-top:12px" onClick=${function () { d.mut(function (n) { n.overhead = n.overhead || []; n.overhead.push({ id: uniqueId('overhead', n.overhead.map(function (x) { return x.id; })), name: 'New overhead item', rule: 'fixed', value: 2, enabled: true, description: '' }); }); }}><${Icon} name="plus" /> Add overhead item</button>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="layers" color="teal" title="Phases" desc="Estimators assign each item to a phase; the review shows hours per phase." />
          <${StringList} unique idPrefix="phase" label="Phase" values=${s.phases || []} placeholder="e.g. Phase 4" onChange=${function (v) { d.mut(function (n) { n.phases = v; }); }} />
        </section>

        <div class="grid-2" style="align-items:start">
          <section class="panel panel-pad">
            <${CardHead} icon="checkCircle" color="green" title="Default assumptions" desc="Copied into every new estimate's register." />
            <${StringList} idPrefix="assume" label="Assumption" values=${s.defaultAssumptions || []} placeholder="Add an assumption" onChange=${function (v) { d.mut(function (n) { n.defaultAssumptions = v; }); }} />
          </section>
          <section class="panel panel-pad">
            <${CardHead} icon="xCircle" color="red" title="Default exclusions" desc="Copied into every new estimate's register." />
            <${StringList} idPrefix="exclude" label="Exclusion" values=${s.defaultExclusions || []} placeholder="Add an exclusion" onChange=${function (v) { d.mut(function (n) { n.defaultExclusions = v; }); }} />
          </section>
        </div>
      </div>
      <${SaveBar} dirty=${d.dirty || ctx.settingsDoc === false} saving=${saving} onSave=${save} onDiscard=${d.reset} />`;
  }

  // ------------------------------------------------------------------ boot
  function mountApp() { mount.innerHTML = ''; render(html`<${App} />`, mount); }
  if (window.DHE_DEFER_MOUNT) window.DHE_MOUNT_APP = mountApp; // standalone build: mounts after sign-in
  else mountApp();
})();
