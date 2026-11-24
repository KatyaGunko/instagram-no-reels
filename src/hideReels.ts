/**
 * Injected into Instagram’s mobile web to hide Reels affordances (tab, icons, chips)
 * and the Explore recommendation grid.
 *
 * IMPORTANT: These selectors target Instagram’s DOM / CSS classes and aria labels.
 * Instagram redesigns frequently — expect breakage. When Reels UI reappears, update
 * this module only; leave the WebView shell alone.
 *
 * Policy (locked): hide UI only. Do NOT block navigation to /reels or /reel/ URLs.
 * The Explore grid is hidden only on /explore while search is empty. A typed query,
 * a search-results list, or /explore/tags|search|locations leaves results visible.
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
    '\\n[role="search"] a[href*="/reel"],[role="search"] a[href*="/reels"],[role="listbox"] a[href*="/reel"],[role="listbox"] a[href*="/reels"]{display:revert!important;visibility:visible!important;pointer-events:auto!important;}';

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

  function isPlainExplore() {
    return /^\\/explore\\/?$/.test(location.pathname);
  }

  function isSearchField(field) {
    if (!field || field.nodeType !== 1) return false;
    if (field.getAttribute('role') === 'searchbox' || field.getAttribute('type') === 'search') return true;
    var hint = ((field.getAttribute('aria-label') || '') + ' ' + (field.getAttribute('placeholder') || '')).toLowerCase();
    if (hint.indexOf('search') !== -1) return true;
    return !!(field.closest && field.closest('[role="search"]'));
  }

  function searchActive() {
    if (/\\/explore\\/(search|tags|locations|places)\\b/.test(location.pathname)) return true;
    if (/[?&]q=/.test(location.search)) return true;
    var fields = document.querySelectorAll('input, textarea, [role="searchbox"]');
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!isSearchField(field)) continue;
      var value = typeof field.value === 'string' ? field.value : '';
      if (value.trim()) return true;
    }
    return false;
  }

  function looksLikeExploreMosaic(el) {
    if (el.querySelector('input, textarea, [role="searchbox"], [role="search"]')) return false;
    var tiles = el.querySelectorAll('img, video, a[href*="/p/"], a[href*="/reel"]');
    if (tiles.length < 3) return false;
    var columns = '';
    try {
      columns = (getComputedStyle(el).gridTemplateColumns || '').trim();
    } catch (e) {
      return false;
    }
    if (!columns || columns === 'none') return false;
    var repeat = /repeat\\(\\s*(\\d+)/i.exec(columns);
    if (repeat) return parseInt(repeat[1], 10) >= 3;
    return columns.split(/\\s+/).filter(Boolean).length >= 3;
  }

  function hideExploreGrid() {
    var marked = document.querySelectorAll('[' + EXPLORE_MARK + ']');
    if (!isPlainExplore() || searchActive()) {
      for (var c = 0; c < marked.length; c++) unmarkExploreGrid(marked[c]);
      return;
    }

    var main = document.querySelector('main') || document.body;
    var divs = main.querySelectorAll('div');
    var grids = [];
    for (var i = 0; i < divs.length; i++) {
      var el = divs[i];
      var display = '';
      try {
        display = getComputedStyle(el).display;
      } catch (e) {
        continue;
      }
      if (display !== 'grid') continue;
      if (!looksLikeExploreMosaic(el)) continue;
      grids.push(el);
    }

    var outermost = [];
    for (var j = 0; j < grids.length; j++) {
      var nested = false;
      for (var k = 0; k < grids.length; k++) {
        if (j !== k && grids[k].contains(grids[j])) {
          nested = true;
          break;
        }
      }
      if (!nested) outermost.push(grids[j]);
    }

    for (var m = 0; m < marked.length; m++) {
      if (outermost.indexOf(marked[m]) === -1) unmarkExploreGrid(marked[m]);
    }
    for (var n = 0; n < outermost.length; n++) markExploreGrid(outermost[n]);
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

  true;
})();
`;
