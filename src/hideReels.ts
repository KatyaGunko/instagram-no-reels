/**
 * Injected into Instagram’s mobile web to hide Reels affordances (tab, icons, chips)
 * and the Explore recommendation grid.
 *
 * IMPORTANT: These selectors target Instagram’s DOM / CSS classes and aria labels.
 * Instagram redesigns frequently — expect breakage. When Reels UI reappears, update
 * this module only; leave the WebView shell alone.
 *
 * Policy (locked): hide UI only. Do NOT block navigation to /reels or /reel/ URLs.
 * On /explore and empty /explore/search, everything under the search bar is hidden,
 * including the recommendation grid and the loading spinner. The search field and the
 * bottom tab bar stay. A typed query, or /explore/tags|locations|places, shows results.
 * Vertical swipes on an open reel viewer do not change the clip. Feed scrolling is unchanged.
 */

export const HIDE_REELS_SCRIPT = `
(function () {
  if (window.__igHideReelsInstalled) return;
  window.__igHideReelsInstalled = true;

  var STYLE_ID = 'ig-hide-reels-style';

  // Best-effort CSS. Prefer attribute / href / aria selectors over hashed class names.
  var CSS = [
    /* Bottom / side nav items that link to Reels */
    'a[href*="/reels"]',
    'a[href*="/reel/"]',
    'a[href^="/reels"]',
    'a[href^="/reel/"]',

    /* Aria / accessibility labels Instagram often uses */
    '[aria-label="Reels"]',
    '[aria-label="Reel"]',
    '[aria-label*="Reels" i]',
    '[aria-label*="Reel" i]',

    /* Role=link / tab with Reels text */
    'div[role="link"][aria-label*="Reel" i]',
    'div[role="tab"][aria-label*="Reel" i]',
    'span[aria-label*="Reel" i]',

    /* Common in-feed / discovery chips (fragile) */
    'a[role="link"][href*="/reels/"]',
  ].map(function (sel) {
    return sel + '{display:none!important;visibility:hidden!important;pointer-events:none!important;}';
  }).join('\\n');

  CSS +=
    '\\n[data-ig-explore-grid="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;}' +
    /* Search UI and its results stay visible even when a result links to a Reel. */
    '\\n[role="search"] a[href*="/reel"],[role="search"] a[href*="/reels"],[role="listbox"] a[href*="/reel"],[role="listbox"] a[href*="/reels"]{display:revert!important;visibility:visible!important;pointer-events:auto!important;}' +
    '\\n[data-ig-reel-lock="1"]{touch-action:none!important;}';

  var EXPLORE_MARK = 'data-ig-explore-grid';

  function ensureStyle() {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = CSS;
  }

  function hideByTextHeuristics() {
    try {
      var candidates = document.querySelectorAll('a, div[role="link"], div[role="button"], span');
      for (var i = 0; i < candidates.length; i++) {
        var node = candidates[i];
        var label = (node.getAttribute('aria-label') || '').trim();
        var text = (node.textContent || '').trim();
        var href = node.getAttribute && node.getAttribute('href');
        if (node.closest && node.closest('[role="search"], [role="listbox"], [role="searchbox"]')) {
          continue;
        }
        var looksLikeReels =
          /^reels?$/i.test(label) ||
          /^reels?$/i.test(text) ||
          (href && /\\/reels?(\\/|$|\\?)/i.test(href));
        if (looksLikeReels) {
          node.style.setProperty('display', 'none', 'important');
          node.style.setProperty('visibility', 'hidden', 'important');
          node.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    } catch (e) {
      /* ignore — Instagram DOM may throw during transitions */
    }
  }

  function isExploreHome() {
    return /^\\/explore\\/?$/.test(location.pathname) || /^\\/explore\\/search\\/?$/.test(location.pathname);
  }

  function isSearchField(field) {
    if (!field || field.nodeType !== 1) return false;
    if (field.getAttribute('role') === 'searchbox' || field.getAttribute('type') === 'search') return true;
    var hint = ((field.getAttribute('aria-label') || '') + ' ' + (field.getAttribute('placeholder') || '')).toLowerCase();
    if (hint.indexOf('search') !== -1) return true;
    return !!(field.closest && field.closest('[role="search"]'));
  }

  function searchActive() {
    if (/\\/explore\\/(tags|locations|places)\\b/.test(location.pathname)) return true;
    if (/\\/explore\\/search\\/.+/.test(location.pathname)) return true;
    if (/[?&]q=[^&]+/.test(location.search)) return true;
    var fields = document.querySelectorAll('input, textarea, [role="searchbox"]');
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!isSearchField(field)) continue;
      var value = typeof field.value === 'string' ? field.value : '';
      if (value.trim()) return true;
    }
    return false;
  }

  function findSearchField() {
    var fields = document.querySelectorAll('input, textarea, [role="searchbox"]');
    for (var i = 0; i < fields.length; i++) {
      if (isSearchField(fields[i])) return fields[i];
    }
    return null;
  }

  function isLoader(el) {
    if (!el || el.nodeType !== 1 || !el.matches) return false;
    if (el.matches('[role="progressbar"], [data-visualcompletion="loading-state"]')) return true;
    var label = (el.getAttribute('aria-label') || '').toLowerCase();
    if (label.indexOf('load') !== -1 || label.indexOf('ładow') !== -1 || label.indexOf('wczyt') !== -1) return true;
    var name = (el.localName || el.tagName || '').toLowerCase();
    return name === 'svg' && (el.getAttribute('viewBox') || '') === '0 0 100 100';
  }

  function tabScore(el) {
    var score = 0;
    var seen = {};
    var links = el.querySelectorAll('a[href], [role="link"], [role="tab"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var path = href.split('?')[0].split('#')[0];
      if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
      var kind = '';
      if (path === '' || path === '/' || path === '/home') kind = 'home';
      else if (path === '/explore') kind = 'explore';
      else if (path === '/reels') kind = 'reels';
      else if (path.indexOf('/direct') === 0) kind = 'direct';
      else if (/^\\/[A-Za-z0-9._]+$/.test(path)) kind = 'profile';
      if (kind && !seen[kind]) {
        seen[kind] = 1;
        score++;
      }
    }
    return score;
  }

  /* Bottom bar only — not an ancestor that also contains the feed or the spinner. */
  function looksLikeTabBar(el, search) {
    if (!el || el.nodeType !== 1) return false;
    if (search && (el === search || el.contains(search))) return false;
    if (isLoader(el) || (el.querySelector && el.querySelector('[role="progressbar"], [data-visualcompletion="loading-state"], svg[viewBox="0 0 100 100"]'))) {
      return false;
    }
    if (el.matches && el.matches('nav, [role="navigation"], [role="tablist"]')) return true;
    if (el.closest && el.closest('nav, [role="navigation"], [role="tablist"]')) return true;
    if (el.getBoundingClientRect && window.innerHeight > 200 && window.innerWidth > 200) {
      var rect = el.getBoundingClientRect();
      if (
        rect.width >= window.innerWidth * 0.8 &&
        rect.height >= 40 &&
        rect.height <= 130 &&
        rect.bottom >= window.innerHeight - 24 &&
        rect.top >= window.innerHeight * 0.7 &&
        el.querySelectorAll('svg, img').length >= 3
      ) {
        return true;
      }
    }
    var kids = el.children;
    var extra = false;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid.querySelector && kid.querySelector('input, textarea, [role="searchbox"], article, [role="progressbar"]')) {
        return false;
      }
      if (kid.matches && kid.matches('a, svg, img, button, span, [role="link"], [role="tab"]')) continue;
      if (kid.querySelector && kid.querySelector('a, [role="link"], [role="tab"], button, svg, img')) continue;
      extra = true;
    }
    if (extra) return false;
    var svgs = el.querySelectorAll('svg').length;
    var imgs = el.querySelectorAll('img').length;
    var clickable = el.querySelectorAll('a, [role="link"], [role="tab"], button').length;
    if (svgs >= 3 && imgs <= 2 && clickable >= 3) return true;
    return tabScore(el) >= 2 && (svgs >= 2 || clickable >= 3);
  }

  function findTabBars(search) {
    var bars = [];
    var nodes = document.querySelectorAll('div, nav, section, footer');
    for (var i = 0; i < nodes.length; i++) {
      if (looksLikeTabBar(nodes[i], search)) bars.push(nodes[i]);
    }
    return bars;
  }

  function containsTabBar(el, bars) {
    for (var i = 0; i < bars.length; i++) {
      if (el === bars[i] || el.contains(bars[i])) return true;
    }
    return false;
  }

  function isSearchDecoration(el, container, search) {
    if (!search || !container.contains(search) || !el.matches) return false;
    if (isLoader(el)) return false;
    if (el.querySelector('[role="progressbar"], [data-visualcompletion="loading-state"], svg[viewBox="0 0 100 100"]')) return false;
    return el.matches('button, svg, label, input, textarea, [role="button"]');
  }

  /*
   * Hide every branch that is not the search field and not the tab bar.
   * The spinner is often outside the post grid (or replaces it), so it is not
   * enough to hide nodes that contain posts.
   */
  function collectExploreContent(container, search, bars) {
    var found = [];
    if (!container || !container.children) return found;
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) {
      var child = kids[i];
      if (!child || child.nodeType !== 1) continue;
      var tag = child.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') continue;
      if (search && (child === search || child.contains(search))) {
        found = found.concat(collectExploreContent(child, search, bars));
        continue;
      }
      if (looksLikeTabBar(child, search)) continue;
      if (containsTabBar(child, bars)) {
        found = found.concat(collectExploreContent(child, search, bars));
        continue;
      }
      if (isSearchDecoration(child, container, search)) continue;
      found.push(child);
    }
    return found;
  }

  function hideExploreGrid() {
    var marked = document.querySelectorAll('[' + EXPLORE_MARK + ']');
    if (!isExploreHome() || searchActive()) {
      for (var c = 0; c < marked.length; c++) unmarkExploreGrid(marked[c]);
      return;
    }

    var searchField = findSearchField();
    var bars = findTabBars(searchField);
    var grids = searchField ? collectExploreContent(document.body, searchField, bars) : [];
    var loaders = document.querySelectorAll(
      '[role="progressbar"], [data-visualcompletion="loading-state"], svg[viewBox="0 0 100 100"], svg[aria-label], [aria-label]'
    );
    for (var p = 0; p < loaders.length; p++) {
      var loader = loaders[p];
      if (!isLoader(loader)) continue;
      if (searchField && (loader === searchField || searchField.contains(loader) || loader.contains(searchField))) continue;
      if (containsTabBar(loader, bars) && looksLikeTabBar(loader, searchField)) continue;
      var insideBar = false;
      for (var b = 0; b < bars.length; b++) {
        if (bars[b] === loader || bars[b].contains(loader)) insideBar = true;
      }
      if (insideBar) continue;
      grids.push(loader);
    }

    var outermost = [];
    for (var j = 0; j < grids.length; j++) {
      var nested = false;
      for (var k = 0; k < grids.length; k++) {
        if (j !== k && grids[k] !== grids[j] && grids[k].contains(grids[j])) {
          nested = true;
          break;
        }
      }
      if (!nested) outermost.push(grids[j]);
    }

    for (var m = 0; m < marked.length; m++) {
      if (outermost.indexOf(marked[m]) === -1) unmarkExploreGrid(marked[m]);
    }
    for (var n = 0; n < outermost.length; n++) {
      var node = outermost[n];
      if (!node || node === document.body || node === document.documentElement) continue;
      if (searchField && (node === searchField || node.contains(searchField))) continue;
      if (looksLikeTabBar(node, searchField)) continue;
      markExploreGrid(node);
    }
  }

  function markExploreGrid(el) {
    if (el.getAttribute(EXPLORE_MARK) !== '1') el.setAttribute(EXPLORE_MARK, '1');
    el.style.setProperty('display', 'none', 'important');
  }

  function unmarkExploreGrid(el) {
    el.removeAttribute(EXPLORE_MARK);
    el.style.removeProperty('display');
  }

  function apply() {
    ensureStyle();
    hideByTextHeuristics();
    hideExploreGrid();
  }

  apply();

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  try {
    var observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'aria-label', 'class'],
    });
  } catch (e) {
    /* MutationObserver unavailable — one-shot apply still ran */
  }

  // SPA route changes often replace large subtrees; re-apply on history hooks.
  try {
    var _push = history.pushState;
    var _replace = history.replaceState;
    history.pushState = function () {
      var r = _push.apply(this, arguments);
      schedule();
      return r;
    };
    history.replaceState = function () {
      var r = _replace.apply(this, arguments);
      schedule();
      return r;
    };
    window.addEventListener('popstate', schedule);
  } catch (e) {}

  document.addEventListener('input', schedule, true);
  document.addEventListener('keyup', schedule, true);

  /* Cancel vertical swipes that would change the reel. Feed videos stay scrollable. */
  var REEL_LOCK = 'data-ig-reel-lock';
  var swipe = null;

  function asEl(node) {
    if (!node) return null;
    if (node.nodeType === 1) return node;
    return node.parentElement || null;
  }

  function onReelRoute() {
    var path = location.pathname || '';
    return path === '/reels' || path.indexOf('/reels/') === 0 || path.indexOf('/reel/') === 0;
  }

  function inCommentsSheet(el) {
    var dialog = el.closest && el.closest('[role="dialog"]');
    if (!dialog) return false;
    return !dialog.querySelector('video');
  }

  function isFixedOrDialog(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    var role = el.getAttribute && el.getAttribute('role');
    if (role === 'dialog' || (el.getAttribute && el.getAttribute('aria-modal') === 'true')) return true;
    try {
      return window.getComputedStyle(el).position === 'fixed';
    } catch (e) {
      return false;
    }
  }

  function coversViewport(el) {
    if (!el || !el.getBoundingClientRect || el === document.body || el === document.documentElement) return false;
    var rect = el.getBoundingClientRect();
    var h = window.innerHeight || 0;
    var w = window.innerWidth || 0;
    if (h < 200 || w < 200) return false;
    return rect.top <= 48 && rect.width >= w * 0.8 && rect.height >= h * 0.72 && rect.bottom >= h * 0.9;
  }

  function reelSurface(target) {
    var el = asEl(target);
    if (!el || inCommentsSheet(el)) return null;
    if (onReelRoute()) return el;
    var node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      var label = ((node.getAttribute && node.getAttribute('aria-label')) || '').toLowerCase();
      var named = label.indexOf('video player') !== -1;
      var hasVideo = node.tagName === 'VIDEO' || !!(node.querySelector && node.querySelector('video'));
      var lifted = isFixedOrDialog(node);
      if (hasVideo && coversViewport(node) && (lifted || (named && !(node.closest && node.closest('article'))))) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function armReelLock(el) {
    var surface = reelSurface(el);
    if (!surface || surface === document.body || surface === document.documentElement) return;
    if (surface.getAttribute(REEL_LOCK) === '1') return;
    surface.setAttribute(REEL_LOCK, '1');
    surface.style.setProperty('touch-action', 'none', 'important');
  }

  function releaseStaleReelLocks() {
    var locked = document.querySelectorAll('[' + REEL_LOCK + ']');
    for (var i = 0; i < locked.length; i++) {
      if (reelSurface(locked[i])) continue;
      locked[i].removeAttribute(REEL_LOCK);
      locked[i].style.removeProperty('touch-action');
    }
  }

  function blockGesture(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function onSwipeStart(e) {
    var point = e.touches && e.touches.length === 1 ? e.touches[0] : null;
    if (!point && e.pointerType && e.pointerType !== 'mouse' && typeof e.clientX === 'number') point = e;
    if (!point || (e.touches && e.touches.length > 1)) {
      swipe = null;
      return;
    }
    if (!reelSurface(e.target)) {
      swipe = null;
      return;
    }
    armReelLock(e.target);
    swipe = { x: point.clientX, y: point.clientY, block: false, pointer: !e.touches };
  }

  function onSwipeMove(e) {
    if (!swipe) return;
    if (swipe.pointer && e.touches) return;
    if (!swipe.pointer && !e.touches) return;
    var point = e.touches ? e.touches[0] : e;
    if (!point || typeof point.clientY !== 'number') return;
    var dx = point.clientX - swipe.x;
    var dy = point.clientY - swipe.y;
    if (!swipe.block) {
      if (dx * dx + dy * dy < 64) return;
      if (Math.abs(dy) <= Math.abs(dx)) {
        swipe = null;
        return;
      }
      swipe.block = true;
    }
    blockGesture(e);
  }

  function onSwipeEnd(e) {
    var isPointer = e.type.indexOf('pointer') === 0;
    if (!swipe || swipe.pointer !== isPointer) return;
    if (swipe.block) blockGesture(e);
    swipe = null;
  }

  window.addEventListener('touchstart', onSwipeStart, true);
  window.addEventListener('touchmove', onSwipeMove, { capture: true, passive: false });
  window.addEventListener('touchend', onSwipeEnd, { capture: true, passive: false });
  window.addEventListener('touchcancel', onSwipeEnd, { capture: true, passive: false });
  window.addEventListener('pointerdown', onSwipeStart, true);
  window.addEventListener('pointermove', onSwipeMove, { capture: true, passive: false });
  window.addEventListener('pointerup', onSwipeEnd, true);
  window.addEventListener('pointercancel', onSwipeEnd, true);
  window.addEventListener('wheel', function (e) {
    if (!reelSurface(e.target)) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    blockGesture(e);
  }, { capture: true, passive: false });

  var previousApply = apply;
  apply = function () {
    previousApply();
    releaseStaleReelLocks();
  };

  true;
})();
`;
