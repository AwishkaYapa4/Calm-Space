const { AndroidConfig, withAndroidManifest, withMainApplication, withGradleProperties, withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

const PACKAGE = 'com.calmsense.app';

// Pinned so Gradle uses a JDK version its embedded Kotlin compiler can parse
// (older Gradle versions choke on newer version strings like "25"). Uses the
// build machine's own JAVA_HOME/JDK rather than a hardcoded path so this
// works across dev machines/OSes, not just the original Mac it was written on.
// Survives `expo prebuild --clean`, which would otherwise regenerate
// gradle.properties without this line.
// Backslashes must become forward slashes: gradle.properties is a Java .properties
// file, where a lone backslash is an escape character — a raw Windows path like
// "C:\Program Files\..." silently loses every backslash when Gradle reads it back.
const JAVA_HOME = (
  process.env.JAVA_HOME || '/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home'
).replace(/\\/g, '/');

// Adds the permissions, notification-listener service, and screen-state receiver
// needed for on-device passive behavior capture (screen unlocks, app foreground/
// background events, notification-posted events — no notification content is read).
function withBehaviorCapture(config) {
  config = withMainApplicationPackageRegistration(config);
  config = withPinnedJavaHome(config);
  config = withBehaviorCaptureNativeSources(config);
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    addPermission(manifest, 'android.permission.PACKAGE_USAGE_STATS');
    // Required for a long-running background service on Android 9+ (FOREGROUND_SERVICE)
    // and to declare its type on Android 14+ (FOREGROUND_SERVICE_DATA_SYNC) — this
    // service polls usage stats and syncs to the backend, which is what "dataSync" means.
    addPermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_DATA_SYNC');

    addQueriesAllPackages(manifest);

    app.service = app.service || [];
    if (!app.service.some((s) => s.$['android:name'] === '.behavior.AppNotificationListenerService')) {
      app.service.push({
        $: {
          'android:name': '.behavior.AppNotificationListenerService',
          'android:label': 'CalmSense Behavior Capture',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }],
          },
        ],
      });
    }

    if (!app.service.some((s) => s.$['android:name'] === '.behavior.BehaviorCaptureForegroundService')) {
      app.service.push({
        $: {
          'android:name': '.behavior.BehaviorCaptureForegroundService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }

    if (!app.service.some((s) => s.$['android:name'] === '.behavior.BehaviorHeadlessTaskService')) {
      app.service.push({
        $: {
          'android:name': '.behavior.BehaviorHeadlessTaskService',
          'android:exported': 'false',
        },
      });
    }

    // Note: SCREEN_ON/SCREEN_OFF/USER_PRESENT are implicit broadcasts and cannot
    // be caught by a manifest-declared <receiver> since Android 8 (Oreo). Instead
    // ScreenStateReceiver is registered dynamically inside AppNotificationListenerService,
    // which the OS keeps running in the background once notification access is granted.

    return config;
  });
}

function addPermission(manifest, name) {
  manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
  const exists = manifest.manifest['uses-permission'].some((p) => p.$['android:name'] === name);
  if (!exists) {
    manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function addQueriesAllPackages(manifest) {
  manifest.manifest.queries = manifest.manifest.queries || [{}];
  const queries = manifest.manifest.queries[0];
  queries.package = queries.package || [];
  const has = queries.package.some((p) => p.$['android:name'] === PACKAGE);
  if (!has) {
    // UsageStatsManager needs visibility into other installed packages to
    // resolve human-readable app names/categories for foreground events.
    queries.intent = queries.intent || [];
    queries.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
    });
  }
}

// Registers BehaviorCapturePackage() in MainApplication.kt's getPackages() list,
// since it's a manual native module (not autolinked). Re-applied on every prebuild.
function withMainApplicationPackageRegistration(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withBehaviorCapture only supports Kotlin MainApplication.kt');
    }

    config.modResults.contents = mergeContents({
      tag: 'behavior-capture-import',
      src: config.modResults.contents,
      newSrc: 'import com.calmsense.app.behavior.BehaviorCapturePackage',
      anchor: /^import expo\.modules\.ApplicationLifecycleDispatcher/,
      offset: 0,
      comment: '//',
    }).contents;

    config.modResults.contents = mergeContents({
      tag: 'behavior-capture-register',
      src: config.modResults.contents,
      newSrc: '            packages.add(BehaviorCapturePackage())',
      anchor: /val packages = PackageList\(this\)\.packages/,
      offset: 1,
      comment: '//',
    }).contents;

    return config;
  });
}

function withPinnedJavaHome(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.java.home'
    );
    if (existing) {
      existing.value = JAVA_HOME;
    } else {
      config.modResults.push({ type: 'property', key: 'org.gradle.java.home', value: JAVA_HOME });
    }
    return config;
  });
}

// The Kotlin implementation (BehaviorCapturePackage, UsageEventsModule, the
// NotificationListenerService/foreground-service/headless-task trio, etc.) lives here
// as tracked source rather than being hand-edited inside android/, since /android is
// gitignored ("generated native folders") and expo prebuild --clean wipes it — without
// this copy step the classes referenced above (and by MainApplication.kt's registration)
// would only ever exist on whichever machine last hand-edited the generated project.
function withBehaviorCaptureNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const srcDir = path.join(__dirname, 'native/behavior');
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java/com/calmsense/app/behavior'
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of fs.readdirSync(srcDir)) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      return config;
    },
  ]);
}

module.exports = withBehaviorCapture;
