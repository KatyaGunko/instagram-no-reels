/**
 * Injected into Instagram’s mobile web to hide Reels affordances (tab, icons, chips).
 *
 * IMPORTANT: These selectors target Instagram’s DOM / CSS classes and aria labels.
 * Instagram redesigns frequently — expect breakage. When Reels UI reappears, update
 * this module only; leave the WebView shell alone.
 *
 * Policy (locked): hide UI only. Do NOT block navigation to /reels or /reel/ URLs.
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

  function apply() {
    ensureStyle();
    hideByTextHeuristics();
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

  true;
})();
`;
