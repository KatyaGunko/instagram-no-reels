import { useCallback, useRef, useState, type ComponentType, type Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNWebView from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes';

import { HIDE_REELS_SCRIPT } from './hideReels';

const INSTAGRAM_URL = 'https://www.instagram.com/';

/** Mobile Safari UA — Instagram login / layout behave better than the default WebView UA. */
const MOBILE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';

/**
 * react-native-webview’s cross-platform prop intersection can collapse to `never`
 * under stricter TS + RN 0.88 typings. Local props + cast avoid that breakage.
 */
type WebViewRef = {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  injectJavaScript: (script: string) => void;
};

type WebViewProps = {
  ref?: Ref<WebViewRef>;
  source: { uri: string };
  style?: StyleProp<ViewStyle>;
  userAgent?: string;
  applicationNameForUserAgent?: string;
  sharedCookiesEnabled?: boolean;
  thirdPartyCookiesEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
  onShouldStartLoadWithRequest?: () => boolean;
  onNavigationStateChange?: (nav: WebViewNavigation) => void;
  injectedJavaScript?: string;
  injectedJavaScriptBeforeContentLoaded?: string;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (e: WebViewErrorEvent) => void;
  onHttpError?: (e: WebViewHttpErrorEvent) => void;
  allowsBackForwardNavigationGestures?: boolean;
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always';
  decelerationRate?: 'normal' | 'fast' | number;
};

const WebView = RNWebView as unknown as ComponentType<WebViewProps>;

export function InstagramWebView() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebViewRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
  }, []);

  /**
   * Keep every navigation inside this WebView (external links included).
   * Locked decision: do not open the system browser; do not hard-block /reels.
   */
  const onShouldStartLoadWithRequest = useCallback(() => true, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <ToolbarButton
          label="‹"
          disabled={!canGoBack}
          onPress={() => webRef.current?.goBack()}
        />
        <ToolbarButton
          label="›"
          disabled={!canGoForward}
          onPress={() => webRef.current?.goForward()}
        />
        <View style={styles.toolbarSpacer} />
        <ToolbarButton label="↻" onPress={reload} />
      </View>

      <View style={styles.webWrap}>
        <WebView
          ref={webRef}
          source={{ uri: INSTAGRAM_URL }}
          style={styles.webview}
          userAgent={MOBILE_SAFARI_UA}
          applicationNameForUserAgent="Safari"
          // Persist session cookies across launches where the OS allows it.
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          // Stay inside the WebView for all targets (incl. window.open / target=_blank).
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onNavigationStateChange={onNavChange}
          injectedJavaScript={HIDE_REELS_SCRIPT}
          injectedJavaScriptBeforeContentLoaded={HIDE_REELS_SCRIPT}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => {
            setLoading(false);
            // Re-inject after SPA navigations that bypass beforeContentLoaded.
            webRef.current?.injectJavaScript(HIDE_REELS_SCRIPT);
          }}
          onError={(e) => {
            setLoading(false);
            setError(e.nativeEvent.description || 'Failed to load Instagram');
          }}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) {
              setError(`Instagram returned HTTP ${e.nativeEvent.statusCode}`);
            }
          }}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          contentInsetAdjustmentBehavior="automatic"
          decelerationRate="normal"
        />

        {loading && !error ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#262626" />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Couldn’t load Instagram</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={reload}>
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={{ height: insets.bottom, backgroundColor: '#fff' }} />
    </View>
  );
}

function ToolbarButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.toolbarBtn,
        disabled && styles.toolbarBtnDisabled,
        pressed && !disabled && styles.toolbarBtnPressed,
      ]}
      hitSlop={8}
    >
      <Text
        style={[
          styles.toolbarBtnLabel,
          disabled && styles.toolbarBtnLabelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const fill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dbdbdb',
    backgroundColor: '#fafafa',
    gap: 4,
  },
  toolbarSpacer: {
    flex: 1,
  },
  toolbarBtn: {
    minWidth: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  toolbarBtnPressed: {
    backgroundColor: '#efefef',
  },
  toolbarBtnDisabled: {
    opacity: 0.35,
  },
  toolbarBtnLabel: {
    fontSize: 22,
    color: '#262626',
    fontWeight: '500',
  },
  toolbarBtnLabelDisabled: {
    color: '#8e8e8e',
  },
  webWrap: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    ...fill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  errorOverlay: {
    ...fill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
  },
  errorBody: {
    fontSize: 14,
    color: '#8e8e8e',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0095f6',
    borderRadius: 8,
  },
  retryLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
